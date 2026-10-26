// Correct a single member's zone number, with a preview step, an optimistic
// concurrency check and an audit entry. `client` is a Supabase client; it is
// passed in (not imported) so the logic can be tested without Deno.

import { alnum, zoneNumberCore } from "./health-checks.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;

export interface Actor {
  id: string;
  name: string;
  role: string;
}

export interface ZoneFixPreview {
  member: { id: string; name: string; zone: string; zoneNumber: string; status: string };
  proposed: string;
  problems: string[];
  conflicts: { id: string; name: string; zoneNumber: string }[];
  canApply: boolean;
  confirmPhrase: string;
}

export interface Outcome<T> {
  status: number;
  body: T | { error: string; details?: unknown };
}

const STANDARD = /^([A-Z])(\d{2,})$/;
const fullName = (r: Row) => `${r.first_name ?? ''} ${r.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
const clean = (v: unknown) => String(v ?? '').trim().toUpperCase();

export function checkProposedNumber(member: Row, proposedRaw: unknown, zoneMembers: Row[]) {
  const proposed = clean(proposedRaw);
  const problems: string[] = [];
  const match = STANDARD.exec(proposed);

  if (!match) {
    problems.push('Use the zone letter followed by at least two digits, for example A05.');
  } else {
    if (match[1] !== alnum(member.zone)) problems.push(`The number must start with the member's zone letter (${member.zone}).`);
    if (/^0+$/.test(match[2])) problems.push('The number cannot be all zeros.');
  }
  if (proposed && proposed === clean(member.zone_number)) problems.push("This is already the member's zone number.");

  const core = zoneNumberCore(member.zone, proposed);
  const conflicts = !core
    ? []
    : zoneMembers
        .filter((o) => o.id !== member.id && alnum(o.zone) === alnum(member.zone) && zoneNumberCore(o.zone, o.zone_number) === core)
        .map((o) => ({ id: o.id as string, name: fullName(o), zoneNumber: String(o.zone_number ?? '') }));
  if (conflicts.length > 0) problems.push(`Already used by ${conflicts.map((c) => c.name).join(', ')}.`);

  return { proposed, problems, conflicts };
}

async function loadMember(client: Client, memberId: string) {
  const { data, error } = await client
    .from('members')
    .select('id, first_name, last_name, zone, zone_number, status')
    .eq('id', memberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}

async function loadZoneMembers(client: Client, zone: string) {
  const { data, error } = await client.from('members').select('id, first_name, last_name, zone, zone_number').eq('zone', zone);
  if (error) throw new Error(error.message);
  return (data || []) as Row[];
}

export async function previewZoneNumberFix(client: Client, memberId: string, proposedRaw: unknown): Promise<Outcome<ZoneFixPreview>> {
  if (!memberId) return { status: 400, body: { error: 'memberId is required' } };
  const member = await loadMember(client, memberId);
  if (!member) return { status: 404, body: { error: 'Member not found' } };

  const zoneMembers = await loadZoneMembers(client, member.zone);
  const { proposed, problems, conflicts } = checkProposedNumber(member, proposedRaw, zoneMembers);

  return {
    status: 200,
    body: {
      member: { id: member.id, name: fullName(member), zone: member.zone, zoneNumber: String(member.zone_number ?? ''), status: member.status },
      proposed,
      problems,
      conflicts,
      canApply: problems.length === 0,
      confirmPhrase: `CHANGE ${proposed}`,
    },
  };
}

export interface ApplyInput {
  memberId: string;
  proposed: string;
  expectedCurrent: string;
  reason: string;
  confirm: string;
}

export async function applyZoneNumberFix(client: Client, actor: Actor, input: ApplyInput) {
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 5) return { status: 422, body: { error: 'Give a reason (at least 5 characters).' } };

  // Re-check everything now; the preview the person saw may be stale.
  const preview = await previewZoneNumberFix(client, input.memberId, input.proposed);
  if (preview.status !== 200) return preview;
  const p = preview.body as ZoneFixPreview;
  if (!p.canApply) return { status: 422, body: { error: 'This change is not allowed.', details: p.problems } };
  if (String(input.confirm ?? '').trim() !== p.confirmPhrase) {
    return { status: 422, body: { error: `Type "${p.confirmPhrase}" to confirm.` } };
  }
  if (String(input.expectedCurrent ?? '') !== p.member.zoneNumber) {
    return { status: 409, body: { error: 'The member changed since you opened this. Reload and try again.' } };
  }

  // Update only if the number is still what the person saw.
  const now = new Date().toISOString();
  let update = client.from('members').update({ zone_number: p.proposed, updated_at: now }).eq('id', p.member.id);
  update = p.member.zoneNumber === '' ? update.in('zone_number', ['']) : update.eq('zone_number', p.member.zoneNumber);
  const { data: updated, error: updateError } = await update.select('id');
  if (updateError) throw new Error(updateError.message);
  if (!updated || updated.length !== 1) {
    return { status: 409, body: { error: 'The member changed while saving. Nothing was changed. Reload and try again.' } };
  }

  // Audit entry. If it cannot be written, put the old number back rather than
  // leave an unrecorded change.
  const { error: auditError } = await client.from('activity_log').insert({
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: 'admin_fix',
    entity_type: 'member',
    entity_id: p.member.id,
    description: `Zone number for ${p.member.name} changed from ${p.member.zoneNumber || '(none)'} to ${p.proposed} (admin fix)`,
    metadata: { kind: 'zone_number', memberId: p.member.id, before: p.member.zoneNumber, after: p.proposed, reason, source: 'admin-app' },
  });
  if (auditError) {
    await client.from('members').update({ zone_number: p.member.zoneNumber, updated_at: new Date().toISOString() }).eq('id', p.member.id);
    return { status: 500, body: { error: 'Could not record the audit entry, so the change was undone.' } };
  }

  return { status: 200, body: { ok: true, memberId: p.member.id, name: p.member.name, before: p.member.zoneNumber, after: p.proposed } };
}

export async function recentFixes(client: Client, limit = 20) {
  const { data, error } = await client
    .from('activity_log')
    .select('id, user_name, description, metadata, created_at')
    .eq('action', 'admin_fix')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r: Row) => ({
    id: r.id,
    by: r.user_name,
    description: r.description,
    kind: r.metadata?.kind ?? null,
    memberId: r.metadata?.memberId ?? null,
    before: r.metadata?.before ?? null,
    after: r.metadata?.after ?? null,
    reason: r.metadata?.reason ?? null,
    createdAt: r.created_at,
  }));
}
