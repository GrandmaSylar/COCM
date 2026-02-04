import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Download, LogIn, LogOut, Plus, Pencil, Trash2, CheckCircle, XCircle, Shield, ShieldOff, ClipboardList } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { exportToCSV, exportToPDF, exportToXLSX } from '../utils/export';

interface ActivityEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: any;
  createdAt: string;
}

const actionIcons: Record<string, any> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  login: LogIn,
  logout: LogOut,
  approve: CheckCircle,
  reject: XCircle,
  grant: Shield,
  revoke: ShieldOff,
};

const actionColors: Record<string, string> = {
  create: 'text-green-500',
  update: 'text-blue-500',
  delete: 'text-red-500',
  login: 'text-emerald-500',
  logout: 'text-gray-500',
  approve: 'text-green-600',
  reject: 'text-red-600',
  grant: 'text-purple-500',
  revoke: 'text-orange-500',
};

export function ActivityLog() {
  const { isDev } = useAuth();
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, entityFilter, startDate, endDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 30 };
      if (actionFilter !== 'all') params.action = actionFilter;
      if (entityFilter !== 'all') params.entityType = entityFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await api.activityLog.getAll(params);
      setLogs(data?.logs || []);
      setTotal(data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const params: any = {};
      if (actionFilter !== 'all') params.action = actionFilter;
      if (entityFilter !== 'all') params.entityType = entityFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await api.activityLog.export(params);
      const exportData = (data?.logs || []).map((l: ActivityEntry) => ({
        date: new Date(l.createdAt).toLocaleString(),
        user: l.userName,
        role: l.userRole,
        action: l.action,
        type: l.entityType,
        description: l.description,
      }));

      const columns = [
        { key: 'date', label: 'Date' },
        { key: 'user', label: 'User' },
        { key: 'role', label: 'Role' },
        { key: 'action', label: 'Action' },
        { key: 'type', label: 'Type' },
        { key: 'description', label: 'Description' },
      ];

      if (format === 'csv') {
        exportToCSV(exportData, 'activity-log', columns);
      } else if (format === 'excel') {
        exportToXLSX(exportData, 'activity-log', columns);
      } else {
        exportToPDF(exportData, 'activity-log', 'Activity Log', columns);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-amber-500" />
          </div>
          <h1>Activity Log</h1>
        </div>
        {/* Export buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-secondary/30 text-secondary hover:bg-secondary/10 hover:text-secondary" onClick={() => handleExport('csv')} disabled={exporting}>
            <Download className="w-3 h-3 mr-1" />CSV
          </Button>
          <Button variant="outline" size="sm" className="border-secondary/30 text-secondary hover:bg-secondary/10 hover:text-secondary" onClick={() => handleExport('excel')} disabled={exporting}>
            <Download className="w-3 h-3 mr-1" />Excel
          </Button>
          <Button variant="outline" size="sm" className="border-secondary/30 text-secondary hover:bg-secondary/10 hover:text-secondary" onClick={() => handleExport('pdf')} disabled={exporting}>
            <Download className="w-3 h-3 mr-1" />PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="grant">Grant</SelectItem>
            <SelectItem value="revoke">Revoke</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="attendance">Attendance</SelectItem>
            <SelectItem value="giving">Giving</SelectItem>
            <SelectItem value="visitor">Visitor</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="session">Session</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="w-[150px]"
          placeholder="From"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="w-[150px]"
          placeholder="To"
        />
        {(actionFilter !== 'all' || entityFilter !== 'all' || startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setActionFilter('all'); setEntityFilter('all'); setStartDate(''); setEndDate(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No activity logs found.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {logs.map((log) => {
              const IconComp = actionIcons[log.action] || Plus;
              const iconColor = actionColors[log.action] || 'text-gray-500';
              return (
                <div key={log.id} className="flex items-start gap-3 p-3">
                  <div className={`mt-0.5 ${iconColor}`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.description}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{log.userName}</span>
                      <span>&middot;</span>
                      <span className="capitalize">{log.userRole}</span>
                      <span>&middot;</span>
                      <span>{formatTime(log.createdAt)}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    log.action === 'create' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    log.action === 'update' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    log.action === 'delete' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    log.action === 'login' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {log.action}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page} of {Math.ceil(total / 30)}</span>
          <Button variant="outline" size="sm" disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {!isDev && (
        <p className="text-xs text-muted-foreground text-center">You are viewing your own activity. Developers can view all user activity.</p>
      )}
    </div>
  );
}
