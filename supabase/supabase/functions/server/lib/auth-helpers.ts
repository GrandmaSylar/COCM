import { supabase } from "./supabase.ts";
import { SYSTEM_ROLES } from "./types.ts";

export async function getUserFromToken(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }
  
  const token = authHeader.replace("Bearer ", "");
  
  // Guard: If the token is a new Supabase API key (not a JWT), 
  // it means this is an unauthenticated/anon request fallback.
  if (token.startsWith("sb_")) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  return user;
}

export async function checkPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile) {
    return false;
  }

  if (profile.role === "dev") {
    return true;
  }

  if (profile.role === "admin") {
    if (
      [
        "grant_permissions",
        "manage_giving_types",
        "manage_users",
        "manage_settings",
        "manage_members",
      ].includes(permission)
    ) {
      return true;
    }
  }

  if (!SYSTEM_ROLES.includes(profile.role as (typeof SYSTEM_ROLES)[number])) {
    const { data: customRole } = await supabase
      .from("custom_roles")
      .select("permissions")
      .eq("name", profile.role)
      .maybeSingle();

    if (
      customRole &&
      Array.isArray(customRole.permissions) &&
      customRole.permissions.includes(permission)
    ) {
      return true;
    }
  }

  const { data: tempPermissions } = await supabase
    .from("temporary_permissions")
    .select("*")
    .eq("user_id", userId)
    .eq("permission", permission)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (tempPermissions) {
    return true;
  }

  return false;
}
