import { isAdminOrDev } from "../lib/admin-helpers.ts";
import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken, checkPermission } from "../lib/auth-helpers.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";
// Additional helpers
import { logActivity, getProfileForLog } from "../lib/activity-helpers.ts";
import { recalculateMemberStatuses, applyInverseLinks } from "../lib/member-helpers.ts";
import { createNotification, notifyTabUsers } from "../lib/notification-helpers.ts";
import { normalizePhone, generateOtp, maskEmail, maskPhone, sendOtpEmail, sendOtpSms } from "../lib/two-factor-helpers.ts";

const router = new Hono();

// ============================================================================

// Helper to check if user is admin/dev


// Get backup history
router.get("/backups", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { data: backups, error } = await supabase
      .from('backup_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching backups:', error);
      return c.json({ error: 'Failed to fetch backups' }, 500);
    }

    return c.json(backups.map(b => toCamelCase(b)));
  } catch (error) {
    console.error('Get backups error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get last full backup info (for differential backups)
router.get("/backups/last-full", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { data: lastFull, error } = await supabase
      .from('backup_history')
      .select('*')
      .eq('type', 'full')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching last full backup:', error);
      return c.json({ error: 'Failed to fetch last full backup' }, 500);
    }

    return c.json(lastFull ? toCamelCase(lastFull) : null);
  } catch (error) {
    console.error('Get last full backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create a backup (full or differential)
router.post("/backups", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const backupType = body.type || 'full'; // 'full' or 'differential'
    const selectedTables = body.selectedTables || []; // Empty = all tables

    // All available tables for backup
    const allTables = [
      'members',
      'family_members',
      'visitors',
      'attendance_records',
      'attendance_entries',
      'absentee_records',
      'member_status_log',
      'giving_records',
      'custom_services',
      'custom_giving_types',
      'custom_roles',
      'profiles',
      'temporary_permissions',
      'user_tab_access',
      'user_settings',
      'service_records',
      'notifications',
      'activity_log',
      'children_members',
      'children_member_parents',
      'children_visitors',
      'children_visitor_guardians',
      'children_attendance_records',
      'children_giving_records',
      'expense_payment_methods',
      'expense_records',
      'system_dropdown_options',
      'notification_type_config',
      'activity_log_config'
    ];

    // Determine which tables to backup
    const tablesToBackup = selectedTables.length > 0 ? selectedTables : allTables;

    // For differential backup, we need a reference to the last full backup
    let basedOnBackupId = null;
    let basedOnBackupDate = null;

    if (backupType === 'differential') {
      const { data: lastFull } = await supabase
        .from('backup_history')
        .select('id, created_at')
        .eq('type', 'full')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!lastFull) {
        return c.json({ error: 'No full backup exists. Please create a full backup first.' }, 400);
      }

      basedOnBackupId = lastFull.id;
      basedOnBackupDate = lastFull.created_at;
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${backupType}_${timestamp}.json`;

    // Get user profile for activity log
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Create backup record with 'in_progress' status
    const { data: backupRecord, error: createError } = await supabase
      .from('backup_history')
      .insert({
        type: backupType,
        status: 'in_progress',
        file_name: fileName,
        based_on_backup_id: basedOnBackupId,
        based_on_backup_date: basedOnBackupDate,
        storage_locations: body.storageLocations || ['device'],
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating backup record:', createError);
      return c.json({ error: 'Failed to create backup record' }, 500);
    }

    try {
      // Collect all data for backup
      const backupData: any = {
        metadata: {
          id: backupRecord.id,
          type: backupType,
          createdAt: new Date().toISOString(),
          basedOnFullBackup: basedOnBackupDate,
          version: '1.0',
          selectedTables: tablesToBackup,
          recordCounts: {}
        },
        data: {},
        deletions: {} // For differential - track deleted IDs (future enhancement)
      };

      // Table configurations - use '*' to get all existing columns
      const tableConfigs: { [key: string]: string } = {
        'members': '*',
        'family_members': '*',
        'visitors': '*',
        'attendance_records': '*',
        'attendance_entries': '*',
        'absentee_records': '*',
        'member_status_log': '*',
        'giving_records': '*',
        'custom_services': '*',
        'custom_giving_types': '*',
        'custom_roles': '*',
        'profiles': '*',
        'temporary_permissions': '*',
        'user_tab_access': '*',
        'user_settings': '*',
        'service_records': '*',
        'notifications': '*',
        'activity_log': '*',
        'children_members': '*',
        'children_member_parents': '*',
        'children_visitors': '*',
        'children_visitor_guardians': '*',
        'children_attendance_records': '*',
        'children_giving_records': '*',
        'expense_payment_methods': '*',
        'expense_records': '*',
        'system_dropdown_options': '*',
        'notification_type_config': '*',
        'activity_log_config': '*'
      };

      // Helper function to fetch all records with pagination (Supabase default limit is 1000)
      const fetchAllRecords = async (tableName: string, selectFields: string, filterDate?: string) => {
        const allRecords: any[] = [];
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from(tableName)
            .select(selectFields)
            .range(offset, offset + pageSize - 1);

          // For differential backup, only get records modified since last full backup
          if (filterDate) {
            query = supabase
              .from(tableName)
              .select(selectFields)
              .or(`created_at.gte.${filterDate},updated_at.gte.${filterDate}`)
              .range(offset, offset + pageSize - 1);
          }

          const { data, error } = await query;

          if (error) {
            console.error(`Error fetching ${tableName} (offset ${offset}):`, error);
            throw error;
          }

          if (data && data.length > 0) {
            allRecords.push(...data);
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        return allRecords;
      }

      for (const tableName of tablesToBackup) {
        const selectFields = tableConfigs[tableName] || '*';
        const filterDate = backupType === 'differential' && basedOnBackupDate ? basedOnBackupDate : undefined;

        try {
          const data = await fetchAllRecords(tableName, selectFields, filterDate);
          backupData.data[tableName] = data;
          backupData.metadata.recordCounts[tableName] = data.length;
          console.log(`Fetched ${data.length} records from ${tableName}`);
        } catch (error) {
          console.error(`Error fetching ${tableName}:`, error);
          // Continue with other tables even if one fails
          backupData.data[tableName] = [];
          backupData.metadata.recordCounts[tableName] = 0;
        }
      }

      // Calculate file size (approximate)
      const jsonString = JSON.stringify(backupData);
      const fileSize = new Blob([jsonString]).size;

      // Update backup record with success
      const { error: updateError } = await supabase
        .from('backup_history')
        .update({
          status: 'completed',
          file_size: fileSize,
          record_counts: backupData.metadata.recordCounts,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupRecord.id);

      if (updateError) {
        console.error('Error updating backup record:', updateError);
      }

      // Log backup creation to activity log
      const totalRecords = Object.values(backupData.metadata.recordCounts).reduce((a: number, b: any) => a + (b || 0), 0);
      await supabase.from('activity_log').insert({
        user_id: user.id,
        user_name: userProfile?.name || 'Unknown',
        user_email: userProfile?.email || '',
        action: 'backup_created',
        entity_type: 'backup',
        entity_id: backupRecord.id,
        details: {
          backupType,
          fileName,
          selectedTables: tablesToBackup,
          totalRecords,
          fileSize
        }
      });

      // Return the backup data for download
      return c.json({
        backup: toCamelCase(backupRecord),
        data: backupData
      });

    } catch (backupError) {
      // Update backup record with failure
      await supabase
        .from('backup_history')
        .update({
          status: 'failed',
          error_message: backupError instanceof Error ? backupError.message : 'Unknown error during backup'
        })
        .eq('id', backupRecord.id);

      throw backupError;
    }

  } catch (error) {
    console.error('Create backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Restore from backup
router.post("/backups/restore", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { backupData, restoreMode, selectedTables, restoreFailureMode = 'partial' } = body;

    if (!backupData || !backupData.data) {
      return c.json({ error: 'Invalid backup data' }, 400);
    }

    const mode = restoreMode || 'merge'; // 'replace', 'merge', 'update'

    // Validate backup structure
    if (!backupData.metadata || !backupData.metadata.version) {
      return c.json({ error: 'Invalid backup format - missing metadata' }, 400);
    }

    // Get user profile for activity log
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const results: any = {
      success: true,
      mode,
      restoreFailureMode,
      tables: {}
    };

    // Define restore order (respects foreign key relationships)
    const restoreOrder = [
      'profiles',
      'custom_roles',
      'members',
      'family_members',
      'visitors',
      'custom_services',
      'custom_giving_types',
      'attendance_records',
      'attendance_entries',
      'absentee_records',
      'member_status_log',
      'giving_records',
      'service_records',
      'temporary_permissions',
      'user_tab_access',
      'user_settings',
      'notifications',
      'activity_log',
      'children_members',
      'children_member_parents',
      'children_visitors',
      'children_visitor_guardians',
      'children_attendance_records',
      'children_giving_records',
      'expense_payment_methods',
      'expense_records',
      'system_dropdown_options',
      'notification_type_config',
      'activity_log_config'
    ];

    // Filter to only selected tables if specified
    const tablesToRestore = selectedTables && selectedTables.length > 0
      ? restoreOrder.filter(t => selectedTables.includes(t))
      : restoreOrder;

    // Conflict keys for upsert per table (tables without 'id' column need their natural PK)
    const conflictKeys: Record<string, string> = {
      'notification_type_config': 'type',
      'activity_log_config': 'action_type,entity_type'
    };

    // Merge-mode key fields per table (for existence checks)
    const mergeKeyFields: Record<string, string[]> = {
      'notification_type_config': ['type'],
      'activity_log_config': ['action_type', 'entity_type']
    };

    // Per-table delete filter keys for tables whose natural key isn't the
    // UUID 'id' column.  Each entry maps a table name to the NOT-NULL column
    // used as an always-true filter (`.not(col, 'is', null)`) so that every
    // row is removed deterministically during replace-mode restores.
    const deleteFilterKeys: Record<string, string> = {
      'notification_type_config': 'type',
      'activity_log_config': 'action_type'
    };

    for (const tableName of tablesToRestore) {
      const tableData = backupData.data[tableName];
      if (!tableData || tableData.length === 0) {
        results.tables[tableName] = { skipped: true, reason: 'No data' };
        continue;
      }

      try {
        if (mode === 'replace') {
          // Delete all existing data first (careful with foreign keys!)
          if (tableName !== 'profiles' && tableName !== 'activity_log') { // Don't delete profiles or activity logs
            let deleteError: any = null;

            if (deleteFilterKeys[tableName]) {
              // Tables with a natural key — delete all rows via always-true NOT NULL filter
              const { error } = await supabase
                .from(tableName)
                .delete()
                .not(deleteFilterKeys[tableName], 'is', null);
              deleteError = error;
            } else {
              const { error } = await supabase
                .from(tableName)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
              deleteError = error;
            }

            if (deleteError) {
              console.error(`Error clearing ${tableName}:`, deleteError);
              results.tables[tableName] = { error: deleteError.message };
              results.success = false;
              if (restoreFailureMode === 'atomic') {
                return c.json({ error: deleteError.message, failedTable: tableName, results }, 400);
              }
              continue;
            }
          }
        }

        // Insert/upsert data
        if (mode === 'replace' || mode === 'update') {
          // Upsert - insert or update on conflict
          const { data, error } = await supabase
            .from(tableName)
            .upsert(tableData, { onConflict: conflictKeys[tableName] ?? 'id' })
            .select();

          if (error) {
            console.error(`Error restoring ${tableName}:`, error);
            results.tables[tableName] = { error: error.message };
            results.success = false;
            if (restoreFailureMode === 'atomic') {
              return c.json({ error: error.message, failedTable: tableName, results }, 400);
            }
          } else {
            results.tables[tableName] = { restored: (data || []).length };
          }
        } else {
          // Merge mode - only insert new records (skip existing)
          let inserted = 0;
          let skipped = 0;
          let hasError = false;
          let lastErrorMessage = '';

          const keyFields = mergeKeyFields[tableName] ?? ['id'];

          for (const record of tableData) {
            // Build dynamic existence check using the table's key fields
            let existQuery = supabase
              .from(tableName)
              .select(keyFields.join(', '));
            for (const field of keyFields) {
              existQuery = existQuery.eq(field, record[field]);
            }
            const { data: existing } = await existQuery.single();

            if (!existing) {
              const { error } = await supabase
                .from(tableName)
                .insert(record);

              if (error) {
                console.error(`Error inserting into ${tableName}:`, error);
                skipped++;
                hasError = true;
                lastErrorMessage = error.message;
                results.success = false;
                if (restoreFailureMode === 'atomic') {
                  results.tables[tableName] = { error: error.message, inserted, skipped };
                  return c.json({ error: error.message, failedTable: tableName, results }, 400);
                }
              } else {
                inserted++;
              }
            } else {
              skipped++;
            }
          }

          if (hasError) {
            results.tables[tableName] = { error: lastErrorMessage, inserted, skipped };
          } else {
            results.tables[tableName] = { inserted, skipped };
          }
        }

      } catch (tableError) {
        console.error(`Error processing ${tableName}:`, tableError);
        const tableErrMsg = tableError instanceof Error ? tableError.message : 'Unknown error';
        results.tables[tableName] = { error: tableErrMsg };
        
        if (restoreFailureMode === 'atomic') {
          return c.json({ error: tableErrMsg, failedTable: tableName, results }, 400);
        }
      }
    }

    // Log restore to activity log
    const restoredTables = Object.entries(results.tables)
      .filter(([_, info]: [string, any]) => info.restored || info.inserted)
      .map(([name]) => name);

    await supabase.from('activity_log').insert({
      user_id: user.id,
      user_name: userProfile?.name || 'Unknown',
      user_email: userProfile?.email || '',
      action: 'backup_restored',
      entity_type: 'backup',
      entity_id: backupData.metadata?.id || null,
      details: {
        restoreMode: mode,
        backupType: backupData.metadata?.type,
        backupDate: backupData.metadata?.createdAt,
        restoredTables,
        results: results.tables
      }
    });

    return c.json(results);

  } catch (error) {
    console.error('Restore backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete a backup record
router.delete("/backups/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const backupId = c.req.param('id');

    const { error } = await supabase
      .from('backup_history')
      .delete()
      .eq('id', backupId);

    if (error) {
      console.error('Error deleting backup:', error);
      return c.json({ error: 'Failed to delete backup' }, 500);
    }

    return c.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Delete backup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Preview restore (show what would change)
router.post("/backups/preview", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { backupData, restoreMode, selectedTables = [] } = body;

    if (!backupData || !backupData.data) {
      return c.json({ error: 'Invalid backup data' }, 400);
    }

    const mode = restoreMode || 'merge';
    const preview: any = {
      mode,
      backupInfo: backupData.metadata,
      tables: {}
    };

    // For each table, count current records and backup records
    const allTables = [
      'members', 'family_members', 'visitors', 'attendance_records', 'attendance_entries',
      'absentee_records', 'member_status_log', 'giving_records', 'custom_services', 'custom_giving_types',
      'custom_roles', 'profiles', 'temporary_permissions', 'user_tab_access', 'user_settings',
      'service_records', 'notifications', 'activity_log', 'children_members', 'children_member_parents',
      'children_visitors', 'children_visitor_guardians', 'children_attendance_records', 'children_giving_records',
      'expense_payment_methods', 'expense_records',
      'system_dropdown_options', 'notification_type_config', 'activity_log_config'
    ];

    const tables = selectedTables && selectedTables.length > 0
      ? allTables.filter(t => selectedTables.includes(t))
      : allTables;

    for (const tableName of tables) {
      const backupCount = (backupData.data[tableName] || []).length;

      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      preview.tables[tableName] = {
        currentCount: error ? 0 : count,
        backupCount,
        action: mode === 'replace' ? 'Replace all' : mode === 'merge' ? 'Add new only' : 'Update & add'
      };
    }

    return c.json(preview);

  } catch (error) {
    console.error('Preview restore error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
