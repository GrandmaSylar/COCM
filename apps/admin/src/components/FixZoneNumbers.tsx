import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { applyZoneFix, previewZoneFix } from '../lib/api';
import { zoneFixCandidates, type ZoneFixCandidate } from '@cms/admin-core';
import type { HealthReport, ZoneFixPreview } from '../types';
import { Avatar, Button, EmptyState, ListRow, Section, TextField, useToast } from '../ui';

function FixPanel({ candidate, onChanged, onClose }: { candidate: ZoneFixCandidate; onChanged: () => void; onClose: () => void }) {
  const toast = useToast();
  const [proposed, setProposed] = useState('');
  const [preview, setPreview] = useState<ZoneFixPreview | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setBusy('preview');
    setError(null);
    setConfirm('');
    try {
      setPreview(await previewZoneFix(candidate.id, proposed));
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
      const result = await applyZoneFix({
        memberId: candidate.id,
        proposed: preview.proposed,
        expectedCurrent: preview.member.zoneNumber,
        reason,
        confirm,
      });
      toast.show({ title: 'Zone number updated', message: `${result.name}: ${result.before || '(none)'} → ${result.after}` });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const ready = Boolean(preview?.canApply) && reason.trim().length >= 5 && confirm.trim() === preview?.confirmPhrase;

  return (
    <div className="mx-4 mb-4 flex flex-col gap-4 rounded-lg bg-surface-muted p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="New zone number"
            placeholder="e.g. A12"
            className="font-mono"
            value={proposed}
            autoComplete="off"
            onChange={(e) => {
              setProposed(e.target.value);
              setPreview(null);
              setError(null);
            }}
          />
        </div>
        <Button label="Preview" variant="secondary" loading={busy === 'preview'} disabled={!proposed.trim()} onClick={() => void runPreview()} />
      </div>

      {preview ? (
        <div className="flex flex-col gap-4">
          <p className="t-body text-ink">
            <span className="font-mono">{preview.member.zoneNumber || '(none)'}</span> → <span className="font-mono font-semibold">{preview.proposed}</span> for {preview.member.name}{' '}
            <span className="text-muted">(zone {preview.member.zone})</span>
          </p>
          {preview.problems.length > 0 ? (
            <ul className="t-caption list-disc space-y-0.5 rounded-md bg-danger-soft py-2.5 pl-8 pr-3 text-danger-text">
              {preview.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          {preview.canApply ? (
            <>
              <TextField label="Why? (recorded in the activity log)" value={reason} placeholder="e.g. Confirmed against the paper register" onChange={(e) => setReason(e.target.value)} />
              <TextField
                label={`Type ${preview.confirmPhrase} to confirm`}
                className="font-mono"
                value={confirm}
                autoComplete="off"
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button label="Apply change" loading={busy === 'apply'} disabled={!ready} onClick={() => void apply()} />
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="t-caption text-danger-text">{error}</p> : null}
    </div>
  );
}

function CandidateRow({ candidate, onChanged }: { candidate: ZoneFixCandidate; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ListRow
        leading={<Avatar name={candidate.name} />}
        title={candidate.name}
        subtitle={
          <>
            <span className="font-mono">{candidate.zoneNumber || '(none)'}</span> · {candidate.reasons.join(', ')}
          </>
        }
        trailing={<Button label={open ? 'Close' : 'Fix'} variant="soft" size="sm" onClick={() => setOpen((v) => !v)} />}
      />
      {open ? <FixPanel candidate={candidate} onChanged={onChanged} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export function FixZoneNumbers({ report, onChanged }: { report: HealthReport; onChanged: () => void }) {
  const candidates = useMemo(() => zoneFixCandidates(report), [report]);

  return (
    <Section
      title="Zone numbers to fix"
      footer="Only you can know the right number, so nothing is guessed. Each change shows a preview, needs a reason and a typed confirmation, and is recorded in the activity log."
    >
      {candidates.length > 0
        ? candidates.map((c) => <CandidateRow key={c.id} candidate={c} onChanged={onChanged} />)
        : [<EmptyState key="none" icon={CheckCircle2} tone="success" title="No zone numbers need fixing" />]}
    </Section>
  );
}
