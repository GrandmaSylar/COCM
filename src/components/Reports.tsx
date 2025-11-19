import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart3, Users, Calendar, DollarSign, TrendingUp, Download } from 'lucide-react';
import { Button } from './ui/button';
import { formatGhanaCedis } from './ui/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Mock data for charts
const attendanceData = [
  { month: 'Jan', attendance: 180 },
  { month: 'Feb', attendance: 195 },
  { month: 'Mar', attendance: 210 },
  { month: 'Apr', attendance: 188 },
  { month: 'May', attendance: 225 },
  { month: 'Jun', attendance: 240 },
  { month: 'Jul', attendance: 235 },
  { month: 'Aug', attendance: 250 },
  { month: 'Sep', attendance: 265 },
  { month: 'Oct', attendance: 280 },
  { month: 'Nov', attendance: 290 },
  { month: 'Dec', attendance: 310 }
];

const givingData = [
  { month: 'Jan', amount: 21250.00 },
  { month: 'Feb', amount: 23000.00 },
  { month: 'Mar', amount: 25250.00 },
  { month: 'Apr', amount: 22000.00 },
  { month: 'May', amount: 28750.00 },
  { month: 'Jun', amount: 30500.00 },
  { month: 'Jul', amount: 29500.00 },
  { month: 'Aug', amount: 32750.00 },
  { month: 'Sep', amount: 32250.00 },
  { month: 'Oct', amount: 35500.00 },
  { month: 'Nov', amount: 34500.00 },
  { month: 'Dec', amount: 39000.00 }
];

const membershipData = [
  { month: 'Jan', members: 320, newMembers: 5 },
  { month: 'Feb', members: 325, newMembers: 8 },
  { month: 'Mar', members: 328, newMembers: 3 },
  { month: 'Apr', members: 332, newMembers: 6 },
  { month: 'May', members: 335, newMembers: 4 },
  { month: 'Jun', members: 338, newMembers: 7 },
  { month: 'Jul', members: 341, newMembers: 5 },
  { month: 'Aug', members: 342, newMembers: 2 },
  { month: 'Sep', members: 345, newMembers: 4 },
  { month: 'Oct', members: 348, newMembers: 6 },
  { month: 'Nov', members: 350, newMembers: 3 },
  { month: 'Dec', members: 355, newMembers: 8 }
];

export function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState('year');
  const [selectedReport, setSelectedReport] = useState('overview');

  const exportReport = () => {
    // Mock export functionality
    alert('Report export functionality would be implemented here');
  };

  // Calculate summary stats
  const currentMonth = new Date().getMonth();
  const totalMembers = membershipData[membershipData.length - 1].members;
  const avgAttendance = Math.round(attendanceData.reduce((sum, month) => sum + month.attendance, 0) / attendanceData.length);
  const totalGiving = givingData.reduce((sum, month) => sum + month.amount, 0);
  const growthRate = ((membershipData[membershipData.length - 1].members - membershipData[0].members) / membershipData[0].members * 100);

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
                <p className="text-2xl font-bold">{totalMembers}</p>
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
                <p className="text-2xl font-bold">{avgAttendance}</p>
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
                <p className="text-2xl font-bold">{formatGhanaCedis(totalGiving)}</p>
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
                <p className="text-2xl font-bold">+{growthRate.toFixed(1)}%</p>
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
              <span className="font-medium">16</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Average Attendance</span>
              <span className="font-medium">285 people</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">New Members</span>
              <span className="font-medium">8 people</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Giving</span>
              <span className="font-medium">₵39,000.00</span>
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
                <span className="text-sm font-medium">83.2%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '83.2%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Member Retention</span>
                <span className="text-sm font-medium">94.5%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '94.5%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Giving Participation</span>
                <span className="text-sm font-medium">67.8%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-accent h-2 rounded-full" style={{ width: '67.8%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}