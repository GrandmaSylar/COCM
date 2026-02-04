import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Calendar, Users, DollarSign, UserMinus, UserPlus, ChevronRight, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { formatGhanaCedis } from './ui/utils';

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
}

interface ServicesProps {
  onViewRecord?: (id: string) => void;
  onViewMember?: (memberId: string) => void;
}

export function Services({ onViewRecord, onViewMember }: ServicesProps) {
  const [todayRecords, setTodayRecords] = useState<ServiceDateSummary[]>([]);
  const [pastRecords, setPastRecords] = useState<ServiceDateSummary[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ServiceDateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchData();
  }, [page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [todayData, allData] = await Promise.all([
        api.serviceRecords.getToday(),
        api.serviceRecords.getAll({ page, limit: 15 })
      ]);
      setTodayRecords(todayData || []);
      setPastRecords(allData?.records || []);
      setTotal(allData?.total || 0);
    } catch (err) {
      console.error('Failed to fetch service records:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (date: string) => {
    setLoadingDetail(true);
    try {
      const detail = await api.serviceRecords.getByDate(date);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedRecord) {
    const sr = selectedRecord;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1>Service Detail</h1>
            <p className="text-muted-foreground">
              {new Date(sr.serviceDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {sr.serviceTypes.length > 0 && <> &mdash; {sr.serviceTypes.join(', ')}</>}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
          <Card className="border-t-4 border-t-secondary">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-secondary" />
              </div>
              <div className="text-2xl font-bold">{sr.totalAttendance}</div>
              <div className="text-xs text-muted-foreground">Attendance</div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-emerald-500">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold">{formatGhanaCedis(sr.totalGivingAmount)}</div>
              <div className="text-xs text-muted-foreground">Total Giving</div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-amber-500">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <UserMinus className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold">{sr.absentees?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Absentees</div>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-purple-500">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-2xl font-bold">{sr.visitors?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Visitors</div>
            </CardContent>
          </Card>
        </div>

        {/* Per-service breakdowns */}
        {sr.services && sr.services.length > 0 && sr.services.map((svc, idx) => (
          <div key={svc.id || idx} className="space-y-4">
            {sr.services.length > 1 && (
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide border-b pb-2">
                {svc.serviceType}
              </h2>
            )}

            {/* Giving breakdown for this service */}
            {svc.giving && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {sr.services.length > 1 ? `${svc.serviceType} — Giving` : 'Giving Breakdown'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Offering:</span> {formatGhanaCedis(svc.giving.offeringAmount || svc.giving.offering_amount || 0)}</div>
                    <div><span className="text-muted-foreground">Donation:</span> {formatGhanaCedis(svc.giving.donationAmount || svc.giving.donation_amount || 0)}</div>
                    <div><span className="text-muted-foreground">Thanksgiving:</span> {formatGhanaCedis(svc.giving.thanksgivingAmount || svc.giving.thanksgiving_amount || 0)}</div>
                    <div><span className="text-muted-foreground">Cash:</span> {formatGhanaCedis(svc.giving.cashAmount || svc.giving.cash_amount || 0)}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}

        {/* Combined Absentees */}
        {sr.absentees && sr.absentees.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Absentees ({sr.absentees.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sr.absentees.map((a: any) => (
                  <div key={a.id || a.memberId} className="text-sm flex justify-between items-center px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded">
                    {onViewMember && (a.memberId || a.id) ? (
                      <button
                        onClick={() => onViewMember(a.memberId || a.id)}
                        className="text-left font-medium hover:text-primary hover:underline cursor-pointer transition-colors"
                      >
                        {a.memberName}
                      </button>
                    ) : (
                      <span>{a.memberName}</span>
                    )}
                    <span className="text-muted-foreground text-xs">{a.reason || 'No reason'}{a.requestedPermission ? ' (with permission)' : ''}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Visitors */}
        {sr.visitors && sr.visitors.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Visitors ({sr.visitors.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {sr.visitors.map((v) => (
                  <div key={v.id} className="text-sm px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded">
                    {v.firstName} {v.lastName} {v.phone ? `— ${v.phone}` : ''}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Members */}
        {sr.newMembers && sr.newMembers.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">New Members Registered ({sr.newMembers.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {sr.newMembers.map((m) => (
                  <div key={m.id} className="text-sm px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded">
                    {m.firstName} {m.lastName} — Zone {m.zone}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <h1>Services</h1>

      {/* Today / Latest Services */}
      {todayRecords.length > 0 && (
        <div>
          <h2 className="mb-3 text-muted-foreground text-sm font-medium uppercase tracking-wide">
            {todayRecords[0]?.serviceDate === new Date().toISOString().split('T')[0] ? "Today's Service" : 'Latest Service'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
            {todayRecords.map((sr) => (
              <Card key={sr.serviceDate} className="cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all border-l-4 border-l-secondary" onClick={() => openDetail(sr.serviceDate)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">{formatDate(sr.serviceDate)}</div>
                      <div className="text-xs text-muted-foreground">{sr.serviceType}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-secondary" />
                      <span>{sr.totalAttendance} attended</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span>{formatGhanaCedis(sr.totalGiving)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserMinus className="w-4 h-4 text-amber-500" />
                      <span>{sr.absenteesCount} absent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-purple-500" />
                      <span>{sr.visitorsCount} visitors</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past Services List */}
      <div>
        <h2 className="mb-3 text-muted-foreground text-sm font-medium uppercase tracking-wide">All Services</h2>
        <Card>
          <CardContent className="p-0">
            {pastRecords.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No service records yet.</div>
            ) : (
              <div className="divide-y">
                {pastRecords.map((sr) => (
                  <button
                    key={sr.serviceDate}
                    onClick={() => openDetail(sr.serviceDate)}
                    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{formatDate(sr.serviceDate)}</div>
                      <div className="text-xs text-muted-foreground">{sr.serviceType}</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{sr.totalAttendance}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatGhanaCedis(sr.totalGiving)}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground self-center">Page {page} of {Math.ceil(total / 15)}</span>
            <Button variant="outline" size="sm" disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
