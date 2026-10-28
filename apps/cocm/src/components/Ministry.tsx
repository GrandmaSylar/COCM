import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { HandHeart, Music, Shield, HeartHandshake, Mic2, Users, Calendar, Loader2, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
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

  // Modern gradients for cards
  const gradients = [
    'from-purple-500 to-indigo-600',
    'from-pink-500 to-rose-600',
    'from-sky-400 to-blue-600',
    'from-amber-400 to-emerald-600',
    'from-violet-500 to-fuchsia-600',
  ];

  const lightGradients = [
    'from-purple-500/10 to-indigo-600/10 text-purple-600 dark:text-purple-400',
    'from-pink-500/10 to-rose-600/10 text-destructive',
    'from-sky-400/10 to-blue-600/10 text-info-text',
    'from-amber-400/10 to-emerald-600/10 text-success-text',
    'from-violet-500/10 to-fuchsia-600/10 text-violet-600 dark:text-violet-400',
  ];

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
    <div className="space-y-6 w-full overflow-x-hidden p-1 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <HandHeart className="w-6 h-6 text-primary" />
            Ministries
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage church departments, volunteer rosters, and ministry events.
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground shadow-sm rounded-xl px-5 h-10 hover:opacity-90 transition-all duration-200">
          Create Ministry
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid gap-6 md:grid-cols-3 pt-2">
        <Card className="border border-border/80 shadow-sm bg-card rounded-2xl relative overflow-hidden group transition-shadow duration-300">
          <div className="absolute top-0 left-0 w-full h-[4px] from-purple-500" />
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Ministries</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="text-3xl font-extrabold tracking-tight">{ministries.length}</div>
          </CardContent>
        </Card>
        <Card className="border border-border/80 shadow-sm bg-card rounded-2xl relative overflow-hidden group transition-shadow duration-300">
          <div className="absolute top-0 left-0 w-full h-[4px] from-pink-500" />
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Volunteers</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="text-3xl font-extrabold tracking-tight">{totalVolunteers}</div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span className="bg-info/10 text-info-text p-1 rounded-md">
                <Users className="w-3.5 h-3.5" />
              </span>
              Active serving members
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border/80 shadow-sm bg-card rounded-2xl relative overflow-hidden group transition-shadow duration-300">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-info-soft" />
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="text-3xl font-extrabold tracking-tight">-</div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 p-1 rounded-md">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              Within the next 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ministry Grid */}
      {ministries.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-2xl border-border/80 bg-card shadow-sm">
          <HandHeart className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-medium">No ministries created yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 pt-4">
          {ministries.map((ministry, idx) => {
            const Icon = getIconComponent(ministry.icon);
            const gradClass = gradients[idx % gradients.length];
            const lightGradClass = lightGradients[idx % lightGradients.length];
            return (
              <Card key={ministry.id} className="relative overflow-hidden group transition-all duration-300 border border-border/80 rounded-2xl bg-card">
                {/* Visual Accent Top Bar */}
                <div className={`absolute top-0 left-0 w-full h-[5px] ${gradClass}`} />
                
                <CardHeader className="pb-4 pt-8 px-6">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${lightGradClass}`}>
                      <Icon className="w-6 h-6 animate-pulse" />
                    </div>
                    <Badge variant="secondary" className="bg-muted text-foreground font-semibold rounded-full px-3 py-1 text-xs">
                      {ministry.memberCount} Members
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold mt-5 text-foreground group-hover:text-primary transition-colors">{ministry.name}</CardTitle>
                  <CardDescription className="text-sm mt-2 leading-relaxed text-muted-foreground font-medium min-h-[45px]">{ministry.description || 'Church department volunteer team.'}</CardDescription>
                </CardHeader>
                
                <CardContent className="px-6 pb-6 pt-0">
                  <div className="space-y-3 mt-2 bg-muted p-4 rounded-xl border border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Leader</span>
                      <span className="font-semibold text-foreground">{getLeaderName(ministry)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Next Event</span>
                      <span className="font-semibold text-foreground">{ministry.nextEventName || 'No upcoming event'}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <Button 
                      onClick={() => handleViewRoster(ministry)}
                      variant="outline" 
                      className="flex-1 rounded-xl h-10 text-sm font-semibold border-border hover:bg-muted flex items-center justify-center gap-1.5 transition-all duration-300"
                    >
                      View Roster
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 duration-300" />
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm font-semibold border-border hover:bg-muted transition-all duration-300">
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
