import type { HealthReport } from './types';

export interface ZoneFixCandidate {
  id: string;
  name: string;
  zoneNumber: string;
  reasons: string[];
}

interface Member {
  id: string;
  name: string;
  zoneNumber: string;
}

/** Members whose zone number is missing, a placeholder, or shared, gathered from the health checks. */
export function zoneFixCandidates(report: HealthReport): ZoneFixCandidate[] {
  const byId = new Map<string, ZoneFixCandidate>();
  const add = (m: Member, reason: string) => {
    const existing = byId.get(m.id);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    } else {
      byId.set(m.id, { id: m.id, name: m.name, zoneNumber: m.zoneNumber, reasons: [reason] });
    }
  };

  for (const check of report.checks) {
    if (check.id === 'members_duplicate_zone_number') {
      for (const group of check.samples as unknown as { members: Member[] }[]) {
        for (const m of group.members) add(m, 'shares its number with someone');
      }
    } else if (check.id === 'members_missing_zone') {
      for (const m of check.samples as unknown as Member[]) add(m, 'no zone number');
    } else if (check.id === 'members_placeholder_zone_number') {
      for (const m of check.samples as unknown as Member[]) add(m, 'placeholder number');
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
