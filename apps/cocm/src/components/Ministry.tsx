import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { HandHeart, Music, Shield, HeartHandshake, Mic2, Users, Calendar, Loader2, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { EmptyState, Group, GroupRow, IconTile, LargeTitle } from './ui/ios';
import { api } from '../services/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export interface Ministry {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  leaderId: string | null;
  leader?: {
    id: string;
    firstName: string;
    lastName: string;
    otherNames: string | null;
  } | null;
  nextEventDate: string | null;
  nextEventName: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MinistryMember {
  id: string;
  ministryId: string;
  memberId: string;
  role: string;
  joinedAt: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    otherNames: string | null;
    phone: string;
    email: string | null;
    status: string;
  };
}

export function Ministry() {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMinistry, setSelectedMinistry] = useState<Ministry | null>(null);
  const [selectedMinistryMembers, setSelectedMinistryMembers] = useState<MinistryMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    async function loadMinistries() {
      try {
        const data = await api.ministries.getAll();
        setMinistries(data);
      } catch (err: any) {
        console.error('Failed to load ministries:', err);
        toast.error('Failed to load ministries: ' + (err.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    }
    loadMinistries();
  }, []);

  const handleViewRoster = async (ministry: Ministry) => {
    setSelectedMinistry(ministry);
    setLoadingMembers(true);
    try {
      const data = await api.ministries.getMembers(ministry.id);
      setSelectedMinistryMembers(data);
    } catch (err: any) {
      console.error('Failed to load roster:', err);
      toast.error('Failed to load ministry roster');
    } finally {
      setLoadingMembers(false);
    }
  };

  const getLeaderName = (min: Ministry) => {
    if (!min.leader) return 'No Leader Assigned';
    const parts = [min.leader.firstName, min.leader.otherNames, min.leader.lastName].filter(Boolean);
    return parts.join(' ');
  };

  const getMemberName = (m: MinistryMember['member']) => {
    if (!m) return 'Unknown';
    const parts = [m.firstName, m.otherNames, m.lastName].filter(Boolean);
    return parts.join(' ');
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'music':
        return Music;
      case 'shield':
        return Shield;
      case 'hearthandshake':
        return HeartHandshake;
      case 'mic2':
        return Mic2;
      default:
        return HandHeart;
    }
  };

  const TONES = ['primary', 'info', 'success', 'warning', 'gray'] as const;

  const totalVolunteers = ministries.reduce((acc, curr) => acc + curr.memberCount, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-semibold">Loading ministries...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full overflow-x-hidden pb-6">
      <LargeTitle
        title="Ministries"
        subtitle="Church departments, volunteer rosters and ministry events"
        actions={<Button>Create Ministry</Button>}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: HandHeart, tone: 'primary' as const, value: ministries.length, label: 'Ministries' },
          { icon: Users, tone: 'info' as const, value: totalVolunteers, label: 'Volunteers' },
          { icon: Calendar, tone: 'warning' as const, value: '-', label: 'Events (7 days)' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card p-3 sm:p-4">
            <IconTile icon={stat.icon} tone={stat.tone} />
            <div className="mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums">{stat.value}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {ministries.length === 0 ? (
        <Group>
          <EmptyState icon={HandHeart} title="No ministries yet" description="Ministries you create will appear here." />
        </Group>
      ) : (
        <Group title="All ministries" footer="Tap a ministry to see its volunteer roster.">
          {ministries.map((ministry, idx) => (
            <GroupRow
              key={ministry.id}
              icon={getIconComponent(ministry.icon)}
              iconTone={TONES[idx % TONES.length]}
              title={ministry.name}
              subtitle={`${getLeaderName(ministry)} · ${ministry.nextEventName || 'No upcoming event'}`}
              value={`${ministry.memberCount} ${ministry.memberCount === 1 ? 'member' : 'members'}`}
              onClick={() => handleViewRoster(ministry)}
            />
          ))}
        </Group>
      )}


      {/* Roster / Members Dialog */}
      <Dialog open={selectedMinistry !== null} onOpenChange={(open) => !open && setSelectedMinistry(null)}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 border border-border/80 shadow-sm bg-card text-foreground">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <HandHeart className="w-6 h-6 text-primary" />
              {selectedMinistry?.name} Roster
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              {selectedMinistry?.description || 'Active department volunteers.'}
            </p>
          </DialogHeader>

          {loadingMembers ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Fetching ministry roster...</p>
            </div>
          ) : selectedMinistryMembers.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-2xl border-border/80 bg-muted">
              <p className="text-sm text-muted-foreground font-medium">No volunteers registered in this ministry yet.</p>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border shadow-inner">
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow className="border-b border-border">
                    <TableHead className="font-semibold text-foreground">Name</TableHead>
                    <TableHead className="font-semibold text-foreground">Phone</TableHead>
                    <TableHead className="font-semibold text-foreground">Ministry Role</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Member Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedMinistryMembers.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted border-b border-border">
                      <TableCell className="font-medium text-foreground">{getMemberName(m.member)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.member?.phone || '-'}</TableCell>
                      <TableCell className="text-sm text-foreground font-semibold">{m.role || 'Member'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="capitalize text-xs font-semibold bg-muted text-muted-foreground border-border">
                          {m.member?.status || 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
