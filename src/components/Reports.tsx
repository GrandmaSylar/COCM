import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart3, Users, Calendar, DollarSign, TrendingUp, Download } from 'lucide-react';
import { Button } from './ui/button';
import { formatGhanaCedis } from './ui/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { api } from '../services/api';

export function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState('year');
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [givingData, setGivingData] = useState<any[]>([]);
  const [membershipData, setMembershipData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalMembers: 0,
    avgAttendance: 0,
    totalGiving: 0,
    growthRate: 0,
    attendanceRate: 0,
    givingParticipation: 0,
    servicesHeld: 0,
    newMembersThisMonth: 0,
    monthlyGiving: 0,
    monthlyAvgAttendance: 0
  });

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const data = await api.reports.getReports(selectedPeriod);
        setAttendanceData(data.attendanceData || []);
        setGivingData(data.givingData || []);
        setMembershipData(data.membershipData || []);
        setSummary(data.summary || {
          totalMembers: 0,
          avgAttendance: 0,
          totalGiving: 0,
          growthRate: 0,
          attendanceRate: 0,
          givingParticipation: 0,
          servicesHeld: 0,
          newMembersThisMonth: 0,
          monthlyGiving: 0,
          monthlyAvgAttendance: 0
        });
      } catch (error) {
        console.error('Failed to fetch reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [selectedPeriod]);

  const exportReport = () => {
    alert('Report export functionality would be implemented here');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Reports & Analytics</h1>
          <p className="text-muted-foreground">
            View church statistics and trends
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalMembers}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.avgAttendance}</p>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatGhanaCedis(summary.totalGiving)}</p>
                <p className="text-sm text-muted-foreground">Total Giving</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">+{summary.growthRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Growth Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Attendance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Line 
                  type="monotone" 
                  dataKey="attendance" 
                  stroke="#1B4D3E" 
                  strokeWidth={2}
                  dot={{ fill: '#1B4D3E' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Giving Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Giving Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={givingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Bar dataKey="amount" fill="#FFD700" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Membership Growth */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Membership Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={membershipData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Line 
                type="monotone" 
                dataKey="members" 
                stroke="#1B4D3E" 
                strokeWidth={2}
                name="Total Members"
                dot={{ fill: '#1B4D3E' }}
              />
              <Line 
                type="monotone" 
                dataKey="newMembers" 
                stroke="#FFD700" 
                strokeWidth={2}
                name="New Members"
                dot={{ fill: '#FFD700' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Services Held</span>
              <span className="font-medium">{summary.servicesHeld}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Average Attendance</span>
              <span className="font-medium">{summary.monthlyAvgAttendance} people</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">New Members</span>
              <span className="font-medium">{summary.newMembersThisMonth} people</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Giving</span>
              <span className="font-medium">{formatGhanaCedis(summary.monthlyGiving)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Growth Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Attendance Rate</span>
                <span className="text-sm font-medium">{summary.attendanceRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(summary.attendanceRate, 100)}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Member Retention</span>
                <span className="text-sm font-medium">-</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Giving Participation</span>
                <span className="text-sm font-medium">{summary.givingParticipation.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-accent h-2 rounded-full" style={{ width: `${Math.min(summary.givingParticipation, 100)}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}