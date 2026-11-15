// Tests for the member merge, run with `deno test` from this folder. A small in-memory
// stand-in replaces the Supabase client; the SQL function itself is not exercised here.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { applyMemberMerge, previewMemberMerge } from "./member-merge.ts";

// deno-lint-ignore-file no-explicit-any
function makeClient(members: any[], refs: Record<string, number> = {}, rpcResult: any = { data: { moved: { attendance_entries: 3 } }, error: null }) {
  const calls: any[] = [];
  const client: any = {
    from(table: string) {
      const q: any = { filters: [] as any[], head: false };
      const b: any = {
        select(_c: string, opts?: any) { q.head = !!opts?.head; return b; },
        eq(k: string, v: unknown) { q.filters.push([k, v]); return b; },
        maybeSingle() {
          const row = members.find((m) => q.filters.every(([k, v]: any) => m[k] === v));
          return Promise.resolve({ data: row ?? null, error: null });
        },
        then(res: any, rej: any) {
          // Head count on a reference table: refs is keyed "table.column:id".
          const [col, id] = q.filters[0];
          return Promise.resolve({ count: refs[`${table}.${col}:${id}`] ?? 0, error: null }).then(res, rej);
        },
      };
      return b;
    },
    rpc(name: string, args: any) { calls.push({ name, args }); return Promise.resolve(rpcResult); },
  };
  return { client, calls };
}

const keep = {
  id: 'k', first_name: 'Christiana', last_name: 'Lumoh', zone: 'K', zone_number: 'K067', status: 'active',
  phone: '0241', email: null, date_of_birth: '1980-01-01', notes: 'Keeper notes', ministries: [],
  updated_at: '2026-01-01T00:00:00+00:00',
};
const drop = {
  id: 'd', first_name: 'Christiana', last_name: 'Lumoh', zone: 'K', zone_number: 'K67', status: 'active',
  phone: '0241', email: 'c@example.com', date_of_birth: '1980-01-01', notes: 'Other notes', ministries: ['Choir'],
  updated_at: '2026-02-02T00:00:00+00:00',
};
const actor = { id: 'dev1', name: 'Dev One', role: 'dev' };
const good = {
  keepId: 'k', dropId: 'd', expectedKeepUpdatedAt: keep.updated_at, expectedDropUpdatedAt: drop.updated_at,
  reason: 'Same person entered twice', confirm: 'MERGE K67 INTO K067',
};

Deno.test('preview lists blanks to fill, conflicts that stay, and what will move', async () => {
  const { client } = makeClient([keep, drop], { 'attendance_entries.member_id:d': 4, 'family_members.member_id:k': 9 });
  const r: any = await previewMemberMerge(client, 'k', 'd');
  assertEquals(r.status, 200);
  assertEquals(r.body.fills.map((f: any) => f.field).sort(), ['email', 'ministries']);
  assertEquals(r.body.differences.map((d: any) => d.field).includes('notes'), true);
  assertEquals(r.body.differences.map((d: any) => d.field).includes('zone_number'), true);
  assertEquals(r.body.references, [{ label: 'Attendance ticks', count: 4 }]); // only the duplicate's references
  assertEquals(r.body.confirmPhrase, 'MERGE K67 INTO K067');
  assertEquals(r.body.warnings.length, 0);
  assert(r.body.canApply);
});

Deno.test('merging a member into itself or a missing member is refused', async () => {
  const { client } = makeClient([keep, drop]);
  assertEquals((await previewMemberMerge(client, 'k', 'k')).status, 422);
  assertEquals((await previewMemberMerge(client, 'k', 'zzz')).status, 404);
  assertEquals((await previewMemberMerge(client, '', 'd')).status, 400);
});

Deno.test('different zones or names produce warnings, not a block', async () => {
  const { client } = makeClient([keep, { ...drop, zone: 'A', first_name: 'Christie' }]);
  const r: any = await previewMemberMerge(client, 'k', 'd');
  assertEquals(r.body.warnings.length, 2);
  assert(r.body.canApply);
});

Deno.test('a valid merge calls the transaction once with the actor, reason and blanks to fill', async () => {
  const { client, calls } = makeClient([keep, drop]);
  const r: any = await applyMemberMerge(client, actor, good);
  assertEquals(r.status, 200);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, 'merge_members_txn');
  assertEquals(calls[0].args.keep_id, 'k');
  assertEquals(calls[0].args.drop_id, 'd');
  assertEquals(calls[0].args.actor_id, 'dev1');
  assertEquals(calls[0].args.merge_reason, 'Same person entered twice');
  assertEquals(calls[0].args.field_patch, { email: 'c@example.com', ministries: ['Choir'] });
  assertEquals(calls[0].args.expected_drop_updated, drop.updated_at);
});

Deno.test('only the fields the person left ticked are copied', async () => {
  const { client, calls } = makeClient([keep, drop]);
  await applyMemberMerge(client, actor, { ...good, fill: ['email'] });
  assertEquals(calls[0].args.field_patch, { email: 'c@example.com' });
  await applyMemberMerge(client, actor, { ...good, fill: [] });
  assertEquals(calls[1].args.field_patch, {});
});

Deno.test('a wrong phrase, short reason or stale view never reaches the database', async () => {
  const { client, calls } = makeClient([keep, drop]);
  assertEquals((await applyMemberMerge(client, actor, { ...good, confirm: 'merge k67 into k067' })).status, 422);
  assertEquals((await applyMemberMerge(client, actor, { ...good, reason: 'dup' })).status, 422);
  assertEquals((await applyMemberMerge(client, actor, { ...good, expectedDropUpdatedAt: '2000-01-01T00:00:00+00:00' })).status, 409);
  assertEquals((await applyMemberMerge(client, actor, { ...good, expectedKeepUpdatedAt: null })).status, 409);
  assertEquals(calls.length, 0);
});

Deno.test('a record changed during the save is reported as a conflict', async () => {
  const { client } = makeClient([keep, drop], {}, { data: null, error: { message: 'STALE: a record changed since it was previewed' } });
  assertEquals((await applyMemberMerge(client, actor, good)).status, 409);
});

Deno.test('a database failure is reported and says nothing changed', async () => {
  const { client } = makeClient([keep, drop], {}, { data: null, error: { message: 'violates foreign key' } });
  const r: any = await applyMemberMerge(client, actor, good);
  assertEquals(r.status, 500);
  assert(String(r.body.error).includes('nothing was changed'));
});
