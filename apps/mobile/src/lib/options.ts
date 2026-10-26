import { supabase } from './supabase';
import { 
  getLocalDb, 
  getLocalDropdownOptions, 
  batchUpsertDropdownOptions, 
  LocalDropdownOption,
  getLocalZones,
  batchUpsertZones,
  LocalZone 
} from './db';

// Graceful Default Seed Fallbacks (used if database is newly initialized before first sync)
export const DEFAULT_MINISTRIES = [
  'Choir',
  'Protocol',
  'Media & IT',
  'Evangelism',
  'Prayer Warriors',
  'Ushering',
  'Welfare',
  "Children's Teachers"
];

export const DEFAULT_POSITIONS = [
  'Pastor',
  'Elder',
  'Deacon',
  'Deaconess',
  'Ministry Leader',
  'Executive Member',
  'General Member'
];

export const DEFAULT_ZONES = [
  { id: 'zone-a', code: 'A', name: 'Zone A', description: 'Zone A area' },
  { id: 'zone-b', code: 'B', name: 'Zone B', description: 'Zone B area' },
  { id: 'zone-f', code: 'F', name: 'Zone F', description: 'Zone F area' },
  { id: 'zone-k', code: 'K', name: 'Zone K', description: 'Zone K area' },
  { id: 'zone-m', code: 'M', name: 'Zone M', description: 'Zone M area' },
  { id: 'zone-r', code: 'R', name: 'Zone R', description: 'Zone R area' },
];

/**
 * Reads dynamic dropdown options from local SQLite (0ms latency).
 * Falls back to default seeds if database cache is not yet seeded.
 */
export async function getDropdownOptions(category: string): Promise<string[]> {
  try {
    const cached = await getLocalDropdownOptions(category);
    if (cached && cached.length > 0) {
      return cached.map(o => o.label);
    }
  } catch (err) {
    console.warn(`Error reading cached options for category ${category}:`, err);
  }

  // Default seeds fallback
  if (category === 'ministries') return DEFAULT_MINISTRIES;
  if (category === 'position_held') return DEFAULT_POSITIONS;
  return [];
}

/**
 * Fetches dynamic dropdown options from Supabase and syncs to local SQLite.
 */
export async function syncDropdownOptions(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('system_dropdown_options')
      .select('*')
      .or('is_active.eq.true,is_active.is.null')
      .order('sort_order', { ascending: true });

    if (data && !error && data.length > 0) {
      const mapped: LocalDropdownOption[] = data.map(d => ({
        id: d.id,
        category: d.category,
        label: d.label,
        value: d.value || d.label,
        sort_order: d.sort_order ?? 0,
        is_active: d.is_active === false ? 0 : 1,
        updated_at: d.updated_at || new Date().toISOString()
      }));

      await batchUpsertDropdownOptions(mapped);
    }
  } catch (err) {
    console.warn('Failed syncing dropdown options from server:', err);
  }
}

/**
 * Reads dynamic church zones from local SQLite (0ms latency).
 */
export async function getChurchZones(): Promise<string[]> {
  try {
    const cached = await getLocalZones();
    if (cached && cached.length > 0) {
      return cached.map(z => z.code);
    }
  } catch (err) {
    console.warn('Error reading cached zones:', err);
  }

  return DEFAULT_ZONES.map(z => z.code);
}

/**
 * Fetches dynamic zones from Supabase and syncs to local SQLite.
 */
export async function syncChurchZones(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .order('code', { ascending: true });

    if (data && !error && data.length > 0) {
      const mapped: LocalZone[] = data.map(z => ({
        id: z.id,
        name: z.name,
        code: z.code,
        description: z.description,
        updated_at: z.updated_at || new Date().toISOString()
      }));

      await batchUpsertZones(mapped);
    } else {
      // Seed default zones into SQLite if server table is empty
      const defaultZonesMapped: LocalZone[] = DEFAULT_ZONES.map(z => ({
        id: z.id,
        name: z.name,
        code: z.code,
        description: z.description,
        updated_at: new Date().toISOString()
      }));
      await batchUpsertZones(defaultZonesMapped);
    }
  } catch (err) {
    console.warn('Failed syncing church zones from server:', err);
  }
}

/**
 * Subscribes to Realtime updates on system_dropdown_options and zones.
 * Whenever an admin on the web settings page adds, edits, or removes an option/zone,
 * mobile local SQLite is automatically updated in the background.
 */
export function initRealtimeSettingsSync(onUpdate?: () => void) {
  const optionsChannel = supabase
    .channel('settings:dynamic-options')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_dropdown_options' }, async () => {
      await syncDropdownOptions();
      if (onUpdate) onUpdate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, async () => {
      await syncChurchZones();
      if (onUpdate) onUpdate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_services' }, async () => {
      try {
        const { syncCustomServices } = await import('./syncEngine');
        await syncCustomServices();
      } catch (err) {
        console.warn('Failed realtime custom services sync:', err);
      }
      if (onUpdate) onUpdate();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(optionsChannel);
  };
}
