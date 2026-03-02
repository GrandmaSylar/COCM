import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { RefreshCw, Users, UserPlus, Banknote, CheckCircle, AlertTriangle, BarChart3, X, PieChart as PieChartIcon } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { formatGhanaCedis } from './ui/utils';
import { EmptyState } from './EmptyState';

const GENDER_COLORS: Record<string, string> = {
  male: '#0ea5e9',
  female: '#f43f5e',
  unknown: '#94a3b8',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label, prefix, isCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm z-50">
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
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm z-50">
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

export function ChildrenAnalytics() {
  const [period, setPeriod] = useState('1y');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<any>(null);
  
  // Custom logic to initialize sets from sessionStorage
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('children_analytics_dismissed_alerts');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const fetchAnalytics = async (showLoading = true) => {
    try {
      setError(false);
      if (showLoading) setLoading(true);
      
      const mappedPeriod = period === '3m' ? 'quarter' : period === '6m' ? '6months' : 'year';
      const res = await api.reports.getReports(mappedPeriod, 'children');
      
      const totalMembers = res.summary?.totalMembers || 0;
      
      setData({
        summary: {
          totalMembers,
          activeMembers: res.summary?.activeMembers || 0,
          visitorCount: res.summary?.totalVisitors || 0,
          totalGiving: res.summary?.totalGiving || 0,
          baptisedCount: 0
        },
        memberGrowth: (res.membershipData || []).map((item: any) => ({
          month: item.month,
          count: item.newMembers
        })),
        genderBreakdown: (res.membersByGender || []).reduce((acc: any, curr: any) => {
          if (curr.gender) acc[curr.gender.toLowerCase()] = curr.count;
          return acc;
        }, { male: 0, female: 0 }),
        ageDistribution: (res.membersByAge || [])
          .filter((item: any) => ['0-3 yrs', '4-6 yrs', '7-9 yrs', '10-12 yrs', '13-17 yrs'].includes(item.group))
          .map((item: any) => ({
            ageGroup: item.group,
            count: item.count
          })),
        attendanceTrend: (res.attendanceData || []).map((item: any) => ({
          month: item.month,
          rate: totalMembers > 0 ? Math.round((item.attendance / totalMembers) * 100) : 0
        })),
        givingTrend: res.givingData || [],
        visitorConversion: {
          total: res.summary?.totalVisitors || 0,
          converted: Math.round((res.summary?.totalVisitors || 0) * (res.visitorConversionRate || 0) / 100)
        },
        baptismStats: null,
        ageOutAlerts: []
      });
    } catch (err) {
      console.error('Failed to fetch analytics', err);
      setError(true);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const needsLoading = error || !data;
    await fetchAnalytics(needsLoading);
    setRefreshing(false);
  };

  const dismissAlert = (id: string) => {
    setDismissedAlerts(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      sessionStorage.setItem('children_analytics_dismissed_alerts', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Skeleton className="h-8 w-48 mb-2" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
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

  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold">Children's Analytics</h1>
        <p className="text-muted-foreground">Insights and trends for the Children's Ministry</p>
      </div>
      <div className="flex gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Last 3 Months</SelectItem>
            <SelectItem value="6m">Last 6 Months</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-6">
        {renderHeader()}
        <EmptyState
          icon={AlertTriangle}
          title="Could not load analytics data"
          description="Could not load analytics data. Please try again."
          action={{
            label: "Retry",
            onClick: () => fetchAnalytics(true)
          }}
        />
      </div>
    );
  }

  if (!data) return null;

  // The fields in data could be undefined if there was an error in the backend
  const {
    summary = { totalMembers: 0, activeMembers: 0, visitorCount: 0, totalGiving: 0, baptisedCount: 0 },
    memberGrowth = [],
    genderBreakdown = { male: 0, female: 0 },
    ageDistribution = { '0-5': 0, '6-10': 0, '11-14': 0, '15-17': 0 },
    attendanceTrend = [],
    givingTrend = [],
    visitorConversion = { total: 0, converted: 0 },
    baptismStats = null,
    ageOutAlerts = []
  } = data;

  const genderData = [
    { name: 'Male', value: genderBreakdown.male || 0 },
    { name: 'Female', value: genderBreakdown.female || 0 }
  ];

  const visitorData = [
    { name: 'Converted', value: visitorConversion.converted || 0 },
    { name: 'Not Converted', value: (visitorConversion.total || 0) - (visitorConversion.converted || 0) }
  ];

  const baptismData = baptismStats ? [
    { name: 'Baptised', value: baptismStats.baptised || 0 },
    { name: 'Not Baptised', value: baptismStats.notBaptised || 0 }
  ] : [];

  let formattedAgeDist: any[] = [];
  if (Array.isArray(ageDistribution)) {
    formattedAgeDist = ageDistribution;
  } else if (ageDistribution) {
    formattedAgeDist = [
      { ageGroup: '0-5', count: ageDistribution['0-5'] || 0 },
      { ageGroup: '6-10', count: ageDistribution['6-10'] || 0 },
      { ageGroup: '11-14', count: ageDistribution['11-14'] || 0 },
      { ageGroup: '15-17', count: ageDistribution['15-17'] || 0 }
    ];
  }

  const activeAlerts = (ageOutAlerts || []).filter((a: any) => !dismissedAlerts.has(a.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      {renderHeader()}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="w-6 h-6 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{summary.totalMembers}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Members</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle className="w-6 h-6 text-emerald-500 mb-2" />
            <div className="text-2xl font-bold">{summary.activeMembers}</div>
            <div className="text-xs text-muted-foreground font-medium">Active Members</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <UserPlus className="w-6 h-6 text-purple-500 mb-2" />
            <div className="text-2xl font-bold">{summary.visitorCount}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Visitors</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Banknote className="w-6 h-6 text-amber-500 mb-2" />
            <div className="text-2xl font-bold">{formatGhanaCedis(summary.totalGiving)}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Giving</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-white">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CheckCircle className="w-6 h-6 text-cyan-500 mb-2" />
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground font-medium">Baptised</div>
            <div className="text-[10px] italic text-muted-foreground mt-1">Data unavailable</div>
          </CardContent>
        </Card>
      </div>

      {/* Age-Out Alerts */}
      {activeAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Children turning 18 in the next 90 days
          </div>
          <div className="space-y-2">
            {activeAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center justify-between bg-white rounded border border-amber-100 p-2 text-sm shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{alert.firstName} {alert.lastName}</span>
                  <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                    Turns 18 on: {new Date(alert.turnsEighteenOn).toLocaleDateString()}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => dismissAlert(alert.id)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Member Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-primary" />
              Member Growth Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={memberGrowth}>
                <defs>
                  <linearGradient id="colorMembersGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="New Members" stroke="#3b82f6" fill="url(#colorMembersGrowth)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gender Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="w-4 h-4 text-primary" />
              Gender Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={renderCustomLabel} labelLine={false}>
                  {genderData.map((entry, index) => (
                    <Cell key={index} fill={GENDER_COLORS[entry.name.toLowerCase()] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Age Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={formattedAgeDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="ageGroup" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Monthly Attendance Rate (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={attendanceTrend}>
                <defs>
                  <linearGradient id="colorAttRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="rate" name="Attendance Rate" stroke="#10b981" fill="url(#colorAttRate)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Giving Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="w-4 h-4 text-primary" />
              Giving Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={givingTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip isCurrency />} />
                <Bar dataKey="amount" name="Total Giving" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Visitor Conversion Grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="w-4 h-4 text-primary" />
              Visitor Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={visitorData} cx="50%" cy="50%" innerRadius={50} outerRadius={100} dataKey="value" nameKey="name" label={renderCustomLabel} labelLine={false}>
                  {visitorData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Baptism Stats */}
        {baptismStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="w-4 h-4 text-primary" />
              Baptism Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={baptismData} cx="50%" cy="50%" innerRadius={50} outerRadius={100} dataKey="value" nameKey="name" label={renderCustomLabel} labelLine={false}>
                  {baptismData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}

      </div>
    </div>
  );
}
