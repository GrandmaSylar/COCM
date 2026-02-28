import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@supabase/supabase-js";
// Create Hono app. Supabase invokes at /functions/v1/server so path is e.g. /members/:id (no /server prefix).
const app = new Hono().basePath('/server');
// DEBUG: Check for required Env Vars
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
// Log fatal errors but DO NOT throw (prevents 500 crash)
if (!supabaseUrl || !serviceRoleKey) {
  console.error("FATAL ERROR: Missing Supabase Environment Variables!");
  console.error("SUPABASE_URL present:", !!supabaseUrl);
  console.error("SUPABASE_SERVICE_ROLE_KEY present:", !!serviceRoleKey);
}
// Create Supabase client with fallbacks
// This ensures the script compiles and runs even if secrets are missing
const supabase = createClient(supabaseUrl || 'https://missing-url.supabase.co', serviceRoleKey || 'missing-key', {
  auth: { autoRefreshToken: false, persistSession: false }
});
// Create a fresh Supabase client for signInWithPassword (so it doesn't pollute the global service role client)
function createAuthClient() {
  return createClient(supabaseUrl || 'https://missing-url.supabase.co', serviceRoleKey || 'missing-key', {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
// Create Supabase client for auth operations
function getSupabaseClient(accessToken) {
  if (accessToken) {
    return createClient(supabaseUrl || 'https://missing-url.supabase.co', anonKey || 'missing-key', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });
  }
  return supabase;
}
// Helper to get user from token
async function getUserFromToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }
  return user;
}

// Helper to check if user has a specific permission
async function checkPermission(userId: string, permission: string): Promise<boolean> {
  // Get user's profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile) {
    return false;
  }

  // Dev role has all permissions
  if (profile.role === 'dev') {
    return true;
  }

  // Admin role has grant_permissions and manage_giving_types
  if (profile.role === 'admin') {
    if (['grant_permissions', 'manage_giving_types', 'manage_users', 'manage_settings'].includes(permission)) {
      return true;
    }
  }

  // Check for temporary permissions
  const { data: tempPermissions } = await supabase
    .from('temporary_permissions')
    .select('*')
    .eq('user_id', userId)
    .eq('permission', permission)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (tempPermissions) {
    return true;
  }

  return false;
}
// Helper to convert camelCase to snake_case
function toSnakeCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item)=>toSnakeCase(item));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key)=>{
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}
// Helper to convert snake_case to camelCase
function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item)=>toCamelCase(item));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key)=>{
      let camelKey = key.replace(/_([a-z])/g, (_, letter)=>letter.toUpperCase());

      // Handle special field mappings (photo_url -> photo)
      if (camelKey === 'photoUrl') {
        camelKey = 'photo';
      }

      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}
// ============================================================================
// MEMBER STATUS RECALCULATION
// ============================================================================

async function recalculateMemberStatuses(changedByUserId?: string) {
  try {
    // Get last 4 Sunday Main Service records ordered by date DESC
    const { data: sundayRecords } = await supabase
      .from('attendance_records')
      .select('id, date')
      .eq('service_type', 'Sunday Main Service')
      .eq('attendance_type', 'individual')
      .order('date', { ascending: false })
      .limit(4);

    if (!sundayRecords || sundayRecords.length < 4) {
      // Not enough Sunday records to evaluate - skip
      return;
    }

    const recordIds = sundayRecords.map(r => r.id);
    const oldestRecordDate = sundayRecords[sundayRecords.length - 1].date;

    // Get attendance counts per member for those 4 records
    const { data: attendanceCounts } = await supabase
      .from('attendance_entries')
      .select('member_id')
      .in('attendance_record_id', recordIds);

    // Build a map: memberId -> count of attendances in last 4 Sundays
    const countMap: Record<string, number> = {};
    if (attendanceCounts) {
      for (const entry of attendanceCounts) {
        countMap[entry.member_id] = (countMap[entry.member_id] || 0) + 1;
      }
    }

    // Get all members that should be evaluated
    const { data: members } = await supabase
      .from('members')
      .select('id, status, join_date, leave_end_date')
      .not('status', 'eq', 'blacklisted');

    if (!members) return;

    const today = new Date().toISOString().split('T')[0];
    const updates: { id: string; oldStatus: string; newStatus: string }[] = [];

    // Batch: find which on-leave (sick/studies/traveled) members (with ended leave) have attendance
    const ON_LEAVE_STATUSES = ['sick', 'studies', 'traveled'];
    const endedLeaveIds = members
      .filter(m => ON_LEAVE_STATUSES.includes(m.status) && m.leave_end_date && m.leave_end_date < today)
      .map(m => m.id);
    const leaveWithAttendance = new Set<string>();
    if (endedLeaveIds.length > 0) {
      const { data: leaveAtt } = await supabase.from('attendance_entries')
        .select('member_id')
        .in('member_id', endedLeaveIds)
        .in('attendance_record_id', recordIds);
      if (leaveAtt) {
        for (const e of leaveAtt) leaveWithAttendance.add(e.member_id);
      }
    }

    // Batch: for 'new' members, get count of Sunday records since each unique join_date
    // Group new members by join_date to minimize queries
    const newMembers = members.filter(m => m.status === 'new');
    const joinDates = [...new Set(newMembers.map(m => m.join_date).filter(Boolean))];
    const sundayCountSinceJoin: Record<string, number> = {};
    if (joinDates.length > 0) {
      // Get the earliest join date and fetch all Sunday records from there
      const earliestJoin = joinDates.sort()[0];
      const { data: allSundaysSinceJoin } = await supabase
        .from('attendance_records')
        .select('id, date')
        .eq('service_type', 'Sunday Main Service')
        .eq('attendance_type', 'individual')
        .gte('date', earliestJoin)
        .order('date', { ascending: true });
      if (allSundaysSinceJoin) {
        for (const jd of joinDates) {
          sundayCountSinceJoin[jd] = allSundaysSinceJoin.filter(r => r.date >= jd).length;
        }
      }
    }

    for (const member of members) {
      // Skip on-leave members (sick/studies/traveled) unless their leave has ended and they've attended
      if (ON_LEAVE_STATUSES.includes(member.status)) {
        if (!member.leave_end_date || member.leave_end_date >= today) {
          continue; // Still on leave, skip
        }
        if (!leaveWithAttendance.has(member.id)) {
          continue; // No attendance after leave end, keep as-is
        }
        // Has attendance after leave end — fall through to recalculate
      }

      // For 'new' members: check if at least 4 Sunday records exist since their join date
      if (member.status === 'new') {
        const count = sundayCountSinceJoin[member.join_date] || 0;
        if (count < 4) {
          continue; // Not enough Sundays since they joined, keep as 'new'
        }
      }

      const attendCount = countMap[member.id] || 0;
      let newStatus: string;

      if (attendCount >= 3) {
        newStatus = 'active';
      } else if (attendCount >= 1) {
        newStatus = 'semi-active';
      } else {
        newStatus = 'inactive';
      }

      if (newStatus !== member.status) {
        updates.push({ id: member.id, oldStatus: member.status, newStatus });
      }
    }

    // Apply updates
    for (const update of updates) {
      await supabase
        .from('members')
        .update({ status: update.newStatus, updated_at: new Date().toISOString() })
        .eq('id', update.id);

      // Log the status change
      await supabase
        .from('member_status_log')
        .insert({
          member_id: update.id,
          previous_status: update.oldStatus,
          new_status: update.newStatus,
          change_type: 'automatic',
          changed_by: changedByUserId || null,
          reason: `Auto-recalculated after Sunday Main Service attendance`
        });

      // Get member name for notification
      const { data: memberInfo } = await supabase.from('members').select('first_name, last_name').eq('id', update.id).single();
      const mName = memberInfo ? `${memberInfo.first_name} ${memberInfo.last_name}` : 'A member';

      // Notify users with members tab access
      notifyTabUsers('members', {
        type: 'member_status_change', title: 'Member Status Changed',
        message: `${mName} changed from ${update.oldStatus} to ${update.newStatus} (auto-recalculated).`,
        entityType: 'member', entityId: update.id, excludeUserId: changedByUserId
      });
    }

    console.log(`Status recalculation complete: ${updates.length} members updated`);
  } catch (error) {
    console.error('Status recalculation error:', error);
  }
}

// ============================================================================
// ACTIVITY LOG HELPER
// ============================================================================
async function logActivity(opts: {
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: any;
}) {
  try {
    console.log('logActivity called:', opts.action, opts.entityType, opts.description);
    const { error } = await supabase.from('activity_log').insert({
      user_id: opts.userId,
      user_name: opts.userName,
      user_role: opts.userRole,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId || null,
      description: opts.description,
      metadata: opts.metadata || {},
    });
    if (error) {
      console.error('Activity log insert error:', error.message, error.details, error.hint);
    } else {
      console.log('Activity log insert success:', opts.action, opts.description);
    }
  } catch (err) {
    console.error('Failed to log activity (exception):', err);
  }
}

// Helper to get profile for logging
async function getProfileForLog(userId: string) {
  const { data } = await supabase.from('profiles').select('name, role').eq('id', userId).single();
  return data || { name: 'Unknown', role: 'unknown' };
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================
async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  message: string;
  tab?: string;
  entityType?: string;
  entityId?: string;
}) {
  try {
    // Check notification_type_config — skip if disabled or user's role not allowed
    const { data: config } = await supabase
      .from('notification_type_config')
      .select('is_enabled, allowed_roles, allowed_user_ids')
      .eq('type', opts.type)
      .maybeSingle();

    if (config) {
      if (!config.is_enabled) return; // notification type is disabled globally
      // Check if user matches allowed roles or specific user ids
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', opts.userId).maybeSingle();
      const userRole = profile?.role || '';
      const roleAllowed = (config.allowed_roles || []).includes(userRole);
      const userAllowed = (config.allowed_user_ids || []).includes(opts.userId);
      if (!roleAllowed && !userAllowed) return; // user not in audience
    }
    // Config absent = allow (not yet seeded), config present = gate above
    await supabase.from('notifications').insert({
      user_id: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      tab: opts.tab || null,
      entity_type: opts.entityType || null,
      entity_id: opts.entityId || null,
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

async function notifyTabUsers(tab: string, opts: {
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  excludeUserId?: string;
}) {
  try {
    // Get all dev users (always have access)
    const { data: devUsers } = await supabase.from('profiles').select('id').eq('role', 'dev').eq('is_active', true);
    // Get users with explicit tab access
    const { data: tabUsers } = await supabase.from('user_tab_access').select('user_id').eq('tab', tab);

    const userIds = new Set<string>();
    if (devUsers) devUsers.forEach(u => userIds.add(u.id));
    if (tabUsers) tabUsers.forEach(u => userIds.add(u.user_id));

    // Exclude the user who triggered the action
    if (opts.excludeUserId) userIds.delete(opts.excludeUserId);

    const notifications = Array.from(userIds).map(userId => ({
      user_id: userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      tab,
      entity_type: opts.entityType || null,
      entity_id: opts.entityId || null,
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
  } catch (err) {
    console.error('Failed to notify tab users:', err);
  }
}

// ============================================================================
// 2FA HELPER FUNCTIONS
// ============================================================================

function normalizePhone(phone: string): string {
  const stripped = phone.replace(/[\s\-()]/g, '');
  if (/^0\d{9}$/.test(stripped)) return '+233' + stripped.slice(1);
  if (/^233\d{9}$/.test(stripped)) return '+' + stripped;
  if (/^\+233\d{9}$/.test(stripped)) return stripped;
  return stripped;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (user.length <= 2) return user[0] + '***@' + domain;
  return user[0] + '***' + user[user.length - 1] + '@' + domain;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '***' + phone;
  return '***' + phone.slice(-4);
}

async function sendOtpEmail(email: string, code: string, name: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.error('RESEND_API_KEY not set — OTP email not sent. Code:', code);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('OTP_FROM_EMAIL') || 'CoC.M <onboarding@resend.dev>',
        to: [email],
        subject: 'Your CoC.M verification code',
        html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
          <h2 style="color:#333;">Verification Code</h2>
          <p>Hello ${name},</p>
          <p>Your verification code is:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f4f4f5;border-radius:8px;margin:16px 0;">${code}</div>
          <p style="color:#666;font-size:14px;">This code expires in 5 minutes. If you did not request this, please ignore this email.</p>
          <p style="color:#999;font-size:12px;">Church of Christ, Mataheko Congregation</p>
        </div>`,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Resend API error:', err);
    }
  } catch (err) {
    console.error('Failed to send OTP email:', err);
  }
}

async function sendOtpSms(phone: string, code: string) {
  // Temporary console log to simulate SMS sending testing
  console.log(`[SIMULATED SMS OTP] To: ${phone} | Code: ${code}`);

  const clientId = Deno.env.get('HUBTEL_CLIENT_ID');
  const clientSecret = Deno.env.get('HUBTEL_CLIENT_SECRET');
  const senderId = Deno.env.get('HUBTEL_SENDER_ID') || 'COCM';

  if (!clientId || !clientSecret) {
    console.error('Hubtel API credentials not set — OTP SMS not sent. Code:', code);
    return;
  }

  try {
    const res = await fetch(`https://smsc.hubtel.com/v1/messages/send?clientid=${clientId}&clientsecret=${clientSecret}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: senderId,
        To: phone,
        Content: `Your CoC.M verification code is: ${code}. This code expires in 5 minutes.`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Hubtel API error:', errText);
    } else {
      const result = await res.json();
      console.log('Hubtel SMS Sent:', result);
    }
  } catch (err) {
    console.error('Failed to send OTP SMS via Hubtel:', err);
  }
}

// Middleware
app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: [
    "Content-Type",
    "Authorization"
  ],
  allowMethods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],
  exposeHeaders: [
    "Content-Length"
  ],
  maxAge: 600
}));
// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get("/health", (c)=>{
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    check: {
      url: !!supabaseUrl,
      key: !!serviceRoleKey
    }
  });
});
// ============================================================================
// AUTH ROUTES
// ============================================================================
// Sign up new user
app.post("/auth/signup", async (c)=>{
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
    if (![
      'dev',
      'admin',
      'pastor',
      'elder'
    ].includes(role)) {
      return c.json({
        error: 'Invalid role'
      }, 400);
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
      error: 'Internal server error during signup: ' + error.message
    }, 500);
  }
});
// ... existing routes for signin, signout, members, attendance, services, giving, visitors, permissions ...
// (Copying remaining routes to ensure file is complete and runnable)
app.post("/auth/signin", async (c)=>{
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
    const authClient = createAuthClient();
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
    if (requiresDeviceOtp || (profile.two_fa_method && profile.two_fa_method !== 'none')) {
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
        return c.json({ error: 'Failed to initiate verification: ' + otpError.message }, 500);
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
app.post("/auth/signout", async (c)=>{
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
      const userClient = getSupabaseClient(token);
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
app.post("/auth/heartbeat", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    const body = await c.req.json().catch(() => ({}));
    const { deviceId } = body;

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check device ID matches active device
    if (deviceId) {
      const { data: profile } = await supabase.from('profiles').select('active_device_id').eq('id', user.id).single();
      if (profile && profile.active_device_id && profile.active_device_id !== deviceId) {
        return c.json({ error: 'logged_in_elsewhere' }, 401);
      }
    }

    await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    return c.json({ ok: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get("/auth/session", async (c)=>{
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
// 2FA ROUTES
// ============================================================================

// Send OTP (used when user chooses a method for a new device / first login)
app.post("/auth/send-otp", async (c) => {
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
app.post("/auth/verify-otp", async (c) => {
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
app.post("/auth/resend-otp", async (c) => {
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
app.patch("/auth/2fa-preference", async (c) => {
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
// FORGOT PASSWORD ROUTES
// ============================================================================

// Step 1: Request password reset OTP
app.post("/auth/forgot-password", async (c) => {
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
app.post("/auth/verify-reset-otp", async (c) => {
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
app.post("/auth/reset-password", async (c) => {
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
// MEMBER ROUTES
// ============================================================================
app.get("/members", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    // Fetch members
    const { data: members, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching members:', error);
      return c.json({ error: 'Failed to fetch members' }, 500);
    }

    // Fetch family members for all members in a single batched query (optimized)
    const memberIds = members?.map(m => m.id) || [];
    let familyMembersMap: Record<string, any[]> = {};

    if (memberIds.length > 0) {
      const { data: allFamilyMembers } = await supabase
        .from('family_members')
        .select('*')
        .in('member_id', memberIds);

      // Group family members by member_id
      if (allFamilyMembers) {
        for (const fm of allFamilyMembers) {
          if (!familyMembersMap[fm.member_id]) {
            familyMembersMap[fm.member_id] = [];
          }
          familyMembersMap[fm.member_id].push(fm);
        }
      }
    }

    // Attach family members to each member
    const membersWithFamily = members?.map(member => ({
      ...member,
      family_members: familyMembersMap[member.id] || []
    })) || [];

    // Transform to camelCase
    const transformedMembers = toCamelCase(membersWithFamily);

    return c.json(transformedMembers);
  } catch (error) {
    console.error('Get members error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.get("/members/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const { data: member, error } = await supabase.from('members').select(`
        *,
        family_members!family_members_member_id_fkey (*)
      `).eq('id', id).single();
    if (error) {
      console.error('Error fetching member:', error);
      // PGRST116 = no rows returned (member does not exist)
      if (error.code === 'PGRST116') {
        return c.json({
          error: 'Member not found'
        }, 404);
      }
      return c.json({
        error: error.message || 'Failed to fetch member'
      }, 500);
    }
    return c.json(toCamelCase(member));
  } catch (error) {
    console.error('Get member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.get("/members/:id/analytics", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const memberId = c.req.param('id');

    // Get attendance records for this member
    const { data: attendanceEntries, error: attendanceError } = await supabase
      .from('attendance_entries')
      .select(`
        attendance_record:attendance_records!inner (
          id,
          date,
          service_type,
          start_time,
          end_time,
          attendance_type
        )
      `)
      .eq('member_id', memberId)
      .eq('attendance_records.attendance_type', 'individual')
      .order('created_at', { ascending: false });

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      return c.json({
        error: 'Failed to fetch analytics'
      }, 500);
    }

    // Calculate attendance stats
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const allRecords = attendanceEntries
      .map(entry => entry.attendance_record)
      .filter(record => record !== null);

    const thisMonthRecords = allRecords.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= thisMonthStart && recordDate <= thisMonthEnd;
    });

    // Get total individual services this month from attendance_records
    const { data: allServicesThisMonth } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('attendance_type', 'individual')
      .gte('date', thisMonthStart.toISOString().split('T')[0])
      .lte('date', thisMonthEnd.toISOString().split('T')[0]);

    const totalServices = allServicesThisMonth?.length || 0;
    const attendedServices = thisMonthRecords.length;
    const percentage = totalServices > 0 ? Math.round((attendedServices / totalServices) * 100) : 0;

    // Format recent activity (last 10)
    const recentActivity = allRecords.slice(0, 10).map(record => ({
      date: record.date,
      type: 'attendance',
      description: record.service_type
    }));

    return c.json({
      attendanceStats: {
        thisMonth: attendedServices,
        totalServices: totalServices,
        percentage: percentage
      },
      recentActivity: recentActivity
    });
  } catch (error) {
    console.error('Get member analytics error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// ── GET /members/:id/attendance-history ──────────────────────────────
app.get("/members/:id/attendance-history", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const memberId = c.req.param('id');
    const fromParam = c.req.query('from');
    const toParam = c.req.query('to');

    // Get member info (name, join date)
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('first_name, last_name, other_names, join_date')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    const joinDate = member.join_date || '2020-01-01';
    const today = new Date().toISOString().split('T')[0];
    const from = fromParam || joinDate;
    const to = toParam || today;

    // Get ALL individual attendance records in the date range
    const { data: allRecords, error: recordsError } = await supabase
      .from('attendance_records')
      .select('id, date, service_type, start_time, end_time')
      .eq('attendance_type', 'individual')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (recordsError) {
      console.error('Error fetching attendance records:', recordsError);
      return c.json({ error: 'Failed to fetch attendance records' }, 500);
    }

    // Get this member's attendance entries (records they were present for)
    const { data: presentEntries, error: entriesError } = await supabase
      .from('attendance_entries')
      .select('attendance_record_id')
      .eq('member_id', memberId);

    if (entriesError) {
      console.error('Error fetching attendance entries:', entriesError);
      return c.json({ error: 'Failed to fetch attendance entries' }, 500);
    }

    const presentRecordIds = new Set(
      (presentEntries || []).map((e: any) => e.attendance_record_id)
    );

    // Get absentee records for this member
    const { data: absenteeRecords, error: absenteeError } = await supabase
      .from('absentee_records')
      .select('attendance_record_id, requested_permission, reason, reason_notes, absence_start_date, absence_end_date, until_further_notice')
      .eq('member_id', memberId);

    if (absenteeError) {
      console.error('Error fetching absentee records:', absenteeError);
      // Non-fatal, continue without absence info
    }

    const absenteeMap = new Map<string, any>();
    (absenteeRecords || []).forEach((r: any) => {
      absenteeMap.set(r.attendance_record_id, {
        requestedPermission: r.requested_permission || false,
        reason: r.reason || null,
        reasonNotes: r.reason_notes || null,
        absenceStartDate: r.absence_start_date || null,
        absenceEndDate: r.absence_end_date || null,
        untilFurtherNotice: r.until_further_notice || false
      });
    });

    // Build records list
    const serviceTypeNames: Record<string, string> = {
      sunday_morning: 'Sunday Main Service',
      sunday_evening: 'Sunday Evening Service',
      midweek: 'Midweek Service',
      special: 'Special Service',
      other: 'Other Service'
    };

    let totalPresent = 0;
    let totalAbsent = 0;

    const records = (allRecords || []).map((rec: any) => {
      const isPresent = presentRecordIds.has(rec.id);
      if (isPresent) totalPresent++;
      else totalAbsent++;

      return {
        date: rec.date,
        serviceType: rec.service_type,
        serviceName: serviceTypeNames[rec.service_type] || rec.service_type,
        startTime: rec.start_time,
        endTime: rec.end_time,
        status: isPresent ? 'present' : 'absent',
        absenceInfo: !isPresent ? (absenteeMap.get(rec.id) || null) : null
      };
    });

    const totalServices = records.length;
    const percentage = totalServices > 0 ? Math.round((totalPresent / totalServices) * 100 * 10) / 10 : 0;

    const memberName = [member.first_name, member.other_names, member.last_name].filter(Boolean).join(' ');

    return c.json({
      memberName,
      joinDate,
      summary: {
        totalServices,
        totalPresent,
        totalAbsent,
        percentage
      },
      records
    });
  } catch (error) {
    console.error('Get member attendance history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post("/members", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const memberData = await c.req.json();
    const { familyMembers, ...memberInfo } = memberData;
    // Convert camelCase to snake_case for database
    const dbMemberData = toSnakeCase(memberInfo);

    // Handle special field mappings (photo -> photo_url)
    if (dbMemberData.photo !== undefined) {
      dbMemberData.photo_url = dbMemberData.photo;
      delete dbMemberData.photo;
    }

    // Set join_date to today if not provided
    if (!dbMemberData.join_date) {
      dbMemberData.join_date = new Date().toISOString().split('T')[0];
    }

    // Force 'new' status for all newly created members
    dbMemberData.status = 'new';

    const { data: member, error: memberError } = await supabase.from('members').insert({
      ...dbMemberData,
      created_by: user.id
    }).select().single();
    if (memberError) {
      console.error('Error creating member:', memberError);
      return c.json({
        error: 'Failed to create member: ' + memberError.message
      }, 500);
    }
    if (familyMembers && familyMembers.length > 0) {
      // Convert family members to snake_case
      const familyMembersData = familyMembers.map((fm: any) => {
        const snakeFm = toSnakeCase(fm);
        // Remove the temp id and ensure member_id is set
        const { id: _tempId, ...rest } = snakeFm;
        return {
          ...rest,
          member_id: member.id
        };
      });
      console.log('Inserting family members:', JSON.stringify(familyMembersData));
      const { error: fmError } = await supabase.from('family_members').insert(familyMembersData);
      if (fmError) {
        console.error('Error inserting family members:', fmError);
      }
    }
    const { data: completeMember } = await supabase.from('members').select(`
        *,
        family_members!family_members_member_id_fkey (*)
      `).eq('id', member.id).single();

    // Log activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'create', entityType: 'member', entityId: member.id,
      description: `Registered new member: ${dbMemberData.first_name} ${dbMemberData.last_name}`
    });

    // Notify users with members tab access
    notifyTabUsers('members', {
      type: 'member_registered', title: 'New Member Registered',
      message: `${dbMemberData.first_name} ${dbMemberData.last_name} was registered as a new member.`,
      entityType: 'member', entityId: member.id, excludeUserId: user.id
    });

    // Convert response back to camelCase for frontend
    return c.json(toCamelCase(completeMember || member), 201);
  } catch (error) {
    console.error('Create member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.put("/members/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const memberData = await c.req.json();
    const { familyMembers, ...memberInfo } = memberData;

    // Convert camelCase to snake_case for database
    const dbMemberData = toSnakeCase(memberInfo);

    // Handle special field mappings (photo -> photo_url)
    if (dbMemberData.photo !== undefined) {
      dbMemberData.photo_url = dbMemberData.photo;
      delete dbMemberData.photo;
    }

    // Only pass columns that exist on members table (avoid 500 from occupation, hometown, id, etc.)
    const allowedColumns = [
      'first_name', 'last_name', 'other_names', 'email', 'phone', 'second_phone',
      'gender', 'date_of_birth', 'marital_status', 'residence_location', 'digital_address',
      'zone', 'zone_number', 'notes', 'status', 'join_date', 'photo_url',
      'baptism_info', 'legal_info', 'ministries',
      'sabbatical_start_date', 'sabbatical_end_date', 'sabbatical_reason'
    ];
    const updatePayload = {};
    for (const key of allowedColumns) {
      if (dbMemberData[key] !== undefined) {
        updatePayload[key] = dbMemberData[key];
      }
    }

    // Log manual status changes
    if (updatePayload.status) {
      const { data: currentMember } = await supabase
        .from('members')
        .select('status')
        .eq('id', id)
        .single();
      if (currentMember && currentMember.status !== updatePayload.status) {
        await supabase.from('member_status_log').insert({
          member_id: id,
          previous_status: currentMember.status,
          new_status: updatePayload.status,
          change_type: 'manual',
          changed_by: user.id,
          reason: 'Manual status override'
        });
      }
    }

    const { data: member, error: memberError } = await supabase.from('members').update(updatePayload).eq('id', id).select().single();
    if (memberError) {
      console.error('Error updating member:', memberError);
      return c.json({
        error: memberError.message || 'Failed to update member'
      }, 500);
    }
    if (familyMembers) {
      await supabase.from('family_members').delete().eq('member_id', id);
      if (familyMembers.length > 0) {
        const familyMembersData = familyMembers.map((fm: any) => {
          const snakeFm = toSnakeCase(fm);
          // Remove the temp/old id and ensure member_id is set
          const { id: _tempId, ...rest } = snakeFm;
          return {
            ...rest,
            member_id: id
          };
        });
        console.log('Updating family members:', JSON.stringify(familyMembersData));
        const { error: fmError } = await supabase.from('family_members').insert(familyMembersData);
        if (fmError) {
          console.error('Error inserting family members:', fmError);
        }
      }
    }
    const { data: completeMember } = await supabase.from('members').select(`
        *,
        family_members!family_members_member_id_fkey (*)
      `).eq('id', id).single();

    // Log activity
    const logP2 = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP2.name, userRole: logP2.role,
      action: 'update', entityType: 'member', entityId: id,
      description: `Updated member: ${member.first_name} ${member.last_name}`
    });

    return c.json(toCamelCase(completeMember || member));
  } catch (error) {
    console.error('Update member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.delete("/members/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');

    // Get member name before deleting
    const { data: memberToDelete } = await supabase.from('members').select('first_name, last_name').eq('id', id).single();

    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) {
      console.error('Error deleting member:', error);
      return c.json({
        error: 'Failed to delete member'
      }, 500);
    }

    // Log activity
    const logP3 = await getProfileForLog(user.id);
    const delName = memberToDelete ? `${memberToDelete.first_name} ${memberToDelete.last_name}` : id;
    await logActivity({
      userId: user.id, userName: logP3.name, userRole: logP3.role,
      action: 'delete', entityType: 'member', entityId: id,
      description: `Deleted member: ${delName}`
    });

    return c.json({
      message: 'Member deleted successfully'
    });
  } catch (error) {
    console.error('Delete member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.get("/attendance", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: records, error } = await supabase.from('attendance_records').select(`
        *,
        attendance_entries (
          member_id
        )
      `).order('date', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching attendance:', error);
      return c.json({
        error: 'Failed to fetch attendance records'
      }, 500);
    }
    const transformed = records.map((record)=>{
        const attendees = (record.attendance_entries || []).map((entry)=>entry.member_id);
        const camelRecord = toCamelCase(record);
        return {
          ...camelRecord,
          attendees
        };
      });
    return c.json(transformed);
  } catch (error) {
    console.error('Get attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/attendance", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const data = await c.req.json();
    const { attendees, totalCount, serviceType, startTime, endTime, isCustomService, customServiceId, attendanceType, menCount, womenCount, childrenCount, visitorsCount, ...rest } = data;
    const recordType = attendanceType || 'individual';
    const dateValue = rest.date || data.date;

    // Check if a record already exists for this date + service + type
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, created_at')
      .eq('date', dateValue)
      .eq('service_type', serviceType)
      .eq('attendance_type', recordType)
      .single();

    let record;
    if (existingRecord) {
      // Update the existing record instead of creating a duplicate
      const { data: updated, error: updateError } = await supabase.from('attendance_records').update({
        start_time: startTime || null,
        end_time: endTime || null,
        is_custom_service: isCustomService || false,
        custom_service_id: customServiceId || null,
        total_count: totalCount || attendees?.length || 0,
        men_count: menCount || 0,
        women_count: womenCount || 0,
        children_count: childrenCount || 0,
        visitors_count: visitorsCount || 0
      }).eq('id', existingRecord.id).select().single();
      if (updateError) {
        console.error('Error updating attendance record:', updateError);
        return c.json({
          error: 'Failed to update attendance record: ' + updateError.message
        }, 500);
      }
      record = updated;

      // For individual records, replace attendance entries
      if (recordType === 'individual') {
        await supabase.from('attendance_entries').delete().eq('attendance_record_id', record.id);
        if (attendees && attendees.length > 0) {
          const entries = attendees.map((memberId)=>({
              attendance_record_id: record.id,
              member_id: memberId
            }));
          await supabase.from('attendance_entries').insert(entries);
        }
      }
    } else {
      // Create new record
      const { data: created, error: recordError } = await supabase.from('attendance_records').insert({
        ...rest,
        service_type: serviceType,
        start_time: startTime || null,
        end_time: endTime || null,
        is_custom_service: isCustomService || false,
        custom_service_id: customServiceId || null,
        created_by: user.id,
        total_count: totalCount || attendees?.length || 0,
        attendance_type: recordType,
        men_count: menCount || 0,
        women_count: womenCount || 0,
        children_count: childrenCount || 0,
        visitors_count: visitorsCount || 0
      }).select().single();
      if (recordError) {
        console.error('Error creating attendance record:', recordError);
        return c.json({
          error: 'Failed to create attendance record: ' + recordError.message
        }, 500);
      }
      record = created;

      // Only create attendance entries for individual records
      if (recordType === 'individual' && attendees && attendees.length > 0) {
        const entries = attendees.map((memberId)=>({
            attendance_record_id: record.id,
            member_id: memberId
          }));
        await supabase.from('attendance_entries').insert(entries);
      }
    }
    // Recalculate member statuses after Sunday Main Service individual attendance
    if (serviceType === 'Sunday Main Service' && recordType === 'individual') {
      await recalculateMemberStatuses(user.id);
    }

    // Auto-create/update service_record
    try {
      const attCount = totalCount || attendees?.length || 0;
      const { data: existingSR } = await supabase.from('service_records')
        .select('id, attendance_record_id').eq('service_date', dateValue).eq('service_type', serviceType).single();
      if (existingSR) {
        await supabase.from('service_records').update({
          attendance_record_id: record.id, updated_at: new Date().toISOString()
        }).eq('id', existingSR.id);
      } else {
        await supabase.from('service_records').insert({
          service_date: dateValue, service_type: serviceType,
          attendance_record_id: record.id, created_by: user.id
        });
      }
    } catch (srErr) { console.error('Service record auto-create error:', srErr); }

    // Log activity
    const logPA = await getProfileForLog(user.id);
    const attTotal = totalCount || attendees?.length || 0;
    await logActivity({
      userId: user.id, userName: logPA.name, userRole: logPA.role,
      action: existingRecord ? 'update' : 'create', entityType: 'attendance', entityId: record.id,
      description: `${existingRecord ? 'Updated' : 'Recorded'} ${recordType} attendance for ${serviceType} on ${dateValue} (${attTotal} ${recordType === 'individual' ? 'members' : 'head count'})`
    });

    // Check for new high attendance and notify
    try {
      const { data: maxAtt } = await supabase.from('attendance_records')
        .select('total_count').order('total_count', { ascending: false }).limit(1).neq('id', record.id).single();
      if (maxAtt && attTotal > maxAtt.total_count) {
        notifyTabUsers('attendance', {
          type: 'attendance_record', title: 'New Attendance Record!',
          message: `${serviceType} on ${dateValue} had ${attTotal} attendees — a new high! Previous record was ${maxAtt.total_count}.`,
          entityType: 'attendance', entityId: record.id, excludeUserId: user.id
        });
      }
    } catch (nErr) { console.error('Notification check error:', nErr); }

    return c.json({
      ...record,
      attendees
    }, 201);
  } catch (error) {
    console.error('Create attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.get("/attendance/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        attendance_entries (
          member_id
        )
      `)
      .eq('id', id)
      .single();
    if (error) {
      console.error('Error fetching attendance record:', error);
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Attendance record not found' }, 404);
      }
      return c.json({ error: 'Failed to fetch attendance record' }, 500);
    }
    const attendees = (record.attendance_entries || []).map((entry) => entry.member_id);
    const camelRecord = toCamelCase(record);
    return c.json({ ...camelRecord, attendees });
  } catch (error) {
    console.error('Get attendance by id error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
app.put("/attendance/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');

    // Check edit window (12 hours) - only Dev can edit after window closes
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('created_at, service_type, attendance_type')
      .eq('id', id)
      .single();

    if (existingRecord) {
      const createdAt = new Date(existingRecord.created_at).getTime();
      const now = Date.now();
      const twelveHours = 12 * 60 * 60 * 1000;
      if (now - createdAt > twelveHours) {
        // Check if user is dev
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (!profile || profile.role !== 'dev') {
          return c.json({
            error: 'Edit window has expired (12 hours). Only Dev users can edit after this period.'
          }, 403);
        }
      }
    }

    const data = await c.req.json();
    const { attendees, totalCount, serviceType, startTime, endTime, isCustomService, customServiceId, attendanceType, menCount, womenCount, childrenCount, visitorsCount, ...rest } = data;
    const { data: record, error: recordError } = await supabase.from('attendance_records').update({
      ...rest,
      service_type: serviceType,
      start_time: startTime || null,
      end_time: endTime || null,
      is_custom_service: isCustomService || false,
      custom_service_id: customServiceId || null,
      total_count: totalCount || attendees?.length || 0,
      men_count: menCount || 0,
      women_count: womenCount || 0,
      children_count: childrenCount || 0,
      visitors_count: visitorsCount || 0
    }).eq('id', id).select().single();
    if (recordError) {
      console.error('Error updating attendance:', recordError);
      return c.json({
        error: 'Failed to update attendance'
      }, 500);
    }
    // Only manage attendance entries for individual records
    if (existingRecord?.attendance_type === 'individual' && attendees) {
      await supabase.from('attendance_entries').delete().eq('attendance_record_id', id);
      if (attendees.length > 0) {
        const entries = attendees.map((memberId)=>({
            attendance_record_id: id,
            member_id: memberId
          }));
        await supabase.from('attendance_entries').insert(entries);
      }
    }
    // Recalculate member statuses only for individual Sunday Main Service records
    if ((serviceType === 'Sunday Main Service' || record.service_type === 'Sunday Main Service') && existingRecord?.attendance_type === 'individual') {
      await recalculateMemberStatuses(user.id);
    }
    return c.json({
      ...record,
      attendees
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.delete("/attendance/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const { error } = await supabase.from('attendance_records').delete().eq('id', id);
    if (error) {
      console.error('Error deleting attendance:', error);
      return c.json({
        error: 'Failed to delete attendance'
      }, 500);
    }
    return c.json({
      message: 'Attendance deleted successfully'
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// ============================================================================
// ATTENDANCE - EDIT STATUS
// ============================================================================

app.get("/attendance/:id/edit-status", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record } = await supabase
      .from('attendance_records')
      .select('created_at')
      .eq('id', id)
      .single();

    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const createdAt = new Date(record.created_at).getTime();
    const now = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;
    const timeRemaining = Math.max(0, twelveHours - (now - createdAt));
    const isDev = profile?.role === 'dev';

    return c.json({
      canEdit: isDev || timeRemaining > 0,
      timeRemaining: timeRemaining > 0 ? timeRemaining : null,
      lockedAt: timeRemaining <= 0 ? new Date(createdAt + twelveHours).toISOString() : null,
      isDev
    });
  } catch (error) {
    console.error('Get edit status error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// ATTENDANCE - ABSENTEE RECORDS
// ============================================================================

app.get("/attendance/:id/absentees", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');

    // Get all member IDs who were present
    const { data: presentEntries } = await supabase
      .from('attendance_entries')
      .select('member_id')
      .eq('attendance_record_id', id);

    const presentIds = (presentEntries || []).map(e => e.member_id);

    // Get all members
    const { data: allMembers } = await supabase
      .from('members')
      .select('id, first_name, last_name, other_names, zone, zone_number, phone, status, photo_url')
      .not('status', 'eq', 'blacklisted')
      .order('first_name');

    if (!allMembers) {
      return c.json([]);
    }

    // Filter to only absent members
    const absentMemberIds = allMembers
      .filter(m => !presentIds.includes(m.id))
      .map(m => m.id);

    // Get existing absentee records for this attendance
    const { data: absenteeRecords } = await supabase
      .from('absentee_records')
      .select('*')
      .eq('attendance_record_id', id);

    const absenteeMap: Record<string, any> = {};
    if (absenteeRecords) {
      for (const rec of absenteeRecords) {
        absenteeMap[rec.member_id] = rec;
      }
    }

    // Combine member info with absentee records
    const absentees = allMembers
      .filter(m => !presentIds.includes(m.id))
      .map(m => {
        const absenteeRecord = absenteeMap[m.id];
        return toCamelCase({
          ...m,
          photo: m.photo_url,
          absenteeInfo: absenteeRecord ? toCamelCase({
            id: absenteeRecord.id,
            requested_permission: absenteeRecord.requested_permission,
            reason: absenteeRecord.reason,
            reason_notes: absenteeRecord.reason_notes,
            absence_start_date: absenteeRecord.absence_start_date,
            absence_end_date: absenteeRecord.absence_end_date,
            until_further_notice: absenteeRecord.until_further_notice,
          }) : null
        });
      });

    return c.json(absentees);
  } catch (error) {
    console.error('Get absentees error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post("/attendance/:id/absentees", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const attendanceRecordId = c.req.param('id');
    const absentees = await c.req.json();

    if (!Array.isArray(absentees) || absentees.length === 0) {
      return c.json({ error: 'Expected an array of absentee records' }, 400);
    }

    const records = absentees.map((a: any) => ({
      attendance_record_id: attendanceRecordId,
      member_id: a.memberId,
      requested_permission: a.requestedPermission || false,
      reason: a.reason || null,
      reason_notes: a.reasonNotes || null,
      absence_start_date: a.absenceStartDate || null,
      absence_end_date: a.absenceEndDate || null,
      until_further_notice: a.untilFurtherNotice || false,
    }));

    const { data, error } = await supabase
      .from('absentee_records')
      .upsert(records, { onConflict: 'attendance_record_id,member_id' })
      .select();

    if (error) {
      console.error('Error saving absentee records:', error);
      return c.json({ error: 'Failed to save absentee records: ' + error.message }, 500);
    }

    // Update member status + leave dates for reason-mapped absences (sick/studies/traveled)
    const VALID_LEAVE_STATUSES = ['sick', 'studies', 'traveled'];
    for (const a of absentees) {
      if (a.memberStatus && VALID_LEAVE_STATUSES.includes(a.memberStatus)) {
        try {
          // Get current status for audit log
          const { data: currentMember } = await supabase
            .from('members')
            .select('status, first_name, last_name')
            .eq('id', a.memberId)
            .single();

          // Only update if not already this leave status (avoids redundant writes)
          if (currentMember && currentMember.status !== a.memberStatus) {
            await supabase.from('members').update({
              status: a.memberStatus,
              leave_start_date: a.absenceStartDate || null,
              leave_end_date: a.absenceEndDate || null,
              updated_at: new Date().toISOString(),
            }).eq('id', a.memberId);

            // Log the status change
            await supabase.from('member_status_log').insert({
              member_id: a.memberId,
              previous_status: currentMember.status,
              new_status: a.memberStatus,
              change_type: 'automatic',
              changed_by: user.id,
              reason: `Absence reason: ${a.reason}`,
            });

            // Notify members tab users
            const mName = currentMember
              ? `${currentMember.first_name} ${currentMember.last_name}`
              : 'A member';
            notifyTabUsers('members', {
              type: 'member_status_change',
              title: 'Member Status Updated',
              message: `${mName} status changed to ${a.memberStatus} (reason: ${a.reason}).`,
              entityType: 'member',
              entityId: a.memberId,
              excludeUserId: user.id,
            });
          }
        } catch (memberUpdateErr) {
          console.error('Failed to update member status for absentee:', memberUpdateErr);
          // Non-fatal: absentee record was already saved
        }
      }
    }

    return c.json(toCamelCase(data), 201);
  } catch (error) {
    console.error('Save absentees error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});


app.put("/attendance/:id/absentees/:memberId", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const attendanceRecordId = c.req.param('id');
    const memberId = c.req.param('memberId');
    const updateData = await c.req.json();

    const dbData = {
      requested_permission: updateData.requestedPermission,
      reason: updateData.reason || null,
      reason_notes: updateData.reasonNotes || null,
      absence_start_date: updateData.absenceStartDate || null,
      absence_end_date: updateData.absenceEndDate || null,
      until_further_notice: updateData.untilFurtherNotice || false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('absentee_records')
      .upsert({
        attendance_record_id: attendanceRecordId,
        member_id: memberId,
        ...dbData,
      }, { onConflict: 'attendance_record_id,member_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating absentee record:', error);
      return c.json({ error: 'Failed to update absentee record' }, 500);
    }

    return c.json(toCamelCase(data));
  } catch (error) {
    console.error('Update absentee error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// MEMBER SABBATICAL MANAGEMENT
// ============================================================================

app.put("/members/:id/sabbatical", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check permission: admin, dev, or pastor with temp permission
    const hasPermission = await checkPermission(user.id, 'manage_members');
    if (!hasPermission) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const id = c.req.param('id');
    const { startDate, endDate, reason } = await c.req.json();

    if (!startDate) {
      return c.json({ error: 'Start date is required' }, 400);
    }

    // Get current status for logging
    const { data: currentMember } = await supabase
      .from('members')
      .select('status')
      .eq('id', id)
      .single();

    if (!currentMember) {
      return c.json({ error: 'Member not found' }, 404);
    }

    const { data: member, error } = await supabase
      .from('members')
      .update({
        status: 'sabbatical',
        sabbatical_start_date: startDate,
        sabbatical_end_date: endDate || null,
        sabbatical_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error setting sabbatical:', error);
      return c.json({ error: 'Failed to set sabbatical' }, 500);
    }

    // Log the status change
    await supabase.from('member_status_log').insert({
      member_id: id,
      previous_status: currentMember.status,
      new_status: 'sabbatical',
      change_type: 'manual',
      changed_by: user.id,
      reason: reason || 'Sabbatical assigned',
    });

    return c.json(toCamelCase(member));
  } catch (error) {
    console.error('Set sabbatical error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.delete("/members/:id/sabbatical", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_members');
    if (!hasPermission) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const id = c.req.param('id');

    // Clear sabbatical fields
    const { data: member, error } = await supabase
      .from('members')
      .update({
        sabbatical_start_date: null,
        sabbatical_end_date: null,
        sabbatical_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error ending sabbatical:', error);
      return c.json({ error: 'Failed to end sabbatical' }, 500);
    }

    // Log the status change
    await supabase.from('member_status_log').insert({
      member_id: id,
      previous_status: 'sabbatical',
      new_status: member.status,
      change_type: 'manual',
      changed_by: user.id,
      reason: 'Sabbatical ended manually',
    });

    // Trigger recalculation for this member
    await recalculateMemberStatuses(user.id);

    return c.json(toCamelCase(member));
  } catch (error) {
    console.error('End sabbatical error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// SERVICES
// ============================================================================

app.get("/services", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: services, error } = await supabase.from('custom_services').select('*').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching services:', error);
      return c.json({
        error: 'Failed to fetch services'
      }, 500);
    }
    return c.json(toCamelCase(services));
  } catch (error) {
    console.error('Get services error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/services", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const serviceData = await c.req.json();
    const { data: service, error } = await supabase.from('custom_services').insert({
      ...serviceData,
      created_by: user.id
    }).select().single();
    if (error) {
      console.error('Error creating service:', error);
      return c.json({
        error: 'Failed to create service'
      }, 500);
    }
    return c.json(service, 201);
  } catch (error) {
    console.error('Create service error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Update a service
app.put("/services/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const serviceId = c.req.param('id');
    const updateData = await c.req.json();

    const { data: service, error } = await supabase
      .from('custom_services')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating service:', error);
      return c.json({ error: 'Failed to update service' }, 500);
    }

    return c.json(toCamelCase(service));
  } catch (error) {
    console.error('Update service error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete a service
app.delete("/services/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const serviceId = c.req.param('id');

    const { error } = await supabase
      .from('custom_services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      console.error('Error deleting service:', error);
      return c.json({ error: 'Failed to delete service' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete service error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get("/giving", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: records, error } = await supabase.from('giving_records').select('*').order('service_date', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching giving records:', error);
      return c.json({
        error: 'Failed to fetch giving records'
      }, 500);
    }

    // Fetch profile info for all creators and editors
    const allUserIds = [...new Set([
      ...records.filter(r => r.created_by).map(r => r.created_by),
      ...records.filter(r => r.edited_by).map(r => r.edited_by)
    ])];
    let profilesMap: Record<string, { name: string; email: string }> = {};

    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', allUserIds);

      if (profiles) {
        for (const profile of profiles) {
          profilesMap[profile.id] = { name: profile.name, email: profile.email };
        }
      }
    }

    const transformed = records.map((record)=>{
        const creator = record.created_by ? profilesMap[record.created_by] : null;
        const editor = record.edited_by ? profilesMap[record.edited_by] : null;
        return {
          id: record.id,
          serviceName: record.service_name,
          serviceDate: record.service_date,
          serviceType: record.service_type,
          offerings: {
            offering: parseFloat(record.offering_amount),
            donation: parseFloat(record.donation_amount),
            thanksgiving: parseFloat(record.thanksgiving_amount),
            customTypes: record.custom_types
          },
          totalAmount: parseFloat(record.total_amount),
          paymentBreakdown: {
            cash: parseFloat(record.cash_amount),
            mobile_money: parseFloat(record.mobile_money_amount),
            card: parseFloat(record.card_amount),
            bank_transfer: parseFloat(record.bank_transfer_amount)
          },
          notes: record.notes,
          createdBy: creator ? creator.name : null,
          createdByEmail: creator ? creator.email : null,
          createdAt: record.created_at,
          editedBy: editor ? editor.name : null,
          editedByEmail: editor ? editor.email : null,
          editedAt: record.edited_at
        };
      });
    return c.json(transformed);
  } catch (error) {
    console.error('Get giving error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/giving", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const data = await c.req.json();
    const { data: record, error } = await supabase.from('giving_records').insert({
      service_name: data.serviceName,
      service_date: data.serviceDate,
      service_type: data.serviceType,
      offering_amount: data.offerings.offering,
      donation_amount: data.offerings.donation,
      thanksgiving_amount: data.offerings.thanksgiving,
      custom_types: data.offerings.customTypes,
      total_amount: data.totalAmount,
      cash_amount: data.paymentBreakdown.cash,
      mobile_money_amount: data.paymentBreakdown.mobile_money,
      card_amount: data.paymentBreakdown.card,
      bank_transfer_amount: data.paymentBreakdown.bank_transfer,
      notes: data.notes,
      created_by: user.id
    }).select().single();
    if (error) {
      console.error('Error creating giving record:', error);
      return c.json({
        error: 'Failed to create giving record: ' + error.message
      }, 500);
    }
    // Auto-create/update service_record for giving
    try {
      const { data: existingSR } = await supabase.from('service_records')
        .select('id, giving_record_id').eq('service_date', data.serviceDate).eq('service_type', data.serviceType).single();
      if (existingSR) {
        await supabase.from('service_records').update({
          giving_record_id: record.id, updated_at: new Date().toISOString()
        }).eq('id', existingSR.id);
      } else {
        await supabase.from('service_records').insert({
          service_date: data.serviceDate, service_type: data.serviceType,
          giving_record_id: record.id, created_by: user.id
        });
      }
    } catch (srErr) { console.error('Service record auto-create error:', srErr); }

    // Log activity
    const logPG = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logPG.name, userRole: logPG.role,
      action: 'create', entityType: 'giving', entityId: record.id,
      description: `Recorded giving for ${data.serviceName || data.serviceType} on ${data.serviceDate} — GH₵${data.totalAmount}`
    });

    // Check for new high giving and notify
    try {
      const { data: maxGiving } = await supabase.from('giving_records')
        .select('total_amount').order('total_amount', { ascending: false }).limit(1).neq('id', record.id).single();
      if (maxGiving && parseFloat(record.total_amount) > parseFloat(maxGiving.total_amount)) {
        notifyTabUsers('giving', {
          type: 'giving_record', title: 'New Giving Record!',
          message: `${data.serviceName || data.serviceType} on ${data.serviceDate} raised GH₵${data.totalAmount} — a new high!`,
          entityType: 'giving', entityId: record.id, excludeUserId: user.id
        });
      }
    } catch (nErr) { console.error('Notification check error:', nErr); }

    return c.json(record, 201);
  } catch (error) {
    console.error('Create giving error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.get("/giving/types", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: types, error } = await supabase.from('custom_giving_types').select('*').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching giving types:', error);
      return c.json({
        error: 'Failed to fetch giving types'
      }, 500);
    }

    // Fetch profile info for all creators
    const creatorIds = [...new Set(types.filter(t => t.created_by).map(t => t.created_by))];
    let profilesMap: Record<string, { name: string; email: string }> = {};

    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', creatorIds);

      if (profiles) {
        for (const profile of profiles) {
          profilesMap[profile.id] = { name: profile.name, email: profile.email };
        }
      }
    }

    // Transform with creator name
    const transformed = types.map(type => {
      const creator = type.created_by ? profilesMap[type.created_by] : null;
      return {
        ...toCamelCase(type),
        createdBy: creator ? creator.name : null,
        createdByEmail: creator ? creator.email : null
      };
    });

    return c.json(transformed);
  } catch (error) {
    console.error('Get giving types error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/giving/types", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const typeData = await c.req.json();
    const { data: type, error } = await supabase.from('custom_giving_types').insert({
      ...typeData,
      created_by: user.id
    }).select().single();
    if (error) {
      console.error('Error creating giving type:', error);
      return c.json({
        error: 'Failed to create giving type'
      }, 500);
    }
    return c.json(type, 201);
  } catch (error) {
    console.error('Create giving type error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Update giving type
app.patch("/giving/types/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_giving_types');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const typeId = c.req.param('id');
    const typeData = await c.req.json();

    const { data: type, error } = await supabase
      .from('custom_giving_types')
      .update(typeData)
      .eq('id', typeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating giving type:', error);
      return c.json({ error: 'Failed to update giving type' }, 500);
    }

    return c.json(type);
  } catch (error) {
    console.error('Update giving type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete giving type
app.delete("/giving/types/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_giving_types');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const typeId = c.req.param('id');

    const { error } = await supabase
      .from('custom_giving_types')
      .delete()
      .eq('id', typeId);

    if (error) {
      console.error('Error deleting giving type:', error);
      return c.json({ error: 'Failed to delete giving type' }, 500);
    }

    return c.json({ message: 'Giving type deleted successfully' });
  } catch (error) {
    console.error('Delete giving type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Toggle giving type active status
app.patch("/giving/types/:id/toggle", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_giving_types');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const typeId = c.req.param('id');

    // Get current status
    const { data: currentType } = await supabase
      .from('custom_giving_types')
      .select('is_active')
      .eq('id', typeId)
      .single();

    if (!currentType) {
      return c.json({ error: 'Giving type not found' }, 404);
    }

    // Toggle the status
    const { data: type, error } = await supabase
      .from('custom_giving_types')
      .update({ is_active: !currentType.is_active })
      .eq('id', typeId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling giving type:', error);
      return c.json({ error: 'Failed to toggle giving type' }, 500);
    }

    return c.json(toCamelCase(type));
  } catch (error) {
    console.error('Toggle giving type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET single giving record
app.get("/giving/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record, error } = await supabase.from('giving_records').select('*').eq('id', id).single();
    if (error) {
      console.error('Error fetching giving record:', error);
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Giving record not found' }, 404);
      }
      return c.json({ error: 'Failed to fetch giving record' }, 500);
    }
    // Get creator and editor info
    let creatorName = null;
    let creatorEmail = null;
    let editorName = null;
    let editorEmail = null;

    const profileIds = [record.created_by, record.edited_by].filter(Boolean);
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', profileIds);
      if (profiles) {
        for (const p of profiles) {
          if (p.id === record.created_by) { creatorName = p.name; creatorEmail = p.email; }
          if (p.id === record.edited_by) { editorName = p.name; editorEmail = p.email; }
        }
      }
    }

    return c.json({
      id: record.id,
      serviceName: record.service_name,
      serviceDate: record.service_date,
      serviceType: record.service_type,
      offerings: {
        offering: parseFloat(record.offering_amount),
        donation: parseFloat(record.donation_amount),
        thanksgiving: parseFloat(record.thanksgiving_amount),
        customTypes: record.custom_types
      },
      totalAmount: parseFloat(record.total_amount),
      paymentBreakdown: {
        cash: parseFloat(record.cash_amount),
        mobile_money: parseFloat(record.mobile_money_amount),
        card: parseFloat(record.card_amount),
        bank_transfer: parseFloat(record.bank_transfer_amount)
      },
      notes: record.notes,
      createdBy: creatorName,
      createdByEmail: creatorEmail,
      createdAt: record.created_at,
      editedBy: editorName,
      editedByEmail: editorEmail,
      editedAt: record.edited_at
    });
  } catch (error) {
    console.error('Get giving by id error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PUT update giving record with 3-hour edit window
app.put("/giving/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');

    // Check 3-hour edit window
    const { data: existingRecord } = await supabase
      .from('giving_records')
      .select('created_at')
      .eq('id', id)
      .single();

    if (existingRecord) {
      const createdAt = new Date(existingRecord.created_at).getTime();
      const now = Date.now();
      const threeHours = 3 * 60 * 60 * 1000;
      if (now - createdAt > threeHours) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile || profile.role !== 'dev') {
          return c.json({
            error: 'Edit window has expired (3 hours). Only Dev users can edit after this period.'
          }, 403);
        }
      }
    }

    const data = await c.req.json();
    const { data: record, error } = await supabase.from('giving_records').update({
      service_name: data.serviceName,
      service_date: data.serviceDate,
      service_type: data.serviceType,
      offering_amount: data.offerings.offering,
      donation_amount: data.offerings.donation,
      thanksgiving_amount: data.offerings.thanksgiving,
      custom_types: data.offerings.customTypes,
      total_amount: data.totalAmount,
      cash_amount: data.paymentBreakdown.cash,
      mobile_money_amount: data.paymentBreakdown.mobile_money,
      card_amount: data.paymentBreakdown.card,
      bank_transfer_amount: data.paymentBreakdown.bank_transfer,
      notes: data.notes,
      edited_by: user.id,
      edited_at: new Date().toISOString()
    }).eq('id', id).select().single();

    if (error) {
      console.error('Error updating giving record:', error);
      return c.json({ error: 'Failed to update giving record: ' + error.message }, 500);
    }
    return c.json(record);
  } catch (error) {
    console.error('Update giving error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET giving edit status (3-hour window)
app.get("/giving/:id/edit-status", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record } = await supabase
      .from('giving_records')
      .select('created_at')
      .eq('id', id)
      .single();

    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }

    const createdAt = new Date(record.created_at).getTime();
    const now = Date.now();
    const threeHours = 3 * 60 * 60 * 1000;
    const timeRemaining = Math.max(0, threeHours - (now - createdAt));

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isDev = profile?.role === 'dev';

    return c.json({
      canEdit: isDev || timeRemaining > 0,
      timeRemaining: timeRemaining > 0 ? timeRemaining : null,
      lockedAt: new Date(createdAt + threeHours).toISOString(),
      isDev
    });
  } catch (error) {
    console.error('Get giving edit status error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get("/visitors", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: visitors, error } = await supabase.from('visitors').select('*').order('visit_date', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching visitors:', error);
      return c.json({
        error: 'Failed to fetch visitors'
      }, 500);
    }
    const transformed = visitors.map((v)=>({
        id: v.id,
        firstName: v.first_name,
        lastName: v.last_name,
        otherNames: v.other_names,
        email: v.email,
        phone: v.phone,
        secondPhone: v.second_phone,
        gender: v.gender,
        residenceLocation: v.residence_location,
        visitDate: v.visit_date,
        serviceType: v.service_type,
        referredBy: v.referred_by,
        interestedInMembership: v.interested_in_membership,
        notes: v.notes,
        followUpStatus: v.follow_up_status,
        potentialZone: v.potential_zone,
        convertedToMember: v.converted_to_member,
        convertedMemberId: v.converted_member_id,
        createdAt: v.created_at,
        updatedAt: v.updated_at,
        createdBy: v.created_by
      }));
    return c.json(transformed);
  } catch (error) {
    console.error('Get visitors error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/visitors", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const data = await c.req.json();
    const { data: visitor, error } = await supabase.from('visitors').insert({
      first_name: data.firstName,
      last_name: data.lastName,
      other_names: data.otherNames,
      email: data.email,
      phone: data.phone,
      second_phone: data.secondPhone,
      gender: data.gender,
      residence_location: data.residenceLocation,
      visit_date: data.visitDate,
      service_type: data.serviceType,
      referred_by: data.referredBy,
      interested_in_membership: data.interestedInMembership,
      notes: data.notes,
      follow_up_status: data.followUpStatus,
      potential_zone: data.potentialZone,
      created_by: user.id
    }).select().single();
    if (error) {
      console.error('Error creating visitor:', error);
      return c.json({
        error: 'Failed to create visitor: ' + error.message
      }, 500);
    }
    // Log activity
    const logPV = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logPV.name, userRole: logPV.role,
      action: 'create', entityType: 'visitor', entityId: visitor.id,
      description: `Registered visitor: ${data.firstName} ${data.lastName}`
    });

    // Auto-update service_record visitor count
    try {
      if (data.visitDate && data.serviceType) {
        const { data: sr } = await supabase.from('service_records')
          .select('id, visitors_count').eq('service_date', data.visitDate).eq('service_type', data.serviceType).single();
        if (sr) {
          await supabase.from('service_records').update({
            visitors_count: (sr.visitors_count || 0) + 1, updated_at: new Date().toISOString()
          }).eq('id', sr.id);
        }
      }
    } catch (srErr) { console.error('Service record visitor update error:', srErr); }

    return c.json(visitor, 201);
  } catch (error) {
    console.error('Create visitor error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.put("/visitors/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const data = await c.req.json();
    const { data: visitor, error } = await supabase.from('visitors').update({
      first_name: data.firstName,
      last_name: data.lastName,
      other_names: data.otherNames,
      email: data.email,
      phone: data.phone,
      second_phone: data.secondPhone,
      gender: data.gender,
      residence_location: data.residenceLocation,
      visit_date: data.visitDate,
      service_type: data.serviceType,
      referred_by: data.referredBy,
      interested_in_membership: data.interestedInMembership,
      notes: data.notes,
      follow_up_status: data.followUpStatus,
      potential_zone: data.potentialZone
    }).eq('id', id).select().single();
    if (error) {
      console.error('Error updating visitor:', error);
      return c.json({
        error: 'Failed to update visitor'
      }, 500);
    }
    return c.json(visitor);
  } catch (error) {
    console.error('Update visitor error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/visitors/:id/convert", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const memberData = await c.req.json();
    const { data: visitor, error: visitorError } = await supabase.from('visitors').select('*').eq('id', id).single();
    if (visitorError || !visitor) {
      return c.json({
        error: 'Visitor not found'
      }, 404);
    }
    const { data: member, error: memberError } = await supabase.from('members').insert({
      ...memberData,
      created_by: user.id
    }).select().single();
    if (memberError) {
      console.error('Error converting visitor to member:', memberError);
      return c.json({
        error: 'Failed to convert visitor'
      }, 500);
    }
    await supabase.from('visitors').update({
      converted_to_member: true,
      converted_member_id: member.id,
      follow_up_status: 'completed'
    }).eq('id', id);
    return c.json(member, 201);
  } catch (error) {
    console.error('Convert visitor error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/permissions/grant", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { userId, permission, durationHours } = await c.req.json();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);
    const { data, error } = await supabase.from('temporary_permissions').insert({
      user_id: userId,
      permission,
      expires_at: expiresAt.toISOString(),
      granted_by: user.id
    }).select().single();
    if (error) {
      console.error('Error granting permission:', error);
      return c.json({
        error: 'Failed to grant permission'
      }, 500);
    }
    return c.json(data, 201);
  } catch (error) {
    console.error('Grant permission error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.post("/permissions/revoke", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { userId, permission } = await c.req.json();
    const { error } = await supabase.from('temporary_permissions').delete().eq('user_id', userId).eq('permission', permission);
    if (error) {
      console.error('Error revoking permission:', error);
      return c.json({
        error: 'Failed to revoke permission'
      }, 500);
    }
    return c.json({
      message: 'Permission revoked successfully'
    });
  } catch (error) {
    console.error('Revoke permission error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
app.get("/stats", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    // Get total members
    const { count: totalMembers } = await supabase.from('members').select('*', {
      count: 'exact',
      head: true
    });
    // Get this week's attendance (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    // Prefer general (head count) records for dashboard stats, fall back to any
    let { data: weekAttendance } = await supabase.from('attendance_records').select('total_count').eq('attendance_type', 'general').gte('date', weekAgo.toISOString().split('T')[0]).order('date', {
      ascending: false
    }).limit(1).single();
    if (!weekAttendance) {
      const { data: fallback } = await supabase.from('attendance_records').select('total_count').gte('date', weekAgo.toISOString().split('T')[0]).order('date', {
        ascending: false
      }).limit(1).single();
      weekAttendance = fallback;
    }
    // Get this month's giving
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data: monthGiving } = await supabase.from('giving_records').select('total_amount').gte('service_date', startOfMonth.toISOString().split('T')[0]);
    const givingThisMonth = monthGiving?.reduce((sum, r)=>sum + parseFloat(r.total_amount), 0) || 0;
    // Get new members this month
    const { count: newMembersCount } = await supabase.from('members').select('*', {
      count: 'exact',
      head: true
    }).gte('created_at', startOfMonth.toISOString());
    return c.json({
      totalMembers: totalMembers || 0,
      attendanceThisWeek: weekAttendance?.total_count || 0,
      givingThisMonth: givingThisMonth,
      newMembersThisMonth: newMembersCount || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Reports endpoint with trends and analytics
app.get("/reports", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const period = c.req.query('period') || 'year';
    const now = new Date();
    const startDate = new Date();
    if (period === 'month') {
      startDate.setDate(1);
    } else if (period === 'quarter') {
      startDate.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
    } else if (period === '6months') {
      startDate.setMonth(now.getMonth() - 5, 1);
    } else if (period === '2years') {
      startDate.setFullYear(now.getFullYear() - 1, 0, 1);
    } else {
      startDate.setMonth(0, 1);
    }
    const startDateStr = startDate.toISOString().split('T')[0];

    // ── Fetch all data in parallel ──
    const [
      { data: generalAttendance },
      { data: allAttendance },
      { data: individualAttendance },
      { data: givingRecordsFull },
      { data: allMembers },
      { data: visitors },
    ] = await Promise.all([
      supabase.from('attendance_records').select('date, total_count, attendance_type').eq('attendance_type', 'general').gte('date', startDateStr).order('date', { ascending: true }),
      supabase.from('attendance_records').select('date, total_count, attendance_type, men_count, women_count, children_count, visitors_count').gte('date', startDateStr).order('date', { ascending: true }),
      supabase.from('attendance_records').select('date, total_count').eq('attendance_type', 'individual').gte('date', startDateStr).order('date', { ascending: true }),
      supabase.from('giving_records').select('service_date, total_amount, offering_amount, donation_amount, thanksgiving_amount, custom_types, cash_amount, mobile_money_amount, card_amount, bank_transfer_amount').gte('service_date', startDateStr).order('service_date', { ascending: true }),
      supabase.from('members').select('created_at, status, zone, gender, marital_status, ministries, date_of_birth').order('created_at', { ascending: true }),
      supabase.from('visitors').select('visit_date, follow_up_status, converted_to_member'),
    ]);

    // Use general attendance for trends, fallback to all
    let attendanceRecords = generalAttendance && generalAttendance.length > 0 ? generalAttendance : allAttendance;

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // ── Monthly aggregation ──
    const monthlyData: Record<number, any> = {};
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = {
        month: months[i],
        attendance: 0, attendanceCount: 0,
        individualAttendance: 0, individualCount: 0,
        generalAttendance: 0, generalCount: 0,
        giving: 0, offering: 0, donation: 0, thanksgiving: 0, customGiving: 0,
        cash: 0, mobileMoney: 0, card: 0, bankTransfer: 0,
        members: 0, newMembers: 0,
      };
    }

    attendanceRecords?.forEach((r: any) => {
      const m = new Date(r.date).getMonth();
      monthlyData[m].attendance += r.total_count;
      monthlyData[m].attendanceCount++;
    });

    // Individual vs General by month
    allAttendance?.forEach((r: any) => {
      const m = new Date(r.date).getMonth();
      if (r.attendance_type === 'individual') {
        monthlyData[m].individualAttendance += r.total_count;
        monthlyData[m].individualCount++;
      } else {
        monthlyData[m].generalAttendance += r.total_count;
        monthlyData[m].generalCount++;
      }
    });

    for (let i = 0; i < 12; i++) {
      if (monthlyData[i].attendanceCount > 0) monthlyData[i].attendance = Math.round(monthlyData[i].attendance / monthlyData[i].attendanceCount);
      if (monthlyData[i].individualCount > 0) monthlyData[i].individualAttendance = Math.round(monthlyData[i].individualAttendance / monthlyData[i].individualCount);
      if (monthlyData[i].generalCount > 0) monthlyData[i].generalAttendance = Math.round(monthlyData[i].generalAttendance / monthlyData[i].generalCount);
    }

    // Giving by month + breakdown
    givingRecordsFull?.forEach((r: any) => {
      const m = new Date(r.service_date).getMonth();
      monthlyData[m].giving += parseFloat(r.total_amount) || 0;
      monthlyData[m].offering += parseFloat(r.offering_amount) || 0;
      monthlyData[m].donation += parseFloat(r.donation_amount) || 0;
      monthlyData[m].thanksgiving += parseFloat(r.thanksgiving_amount) || 0;
      const ct = r.custom_types || {};
      monthlyData[m].customGiving += Object.values(ct).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0);
      monthlyData[m].cash += parseFloat(r.cash_amount) || 0;
      monthlyData[m].mobileMoney += parseFloat(r.mobile_money_amount) || 0;
      monthlyData[m].card += parseFloat(r.card_amount) || 0;
      monthlyData[m].bankTransfer += parseFloat(r.bank_transfer_amount) || 0;
    });

    // Membership growth
    allMembers?.forEach((member: any) => {
      const m = new Date(member.created_at).getMonth();
      monthlyData[m].newMembers++;
    });
    let runningTotal = 0;
    for (let i = 0; i < 12; i++) {
      runningTotal += monthlyData[i].newMembers;
      monthlyData[i].members = runningTotal;
    }

    // ── Chart data arrays ──
    const attendanceData = Object.values(monthlyData).map((m: any) => ({
      month: m.month, attendance: m.attendance,
      individual: m.individualAttendance, general: m.generalAttendance
    }));
    const givingData = Object.values(monthlyData).map((m: any) => ({
      month: m.month, amount: Math.round(m.giving * 100) / 100,
      offering: Math.round(m.offering * 100) / 100,
      donation: Math.round(m.donation * 100) / 100,
      thanksgiving: Math.round(m.thanksgiving * 100) / 100,
      custom: Math.round(m.customGiving * 100) / 100
    }));
    const membershipData = Object.values(monthlyData).map((m: any) => ({
      month: m.month, members: m.members, newMembers: m.newMembers
    }));

    // ── Members by status ──
    const statusCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const s = m.status || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const membersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // ── Members by zone ──
    const zoneCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const z = m.zone || 'Unknown';
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
    });
    const membersByZone = Object.entries(zoneCounts).map(([zone, count]) => ({ zone, count })).sort((a, b) => a.zone.localeCompare(b.zone));

    // ── Giving by type (totals for period) ──
    let totalOffering = 0, totalDonation = 0, totalThanksgiving = 0, totalCustom = 0;
    givingRecordsFull?.forEach((r: any) => {
      totalOffering += parseFloat(r.offering_amount) || 0;
      totalDonation += parseFloat(r.donation_amount) || 0;
      totalThanksgiving += parseFloat(r.thanksgiving_amount) || 0;
      const ct = r.custom_types || {};
      totalCustom += Object.values(ct).reduce((s: number, v: any) => s + (parseFloat(v) || 0), 0);
    });
    const givingByType = [
      { type: 'Offering', amount: Math.round(totalOffering * 100) / 100 },
      { type: 'Donation', amount: Math.round(totalDonation * 100) / 100 },
      { type: 'Thanksgiving', amount: Math.round(totalThanksgiving * 100) / 100 },
      { type: 'Custom', amount: Math.round(totalCustom * 100) / 100 },
    ].filter(g => g.amount > 0);

    // ── Attendance denominations (totals for period) ──
    let totalMenAtt = 0, totalWomenAtt = 0, totalChildrenAtt = 0, totalVisitorsAtt = 0;
    allAttendance?.forEach((r: any) => {
      // Only include denominations if they are from general/headcount records
      // to avoid double counting if individual records also have these fields (though unlikely based on schema)
      if (r.attendance_type === 'general') {
        totalMenAtt += r.men_count || 0;
        totalWomenAtt += r.women_count || 0;
        totalChildrenAtt += r.children_count || 0;
        totalVisitorsAtt += r.visitors_count || 0;
      }
    });
    const attendanceDenominations = [
      { name: 'Men', count: totalMenAtt },
      { name: 'Women', count: totalWomenAtt },
      { name: 'Children', count: totalChildrenAtt },
      { name: 'Visitors', count: totalVisitorsAtt },
    ].filter(d => d.count > 0);

    // ── Member Gender Distribution ──
    const genderCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const g = (m.gender || 'unknown').toLowerCase();
      genderCounts[g] = (genderCounts[g] || 0) + 1;
    });
    const membersByGender = Object.entries(genderCounts).map(([gender, count]) => ({ gender, count }));

    // ── Member Marital Status Distribution ──
    const maritalCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const ms = (m.marital_status || 'unknown').toLowerCase();
      maritalCounts[ms] = (maritalCounts[ms] || 0) + 1;
    });
    const membersByMaritalStatus = Object.entries(maritalCounts).map(([status, count]) => ({ status, count }));

    // ── Ministry Participation ──
    const ministryCounts: Record<string, number> = {};
    allMembers?.forEach((m: any) => {
      const minList = m.ministries || [];
      minList.forEach((min: string) => {
        ministryCounts[min] = (ministryCounts[min] || 0) + 1;
      });
    });
    const membersByMinistry = Object.entries(ministryCounts).map(([ministry, count]) => ({ ministry, count })).sort((a, b) => b.count - a.count);

    // ── Age Distribution ──
    const ageGroups = {
      'Under 18': 0,
      '18-35': 0,
      '36-50': 0,
      '50+': 0,
      'Unknown': 0
    };
    allMembers?.forEach((m: any) => {
      if (!m.date_of_birth) {
        ageGroups['Unknown']++;
        return;
      }
      const age = now.getFullYear() - new Date(m.date_of_birth).getFullYear();
      if (age < 18) ageGroups['Under 18']++;
      else if (age <= 35) ageGroups['18-35']++;
      else if (age <= 50) ageGroups['36-50']++;
      else ageGroups['50+']++;
    });
    const membersByAge = Object.entries(ageGroups).map(([group, count]) => ({ group, count }));

    // ── Visitor Analytics ──
    const visitorStatusCounts: Record<string, number> = {};
    let totalConverted = 0;
    const periodVisitors = visitors?.filter((v: any) => v.visit_date >= startDateStr) || [];
    periodVisitors.forEach((v: any) => {
      const s = v.follow_up_status || 'pending';
      visitorStatusCounts[s] = (visitorStatusCounts[s] || 0) + 1;
      if (v.converted_to_member) totalConverted++;
    });
    const visitorsByStatus = Object.entries(visitorStatusCounts).map(([status, count]) => ({ status, count }));
    const visitorConversionRate = periodVisitors.length > 0 ? (totalConverted / periodVisitors.length) * 100 : 0;

    // ── Member retention ──
    const activeStatuses = new Set(['active', 'semi-active']);
    const activeMembers = allMembers?.filter((m: any) => activeStatuses.has(m.status)).length || 0;
    const totalMembers = allMembers?.length || 0;
    const memberRetention = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 1000) / 10 : 0;

    // ── Summary stats ──
    const totalAttendanceRecords = attendanceRecords?.length || 0;
    const avgAttendance = totalAttendanceRecords > 0 ? Math.round(attendanceRecords!.reduce((sum: number, r: any) => sum + r.total_count, 0) / totalAttendanceRecords) : 0;
    const totalGiving = givingRecordsFull?.reduce((sum: number, r: any) => sum + (parseFloat(r.total_amount) || 0), 0) || 0;
    const firstMonthMembers = membershipData.find((m) => m.members > 0)?.members || 1;
    const lastMonthMembers = membershipData[membershipData.length - 1]?.members || 0;
    const growthRate = firstMonthMembers > 0 ? (lastMonthMembers - firstMonthMembers) / firstMonthMembers * 100 : 0;
    const attendanceRate = totalMembers > 0 ? avgAttendance / totalMembers * 100 : 0;
    const givingServicesCount = givingRecordsFull?.length || 0;
    const avgGivingPerService = givingServicesCount > 0 ? Math.round(totalGiving / givingServicesCount * 100) / 100 : 0;

    // Most active zone
    const mostActiveZone = membersByZone.length > 0 ? membersByZone.reduce((a, b) => a.count > b.count ? a : b).zone : 'N/A';

    return c.json({
      attendanceData,
      givingData,
      membershipData,
      membersByStatus,
      membersByZone,
      givingByType,
      givingByPaymentMethod: [], // Keep for backward compatibility if needed, or remove if safe
      attendanceDenominations,
      membersByGender,
      membersByMaritalStatus,
      membersByMinistry,
      membersByAge,
      visitorsByStatus,
      visitorConversionRate: Math.round(visitorConversionRate * 10) / 10,
      summary: {
        totalMembers,
        avgAttendance,
        totalGiving,
        growthRate: Math.round(growthRate * 10) / 10,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        memberRetention,
        givingParticipation: 0, // giving_records has no member_id, so skip
        servicesHeld: totalAttendanceRecords,
        newMembersThisMonth: monthlyData[now.getMonth()]?.newMembers || 0,
        monthlyGiving: Math.round((monthlyData[now.getMonth()]?.giving || 0) * 100) / 100,
        monthlyAvgAttendance: monthlyData[now.getMonth()]?.attendance || 0,
        avgGivingPerService,
        mostActiveZone,
        activeMembers
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
// ============================================================================
// USER MANAGEMENT ROUTES
// ============================================================================
// Get all users (for Settings page)
app.get("/users", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can view users'
      }, 403);
    }
    const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching users:', error);
      return c.json({
        error: 'Failed to fetch users'
      }, 500);
    }

    // Fetch tab access for all users
    const { data: allTabAccess } = await supabase.from('user_tab_access').select('user_id, tab');
    const tabAccessMap: Record<string, string[]> = {};
    if (allTabAccess) {
      for (const ta of allTabAccess) {
        if (!tabAccessMap[ta.user_id]) tabAccessMap[ta.user_id] = [];
        tabAccessMap[ta.user_id].push(ta.tab);
      }
    }

    const usersWithTabs = (users || []).map((u: any) => ({
      ...toCamelCase(u),
      tabAccess: tabAccessMap[u.id] || []
    }));

    return c.json(usersWithTabs);
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Get pending users (waiting for approval)
app.get("/users/pending", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can view pending users'
      }, 403);
    }
    const { data: pendingUsers, error } = await supabase.from('profiles').select('*').eq('approval_status', 'pending').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching pending users:', error);
      return c.json({
        error: 'Failed to fetch pending users'
      }, 500);
    }
    return c.json(toCamelCase(pendingUsers));
  } catch (error) {
    console.error('Get pending users error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Create user directly (by dev/admin in Settings)
app.post("/users", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can create users'
      }, 403);
    }
    const body = await c.req.json();
    const { email, password, name, role, phone, twoFaMethod } = body;
    if (!email || !password || !name || !role) {
      return c.json({
        error: 'Missing required fields'
      }, 400);
    }
    if (![
      'dev',
      'admin',
      'pastor',
      'elder'
    ].includes(role)) {
      return c.json({
        error: 'Invalid role'
      }, 400);
    }
    if (role === 'dev' && profile.role !== 'dev') {
      return c.json({
        error: 'Only developers can create developer accounts'
      }, 403);
    }
    const normalizedUserPhone = phone ? normalizePhone(phone) : null;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        phone: normalizedUserPhone
      }
    });
    if (authError) {
      console.error('Auth error during user creation:', authError);
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
      phone: normalizedUserPhone,
      role,
      is_active: true,
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      two_fa_method: twoFaMethod || 'none'
    });
    if (profileError) {
      console.error('Profile creation error:', profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return c.json({
        error: 'Failed to create user profile'
      }, 500);
    }
    // Log activity
    const logPU = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logPU.name, userRole: logPU.role,
      action: 'create', entityType: 'user', entityId: authData.user.id,
      description: `Created user account: ${name} (${role})`
    });

    return c.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
        role
      }
    }, 201);
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Approve pending user
app.post("/users/:id/approve", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can approve users'
      }, 403);
    }
    const userId = c.req.param('id');
    const { error } = await supabase.from('profiles').update({
      is_active: true,
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).eq('id', userId);
    if (error) {
      console.error('Error approving user:', error);
      return c.json({
        error: 'Failed to approve user'
      }, 500);
    }
    return c.json({
      message: 'User approved successfully'
    });
  } catch (error) {
    console.error('Approve user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Reject pending user
app.post("/users/:id/reject", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can reject users'
      }, 403);
    }
    const userId = c.req.param('id');
    const { error } = await supabase.from('profiles').update({
      is_active: false,
      approval_status: 'rejected'
    }).eq('id', userId);
    if (error) {
      console.error('Error rejecting user:', error);
      return c.json({
        error: 'Failed to reject user'
      }, 500);
    }
    return c.json({
      message: 'User rejected successfully'
    });
  } catch (error) {
    console.error('Reject user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Admin/Dev reset user password
app.post("/users/:id/reset-password", async (c) => {
  try {
    const adminUser = await getUserFromToken(c.req.raw);
    if (!adminUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role, name').eq('id', adminUser.id).single();
    if (!adminProfile || !['dev', 'admin'].includes(adminProfile.role)) {
      return c.json({ error: 'Forbidden: Only dev and admin can reset user passwords' }, 403);
    }

    const userId = c.req.param('id');
    const { newPassword } = await c.req.json();

    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Get the target user's profile
    const { data: targetProfile } = await supabase.from('profiles').select('name, role').eq('id', userId).single();
    if (!targetProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Admins cannot reset dev passwords
    if (adminProfile.role === 'admin' && targetProfile.role === 'dev') {
      return c.json({ error: 'Admins cannot reset developer passwords' }, 403);
    }

    // Use admin API to update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (updateError) {
      console.error('Error resetting password:', updateError);
      return c.json({ error: 'Failed to reset password: ' + updateError.message }, 500);
    }

    // Log the activity
    await logActivity({
      userId: adminUser.id,
      userName: adminProfile.name,
      userRole: adminProfile.role,
      action: 'update',
      entityType: 'user',
      entityId: userId,
      description: `${adminProfile.name} reset password for ${targetProfile.name}`
    });

    return c.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset user password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user contact info (email/phone) - dev only
app.patch("/users/:id/contact", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'dev') {
      return c.json({ error: 'Forbidden: Only developers can update user contact info' }, 403);
    }

    const userId = c.req.param('id');
    const body = await c.req.json();
    const { email, phone } = body;

    if (!email && phone === undefined) {
      return c.json({ error: 'At least one of email or phone is required' }, 400);
    }

    const profileUpdate: any = {};
    if (email) profileUpdate.email = email;
    if (phone !== undefined) profileUpdate.phone = phone ? normalizePhone(phone) : null;

    // Update profiles table
    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating user contact:', profileError);
      return c.json({ error: 'Failed to update contact info: ' + profileError.message }, 500);
    }

    // If email changed, also update in auth.users
    if (email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email });
      if (authError) {
        console.error('Error updating auth email:', authError);
        // Revert profile email change
        return c.json({ error: 'Failed to update auth email: ' + authError.message }, 500);
      }
    }

    return c.json({
      message: 'Contact info updated successfully',
      user: toCamelCase(updatedProfile)
    });
  } catch (error) {
    console.error('Update user contact error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user role (by dev only)
app.patch("/users/:id/role", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || profile.role !== 'dev') {
      return c.json({
        error: 'Forbidden: Only developers can change user roles'
      }, 403);
    }
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { role } = body;

    if (!role || !['dev', 'admin', 'pastor', 'elder'].includes(role)) {
      return c.json({
        error: 'Invalid role'
      }, 400);
    }
    const { data: updatedProfile, error } = await supabase.from('profiles').update({
      role,
      updated_at: new Date().toISOString()
    }).eq('id', userId).select().single();
    if (error) {
      console.error('Error updating user role:', error);
      return c.json({
        error: 'Failed to update user role: ' + error.message
      }, 500);
    }
    if (!updatedProfile) {
      return c.json({
        error: 'User not found'
      }, 404);
    }
    return c.json({
      message: 'User role updated successfully',
      user: toCamelCase(updatedProfile)
    });
  } catch (error) {
    console.error('Update user role error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Delete user (by dev only)
app.delete("/users/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || profile.role !== 'dev') {
      return c.json({
        error: 'Forbidden: Only developers can delete users'
      }, 403);
    }
    const userId = c.req.param('id');

    if (userId === user.id) {
      return c.json({
        error: 'Cannot delete your own account'
      }, 400);
    }

    // First, nullify all references to avoid foreign key constraint violations
    // These tables have FK constraints that reference profiles(id)
    await Promise.all([
      supabase.from('members').update({ created_by: null }).eq('created_by', userId),
      supabase.from('attendance_records').update({ created_by: null }).eq('created_by', userId),
      supabase.from('giving_records').update({ created_by: null }).eq('created_by', userId),
      supabase.from('visitors').update({ created_by: null }).eq('created_by', userId),
      supabase.from('custom_services').update({ created_by: null }).eq('created_by', userId),
      supabase.from('custom_giving_types').update({ created_by: null }).eq('created_by', userId),
      supabase.from('custom_roles').update({ created_by: null }).eq('created_by', userId),
      supabase.from('temporary_permissions').update({ granted_by: null }).eq('granted_by', userId),
      // Also handle approved_by references in profiles table
      supabase.from('profiles').update({ approved_by: null }).eq('approved_by', userId),
    ]);

    // Delete temporary permissions for this user (has ON DELETE CASCADE but doing explicitly)
    await supabase.from('temporary_permissions').delete().eq('user_id', userId);

    const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return c.json({
        error: 'Failed to delete user profile: ' + profileError.message
      }, 500);
    }
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('Error deleting auth user:', authError);
    }
    return c.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Grant temporary permission
app.post("/users/:id/grant-permission", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user has grant_permissions permission
    const hasPermission = await checkPermission(user.id, 'grant_permissions');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden: You do not have permission to grant permissions' }, 403);
    }

    const userId = c.req.param('id');
    const { permission, durationHours } = await c.req.json();

    if (!permission || !durationHours) {
      return c.json({ error: 'Permission and durationHours are required' }, 400);
    }

    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    // Delete any existing temporary permission for the same user and permission
    await supabase
      .from('temporary_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission', permission);

    // Insert new temporary permission
    const { error } = await supabase
      .from('temporary_permissions')
      .insert({
        user_id: userId,
        permission,
        expires_at: expiresAt,
        granted_by: user.id
      });

    if (error) {
      console.error('Error granting permission:', error);
      return c.json({ error: 'Failed to grant permission' }, 500);
    }

    return c.json({ message: 'Permission granted successfully' });
  } catch (error) {
    console.error('Grant permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Revoke temporary permission
app.delete("/users/:id/revoke-permission/:permission", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user has grant_permissions permission
    const hasPermission = await checkPermission(user.id, 'grant_permissions');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden: You do not have permission to revoke permissions' }, 403);
    }

    const userId = c.req.param('id');
    const permission = c.req.param('permission');

    const { error } = await supabase
      .from('temporary_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission', permission);

    if (error) {
      console.error('Error revoking permission:', error);
      return c.json({ error: 'Failed to revoke permission' }, 500);
    }

    return c.json({ message: 'Permission revoked successfully' });
  } catch (error) {
    console.error('Revoke permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all temporary permissions (batch - avoids N+1 per-user queries)
app.get("/users/temporary-permissions/all", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase
      .from('temporary_permissions')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch temporary permissions' }, 500);
    }

    // Group by user_id
    const grouped: Record<string, any[]> = {};
    for (const perm of (data || [])) {
      const uid = perm.user_id;
      if (!grouped[uid]) grouped[uid] = [];
      grouped[uid].push(perm);
    }

    return c.json(grouped);
  } catch (error) {
    console.error('Get all temporary permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get temporary permissions for a user
app.get("/users/:id/temporary-permissions", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('id');

    const { data, error } = await supabase
      .from('temporary_permissions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching temporary permissions:', error);
      return c.json({ error: 'Failed to fetch temporary permissions' }, 500);
    }

    return c.json(data || []);
  } catch (error) {
    console.error('Get temporary permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// TAB ACCESS ENDPOINTS
// ============================================================================

// Get tab access for a user
app.get("/users/:id/tab-access", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userId = c.req.param('id');
    const { data, error } = await supabase.from('user_tab_access')
      .select('tab').eq('user_id', userId);

    if (error) {
      console.error('Error fetching tab access:', error);
      return c.json({ error: 'Failed to fetch tab access' }, 500);
    }

    return c.json({ tabs: (data || []).map(d => d.tab) });
  } catch (error) {
    console.error('Get tab access error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Set tab access for a user (dev only)
app.put("/users/:id/tab-access", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single();
    if (!profile || profile.role !== 'dev') {
      return c.json({ error: 'Forbidden: Only dev can manage tab access' }, 403);
    }

    const userId = c.req.param('id');
    const { tabs } = await c.req.json();

    if (!Array.isArray(tabs)) {
      return c.json({ error: 'tabs must be an array' }, 400);
    }

    // Delete existing tab access
    await supabase.from('user_tab_access').delete().eq('user_id', userId);

    // Insert new tab access
    if (tabs.length > 0) {
      const rows = tabs.map((tab: string) => ({
        user_id: userId,
        tab,
        granted_by: user.id
      }));
      const { error } = await supabase.from('user_tab_access').insert(rows);
      if (error) {
        console.error('Error setting tab access:', error);
        return c.json({ error: 'Failed to set tab access' }, 500);
      }
    }

    // Log activity
    const { data: targetProfile } = await supabase.from('profiles').select('name').eq('id', userId).single();
    await logActivity({
      userId: user.id, userName: profile.name, userRole: profile.role,
      action: 'update', entityType: 'user', entityId: userId,
      description: `Updated tab access for ${targetProfile?.name || userId}: ${tabs.join(', ') || 'none'}`
    });

    return c.json({ tabs });
  } catch (error) {
    console.error('Set tab access error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// SERVICE RECORDS ENDPOINTS
// ============================================================================

// Get today's (or most recent) service records
// Helper: enrich and group service records by date, combining multiple service types
// Uses batch queries instead of per-record to avoid N+1
async function enrichAndGroupByDate(records: any[]) {
  if (!records || records.length === 0) return [];

  // Sort by created_at desc so newest records come first (they overwrite older)
  const sorted = [...records].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Collect all IDs for batch fetching
  const attendanceIds = sorted.map(sr => sr.attendance_record_id).filter(Boolean);
  const givingIds = sorted.map(sr => sr.giving_record_id).filter(Boolean);
  const allDates = [...new Set(sorted.map(sr => sr.service_date))];

  // Batch fetch attendance totals
  const attendanceMap: Record<string, number> = {};
  if (attendanceIds.length > 0) {
    const { data: attData } = await supabase.from('attendance_records')
      .select('id, total_count')
      .in('id', attendanceIds);
    if (attData) {
      for (const a of attData) attendanceMap[a.id] = a.total_count || 0;
    }
  }

  // Batch fetch absentee counts
  const absenteeMap: Record<string, number> = {};
  if (attendanceIds.length > 0) {
    const { data: absData } = await supabase.from('absentee_records')
      .select('attendance_record_id')
      .in('attendance_record_id', attendanceIds);
    if (absData) {
      for (const a of absData) {
        absenteeMap[a.attendance_record_id] = (absenteeMap[a.attendance_record_id] || 0) + 1;
      }
    }
  }

  // Batch fetch giving totals
  const givingMap: Record<string, number> = {};
  if (givingIds.length > 0) {
    const { data: givData } = await supabase.from('giving_records')
      .select('id, total_amount')
      .in('id', givingIds);
    if (givData) {
      for (const g of givData) givingMap[g.id] = g.total_amount || 0;
    }
  }

  // Batch fetch visitor counts per date
  const visitorCountMap: Record<string, number> = {};
  if (allDates.length > 0) {
    const { data: visData } = await supabase.from('visitors')
      .select('visit_date')
      .in('visit_date', allDates);
    if (visData) {
      for (const v of visData) {
        visitorCountMap[v.visit_date] = (visitorCountMap[v.visit_date] || 0) + 1;
      }
    }
  }

  // Group by service_date and service_type
  const dateTypeMap: Record<string, any[]> = {};
  for (const sr of sorted) {
    const key = `${sr.service_date}_${sr.service_type}`;
    if (!dateTypeMap[key]) dateTypeMap[key] = [];
    dateTypeMap[key].push(sr);
  }

  const grouped = Object.entries(dateTypeMap).map(([key, srs]) => {
    // key is date_type, we can get date from the first record
    const date = srs[0].service_date;
    const type = srs[0].service_type;

    let totalAttendance = 0;
    let totalGiving = 0;
    let totalAbsentees = 0;
    let totalVisitors = 0;
    let totalNewMembers = 0;
    const serviceTypes: string[] = [type];

    for (const sr of srs) {
      if (sr.attendance_record_id) {
        totalAttendance += attendanceMap[sr.attendance_record_id] || 0;
        totalAbsentees += absenteeMap[sr.attendance_record_id] || 0;
      }
      if (sr.giving_record_id) {
        totalGiving += givingMap[sr.giving_record_id] || 0;
      }
      totalVisitors += sr.visitors_count || 0;
      totalNewMembers += sr.members_registered || 0;
    }

    // Since visitors and new members are recorded by date, not specifically by service,
    // we might need to distribute them or just show them for the primary service.
    // For now, if there's only one service type for the date, show all. If multiple, perhaps we only show the ones explicitly attached to this record in UI.
    // Let's keep the existing logic but just scoped to the records in this group.
    
    // We shouldn't use the bulk visitor table count if we are separating by service type
    // because visitors in the visitors table don't have a service_type.
    // BUT we will just use the sum of sr.visitors_count which is already specific to the service_record.
    
    // Also note: the original DB visitor/member queries didn't map to service types.
    // We will just stick to what is in the service_records table directly.

    return {
      serviceDate: date,
      serviceTypes,
      serviceType: type || 'Service',
      totalAttendance,
      totalGiving,
      absenteesCount: totalAbsentees,
      visitorsCount: totalVisitors, // Just sum what was recorded specifically on these service_records
      membersRegistered: totalNewMembers,
      recordCount: srs.length,
    };
  });

  // Sort by date descending, then by service_type
  grouped.sort((a, b) => {
    const dateCompare = b.serviceDate.localeCompare(a.serviceDate);
    if (dateCompare !== 0) return dateCompare;
    return a.serviceType.localeCompare(b.serviceType);
  });
  return grouped;
}

app.get("/service-records/today", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const today = new Date().toISOString().split('T')[0];

    // Try today first
    let { data: records, error } = await supabase.from('service_records')
      .select('*')
      .eq('service_date', today)
      .order('created_at', { ascending: false });

    // If no records today, get most recent date's records
    if (!error && (!records || records.length === 0)) {
      const { data: latestOne } = await supabase.from('service_records')
        .select('service_date')
        .order('service_date', { ascending: false })
        .limit(1);
      if (latestOne && latestOne.length > 0) {
        const latestDate = latestOne[0].service_date;
        const { data: latestRecords } = await supabase.from('service_records')
          .select('*')
          .eq('service_date', latestDate)
          .order('created_at', { ascending: false });
        records = latestRecords || [];
      }
    }

    if (error) {
      return c.json({ error: 'Failed to fetch service records' }, 500);
    }

    const grouped = await enrichAndGroupByDate(records || []);
    return c.json(grouped);
  } catch (error) {
    console.error('Get today service records error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all service records (grouped by date)
app.get("/service-records", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');

    // First get distinct dates with pagination
    let dateQuery = supabase.from('service_records')
      .select('service_date')
      .order('service_date', { ascending: false });

    if (startDate) dateQuery = dateQuery.gte('service_date', startDate);
    if (endDate) dateQuery = dateQuery.lte('service_date', endDate);

    const { data: allDates, error: dateError } = await dateQuery;

    if (dateError) {
      return c.json({ error: 'Failed to fetch service records' }, 500);
    }

    // Get unique dates
    const uniqueDates = [...new Set((allDates || []).map((d: any) => d.service_date))];
    const totalDates = uniqueDates.length;
    const offset = (page - 1) * limit;
    const paginatedDates = uniqueDates.slice(offset, offset + limit);

    if (paginatedDates.length === 0) {
      return c.json({ records: [], total: totalDates, page, limit });
    }

    // Fetch all records for these dates
    const { data: records, error } = await supabase.from('service_records')
      .select('*')
      .in('service_date', paginatedDates)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch service records' }, 500);
    }

    const grouped = await enrichAndGroupByDate(records || []);
    return c.json({ records: grouped, total: totalDates, page, limit });
  } catch (error) {
    console.error('Get service records error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get combined service record detail for a date
app.get("/service-records/by-date/:date", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const date = c.req.param('date');
    const serviceType = c.req.query('serviceType');
    
    let query = supabase.from('service_records')
      .select('*')
      .eq('service_date', date);
      
    if (serviceType) {
      query = query.eq('service_type', serviceType);
    }
    
    const { data: records, error } = await query.order('created_at', { ascending: false });

    if (error || !records || records.length === 0) {
      return c.json({ error: 'No service records found for this date and type' }, 404);
    }

    const serviceTypes: string[] = [];
    const services: any[] = [];

    // Process each service record (newest first = overwrites)
    for (const sr of records) {
      if (sr.service_type && !serviceTypes.includes(sr.service_type)) {
        serviceTypes.push(sr.service_type);
      }

      let attendance = null;
      let giving = null;
      let attendees: any[] = [];
      let absentees: any[] = [];

      if (sr.attendance_record_id) {
        const { data: att } = await supabase.from('attendance_records')
          .select('*').eq('id', sr.attendance_record_id).single();
        attendance = att ? toCamelCase(att) : null;

        const { data: entries } = await supabase.from('attendance_entries')
          .select('member_id, members!inner(first_name, last_name, zone)')
          .eq('attendance_record_id', sr.attendance_record_id);
        attendees = (entries || []).map((e: any) => ({
          memberId: e.member_id,
          firstName: e.members.first_name,
          lastName: e.members.last_name,
          zone: e.members.zone
        }));

        const { data: abs } = await supabase.from('absentee_records')
          .select('*, members!inner(first_name, last_name)')
          .eq('attendance_record_id', sr.attendance_record_id);
        absentees = (abs || []).map((a: any) => toCamelCase({
          ...a,
          memberName: `${a.members.first_name} ${a.members.last_name}`
        }));
      }

      if (sr.giving_record_id) {
        const { data: giv } = await supabase.from('giving_records')
          .select('*').eq('id', sr.giving_record_id).single();
        giving = giv ? toCamelCase(giv) : null;
      }

      services.push({
        ...toCamelCase(sr),
        attendance,
        giving,
        attendees,
        absentees,
      });
    }

    // Combine totals across all services for this date
    let totalAttendance = 0;
    let totalGivingAmount = 0;
    let allAttendees: any[] = [];
    let allAbsentees: any[] = [];
    const seenAttendeeIds = new Set<string>();
    const seenAbsenteeIds = new Set<string>();

    for (const svc of services) {
      if (svc.attendance) totalAttendance += svc.attendance.totalCount || 0;
      if (svc.giving) totalGivingAmount += svc.giving.totalAmount || svc.giving.total_amount || 0;

      for (const a of svc.attendees) {
        if (!seenAttendeeIds.has(a.memberId)) {
          seenAttendeeIds.add(a.memberId);
          allAttendees.push(a);
        }
      }
      for (const a of svc.absentees) {
        const abId = a.id || a.memberId;
        if (!seenAbsenteeIds.has(abId)) {
          seenAbsenteeIds.add(abId);
          allAbsentees.push(a);
        }
      }
    }

    // Get visitors for this date
    const { data: visitors } = await supabase.from('visitors')
      .select('id, first_name, last_name, phone')
      .eq('visit_date', date);

    // Get new members registered on this date
    const { data: newMembers } = await supabase.from('members')
      .select('id, first_name, last_name, zone')
      .eq('join_date', date);

    return c.json({
      serviceDate: date,
      serviceTypes,
      serviceType: serviceTypes.join(', ') || 'Service',
      totalAttendance,
      totalGivingAmount,
      services,
      attendees: allAttendees,
      absentees: allAbsentees,
      visitors: (visitors || []).map((v: any) => toCamelCase(v)),
      newMembers: (newMembers || []).map((m: any) => toCamelCase(m)),
    });
  } catch (error) {
    console.error('Get service record by date error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single service record detail (legacy, kept for compatibility)
app.get("/service-records/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { data: sr, error } = await supabase.from('service_records')
      .select('*').eq('id', id).single();

    if (error || !sr) {
      return c.json({ error: 'Service record not found' }, 404);
    }

    // Redirect to by-date endpoint logic
    const date = sr.service_date;
    const { data: records } = await supabase.from('service_records')
      .select('*')
      .eq('service_date', date)
      .order('created_at', { ascending: false });

    const serviceTypes: string[] = [];
    const services: any[] = [];

    for (const rec of (records || [sr])) {
      if (rec.service_type && !serviceTypes.includes(rec.service_type)) {
        serviceTypes.push(rec.service_type);
      }

      let attendance = null;
      let giving = null;
      let attendees: any[] = [];
      let absentees: any[] = [];

      if (rec.attendance_record_id) {
        const { data: att } = await supabase.from('attendance_records')
          .select('*').eq('id', rec.attendance_record_id).single();
        attendance = att ? toCamelCase(att) : null;

        const { data: entries } = await supabase.from('attendance_entries')
          .select('member_id, members!inner(first_name, last_name, zone)')
          .eq('attendance_record_id', rec.attendance_record_id);
        attendees = (entries || []).map((e: any) => ({
          memberId: e.member_id,
          firstName: e.members.first_name,
          lastName: e.members.last_name,
          zone: e.members.zone
        }));

        const { data: abs } = await supabase.from('absentee_records')
          .select('*, members!inner(first_name, last_name)')
          .eq('attendance_record_id', rec.attendance_record_id);
        absentees = (abs || []).map((a: any) => toCamelCase({
          ...a,
          memberName: `${a.members.first_name} ${a.members.last_name}`
        }));
      }

      if (rec.giving_record_id) {
        const { data: giv } = await supabase.from('giving_records')
          .select('*').eq('id', rec.giving_record_id).single();
        giving = giv ? toCamelCase(giv) : null;
      }

      services.push({ ...toCamelCase(rec), attendance, giving, attendees, absentees });
    }

    let totalAttendance = 0;
    let totalGivingAmount = 0;
    let allAttendees: any[] = [];
    let allAbsentees: any[] = [];
    const seenAttendeeIds = new Set<string>();
    const seenAbsenteeIds = new Set<string>();

    for (const svc of services) {
      if (svc.attendance) totalAttendance += svc.attendance.totalCount || 0;
      if (svc.giving) totalGivingAmount += svc.giving.totalAmount || svc.giving.total_amount || 0;
      for (const a of svc.attendees) {
        if (!seenAttendeeIds.has(a.memberId)) { seenAttendeeIds.add(a.memberId); allAttendees.push(a); }
      }
      for (const a of svc.absentees) {
        const abId = a.id || a.memberId;
        if (!seenAbsenteeIds.has(abId)) { seenAbsenteeIds.add(abId); allAbsentees.push(a); }
      }
    }

    const { data: visitors } = await supabase.from('visitors')
      .select('id, first_name, last_name, phone').eq('visit_date', date);
    const { data: newMembers } = await supabase.from('members')
      .select('id, first_name, last_name, zone').eq('join_date', date);

    return c.json({
      serviceDate: date,
      serviceTypes,
      serviceType: serviceTypes.join(', ') || 'Service',
      totalAttendance,
      totalGivingAmount,
      services,
      attendees: allAttendees,
      absentees: allAbsentees,
      visitors: (visitors || []).map((v: any) => toCamelCase(v)),
      newMembers: (newMembers || []).map((m: any) => toCamelCase(m)),
    });
  } catch (error) {
    console.error('Get service record detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// ACTIVITY LOG ENDPOINTS
// ============================================================================

// Get activity log
app.get("/activity-log", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const userRole = profile?.role || 'viewer';

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;
    const userId = c.req.query('userId');
    const action = c.req.query('action');
    const entityType = c.req.query('entityType');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Fetch visibility config for this role: categories where is_visible = false are excluded
    const { data: visibilityConfigs } = await supabase
      .from('activity_log_visibility_config')
      .select('category, is_visible, allowed_roles')
      .eq('is_visible', false);

    // Determine which categories are hidden for this role
    const hiddenCategories: string[] = [];
    if (visibilityConfigs) {
      for (const cfg of visibilityConfigs) {
        const allowedRoles: string[] = cfg.allowed_roles || [];
        // If there are no allowed_roles for an invisible category, it is hidden for everyone.
        // If allowedRoles is set, hide only if this role is NOT in allowedRoles.
        if (allowedRoles.length === 0 || !allowedRoles.includes(userRole)) {
          hiddenCategories.push(cfg.category);
        }
      }
    }

    let query = supabase.from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Dev and admin can see all logs; others see only their own
    const isPrivileged = userRole === 'dev' || userRole === 'admin';
    if (!isPrivileged) {
      query = query.eq('user_id', user.id);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply visibility filter — exclude hidden categories
    if (hiddenCategories.length > 0) {
      query = query.not('entity_type', 'in', `(${hiddenCategories.map(c => `"${c}"`).join(',')})`);
    }

    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entity_type', entityType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z');

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Error fetching activity log:', error);
      return c.json({ error: 'Failed to fetch activity log' }, 500);
    }

    return c.json({
      logs: (logs || []).map((l: any) => toCamelCase(l)),
      total: count || 0,
      page,
      limit
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Export activity log
app.get("/activity-log/export", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    const userId = c.req.query('userId');
    const action = c.req.query('action');
    const entityType = c.req.query('entityType');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    let query = supabase.from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    // Dev and admin can see all logs; others see only their own
    const isPrivileged = profile && (profile.role === 'dev' || profile.role === 'admin');
    if (!isPrivileged) {
      query = query.eq('user_id', user.id);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entity_type', entityType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z');

    const { data: logs, error } = await query;

    if (error) {
      return c.json({ error: 'Failed to export activity log' }, 500);
    }

    return c.json({ logs: (logs || []).map((l: any) => toCamelCase(l)) });
  } catch (error) {
    console.error('Export activity log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

// Get notifications for current user
app.get("/notifications", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    const unreadOnly = c.req.query('unreadOnly') === 'true';

    let query = supabase.from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error, count } = await query;

    if (error) {
      return c.json({ error: 'Failed to fetch notifications' }, 500);
    }

    return c.json({
      notifications: (data || []).map((n: any) => toCamelCase(n)),
      total: count || 0,
      page,
      limit
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get unread count
app.get("/notifications/unread-count", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { count, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      return c.json({ error: 'Failed to fetch unread count' }, 500);
    }

    return c.json({ count: count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Login summary — notifications since last login + birthday check
app.get("/notifications/login-summary", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    // Get user's tab access
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isDev = profile?.role === 'dev';

    let accessibleTabs: string[] = [];
    if (isDev) {
      accessibleTabs = ['members', 'visitors', 'attendance', 'giving', 'reports', 'services', 'activity-log'];
    } else {
      const { data: tabData } = await supabase.from('user_tab_access').select('tab').eq('user_id', user.id);
      accessibleTabs = (tabData || []).map(t => t.tab);
    }

    // Get unread notifications for accessible tabs
    const { data: unread } = await supabase.from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter to accessible tabs
    const filtered = (unread || []).filter(n => !n.tab || accessibleTabs.includes(n.tab));

    // Birthday check - members with birthdays today
    let birthdays: any[] = [];
    if (isDev || accessibleTabs.includes('members')) {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const { data: bdayMembers } = await supabase.from('members')
        .select('id, first_name, last_name, date_of_birth')
        .not('date_of_birth', 'is', null);

      birthdays = (bdayMembers || []).filter((m: any) => {
        if (!m.date_of_birth) return false;
        const d = new Date(m.date_of_birth);
        return d.getMonth() + 1 === month && d.getDate() === day;
      }).map((m: any) => ({
        memberId: m.id,
        name: `${m.first_name} ${m.last_name}`,
        dateOfBirth: m.date_of_birth
      }));

      // Create birthday notifications if not already created today
      for (const bday of birthdays) {
        const todayStr = today.toISOString().split('T')[0];
        const { data: existing } = await supabase.from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'birthday')
          .eq('entity_id', bday.memberId)
          .gte('created_at', todayStr)
          .limit(1);

        if (!existing || existing.length === 0) {
          await createNotification({
            userId: user.id,
            type: 'birthday',
            title: 'Birthday Today!',
            message: `${bday.name} has a birthday today.`,
            tab: 'members',
            entityType: 'member',
            entityId: bday.memberId
          });
        }
      }
    }

    // Age-out check — children turning 18 today
    const today2 = new Date();
    const eighteenYearsAgo = new Date(today2);
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    const ageOutDate = eighteenYearsAgo.toISOString().split('T')[0];

    // Check if children table exists before querying
    const { data: ageOutKids } = await supabase
      .from('children_members')
      .select('id, first_name, last_name')
      .eq('date_of_birth', ageOutDate)
      .eq('converted_to_member', false);

    if (ageOutKids && ageOutKids.length > 0) {
      // Get audience from notification_type_config
      const { data: ageOutConfig } = await supabase
        .from('notification_type_config')
        .select('allowed_roles, allowed_user_ids, is_enabled')
        .eq('type', 'child_age_out')
        .maybeSingle();

      if (!ageOutConfig || ageOutConfig.is_enabled !== false) {
        const allowedRoles = ageOutConfig?.allowed_roles || ['admin', 'pastor'];
        const allowedUserIds: string[] = ageOutConfig?.allowed_user_ids || [];

        // Get all users matching allowed roles
        const { data: roleUsers } = await supabase
          .from('profiles')
          .select('id')
          .in('role', allowedRoles)
          .eq('is_active', true);

        const audienceIds = new Set<string>();
        (roleUsers || []).forEach(u => audienceIds.add(u.id));
        allowedUserIds.forEach(id => audienceIds.add(id));

        for (const child of ageOutKids) {
          const todayStr2 = today2.toISOString().split('T')[0];
          for (const recipientId of audienceIds) {
            const { data: existingAO } = await supabase.from('notifications')
              .select('id').eq('user_id', recipientId)
              .eq('type', 'child_age_out').eq('entity_id', child.id)
              .gte('created_at', todayStr2).limit(1);
            if (!existingAO || existingAO.length === 0) {
              await supabase.from('notifications').insert({
                user_id: recipientId,
                type: 'child_age_out',
                title: `${child.first_name} ${child.last_name} has turned 18`,
                message: `This child member has reached the age limit (18). Consider promoting them to the main congregation.`,
                tab: 'children',
                entity_type: 'child_member',
                entity_id: child.id,
              });
            }
          }
        }
      }
    }

    return c.json({
      notifications: filtered.map((n: any) => toCamelCase(n)),
      birthdays,
      accessibleTabs
    });
  } catch (error) {
    console.error('Login summary error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark notification as read
app.patch("/notifications/:id/read", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { error } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return c.json({ error: 'Failed to mark as read' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark all notifications as read
app.patch("/notifications/read-all", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { error } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      return c.json({ error: 'Failed to mark all as read' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// THEME SETTINGS
// ============================================================================

// Get user's theme settings
app.get("/theme", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase.from('user_settings')
      .select('theme_colors, theme_mode')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching theme:', error);
      return c.json({ error: 'Failed to fetch theme' }, 500);
    }

    return c.json({
      colors: data?.theme_colors || null,
      mode: data?.theme_mode || 'system'
    });
  } catch (error) {
    console.error('Theme fetch error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Save user's theme settings
app.put("/theme", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { colors, mode } = await c.req.json();

    // Upsert the user settings
    const { error } = await supabase.from('user_settings')
      .upsert({
        user_id: user.id,
        theme_colors: colors,
        theme_mode: mode,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving theme:', error);
      return c.json({ error: 'Failed to save theme' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Theme save error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// BACKUP & RESTORE
// ============================================================================

// Helper to check if user is admin/dev
async function isAdminOrDev(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return profile?.role === 'dev' || profile?.role === 'admin';
}

// Get backup history
app.get("/backups", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { data: backups, error } = await supabase
      .from('backup_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching backups:', error);
      return c.json({ error: 'Failed to fetch backups' }, 500);
    }

    return c.json(backups.map(b => toCamelCase(b)));
  } catch (error) {
    console.error('Get backups error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get last full backup info (for differential backups)
app.get("/backups/last-full", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { data: lastFull, error } = await supabase
      .from('backup_history')
      .select('*')
      .eq('type', 'full')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching last full backup:', error);
      return c.json({ error: 'Failed to fetch last full backup' }, 500);
    }

    return c.json(lastFull ? toCamelCase(lastFull) : null);
  } catch (error) {
    console.error('Get last full backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create a backup (full or differential)
app.post("/backups", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const backupType = body.type || 'full'; // 'full' or 'differential'
    const selectedTables = body.selectedTables || []; // Empty = all tables

    // All available tables for backup
    const allTables = [
      'members',
      'family_members',
      'visitors',
      'attendance_records',
      'attendance_entries',
      'absentee_records',
      'member_status_log',
      'giving_records',
      'custom_services',
      'custom_giving_types',
      'custom_roles',
      'profiles',
      'temporary_permissions',
      'user_tab_access',
      'user_settings',
      'service_records',
      'notifications',
      'activity_log'
    ];

    // Determine which tables to backup
    const tablesToBackup = selectedTables.length > 0 ? selectedTables : allTables;

    // For differential backup, we need a reference to the last full backup
    let basedOnBackupId = null;
    let basedOnBackupDate = null;

    if (backupType === 'differential') {
      const { data: lastFull } = await supabase
        .from('backup_history')
        .select('id, created_at')
        .eq('type', 'full')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!lastFull) {
        return c.json({ error: 'No full backup exists. Please create a full backup first.' }, 400);
      }

      basedOnBackupId = lastFull.id;
      basedOnBackupDate = lastFull.created_at;
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${backupType}_${timestamp}.json`;

    // Get user profile for activity log
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Create backup record with 'in_progress' status
    const { data: backupRecord, error: createError } = await supabase
      .from('backup_history')
      .insert({
        type: backupType,
        status: 'in_progress',
        file_name: fileName,
        based_on_backup_id: basedOnBackupId,
        based_on_backup_date: basedOnBackupDate,
        storage_locations: body.storageLocations || ['device'],
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating backup record:', createError);
      return c.json({ error: 'Failed to create backup record' }, 500);
    }

    try {
      // Collect all data for backup
      const backupData: any = {
        metadata: {
          id: backupRecord.id,
          type: backupType,
          createdAt: new Date().toISOString(),
          basedOnFullBackup: basedOnBackupDate,
          version: '1.0',
          selectedTables: tablesToBackup,
          recordCounts: {}
        },
        data: {},
        deletions: {} // For differential - track deleted IDs (future enhancement)
      };

      // Table configurations - use '*' to get all existing columns
      const tableConfigs: { [key: string]: string } = {
        'members': '*',
        'family_members': '*',
        'visitors': '*',
        'attendance_records': '*',
        'attendance_entries': '*',
        'absentee_records': '*',
        'member_status_log': '*',
        'giving_records': '*',
        'custom_services': '*',
        'custom_giving_types': '*',
        'custom_roles': '*',
        'profiles': '*',
        'temporary_permissions': '*',
        'user_tab_access': '*',
        'user_settings': '*',
        'service_records': '*',
        'notifications': '*',
        'activity_log': '*'
      };

      // Helper function to fetch all records with pagination (Supabase default limit is 1000)
      async function fetchAllRecords(tableName: string, selectFields: string, filterDate?: string) {
        const allRecords: any[] = [];
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from(tableName)
            .select(selectFields)
            .range(offset, offset + pageSize - 1);

          // For differential backup, only get records modified since last full backup
          if (filterDate) {
            query = supabase
              .from(tableName)
              .select(selectFields)
              .or(`created_at.gte.${filterDate},updated_at.gte.${filterDate}`)
              .range(offset, offset + pageSize - 1);
          }

          const { data, error } = await query;

          if (error) {
            console.error(`Error fetching ${tableName} (offset ${offset}):`, error);
            throw error;
          }

          if (data && data.length > 0) {
            allRecords.push(...data);
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        return allRecords;
      }

      for (const tableName of tablesToBackup) {
        const selectFields = tableConfigs[tableName] || '*';
        const filterDate = backupType === 'differential' && basedOnBackupDate ? basedOnBackupDate : undefined;

        try {
          const data = await fetchAllRecords(tableName, selectFields, filterDate);
          backupData.data[tableName] = data;
          backupData.metadata.recordCounts[tableName] = data.length;
          console.log(`Fetched ${data.length} records from ${tableName}`);
        } catch (error) {
          console.error(`Error fetching ${tableName}:`, error);
          // Continue with other tables even if one fails
          backupData.data[tableName] = [];
          backupData.metadata.recordCounts[tableName] = 0;
        }
      }

      // Calculate file size (approximate)
      const jsonString = JSON.stringify(backupData);
      const fileSize = new Blob([jsonString]).size;

      // Update backup record with success
      const { error: updateError } = await supabase
        .from('backup_history')
        .update({
          status: 'completed',
          file_size: fileSize,
          record_counts: backupData.metadata.recordCounts,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupRecord.id);

      if (updateError) {
        console.error('Error updating backup record:', updateError);
      }

      // Log backup creation to activity log
      const totalRecords = Object.values(backupData.metadata.recordCounts).reduce((a: number, b: any) => a + (b || 0), 0);
      await supabase.from('activity_log').insert({
        user_id: user.id,
        user_name: userProfile?.name || 'Unknown',
        user_email: userProfile?.email || '',
        action: 'backup_created',
        entity_type: 'backup',
        entity_id: backupRecord.id,
        details: {
          backupType,
          fileName,
          selectedTables: tablesToBackup,
          totalRecords,
          fileSize
        }
      });

      // Return the backup data for download
      return c.json({
        backup: toCamelCase(backupRecord),
        data: backupData
      });

    } catch (backupError) {
      // Update backup record with failure
      await supabase
        .from('backup_history')
        .update({
          status: 'failed',
          error_message: backupError.message || 'Unknown error during backup'
        })
        .eq('id', backupRecord.id);

      throw backupError;
    }

  } catch (error) {
    console.error('Create backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Restore from backup
app.post("/backups/restore", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { backupData, restoreMode, selectedTables } = body;

    if (!backupData || !backupData.data) {
      return c.json({ error: 'Invalid backup data' }, 400);
    }

    const mode = restoreMode || 'merge'; // 'replace', 'merge', 'update'

    // Validate backup structure
    if (!backupData.metadata || !backupData.metadata.version) {
      return c.json({ error: 'Invalid backup format - missing metadata' }, 400);
    }

    // Get user profile for activity log
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const results: any = {
      success: true,
      mode,
      tables: {}
    };

    // Define restore order (respects foreign key relationships)
    const restoreOrder = [
      'profiles',
      'custom_roles',
      'members',
      'family_members',
      'visitors',
      'custom_services',
      'custom_giving_types',
      'attendance_records',
      'attendance_entries',
      'absentee_records',
      'member_status_log',
      'giving_records',
      'service_records',
      'temporary_permissions',
      'user_tab_access',
      'user_settings',
      'notifications',
      'activity_log'
    ];

    // Filter to only selected tables if specified
    const tablesToRestore = selectedTables && selectedTables.length > 0
      ? restoreOrder.filter(t => selectedTables.includes(t))
      : restoreOrder;

    for (const tableName of tablesToRestore) {
      const tableData = backupData.data[tableName];
      if (!tableData || tableData.length === 0) {
        results.tables[tableName] = { skipped: true, reason: 'No data' };
        continue;
      }

      try {
        if (mode === 'replace') {
          // Delete all existing data first (careful with foreign keys!)
          if (tableName !== 'profiles' && tableName !== 'activity_log') { // Don't delete profiles or activity logs
            const { error: deleteError } = await supabase
              .from(tableName)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (deleteError) {
              console.error(`Error clearing ${tableName}:`, deleteError);
              results.tables[tableName] = { error: deleteError.message };
              continue;
            }
          }
        }

        // Insert/upsert data
        if (mode === 'replace' || mode === 'update') {
          // Upsert - insert or update on conflict
          const { data, error } = await supabase
            .from(tableName)
            .upsert(tableData, { onConflict: 'id' })
            .select();

          if (error) {
            console.error(`Error restoring ${tableName}:`, error);
            results.tables[tableName] = { error: error.message };
          } else {
            results.tables[tableName] = { restored: (data || []).length };
          }
        } else {
          // Merge mode - only insert new records (skip existing)
          let inserted = 0;
          let skipped = 0;

          for (const record of tableData) {
            const { data: existing } = await supabase
              .from(tableName)
              .select('id')
              .eq('id', record.id)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from(tableName)
                .insert(record);

              if (error) {
                console.error(`Error inserting into ${tableName}:`, error);
                skipped++;
              } else {
                inserted++;
              }
            } else {
              skipped++;
            }
          }

          results.tables[tableName] = { inserted, skipped };
        }

      } catch (tableError) {
        console.error(`Error processing ${tableName}:`, tableError);
        results.tables[tableName] = { error: tableError.message };
      }
    }

    // Log restore to activity log
    const restoredTables = Object.entries(results.tables)
      .filter(([_, info]: [string, any]) => info.restored || info.inserted)
      .map(([name]) => name);

    await supabase.from('activity_log').insert({
      user_id: user.id,
      user_name: userProfile?.name || 'Unknown',
      user_email: userProfile?.email || '',
      action: 'backup_restored',
      entity_type: 'backup',
      entity_id: backupData.metadata?.id || null,
      details: {
        restoreMode: mode,
        backupType: backupData.metadata?.type,
        backupDate: backupData.metadata?.createdAt,
        restoredTables,
        results: results.tables
      }
    });

    return c.json(results);

  } catch (error) {
    console.error('Restore backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete a backup record
app.delete("/backups/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const backupId = c.req.param('id');

    const { error } = await supabase
      .from('backup_history')
      .delete()
      .eq('id', backupId);

    if (error) {
      console.error('Error deleting backup:', error);
      return c.json({ error: 'Failed to delete backup' }, 500);
    }

    return c.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Delete backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Preview restore (show what would change)
app.post("/backups/preview", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { backupData, restoreMode } = body;

    if (!backupData || !backupData.data) {
      return c.json({ error: 'Invalid backup data' }, 400);
    }

    const mode = restoreMode || 'merge';
    const preview: any = {
      mode,
      backupInfo: backupData.metadata,
      tables: {}
    };

    // For each table, count current records and backup records
    const tables = [
      'members', 'family_members', 'visitors', 'attendance_records', 'attendance_entries',
      'absentee_records', 'member_status_log', 'giving_records', 'custom_services', 'custom_giving_types',
      'custom_roles', 'profiles', 'temporary_permissions', 'user_tab_access', 'user_settings',
      'service_records', 'notifications', 'activity_log'
    ];

    for (const tableName of tables) {
      const backupCount = (backupData.data[tableName] || []).length;

      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      preview.tables[tableName] = {
        currentCount: error ? 0 : count,
        backupCount,
        action: mode === 'replace' ? 'Replace all' : mode === 'merge' ? 'Add new only' : 'Update & add'
      };
    }

    return c.json(preview);

  } catch (error) {
    console.error('Preview restore error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// CHILDREN MEMBERS
// ============================================================================

app.get('/children/members', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_members')
      .select('*')
      .order('first_name', { ascending: true });
    if (error) return c.json({ error: 'Failed to fetch children members' }, 500);
    return c.json((data || []).map((m: any) => toCamelCase(m)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.get('/children/members/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const { data, error } = await supabase.from('children_members').select('*').eq('id', id).single();
    if (error || !data) return c.json({ error: 'Child member not found' }, 404);
    const parents = await supabase.from('children_member_parents').select('*').eq('child_member_id', id);
    return c.json({ ...toCamelCase(data), parents: (parents.data || []).map((p: any) => toCamelCase(p)) });
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.post('/children/members', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();

    // Age validation: must be < 18
    if (body.dateOfBirth) {
      const dob = new Date(body.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      if (dob <= cutoff) return c.json({ error: 'Date of birth indicates age ≥ 18 — this person is not a child' }, 400);
    }

    const { data, error } = await supabase.from('children_members').insert({
      first_name: body.firstName,
      last_name: body.lastName,
      other_names: body.otherNames,
      gender: body.gender,
      date_of_birth: body.dateOfBirth,
      zone: body.zone || null,
      status: body.status || 'new',
      residence_location: body.residenceLocation,
      notes: body.notes,
      ministries: body.ministries || ['Children\'s Ministry'],
      join_date: body.joinDate || new Date().toISOString().split('T')[0],
      created_by: user.id,
    }).select().single();

    if (error) return c.json({ error: error.message }, 500);

    // Save parents
    if (body.parents && body.parents.length > 0) {
      const parentRows = body.parents.map((p: any) => ({
        child_member_id: data.id,
        relationship: p.relationship,
        first_name: p.firstName,
        last_name: p.lastName,
        other_names: p.otherNames || null,
        phone: p.phone || null,
        is_linked: p.isLinked || false,
        linked_member_id: p.linkedMemberId || null,
      }));
      await supabase.from('children_member_parents').insert(parentRows);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({ userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'create_child_member', entityType: 'child_member', entityId: data.id,
      description: `Added child member ${body.firstName} ${body.lastName}` });

    return c.json(toCamelCase(data), 201);
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.put('/children/members/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();

    if (body.dateOfBirth) {
      const dob = new Date(body.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      if (dob <= cutoff) return c.json({ error: 'Date of birth indicates age ≥ 18 — this person is not a child' }, 400);
    }

    const { data, error } = await supabase.from('children_members').update({
      first_name: body.firstName,
      last_name: body.lastName,
      other_names: body.otherNames,
      gender: body.gender,
      date_of_birth: body.dateOfBirth,
      zone: body.zone || null,
      status: body.status,
      residence_location: body.residenceLocation,
      notes: body.notes,
      photo_url: body.photoUrl || body.photo,
      ministries: body.ministries,
      converted_to_member: body.convertedToMember || false,
      converted_member_id: body.convertedMemberId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();

    if (error) return c.json({ error: error.message }, 500);

    if (body.parents) {
      await supabase.from('children_member_parents').delete().eq('child_member_id', id);
      if (body.parents.length > 0) {
        const parentRows = body.parents.map((p: any) => ({
          child_member_id: id,
          relationship: p.relationship,
          first_name: p.firstName,
          last_name: p.lastName,
          other_names: p.otherNames || null,
          phone: p.phone || null,
          is_linked: p.isLinked || false,
          linked_member_id: p.linkedMemberId || null,
        }));
        await supabase.from('children_member_parents').insert(parentRows);
      }
    }

    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.delete('/children/members/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const { error } = await supabase.from('children_members').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================
// CHILDREN VISITORS
// ============================================================================

app.get('/children/visitors', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_visitors').select('*')
      .order('visit_date', { ascending: false });
    if (error) return c.json({ error: 'Failed to fetch children visitors' }, 500);
    return c.json((data || []).map((v: any) => toCamelCase(v)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.post('/children/visitors', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const { data, error } = await supabase.from('children_visitors').insert({
      first_name: body.firstName,
      last_name: body.lastName,
      other_names: body.otherNames,
      phone: body.phone,
      gender: body.gender,
      visit_date: body.visitDate,
      service_type: body.serviceType,
      referred_by: body.referredBy,
      notes: body.notes,
      follow_up_status: body.followUpStatus || 'pending',
      created_by: user.id,
    }).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data), 201);
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.put('/children/visitors/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase.from('children_visitors').update({
      first_name: body.firstName,
      last_name: body.lastName,
      other_names: body.otherNames,
      phone: body.phone,
      gender: body.gender,
      visit_date: body.visitDate,
      service_type: body.serviceType,
      referred_by: body.referredBy,
      notes: body.notes,
      follow_up_status: body.followUpStatus,
      converted_to_member: body.convertedToMember || false,
      converted_member_id: body.convertedMemberId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================
// CHILDREN ATTENDANCE
// ============================================================================

app.get('/children/attendance', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_attendance_records').select('*')
      .order('date', { ascending: false });
    if (error) return c.json({ error: 'Failed to fetch children attendance' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.get('/children/attendance/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const { data, error } = await supabase.from('children_attendance_records').select('*').eq('id', id).single();
    if (error || !data) return c.json({ error: 'Not found' }, 404);
    const entries = await supabase.from('children_attendance_entries')
      .select('*, children_members(first_name, last_name)')
      .eq('attendance_record_id', id);
    return c.json({ ...toCamelCase(data), entries: (entries.data || []).map((e: any) => toCamelCase(e)) });
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.post('/children/attendance', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const childIds: string[] = body.childMemberIds || [];
    const visitorsCount: number = body.visitorsCount || 0;

    // Upsert the attendance record
    const { data: record, error: recErr } = await supabase
      .from('children_attendance_records')
      .upsert({
        date: body.date,
        service_type: body.serviceType,
        total_count: childIds.length + visitorsCount,
        visitors_count: visitorsCount,
        created_by: user.id,
      }, { onConflict: 'date,service_type' })
      .select().single();

    if (recErr) return c.json({ error: recErr.message }, 500);

    // Insert entries for each child
    if (childIds.length > 0) {
      const entries = childIds.map(cid => ({
        attendance_record_id: record.id,
        child_member_id: cid,
      }));
      await supabase.from('children_attendance_entries')
        .upsert(entries, { onConflict: 'attendance_record_id,child_member_id' });
    }

    return c.json(toCamelCase(record), 201);
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.put('/children/attendance/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    const childIds: string[] = body.childMemberIds || [];
    const visitorsCount: number = body.visitorsCount || 0;

    const { data, error } = await supabase.from('children_attendance_records').update({
      total_count: childIds.length + visitorsCount,
      visitors_count: visitorsCount,
    }).eq('id', id).select().single();
    if (error) return c.json({ error: error.message }, 500);

    // Replace entries
    await supabase.from('children_attendance_entries').delete().eq('attendance_record_id', id);
    if (childIds.length > 0) {
      await supabase.from('children_attendance_entries').insert(
        childIds.map(cid => ({ attendance_record_id: id, child_member_id: cid }))
      );
    }

    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================
// CHILDREN GIVING
// ============================================================================

app.get('/children/giving', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_giving_records').select('*')
      .order('service_date', { ascending: false });
    if (error) return c.json({ error: 'Failed to fetch children giving' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.post('/children/giving', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json();
    const total = (body.offeringAmount || 0) + (body.cashAmount || 0) + (body.mobileMoney || 0);
    const { data, error } = await supabase.from('children_giving_records').insert({
      service_date: body.serviceDate,
      service_type: body.serviceType,
      offering_amount: body.offeringAmount || 0,
      total_amount: body.totalAmount ?? total,
      cash_amount: body.cashAmount || 0,
      mobile_money_amount: body.mobileMoneyAmount || 0,
      notes: body.notes,
      created_by: user.id,
    }).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data), 201);
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.put('/children/giving/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase.from('children_giving_records').update({
      service_date: body.serviceDate,
      service_type: body.serviceType,
      offering_amount: body.offeringAmount || 0,
      total_amount: body.totalAmount || 0,
      cash_amount: body.cashAmount || 0,
      mobile_money_amount: body.mobileMoneyAmount || 0,
      notes: body.notes,
    }).eq('id', id).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================
// ADMIN: NOTIFICATION CONFIG (dev only)
// ============================================================================

app.get('/admin/notification-config', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    const { data, error } = await supabase.from('notification_type_config').select('*').order('category');
    if (error) return c.json({ error: 'Failed to fetch config' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.put('/admin/notification-config/:type', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    const type = c.req.param('type');
    const body = await c.req.json();
    const { data, error } = await supabase.from('notification_type_config').update({
      allowed_roles: body.allowedRoles,
      allowed_user_ids: body.allowedUserIds,
      is_enabled: body.isEnabled,
      updated_at: new Date().toISOString(),
    }).eq('type', type).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================
// ADMIN: ACTIVITY LOG CONFIG (dev only)
// ============================================================================

app.get('/admin/activity-log-config', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    const { data, error } = await supabase.from('activity_log_visibility_config').select('*').order('action_category');
    if (error) return c.json({ error: 'Failed to fetch config' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

app.put('/admin/activity-log-config/:category', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    const category = c.req.param('category');
    const body = await c.req.json();
    const { data, error } = await supabase.from('activity_log_visibility_config').update({
      allowed_roles: body.allowedRoles,
      allowed_user_ids: body.allowedUserIds,
      updated_at: new Date().toISOString(),
    }).eq('action_category', category).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// DEBUG: Global 404 Handler
app.notFound((c)=>{
  return c.json({
    message: 'DEBUG: Route Not Found',
    ok: false,
    debug: {
      userAgent: c.req.header('User-Agent'),
      url: c.req.url,
      path: c.req.path,
      method: c.req.method,
      matchedRoute: c.req.routePath
    }
  }, 404);
});
Deno.serve(app.fetch);
