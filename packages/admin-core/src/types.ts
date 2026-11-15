export type Severity = 'ok' | 'info' | 'warn' | 'error';

export interface HealthCheck {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  count: number;
  samples: Record<string, unknown>[];
}

export interface HealthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  approvalStatus: string;
  lastLogin: string | null;
  twoFaMethod: string | null;
}

export interface HealthReport {
  generatedAt: string;
  durationMs: number;
  summary: Record<Severity, number>;
  counts: Record<string, number | null>;
  checks: HealthCheck[];
  loadErrors: string[];
  users: HealthUser[];
  activity: {
    last7Days: number;
    byAction: Record<string, number>;
    latest: { id: string; action: string; entityType: string; user: string; description: string; createdAt: string }[];
  };
  backups: { id: string; type: string; status: string; fileName: string; fileSize: number | null; createdAt: string; completedAt: string | null; error: string | null }[];
  tally: Record<string, number>;
}

export interface ZoneFixPreview {
  member: { id: string; name: string; zone: string; zoneNumber: string; status: string };
  proposed: string;
  problems: string[];
  conflicts: { id: string; name: string; zoneNumber: string }[];
  canApply: boolean;
  confirmPhrase: string;
}

export interface RecentFix {
  id: string;
  by: string;
  description: string;
  kind: string | null;
  memberId: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
  createdAt: string;
}

export interface BackupResult {
  backup: { id: string; fileName: string; fileSize: number | null };
  data: unknown;
}

export interface MergeMemberSummary {
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
  keep: MergeMemberSummary;
  drop: MergeMemberSummary;
  /** Blank on the kept member, present on the duplicate: copied over unless unticked. */
  fills: { field: string; value: unknown }[];
  /** Present on both and different: the kept member's value stays. */
  differences: { field: string; keep: unknown; drop: unknown }[];
  /** What will be moved from the duplicate to the kept member. */
  references: { label: string; count: number }[];
  problems: string[];
  warnings: string[];
  canApply: boolean;
  confirmPhrase: string;
}
