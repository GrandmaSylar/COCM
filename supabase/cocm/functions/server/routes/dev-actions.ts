import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { requireDev } from "../lib/dev-guard.ts";
import { applyMemberMerge, previewMemberMerge } from "../lib/member-merge.ts";
import { applyZoneNumberFix, previewZoneNumberFix, recentFixes } from "../lib/zone-fix.ts";

const router = new Hono();

// Corrections for the developer admin app (apps/admin). Every route is
// restricted to active, approved `dev` accounts. Changes are previewed first,
// confirmed by typing a phrase, and recorded in activity_log.

router.post('/dev/actions/zone-number/preview', async (c) => {
  const guard = await requireDev(c);
  if ('error' in guard) return guard.error;
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await previewZoneNumberFix(supabase, String(body.memberId ?? ''), body.proposed);
    return c.json(result.body, result.status as 200);
  } catch (e) {
    console.error('zone-number preview failed:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.post('/dev/actions/zone-number/apply', async (c) => {
  const guard = await requireDev(c);
  if ('error' in guard) return guard.error;
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await applyZoneNumberFix(supabase, guard.actor, {
      memberId: String(body.memberId ?? ''),
      proposed: String(body.proposed ?? ''),
      expectedCurrent: String(body.expectedCurrent ?? ''),
      reason: String(body.reason ?? ''),
      confirm: String(body.confirm ?? ''),
    });
    return c.json(result.body, result.status as 200);
  } catch (e) {
    console.error('zone-number apply failed:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.post('/dev/actions/member-merge/preview', async (c) => {
  const guard = await requireDev(c);
  if ('error' in guard) return guard.error;
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await previewMemberMerge(supabase, String(body.keepId ?? ''), String(body.dropId ?? ''));
    return c.json(result.body, result.status as 200);
  } catch (e) {
    console.error('member-merge preview failed:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.post('/dev/actions/member-merge/apply', async (c) => {
  const guard = await requireDev(c);
  if ('error' in guard) return guard.error;
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await applyMemberMerge(supabase, guard.actor, {
      keepId: String(body.keepId ?? ''),
      dropId: String(body.dropId ?? ''),
      expectedKeepUpdatedAt: body.expectedKeepUpdatedAt ?? null,
      expectedDropUpdatedAt: body.expectedDropUpdatedAt ?? null,
      fill: Array.isArray(body.fill) ? body.fill.map(String) : undefined,
      reason: String(body.reason ?? ''),
      confirm: String(body.confirm ?? ''),
    });
    return c.json(result.body, result.status as 200);
  } catch (e) {
    console.error('member-merge apply failed:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.get('/dev/actions/recent', async (c) => {
  const guard = await requireDev(c);
  if ('error' in guard) return guard.error;
  try {
    return c.json(await recentFixes(supabase));
  } catch (e) {
    console.error('recent fixes failed:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
