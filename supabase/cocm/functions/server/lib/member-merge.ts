// Merge a duplicate member into the one being kept: preview what would move and
// which blank fields would be filled, then apply it in one database transaction
// (the `merge_members_txn` function) which also writes the audit entry. `client`
// is a Supabase client, passed in so the logic can be tested without Deno.

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;

export interface Actor {
  id: string;
  name: string;
  role: string;
}

/** Fields that can be copied from the duplicate when the kept member has them blank. */
export const FILLABLE_FIELDS = [
  'other_names',
  'email',
  'second_phone',
  'gender',
  'date_of_birth',
  'digital_address',
  'notes',
  'photo_url',
  'baptism_info',
  'legal_info',
  'ministries',
] as const;
export type FillableField = (typeof FILLABLE_FIELDS)[number];

/** Fields where the kept member's value is always the one that stays. */
const KEPT_FIELDS = ['first_name', 'last_name', 'phone', 'residence_location', 'zone', 'zone_number', 'status', 'join_date'] as const;

/** Everything in the database that points at a member, so the preview can say what will move. */
const REFERENCES: { label: string; table: string; column: string }[] = [
  { label: 'Attendance ticks', table: 'attendance_entries', column: 'member_id' },
  { label: 'Absence records', table: 'absentee_records', column: 'member_id' },
  { label: 'Status history', table: 'member_status_log', column: 'member_id' },
  { label: 'Family members listed', table: 'family_members', column: 'member_id' },
  { label: 'Listed as a relative of others', table: 'family_members', column: 'linked_member_id' },
  { label: "Parent of children's records", table: 'children_member_parents', column: 'linked_member_id' },
  { label: 'Service setups as MC', table: 'service_setups', column: 'mc_member_id' },
  { label: 'Service setups as preacher', table: 'service_setups', column: 'preacher_member_id' },
  { label: 'Visitor conversions', table: 'visitors', column: 'converted_member_id' },
  { label: 'Child conversions', table: 'children_members', column: 'converted_member_id' },
  { label: 'Expenses requested', table: 'expense_records', column: 'requested_by_id' },
  { label: 'Expenses recommended', table: 'expense_records', column: 'recommended_by_id' },
  { label: 'Expenses approved', table: 'expense_records', column: 'approved_by_id' },
  { label: 'Requisitions requested', table: 'expense_requisitions', column: 'requested_by' },
  { label: 'Requisitions recommended', table: 'expense_requisitions', column: 'recommended_by' },
  { label: 'Requisitions approved', table: 'expense_requisitions', column: 'approved_by' },
];

export interface MemberSummary {
  id: string;
  name: string;
  zone: string;
  zoneNumber: string;
  status: string;
  phone: string;
  dateOfBirth: string | null;
  joinDate: string | null;
  updatedAt: string | null;
}

export interface MergePreview {
  keep: MemberSummary;
  drop: MemberSummary;
  /** Blank on the kept member, present on the duplicate: copied over unless unticked. */
  fills: { field: FillableField; value: unknown }[];
  /** Present on both and different: the kept member's value stays. */
  differences: { field: string; keep: unknown; drop: unknown }[];
  /** What will be re-pointed from the duplicate to the kept member. */
  references: { label: string; count: number }[];
  problems: string[];
  warnings: string[];
  canApply: boolean;
  confirmPhrase: string;
}

export interface Outcome<T> {
  status: number;
  body: T | { error: string; details?: unknown };
}

const fullName = (r: Row) => `${r.first_name ?? ''} ${r.last_name ?? ''}`.replace(/\s+/g, ' ').trim();

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function summary(r: Row): MemberSummary {
  return {
    id: r.id,
    name: fullName(r),
    zone: r.zone,
    zoneNumber: String(r.zone_number ?? ''),
    status: r.status,
    phone: String(r.phone ?? ''),
    dateOfBirth: r.date_of_birth ?? null,
    joinDate: r.join_date ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

async function loadMember(client: Client, id: string) {
  const { data, error } = await client.from('members').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}

async function countReferences(client: Client, memberId: string) {
  const out: { label: string; count: number }[] = [];
  for (const ref of REFERENCES) {
    const { count, error } = await client.from(ref.table).select('id', { count: 'exact', head: true }).eq(ref.column, memberId);
    if (error) throw new Error(`${ref.table}: ${error.message}`);
    out.push({ label: ref.label, count: count ?? 0 });
  }
  return out;
}

export async function previewMemberMerge(client: Client, keepId: string, dropId: string): Promise<Outcome<MergePreview>> {
  if (!keepId || !dropId) return { status: 400, body: { error: 'keepId and dropId are required' } };
  if (keepId === dropId) return { status: 422, body: { error: 'Choose two different members.' } };

  const [keep, drop] = await Promise.all([loadMember(client, keepId), loadMember(client, dropId)]);
  if (!keep) return { status: 404, body: { error: 'The member to keep was not found' } };
  if (!drop) return { status: 404, body: { error: 'The duplicate was not found' } };

  const fills: MergePreview['fills'] = [];
  const differences: MergePreview['differences'] = [];
  for (const field of FILLABLE_FIELDS) {
    if (isBlank(keep[field]) && !isBlank(drop[field])) fills.push({ field, value: drop[field] });
    else if (!isBlank(keep[field]) && !isBlank(drop[field]) && !same(keep[field], drop[field])) {
      differences.push({ field, keep: keep[field], drop: drop[field] });
    }
  }
  for (const field of KEPT_FIELDS) {
    if (!same(keep[field], drop[field])) differences.push({ field, keep: keep[field], drop: drop[field] });
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  if (keep.zone !== drop.zone) warnings.push(`They are in different zones (${keep.zone} and ${drop.zone}). Check these are really the same person.`);
  const nameKeep = `${keep.first_name}|${keep.last_name}`.toLowerCase();
  const nameDrop = `${drop.first_name}|${drop.last_name}`.toLowerCase();
  if (nameKeep !== nameDrop) warnings.push('The names are not identical. Check these are really the same person.');
  if (keep.date_of_birth && drop.date_of_birth && keep.date_of_birth !== drop.date_of_birth) {
    warnings.push('The dates of birth are different.');
  }

  const references = (await countReferences(client, dropId)).filter((r) => r.count > 0);

  return {
    status: 200,
    body: {
      keep: summary(keep),
      drop: summary(drop),
      fills,
      differences,
      references,
      problems,
      warnings,
      canApply: problems.length === 0,
      confirmPhrase: `MERGE ${String(drop.zone_number ?? '').trim()} INTO ${String(keep.zone_number ?? '').trim()}`,
    },
  };
}

export interface MergeInput {
  keepId: string;
  dropId: string;
  /** `updated_at` of each record as the person saw it; a mismatch means someone changed it since. */
  expectedKeepUpdatedAt: string | null;
  expectedDropUpdatedAt: string | null;
  /** Fields to copy from the duplicate. Defaults to every blank the preview offered. */
  fill?: string[];
  reason: string;
  confirm: string;
}

export async function applyMemberMerge(client: Client, actor: Actor, input: MergeInput) {
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 5) return { status: 422, body: { error: 'Give a reason (at least 5 characters).' } };

  // Re-check everything now; the preview the person saw may be stale.
  const preview = await previewMemberMerge(client, input.keepId, input.dropId);
  if (preview.status !== 200) return preview;
  const p = preview.body as MergePreview;
  if (!p.canApply) return { status: 422, body: { error: 'This merge is not allowed.', details: p.problems } };
  if (String(input.confirm ?? '').trim() !== p.confirmPhrase) {
    return { status: 422, body: { error: `Type "${p.confirmPhrase}" to confirm.` } };
  }
  if ((input.expectedKeepUpdatedAt ?? null) !== p.keep.updatedAt || (input.expectedDropUpdatedAt ?? null) !== p.drop.updatedAt) {
    return { status: 409, body: { error: 'One of the records changed since you opened this. Reload and try again.' } };
  }

  const wanted = input.fill ? new Set(input.fill.map(String)) : null;
  const patch: Record<string, unknown> = {};
  for (const f of p.fills) {
    if (!wanted || wanted.has(f.field)) patch[f.field] = f.value;
  }

  const { data, error } = await client.rpc('merge_members_txn', {
    keep_id: p.keep.id,
    drop_id: p.drop.id,
    field_patch: patch,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    merge_reason: reason,
    expected_keep_updated: p.keep.updatedAt,
    expected_drop_updated: p.drop.updatedAt,
  });
  if (error) {
    if (String(error.message).includes('STALE')) {
      return { status: 409, body: { error: 'One of the records changed while saving. Nothing was changed. Reload and try again.' } };
    }
    console.error('merge_members_txn failed:', error.message);
    return { status: 500, body: { error: 'The merge failed and nothing was changed.', details: error.message } };
  }

  return {
    status: 200,
    body: { ok: true, keptId: p.keep.id, deletedId: p.drop.id, name: p.keep.name, zoneNumber: p.keep.zoneNumber, moved: data?.moved ?? {} },
  };
}
