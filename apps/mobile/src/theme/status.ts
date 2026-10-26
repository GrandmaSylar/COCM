import type { Tone } from '../components/ui/Badge';

/** One palette for member/child status everywhere (lists, profiles, reports). */
export function memberStatusTone(status?: string | null): Tone {
  switch ((status || '').toLowerCase()) {
    case 'active': return 'success';
    case 'new': return 'primary';
    case 'semi-active': return 'warning';
    case 'not baptised': return 'warning';
    case 'sick':
    case 'traveled':
    case 'schooling': return 'info';
    case 'blacklisted': return 'danger';
    case 'inactive':
    default: return 'neutral';
  }
}

export function statusLabel(status?: string | null): string {
  const s = (status || 'active').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
