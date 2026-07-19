import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Map, Users, TrendingUp, HandHeart, Loader2, ArrowRight, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '../services/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export interface Zone {
  id: string;
  name: string;
  description: string;
  leaderId: string | null;
  leader?: {
    id: string;
    firstName: string;
    lastName: string;
    otherNames: string | null;
  } | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneMember {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  email: string | null;
  phone: string;
  status: string;
}

export interface MemberDropdownItem {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
}

export function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [members, setMembers] = useState<MemberDropdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedZoneMembers, setSelectedZoneMembers] = useState<ZoneMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderId: '',
  });

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [zonesData, membersData] = await Promise.all([
          api.zones.getAll(),
          api.members.getAll(),
        ]);
        setZones(zonesData);
        setMembers(membersData);
      } catch (err: any) {
        console.error('Failed to load zones initial data:', err);
        toast.error('Failed to load data from backend');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const handleViewZoneDetails = async (zone: Zone) => {
    setSelectedZone(zone);
    setLoadingMembers(true);
    try {
      const members = await api.zones.getMembers(zone.id);
      setSelectedZoneMembers(members);
    } catch (err: any) {
      console.error('Failed to load zone members:', err);
      toast.error('Failed to load zone members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateZone = () => {
    setEditingZone(null);
    setFormData({
      name: '',
      description: '',
      leaderId: '',
    });
    setIsFormOpen(true);
  };

  const handleEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || '',
      leaderId: zone.leaderId || '',
    });
    setIsFormOpen(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        leaderId: formData.leaderId || null,
      };

      if (editingZone) {
        await api.zones.update(editingZone.id, payload);
        toast.success('Zone updated successfully');
      } else {
        await api.zones.create(payload);
        toast.success('Zone created successfully');
      }

      // Reload zones list
      const updatedZones = await api.zones.getAll();
      setZones(updatedZones);
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Failed to save zone:', err);
      toast.error('Failed to save zone settings');
    }
  };

  const getLeaderName = (zone: Zone) => {
    if (!zone.leader) return 'No Leader Assigned';
    const parts = [zone.leader.firstName, zone.leader.otherNames, zone.leader.lastName].filter(Boolean);
    return parts.join(' ');
  };

  const getMemberName = (m: any) => {
    if (!m) return 'Unknown';
    const parts = [m.firstName, m.otherNames, m.lastName].filter(Boolean);
    return parts.join(' ');
  };

  // Modern gradients for cards
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-emerald-400 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-amber-400 to-orange-600',
    'from-rose-400 to-red-600',
    'from-cyan-400 to-blue-600',
  ];

  const lightGradients = [
    'from-blue-500/10 to-indigo-600/10 text-blue-600 dark:text-blue-400',
    'from-emerald-400/10 to-teal-600/10 text-emerald-600 dark:text-emerald-400',
    'from-violet-500/10 to-purple-600/10 text-violet-600 dark:text-violet-400',
    'from-amber-400/10 to-orange-600/10 text-amber-600 dark:text-amber-400',
    'from-rose-400/10 to-red-600/10 text-rose-600 dark:text-rose-400',
    'from-cyan-400/10 to-blue-600/10 text-cyan-600 dark:text-cyan-400',
  ];

  const totalZonalMembers = zones.reduce((acc, curr) => acc + (curr.memberCount || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-semibold">Loading zones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full overflow-x-hidden p-1 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Map className="w-6 h-6 text-primary" />
            Zones
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage geographic cell groups, home churches, and pastoral care zones.
          </p>
        </div>
        <Button onClick={handleCreateZone} className="bg-primary text-primary-foreground shadow-sm rounded-xl px-5 h-10 hover:opacity-90 transition-all duration-200">
          Add New Zone
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid gap-6 md:grid-cols-3 pt-2">
        <Card className="border border-border/80 shadow-md bg-white dark:bg-zinc-900 rounded-2xl relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-emerald-400 to-teal-600" />
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Zones</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="text-3xl font-extrabold tracking-tight">{zones.length}</div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-1 rounded-md">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
              Active geographic cell groups
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border/80 shadow-md bg-white dark:bg-zinc-900 rounded-2xl relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-blue-500 to-indigo-600" />
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zonal Members</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="text-3xl font-extrabold tracking-tight">{totalZonalMembers}</div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-1 rounded-md">
                <Users className="w-3.5 h-3.5" />
              </span>
              Members assigned to zones
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border/80 shadow-md bg-white dark:bg-zinc-900 rounded-2xl relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-violet-500 to-purple-600" />
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="text-3xl font-extrabold tracking-tight">-</div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 p-1 rounded-md">
                <HandHeart className="w-3.5 h-3.5" />
              </span>
              Avg attendance this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Zones Grid */}
      {zones.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-2xl border-border/80 bg-white dark:bg-zinc-900/50 shadow-sm">
          <Map className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-medium">No zones created yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-4">
          {zones.map((zone, idx) => {
            const gradClass = gradients[idx % gradients.length];
            const lightGradClass = lightGradients[idx % lightGradients.length];
            return (
              <Card key={zone.id} className="relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-border/80 rounded-2xl bg-white dark:bg-zinc-900">
                {/* Visual Accent Top Bar */}
                <div className={`absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r ${gradClass}`} />
                
                <CardHeader className="pb-4 pt-8 px-6">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-gradient-to-br ${lightGradClass}`}>
                      <Map className="w-6 h-6 animate-pulse" />
                    </div>
                    <Badge variant="secondary" className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold rounded-full px-3 py-1 text-xs">
                      {zone.memberCount} Members
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold mt-5 text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">{zone.name}</CardTitle>
                  <CardDescription className="text-sm mt-2 leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium min-h-[40px]">{zone.description || 'Geographic cell group for pastoral care.'}</CardDescription>
                </CardHeader>
                
                <CardContent className="px-6 pb-6 pt-0">
                  <div className="space-y-3 mt-2 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">Leader</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{getLeaderName(zone)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <Button 
                      onClick={() => handleViewZoneDetails(zone)}
                      variant="outline" 
                      className="flex-1 rounded-xl h-10 text-sm font-semibold border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-all duration-300"
                    >
                      Roster
                    </Button>
                    <Button 
                      onClick={() => handleEditZone(zone)}
                      variant="outline" 
                      className="flex-1 rounded-xl h-10 text-sm font-semibold border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-all duration-300 text-zinc-600 dark:text-zinc-400"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Zone Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-border/80 shadow-2xl bg-white dark:bg-zinc-900 text-foreground">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Map className="w-5 h-5 text-primary" />
              {editingZone ? 'Manage Zone' : 'Add New Zone'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveZone} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Zone Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Zone A - Abossey Okai"
                className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of coverage area..."
                rows={3}
                className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Zone Leader</label>
              <select 
                value={formData.leaderId}
                onChange={(e) => setFormData(prev => ({ ...prev, leaderId: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
              >
                <option value="">Select a Leader...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getMemberName(m)}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="rounded-xl h-11 flex-1 font-semibold border-zinc-200 dark:border-zinc-800">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl h-11 flex-1 font-semibold bg-primary text-primary-foreground hover:opacity-90">
                {editingZone ? 'Save Changes' : 'Create Zone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Zone Members Dialog */}
      <Dialog open={selectedZone !== null} onOpenChange={(open) => !open && setSelectedZone(null)}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 border border-border/80 shadow-2xl bg-white dark:bg-zinc-900 text-foreground">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Map className="w-6 h-6 text-primary" />
              {selectedZone?.name} Members
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              {selectedZone?.description || 'Active cell group members.'}
            </p>
          </DialogHeader>

          {loadingMembers ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Fetching zonal roster...</p>
            </div>
          ) : selectedZoneMembers.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-2xl border-border/80 bg-zinc-50/50 dark:bg-zinc-800/10">
              <p className="text-sm text-muted-foreground font-medium">No members assigned to this zone yet.</p>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
              <Table>
                <TableHeader className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0 z-10">
                  <TableRow className="border-b border-zinc-200 dark:border-zinc-800">
                    <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Name</TableHead>
                    <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Phone</TableHead>
                    <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Email</TableHead>
                    <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedZoneMembers.map((m) => (
                    <TableRow key={m.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800/60">
                      <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{getMemberName(m)}</TableCell>
                      <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">{m.phone || '-'}</TableCell>
                      <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">{m.email || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="capitalize text-xs font-semibold bg-zinc-100/60 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
                          {m.status}
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
