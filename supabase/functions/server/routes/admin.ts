import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken } from "../lib/auth-helpers.ts";
import { toCamelCase } from "../lib/transform.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";

const admin = new Hono();

// Helper: verify dev role
async function requireDev(c: any): Promise<{ user: any; prof: any } | null> {
  const user = await getUserFromToken(c.req.raw);
  if (!user) { c.status(401); return null; }
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (prof?.role !== 'dev') { c.status(403); return null; }
  return { user, prof };
}

// ============================================================================
// NOTIFICATION CONFIG
// ============================================================================

admin.get("/admin/notification-config", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const { data, error } = await supabase
      .from("notification_type_config")
      .select("*")
      .order("type");

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

admin.put("/admin/notification-config/:type", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const type = c.req.param("type");
    const body = await c.req.json();

    const { data, error } = await supabase
      .from("notification_type_config")
      .upsert(
        { type, ...body, updated_at: new Date().toISOString() },
        { onConflict: "type" }
      )
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// ACTIVITY LOG CONFIG
// ============================================================================

admin.get("/admin/activity-log-config", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const { data, error } = await supabase
      .from("activity_log_config")
      .select("*")
      .order("action_type");

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

admin.put("/admin/activity-log-config/:action_type/:entity_type", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const actionType = c.req.param("action_type");
    const entityType = c.req.param("entity_type");
    const body = await c.req.json();

    const { data, error } = await supabase
      .from("activity_log_config")
      .upsert(
        {
          action_type: actionType,
          entity_type: entityType,
          ...body,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "action_type,entity_type" }
      )
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// SYSTEM DROPDOWN OPTIONS (admin management)
// ============================================================================

admin.get("/admin/options", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const { data, error } = await supabase
      .from("system_dropdown_options")
      .select("*")
      .order("category")
      .order("sort_order");

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

admin.post("/admin/options", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const { data, error } = await supabase
      .from("system_dropdown_options")
      .insert({ ...body, created_by: user.id })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data), 201);
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

admin.put("/admin/options/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const body = await c.req.json();

    const { data, error } = await supabase
      .from("system_dropdown_options")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

admin.delete("/admin/options/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const { error } = await supabase
      .from("system_dropdown_options")
      .delete()
      .eq("id", id);

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default admin;
