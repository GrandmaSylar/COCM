import { Users, UserPlus, Calendar, Banknote, BarChart3, Church, ClipboardList, Baby, Receipt, HandHeart, Map } from 'lucide-react';
import type { UserRole } from '../AuthContext';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

export const roleLabels = {
  dev: 'Developer',
  admin: 'Administrator',
  pastor: 'Pastor',
  elder: 'Elder'
};

export const roleColors = {
  dev: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  admin: 'bg-destructive/10 text-destructive ',
  pastor: 'bg-info-soft text-info-text ',
  elder: 'bg-success-soft text-success-text '
};

export const allPermissions = [
  'manage_users', 'manage_roles', 'manage_permissions', 'view_all', 'edit_all', 'delete_all',
  'manage_members', 'view_members', 'edit_members',
  'manage_attendance', 'view_attendance', 'record_attendance',
  'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
  'view_reports', 'manage_settings', 'manage_services', 'manage_theme', 'grant_permissions',
  'create_members', 'update_members', 'delete_members',
  'create_visitors', 'update_visitors', 'delete_visitors',
  'create_attendance', 'update_attendance', 'delete_attendance',
  'create_giving', 'update_giving', 'delete_giving',
  'create_expenses', 'update_expenses', 'delete_expenses',
  'create_children', 'update_children', 'delete_children',
  'create_services', 'update_services', 'delete_services'
];

export const PERMISSION_GROUPS = {
  Members: ['manage_users', 'manage_roles', 'manage_permissions', 'manage_members', 'view_members', 'edit_members', 'delete_members'],
  Attendance: ['manage_attendance', 'view_attendance', 'record_attendance', 'manage_services'],
  Giving: ['manage_giving', 'view_giving', 'record_giving', 'manage_giving_types'],
  System: ['view_all', 'edit_all', 'delete_all', 'view_reports', 'manage_settings', 'manage_theme', 'grant_permissions']
};

export const TAB_OPTIONS = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'visitors', label: 'Visitors', icon: UserPlus },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'giving', label: 'Giving', icon: Banknote },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'services', label: 'Services', icon: Church },
  { id: 'activity-log', label: 'Activity Log', icon: ClipboardList },
  { id: 'children', label: 'Children', icon: Baby },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'ministry', label: 'Ministry', icon: HandHeart },
  { id: 'zones', label: 'Zones', icon: Map }
];

export const WIDGET_OPTIONS = [
  { id: 'widget_total_members', label: 'Total Members' },
  { id: 'widget_attendance_week', label: 'Weekly Attendance' },
  { id: 'widget_giving_month', label: 'Monthly Giving' },
  { id: 'widget_quick_actions', label: 'Quick Actions' }
];

export const TAB_CRUD_PERMISSIONS: Record<string, string[]> = {
  members: ['create_members', 'update_members', 'delete_members'],
  visitors: ['create_visitors', 'update_visitors', 'delete_visitors'],
  attendance: ['create_attendance', 'update_attendance', 'delete_attendance'],
  giving: ['create_giving', 'update_giving', 'delete_giving'],
  expenses: ['create_expenses', 'update_expenses', 'delete_expenses'],
  children: ['create_children', 'update_children', 'delete_children'],
  services: ['create_services', 'update_services', 'delete_services'],
  reports: [],
  'activity-log': [],
  ministry: [],
  zones: []
};
