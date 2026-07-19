import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken } from "../lib/auth-helpers.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { logActivity, getProfileForLog } from "../lib/activity-helpers.ts";

const router = new Hono();

router.get('/service-setups', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('service_setups')
      .select('*', { count: 'exact' })
      .order('service_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({
      setups: toCamelCase(data),
      total: count || 0,
      page,
      limit
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

router.get('/service-setups/by-date/:date', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const date = c.req.param('date');
    const serviceType = c.req.query('serviceType');

    if (serviceType) {
      const { data: setup, error } = await supabase
        .from('service_setups')
        .select('*')
        .eq('service_date', date)
        .eq('service_type', serviceType)
        .maybeSingle();

      if (error) return c.json({ error: error.message }, 500);
      if (!setup) return c.json({ error: 'No service setup found for this date and type' }, 404);

      return c.json(toCamelCase(setup));
    }

    const { data: setups, error } = await supabase
      .from('service_setups')
      .select('*')
      .eq('service_date', date)
      .order('service_type', { ascending: true });
      
    if (error) return c.json({ error: error.message }, 500);
    if (!setups || setups.length === 0) {
      return c.json({ error: 'No service setups found for this date' }, 404);
    }

    return c.json({ setups: toCamelCase(setups) });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

router.get('/service-setups/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { data, error } = await supabase.from('service_setups').select('*').eq('id', id).maybeSingle();

    if (error) return c.json({ error: error.message }, 500);
    if (!data) return c.json({ error: 'Service setup not found' }, 404);

    return c.json(toCamelCase(data));
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

router.post('/service-setups', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const profile = await getProfileForLog(user.id);
    const body = await c.req.json();

    if (!body.serviceDate || !body.serviceType) {
      return c.json({ error: 'serviceDate and serviceType are required' }, 400);
    }

    const payload: any = toSnakeCase(body);
    payload.created_by = user.id;

    const { data: inserted, error } = await supabase
      .from('service_setups')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'A setup for this date and service type already exists' }, 409);
      }
      return c.json({ error: error.message }, 500);
    }

    await logActivity({
      userId: user.id,
      userName: profile.name || 'Unknown',
      userRole: profile.role || 'unknown',
      action: 'create',
      entityType: 'service_setup',
      entityId: inserted.id,
      description: `Created service setup for ${body.serviceDate} (${body.serviceType})`
    });

    return c.json(toCamelCase(inserted), 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

router.put('/service-setups/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const profile = await getProfileForLog(user.id);
    const id = c.req.param('id');
    const body = await c.req.json();

    const payload: any = toSnakeCase(body);
    payload.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('service_setups')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'A setup for this date and service type already exists' }, 409);
      }
      return c.json({ error: error.message }, 500);
    }
    if (!updated) {
      return c.json({ error: 'Service setup not found' }, 404);
    }

    await logActivity({
      userId: user.id,
      userName: profile.name || 'Unknown',
      userRole: profile.role || 'unknown',
      action: 'update',
      entityType: 'service_setup',
      entityId: id,
      description: `Updated service setup for ${updated.service_date} (${updated.service_type})`
    });

    return c.json(toCamelCase(updated));
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

router.delete('/service-setups/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const profile = await getProfileForLog(user.id);
    const id = c.req.param('id');

    const { data: existing, error: fetchError } = await supabase
      .from('service_setups')
      .select('id, service_date, service_type')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) return c.json({ error: fetchError.message }, 500);
    if (!existing) return c.json({ error: 'Service setup not found' }, 404);

    const { error: deleteError } = await supabase
      .from('service_setups')
      .delete()
      .eq('id', id);

    if (deleteError) return c.json({ error: deleteError.message }, 500);

    await logActivity({
      userId: user.id,
      userName: profile.name || 'Unknown',
      userRole: profile.role || 'unknown',
      action: 'delete',
      entityType: 'service_setup',
      entityId: id,
      description: `Deleted service setup for ${existing.service_date} (${existing.service_type})`
    });

    return c.json({ deleted: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default router;
