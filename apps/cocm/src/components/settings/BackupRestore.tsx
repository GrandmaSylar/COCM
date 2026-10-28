import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Plus, Trash2, Clock, Church, Database, Download, Upload, RefreshCw, HardDrive, FileJson, AlertTriangle, CheckCircle, XCircle, History, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { getFriendlyMessage } from '../../utils/error-handler';

// Backup & Restore Component
// Available tables for backup/restore
const BACKUP_TABLE_GROUPS = [
  {
    title: 'Members & People',
    tables: [
      { id: 'members', label: 'Members', description: 'Church member records' },
      { id: 'family_members', label: 'Family Links', description: 'Family relationships between members' },
      { id: 'visitors', label: 'Visitors', description: 'Visitor records' },
      { id: 'absentee_records', label: 'Absentee Records', description: 'Absent member tracking' },
      { id: 'member_status_log', label: 'Status History', description: 'Member status change history' },
    ]
  },
  {
    title: 'Attendance & Services',
    tables: [
      { id: 'service_records', label: 'Service Records', description: 'Service records' },
      { id: 'attendance_records', label: 'Attendance Records', description: 'Service attendance summaries' },
      { id: 'attendance_entries', label: 'Attendance Entries', description: 'Individual attendance entries' },
      { id: 'custom_services', label: 'Custom Services', description: 'Custom service types' },
    ]
  },
  {
    title: 'Giving & Finances',
    tables: [
      { id: 'giving_records', label: 'Giving Records', description: 'Offering and donation records' },
      { id: 'custom_giving_types', label: 'Giving Types', description: 'Custom giving categories' },
    ]
  },
  {
    title: 'Expenses',
    tables: [
      { id: 'expense_payment_methods', label: 'Payment Methods', description: 'Expense payment method configurations' },
      { id: 'expense_records', label: 'Expense Records', description: 'Church expense requisition records' },
    ]
  },
  {
    title: "Children's Ministry",
    tables: [
      { id: 'children_members', label: 'Children Members', description: 'Child member records' },
      { id: 'children_member_parents', label: 'Children Member Parents', description: 'Guardian links for child members' },
      { id: 'children_visitors', label: 'Children Visitors', description: 'Child visitor records' },
      { id: 'children_visitor_guardians', label: 'Children Visitor Guardians', description: 'Guardian links for child visitors' },
      { id: 'children_attendance_records', label: 'Children Attendance', description: 'Children\'s service attendance' },
      { id: 'children_giving_records', label: 'Children Giving', description: 'Children\'s giving records' },
    ]
  },
  {
    title: 'System & Security',
    tables: [
      { id: 'custom_roles', label: 'Custom Roles', description: 'Custom role definitions' },
      { id: 'profiles', label: 'User Accounts', description: 'User profiles and settings' },
      { id: 'temporary_permissions', label: 'Temp Permissions', description: 'Temporary user permissions' },
      { id: 'user_tab_access', label: 'Tab Access', description: 'User tab access settings' },
      { id: 'user_settings', label: 'User Settings', description: 'User preferences and themes' },
      { id: 'notifications', label: 'Notifications', description: 'User notifications' },
      { id: 'activity_log', label: 'Activity Logs', description: 'System activity history' },
    ]
  },
  {
    title: 'Settings & Configuration',
    tables: [
      { id: 'system_dropdown_options', label: 'Dropdown Options', description: 'Custom dropdown values (ministries, positions, ID types, etc.)' },
      { id: 'notification_type_config', label: 'Notification Config', description: 'Notification type enable/disable settings' },
      { id: 'activity_log_config', label: 'Activity Log Config', description: 'Activity log action visibility settings' },
    ]
  }
];

const BACKUP_TABLES = BACKUP_TABLE_GROUPS.flatMap(g => g.tables);

export function BackupRestore() {
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [lastFullBackup, setLastFullBackup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupType, setBackupType] = useState<'full' | 'differential'>('full');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge' | 'update'>('merge');
  const [restoreFailureMode, setRestoreFailureMode] = useState<'partial' | 'atomic'>('partial');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedBackupData, setUploadedBackupData] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Table selection for backup
  const [selectedBackupTables, setSelectedBackupTables] = useState<string[]>(BACKUP_TABLES.map(t => t.id));
  const [selectAllBackup, setSelectAllBackup] = useState(true);

  // Table selection for restore
  const [selectedRestoreTables, setSelectedRestoreTables] = useState<string[]>([]);
  const [selectAllRestore, setSelectAllRestore] = useState(true);

  const toggleBackupTable = (tableId: string) => {
    setSelectedBackupTables(prev => {
      const newSelection = prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId];
      setSelectAllBackup(newSelection.length === BACKUP_TABLES.length);
      return newSelection;
    });
  };

  const toggleAllBackupTables = () => {
    if (selectAllBackup) {
      setSelectedBackupTables([]);
      setSelectAllBackup(false);
    } else {
      setSelectedBackupTables(BACKUP_TABLES.map(t => t.id));
      setSelectAllBackup(true);
    }
  };

  const toggleRestoreTable = (tableId: string) => {
    setSelectedRestoreTables(prev => {
      const availableTables = Object.keys(uploadedBackupData?.data || {});
      const newSelection = prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId];
      setSelectAllRestore(newSelection.length === availableTables.length);
      return newSelection;
    });
  };

  const toggleAllRestoreTables = () => {
    const availableTables = Object.keys(uploadedBackupData?.data || {});
    if (selectAllRestore) {
      setSelectedRestoreTables([]);
      setSelectAllRestore(false);
    } else {
      setSelectedRestoreTables(availableTables);
      setSelectAllRestore(true);
    }
  };

  // Load backup history and last full backup
  const loadBackupData = async () => {
    try {
      const [history, lastFull] = await Promise.all([
        api.backups.getAll(),
        api.backups.getLastFull()
      ]);
      setBackupHistory(history || []);
      setLastFullBackup(lastFull);
    } catch (error) {
      console.error('Failed to load backup data:', error);
      toast.error('Failed to load backup history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackupData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBackupData();
      toast.success('Backup history refreshed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateBackup = async () => {
    if (backupType === 'differential' && !lastFullBackup) {
      toast.error('Please create a full backup first before creating a differential backup');
      return;
    }

    if (selectedBackupTables.length === 0) {
      toast.error('Please select at least one table to backup');
      return;
    }

    setIsCreatingBackup(true);
    try {
      const result = await api.backups.create(backupType, ['device'], selectedBackupTables);

      if (result && result.data) {
        // Download the backup file
        const jsonString = JSON.stringify(result.data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.metadata.type === 'full'
          ? `backup_full_${new Date().toISOString().split('T')[0]}.json`
          : `backup_diff_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`${backupType === 'full' ? 'Full' : 'Differential'} backup created and downloaded`);
        loadBackupData(); // Refresh history
      }
    } catch (error: any) {
      console.error('Failed to create backup:', error);
      toast.error(error?.message || 'Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.metadata && data.data) {
            setUploadedBackupData(data);
            // Set available restore tables based on backup content
            const availableTables = Object.keys(data.data).filter(t => (data.data[t] || []).length > 0);
            setSelectedRestoreTables(availableTables);
            setSelectAllRestore(true);
            toast.success('Backup file loaded successfully');
          } else {
            toast.error('Invalid backup file format');
            setSelectedFile(null);
          }
        } catch {
          toast.error('Failed to parse backup file');
          setSelectedFile(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePreview = async () => {
    if (!uploadedBackupData) {
      toast.error('Please select a backup file first');
      return;
    }

    if (selectedRestoreTables.length === 0) {
      toast.error('Please select at least one table to restore');
      return;
    }

    try {
      const preview = await api.backups.preview(uploadedBackupData, restoreMode, selectedRestoreTables);
      setPreviewData(preview);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Failed to preview restore:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  const handleRestore = async () => {
    if (!uploadedBackupData) {
      toast.error('Please select a backup file first');
      return;
    }

    if (selectedRestoreTables.length === 0) {
      toast.error('Please select at least one table to restore');
      return;
    }

    const tableList = selectedRestoreTables.join(', ');
    if (!confirm(`Are you sure you want to restore the following tables using "${restoreMode}" mode?\n\n${tableList}\n\nThis action may modify your data.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const result = await api.backups.restore(uploadedBackupData, restoreMode, selectedRestoreTables, restoreFailureMode);
      
      if (result.success) {
        toast.success('Backup restored successfully');
        setUploadedBackupData(null);
        setSelectedFile(null);
        setPreviewData(null);
        setShowPreview(false);
      } else {
        toast.error('Some tables failed to restore. Check console for details.');
        console.error('Restore results:', result);
      }
    } catch (error: any) {
      console.error('Failed to restore backup:', error);
      if (error.failedTable) {
        toast.error(`Restore stopped: table '${error.failedTable}' failed — ${error.message}`);
      } else {
        toast.error(getFriendlyMessage(error));
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup record?')) {
      return;
    }

    try {
      await api.backups.delete(backupId);
      toast.success('Backup record deleted');
      loadBackupData();
    } catch (error: any) {
      console.error('Failed to delete backup:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Backup & Restore
          </h2>
          <p className="text-sm text-muted-foreground">
            Create backups and restore your data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Create Backup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Create Backup
          </CardTitle>
          <CardDescription>
            Create a full or differential backup of your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Backup */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                backupType === 'full' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setBackupType('full')}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                  backupType === 'full' ? 'border-primary' : 'border-muted-foreground'
                }`}>
                  {backupType === 'full' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Full Backup
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete snapshot of all data. Recommended weekly/monthly.
                  </p>
                </div>
              </div>
            </div>

            {/* Differential Backup */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                backupType === 'differential' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${!lastFullBackup ? 'opacity-50' : ''}`}
              onClick={() => lastFullBackup && setBackupType('differential')}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                  backupType === 'differential' ? 'border-primary' : 'border-muted-foreground'
                }`}>
                  {backupType === 'differential' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <FileJson className="w-4 h-4" />
                    Differential Backup
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only changes since last full backup. Smaller & faster.
                  </p>
                  {lastFullBackup ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Based on: {formatDate(lastFullBackup.createdAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-warning-text mt-2">
                      Requires a full backup first
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table Selection for Backup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Tables to Backup</Label>
              <Button variant="ghost" size="sm" onClick={toggleAllBackupTables}>
                {selectAllBackup ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="space-y-6 mt-4">
              {BACKUP_TABLE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h4 className="text-sm font-semibold tracking-tight text-foreground/80 uppercase">{group.title}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.tables.map((table) => (
                      <div
                        key={table.id}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                          selectedBackupTables.includes(table.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleBackupTable(table.id)}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          selectedBackupTables.includes(table.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                          {selectedBackupTables.includes(table.id) && (
                            <CheckCircle className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{table.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{table.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedBackupTables.length} of {BACKUP_TABLES.length} tables selected
            </p>
          </div>

          <Button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup || selectedBackupTables.length === 0}
            className="w-full sm:w-auto"
          >
            {isCreatingBackup ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating Backup...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Create & Download {backupType === 'full' ? 'Full' : 'Differential'} Backup
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Restore Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Restore from Backup
          </CardTitle>
          <CardDescription>
            Upload a backup file to restore your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Select Backup File</Label>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="flex-1"
              />
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Backup Info */}
          {uploadedBackupData && (
            <Alert>
              <FileJson className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Type:</strong> {uploadedBackupData.metadata.type === 'full' ? 'Full Backup' : 'Differential Backup'}</p>
                  <p><strong>Created:</strong> {formatDate(uploadedBackupData.metadata.createdAt)}</p>
                  <p><strong>Records:</strong> {Object.entries(uploadedBackupData.metadata.recordCounts || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Restore Mode */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Restore Mode</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Merge Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreMode === 'merge'
                    ? 'border-success/30 bg-success-soft shadow-sm'
                    : 'border-border hover:border-success/30 hover:bg-success-soft/50'
                }`}
                onClick={() => setRestoreMode('merge')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreMode === 'merge' ? 'border-success/30 bg-success' : 'border-muted-foreground'
                  }`}>
                    {restoreMode === 'merge' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <Plus className="w-4 h-4 text-success-text" />
                      Merge
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add new records only. Existing records are kept unchanged.
                    </p>
                    <Badge variant="outline" className="mt-2 text-success-text border-success/30">Safest Option</Badge>
                  </div>
                </div>
              </div>

              {/* Update Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreMode === 'update'
                    ? 'border-info/30 bg-info-soft shadow-sm'
                    : 'border-border hover:border-info/30 hover:bg-info-soft/50'
                }`}
                onClick={() => setRestoreMode('update')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreMode === 'update' ? 'border-info/30 bg-info' : 'border-muted-foreground'
                  }`}>
                    {restoreMode === 'update' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-info-text" />
                      Update
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Update existing records and add new ones.
                    </p>
                    <Badge variant="outline" className="mt-2 text-info-text border-info/30">Recommended</Badge>
                  </div>
                </div>
              </div>

              {/* Replace Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreMode === 'replace'
                    ? 'border-destructive/30 bg-destructive/10 shadow-sm'
                    : 'border-border hover:border-destructive/30 hover:bg-destructive/10'
                }`}
                onClick={() => setRestoreMode('replace')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreMode === 'replace' ? 'border-destructive/30 bg-destructive' : 'border-muted-foreground'
                  }`}>
                    {restoreMode === 'replace' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-destructive" />
                      Replace
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Delete all existing data and import from backup.
                    </p>
                    <Badge variant="outline" className="mt-2 text-destructive border-destructive/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Destructive
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Restore Failure Mode */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Restore Failure Mode</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Partial Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreFailureMode === 'partial'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setRestoreFailureMode('partial')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreFailureMode === 'partial' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {restoreFailureMode === 'partial' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      Partial
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Continue restoring other tables if one fails
                    </p>
                  </div>
                </div>
              </div>

              {/* Atomic Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreFailureMode === 'atomic'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setRestoreFailureMode('atomic')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreFailureMode === 'atomic' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {restoreFailureMode === 'atomic' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      Atomic
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Stop immediately if any table fails
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table Selection for Restore */}
          {uploadedBackupData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Tables to Restore</Label>
                <Button variant="ghost" size="sm" onClick={toggleAllRestoreTables}>
                  {selectAllRestore ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="space-y-6 mt-4">
                {BACKUP_TABLE_GROUPS.map((group) => {
                  const groupTables = group.tables.filter(t => {
                    const tableData = uploadedBackupData.data?.[t.id];
                    return tableData && tableData.length > 0;
                  });

                  if (groupTables.length === 0) return null;

                  return (
                    <div key={group.title} className="space-y-3">
                      <h4 className="text-sm font-semibold tracking-tight text-foreground/80 uppercase">{group.title}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {groupTables.map((table) => {
                          const tableId = table.id;
                          const recordCount = uploadedBackupData.data[tableId].length;
                          return (
                            <div
                              key={tableId}
                              className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                                selectedRestoreTables.includes(tableId)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => toggleRestoreTable(tableId)}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                selectedRestoreTables.includes(tableId) ? 'bg-primary border-primary' : 'border-muted-foreground'
                              }`}>
                                {selectedRestoreTables.includes(tableId) && (
                                  <CheckCircle className="w-3 h-3 text-primary-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{table.label}</p>
                                <p className="text-xs text-muted-foreground">{recordCount} records</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedRestoreTables.length} tables selected for restore
              </p>
            </div>
          )}

          {/* Preview */}
          {showPreview && previewData && (
            <Alert>
              <AlertDescription>
                <h4 className="font-medium mb-2">Restore Preview ({previewData.mode} mode)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(previewData.tables || {}).map(([table, info]: [string, any]) => (
                    <div key={table} className="p-2 bg-muted rounded">
                      <p className="font-medium">{table}</p>
                      <p>Current: {info.currentCount}</p>
                      <p>Backup: {info.backupCount}</p>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!uploadedBackupData}
            >
              Preview Changes
            </Button>
            <Button
              onClick={handleRestore}
              disabled={!uploadedBackupData || isRestoring}
              variant={restoreMode === 'replace' ? 'destructive' : 'default'}
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Restore Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Backup History
          </CardTitle>
          <CardDescription>
            Recent backup operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No backups created yet. Create your first backup above.
            </p>
          ) : (
            <div className="space-y-3">
              {backupHistory.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {backup.type === 'full' ? (
                      <Database className="w-5 h-5 text-info-text" />
                    ) : (
                      <FileJson className="w-5 h-5 text-success-text" />
                    )}
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {backup.type === 'full' ? 'Full Backup' : 'Differential Backup'}
                        {backup.status === 'completed' && <CheckCircle className="w-4 h-4 text-success-text" />}
                        {backup.status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                        {backup.status === 'in_progress' && <RefreshCw className="w-4 h-4 text-info-text animate-spin" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(backup.createdAt)} • {formatFileSize(backup.fileSize)}
                      </p>
                      {backup.recordCounts && (
                        <p className="text-xs text-muted-foreground">
                          {Object.values(backup.recordCounts).reduce((a: number, b: any) => a + (b || 0), 0)} total records
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={backup.status === 'completed' ? 'default' : backup.status === 'failed' ? 'destructive' : 'secondary'}>
                      {backup.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
