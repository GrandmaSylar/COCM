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

// Step 1: Request password reset OTP
router.post("/auth/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { identifier, method } = body; // method = 'email' or 'phone'

    if (!identifier) {
      return c.json({ error: 'Email or phone number is required' }, 400);
    }

    if (!method || !['email', 'phone'].includes(method)) {
      return c.json({ error: 'Delivery method must be email or phone' }, 400);
    }

    // Look up user by email or phone
    const isEmail = identifier.includes('@');
    let profile;

    if (isEmail) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, phone, name')
        .eq('email', identifier)
        .single();
      profile = data;
    } else {
      const normalizedFP = normalizePhone(identifier);
      const strippedFP = identifier.replace(/[\s\-()]/g, '');
      const { data } = await supabase
        .from('profiles')
        .select('id, email, phone, name')
        .eq('phone', normalizedFP)
        .single();
      profile = data;

      // Fallback: try raw/stripped input for legacy data
      if (!profile && normalizedFP !== strippedFP) {
        const { data: fallbackData } = await supabase
          .from('profiles')
          .select('id, email, phone, name')
          .eq('phone', strippedFP)
          .single();
        profile = fallbackData;
      }
    }

    if (!profile) {
      return c.json({ error: 'No account found with this identifier' }, 404);
    }

    // If method is phone, ensure user has a phone number
    if (method === 'phone' && !profile.phone) {
      return c.json({ error: 'No phone number on file for this account' }, 400);
    }

    // Generate OTP
    const otp = generateOtp();
    const tempToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Delete any existing reset OTPs for this user
    await supabase.from('otp_codes').delete().eq('user_id', profile.id).eq('method', 'password_reset');

    // Store OTP
    const { error: otpError } = await supabase.from('otp_codes').insert({
      user_id: profile.id,
      code: otp,
      method: 'password_reset',
      temp_token: tempToken,
      session_data: { deliveryMethod: method },
      expires_at: expiresAt.toISOString(),
    });

    if (otpError) {
      console.error('Error storing reset OTP:', otpError);
      return c.json({ error: 'Failed to initiate password reset: ' + otpError.message }, 500);
    }

    // Send OTP
    if (method === 'email') {
      await sendOtpEmail(profile.email, otp, profile.name);
    } else {
      await sendOtpSms(profile.phone, otp);
    }

    return c.json({
      userId: profile.id,
      tempToken,
      method,
      destination: method === 'email' ? maskEmail(profile.email) : maskPhone(profile.phone),
      hasPhone: !!profile.phone,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Step 2: Verify reset OTP
router.post("/auth/verify-reset-otp", async (c) => {
  try {
    const { userId, tempToken, code } = await c.req.json();

    if (!userId || !tempToken || !code) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('temp_token', tempToken)
      .eq('method', 'password_reset')
      .eq('used', false)
      .single();

    if (otpError || !otpRecord) {
      return c.json({ error: 'Invalid or expired code. Please try again.' }, 400);
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
      return c.json({ error: 'Code has expired. Please request a new one.' }, 400);
    }

    if (otpRecord.attempts >= 5) {
      await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
      return c.json({ error: 'Too many incorrect attempts. Please request a new code.' }, 429);
    }

    // Increment attempts
    await supabase.from('otp_codes')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);

    if (String(otpRecord.code).trim() !== String(code).trim()) {
      const remaining = 4 - otpRecord.attempts;
      return c.json({
        error: `Incorrect code. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'Please request a new code.'}`
      }, 400);
    }

    // Mark as used and generate a reset token
    const resetToken = crypto.randomUUID();
    await supabase.from('otp_codes').update({
      used: true,
      session_data: { resetToken },
    }).eq('id', otpRecord.id);

    return c.json({ resetToken });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Step 3: Reset password
router.post("/auth/reset-password", async (c) => {
  try {
    const { userId, resetToken, newPassword } = await c.req.json();

    if (!userId || !resetToken || !newPassword) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Verify the reset token exists
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('method', 'password_reset')
      .eq('used', true)
      .single();

    if (otpError || !otpRecord) {
      return c.json({ error: 'Invalid reset session. Please start over.' }, 400);
    }

    // Verify the reset token matches
    if (!otpRecord.session_data || otpRecord.session_data.resetToken !== resetToken) {
      return c.json({ error: 'Invalid reset token. Please start over.' }, 400);
    }

    // Check if the OTP was verified within the last 10 minutes
    const otpAge = Date.now() - new Date(otpRecord.created_at).getTime();
    if (otpAge > 10 * 60 * 1000) {
      await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
      return c.json({ error: 'Reset session expired. Please start over.' }, 400);
    }

    // Update the password
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (authError) {
      console.error('Error resetting password:', authError);
      return c.json({ error: 'Failed to reset password: ' + authError.message }, 500);
    }

    // Clean up the OTP record
    await supabase.from('otp_codes').delete().eq('id', otpRecord.id);

    return c.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
