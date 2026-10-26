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
