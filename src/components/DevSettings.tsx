import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { api } from '../services/api';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, ShieldAlert } from 'lucide-react';

interface NotificationConfig {
  type: string;
  isEnabled: boolean;
  allowedRoles: string[];
  allowedUserIds: string[];
}

interface ActivityLogConfig {
  actionType: string;
  entityType: string;
  isEnabled: boolean;
  allowedRoles: string[];
  allowedUserIds: string[];
}

const allRoles = ['dev', 'admin', 'pastor', 'elder', 'member', 'viewer'];

export function DevSettings() {
  const [loading, setLoading] = useState(true);
  
  const [notifConfigs, setNotifConfigs] = useState<NotificationConfig[]>([]);
  const [logConfigs, setLogConfigs] = useState<ActivityLogConfig[]>([]);

  // Dialog states
  const [editingNotif, setEditingNotif] = useState<NotificationConfig | null>(null);
  const [editingLog, setEditingLog] = useState<ActivityLogConfig | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [nData, lData] = await Promise.all([
        api.admin.getNotificationConfig(),
        api.admin.getActivityLogConfig()
      ]);
      setNotifConfigs(nData);
      setLogConfigs(lData);
    } catch (error) {
      console.error('Failed to fetch dev settings:', error);
      toast.error('Failed to load developer settings');
    } finally {
      setLoading(false);
    }
  };

  const saveNotifConfig = async () => {
    if (!editingNotif?.type) return;
    try {
      await api.admin.updateNotificationConfig(editingNotif.type, editingNotif);
      toast.success('Notification config saved');
      setEditingNotif(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save configuration');
    }
  };

  const saveLogConfig = async () => {
    if (!editingLog?.actionType || !editingLog?.entityType) return;
    try {
      await api.admin.updateActivityLogConfig(editingLog.actionType, editingLog.entityType, editingLog);
      toast.success('Activity Log config saved');
      setEditingLog(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save configuration');
    }
  };

  const toggleRole = (roles: string[], role: string) => {
    if (roles.includes(role)) return roles.filter(r => r !== role);
    return [...roles, role];
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-500" />
                Notification Visibility
              </CardTitle>
              <CardDescription>Configure which roles receive specific notification types.</CardDescription>
            </div>
            <Button onClick={() => setEditingNotif({ type: '', isEnabled: true, allowedRoles: [], allowedUserIds: [] })}>
              <Plus className="w-4 h-4 mr-2" /> Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notifConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No custom rules. Notifications are visible to all by default.</p>
          ) : (
            <div className="space-y-3">
              {notifConfigs.map((cfg, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-semibold">{cfg.type}</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant={cfg.isEnabled ? "default" : "destructive"}>
                        {cfg.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {cfg.allowedRoles.map(r => (
                        <Badge key={r} variant="outline">{r}</Badge>
                      ))}
                      {cfg.allowedRoles.length === 0 && cfg.isEnabled && (
                        <span className="text-xs text-muted-foreground">Applies to all roles</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditingNotif(cfg)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-500" />
                Activity Log Visibility
              </CardTitle>
              <CardDescription>Configure which roles can view specific activity log entries.</CardDescription>
            </div>
            <Button onClick={() => setEditingLog({ actionType: '', entityType: '', isEnabled: true, allowedRoles: [], allowedUserIds: [] })}>
              <Plus className="w-4 h-4 mr-2" /> Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No custom rules. Activity logs are restricted by user unless privileged.</p>
          ) : (
            <div className="space-y-3">
              {logConfigs.map((cfg, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-semibold">{cfg.actionType} - {cfg.entityType}</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant={cfg.isEnabled ? "default" : "destructive"}>
                        {cfg.isEnabled ? 'Visible' : 'Hidden'}
                      </Badge>
                      {cfg.allowedRoles.map(r => (
                        <Badge key={r} variant="outline">{r}</Badge>
                      ))}
                      {cfg.allowedRoles.length === 0 && cfg.isEnabled && (
                        <span className="text-xs text-muted-foreground">Visible to all standard roles</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditingLog(cfg)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Notif Dialog */}
      <Dialog open={!!editingNotif} onOpenChange={open => !open && setEditingNotif(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNotif?.type ? 'Edit Rule' : 'New Notification Rule'}</DialogTitle>
            <DialogDescription>Define a delivery configuration for a notification type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notification Type (e.g. "auth", "member")</Label>
              <Input 
                value={editingNotif?.type || ''} 
                onChange={e => setEditingNotif(editingNotif ? { ...editingNotif, type: e.target.value } : null)}
                placeholder="system_alert"
                disabled={!!notifConfigs.find(c => c.type === editingNotif?.type)}
              />
            </div>
            <div className="flex items-center justify-between border p-3 rounded-md">
              <Label>Globally Enabled</Label>
              <Switch 
                checked={editingNotif?.isEnabled ?? false} 
                onCheckedChange={v => setEditingNotif(editingNotif ? { ...editingNotif, isEnabled: v } : null)}
              />
            </div>
            {editingNotif?.isEnabled && (
              <div className="space-y-2">
                <Label>Allowed Roles (if none selected, applies to ALL)</Label>
                <div className="flex flex-wrap gap-2">
                  {allRoles.map(role => {
                    const isSelected = editingNotif.allowedRoles.includes(role);
                    return (
                      <Badge 
                        key={role} 
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEditingNotif({ ...editingNotif, allowedRoles: toggleRole(editingNotif.allowedRoles, role) })}
                      >
                        {role}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNotif(null)}>Cancel</Button>
            <Button onClick={saveNotifConfig}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Log Dialog */}
      <Dialog open={!!editingLog} onOpenChange={open => !open && setEditingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLog?.actionType ? 'Edit Rule' : 'New Log Visibility Rule'}</DialogTitle>
            <DialogDescription>Define visibility for specific action/entity combinations in the Activity Log.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select 
                  value={editingLog?.actionType || ''} 
                  onValueChange={v => setEditingLog(editingLog ? { ...editingLog, actionType: v } : null)}
                  disabled={!!logConfigs.find(c => c.actionType === editingLog?.actionType && c.entityType === editingLog?.entityType)}
                >
                  <SelectTrigger><SelectValue placeholder="e.g. create" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">create</SelectItem>
                    <SelectItem value="update">update</SelectItem>
                    <SelectItem value="delete">delete</SelectItem>
                    <SelectItem value="login">login</SelectItem>
                    <SelectItem value="logout">logout</SelectItem>
                    <SelectItem value="export">export</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select 
                  value={editingLog?.entityType || ''} 
                  onValueChange={v => setEditingLog(editingLog ? { ...editingLog, entityType: v } : null)}
                  disabled={!!logConfigs.find(c => c.actionType === editingLog?.actionType && c.entityType === editingLog?.entityType)}
                >
                  <SelectTrigger><SelectValue placeholder="e.g. members" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="members">members</SelectItem>
                    <SelectItem value="attendance">attendance</SelectItem>
                    <SelectItem value="visitors">visitors</SelectItem>
                    <SelectItem value="giving">giving</SelectItem>
                    <SelectItem value="services">services</SelectItem>
                    <SelectItem value="auth">auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between border p-3 rounded-md">
              <Label>Visible (Enabled)</Label>
              <Switch 
                checked={editingLog?.isEnabled ?? false} 
                onCheckedChange={v => setEditingLog(editingLog ? { ...editingLog, isEnabled: v } : null)}
              />
            </div>
            {editingLog?.isEnabled && (
              <div className="space-y-2">
                <Label>Required Roles (if none selected, applies to ALL)</Label>
                <div className="flex flex-wrap gap-2">
                  {allRoles.map(role => {
                    const isSelected = editingLog.allowedRoles.includes(role);
                    return (
                      <Badge 
                        key={role} 
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEditingLog({ ...editingLog, allowedRoles: toggleRole(editingLog.allowedRoles, role) })}
                      >
                        {role}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLog(null)}>Cancel</Button>
            <Button onClick={saveLogConfig} disabled={!editingLog?.actionType || !editingLog?.entityType}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
