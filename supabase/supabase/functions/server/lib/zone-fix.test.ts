// Tests for the zone number fix, run with `deno test` from this folder.
// They use a small in-memory stand-in for the Supabase client, so nothing
// touches a real database.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { applyZoneNumberFix, checkProposedNumber } from "./zone-fix.ts";

// deno-lint-ignore-file no-explicit-any
function makeDb(members: any[], { auditFails = false, beforeUpdate = null as null | ((db: any) => void) } = {}) {
  const db: any = { members: members.map((m) => ({ ...m })), audit: [] as any[], updates: 0 };
  const client: any = {
    from(table: string) {
      const q: any = { table, filters: [] as any[], op: 'select', patch: null as any, single: false };
      const run = () => {
        if (table === 'activity_log') {
          if (q.op === 'insert') { if (auditFails) return { error: { message: 'boom' } }; db.audit.push(q.patch); return { error: null }; }
          return { data: [], error: null };
        }
        let rows = db.members.filter((r: any) => q.filters.every(([k, kind, v]: any) => (kind === 'eq' ? r[k] === v : v.includes(r[k]))));
        if (q.op === 'update') {
          if (beforeUpdate && db.updates === 0) beforeUpdate(db);
          db.updates++;
          rows = db.members.filter((r: any) => q.filters.every(([k, kind, v]: any) => (kind === 'eq' ? r[k] === v : v.includes(r[k]))));
          rows.forEach((r: any) => Object.assign(r, q.patch));
          return { data: rows.map((r: any) => ({ id: r.id })), error: null };
        }
        if (q.single) return { data: rows[0] ?? null, error: null };
        return { data: rows.map((r: any) => ({ ...r })), error: null };
      };
      const b: any = {
        select() { return b; },
        eq(k: string, v: unknown) { q.filters.push([k, 'eq', v]); return b; },
        in(k: string, v: unknown[]) { q.filters.push([k, 'in', v]); return b; },
        update(p: unknown) { q.op = 'update'; q.patch = p; return b; },
        insert(p: unknown) { q.op = 'insert'; q.patch = p; return b; },
        maybeSingle() { q.single = true; return Promise.resolve(run()); },
        then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
      };
      return b;
    },
  };
  return { db, client };
}


const base = [
  { id: 'm1', first_name: 'Rebecca', last_name: 'Minta', zone: 'M', zone_number: '', status: 'new' },
  { id: 'm2', first_name: 'Kofi', last_name: 'Mensah', zone: 'M', zone_number: 'M12', status: 'active' },
  { id: 'm3', first_name: 'Ama', last_name: 'Owusu', zone: 'A', zone_number: 'A12', status: 'active' },
];
const actor = { id: 'dev1', name: 'Dev One', role: 'dev' };
const good = { memberId: 'm1', proposed: 'M20', expectedCurrent: '', reason: 'Assigned by the register', confirm: 'CHANGE M20' };

Deno.test('a valid change is applied and audited with the actor and reason', async () => {
  const { db, client } = makeDb(base);
  const r = await applyZoneNumberFix(client, actor, good);
  assertEquals(r.status, 200);
  assertEquals(db.members[0].zone_number, 'M20');
  assertEquals(db.audit.length, 1);
  assertEquals(db.audit[0].action, 'admin_fix');
  assertEquals(db.audit[0].user_id, 'dev1');
  assertEquals(db.audit[0].metadata.before, '');
  assertEquals(db.audit[0].metadata.after, 'M20');
  assertEquals(db.audit[0].metadata.reason, 'Assigned by the register');
});

Deno.test('a wrong confirmation phrase changes nothing', async () => {
  const { db, client } = makeDb(base);
  const r = await applyZoneNumberFix(client, actor, { ...good, confirm: 'change m20' });
  assertEquals(r.status, 422);
  assertEquals(db.members[0].zone_number, '');
  assertEquals(db.audit.length, 0);
});

Deno.test('a short reason is refused', async () => {
  const { db, client } = makeDb(base);
  assertEquals((await applyZoneNumberFix(client, actor, { ...good, reason: 'ok' })).status, 422);
  assertEquals(db.audit.length, 0);
});

Deno.test('a stale view is refused with 409', async () => {
  const { db, client } = makeDb(base);
  assertEquals((await applyZoneNumberFix(client, actor, { ...good, expectedCurrent: 'M01' })).status, 409);
  assertEquals(db.members[0].zone_number, '');
});

Deno.test('a number already used in the zone is refused', async () => {
  const { db, client } = makeDb(base);
  assertEquals((await applyZoneNumberFix(client, actor, { ...good, proposed: 'M012', confirm: 'CHANGE M012' })).status, 422);
  assertEquals(db.members[0].zone_number, '');
});

Deno.test('a number for another zone is refused', async () => {
  const { client } = makeDb(base);
  assertEquals((await applyZoneNumberFix(client, actor, { ...good, proposed: 'A20', confirm: 'CHANGE A20' })).status, 422);
});

Deno.test('a change made by someone else during the update is detected', async () => {
  const { db, client } = makeDb(base, { beforeUpdate: (d) => { d.members[0].zone_number = 'M33'; } });
  assertEquals((await applyZoneNumberFix(client, actor, good)).status, 409);
  assertEquals(db.members[0].zone_number, 'M33');
  assertEquals(db.audit.length, 0);
});

Deno.test('if the audit entry cannot be written the change is undone', async () => {
  const { db, client } = makeDb(base, { auditFails: true });
  assertEquals((await applyZoneNumberFix(client, actor, good)).status, 500);
  assertEquals(db.members[0].zone_number, '');
  assertEquals(db.audit.length, 0);
});

Deno.test('an unknown member is a 404', async () => {
  const { client } = makeDb(base);
  assertEquals((await applyZoneNumberFix(client, actor, { ...good, memberId: 'nope' })).status, 404);
});

Deno.test('format rules: letter plus two or more digits, never all zeros', () => {
  const member = { id: 'x', zone: 'A', zone_number: 'A4' };
  const ok = (v: string) => checkProposedNumber(member, v, []).problems.length === 0;
  assert(ok('A12'));
  assert(ok('a105'));
  assert(!ok('A1'));
  assert(!ok('A000'));
  assert(!ok('B12'));
  assert(!ok('A4'));
});
