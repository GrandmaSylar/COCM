import { createClient } from "@supabase/supabase-js";
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
// Sign up new user
router.post("/auth/signup", async (c)=>{
  try {
    const body = await c.req.json().catch(()=>null);
    console.log("Signup attempt:", body);
    // Explicit check inside the route
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Signup failed: Missing server secrets");
      return c.json({
        error: 'Server Misconfiguration',
        details: 'SUPABASE_URL or SERVICE_ROLE_KEY is not set in Edge Function Secrets.'
      }, 500);
    }
    if (!body) {
      return c.json({
        error: 'Invalid JSON body'
      }, 400);
    }
    const { email, password, name, role, phone } = body;
    if (!email || !password || !name || !role) {
      return c.json({
        error: 'Missing required fields'
      }, 400);
    }
    if (!SYSTEM_ROLES.includes(role)) {
      const { data: customRole } = await supabase
        .from('custom_roles')
        .select('name')
        .eq('name', role)
        .maybeSingle();
        
      if (!customRole) {
        return c.json({
          error: 'Invalid role'
        }, 400);
      }
    }
    const normalizedSignupPhone = phone ? normalizePhone(phone) : null;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        phone: normalizedSignupPhone
      }
    });
    if (authError) {
      console.error('Auth error during signup:', authError);
      return c.json({
        error: authError.message
      }, 400);
    }
    if (!authData.user) {
      return c.json({
        error: 'Failed to create user'
      }, 500);
    }
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      name,
      email,
      phone: normalizedSignupPhone,
      role,
      is_active: false,
      approval_status: 'pending'
    });
    if (profileError) {
      console.error('Profile creation error:', profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return c.json({
        error: 'Failed to create user profile'
      }, 500);
    }
    return c.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
        role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({
      error: 'Internal server error during signup: ' + (error instanceof Error ? error.message : String(error))
    }, 500);
  }
});
// ... existing routes for signin, signout, members, attendance, services, giving, visitors, permissions ...
// (Copying remaining routes to ensure file is complete and runnable)
router.post("/auth/signin", async (c)=>{
  try {
    const body = await c.req.json();
    const { email, phone, identifier, password, deviceId } = body;

    // Support both legacy email field and new identifier field
    let loginEmail = email;

    // If identifier is provided, detect if it's email or phone
    if (identifier) {
      const isEmail = identifier.includes('@');
      if (isEmail) {
        loginEmail = identifier;
      } else {
        // It's a phone number, look up the email
        // Try normalized form first, then raw input (for legacy data)
        const normalizedPhone = normalizePhone(identifier);
        const strippedPhone = identifier.replace(/[\s\-()]/g, '');
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('phone', normalizedPhone)
          .single();

        // Fallback: try raw/stripped input in case DB has un-normalized data
        if ((profileError || !profile) && normalizedPhone !== strippedPhone) {
          const fallback = await supabase
            .from('profiles')
            .select('email')
            .eq('phone', strippedPhone)
            .single();
          profile = fallback.data;
          profileError = fallback.error;
        }

        if (profileError || !profile) {
          return c.json({
            error: 'No account found with this phone number'
          }, 404);
        }
        loginEmail = profile.email;
      }
    } else if (phone && !email) {
      // Legacy phone field support
      const normalizedLegacyPhone = normalizePhone(phone);
      const strippedLegacyPhone = phone.replace(/[\s\-()]/g, '');
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone', normalizedLegacyPhone)
        .single();

      if ((profileError || !profile) && normalizedLegacyPhone !== strippedLegacyPhone) {
        const fallback = await supabase
          .from('profiles')
          .select('email')
          .eq('phone', strippedLegacyPhone)
          .single();
        profile = fallback.data;
        profileError = fallback.error;
      }

      if (profileError || !profile) {
        return c.json({
          error: 'No account found with this phone number'
        }, 404);
      }
      loginEmail = profile.email;
    }

    if (!loginEmail || !password) {
      return c.json({
        error: 'Email/phone and password required'
      }, 400);
    }
    const authClient = createClient(supabaseUrl!, serviceRoleKey!);
    const { data, error } = await authClient.auth.signInWithPassword({
      email: loginEmail,
      password
    });
    if (error) {
      console.error('Sign in error:', error);
      return c.json({
        error: 'Invalid credentials'
      }, 401);
    }
    if (!data.session) {
      return c.json({
        error: 'No session created'
      }, 500);
    }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return c.json({
        error: 'User profile not found'
      }, 404);
    }
    if (!profile.is_active) {
      const message = profile.approval_status === 'pending'
        ? 'Account is pending approval. Please wait for an administrator to approve your account.'
        : profile.approval_status === 'rejected'
        ? 'Account has been rejected. Please contact an administrator.'
        : 'Account is deactivated';
      return c.json({
        error: message
      }, 403);
    }

    // Check if deviceID doesn't match active_device_id or if it's their first time
    const requiresDeviceOtp = !profile.active_device_id || profile.active_device_id !== deviceId;

    // Check if 2FA is strictly enabled, or if it's a new device
    // DISABLED 2FA check as requested:
    if (false /* requiresDeviceOtp || (profile.two_fa_method && profile.two_fa_method !== 'none') */) {
      const tempToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Delete any existing unused OTPs for this user
      await supabase.from('otp_codes').delete().eq('user_id', profile.id).eq('used', false);

      // Store a pending OTP session without a code or method yet (client will prompt user to choose)
      // Note: We use a generic 'pending' method so the user can select email/sms next.
      const { error: otpError } = await supabase.from('otp_codes').insert({
        user_id: profile.id,
        code: 'PENDING', // Will be overwritten when method chosen
        method: 'pending',
        temp_token: tempToken,
        session_data: { session: data.session, deviceId }, // store deviceId to set it upon verification
        expires_at: expiresAt.toISOString(),
      });

      if (otpError) {
        console.error('Error storing OTP:', otpError);
        return c.json({ error: 'Failed to initiate verification: ' + otpError?.message }, 500);
      }

      // Return 2FA required response (NO session returned)
      // Offer choice between email/sms
      return c.json({
        requires2FA: true,
        method: 'choose', // Signals the frontend to show choice
        userId: profile.id,
        tempToken: tempToken,
        availableMethods: ['email', 'phone'],
        destination: '', // Will be set after choice
      });
    }

    // Update last_login and active_device_id timestamp
    await supabase.from('profiles').update({ 
      last_login: new Date().toISOString(),
      active_device_id: deviceId
    }).eq('id', profile.id);

    // Log login activity
    await logActivity({
      userId: profile.id, userName: profile.name, userRole: profile.role,
      action: 'login', entityType: 'session', description: `${profile.name} logged in`
    });

    return c.json({
      session: data.session,
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
    console.error('Sign in error:', error);
    return c.json({
      error: 'Internal server error during sign in'
    }, 500);
  }
});
router.post("/auth/signout", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      const userClient = createClient(supabaseUrl!, token!);
      await userClient.auth.signOut();
    }

    // Log logout activity
    const logProfile = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logProfile.name, userRole: logProfile.role,
      action: 'logout', entityType: 'session', description: `${logProfile.name} logged out`
    });

    // Clear last_login so user immediately shows offline
    await supabase.from('profiles').update({ last_login: null }).eq('id', user.id);

    return c.json({
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('Sign out error:', error);
    return c.json({
      error: 'Internal server error during sign out'
    }, 500);
  }
});

// Heartbeat - updates last_login to keep online status current
router.post("/auth/heartbeat", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    const body = await c.req.json().catch(() => ({}));
    const { deviceId } = body;

    if (!user) {
      // Return 200 OK to prevent browser console from logging a 401 error. 
      // The frontend logic handles the semantic error payload.
      return c.json({ ok: false, error: 'Unauthorized' }, 200);
    }

    // Check device ID matches active device
    if (deviceId) {
      const { data: profile } = await supabase.from('profiles').select('active_device_id').eq('id', user.id).single();
      if (profile && profile.active_device_id && profile.active_device_id !== deviceId) {
        return c.json({ ok: false, error: 'logged_in_elsewhere' }, 200);
      }
    }

    await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    return c.json({ ok: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return c.json({ ok: false, error: 'Internal server error' }, 200);
  }
});

router.get("/auth/session", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        session: null
      }, 401);
    }
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error || !profile) {
      return c.json({
        error: 'Profile not found'
      }, 404);
    }
    return c.json({
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
    console.error('Session check error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// ============================================================================

export default router;
