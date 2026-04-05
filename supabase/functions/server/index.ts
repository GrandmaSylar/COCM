
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@supabase/supabase-js";
// Create Hono app. Supabase invokes at /functions/v1/server so path is e.g. /members/:id (no /server prefix).
const app = new Hono().basePath('/server');

// CORS — allow any origin so localhost + production both work
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-church-id', 'apikey'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}));
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
function getSupabaseClient(accessToken?: string) {
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
async function getUserFromToken(request: Request) {
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
    if (['grant_permissions', 'manage_giving_types', 'manage_users', 'manage_settings', 'manage_members'].includes(permission)) {
      return true;
    }
  }

  if (!SYSTEM_ROLES.includes(profile.role as typeof SYSTEM_ROLES[number])) {
    const { data: customRole } = await supabase
      .from('custom_roles')
      .select('permissions')
      .eq('name', profile.role)
      .maybeSingle();

    if (customRole && Array.isArray(customRole.permissions) && customRole.permissions.includes(permission)) {
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
function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => toSnakeCase(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    return Object.keys(record).reduce((acc: Record<string, unknown>, key: string) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = toSnakeCase(record[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return obj;
}
// Helper to convert snake_case to camelCase
function toCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => toCamelCase(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    return Object.keys(record).reduce((acc: Record<string, unknown>, key: string) => {
      let camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

      // Handle special field mappings (photo_url -> photo)
      if (camelKey === 'photoUrl') {
        camelKey = 'photo';
      }

      acc[camelKey] = toCamelCase(record[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return obj;
}

const SYSTEM_ROLES = ['dev', 'admin', 'pastor', 'elder'] as const;

// Modular Routers
import activityLogRouter from "./routes/activity-log.ts";
import adminRouter from "./routes/admin.ts";
import attendanceAbsenteesRouter from "./routes/attendance-absentees.ts";
import attendanceRouter from "./routes/attendance.ts";
import auth2faRouter from "./routes/auth-2fa.ts";
import authForgotPasswordRouter from "./routes/auth-forgot-password.ts";
import authRouter from "./routes/auth.ts";
import backupsRouter from "./routes/backups.ts";
import childrenAnalyticsRouter from "./routes/children-analytics.ts";
import childrenAttendanceRouter from "./routes/children-attendance.ts";
import childrenGivingRouter from "./routes/children-giving.ts";
import childrenMembersRouter from "./routes/children-members.ts";
import childrenVisitorsRouter from "./routes/children-visitors.ts";
import cloudinaryRouter from "./routes/cloudinary.ts";
import customRolesRouter from "./routes/custom-roles.ts";
import expensesRouter from "./routes/expenses.ts";
import healthRouter from "./routes/health.ts";
import memberSabbaticalRouter from "./routes/member-sabbatical.ts";
import membersRouter from "./routes/members.ts";
import notificationsRouter from "./routes/notifications.ts";
import optionsRouter from "./routes/options.ts";
import preferencesRouter from "./routes/preferences.ts";
import serviceRecordsRouter from "./routes/service-records.ts";
import servicesRouter from "./routes/services.ts";
import tabAccessRouter from "./routes/tab-access.ts";
import themeRouter from "./routes/theme.ts";
import usersRouter from "./routes/users.ts";

app.route('/', activityLogRouter);
app.route('/', adminRouter);
app.route('/', attendanceAbsenteesRouter);
app.route('/', attendanceRouter);
app.route('/', auth2faRouter);
app.route('/', authForgotPasswordRouter);
app.route('/', authRouter);
app.route('/', backupsRouter);
app.route('/', childrenAnalyticsRouter);
app.route('/', childrenAttendanceRouter);
app.route('/', childrenGivingRouter);
app.route('/', childrenMembersRouter);
app.route('/', childrenVisitorsRouter);
app.route('/', cloudinaryRouter);
app.route('/', customRolesRouter);
app.route('/', expensesRouter);
app.route('/', healthRouter);
app.route('/', memberSabbaticalRouter);
app.route('/', membersRouter);
app.route('/', notificationsRouter);
app.route('/', optionsRouter);
app.route('/', preferencesRouter);
app.route('/', serviceRecordsRouter);
app.route('/', servicesRouter);
app.route('/', tabAccessRouter);
app.route('/', themeRouter);
app.route('/', usersRouter);

Deno.serve(app.fetch);