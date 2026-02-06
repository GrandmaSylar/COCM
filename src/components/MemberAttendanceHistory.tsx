import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Download,
  Clock,
  AlertCircle,
  Shield,
  BarChart3,
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { api } from '../services/api';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF, exportToXLSX, formatDateForExport } from '../utils/export';

interface AttendanceHistoryRecord {
  date: string;
  serviceType: string;
  serviceName: string;
  startTime?: string;
  endTime?: string;
  status: 'present' | 'absent';
  absenceInfo: {
    requestedPermission: boolean;
    reason: string | null;
    reasonNotes: string | null;
    absenceStartDate: string | null;
    absenceEndDate: string | null;
    untilFurtherNotice: boolean;
  } | null;
}

interface AttendanceHistoryData {
  memberName: string;
  joinDate: string;
  summary: {
    totalServices: number;
    totalPresent: number;
    totalAbsent: number;
    percentage: number;
  };
  records: AttendanceHistoryRecord[];
}

interface MemberAttendanceHistoryProps {
  memberId: string;
  memberName: string;
  onBack: () => void;
}

const serviceTypeLabels: Record<string, string> = {
  sunday_morning: 'Sunday Main Service',
  sunday_evening: 'Sunday Evening',
  midweek: 'Midweek Service',
  special: 'Special Service',
  other: 'Other'
};

const serviceTypeColors: Record<string, string> = {
  sunday_morning: 'bg-blue-100 text-blue-800',
  sunday_evening: 'bg-purple-100 text-purple-800',
  midweek: 'bg-green-100 text-green-800',
  special: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800'
};

type PresetRange = 'this-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'last-year' | 'all-time';

function getPresetDates(preset: PresetRange, joinDate: string): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (preset) {
    case 'this-month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { from, to: today };
    }
    case 'last-3-months': {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from: d.toISOString().split('T')[0], to: today };
    }
    case 'last-6-months': {
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { from: d.toISOString().split('T')[0], to: today };
    }
    case 'this-year': {
      return { from: `${now.getFullYear()}-01-01`, to: today };
    }
    case 'last-year': {
      const y = now.getFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case 'all-time':
    default:
      return { from: joinDate, to: today };
  }
}

export function MemberAttendanceHistory({ memberId, memberName, onBack }: MemberAttendanceHistoryProps) {
  const [data, setData] = useState<AttendanceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activePreset, setActivePreset] = useState<PresetRange>('all-time');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const fetchHistory = async (from?: string, to?: string) => {
    setLoading(true);
    try {
      const result = await api.members.getAttendanceHistory(memberId, from, to);
      setData(result);
      if (!from && !to && result.joinDate) {
        setFromDate(result.joinDate);
        setToDate(new Date().toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error('Failed to fetch attendance history:', error);
      toast.error('Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [memberId]);

  const handlePreset = (preset: PresetRange) => {
    const joinDate = data?.joinDate || '2020-01-01';
    const { from, to } = getPresetDates(preset, joinDate);
    setFromDate(from);
    setToDate(to);
    setActivePreset(preset);
    fetchHistory(from, to);
  };

  const handleCustomRange = () => {
    if (fromDate && toDate) {
      setActivePreset('this-month'); // clear preset highlight
      fetchHistory(fromDate, toDate);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Export
  const exportColumns = [
    { key: 'date', label: 'Date' },
    { key: 'serviceType', label: 'Service Type' },
    { key: 'status', label: 'Status' },
    { key: 'permissionRequested', label: 'Permission Requested' },
    { key: 'reason', label: 'Reason' },
    { key: 'reasonNotes', label: 'Reason Notes' },
    { key: 'absenceStart', label: 'Absence Start' },
    { key: 'absenceEnd', label: 'Absence End' },
    { key: 'untilFurtherNotice', label: 'Until Further Notice' }
  ];

  const prepareExportData = () => {
    if (!data) return [];
    return data.records.map(r => ({
      date: formatDateForExport(r.date),
      serviceType: serviceTypeLabels[r.serviceType] || r.serviceType,
      status: r.status === 'present' ? 'Present' : 'Absent',
      permissionRequested: r.absenceInfo?.requestedPermission ? 'Yes' : r.status === 'absent' ? 'No' : '',
      reason: r.absenceInfo?.reason || '',
      reasonNotes: r.absenceInfo?.reasonNotes || '',
      absenceStart: r.absenceInfo?.absenceStartDate ? formatDateForExport(r.absenceInfo.absenceStartDate) : '',
      absenceEnd: r.absenceInfo?.absenceEndDate ? formatDateForExport(r.absenceInfo.absenceEndDate) : '',
      untilFurtherNotice: r.absenceInfo?.untilFurtherNotice ? 'Yes' : ''
    }));
  };

  const handleExportCSV = () => {
    exportToCSV(prepareExportData(), `${memberName.replace(/\s+/g, '_')}_attendance_history`, exportColumns);
  };
  const handleExportPDF = () => {
    exportToPDF(prepareExportData(), `${memberName.replace(/\s+/g, '_')}_attendance_history`, `Attendance History - ${memberName}`, exportColumns);
  };
  const handleExportXLSX = () => {
    exportToXLSX(prepareExportData(), `${memberName.replace(/\s+/g, '_')}_attendance_history`, exportColumns);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6 overflow-x-hidden w-full">
        <div className="flex items-center gap-4 overflow-hidden w-full min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate">Attendance History</h1>
            <p className="text-muted-foreground truncate">{memberName}</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const summary = data?.summary || { totalServices: 0, totalPresent: 0, totalAbsent: 0, percentage: 0 };
  const records = data?.records || [];

  const presets: { key: PresetRange; label: string }[] = [
    { key: 'this-month', label: 'This Month' },
    { key: 'last-3-months', label: 'Last 3 Months' },
    { key: 'last-6-months', label: 'Last 6 Months' },
    { key: 'this-year', label: 'This Year' },
    { key: 'last-year', label: 'Last Year' },
    { key: 'all-time', label: 'All Time' },
  ];

  return (
    <div className="space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full overflow-hidden">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate">Attendance History</h1>
            <p className="text-muted-foreground truncate">
              {memberName} {data?.joinDate && <>— Member since {formatShortDate(data.joinDate)}</>}
            </p>
          </div>
        </div>
        {records.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLSX}>Export as Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 w-full">
        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{summary.totalServices}</p>
                <p className="text-xs text-muted-foreground truncate">Total Services</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{summary.totalPresent}</p>
                <p className="text-xs text-muted-foreground truncate">Present</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{summary.totalAbsent}</p>
                <p className="text-xs text-muted-foreground truncate">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{summary.percentage}%</p>
                <p className="text-xs text-muted-foreground truncate">Attendance Rate</p>
              </div>
            </div>
            <div className="mt-2 w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min(summary.percentage, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Filters */}
      <Card className="w-full">
        <CardContent className="p-3 sm:p-4 space-y-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">Date Range</span>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 w-full">
            {presets.map(p => (
              <Button
                key={p.key}
                variant={activePreset === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePreset(p.key)}
                disabled={loading}
                className="text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Custom range */}
          <div className="flex flex-col gap-2 w-full">
            <div className="space-y-1 flex-1 min-w-0">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleCustomRange}
              disabled={!fromDate || !toDate || loading}
              className="w-full sm:w-auto"
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Records */}
      <div className="space-y-2 w-full overflow-hidden">
        <h2 className="text-lg font-semibold">
          Records {records.length > 0 && <span className="text-muted-foreground font-normal text-sm">({records.length})</span>}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No attendance records found for this date range.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 w-full overflow-hidden">
            {records.map((record, idx) => {
              const recordKey = `${record.date}-${record.serviceType}-${idx}`;
              const isExpanded = expandedRecord === recordKey;
              const hasAbsenceInfo = record.absenceInfo && (
                record.absenceInfo.requestedPermission ||
                record.absenceInfo.reason ||
                record.absenceInfo.reasonNotes
              );

              return (
                <Card
                  key={recordKey}
                  className={`transition-shadow w-full ${record.status === 'absent' && hasAbsenceInfo ? 'cursor-pointer hover:shadow-md' : ''}`}
                  onClick={() => {
                    if (record.status === 'absent' && hasAbsenceInfo) {
                      setExpandedRecord(isExpanded ? null : recordKey);
                    }
                  }}
                >
                  <CardContent className="p-2 sm:p-3 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
                      <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                        {record.status === 'present' ? (
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <XCircle className="w-4 h-4 text-red-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{formatDate(record.date)}</span>
                            <Badge className={`text-xs ${serviceTypeColors[record.serviceType] || 'bg-gray-100 text-gray-800'}`}>
                              {serviceTypeLabels[record.serviceType] || record.serviceType}
                            </Badge>
                          </div>
                          {record.startTime && record.endTime && (
                            <p className="text-xs text-muted-foreground">{record.startTime} - {record.endTime}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={record.status === 'present' ? 'default' : 'destructive'}>
                          {record.status === 'present' ? 'Present' : 'Absent'}
                        </Badge>
                        {record.status === 'absent' && record.absenceInfo?.requestedPermission && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 text-xs">
                            <Shield className="w-3 h-3 mr-1" />
                            Permission
                          </Badge>
                        )}
                        {record.status === 'absent' && hasAbsenceInfo && (
                          <span className="text-xs text-muted-foreground">{isExpanded ? 'Hide' : 'Details'}</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded absence details */}
                    {isExpanded && record.absenceInfo && (
                      <div className="mt-3 pt-3 border-t space-y-2 ml-6 sm:ml-11 min-w-0">
                        {record.absenceInfo.requestedPermission && (
                          <div className="flex items-center gap-2 text-sm">
                            <Shield className="w-4 h-4 text-yellow-600" />
                            <span className="font-medium">Permission was requested before absence</span>
                          </div>
                        )}
                        {record.absenceInfo.reason && (
                          <div className="flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            <span><strong>Reason:</strong> {record.absenceInfo.reason}</span>
                          </div>
                        )}
                        {record.absenceInfo.reasonNotes && (
                          <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            {record.absenceInfo.reasonNotes}
                          </div>
                        )}
                        {(record.absenceInfo.absenceStartDate || record.absenceInfo.absenceEndDate) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span>
                              <strong>Absence period:</strong>{' '}
                              {record.absenceInfo.absenceStartDate && formatShortDate(record.absenceInfo.absenceStartDate)}
                              {record.absenceInfo.absenceEndDate && ` — ${formatShortDate(record.absenceInfo.absenceEndDate)}`}
                              {record.absenceInfo.untilFurtherNotice && ' (Until further notice)'}
                            </span>
                          </div>
                        )}
                        {record.absenceInfo.untilFurtherNotice && !record.absenceInfo.absenceStartDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span><strong>Until further notice</strong></span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
