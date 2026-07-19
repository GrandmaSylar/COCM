import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken } from "../lib/auth-helpers.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { logActivity, getProfileForLog } from "../lib/activity-helpers.ts";

const router = new Hono();

// Get all ministries
router.get("/ministries", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: ministries, error } = await supabase
      .from('ministries')
      .select('*, leader:members(id, first_name, last_name, other_names)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching ministries:', error);
      return c.json({ error: 'Failed to fetch ministries' }, 500);
    }

    // Fetch member count for each ministry
    const transformed = [];
    for (const min of ministries || []) {
      const { count } = await supabase
        .from('ministry_members')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', min.id);

      transformed.push({
        ...min,
        member_count: count || 0
      });
    }

    return c.json(toCamelCase(transformed));
  } catch (error) {
    console.error('Get ministries error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create ministry
router.post("/ministries", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const dbData = toSnakeCase(body) as Record<string, any>;

    const { data: ministry, error } = await supabase
      .from('ministries')
      .insert(dbData)
      .select('*, leader:members(id, first_name, last_name, other_names)')
      .single();

    if (error) {
      console.error('Error creating ministry:', error);
      return c.json({ error: 'Failed to create ministry' }, 500);
    }

    // Log Activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'create', entityType: 'ministry', entityId: ministry.id,
      description: `Created new ministry: ${ministry.name}`
    });

    return c.json(toCamelCase({ ...ministry, member_count: 0 }), 201);
  } catch (error) {
    console.error('Create ministry error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update ministry
router.put("/ministries/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const body = await c.req.json();
    const dbData = toSnakeCase(body) as Record<string, any>;

    const allowed = ['name', 'description', 'color', 'icon', 'leader_id', 'next_event_date', 'next_event_name'];
    const updatePayload: Record<string, any> = {};
    for (const key of allowed) {
      if (dbData[key] !== undefined) {
        updatePayload[key] = dbData[key];
      }
    }

    const { data: ministry, error } = await supabase
      .from('ministries')
      .update(updatePayload)
      .eq('id', id)
      .select('*, leader:members(id, first_name, last_name, other_names)')
      .single();

    if (error) {
      console.error('Error updating ministry:', error);
      return c.json({ error: 'Failed to update ministry' }, 500);
    }

    const { count } = await supabase
      .from('ministry_members')
      .select('*', { count: 'exact', head: true })
      .eq('ministry_id', id);

    // Log Activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'update', entityType: 'ministry', entityId: id,
      description: `Updated ministry: ${ministry.name}`
    });

    return c.json(toCamelCase({ ...ministry, member_count: count || 0 }));
  } catch (error) {
    console.error('Update ministry error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete ministry
router.delete("/ministries/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');

    const { data: existingMinistry } = await supabase
      .from('ministries')
      .select('name')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('ministries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting ministry:', error);
      return c.json({ error: 'Failed to delete ministry' }, 500);
    }

    // Log Activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'delete', entityType: 'ministry', entityId: id,
      description: `Deleted ministry: ${existingMinistry?.name || id}`
    });

    return c.json({ message: 'Ministry deleted successfully' });
  } catch (error) {
    console.error('Delete ministry error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get members of a ministry
router.get("/ministries/:id/members", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { data: members, error } = await supabase
      .from('ministry_members')
      .select('*, member:members(*)')
      .eq('ministry_id', id);

    if (error) {
      console.error('Error fetching ministry members:', error);
      return c.json({ error: 'Failed to fetch ministry members' }, 500);
    }

    return c.json(toCamelCase(members));
  } catch (error) {
    console.error('Get ministry members error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add member to ministry
router.post("/ministries/:id/members", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const body = await c.req.json();
    const dbData = toSnakeCase(body) as Record<string, any>;

    const { data: member, error } = await supabase
      .from('ministry_members')
      .insert({
        ...dbData,
        ministry_id: id
      })
      .select('*, member:members(id, first_name, last_name, other_names)')
      .single();

    if (error) {
      console.error('Error adding member to ministry:', error);
      return c.json({ error: 'Failed to add member to ministry' }, 500);
    }

    return c.json(toCamelCase(member), 201);
  } catch (error) {
    console.error('Add ministry member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Remove member from ministry
router.delete("/ministries/:id/members/:memberId", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const memberId = c.req.param('memberId');

    const { error } = await supabase
      .from('ministry_members')
      .delete()
      .eq('ministry_id', id)
      .eq('member_id', memberId);

    if (error) {
      console.error('Error removing member from ministry:', error);
      return c.json({ error: 'Failed to remove member from ministry' }, 500);
    }

    return c.json({ message: 'Member removed from ministry successfully' });
  } catch (error) {
    console.error('Remove ministry member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
