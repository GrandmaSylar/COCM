import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Users, Calendar, Banknote, TrendingUp, Download, ChevronDown, BarChart3, PieChart as PieChartIcon, Activity, RefreshCw, Heart, Smile, Award, Receipt } from 'lucide-react';
import { Button } from './ui/button';
import { formatGhanaCedis, getExpenseKey } from './ui/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  Tooltip, Legend, ComposedChart
} from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { api, invalidateApiCache } from '../services/api';
import { exportToCSV, exportToPDF, exportToXLSX } from '../utils/export';
import { OfflineOverlay } from './OfflineOverlay';

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  'semi-active': '#eab308',
  inactive: '#ef4444',
  new: '#3b82f6',
  sick: '#a855f7',
  traveled: '#a855f7',
  schooling: '#a855f7',
  'not baptised': '#94a3b8',
  blacklisted: '#6b7280',
  unknown: '#9ca3af',
};

const ZONE_COLORS = ['#1B4D3E', '#FFD700', '#3b82f6', '#ef4444', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

const GIVING_TYPE_COLORS = ['#1B4D3E', '#FFD700', '#f97316', '#a855f7'];

const ATTENDANCE_COLORS: Record<string, string> = {
  Men: '#3b82f6',
  Women: '#ec4899',
  Children: '#eab308',
  Visitors: '#a855f7',
};

const GENDER_COLORS: Record<string, string> = {
  male: '#0ea5e9',   // Cyan/Blue
  female: '#f43f5e', // Rose/Pink
  unknown: '#94a3b8', // Slate
};

const MARITAL_COLORS: Record<string, string> = {
  single: '#6366f1',   // Indigo
  married: '#10b981',  // Emerald
  divorced: '#f59e0b', // Amber
  widowed: '#6b7280',  // Gray
  unknown: '#94a3b8',  // Slate
};

const CustomTooltip = ({ active, payload, label, prefix, isCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {isCurrency ? formatGhanaCedis(entry.value) : `${prefix || ''}${entry.value.toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload, isCurrency }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload.fill }} />
        <span className="font-medium">{entry.name}:</span>
        <span>{isCurrency ? formatGhanaCedis(entry.value) : entry.value.toLocaleString()}</span>
      </div>
    </div>
  );
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function Reports() {
  const requestCounterRef = useRef(0);
  const [selectedPeriod, setSelectedPeriod] = useState('year');
  const [selectedScope, setSelectedScope] = useState('main');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [givingData, setGivingData] = useState<any[]>([]);
  const [membershipData, setMembershipData] = useState<any[]>([]);
  const [membersByStatus, setMembersByStatus] = useState<any[]>([]);
  const [membersByZone, setMembersByZone] = useState<any[]>([]);
  const [membersByGender, setMembersByGender] = useState<any[]>([]);
  const [membersByMaritalStatus, setMembersByMaritalStatus] = useState<any[]>([]);
  const [membersByMinistry, setMembersByMinistry] = useState<any[]>([]);
  const [membersByAge, setMembersByAge] = useState<any[]>([]);
  const [givingByType, setGivingByType] = useState<any[]>([]);
  const [attendanceDenominations, setAttendanceDenominations] = useState<any[]>([]);
  const [visitorConversion, setVisitorConversion] = useState<any[]>([]);
  const [visitorConversionRate, setVisitorConversionRate] = useState(0);
  const [expenseRecords, setExpenseRecords] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState(false);
  const [summary, setSummary] = useState({
    totalMembers: 0,
    avgAttendance: 0,
    totalGiving: 0,
    growthRate: 0,
    attendanceRate: 0,
    memberRetention: 0,
    givingParticipation: 0,
    servicesHeld: 0,
    newMembersThisMonth: 0,
    monthlyGiving: 0,
    monthlyAvgAttendance: 0,
    avgGivingPerService: 0,
    mostActiveZone: 'N/A',
    activeMembers: 0,
    mainTotalMembers: 0,
    childrenTotalMembers: 0,
    mainAvgAttendance: 0,
    childrenAvgAttendance: 0,
    mainTotalGiving: 0,
    childrenTotalGiving: 0,
    totalVisitors: 0,
    mainTotalVisitors: 0,
    childrenTotalVisitors: 0,
  });

  const fetchReports = async (showLoading = true) => {
    requestCounterRef.current += 1;
    const currentRequestId = requestCounterRef.current;

    // 1. Kick off expenses fetch concurrently
    setExpensesLoading(true);
    setExpensesError(false);
    (async () => {
      if (selectedScope === 'children') {
        setExpenseRecords([]);
        setTotalExpenses(0);
        setExpensesLoading(false);
        return;
      }
      try {
        const expenses = await api.expenses.getAll();
        
        if (requestCounterRef.current !== currentRequestId) return;
        
        setExpenseRecords(expenses || []);
        const now = new Date();
        let periodStart: Date;
        switch (selectedPeriod) {
          case 'month':
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            break;
          case '6months':
            periodStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            break;
          case '2years':
            periodStart = new Date(now.getFullYear() - 2, now.getMonth(), 1);
            break;
          default: // year
            periodStart = new Date(now.getFullYear(), 0, 1);
            break;
        }
        const filteredExpenses = (expenses || []).filter((exp: any) => {
          const d = new Date(exp.serviceDate);
          return d >= periodStart && d <= now;
        });
        setTotalExpenses(filteredExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0));
      } catch (error) {
        if (requestCounterRef.current !== currentRequestId) return;
        setExpenseRecords([]);
        setTotalExpenses(0);
        setExpensesError(true);
      } finally {
        if (requestCounterRef.current === currentRequestId) {
          setExpensesLoading(false);
        }
      }
    })();

    // 2. Await reports fetch
    try {
      if (showLoading) setLoading(true);
      const data = await api.reports.getReports(selectedPeriod, selectedScope);
      
      if (requestCounterRef.current !== currentRequestId) return;

      setAttendanceData(data.attendanceData || []);
      setGivingData(data.givingData || []);
      setMembershipData(data.membershipData || []);
      setMembersByStatus(data.membersByStatus || []);
      setMembersByZone(data.membersByZone || []);
      setMembersByGender(data.membersByGender || []);
      setMembersByMaritalStatus(data.membersByMaritalStatus || []);
      setMembersByMinistry(data.membersByMinistry || []);
      setMembersByAge(data.membersByAge || []);
      setGivingByType(data.givingByType || []);
      setAttendanceDenominations(data.attendanceDenominations || []);
      setVisitorConversion(data.visitorConversion || []);
      setVisitorConversionRate(data.visitorConversionRate || 0);
      setSummary(prev => ({ ...prev, ...(data.summary || {}) }));
    } catch (error) {
      if (requestCounterRef.current !== currentRequestId) return;
      console.error('Failed to fetch reports:', error);
    } finally {
      if (requestCounterRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedPeriod, selectedScope]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchReports();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = (format: 'csv' | 'pdf' | 'xlsx') => {
    const exportData = attendanceData.map((item, i) => ({
      month: item.month,
      avgAttendance: item.attendance,
      individualAttendance: item.individual || 0,
      generalAttendance: item.general || 0,
      totalGiving: givingData[i]?.amount || 0,
      offering: givingData[i]?.offering || 0,
      donation: givingData[i]?.donation || 0,
      thanksgiving: givingData[i]?.thanksgiving || 0,
      totalMembers: membershipData[i]?.members || 0,
      newMembers: membershipData[i]?.newMembers || 0,
    }));

    const columns = [
      { key: 'month', label: 'Month' },
      { key: 'avgAttendance', label: 'Avg Attendance' },
      { key: 'individualAttendance', label: 'Individual Attendance' },
      { key: 'generalAttendance', label: 'General Attendance' },
      { key: 'totalGiving', label: 'Total Giving (GH₵)' },
      { key: 'offering', label: 'Offering (GH₵)' },
      { key: 'donation', label: 'Donation (GH₵)' },
      { key: 'thanksgiving', label: 'Thanksgiving (GH₵)' },
      { key: 'totalMembers', label: 'Total Members' },
      { key: 'newMembers', label: 'New Members' },
    ];

    const periodLabel = selectedPeriod === 'month' ? 'Monthly' : selectedPeriod === 'quarter' ? 'Quarterly' : selectedPeriod === '6months' ? '6-Month' : selectedPeriod === '2years' ? '2-Year' : 'Annual';
    const filename = `church-report-${periodLabel.toLowerCase()}-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      exportToCSV(exportData, filename, columns);
    } else if (format === 'pdf') {
      exportToPDF(exportData, filename, `Church Report - ${periodLabel}`, columns);
    } else {
      exportToXLSX(exportData, filename, columns);
    }
  };

  const periodLabel = selectedPeriod === 'month' ? 'This Month' : selectedPeriod === 'quarter' ? 'This Quarter' : selectedPeriod === '6months' ? 'Last 6 Months' : selectedPeriod === '2years' ? 'Last 2 Years' : 'This Year';

  if (loading) {
    return (
      <OfflineOverlay>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-64 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
      </OfflineOverlay>
    );
  }

  // Filter attendance data to only months with data for cleaner charts
  const hasData = (arr: any[], key: string) => arr.some(d => d[key] > 0);

  // Compute net giving & expense-related derived data
  const scopeTotalExpenses = selectedScope === 'children' ? 0 : totalExpenses;
  const netGiving = (summary.totalGiving || 0) - scopeTotalExpenses;

  // Build expenses by month (matching givingData month labels)
  const now = new Date();
  let periodStart: Date;
  switch (selectedPeriod) {
    case 'month':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case '6months':
      periodStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case '2years':
      periodStart = new Date(now.getFullYear() - 2, now.getMonth(), 1);
      break;
    default:
      periodStart = new Date(now.getFullYear(), 0, 1);
      break;
  }
  const filteredExpenseRecords = expenseRecords.filter((exp: any) => {
    const d = new Date(exp.serviceDate);
    return d >= periodStart && d <= now;
  });

  const expensesByMonthMap: Record<string, number> = {};
  filteredExpenseRecords.forEach((exp: any) => {
    const d = new Date(exp.serviceDate);
    const label = d.toLocaleString('default', { month: 'short' });
    expensesByMonthMap[label] = (expensesByMonthMap[label] || 0) + (exp.amount || 0);
  });

  // Merge expenses into givingData
  const mergedGivingData = givingData.map((item: any) => {
    const expenses = selectedScope === 'children' ? 0 : (expensesByMonthMap[item.month] || 0);
    return {
      ...item,
      expenses,
      netAmount: (item.amount || 0) - expenses,
    };
  });

  // Group expenses by service type for breakdown chart
  const expensesByServiceTypeMap: Record<string, number> = {};
  if (selectedScope !== 'children') {
    filteredExpenseRecords.forEach((exp: any) => {
      const stype = exp.serviceType || 'Other';
      expensesByServiceTypeMap[stype] = (expensesByServiceTypeMap[stype] || 0) + (exp.amount || 0);
    });
  }
  const expensesByServiceType = Object.entries(expensesByServiceTypeMap)
    .map(([type, amount]) => ({ type, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <OfflineOverlay>
      <div className="space-y-6 relative">
        {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground mb-2">
            Church statistics and trends — {periodLabel}
          </p>
          {selectedScope !== 'main' && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
              Viewing: {selectedScope === 'all' ? 'Merged (All)' : "Children's Data"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="2years">Last 2 Years</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedScope} onValueChange={(val) => { invalidateApiCache('/reports'); setSelectedScope(val); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main Data</SelectItem>
              <SelectItem value="children">Children's Data</SelectItem>
              <SelectItem value="all">Merged (All)</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>Export as Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 stagger-children">
        <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-blue-500/50 via-blue-500/40 to-transparent border border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
            <Users className="w-16 h-16 text-blue-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/40 flex items-center justify-center mb-3 text-blue-600 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform">{summary.totalMembers}</div>
            <div className="text-xs font-medium text-muted-foreground">Total Members</div>
            {summary.activeMembers > 0 && <div className="text-xs text-emerald-600 mt-0.5">{summary.activeMembers} active</div>}
            {selectedScope === 'all' && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Main: {summary.mainTotalMembers} &middot; Children: {summary.childrenTotalMembers}
              </div>
            )}
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-500/50 via-emerald-500/40 to-transparent border border-emerald-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
            <Calendar className="w-16 h-16 text-emerald-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/40 flex items-center justify-center mb-3 text-emerald-600 group-hover:scale-110 transition-transform duration-300">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform">{summary.avgAttendance}</div>
            <div className="text-xs font-medium text-muted-foreground">Avg Attendance</div>
            <div className="text-xs text-muted-foreground mt-0.5">{summary.servicesHeld} services</div>
            {selectedScope === 'all' && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Main: {summary.mainAvgAttendance} &middot; Children: {summary.childrenAvgAttendance}
              </div>
            )}
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-blue-500/50 via-blue-500/40 to-transparent border border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
            <Banknote className="w-16 h-16 text-blue-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/40 flex items-center justify-center mb-3 text-blue-600 group-hover:scale-110 transition-transform duration-300">
              <Banknote className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform truncate">{formatGhanaCedis(summary.totalGiving)}</div>
            <div className="text-xs font-medium text-muted-foreground">Total Giving</div>
            {summary.avgGivingPerService > 0 && <div className="text-xs text-muted-foreground mt-0.5">{formatGhanaCedis(summary.avgGivingPerService)}/service</div>}
            {selectedScope === 'all' && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Main: {formatGhanaCedis(summary.mainTotalGiving)} &middot; Children: {formatGhanaCedis(summary.childrenTotalGiving)}
              </div>
            )}
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-amber-500/50 via-amber-500/40 to-transparent border border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
            <TrendingUp className="w-16 h-16 text-amber-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/40 flex items-center justify-center mb-3 text-amber-600 group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform">{summary.growthRate > 0 ? '+' : ''}{summary.growthRate.toFixed(1)}%</div>
            <div className="text-xs font-medium text-muted-foreground">Growth Rate</div>
            <div className="text-xs text-muted-foreground mt-0.5">{summary.newMembersThisMonth} new this month</div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-cyan-500/50 via-cyan-500/40 to-transparent border border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
            <Smile className="w-16 h-16 text-cyan-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/40 flex items-center justify-center mb-3 text-cyan-600 group-hover:scale-110 transition-transform duration-300">
              <Smile className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform">{summary.totalVisitors || 0}</div>
            <div className="text-xs font-medium text-muted-foreground">Total Visitors</div>
            <div className="text-xs text-cyan-600 mt-0.5">{visitorConversionRate}% converted</div>
            {selectedScope === 'all' && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Main: {summary.mainTotalVisitors || 0} &middot; Children: {summary.childrenTotalVisitors || 0}
              </div>
            )}
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-teal-500/50 via-teal-500/40 to-transparent border border-teal-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
            <Receipt className="w-16 h-16 text-teal-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-teal-500/40 flex items-center justify-center mb-3 text-teal-600 group-hover:scale-110 transition-transform duration-300">
              <Receipt className="w-5 h-5" />
            </div>
            {expensesLoading ? (
              <>
                <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform truncate">
                  <Skeleton className="h-8 w-16 md:w-24" />
                </div>
                <div className="text-xs font-medium text-muted-foreground">Net Giving</div>
              </>
            ) : expensesError ? (
              <>
                <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform truncate">{formatGhanaCedis(summary.totalGiving || 0)}</div>
                <div className="text-xs font-medium text-muted-foreground">Net Giving</div>
                <div className="text-xs bg-yellow-50 text-yellow-700 rounded px-1.5 py-0.5 mt-1 inline-flex items-center gap-1">⚠ Expense data unavailable</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform truncate">{formatGhanaCedis(netGiving)}</div>
                <div className="text-xs font-medium text-muted-foreground">Net Giving</div>
                {scopeTotalExpenses > 0 && <div className="text-xs text-red-500 mt-0.5">{formatGhanaCedis(scopeTotalExpenses)} expenses</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 1: Attendance + Giving Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trends — Area Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              Attendance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={attendanceData}>
                <defs>
                  <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B4D3E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1B4D3E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorIndividual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorGeneral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {selectedScope === 'all' ? (
                  <>
                    <Area type="monotone" dataKey="mainAttendance" name="Main" stroke="#1B4D3E" fillOpacity={0} strokeWidth={2} />
                    <Area type="monotone" dataKey="childrenAttendance" name="Children" stroke="#6d28d9" fillOpacity={0} strokeWidth={2} />
                  </>
                ) : (
                  <>
                    {hasData(attendanceData, 'individual') && (
                      <Area type="monotone" dataKey="individual" name="Individual" stroke="#3b82f6" fill="url(#colorIndividual)" strokeWidth={2} />
                    )}
                    {hasData(attendanceData, 'general') && (
                      <Area type="monotone" dataKey="general" name="General" stroke="#f97316" fill="url(#colorGeneral)" strokeWidth={2} />
                    )}
                    {!hasData(attendanceData, 'individual') && !hasData(attendanceData, 'general') && (
                      <Area type="monotone" dataKey="attendance" name="Avg Attendance" stroke="#1B4D3E" fill="url(#colorAttendance)" strokeWidth={2} />
                    )}
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Giving Trends — Stacked Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="w-4 h-4" />
              Giving Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={mergedGivingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip isCurrency />} />
                <Legend />
                {selectedScope === 'all' ? (
                  <>
                    <Bar dataKey="mainAmount" stackId="giving" fill="#1B4D3E" name="Main" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="childrenAmount" stackId="giving" fill="#6d28d9" name="Children" radius={[4, 4, 0, 0]} />
                    {!expensesLoading && !expensesError && (
                      <>
                        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="netAmount" name="Net Giving" stroke="#14b8a6" strokeWidth={2} dot={false} />
                      </>
                    )}
                  </>
                ) : (
                  hasData(givingData, 'offering') ? (
                    <>
                      <Bar dataKey="offering" name="Offering" stackId="a" fill="#1B4D3E" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="donation" name="Donation" stackId="a" fill="#FFD700" />
                      <Bar dataKey="thanksgiving" name="Thanksgiving" stackId="a" fill="#f97316" />
                      {hasData(mergedGivingData, 'custom') && (
                        <Bar dataKey="custom" name="Custom" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      )}
                      {!expensesLoading && !expensesError && (
                        <>
                          <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="netAmount" name="Net Giving" stroke="#14b8a6" strokeWidth={2} dot={false} />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Bar dataKey="amount" name="Total Giving" fill="#FFD700" radius={[4, 4, 0, 0]} />
                      {!expensesLoading && !expensesError && (
                        <>
                          <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="netAmount" name="Net Giving" stroke="#14b8a6" strokeWidth={2} dot={false} />
                        </>
                      )}
                    </>
                  )
                )}
              </ComposedChart>
            </ResponsiveContainer>
            {expensesError && (
              <div className="text-xs bg-yellow-50 text-yellow-700 rounded px-1.5 py-0.5 mt-1 inline-flex items-center gap-1">⚠ Expense data unavailable — net giving line not shown</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Pie Charts — Member Status + Giving by Payment Method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Status Distribution */}
        {membersByStatus.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className="w-4 h-4" />
                Member Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={membersByStatus}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    dataKey="count"
                    nameKey="status"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {membersByStatus.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || STATUS_COLORS.unknown} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs capitalize">{value.replace('-', ' ')}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Attendance Breakdown by Denomination */}
        {attendanceDenominations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4" />
                Attendance Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={attendanceDenominations}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    dataKey="count"
                    nameKey="name"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {attendanceDenominations.map((entry, i) => (
                      <Cell key={i} fill={ATTENDANCE_COLORS[entry.name] || '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 3: Demographics and Ministry Participation */}
      <h3 className="text-lg font-semibold mt-8 mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        Congregational Insights
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender and Marital Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {membersByGender.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Gender Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={membersByGender}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      dataKey="count"
                      nameKey="gender"
                    >
                      {membersByGender.map((entry, i) => (
                        <Cell key={i} fill={GENDER_COLORS[entry.gender] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {membersByMaritalStatus.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Marital Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={membersByMaritalStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      dataKey="count"
                      nameKey="status"
                    >
                      {membersByMaritalStatus.map((entry, i) => (
                        <Cell key={i} fill={MARITAL_COLORS[entry.status] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : selectedScope === 'children' && (
            <Card className="flex items-center justify-center min-h-[200px]">
              <p className="text-muted-foreground text-sm">No data for this scope</p>
            </Card>
          )}
        </div>

        {/* Ministry Participation */}
        {membersByMinistry.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="w-4 h-4" />
                Ministry Participation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={membersByMinistry} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="ministry" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Age Breakdown */}
        {membersByAge.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4" />
                Age Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={membersByAge}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Visitor Conversion */}
        {visitorConversion.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smile className="w-4 h-4" />
                Visitor Conversion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={visitorConversion}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    dataKey="count"
                    nameKey="status"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {visitorConversion.map((entry, i) => (
                      <Cell key={i} fill={entry.status === 'Converted' ? '#22c55e' : '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 3: Bar Charts — Zones + Giving by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members by Zone */}
        {membersByZone.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4" />
                Members by Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={membersByZone} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="zone" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Members" radius={[0, 4, 4, 0]}>
                    {membersByZone.map((_, i) => (
                      <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : selectedScope === 'children' && (
          <Card className="flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground text-sm">No data for this scope</p>
          </Card>
        )}

        {/* Giving by Type */}
        {givingByType.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="w-4 h-4" />
                Giving by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={givingByType} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={70} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                    {givingByType.map((_, i) => (
                      <Cell key={i} fill={GIVING_TYPE_COLORS[i % GIVING_TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Expenses Breakdown by Service Type */}
      {selectedScope !== 'children' && (expensesLoading || expensesError || expensesByServiceType.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-4 h-4" />
              Expenses by Service Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expensesLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : expensesError ? (
              <div className="text-xs bg-yellow-50 text-yellow-700 rounded px-1.5 py-0.5 mt-1 inline-flex items-center gap-1">⚠ Expense data unavailable</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={expensesByServiceType} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Bar dataKey="amount" name="Expenses" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Membership Growth — Full Width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Membership Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={membershipData}>
              <defs>
                <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B4D3E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1B4D3E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {selectedScope === 'all' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="mainMembers"
                    name="Main Members"
                    stroke="#1B4D3E"
                    fill="url(#colorMembers)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="childrenMembers"
                    name="Children"
                    stroke="#6d28d9"
                    strokeWidth={2}
                  />
                </>
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="members"
                    name="Total Members"
                    stroke="#1B4D3E"
                    fill="url(#colorMembers)"
                    strokeWidth={2}
                    dot={{ fill: '#1B4D3E', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="newMembers"
                    name="New Members"
                    stroke="#FFD700"
                    strokeWidth={2}
                    dot={{ fill: '#FFD700', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Growth Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Growth Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Attendance Rate</span>
                <span className="text-sm font-medium">{summary.attendanceRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${Math.min(summary.attendanceRate, 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Member Retention</span>
                <span className="text-sm font-medium">{summary.memberRetention.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-green-500 transition-all duration-700"
                  style={{ width: `${Math.min(summary.memberRetention, 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Growth Rate</span>
                <span className="text-sm font-medium">{summary.growthRate > 0 ? '+' : ''}{summary.growthRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-orange-500 transition-all duration-700"
                  style={{ width: `${Math.min(Math.abs(summary.growthRate), 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Period Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Services Held</span>
              <span className="font-medium">{summary.servicesHeld}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Avg Attendance</span>
              <span className="font-medium">{summary.monthlyAvgAttendance} people</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Avg Giving / Service</span>
              <span className="font-medium">{formatGhanaCedis(summary.avgGivingPerService)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-sm text-muted-foreground">New Members (this month)</span>
              <span className="font-medium">{summary.newMembersThisMonth}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Monthly Giving</span>
              <span className="font-medium">{formatGhanaCedis(summary.monthlyGiving)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground">Most Active Zone</span>
              <span className="font-medium">{summary.mostActiveZone}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div></OfflineOverlay>
  );
}

