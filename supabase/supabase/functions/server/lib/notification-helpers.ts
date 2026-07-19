import { supabase } from "../lib/supabase.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";

// ============================================================================
export async function createNotification(opts: {
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
      
      const allowedRoles: string[] = config.allowed_roles || [];
      const allowedUsers: string[] = config.allowed_user_ids || [];

      // If either list has entries, restrict by them. If both empty, allow everyone.
      if (allowedRoles.length > 0 || allowedUsers.length > 0) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', opts.userId).maybeSingle();
        const userRole = profile?.role || '';
        
        const roleAllowed = allowedRoles.includes(userRole);
        const userAllowed = allowedUsers.includes(opts.userId);
        
        if (!roleAllowed && !userAllowed) return; // user not in audience
      }
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

export async function notifyTabUsers(tab: string, opts: {
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