import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { supabase } from './supabase';

/**
 * Role & tab-access gating, ported from the web app's AuthContext.hasTabAccess.
 *
 * Tab ids are the web app's navigation ids, which are what user_tab_access and
 * custom_roles.tab_access store.
 */
export type AppTab =
  | 'dashboard' | 'services'
  | 'members' | 'visitors' | 'children'
  | 'attendance' | 'ministry' | 'zones' | 'activity-log'
  | 'giving' | 'expenses'
  | 'reports' | 'help' | 'settings';

export interface AccessProfile {
  userId: string;
  name: string;
  role: string;
  isActive: boolean;
  /** Per-user grants from user_tab_access (system roles). */
  tabAccess: string[];
  /** tab_access of the user's custom role; null for system roles. */
  customRoleTabs: string[] | null;
}

const SYSTEM_ROLES = ['dev', 'admin', 'pastor', 'elder'];
const ALWAYS_ALLOWED: AppTab[] = ['dashboard', 'settings', 'help'];

/** Cached so access still applies offline. Holds no secrets (see instructions.md §5). */
const CACHE_KEY = 'cocm_access_profile_v1';

let current: AccessProfile | null = null;
let ready = false;
const listeners = new Set<() => void>();

function setProfile(profile: AccessProfile | null) {
  current = profile;
  ready = true;
  listeners.forEach(fn => fn());
}

export function hasTabAccess(profile: AccessProfile | null, tab: AppTab): boolean {
  if (!profile || !profile.isActive) return false;
  if (profile.role === 'dev') return true;
  if (ALWAYS_ALLOWED.includes(tab)) return true;
  if (profile.customRoleTabs) return profile.customRoleTabs.includes(tab);
  return profile.tabAccess.includes(tab);
}

/**
 * Fetches the signed-in user's role and tab access from the server and caches it.
 * Falls back to the cached profile when offline.
 */
export async function refreshAccessProfile(): Promise<AccessProfile | null> {
  try {
    const session: any = await api.auth.getSession();
    const user = session?.user;
    if (!user?.id) throw new Error('No session user');

    const tabData: any = await api.users.getTabAccess(user.id);

    let customRoleTabs: string[] | null = null;
    if (!SYSTEM_ROLES.includes(user.role)) {
      // Unresolved custom roles get no tabs, matching the web app (fail closed)
      customRoleTabs = [];
      const { data, error } = await supabase
        .from('custom_roles')
        .select('tab_access')
        .eq('name', user.role)
        .single();
      if (!error && data) customRoleTabs = data.tab_access || [];
    }

    const profile: AccessProfile = {
      userId: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive !== false,
      tabAccess: tabData?.tabs || [],
      customRoleTabs,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(profile)).catch(() => {});
    setProfile(profile);
    return profile;
  } catch (err) {
    console.warn('Could not refresh access profile, using cached copy:', err);
    if (!ready) await loadCachedAccessProfile();
    return current;
  }
}

export async function loadCachedAccessProfile(): Promise<AccessProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    setProfile(raw ? JSON.parse(raw) : null);
  } catch {
    setProfile(null);
  }
  return current;
}

export async function clearAccessProfile(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
  setProfile(null);
}

/** Maps a top-level route segment to the tab that guards it. */
const ROUTE_TABS: Record<string, AppTab> = {
  services: 'services',
  members: 'members',
  visitors: 'visitors',
  children: 'children',
  attendance: 'attendance',
  ministries: 'ministry',
  zones: 'zones',
  logs: 'activity-log',
  giving: 'giving',
  expenses: 'expenses',
  reports: 'reports',
  settings: 'settings',
  help: 'help',
};

export function tabForRoute(route: string): AppTab | null {
  const segment = route.replace(/^\//, '').split(/[/?]/)[0];
  return ROUTE_TABS[segment] ?? null;
}

export function useAccess() {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force(n => n + 1);
    listeners.add(listener);
    if (!ready) loadCachedAccessProfile();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    profile: current,
    ready,
    can: (tab: AppTab) => hasTabAccess(current, tab),
    /** Routes with no matching tab (profile, sync diagnostics, ...) are always allowed. */
    canRoute: (route: string) => {
      const tab = tabForRoute(route);
      return tab === null || hasTabAccess(current, tab);
    },
    isDev: current?.role === 'dev',
  };
}
