import { supabase } from "../lib/supabase.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";

// ============================================================================
export async function logActivity(opts: {
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
export async function getProfileForLog(userId: string) {
  const { data } = await supabase.from('profiles').select('name, role').eq('id', userId).single();
  return data || { name: 'Unknown', role: 'unknown' };
}

// ============================================================================