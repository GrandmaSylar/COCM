import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken } from "../lib/auth-helpers.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { logActivity, getProfileForLog } from "../lib/activity-helpers.ts";

const router = new Hono();

// Get all zones
router.get("/zones", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: zones, error } = await supabase
      .from('zones')
      .select('*, leader:members!leader_id(id, first_name, last_name, other_names)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching zones:', error);
      return c.json({ error: 'Failed to fetch zones' }, 500);
    }

    const transformed = [];
    for (const zone of zones || []) {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('zone_id', zone.id);

      transformed.push({
        ...zone,
        member_count: count || 0
      });
    }

    return c.json(toCamelCase(transformed));
  } catch (error) {
    console.error('Get zones error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create zone
router.post("/zones", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const dbData = toSnakeCase(body) as Record<string, any>;

    const { data: zone, error } = await supabase
      .from('zones')
      .insert(dbData)
      .select('*, leader:members!leader_id(id, first_name, last_name, other_names)')
      .single();

    if (error) {
      console.error('Error creating zone:', error);
      return c.json({ error: 'Failed to create zone' }, 500);
    }

    // Log Activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'create', entityType: 'zone', entityId: zone.id,
      description: `Created new zone: ${zone.name}`
    });

    return c.json(toCamelCase(zone), 201);
  } catch (error) {
    console.error('Create zone error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update zone
router.put("/zones/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const body = await c.req.json();
    const dbData = toSnakeCase(body) as Record<string, any>;

    // Filter properties to prevent updating metadata fields directly
    const allowed = ['name', 'description', 'leader_id'];
    const updatePayload: Record<string, any> = {};
    for (const key of allowed) {
      if (dbData[key] !== undefined) {
        updatePayload[key] = dbData[key];
      }
    }

    const { data: zone, error } = await supabase
      .from('zones')
      .update(updatePayload)
      .eq('id', id)
      .select('*, leader:members!leader_id(id, first_name, last_name, other_names)')
      .single();

    if (error) {
      console.error('Error updating zone:', error);
      return c.json({ error: 'Failed to update zone' }, 500);
    }

    // Log Activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'update', entityType: 'zone', entityId: id,
      description: `Updated zone: ${zone.name}`
    });

    return c.json(toCamelCase(zone));
  } catch (error) {
    console.error('Update zone error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete zone
router.delete("/zones/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');

    // Get zone name for logging
    const { data: existingZone } = await supabase
      .from('zones')
      .select('name')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('zones')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting zone:', error);
      return c.json({ error: 'Failed to delete zone' }, 500);
    }

    // Log Activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'delete', entityType: 'zone', entityId: id,
      description: `Deleted zone: ${existingZone?.name || id}`
    });

    return c.json({ message: 'Zone deleted successfully' });
  } catch (error) {
    console.error('Delete zone error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get zone attendance
router.get("/zones/:id/attendance", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { data: attendance, error } = await supabase
      .from('zone_attendance')
      .select('*')
      .eq('zone_id', id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching zone attendance:', error);
      return c.json({ error: 'Failed to fetch zone attendance' }, 500);
    }

    return c.json(toCamelCase(attendance));
  } catch (error) {
    console.error('Get zone attendance error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Record zone attendance
router.post("/zones/:id/attendance", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const body = await c.req.json();
    const dbData = toSnakeCase(body) as Record<string, any>;

    const { data: attendance, error } = await supabase
      .from('zone_attendance')
      .insert({
        ...dbData,
        zone_id: id,
        recorded_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording zone attendance:', error);
      return c.json({ error: 'Failed to record zone attendance' }, 500);
    }

    // Log Activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'record_attendance', entityType: 'zone_attendance', entityId: attendance.id,
      description: `Recorded attendance for zone ${id} on ${attendance.date}`
    });

    return c.json(toCamelCase(attendance), 201);
  } catch (error) {
    console.error('Record zone attendance error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get members of a zone
router.get("/zones/:id/members", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { data: members, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, other_names, email, phone, status')
      .eq('zone_id', id)
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching zone members:', error);
      return c.json({ error: 'Failed to fetch zone members' }, 500);
    }

    return c.json(toCamelCase(members));
  } catch (error) {
    console.error('Get zone members error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
