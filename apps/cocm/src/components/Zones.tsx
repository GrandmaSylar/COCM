import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Map, Users, TrendingUp, HandHeart, Loader2, ArrowRight, Settings, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { EmptyState, Group, GroupRow, IconTile, LargeTitle } from './ui/ios';
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

  const TONES = ['success', 'info', 'primary', 'warning', 'gray', 'info'] as const;

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
    <div className="space-y-4 w-full overflow-x-hidden pb-6">
      <LargeTitle
        title="Zones"
        subtitle="Geographic cell groups, home churches and pastoral care zones"
        actions={
          <Button onClick={handleCreateZone}>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add New Zone</span>
            <span className="sr-only sm:hidden">Add New Zone</span>
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Map, tone: 'success' as const, value: zones.length, label: 'Zones' },
          { icon: Users, tone: 'info' as const, value: totalZonalMembers, label: 'Zonal Members' },
          { icon: HandHeart, tone: 'warning' as const, value: '-', label: 'Avg Attendance' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card p-3 sm:p-4">
            <IconTile icon={stat.icon} tone={stat.tone} />
            <div className="mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums">{stat.value}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {zones.length === 0 ? (
        <Group>
          <EmptyState icon={Map} title="No zones yet" description="Zones you add will appear here." />
        </Group>
      ) : (
        <Group title="All zones" footer="Tap a zone to see its roster.">
          {zones.map((zone, idx) => (
            <div key={zone.id} className="flex items-stretch">
              <GroupRow
                className="flex-1"
                icon={Map}
                iconTone={TONES[idx % TONES.length]}
                title={zone.name}
                subtitle={getLeaderName(zone)}
                value={`${zone.memberCount} ${zone.memberCount === 1 ? 'member' : 'members'}`}
                onClick={() => handleViewZoneDetails(zone)}
              />
              <Button variant="ghost" size="icon" className="mr-1 self-center" aria-label={`Manage ${zone.name}`} onClick={() => handleEditZone(zone)}>
                <Settings className="size-4" />
              </Button>
            </div>
          ))}
        </Group>
      )}

      {/* Zone Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-border/80 shadow-sm bg-card text-foreground">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Map className="w-5 h-5 text-primary" />
              {editingZone ? 'Manage Zone' : 'Add New Zone'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveZone} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zone Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Zone A - Abossey Okai"
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of coverage area..."
                rows={3}
                className="w-full p-3 rounded-xl border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zone Leader</label>
              <select 
                value={formData.leaderId}
                onChange={(e) => setFormData(prev => ({ ...prev, leaderId: e.target.value }))}
                className="w-full h-11 px-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
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
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="rounded-xl h-11 flex-1 font-semibold border-border">
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
        <DialogContent className="max-w-3xl rounded-3xl p-6 border border-border/80 shadow-sm bg-card text-foreground">
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
            <div className="text-center py-12 border border-dashed rounded-2xl border-border/80 bg-muted">
              <p className="text-sm text-muted-foreground font-medium">No members assigned to this zone yet.</p>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border shadow-inner">
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow className="border-b border-border">
                    <TableHead className="font-semibold text-foreground">Name</TableHead>
                    <TableHead className="font-semibold text-foreground">Phone</TableHead>
                    <TableHead className="font-semibold text-foreground">Email</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedZoneMembers.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted border-b border-border">
                      <TableCell className="font-medium text-foreground">{getMemberName(m)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.phone || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.email || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="capitalize text-xs font-semibold bg-muted text-muted-foreground border-border">
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
