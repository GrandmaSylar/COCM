import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { duplicateGroups, type DuplicateGroup } from '@cms/admin-core';
import { applyMerge, previewMerge } from '../lib/api';
import type { HealthReport, MergePreview } from '../types';
import { Avatar, Button, Chip, EmptyState, ListRow, Section, TextField, useToast } from '../ui';

const FIELD_LABELS: Record<string, string> = {
  other_names: 'Other names',
  email: 'Email',
  second_phone: 'Second phone',
  gender: 'Gender',
  date_of_birth: 'Date of birth',
  digital_address: 'Digital address',
  notes: 'Notes',
  photo_url: 'Photo',
  baptism_info: 'Baptism details',
  legal_info: 'ID details',
  ministries: 'Ministries',
  first_name: 'First name',
  last_name: 'Last name',
  phone: 'Phone',
  residence_location: 'Residence',
  zone: 'Zone',
  zone_number: 'Zone number',
  status: 'Status',
  join_date: 'Join date',
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(blank)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  if (typeof value === 'object') return 'has details';
  return String(value);
}

function MergePanel({ keepId, dropId, onChanged, onClose }: { keepId: string; dropId: string; onChanged: () => void; onClose: () => void }) {
  const toast = useToast();
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setBusy('preview');
    setError(null);
    try {
      setPreview(await previewMerge(keepId, dropId));
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy('apply');
    setError(null);
    try {
      const result = await applyMerge({
        keepId,
        dropId,
        expectedKeepUpdatedAt: preview.keep.updatedAt,
        expectedDropUpdatedAt: preview.drop.updatedAt,
        fill: preview.fills.map((f) => f.field).filter((f) => !skipped.has(f)),
        reason,
        confirm,
      });
      toast.show({ title: 'Members merged', message: `${result.name} (${result.zoneNumber}) now holds both records.` });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const ready = Boolean(preview?.canApply) && reason.trim().length >= 5 && confirm.trim() === preview?.confirmPhrase;

  if (!preview) {
    return (
      <div className="flex flex-col gap-3">
        <Button label="Review the merge" variant="secondary" loading={busy === 'preview'} onClick={() => void runPreview()} />
        {error ? <p className="t-caption text-danger-text">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="t-body text-ink">
        Keep <strong>{preview.keep.name}</strong> (<span className="font-mono">{preview.keep.zoneNumber}</span>). The record{' '}
        <span className="font-mono">{preview.drop.zoneNumber}</span> will be deleted after everything on it is moved across. A full copy of the deleted record is kept in the activity log.
      </p>

      {preview.warnings.length > 0 ? (
        <ul className="t-caption list-disc space-y-0.5 rounded-md bg-warning-soft py-2.5 pl-8 pr-3 text-warning-text">
          {preview.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <div>
        <p className="t-caption mb-1 font-semibold text-ink">Moves to the kept record</p>
        {preview.references.length > 0 ? (
          <ul className="t-caption text-muted">
            {preview.references.map((r) => (
              <li key={r.label}>
                {r.label}: {r.count}
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-caption text-muted">Nothing else is linked to the duplicate.</p>
        )}
      </div>

      {preview.fills.length > 0 ? (
        <div>
          <p className="t-caption mb-1 font-semibold text-ink">Blank on the kept record, copied from the duplicate</p>
          <div className="flex flex-col gap-1">
            {preview.fills.map((f) => (
              <label key={f.field} className="t-caption flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={!skipped.has(f.field)}
                  onChange={(e) =>
                    setSkipped((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(f.field);
                      else next.add(f.field);
                      return next;
                    })
                  }
                />
                <span>
                  {FIELD_LABELS[f.field] ?? f.field}: {show(f.value)}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {preview.differences.length > 0 ? (
        <div>
          <p className="t-caption mb-1 font-semibold text-ink">Different on each record (the kept record's value stays)</p>
          <ul className="t-caption text-muted">
            {preview.differences.map((d) => (
              <li key={d.field}>
                {FIELD_LABELS[d.field] ?? d.field}: keeping {show(d.keep)}, discarding {show(d.drop)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.canApply ? (
        <>
          <TextField label="Why? (recorded in the activity log)" value={reason} placeholder="e.g. Same person entered twice at registration" onChange={(e) => setReason(e.target.value)} />
          <TextField label={`Type ${preview.confirmPhrase} to confirm`} className="font-mono" value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />
          <Button label="Merge members" variant="danger" loading={busy === 'apply'} disabled={!ready} onClick={() => void apply()} />
        </>
      ) : (
        <ul className="t-caption list-disc space-y-0.5 rounded-md bg-danger-soft py-2.5 pl-8 pr-3 text-danger-text">
          {preview.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error ? <p className="t-caption text-danger-text">{error}</p> : null}
    </div>
  );
}

function GroupRow({ group, onChanged }: { group: DuplicateGroup; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [keepId, setKeepId] = useState(group.members[0].id);
  const [dropId, setDropId] = useState<string | null>(null);
  const keep = group.members.find((m) => m.id === keepId) ?? group.members[0];
  const others = group.members.filter((m) => m.id !== keep.id);

  return (
    <div>
      <ListRow
        leading={<Avatar name={group.members[0].name} />}
        title={group.members[0].name}
        subtitle={<>{group.members.map((m) => m.zoneNumber || '(none)').join(' and ')} · same name and date of birth</>}
        trailing={<Button label={open ? 'Close' : 'Merge'} variant="soft" size="sm" onClick={() => setOpen((v) => !v)} />}
      />
      {open ? (
        <div className="mx-4 mb-4 flex flex-col gap-4 rounded-lg bg-surface-muted p-4">
          <div>
            <p className="t-caption mb-2 font-semibold text-ink">Which record should be kept?</p>
            <div className="flex flex-wrap gap-2">
              {group.members.map((m) => (
                <Chip
                  key={m.id}
                  label={`${m.zoneNumber || '(none)'}${m.phone ? ` · ${m.phone}` : ''}`}
                  selected={m.id === keep.id}
                  onClick={() => {
                    setKeepId(m.id);
                    setDropId(null);
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="t-caption mb-2 font-semibold text-ink">Merge which duplicate into it?</p>
            <div className="flex flex-wrap gap-2">
              {others.map((m) => (
                <Chip key={m.id} label={`${m.zoneNumber || '(none)'}${m.phone ? ` · ${m.phone}` : ''}`} selected={m.id === dropId} onClick={() => setDropId(m.id)} />
              ))}
            </div>
          </div>
          {dropId ? <MergePanel key={`${keep.id}:${dropId}`} keepId={keep.id} dropId={dropId} onChanged={onChanged} onClose={() => setOpen(false)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function MergeDuplicates({ report, onChanged }: { report: HealthReport; onChanged: () => void }) {
  const groups = useMemo(() => duplicateGroups(report), [report]);

  return (
    <Section
      title="Duplicate members to merge"
      footer="Pick the record to keep and the duplicate to remove. Attendance, family links, service roles and expenses move to the kept record, and a full copy of the deleted one is saved in the activity log. Back up first. Each merge needs a reason and a typed confirmation."
    >
      {groups.length > 0
        ? groups.map((g) => <GroupRow key={g.key} group={g} onChanged={onChanged} />)
        : [<EmptyState key="none" icon={CheckCircle2} tone="success" title="No duplicate members found" message="Looks for the same name and date of birth." />]}
    </Section>
  );
}
