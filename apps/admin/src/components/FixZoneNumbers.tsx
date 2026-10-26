import { useMemo, useState } from 'react';
import { Check, Loader2, Wrench } from 'lucide-react';
import { applyZoneFix, previewZoneFix } from '../lib/api';
import type { HealthReport, ZoneFixPreview } from '../types';

interface Candidate {
  id: string;
  name: string;
  zoneNumber: string;
  reasons: string[];
}

const field = 'w-full rounded-md border border-slate-300 bg-transparent px-3 py-1.5 text-sm dark:border-slate-700';

// Members that need a zone number, gathered from the health checks.
function candidatesFrom(report: HealthReport): Candidate[] {
  const byId = new Map<string, Candidate>();
  const add = (id: string, name: string, zoneNumber: string, reason: string) => {
    const existing = byId.get(id);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    } else {
      byId.set(id, { id, name, zoneNumber, reasons: [reason] });
    }
  };
  for (const check of report.checks) {
    if (check.id === 'members_duplicate_zone_number') {
      for (const group of check.samples as unknown as { members: { id: string; name: string; zoneNumber: string }[] }[]) {
        for (const m of group.members) add(m.id, m.name, m.zoneNumber, 'shares its number with someone');
      }
    } else if (check.id === 'members_missing_zone' || check.id === 'members_placeholder_zone_number') {
      const reason = check.id === 'members_missing_zone' ? 'no zone number' : 'placeholder number';
      for (const m of check.samples as unknown as { id: string; name: string; zoneNumber: string }[]) add(m.id, m.name, m.zoneNumber, reason);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function Row({ candidate, onChanged }: { candidate: Candidate; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [proposed, setProposed] = useState('');
  const [preview, setPreview] = useState<ZoneFixPreview | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const fail = (e: unknown) => setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong' });

  async function runPreview() {
    setBusy(true);
    setMessage(null);
    setConfirm('');
    try {
      setPreview(await previewZoneFix(candidate.id, proposed));
    } catch (e) {
      setPreview(null);
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await applyZoneFix({
        memberId: candidate.id,
        proposed: preview.proposed,
        expectedCurrent: preview.member.zoneNumber,
        reason,
        confirm,
      });
      setMessage({ kind: 'ok', text: `${result.name}: ${result.before || '(none)'} → ${result.after}` });
      setPreview(null);
      onChanged();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(preview?.canApply) && reason.trim().length >= 5 && confirm.trim() === preview?.confirmPhrase;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{candidate.name}</p>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{candidate.zoneNumber || '(none)'}</span> · {candidate.reasons.join(', ')}
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <Wrench className="h-3.5 w-3.5" /> {open ? 'Close' : 'Fix'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
          <div className="flex gap-2">
            <input
              className={field + ' font-mono'}
              placeholder="New number, e.g. A12"
              value={proposed}
              onChange={(e) => {
                setProposed(e.target.value);
                setPreview(null);
              }}
            />
            <button
              disabled={busy || !proposed.trim()}
              onClick={() => void runPreview()}
              className="shrink-0 rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
            >
              {busy && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preview'}
            </button>
          </div>

          {preview && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-mono">{preview.member.zoneNumber || '(none)'}</span> →{' '}
                <span className="font-mono font-medium">{preview.proposed}</span> for {preview.member.name} (zone {preview.member.zone})
              </p>
              {preview.problems.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-red-700 dark:text-red-400">
                  {preview.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {preview.canApply && (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-500">Why? (recorded in the activity log)</span>
                    <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Confirmed against the paper register" />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-500">
                      Type <span className="font-mono font-medium">{preview.confirmPhrase}</span> to confirm
                    </span>
                    <input className={field + ' font-mono'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
                  </label>
                  <button
                    disabled={!ready || busy}
                    onClick={() => void apply()}
                    className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Apply change
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {message && (
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${message.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {message.kind === 'ok' && <Check className="h-4 w-4" />} {message.text}
        </p>
      )}
    </li>
  );
}

export function FixZoneNumbers({ report, onChanged }: { report: HealthReport; onChanged: () => void }) {
  const candidates = useMemo(() => candidatesFrom(report), [report]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="font-medium">Zone numbers to fix</h2>
        <p className="text-xs text-slate-500">
          Only you can know the right number, so nothing is guessed. Each change shows a preview, needs a reason and a typed confirmation, and is recorded in the
          activity log.
        </p>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {candidates.map((c) => (
          <Row key={c.id} candidate={c} onChanged={onChanged} />
        ))}
        {candidates.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No zone numbers need fixing.</li>}
      </ul>
    </section>
  );
}
