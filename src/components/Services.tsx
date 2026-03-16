import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { BarChart, Bar } from 'recharts';
import { Calendar, Users, Banknote, UserMinus, UserPlus, ChevronRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { formatGhanaCedis } from './ui/utils';
import { toast } from 'sonner';

interface ServiceDateSummary {
  serviceDate: string;
  serviceTypes: string[];
  serviceType: string;
  totalAttendance: number;
  totalGiving: number;
  absenteesCount: number;
  visitorsCount: number;
  membersRegistered: number;
  recordCount: number;
  childrenAttendanceCount?: number;
  childrenGivingTotal?: number;
  childrenVisitorsCount?: number;
  expensesTotal?: number;
}

interface ServiceDetail {
  id: string;
  serviceDate: string;
  serviceType: string;
  attendance: any;
  giving: any;
  attendees: { memberId: string; firstName: string; lastName: string; zone: string }[];
  absentees: any[];
}

interface ServiceDateDetail {
  serviceDate: string;
  serviceTypes: string[];
  serviceType: string;
  totalAttendance: number;
  totalGivingAmount: number;
  services: ServiceDetail[];
  attendees: { memberId: string; firstName: string; lastName: string; zone: string }[];
  absentees: any[];
  visitors: { id: string; firstName: string; lastName: string; phone: string }[];
  newMembers: { id: string; firstName: string; lastName: string; zone: string }[];
  childrenAttendance?: any[];
  childrenGiving?: any[];
  childrenVisitors?: any[];
  newChildMembers?: any[];
  expenses?: any[];
  membersRegistered?: number;
  previousServiceGiving?: { totalGivingAmount: number; serviceDate: string };
}

interface ServicesProps {
  onViewRecord?: (id: string) => void;
  onViewMember?: (memberId: string) => void;
  onConvertVisitor?: (visitor: { id: string; firstName: string; lastName: string; phone: string }) => void;
}

function getServiceTypeBadgeClass(serviceType: string): string {
  if (!serviceType) return 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-none';
  const t = serviceType.toLowerCase();
  if (t.includes('sunday')) return 'bg-purple-100 text-purple-700 hover:bg-purple-100 border-none';
  if (t.includes('midweek')) return 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-none';
  if (t.includes('prayer')) return 'bg-green-100 text-green-700 hover:bg-green-100 border-none';
  return 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-none';
}

function QuickNav({ hasChildren, activeSection, onPillClick }: { hasChildren: boolean, activeSection: string, onPillClick: (id: string) => void }) {
  const pills = [
    { id: 'overview', label: 'Overview' },
    { id: 'finances', label: 'Finances' },
    { id: 'people', label: 'People' },
    ...(hasChildren ? [{ id: 'children', label: 'Children' }] : [])
  ];

  return (
    <div className="sticky top-[53px] z-[19] bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 overflow-x-auto no-scrollbar border-b">
      <div className="flex gap-2">
        {pills.map(p => (
          <button
            key={p.id}
            onClick={() => {
              onPillClick(p.id);
              document.getElementById('section-' + p.id)?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeSection === p.id 
                ? 'bg-secondary text-white shadow-sm' 
                : 'bg-card text-muted-foreground border hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewSection({ sr }: { sr: ServiceDateDetail }) {
  const expensesTotal = (sr.expenses ?? []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const netGiving = sr.totalGivingAmount - expensesTotal;
  const membersRegistered = sr.membersRegistered ?? sr.services?.[0]?.attendance?.membersRegistered ?? 0;
  const attendanceRate = membersRegistered > 0 ? Math.min(100, Math.round((sr.totalAttendance / membersRegistered) * 100)) : 0;
  const childrenCount = (sr.childrenAttendance ?? []).flatMap(r => r.entries ?? []).length;
  const combinedAttendance = sr.totalAttendance + childrenCount;
  const noReasonCount = (sr.absentees ?? []).filter(a => !a.requestedPermission).length;
  const withPermissionCount = (sr.absentees ?? []).filter(a => a.requestedPermission).length;
  const perHead = combinedAttendance > 0 ? sr.totalGivingAmount / combinedAttendance : 0;

  const circumference = 2 * Math.PI * 20;
  const strokeDashoffset = circumference * (1 - attendanceRate / 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {/* Attendance Card */}
      <div className="bg-card rounded-xl p-4 border-l-4 border-l-blue-500 border-y border-r shadow-sm flex items-center justify-between col-span-2 md:col-span-1">
        <div>
          <div className="text-muted-foreground font-medium text-xs uppercase tracking-wider mb-1">Attendance</div>
          <div className="text-2xl font-bold text-foreground">{combinedAttendance}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Adults: {sr.totalAttendance} &middot; Children: {childrenCount}
          </div>
        </div>
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="20" className="stroke-muted fill-none stroke-[4]" />
            <circle cx="26" cy="26" r="20" className="stroke-blue-500 fill-none stroke-[4] transition-all duration-1000 ease-out" 
              style={{ strokeDasharray: circumference, strokeDashoffset }} 
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-blue-700">{attendanceRate}%</span>
        </div>
      </div>

      {/* Total Giving Card */}
      <div className="bg-card rounded-xl p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <div className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Total Giving</div>
        </div>
        <div className="text-2xl font-bold text-emerald-600">{formatGhanaCedis(sr.totalGivingAmount)}</div>
        <div className="text-xs text-muted-foreground mt-1">GH₵ {perHead.toFixed(2)} per head</div>
      </div>

      {/* Net Giving Card */}
      {expensesTotal > 0 && (
        <div className="bg-card rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-teal-500"></div>
            <div className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Net Giving</div>
          </div>
          <div className="text-2xl font-bold text-teal-600">{formatGhanaCedis(netGiving)}</div>
          <div className="text-xs text-muted-foreground mt-1">After {formatGhanaCedis(expensesTotal)} expenses</div>
        </div>
      )}

      {/* Absentees Card */}
      <div className="bg-card rounded-xl p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          <div className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Absentees</div>
        </div>
        <div className="text-2xl font-bold">{sr.absentees?.length ?? 0}</div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {noReasonCount > 0 && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{noReasonCount} no reason</Badge>}
          {withPermissionCount > 0 && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{withPermissionCount} with permission</Badge>}
        </div>
      </div>

      {/* Visitors Card */}
      <div className="bg-card rounded-xl p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          <div className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Visitors</div>
        </div>
        <div className="text-2xl font-bold">{sr.visitors?.length ?? 0}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {sr.visitors?.length ?? 0} adult &middot; {sr.childrenVisitors?.length ?? 0} children
        </div>
      </div>
    </div>
  );
}

function GivingChart({ sr }: { sr: ServiceDateDetail }) {
  const expensesTotal = (sr.expenses ?? []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const netGiving = sr.totalGivingAmount - expensesTotal;
  const perHead = sr.totalAttendance > 0 ? sr.totalGivingAmount / sr.totalAttendance : 0;
  
  let offering = 0, donation = 0, thanksgiving = 0, cash = 0;
  sr.services.forEach(svc => {
    if (svc.giving) {
      offering += (svc.giving.offeringAmount || svc.giving.offering_amount || 0);
      donation += (svc.giving.donationAmount || svc.giving.donation_amount || 0);
      thanksgiving += (svc.giving.thanksgivingAmount || svc.giving.thanksgiving_amount || 0);
      cash += (svc.giving.cashAmount || svc.giving.cash_amount || 0);
    }
  });

  const chartData = [{ name: 'Giving', offering, donation, thanksgiving, cash }];
  
  const chartConfig = {
    offering: { label: 'Offering', color: '#2563eb' },
    donation: { label: 'Donation', color: '#10b981' },
    thanksgiving: { label: 'Thanksgiving', color: '#f59e0b' },
    cash: { label: 'Cash', color: '#3b82f6' }
  };

  let trendBadge = null;
  if (sr.previousServiceGiving && sr.previousServiceGiving.totalGivingAmount > 0) {
    const diff = sr.totalGivingAmount - sr.previousServiceGiving.totalGivingAmount;
    const pct = (diff / sr.previousServiceGiving.totalGivingAmount * 100).toFixed(1);
    const isUp = diff >= 0;
    trendBadge = (
      <Badge variant="outline" className={isUp ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>
        {isUp ? '↑' : '↓'} {Math.abs(Number(pct))}%
      </Badge>
    );
  }

  const categories = [
    { key: 'offering', label: 'Offering', amount: offering, color: 'bg-blue-600', fill: '#2563eb' },
    { key: 'donation', label: 'Donation', amount: donation, color: 'bg-emerald-500', fill: '#10b981' },
    { key: 'thanksgiving', label: 'Thanksgiving', amount: thanksgiving, color: 'bg-amber-500', fill: '#f59e0b' },
    { key: 'cash', label: 'Cash', amount: cash, color: 'bg-blue-500', fill: '#3b82f6' }
  ].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base">Giving Breakdown — {formatGhanaCedis(sr.totalGivingAmount)}</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">GH₵ {perHead.toFixed(2)} per head</div>
          </div>
          {trendBadge}
        </div>
      </CardHeader>
      <CardContent>
        {sr.totalGivingAmount > 0 ? (
          <>
            <div className="h-[60px] w-full mt-2 mb-6">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="offering" stackId="giving" fill="var(--color-offering)" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="donation" stackId="giving" fill="var(--color-donation)" />
                  <Bar dataKey="thanksgiving" stackId="giving" fill="var(--color-thanksgiving)" />
                  <Bar dataKey="cash" stackId="giving" fill="var(--color-cash)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
            
            <div className="space-y-3">
              {categories.map(cat => {
                const pct = Math.round((cat.amount / sr.totalGivingAmount) * 100);
                return (
                  <div key={cat.key} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 w-28 shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                      <span className="text-muted-foreground">{cat.label}</span>
                    </div>
                    <Progress value={pct} indicatorClassName={cat.color} className="flex-1 h-2" />
                    <div className="w-12 text-right text-xs text-muted-foreground font-medium">{pct}%</div>
                    <div className="w-24 text-right font-medium">{formatGhanaCedis(cat.amount)}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-muted-foreground text-sm">No giving recorded.</div>
        )}

        {expensesTotal > 0 && (
          <div className="mt-6 p-3 bg-secondary/10 border border-secondary/20 rounded-lg flex justify-between items-center text-sm">
            <span className="text-secondary/80 font-medium">Net Giving (after expenses)</span>
            <span className="font-bold text-teal-600 dark:text-teal-400">{formatGhanaCedis(netGiving)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseList({ expenses }: { expenses: any[] }) {
  if (!expenses || expenses.length === 0) return null;
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Card className="shadow-sm mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Expenses ({expenses.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col">
          {expenses.map((expense: any, idx: number) => (
            <div key={expense.id} className={`p-4 ${idx !== expenses.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-sm">{expense.details}</span>
                <span className="font-bold text-sm text-right whitespace-nowrap ml-2">{formatGhanaCedis(expense.amount)}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-[10px] bg-secondary/20 text-secondary-foreground font-normal">{expense.paymentMethodName}</Badge>
                {expense.approvedByName && <span className="text-xs text-muted-foreground self-center">Approved by {expense.approvedByName}</span>}
              </div>
            </div>
          ))}
          <div className="p-4 bg-secondary/10 rounded-b-xl flex justify-between items-center border-t border-secondary/20">
            <span className="text-secondary/80 font-medium text-sm">Total Expenses</span>
            <span className="font-bold text-orange-600 dark:text-orange-400">{formatGhanaCedis(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonList({
  items,
  type,
  onViewMember,
  onConvertVisitor
}: {
  items: any[];
  type: 'absentee' | 'visitor' | 'member';
  onViewMember?: (id: string) => void;
  onConvertVisitor?: (visitor: any) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [absenteeFilter, setAbsenteeFilter] = useState<'all' | 'no-reason' | 'with-permission'>('all');

  const showSearch = items.length > 5;

  const filteredItems = useMemo(() => {
    let result = items;
    
    if (type === 'absentee') {
      if (absenteeFilter === 'no-reason') {
        result = result.filter(a => !a.requestedPermission);
      } else if (absenteeFilter === 'with-permission') {
        result = result.filter(a => a.requestedPermission);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        if (type === 'absentee') {
          return item.memberName?.toLowerCase().includes(q);
        } else {
          const name = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();
          return name.includes(q);
        }
      });
    }

    return result;
  }, [items, type, absenteeFilter, searchQuery]);

  return (
    <div className="space-y-3">
      {(showSearch || type === 'absentee') && (
        <div className="flex flex-col sm:flex-row gap-2">
          {showSearch && (
            <input
              type="text"
              placeholder="Search name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs font-normal border rounded-md px-3 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-primary bg-transparent"
            />
          )}
          {type === 'absentee' && (
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <button
                onClick={() => setAbsenteeFilter('all')}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${absenteeFilter === 'all' ? 'bg-secondary text-white shadow-sm' : 'bg-card text-muted-foreground border hover:bg-accent hover:text-accent-foreground'}`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setAbsenteeFilter('no-reason')}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${absenteeFilter === 'no-reason' ? 'bg-secondary text-white shadow-sm' : 'bg-card text-muted-foreground border hover:bg-accent hover:text-accent-foreground'}`}
              >
                No Reason ({items.filter(a => !a.requestedPermission).length})
              </button>
              <button
                onClick={() => setAbsenteeFilter('with-permission')}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${absenteeFilter === 'with-permission' ? 'bg-secondary text-white shadow-sm' : 'bg-card text-muted-foreground border hover:bg-accent hover:text-accent-foreground'}`}
              >
                With Permission ({items.filter(a => a.requestedPermission).length})
              </button>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          {type === 'absentee' ? 'All members were present 🎉' : 'No visitors recorded'}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden divide-y divide-border">
          {filteredItems.map(item => {
            const id = item.memberId || item.id;
            let initials = '';
            let avatarClass = '';
            let nameContent = null;

            if (type === 'absentee') {
              const nameParts = (item.memberName || '').split(' ');
              initials = ((nameParts[0]?.[0] || '') + (nameParts[1]?.[0] || '')).toUpperCase() || 'AB';
              avatarClass = item.requestedPermission ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
              
              nameContent = onViewMember && id ? (
                <button onClick={() => onViewMember(id)} className="text-left font-medium hover:text-primary hover:underline transition-colors truncate">
                  {item.memberName}
                </button>
              ) : (
                <span className="font-medium truncate">{item.memberName}</span>
              );
            } else if (type === 'visitor') {
              initials = `${item.firstName?.[0] || ''}${item.lastName?.[0] || ''}`.toUpperCase() || 'V';
              avatarClass = 'bg-purple-100 text-purple-700';
              nameContent = <span className="font-medium truncate">{item.firstName} {item.lastName}</span>;
            } else if (type === 'member') {
              initials = `${item.firstName?.[0] || ''}${item.lastName?.[0] || ''}`.toUpperCase() || 'M';
              avatarClass = 'bg-blue-100 text-blue-700';
              nameContent = <span className="font-medium truncate">{item.firstName} {item.lastName}</span>;
            }

            return (
              <div key={id} className="p-4 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass}`}>
                    {initials}
                  </div>
                  <div className="flex flex-col truncate">
                    {nameContent}
                    {type === 'visitor' && item.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <span>{item.phone}</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(item.phone).then(() => toast.success('Phone number copied'))}
                          className="border border-border rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                          title="Copy phone number"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {type === 'absentee' && (
                    <Badge variant="outline" className={item.requestedPermission ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                      {item.reason || 'No reason'}{item.requestedPermission ? ' (permission)' : ''}
                    </Badge>
                  )}
                  {type === 'absentee' && item.zone && (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                      Zone {item.zone}
                    </Badge>
                  )}
                  {type === 'member' && item.zone && (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                      Zone {item.zone}
                    </Badge>
                  )}
                  {type === 'visitor' && onConvertVisitor && (
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onConvertVisitor(item)}>
                      Convert
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredItems.length === 0 && items.length > 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
}

function PeopleSection({ 
  sr, 
  onViewMember, 
  onConvertVisitor 
}: { 
  sr: ServiceDateDetail, 
  onViewMember?: (id: string) => void, 
  onConvertVisitor?: (visitor: any) => void 
}) {
  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Absentees ({sr.absentees?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <PersonList 
            items={sr.absentees || []} 
            type="absentee" 
            onViewMember={onViewMember} 
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Visitors ({sr.visitors?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <PersonList 
            items={sr.visitors || []} 
            type="visitor" 
            onConvertVisitor={onConvertVisitor} 
          />
        </CardContent>
      </Card>

      {(sr.newMembers?.length ?? 0) > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Members ({sr.newMembers?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <PersonList 
              items={sr.newMembers!} 
              type="member" 
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChildrenSection({ sr }: { sr: ServiceDateDetail }) {
  const childrenAttendanceCount = sr.childrenAttendance?.reduce((sum: number, r: any) => sum + (r.entries?.length || 0), 0) || 0;
  const childrenGivingTotal = sr.childrenGiving?.reduce((sum: number, g: any) => sum + (g.totalAmount || 0), 0) || 0;
  const childrenVisitorsCount = sr.childrenVisitors?.length || 0;

  const hasChildren = childrenAttendanceCount > 0 || childrenGivingTotal > 0 || childrenVisitorsCount > 0 || (sr.newChildMembers?.length || 0) > 0;
  if (!hasChildren) return null;

  const attendanceList = sr.childrenAttendance?.flatMap(r => r.entries ?? []) || [];
  const [filter, setFilter] = useState('');
  const filteredAttendance = attendanceList.filter((c: any) => c.childName?.toLowerCase().includes(filter.toLowerCase()));

  let offering = 0, cash = 0, mobileMoney = 0;
  sr.childrenGiving?.forEach(g => {
    offering += (g.offeringAmount || 0);
    cash += (g.cashAmount || 0);
    mobileMoney += (g.mobileMoneyAmount || 0);
  });
  
  const givingCategories = [
    { key: 'offering', label: 'Offering', amount: offering, color: 'bg-purple-600' },
    { key: 'cash', label: 'Cash', amount: cash, color: 'bg-emerald-500' },
    { key: 'mobileMoney', label: 'Mobile Money', amount: mobileMoney, color: 'bg-blue-500' }
  ].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
          <div className="text-sm font-bold text-purple-700">{childrenAttendanceCount}</div>
          <div className="text-[10px] text-purple-600/80 uppercase font-semibold">Attended</div>
        </div>
        <div className="bg-teal-50 rounded-lg p-3 text-center border border-teal-100">
          <div className="text-sm font-bold text-teal-700">{formatGhanaCedis(childrenGivingTotal)}</div>
          <div className="text-[10px] text-teal-600/80 uppercase font-semibold">Giving</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
          <div className="text-sm font-bold text-amber-700">{childrenVisitorsCount}</div>
          <div className="text-[10px] text-amber-600/80 uppercase font-semibold">Visitors</div>
        </div>
      </div>

      {attendanceList.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex justify-between items-center">
              Children Attendance
              {attendanceList.length > 10 && (
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={filter} 
                  onChange={e => setFilter(e.target.value)}
                  className="text-xs font-normal border rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-primary bg-transparent"
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {filteredAttendance.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 py-1 text-sm">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {e.childName?.substring(0, 2).toUpperCase() || 'CH'}
                  </div>
                  <span>{e.childName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {childrenGivingTotal > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Children Giving Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {givingCategories.map(cat => {
                const pct = Math.round((cat.amount / childrenGivingTotal) * 100);
                return (
                  <div key={cat.key} className="flex items-center gap-2 text-sm">
                    <div className="w-24 shrink-0 flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                      <span className="text-muted-foreground text-xs">{cat.label}</span>
                    </div>
                    <Progress value={pct} indicatorClassName={cat.color} className="flex-1 h-1.5" />
                    <div className="w-8 text-right text-[10px] text-muted-foreground">{pct}%</div>
                    <div className="w-20 text-right font-medium text-xs">{formatGhanaCedis(cat.amount)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(sr.childrenVisitors?.length || 0) > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Children Visitors ({sr.childrenVisitors!.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sr.childrenVisitors!.map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 py-1 text-sm">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {v.firstName?.charAt(0)}{v.lastName?.charAt(0)}
                  </div>
                  <span>{v.firstName} {v.lastName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(sr.newChildMembers?.length || 0) > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">New Child Members ({sr.newChildMembers!.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sr.newChildMembers!.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-1 text-sm">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {m.firstName?.charAt(0)}{m.lastName?.charAt(0)}
                  </div>
                  <span>{m.firstName} {m.lastName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ServiceDetailView({
  sr,
  onBack,
  onViewMember,
  onConvertVisitor
}: {
  sr: ServiceDateDetail;
  onBack: () => void;
  onViewMember?: (id: string) => void;
  onConvertVisitor?: (visitor: { id: string; firstName: string; lastName: string; phone: string }) => void;
}) {
  const [activeSection, setActiveSection] = useState('overview');
  
  const overviewRef = useRef<HTMLDivElement>(null);
  const financesRef = useRef<HTMLDivElement>(null);
  const peopleRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);
  const ratiosRef = useRef(new Map<string, number>());

  const hasChildren = 
    (sr.childrenAttendance?.length || 0) + 
    (sr.childrenGiving?.length || 0) + 
    (sr.childrenVisitors?.length || 0) + 
    (sr.newChildMembers?.length || 0) > 0;

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        ratiosRef.current.set(e.target.id.replace('section-', ''), e.intersectionRatio);
      });
      
      let bestId = 'overview';
      let maxRatio = -1;
      ratiosRef.current.forEach((ratio, id) => {
        if (ratio > maxRatio) {
          maxRatio = ratio;
          bestId = id;
        }
      });
      if (maxRatio > 0) {
        setActiveSection(bestId);
      }
    }, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: '-106px 0px 0px 0px' 
    });
    
    if (overviewRef.current) observer.observe(overviewRef.current);
    if (financesRef.current) observer.observe(financesRef.current);
    if (peopleRef.current) observer.observe(peopleRef.current);
    if (childrenRef.current) observer.observe(childrenRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative space-y-6 pb-20">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-2 mb-2 flex items-center gap-3 pt-1">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="truncate flex-1">
          <h1 className="text-xl font-bold truncate">Service Detail</h1>
          <p className="text-xs text-muted-foreground truncate">
            {new Date(sr.serviceDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {sr.serviceTypes.length > 0 && <> &mdash; {sr.serviceTypes.join(', ')}</>}
          </p>
        </div>
      </div>

      <QuickNav hasChildren={hasChildren} activeSection={activeSection} onPillClick={setActiveSection} />

      <div id="section-overview" ref={overviewRef} className="scroll-mt-28">
        <h2 className="text-lg font-bold mb-3">Overview</h2>
        <OverviewSection sr={sr} />
      </div>

      <div id="section-finances" ref={financesRef} className="scroll-mt-28 space-y-4 pt-4">
        <h2 className="text-lg font-bold mb-3">Finances</h2>
        <GivingChart sr={sr} />
        <ExpenseList expenses={sr.expenses ?? []} />
      </div>

      <div id="section-people" ref={peopleRef} className="scroll-mt-28 space-y-4 pt-4">
        <h2 className="text-lg font-bold mb-3">People</h2>
        
        <PeopleSection sr={sr} onViewMember={onViewMember} onConvertVisitor={onConvertVisitor} />
      </div>

      {hasChildren && (
        <div id="section-children" ref={childrenRef} className="scroll-mt-28 space-y-4 pt-4">
          <h2 className="text-lg font-bold mb-3">Children</h2>
          <ChildrenSection sr={sr} />
        </div>
      )}
    </div>
  );
}

function StatsBar({ records, totalServices, loading }: { records: ServiceDateSummary[], totalServices: number, loading: boolean }) {
  const stats = useMemo(() => {
    if (!records.length) return { avgAttendance: 0, totalGiving: 0 };
    const count = records.length;
    let totalAtt = 0;
    let totalGiv = 0;
    records.forEach(r => {
      totalAtt += r.totalAttendance || 0;
      totalGiv += r.totalGiving || 0;
    });
    return {
      avgAttendance: Math.round(totalAtt / count),
      totalGiving: totalGiv
    };
  }, [records]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-card border rounded-xl p-4 flex flex-col justify-center shadow-sm">
        <div className="text-2xl font-bold">{totalServices}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Total Services</div>
      </div>
      <div className="bg-card border rounded-xl p-4 flex flex-col justify-center shadow-sm">
        <div className="text-2xl font-bold">{stats.avgAttendance}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Average Attendance</div>
      </div>
      <div className="bg-card border rounded-xl p-4 flex flex-col justify-center shadow-sm">
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatGhanaCedis(stats.totalGiving)}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Total Giving</div>
      </div>
    </div>
  );
}

function FeaturedCard({ sr, onClick }: { sr: ServiceDateSummary, onClick: () => void }) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const attendanceRate = sr.membersRegistered > 0 ? Math.min(100, Math.round(((sr.totalAttendance || 0) / sr.membersRegistered) * 100)) : 0;
  const expenses = sr.expensesTotal || 0;
  
  return (
    <div onClick={onClick} className="bg-card cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-secondary rounded-xl border-y border-r shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="font-medium text-foreground">{formatDate(sr.serviceDate)}</div>
          <Badge className={getServiceTypeBadgeClass(sr.serviceType)}>{sr.serviceType || 'Service'}</Badge>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 text-sm mb-3 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-secondary shrink-0" />
            <span className="font-medium text-foreground">{sr.totalAttendance}</span>
            <span className="text-xs">&middot; {attendanceRate}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-medium text-foreground">{formatGhanaCedis(sr.totalGiving)}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-medium text-foreground">{sr.absenteesCount}</span>
            <span className="text-xs">absent</span>
          </div>
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-purple-500 shrink-0" />
            <span className="font-medium text-foreground">{sr.visitorsCount}</span>
            <span className="text-xs">visitors</span>
          </div>
          {expenses > 0 && (
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-medium text-foreground">{formatGhanaCedis(expenses)}</span>
            </div>
          )}
        </div>
        
        {expenses > 0 && (
          <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Net Giving (after expenses)</span>
            <span className="font-medium text-teal-600">{formatGhanaCedis((sr.totalGiving || 0) - expenses)}</span>
          </div>
        )}
        
        {((sr.childrenAttendanceCount || 0) > 0 || (sr.childrenGivingTotal || 0) > 0 || (sr.childrenVisitorsCount || 0) > 0) && (
          <>
            <hr className="my-3 border-border" />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">CHILDREN</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary shrink-0" />
                <span className="font-medium text-foreground">{sr.childrenAttendanceCount || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-teal-500 shrink-0" />
                <span className="font-medium text-foreground">{formatGhanaCedis(sr.childrenGivingTotal || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-500 shrink-0" />
                <span className="font-medium text-foreground">{sr.childrenVisitorsCount || 0}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimelineGroup({ records, onSelect, onLoadMore, hasMore, loadingMore }: { records: ServiceDateSummary[], onSelect: (d: string, t?: string) => void, onLoadMore: () => void, hasMore: boolean, loadingMore: boolean }) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  
  const groups = useMemo(() => {
    const map = new Map<string, ServiceDateSummary[]>();
    for (const r of records) {
      if (!r.serviceDate) continue;
      const monthKey = r.serviceDate.slice(0, 7);
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(r);
    }
    return Array.from(map.entries()).map(([monthKey, recs]) => {
      const label = new Date(monthKey + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      return { monthKey, label, records: recs };
    });
  }, [records]);

  return (
    <div className="space-y-6">
      {groups.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground bg-card border rounded-xl">No service records yet.</div>
      ) : (
        groups.map(group => (
          <div key={group.monthKey} className="relative">
            <div className="sticky top-0 lg:top-14 z-10 bg-background/95 backdrop-blur-sm py-2 mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
            </div>
            <div className="bg-card border rounded-xl divide-y divide-border overflow-hidden shadow-sm">
              {group.records.map((sr) => (
                <button
                  key={`${sr.serviceDate}_${sr.serviceType || 'NA'}`}
                  onClick={() => onSelect(sr.serviceDate, sr.serviceType)}
                  className="w-full flex sm:items-center sm:flex-row flex-col items-start gap-2 p-3 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <div className="flex items-center gap-3 sm:w-1/2 w-full">
                    <div className="font-medium text-sm whitespace-nowrap min-w-[110px] text-foreground">{formatDate(sr.serviceDate)}</div>
                    <Badge className={getServiceTypeBadgeClass(sr.serviceType)}>{sr.serviceType || 'Service'}</Badge>
                  </div>
                  <div className="flex sm:flex-1 w-full justify-between items-center text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-secondary" /><span className="font-medium text-foreground">{sr.totalAttendance}</span></span>
                      <span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-emerald-500" /><span className="font-medium text-foreground">{formatGhanaCedis(sr.totalGiving)}</span></span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      
      {hasMore && (
        <div className="flex justify-center mt-6 pb-4">
          <Button variant="outline" className="rounded-full px-8 shadow-sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore && <RefreshCw className="w-4 h-4 mr-2 animate-spin text-orange-500" />}
            {loadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function Services({ onViewRecord, onViewMember, onConvertVisitor }: ServicesProps) {
  const [todayRecords, setTodayRecords] = useState<ServiceDateSummary[]>([]);
  const [pastRecords, setPastRecords] = useState<ServiceDateSummary[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ServiceDateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchData(1);
  }, []);

  const fetchData = async (targetPage: number, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [todayData, allData] = await Promise.all([
        targetPage === 1 ? api.serviceRecords.getToday() : Promise.resolve(null),
        api.serviceRecords.getAll({ page: targetPage, limit: 15 })
      ]);
      
      if (todayData !== null) {
        setTodayRecords(todayData || []);
      }
      
      if (targetPage === 1) {
        setPastRecords(allData?.records || []);
      } else {
        setPastRecords(prev => [...prev, ...(allData?.records || [])]);
      }
      
      setTotal(allData?.total || 0);
      setPage(targetPage);
    } catch (err) {
      console.error('Failed to fetch service records:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchData(page + 1, false);
    setLoadingMore(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(1, false);
    setRefreshing(false);
  };

  const openDetail = async (date: string, serviceType?: string) => {
    setLoadingDetail(true);
    try {
      const detail = await api.serviceRecords.getByDate(date, serviceType);
      setSelectedRecord(detail);
    } catch (err) {
      console.error('Failed to fetch detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-[88px] rounded-xl" />
          <Skeleton className="h-[88px] rounded-xl" />
          <Skeleton className="h-[88px] rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl w-full" />
        <div className="space-y-2">
          <div className="sticky top-0 lg:top-14 z-10 bg-background/95 backdrop-blur-sm py-2 mb-2">
             <Skeleton className="h-5 w-24 rounded" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (loadingDetail && !selectedRecord) {
    return (
      <div className="space-y-6">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-2 mb-2 flex items-center gap-3 pt-1">
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-8 w-48 rounded" />
        </div>
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <Skeleton className="h-[150px] w-full rounded-xl" />
      </div>
    );
  }

  // Detail view
  if (selectedRecord) {
    return <ServiceDetailView sr={selectedRecord} onBack={() => setSelectedRecord(null)} onViewMember={onViewMember} onConvertVisitor={onConvertVisitor} />;
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h1>Services</h1>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
          Refresh
        </Button>
      </div>

      <StatsBar records={pastRecords} totalServices={total} loading={loading} />

      {/* Today / Latest Services */}
      {todayRecords.length > 0 && (
        <div>
          <h2 className="mb-3 text-muted-foreground text-sm font-medium uppercase tracking-wide">
            {todayRecords[0]?.serviceDate === new Date().toISOString().split('T')[0] ? "Today's Service" : 'Latest Service'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
            {todayRecords.map((sr) => (
              <FeaturedCard 
                key={`${sr.serviceDate}_${sr.serviceType || 'NA'}`} 
                sr={sr} 
                onClick={() => openDetail(sr.serviceDate, sr.serviceType)} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Services List */}
      <div>
        <h2 className="mb-3 text-muted-foreground text-sm font-medium uppercase tracking-wide">All Services</h2>
        <TimelineGroup 
          records={pastRecords} 
          onSelect={openDetail} 
          onLoadMore={loadMore} 
          hasMore={page * 15 < total} 
          loadingMore={loadingMore} 
        />
      </div>
    </div>
  );
}
