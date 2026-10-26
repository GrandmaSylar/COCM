import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, Switch, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Plus, Trash2, Settings, Check, Shield, Database, Palette, Users, Lock, Info, Download,
  Edit3, KeyRound, LayoutGrid, RefreshCw, UserCheck, UserX, FileText, Smartphone, Server, CheckCircle2,
} from '@tamagui/lucide-icons';
import { defaultThemeColors, THEME_PRESETS, ThemeColors } from '@cms/shared';
import { useThemeContext } from '../../context/ThemeContext';
import {
  getLocalDropdownOptions,
  upsertLocalDropdownOption,
  deleteLocalDropdownOption,
  LocalDropdownOption,
  getLocalMembers,
  getLocalGivingRecords,
  getLocalExpenses,
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { useAccess } from '../../lib/access';
import { syncEverything } from '../../lib/syncEngine';
import { api } from '../../lib/api';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import {
  AppText, Badge, Button, EmptyState, FilterChips, IconButton, ListRow, Screen, SearchField, Section,
  SegmentedControl, Sheet, StatTile, Surface, TextField, useToast,
} from '../../components/ui';
import { isValidHex, normalizeHex } from '../../theme/color';
import { radius, space } from '../../theme/tokens';
import { haptic } from '../../theme/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Same ids as the web app's TAB_OPTIONS — these are what user_tab_access and
// custom_roles.tab_access store. Dashboard, Settings and Help are always allowed.
const ALL_TABS = [
  { id: 'members', label: 'Members' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'giving', label: 'Giving' },
  { id: 'reports', label: 'Reports' },
  { id: 'services', label: 'Services' },
  { id: 'activity-log', label: 'Activity Log' },
  { id: 'children', label: 'Children' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'ministry', label: 'Ministry' },
  { id: 'zones', label: 'Zones' },
];
const TAB_LABELS: Record<string, string> = Object.fromEntries(ALL_TABS.map(t => [t.id, t.label]));

const SYSTEM_ROLES = ['dev', 'admin', 'pastor', 'elder'];

type UserStatus = 'pending' | 'active' | 'inactive' | 'rejected';

/** Mirrors the web Settings user filter: approval status first, then is_active. */
function userStatus(u: any): UserStatus {
  const approval = u.approvalStatus ?? u.approval_status ?? 'approved';
  if (approval === 'pending') return 'pending';
  if (approval === 'rejected') return 'rejected';
  return (u.isActive ?? u.is_active) === false ? 'inactive' : 'active';
}

type SectionId = 'appearance' | 'users' | 'roles' | 'security' | 'backup' | 'about' | 'options';

const SECTION_TITLES: Record<SectionId, { title: string; subtitle: string }> = {
  appearance: { title: 'Appearance', subtitle: 'Theme mode and colors' },
  users: { title: 'Users & access', subtitle: 'Approvals, tab access and passwords' },
  roles: { title: 'Custom roles', subtitle: 'Reusable sets of screen access' },
  security: { title: 'Security', subtitle: 'Two-factor authentication' },
  backup: { title: 'Data & backups', subtitle: 'Local database and server backups' },
  about: { title: 'About & preferences', subtitle: 'Report settings and app info' },
  options: { title: 'Dropdown options', subtitle: 'Developer configuration' },
};

const COLOR_GROUPS: { title: string; keys: { key: keyof ThemeColors; label: string; description?: string }[] }[] = [
  {
    title: 'Main colors',
    keys: [
      { key: 'primary', label: 'Primary', description: 'Buttons, links, active tabs' },
      { key: 'secondary', label: 'Secondary', description: 'Secondary actions, badges' },
      { key: 'accent', label: 'Accent', description: 'Highlights, special elements' },
    ],
  },
  {
    title: 'Status colors',
    keys: [
      { key: 'success', label: 'Success', description: 'Completed, giving, money in' },
      { key: 'warning', label: 'Warning', description: 'Pending, offline' },
      { key: 'error', label: 'Error', description: 'Errors, expenses, destructive actions' },
      { key: 'info', label: 'Info', description: 'Information, help' },
    ],
  },
  {
    title: 'Interface colors (light mode)',
    keys: [
      { key: 'muted', label: 'Muted text', description: 'Secondary text' },
      { key: 'border', label: 'Border', description: 'Dividers and outlines' },
    ],
  },
  {
    title: 'Chart colors',
    keys: [
      { key: 'chart1', label: 'Chart 1' },
      { key: 'chart2', label: 'Chart 2' },
      { key: 'chart3', label: 'Chart 3' },
      { key: 'chart4', label: 'Chart 4' },
      { key: 'chart5', label: 'Chart 5' },
    ],
  },
];

/** Curated swatches for the color picker (no extra dependency). */
const SWATCHES = [
  '#dc2626', '#b91c1c', '#e11d48', '#db2777', '#c026d3', '#9333ea', '#7c3aed', '#6366f1', '#4f46e5',
  '#3b82f6', '#2563eb', '#0ea5e9', '#0284c7', '#06b6d4', '#0d9488', '#10b981', '#059669', '#16a34a',
  '#22c55e', '#65a30d', '#84cc16', '#eab308', '#f59e0b', '#d97706', '#f97316', '#ea580c', '#ef4444',
  '#78716c', '#57534e', '#6b7280', '#64748b', '#475569', '#334155', '#1e293b', '#e5e7eb', '#cbd5e1',
];

function sameColors(a: ThemeColors, b: ThemeColors) {
  return (Object.keys(a) as (keyof ThemeColors)[]).every(k => normalizeHex(a[k]) === normalizeHex(b[k]));
}

function initials(name?: string) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

export default function SettingsScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const toast = useToast();
  const {
    colors: c, preference, setThemeMode, customColors, setCustomColors, resetColors, previewColors, isSyncing,
  } = useThemeContext();
  const { isDev, profile } = useAccess();
  const isAdmin = isDev || profile?.role === 'admin' || profile?.role === 'dev';

  const canOpen = useCallback((id: SectionId) => {
    if (id === 'users' || id === 'roles' || id === 'backup') return isAdmin || isDev;
    if (id === 'options') return isDev;
    return true;
  }, [isAdmin, isDev]);

  const initialSection = params.section && params.section in SECTION_TITLES ? (params.section as SectionId) : null;
  const [section, setSection] = useState<SectionId | null>(initialSection);
  const activeTab = section;

  // Dropdown options state
  const [selectedCategory, setSelectedCategory] = useState<'ministries' | 'position_held' | 'roles'>('ministries');
  const [options, setOptions] = useState<LocalDropdownOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelError, setNewLabelError] = useState<string | null>(null);
  const [savingOption, setSavingOption] = useState(false);

  // Users state
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | UserStatus>('all');
  const [selectedUserForTabAccess, setSelectedUserForTabAccess] = useState<any | null>(null);
  const [userTabAccessList, setUserTabAccessList] = useState<string[]>([]);
  const [savingTabAccess, setSavingTabAccess] = useState(false);

  // Password reset state
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [savingReset, setSavingReset] = useState(false);

  // Custom roles state
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleNameError, setRoleNameError] = useState<string | null>(null);
  const [roleDesc, setRoleDesc] = useState('');
  const [roleTabs, setRoleTabs] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  // Security state
  const [twoFaPref, setTwoFaPref] = useState<'none' | 'email' | 'phone'>('none');

  // Backup & stats state
  const [dbStats, setDbStats] = useState({ members: 0, giving: 0, expenses: 0 });
  const [backups, setBackups] = useState<any[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Preferences
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4');

  // Theme editor draft (previewed live across the app until applied)
  const savedColors = customColors ?? defaultThemeColors;
  const [draft, setDraft] = useState<ThemeColors>(savedColors);
  const [editingColor, setEditingColor] = useState<{ key: keyof ThemeColors; label: string } | null>(null);
  const draftDirty = !sameColors(draft, savedColors);

  useEffect(() => {
    if (!draftDirty) setDraft(savedColors);
    // Re-sync the draft when the saved theme changes (e.g. pulled from the web)
  }, [customColors]);

  useEffect(() => {
    previewColors(draftDirty ? draft : null);
  }, [draft, draftDirty]);

  // Leaving the editor without applying discards the preview
  useEffect(() => {
    if (section !== 'appearance') {
      previewColors(null);
      setDraft(savedColors);
    }
  }, [section]);
  useEffect(() => () => previewColors(null), []);

  // Android back: leave a section before leaving the screen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (section && !initialSection) {
        setSection(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [section, initialSection]);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const cached = await getLocalDropdownOptions(selectedCategory);
      setOptions(cached);
    } catch (err) {
      console.error('Failed to load dropdown options:', err);
    } finally {
      setLoadingOptions(false);
    }
  }, [selectedCategory]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await api.users.getAll();
      setSystemUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const data = await api.roles.getAll();
      setCustomRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    try {
      const data = await api.backups.getAll();
      setBackups(Array.isArray(data) ? data : []);
    } catch (err) {}
  }, []);

  useEffect(() => {
    if (activeTab === 'options') loadOptions();
    if (activeTab === 'users') { loadUsers(); if (isDev) loadRoles(); }
    if (activeTab === 'roles') loadRoles();
    if (activeTab === 'backup') loadBackups();
  }, [activeTab, loadOptions, loadUsers, loadRoles, loadBackups]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [m, g, e] = await Promise.all([getLocalMembers(), getLocalGivingRecords(), getLocalExpenses()]);
        setDbStats({ members: m.length, giving: g.length, expenses: e.length });

        const savedPaper = await AsyncStorage.getItem('pref_paper_size');
        if (savedPaper === 'Letter' || savedPaper === 'A4') setPaperSize(savedPaper);
      } catch (err) {}
    }
    loadInitialData();
  }, []);

  // ---------------------------------------------------------------- options
  const handleAddOption = async () => {
    if (!newLabel.trim()) {
      setNewLabelError('Enter a label for the option.');
      return;
    }
    setNewLabelError(null);
    setSavingOption(true);
    try {
      const option: LocalDropdownOption = {
        id: generateUUID(),
        category: selectedCategory,
        label: newLabel.trim(),
        value: newLabel.trim(),
        sort_order: options.length + 1,
        is_active: 1,
        updated_at: new Date().toISOString(),
      };
      await upsertLocalDropdownOption(option);
      setNewLabel('');
      setShowAddForm(false);
      loadOptions();
      toast.show({ title: 'Option added', message: option.label });
    } catch (err) {
      toast.show({ title: 'Couldn’t save the option', tone: 'error' });
    } finally {
      setSavingOption(false);
    }
  };

  const handleToggleActiveOption = async (item: LocalDropdownOption) => {
    try {
      await upsertLocalDropdownOption({ ...item, is_active: item.is_active === 1 ? 0 : 1 });
      loadOptions();
    } catch (err) {}
  };

  const handleDeleteOption = (id: string) => {
    Alert.alert('Delete option?', 'It will no longer appear in dropdowns.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLocalDropdownOption(id);
          loadOptions();
        },
      },
    ]);
  };

  // ---------------------------------------------------------------- users
  const handleApproveUser = async (id: string) => {
    try {
      await api.users.approve(id);
      toast.show({ title: 'User approved' });
      loadUsers();
    } catch (err: any) {
      toast.show({ title: 'Couldn’t approve user', message: err?.message, tone: 'error' });
    }
  };

  const handleRejectUser = async (id: string) => {
    try {
      await api.users.reject(id);
      toast.show({ title: 'User rejected', tone: 'info' });
      loadUsers();
    } catch (err: any) {
      toast.show({ title: 'Couldn’t reject user', message: err?.message, tone: 'error' });
    }
  };

  const handleSaveTabAccess = async () => {
    if (!selectedUserForTabAccess) return;
    setSavingTabAccess(true);
    try {
      await api.users.updateTabAccess(selectedUserForTabAccess.id, userTabAccessList);
      toast.show({ title: 'Tab access updated', message: selectedUserForTabAccess.name });
      setSelectedUserForTabAccess(null);
      loadUsers();
    } catch (err: any) {
      toast.show({ title: 'Couldn’t update tab access', message: err?.message, tone: 'error' });
    } finally {
      setSavingTabAccess(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword.trim()) {
      setNewPasswordError('Enter a new password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setNewPasswordError('Use at least 6 characters.');
      return;
    }
    setNewPasswordError(null);
    setSavingReset(true);
    try {
      await api.users.resetPassword(resetUser.id, newPassword.trim());
      toast.show({ title: 'Password reset', message: resetUser.name || resetUser.email });
      setResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      setNewPasswordError(err?.message || 'Failed to reset password.');
    } finally {
      setSavingReset(false);
    }
  };

  // ---------------------------------------------------------------- roles
  const handleSaveCustomRole = async () => {
    if (!roleName.trim()) {
      setRoleNameError('Enter a role name.');
      return;
    }
    setRoleNameError(null);
    setSavingRole(true);
    try {
      const payload = {
        name: roleName.trim(),
        description: roleDesc.trim(),
        permissions: ['view_all'],
        tabAccess: roleTabs,
      };
      if (roleId) {
        await api.roles.update(roleId, payload);
      } else {
        await api.roles.create(payload);
      }
      toast.show({ title: roleId ? 'Role updated' : 'Role created', message: payload.name });
      setShowRoleModal(false);
      loadRoles();
    } catch (err: any) {
      toast.show({ title: 'Couldn’t save role', message: err?.message, tone: 'error' });
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = (id: string, name?: string) => {
    Alert.alert('Delete role?', `${name ? `"${name}" ` : ''}will be removed. Users with this role lose its tab access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.roles.delete(id);
            loadRoles();
          } catch (err: any) {
            toast.show({ title: 'Couldn’t delete role', message: err?.message, tone: 'error' });
          }
        },
      },
    ]);
  };

  const openRoleSheet = (r?: any) => {
    setRoleId(r?.id || '');
    setRoleName(r?.name || '');
    setRoleDesc(r?.description || '');
    setRoleTabs(r?.tabAccess || []);
    setRoleNameError(null);
    setShowRoleModal(true);
  };

  // ---------------------------------------------------------------- backups
  const handleCreateServerBackup = async () => {
    setCreatingBackup(true);
    try {
      await api.backups.create();
      toast.show({ title: 'Backup created' });
      loadBackups();
    } catch (err: any) {
      toast.show({ title: 'Backup failed', message: err?.message, tone: 'error' });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleFlushAndResync = async () => {
    setFlushing(true);
    try {
      await syncEverything();
      toast.show({ title: 'Sync complete', message: 'Local data matches the server.' });
    } catch (err) {
      toast.show({ title: 'Sync failed', message: 'Check your connection and try again.', tone: 'error' });
    } finally {
      setFlushing(false);
    }
  };

  const handlePaperSizeChange = async (size: 'A4' | 'Letter') => {
    setPaperSize(size);
    await AsyncStorage.setItem('pref_paper_size', size);
    try {
      await api.preferences.save({ paperSize: size });
    } catch (e) {}
  };

  // ---------------------------------------------------------------- theme
  const handleApplyTheme = () => {
    setCustomColors(draft);
    toast.show({ title: 'Theme applied', message: 'Synced to your account on all devices.' });
  };

  const handleResetTheme = () => {
    Alert.alert('Reset theme colors?', 'Your account goes back to the CoC.M default colors on every device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          resetColors();
          setDraft(defaultThemeColors);
          toast.show({ title: 'Theme reset to default' });
        },
      },
    ]);
  };

  const filteredUsers = systemUsers.filter((u: any) => {
    const s = userSearch.toLowerCase();
    const matchSearch = (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s);
    if (userStatusFilter === 'all') return matchSearch;
    return matchSearch && userStatus(u) === userStatusFilter;
  });
  const pendingCount = systemUsers.filter(u => userStatus(u) === 'pending').length;

  const statusTone = (status: UserStatus) =>
    status === 'active' ? 'success' : status === 'pending' ? 'warning' : status === 'rejected' ? 'danger' : 'neutral';
  const statusLabel: Record<UserStatus, string> = { pending: 'Pending approval', active: 'Active', inactive: 'Inactive', rejected: 'Rejected' };

  /** What the user can open today, in plain words. */
  const accessSummary = (u: any): { text: string; tabs: string[] } => {
    if (u.role === 'dev') return { text: 'All screens (developer)', tabs: [] };
    if (u.role && !SYSTEM_ROLES.includes(u.role)) {
      const role = customRoles.find(r => r.name === u.role);
      return { text: `From role: ${u.role}`, tabs: role?.tabAccess || [] };
    }
    const tabs: string[] = u.tabAccess || [];
    return { text: tabs.length ? `${tabs.length} of ${ALL_TABS.length} screens` : 'No extra screens granted', tabs };
  };

  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter(t => t !== id) : [...list, id]);

  // ================================================================== VIEWS

  const renderHome = () => (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
      <Section title="Personalization">
        <ListRow icon={Palette} title="Appearance" subtitle="Theme mode and colors" onPress={() => setSection('appearance')} />
      </Section>

      <Section title="Account">
        <ListRow icon={Lock} title="Security" subtitle="Two-factor authentication" onPress={() => setSection('security')} />
      </Section>

      {isAdmin || isDev ? (
        <Section title="Administration">
          <ListRow icon={Users} title="Users & access" subtitle="Approvals, tab access, passwords" onPress={() => setSection('users')} />
          <ListRow icon={Shield} title="Custom roles" subtitle="Reusable sets of screen access" onPress={() => setSection('roles')} />
          <ListRow icon={Database} title="Data & backups" subtitle="Local database and server backups" onPress={() => setSection('backup')} />
        </Section>
      ) : null}

      {isDev ? (
        <Section title="Developer">
          <ListRow icon={Settings} iconTone="neutral" title="Dropdown options" subtitle="Ministries, positions and roles lists" onPress={() => setSection('options')} />
        </Section>
      ) : null}

      <Section title="About">
        <ListRow icon={Info} iconTone="neutral" title="About & preferences" subtitle="Report paper size, version" onPress={() => setSection('about')} />
      </Section>
    </ScrollView>
  );

  const renderAppearance = () => (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: draftDirty ? 140 : space.xxl, gap: space.xl }}>
      <Section title="Mode">
        <View style={{ padding: space.md }}>
          <SegmentedControl
            accessibilityLabel="Theme mode"
            value={preference}
            onChange={setThemeMode}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </View>
      </Section>

      <Section
        title="Presets"
        footer="Same presets as the web app. Tap one to preview it across the app, then apply."
        bare
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.md, flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}>
          {THEME_PRESETS.map(preset => {
            const selected = normalizeHex(draft.primary) === normalizeHex(preset.colors.primary);
            return (
              <Pressable
                key={preset.id}
                onPress={() => { haptic.selection(); setDraft(preset.colors); }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${preset.name} preset`}
                style={{
                  width: 132,
                  padding: space.sm,
                  gap: space.xs,
                  borderRadius: radius.lg,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? c.primary.base : c.border,
                  backgroundColor: c.surface,
                }}
              >
                <View style={{ flexDirection: 'row', height: 40, borderRadius: radius.sm, overflow: 'hidden' }}>
                  <View style={{ flex: 2, backgroundColor: preset.colors.primary }} />
                  <View style={{ flex: 1, backgroundColor: preset.colors.secondary }} />
                  <View style={{ flex: 1, backgroundColor: preset.colors.accent }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppText variant="captionStrong" numberOfLines={1} style={{ flex: 1 }}>{preset.name}</AppText>
                  {selected ? <CheckCircle2 size={16} color={c.primary.text} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Section>

      <Section title="Preview" bare>
        <Surface style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
            <Button label="Primary" size="sm" />
            <Button label="Soft" size="sm" variant="soft" />
            <Button label="Delete" size="sm" variant="dangerSoft" />
          </View>
          <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
            <Badge label="Active" tone="success" />
            <Badge label="Pending" tone="warning" />
            <Badge label="Failed" tone="danger" />
            <Badge label="Info" tone="info" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 48 }}>
            {c.chart.map((color, i) => (
              <View key={i} style={{ flex: 1, height: [60, 100, 75, 45, 85][i] + '%' as any, backgroundColor: color, borderRadius: 4 }} />
            ))}
          </View>
        </Surface>
      </Section>

      {COLOR_GROUPS.map(group => (
        <Section key={group.title} title={group.title}>
          {group.keys.map(({ key, label, description }) => (
            <ListRow
              key={key}
              title={label}
              subtitle={description}
              onPress={() => setEditingColor({ key, label })}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppText variant="caption" tone="muted" numeric>{normalizeHex(draft[key]).toUpperCase()}</AppText>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: draft[key], borderWidth: 1, borderColor: c.border }} />
                </View>
              }
              chevron
            />
          ))}
        </Section>
      ))}

      <Section footer="Colors are saved to your account and also apply in the web app. Changes made on the web appear here when you reopen the app.">
        <ListRow icon={RefreshCw} iconTone="danger" title="Reset to default colors" destructive onPress={handleResetTheme} chevron={false} />
      </Section>
    </ScrollView>
  );

  const renderUsers = () => (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.md, paddingBottom: space.xs, gap: space.sm }}>
        <SearchField value={userSearch} onChangeText={setUserSearch} placeholder="Search by name or email" />
        <FilterChips
          value={userStatusFilter}
          onChange={setUserStatusFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'pending', label: pendingCount ? `Pending · ${pendingCount}` : 'Pending' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </View>
      {loadingUsers ? (
        <View style={{ padding: space.md }}><SkeletonList count={4} /></View>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={systemUsers.length ? 'No users match' : 'No users yet'}
          message={systemUsers.length ? 'Try a different name, email or status.' : undefined}
          action={userSearch || userStatusFilter !== 'all' ? { label: 'Clear filters', onPress: () => { setUserSearch(''); setUserStatusFilter('all'); } } : undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.md, paddingTop: space.xs, paddingBottom: space.xxl, gap: space.sm }}>
          <AppText variant="caption" tone="muted">{filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}</AppText>
          {filteredUsers.map(u => {
            const status = userStatus(u);
            const access = accessSummary(u);
            const shownTabs = access.tabs.slice(0, 4);
            return (
            <Surface key={u.id} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.primary.soft, alignItems: 'center', justifyContent: 'center' }}>
                  <AppText variant="bodyStrong" tone="primary">{initials(u.name)}</AppText>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{u.name || 'User'}</AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>{u.email || u.phone}</AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge label={u.role || 'user'} tone="primary" />
                <Badge label={statusLabel[status]} tone={statusTone(status)} />
              </View>
              <View style={{ gap: 6, padding: space.sm, borderRadius: radius.md, backgroundColor: c.surfaceMuted }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <LayoutGrid size={14} color={c.textMuted} />
                  <AppText variant="captionStrong" tone="muted">Screen access</AppText>
                  <AppText variant="caption" tone="subtle" style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>{access.text}</AppText>
                </View>
                {shownTabs.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {shownTabs.map(t => <Badge key={t} label={TAB_LABELS[t] ?? t} tone="neutral" />)}
                    {access.tabs.length > shownTabs.length ? <Badge label={`+${access.tabs.length - shownTabs.length} more`} tone="neutral" /> : null}
                  </View>
                ) : null}
              </View>
              {status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <Button label="Approve" icon={UserCheck} size="sm" flex={1} onPress={() => handleApproveUser(u.id)} />
                  <Button label="Reject" icon={UserX} size="sm" variant="dangerSoft" flex={1} onPress={() => handleRejectUser(u.id)} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <Button
                  label="Tab access"
                  icon={LayoutGrid}
                  size="sm"
                  variant="secondary"
                  flex={1}
                  onPress={() => { setSelectedUserForTabAccess(u); setUserTabAccessList(u.tabAccess || []); }}
                />
                <Button
                  label="Reset password"
                  icon={KeyRound}
                  size="sm"
                  variant="secondary"
                  flex={1}
                  onPress={() => { setResetUser(u); setNewPassword(''); setNewPasswordError(null); }}
                />
              </View>
            </Surface>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const renderRoles = () => (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.md }}>
      {loadingRoles ? (
        <SkeletonList count={3} hasAvatar={false} />
      ) : customRoles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No custom roles"
          message="Create a role to give a group of users the same screens."
          action={{ label: 'New role', onPress: () => openRoleSheet() }}
        />
      ) : (
        <Section
          title={`${customRoles.length} ${customRoles.length === 1 ? 'role' : 'roles'}`}
          action={<Button label="New role" icon={Plus} size="sm" variant="soft" onPress={() => openRoleSheet()} />}
        >
          {customRoles.map(r => (
            <ListRow
              key={r.id}
              icon={Shield}
              title={r.name}
              subtitle={[r.description, `${(r.tabAccess || []).length} screens`].filter(Boolean).join(' · ')}
              onPress={() => openRoleSheet(r)}
              right={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <IconButton icon={Edit3} label={`Edit ${r.name}`} size={36} onPress={() => openRoleSheet(r)} />
                  <IconButton icon={Trash2} label={`Delete ${r.name}`} size={36} tone="danger" onPress={() => handleDeleteRole(r.id, r.name)} />
                </View>
              }
            />
          ))}
        </Section>
      )}
    </ScrollView>
  );

  const renderSecurity = () => (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
      <Section title="Two-factor authentication" footer="Where your sign-in verification code is sent.">
        <View style={{ padding: space.md }}>
          <SegmentedControl
            accessibilityLabel="Two-factor method"
            value={twoFaPref}
            onChange={setTwoFaPref}
            options={[
              { value: 'none', label: 'Off' },
              { value: 'email', label: 'Email' },
              { value: 'phone', label: 'Phone' },
            ]}
          />
        </View>
      </Section>
    </ScrollView>
  );

  const renderBackup = () => (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
      <Section title="On this device" bare>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <StatTile label="Members" value={String(dbStats.members)} icon={Users} />
          <StatTile label="Giving" value={String(dbStats.giving)} icon={FileText} tone="success" />
          <StatTile label="Expenses" value={String(dbStats.expenses)} icon={FileText} tone="danger" />
        </View>
        <Button label={flushing ? 'Syncing…' : 'Sync everything now'} icon={RefreshCw} loading={flushing} fullWidth onPress={handleFlushAndResync} />
        <AppText variant="caption" tone="subtle" style={{ paddingHorizontal: 4 }}>
          Sends queued offline changes, then downloads the latest data.
        </AppText>
      </Section>

      <Section
        title="Server backups"
        action={<Button label="Create backup" icon={Download} size="sm" variant="soft" loading={creatingBackup} onPress={handleCreateServerBackup} />}
      >
        {backups.length === 0 ? (
          <EmptyState icon={Server} title="No backups yet" message="Backups created here are stored on the server." />
        ) : (
          backups.map(b => (
            <ListRow
              key={b.id}
              icon={Database}
              iconTone="neutral"
              title={b.filename || b.id}
              subtitle={new Date(b.created_at).toLocaleString()}
            />
          ))
        )}
      </Section>
    </ScrollView>
  );

  const renderAbout = () => (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
      <Section title="PDF report paper size">
        <View style={{ padding: space.md }}>
          <SegmentedControl
            accessibilityLabel="Paper size"
            value={paperSize}
            onChange={handlePaperSizeChange}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'Letter', label: 'Letter' },
            ]}
          />
        </View>
      </Section>

      <Section title="App">
        <ListRow icon={Smartphone} iconTone="neutral" title="Church Management System (CoC.M)" subtitle="Mobile app" value="1.0.0" />
        <ListRow icon={Database} iconTone="neutral" title="Engine" subtitle="Offline-first · Expo 57 · React Native 0.86" />
      </Section>
    </ScrollView>
  );

  const renderOptions = () => (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <SegmentedControl
        accessibilityLabel="Option category"
        value={selectedCategory}
        onChange={setSelectedCategory}
        options={[
          { value: 'ministries', label: 'Ministries' },
          { value: 'position_held', label: 'Positions' },
          { value: 'roles', label: 'Roles' },
        ]}
      />

      {showAddForm ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <Surface style={{ gap: space.sm }}>
            <TextField
              label="New option"
              placeholder="e.g. Media & IT"
              value={newLabel}
              onChangeText={t => { setNewLabel(t); if (newLabelError) setNewLabelError(null); }}
              error={newLabelError}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddOption}
            />
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <Button label="Cancel" variant="secondary" size="sm" flex={1} onPress={() => { setShowAddForm(false); setNewLabelError(null); }} />
              <Button label="Save" size="sm" flex={1} loading={savingOption} onPress={handleAddOption} />
            </View>
          </Surface>
        </Animated.View>
      ) : null}

      {loadingOptions ? (
        <SkeletonList count={4} hasAvatar={false} />
      ) : (
        <Section
          title={`${options.length} ${options.length === 1 ? 'option' : 'options'}`}
          action={!showAddForm ? <Button label="Add option" icon={Plus} size="sm" variant="soft" onPress={() => setShowAddForm(true)} /> : undefined}
        >
          {options.length === 0 ? (
            <EmptyState icon={Settings} title="No options in this list" />
          ) : (
            options.map(opt => (
              <ListRow
                key={opt.id}
                title={opt.label}
                subtitle={opt.is_active === 1 ? 'Shown in dropdowns' : 'Hidden'}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch
                      value={opt.is_active === 1}
                      onValueChange={() => { haptic.selection(); handleToggleActiveOption(opt); }}
                      trackColor={{ true: c.primary.base, false: c.borderStrong }}
                      thumbColor="#FFFFFF"
                      accessibilityLabel={`Show ${opt.label}`}
                    />
                    <IconButton icon={Trash2} label={`Delete ${opt.label}`} size={36} tone="danger" onPress={() => handleDeleteOption(opt.id)} />
                  </View>
                }
              />
            ))
          )}
        </Section>
      )}
    </ScrollView>
  );

  const views: Record<SectionId, () => React.ReactNode> = {
    appearance: renderAppearance,
    users: renderUsers,
    roles: renderRoles,
    security: renderSecurity,
    backup: renderBackup,
    about: renderAbout,
    options: renderOptions,
  };

  const current = section && canOpen(section) ? section : null;
  const header = current ? SECTION_TITLES[current] : { title: 'Settings', subtitle: 'App & system configuration' };

  return (
    <Screen>
      <AppHeader
        title={header.title}
        subtitle={current === 'appearance' && isSyncing ? 'Syncing theme…' : header.subtitle}
        showBack
        onBack={current && !initialSection ? () => setSection(null) : undefined}
      />

      <Animated.View key={current ?? 'home'} entering={FadeIn.duration(180)} style={{ flex: 1 }}>
        {current ? views[current]() : renderHome()}
      </Animated.View>

      {/* Unsaved theme changes bar */}
      {current === 'appearance' && draftDirty ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{
            position: 'absolute',
            left: space.md,
            right: space.md,
            bottom: space.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            padding: space.sm,
            borderRadius: radius.lg,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            shadowColor: '#000',
            shadowOpacity: c.isDark ? 0.4 : 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <AppText variant="captionStrong" style={{ flex: 1, paddingLeft: 4 }}>Previewing changes</AppText>
          <Button label="Discard" size="sm" variant="secondary" onPress={() => setDraft(savedColors)} />
          <Button label="Apply" size="sm" icon={Check} onPress={handleApplyTheme} />
        </Animated.View>
      ) : null}

      {/* Color picker */}
      <ColorPickerSheet
        visible={!!editingColor}
        label={editingColor?.label ?? ''}
        value={editingColor ? draft[editingColor.key] : '#000000'}
        onClose={() => setEditingColor(null)}
        onPick={hex => {
          if (editingColor) setDraft(d => ({ ...d, [editingColor.key]: hex }));
          setEditingColor(null);
        }}
      />

      {/* Tab access */}
      <Sheet
        visible={!!selectedUserForTabAccess}
        onClose={() => setSelectedUserForTabAccess(null)}
        title="Tab access"
        subtitle={selectedUserForTabAccess?.name}
        footer={
          isDev ? (
            <Button label="Save tab access" fullWidth loading={savingTabAccess} onPress={handleSaveTabAccess} />
          ) : (
            <AppText variant="caption" tone="muted" align="center" style={{ paddingVertical: space.xs }}>
              Only developers can change tab access.
            </AppText>
          )
        }
      >
        <AppText variant="caption" tone="muted">
          Dashboard, Settings and Help are always available.
          {selectedUserForTabAccess?.role === 'dev' ? ' Developers can open every screen.' : ''}
        </AppText>
        <TabToggleList
          selected={userTabAccessList}
          disabled={!isDev}
          onToggle={id => setUserTabAccessList(l => toggleIn(l, id))}
        />
      </Sheet>

      {/* Reset password */}
      <Sheet
        visible={!!resetUser}
        onClose={() => setResetUser(null)}
        title="Reset password"
        subtitle={resetUser?.name || resetUser?.email}
        footer={<Button label="Reset password" fullWidth loading={savingReset} onPress={handleResetPassword} />}
      >
        <TextField
          label="New password"
          placeholder="At least 6 characters"
          value={newPassword}
          onChangeText={t => { setNewPassword(t); if (newPasswordError) setNewPasswordError(null); }}
          secureTextEntry
          autoFocus
          error={newPasswordError}
          helper="Share it with the user securely. They can change it after signing in."
        />
      </Sheet>

      {/* Custom role */}
      <Sheet
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={roleId ? 'Edit role' : 'New role'}
        footer={<Button label={roleId ? 'Save role' : 'Create role'} fullWidth loading={savingRole} onPress={handleSaveCustomRole} />}
      >
        <TextField
          label="Role name"
          placeholder="e.g. Finance assistant"
          value={roleName}
          onChangeText={t => { setRoleName(t); if (roleNameError) setRoleNameError(null); }}
          error={roleNameError}
        />
        <TextField label="Description" placeholder="Optional" value={roleDesc} onChangeText={setRoleDesc} />
        <AppText variant="label" tone="muted">Screens this role can open</AppText>
        <TabToggleList selected={roleTabs} onToggle={id => setRoleTabs(l => toggleIn(l, id))} />
      </Sheet>
    </Screen>
  );
}

/** Checklist of app screens used by tab access and custom roles. */
function TabToggleList({ selected, onToggle, disabled }: { selected: string[]; onToggle: (id: string) => void; disabled?: boolean }) {
  const c = useThemeContext().colors;
  return (
    <Surface padded={false}>
      {ALL_TABS.map((tab, i) => {
        const has = selected.includes(tab.id);
        return (
          <View key={tab.id}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: c.border, marginLeft: space.md }} /> : null}
            <Pressable
              onPress={() => { haptic.selection(); onToggle(tab.id); }}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: has, disabled: !!disabled }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 48,
                paddingHorizontal: space.md,
                backgroundColor: pressed ? c.surfaceMuted : 'transparent',
              })}
            >
              <AppText variant="bodyMedium" style={{ flex: 1 }}>{tab.label}</AppText>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  borderWidth: has ? 0 : 1.5,
                  borderColor: c.borderStrong,
                  backgroundColor: has ? c.primary.base : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {has ? <Check size={16} color={c.primary.on} /> : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </Surface>
  );
}

function ColorPickerSheet({
  visible, label, value, onClose, onPick,
}: { visible: boolean; label: string; value: string; onClose: () => void; onPick: (hex: string) => void }) {
  const c = useThemeContext().colors;
  const [hex, setHex] = useState(normalizeHex(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setHex(normalizeHex(value).toUpperCase());
      setError(null);
    }
  }, [visible, value]);

  const valid = isValidHex(hex);
  const preview = valid ? normalizeHex(hex) : normalizeHex(value);

  const submit = () => {
    if (!valid) {
      setError('Use a hex color like #DC2626.');
      return;
    }
    onPick(normalizeHex(hex));
  };

  const swatchSize = useMemo(() => 40, []);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={label}
      subtitle="Pick a swatch or enter a hex value"
      footer={<Button label="Use this color" fullWidth onPress={submit} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: preview, borderWidth: 1, borderColor: c.border }} />
        <View style={{ flex: 1 }}>
          <TextField
            label="Hex"
            value={hex}
            onChangeText={t => { setHex(t.startsWith('#') ? t : `#${t}`); setError(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            error={error}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {SWATCHES.map(s => {
          const selected = valid && normalizeHex(hex) === s;
          return (
            <Pressable
              key={s}
              onPress={() => { haptic.selection(); setHex(s.toUpperCase()); setError(null); }}
              accessibilityRole="button"
              accessibilityLabel={s}
              accessibilityState={{ selected }}
              style={{
                width: swatchSize,
                height: swatchSize,
                borderRadius: 12,
                backgroundColor: s,
                borderWidth: selected ? 3 : 1,
                borderColor: selected ? c.text : c.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? <Check size={18} color="#FFFFFF" /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
