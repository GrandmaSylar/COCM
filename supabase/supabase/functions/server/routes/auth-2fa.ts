import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken, checkPermission } from "../lib/auth-helpers.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";
// Additional helpers
import { logActivity, getProfileForLog } from "../lib/activity-helpers.ts";
import { recalculateMemberStatuses, applyInverseLinks } from "../lib/member-helpers.ts";
import { createNotification, notifyTabUsers } from "../lib/notification-helpers.ts";
import { normalizePhone, generateOtp, maskEmail, maskPhone, sendOtpEmail, sendOtpSms } from "../lib/two-factor-helpers.ts";

const router = new Hono();

// ============================================================================

// Send OTP (used when user chooses a method for a new device / first login)
router.post("/auth/send-otp", async (c) => {
  try {
    const { userId, tempToken, method } = await c.req.json();

    if (!userId || !tempToken || !method || !['email', 'phone'].includes(method)) {
      return c.json({ error: 'Missing or invalid required fields' }, 400);
    }

    // Find the pending OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('temp_token', tempToken)
      .eq('used', false)
      .single();

    if (otpError || !otpRecord) {
      return c.json({ error: 'Session expired or not found. Please sign in again.' }, 400);
    }

    // Generate code and expiry
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Update the pending record
    const { error: updateError } = await supabase.from('otp_codes').update({
      code: otp,
      method: method, // user chosen method
      expires_at: expiresAt.toISOString()
    }).eq('id', otpRecord.id);

    if (updateError) {
      return c.json({ error: 'Failed to update OTP method' }, 500);
    }

    // Fetch user profile to get contact info
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, phone, name')
      .eq('id', userId)
      .single();

    if (!profile) return c.json({ error: 'User not found' }, 404);

    // Dispatch OTP
    let destination = '';
    if (method === 'email') {
      await sendOtpEmail(profile.email, otp, profile.name);
      destination = maskEmail(profile.email);
    } else if (method === 'phone') {
      if (!profile.phone) {
        return c.json({ error: 'No phone number on file.' }, 400);
      }
      await sendOtpSms(profile.phone, otp);
      destination = maskPhone(profile.phone);
    }

    return c.json({ message: 'OTP sent successfully', destination });
  } catch (error) {
    console.error('Send OTP error:', error);
    return c.json({ error: 'Internal server error while sending OTP' }, 500);
  }
});

// Verify OTP code after login
router.post("/auth/verify-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, tempToken, code } = body;

    if (!userId || !tempToken || !code) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Find the OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('temp_token', tempToken)
      .eq('used', false)
      .single();

    if (otpError || !otpRecord) {
      return c.json({ error: 'Invalid or expired verification code. Please sign in again.' }, 400);
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
      return c.json({ error: 'Verification code has expired. Please sign in again.' }, 400);
    }

    // Check max attempts (5)
    if (otpRecord.attempts >= 5) {
      await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
      return c.json({ error: 'Too many incorrect attempts. Please sign in again.' }, 429);
    }

    // Increment attempts
    await supabase.from('otp_codes')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);

    // Verify code
    if (String(otpRecord.code).trim() !== String(code).trim()) {
      const remaining = 4 - otpRecord.attempts;
      return c.json({
        error: `Incorrect verification code. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'Please sign in again.'}`
      }, 400);
    }

    // Mark as used
    await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);

    // Return the stored session
    const sessionData = otpRecord.session_data;
    if (!sessionData || !sessionData.session) {
      return c.json({ error: 'Session data not found. Please sign in again.' }, 500);
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    // Update last_login timestamp and deviceId if provided in session
    const updateData: any = { last_login: new Date().toISOString() };
    if (sessionData.deviceId) {
      updateData.active_device_id = sessionData.deviceId;
    }
    await supabase.from('profiles').update(updateData).eq('id', profile.id);

    // Log login activity
    await logActivity({
      userId: profile.id, userName: profile.name, userRole: profile.role,
      action: 'login', entityType: 'session', description: `${profile.name} logged in`
    });

    return c.json({
      session: sessionData.session,
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        isActive: profile.is_active,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return c.json({ error: 'Internal server error during verification' }, 500);
  }
});

// Resend OTP code
router.post("/auth/resend-otp", async (c) => {
  try {
    const { userId, tempToken } = await c.req.json();

    if (!userId || !tempToken) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify there's an existing OTP request
    const { data: existing, error: existError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('temp_token', tempToken)
      .eq('used', false)
      .single();

    if (existError || !existing) {
      return c.json({ error: 'Session expired. Please sign in again.' }, 400);
    }

    if (new Date(existing.expires_at) < new Date()) {
      await supabase.from('otp_codes').delete().eq('id', existing.id);
      return c.json({ error: 'Session expired. Please sign in again.' }, 400);
    }

    if (existing.method === 'pending') {
      return c.json({ error: 'Please choose an authentication method first.' }, 400);
    }

    // Generate new code, update the record
    const newCode = generateOtp();
    const newExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from('otp_codes').update({
      code: newCode,
      expires_at: newExpiry.toISOString(),
      attempts: 0,
    }).eq('id', existing.id);

    // Fetch profile to get contact info
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, phone, name, two_fa_method')
      .eq('id', userId)
      .single();

    if (!profile) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Send the new code
    if (existing.method === 'email') {
      await sendOtpEmail(profile.email, newCode, profile.name);
    } else if (existing.method === 'phone') {
      await sendOtpSms(profile.phone, newCode);
    }

    return c.json({ message: 'Verification code resent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update 2FA preference (authenticated)
router.patch("/auth/2fa-preference", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { method } = await c.req.json();

    if (!method || !['none', 'email', 'phone'].includes(method)) {
      return c.json({ error: 'Invalid 2FA method. Must be none, email, or phone.' }, 400);
    }

    // If choosing phone, verify user has a phone number
    if (method === 'phone') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();

      if (!profile?.phone) {
        return c.json({ error: 'No phone number on file. Please add a phone number to your profile first.' }, 400);
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ two_fa_method: method })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating 2FA preference:', error);
      return c.json({ error: 'Failed to update 2FA preference' }, 500);
    }

    return c.json({ message: '2FA preference updated successfully', method });
  } catch (error) {
    console.error('Update 2FA preference error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
