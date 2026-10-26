import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken } from "../lib/auth-helpers.ts";
import { loadHealthData, analyze, summarize } from "../lib/health-checks.ts";

const router = new Hono();

// Read-only data health report for the developer admin app (apps/admin).
// Only an active, approved account with the `dev` role may call it.
router.get('/dev/health', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active, approval_status')
      .eq('id', user.id)
      .single();
    if (!profile || profile.role !== 'dev' || profile.is_active === false || profile.approval_status !== 'approved') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const started = Date.now();
    const { data, counts, loadErrors } = await loadHealthData(supabase);
    const checks = analyze(data);

    const tally = { error: 0, warn: 0, info: 0, ok: 0 };
    for (const check of checks) tally[check.severity]++;

    return c.json({
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      summary: tally,
      counts,
      checks,
      loadErrors,
      ...summarize(data),
    });
  } catch (e) {
    console.error('dev/health failed:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
