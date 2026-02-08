import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Users, Calendar, DollarSign, TrendingUp, Download, ChevronDown, BarChart3, PieChart as PieChartIcon, Activity, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { formatGhanaCedis } from './ui/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  Tooltip, Legend, ComposedChart
} from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { api } from '../services/api';
import { exportToCSV, exportToPDF, exportToXLSX } from '../utils/export';

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  'semi-active': '#eab308',
  inactive: '#ef4444',
  new: '#3b82f6',
  sabbatical: '#a855f7',
  blacklisted: '#6b7280',
  unknown: '#9ca3af',
};

const ZONE_COLORS = ['#1B4D3E', '#FFD700', '#3b82f6', '#ef4444', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

const GIVING_TYPE_COLORS = ['#1B4D3E', '#FFD700', '#f97316', '#a855f7'];

const PAYMENT_METHOD_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#6366f1'];

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
  const [selectedPeriod, setSelectedPeriod] = useState('year');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [givingData, setGivingData] = useState<any[]>([]);
  const [membershipData, setMembershipData] = useState<any[]>([]);
  const [membersByStatus, setMembersByStatus] = useState<any[]>([]);
  const [membersByZone, setMembersByZone] = useState<any[]>([]);
  const [givingByType, setGivingByType] = useState<any[]>([]);
  const [givingByPaymentMethod, setGivingByPaymentMethod] = useState<any[]>([]);
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
  });

  const fetchReports = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await api.reports.getReports(selectedPeriod);
      setAttendanceData(data.attendanceData || []);
      setGivingData(data.givingData || []);
      setMembershipData(data.membershipData || []);
      setMembersByStatus(data.membersByStatus || []);
      setMembersByZone(data.membersByZone || []);
      setGivingByType(data.givingByType || []);
      setGivingByPaymentMethod(data.givingByPaymentMethod || []);
      setSummary(prev => ({ ...prev, ...(data.summary || {}) }));
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedPeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const minDelay = new Promise(resolve => setTimeout(resolve, 800));
    try {
      await Promise.all([fetchReports(false), minDelay]);
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
    );
  }

  // Filter attendance data to only months with data for cleaner charts
  const hasData = (arr: any[], key: string) => arr.some(d => d[key] > 0);

  return (
    <div className="space-y-6 relative">
      {/* Refresh Overlay */}
      {refreshing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="bg-card p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border-2 border-primary/20 animate-refresh-card">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative bg-primary/10 p-4 rounded-full">
                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>
            <p className="text-base font-medium text-foreground">Refreshing reports...</p>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Church statistics and trends — {periodLabel}
          </p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 stagger-children">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{summary.totalMembers}</p>
                <p className="text-xs text-muted-foreground">Total Members</p>
                {summary.activeMembers > 0 && (
                  <p className="text-xs text-green-600">{summary.activeMembers} active</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{summary.avgAttendance}</p>
                <p className="text-xs text-muted-foreground">Avg Attendance</p>
                <p className="text-xs text-muted-foreground">{summary.servicesHeld} services</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{formatGhanaCedis(summary.totalGiving)}</p>
                <p className="text-xs text-muted-foreground">Total Giving</p>
                {summary.avgGivingPerService > 0 && (
                  <p className="text-xs text-muted-foreground">{formatGhanaCedis(summary.avgGivingPerService)}/service</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">
                  {summary.growthRate > 0 ? '+' : ''}{summary.growthRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Growth Rate</p>
                <p className="text-xs text-muted-foreground">{summary.newMembersThisMonth} new this month</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
                {hasData(attendanceData, 'individual') && (
                  <Area type="monotone" dataKey="individual" name="Individual" stroke="#3b82f6" fill="url(#colorIndividual)" strokeWidth={2} />
                )}
                {hasData(attendanceData, 'general') && (
                  <Area type="monotone" dataKey="general" name="General" stroke="#f97316" fill="url(#colorGeneral)" strokeWidth={2} />
                )}
                {!hasData(attendanceData, 'individual') && !hasData(attendanceData, 'general') && (
                  <Area type="monotone" dataKey="attendance" name="Avg Attendance" stroke="#1B4D3E" fill="url(#colorAttendance)" strokeWidth={2} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Giving Trends — Stacked Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4" />
              Giving Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={givingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip isCurrency />} />
                <Legend />
                {hasData(givingData, 'offering') ? (
                  <>
                    <Bar dataKey="offering" name="Offering" stackId="a" fill="#1B4D3E" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="donation" name="Donation" stackId="a" fill="#FFD700" />
                    <Bar dataKey="thanksgiving" name="Thanksgiving" stackId="a" fill="#f97316" />
                    {hasData(givingData, 'custom') && (
                      <Bar dataKey="custom" name="Custom" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    )}
                  </>
                ) : (
                  <Bar dataKey="amount" name="Total Giving" fill="#FFD700" radius={[4, 4, 0, 0]} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
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

        {/* Giving by Payment Method */}
        {givingByPaymentMethod.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-4 h-4" />
                Giving by Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={givingByPaymentMethod}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    dataKey="amount"
                    nameKey="method"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {givingByPaymentMethod.map((_, i) => (
                      <Cell key={i} fill={PAYMENT_METHOD_COLORS[i % PAYMENT_METHOD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip isCurrency />} />
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
        {membersByZone.length > 0 && (
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
        )}

        {/* Giving by Type */}
        {givingByType.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-4 h-4" />
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
    </div>
  );
}
