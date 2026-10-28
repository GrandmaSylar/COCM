import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../ui/sheet';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { Edit, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { PERMISSION_GROUPS, TAB_OPTIONS, WIDGET_OPTIONS, TAB_CRUD_PERMISSIONS } from './shared';

export function RoleFormSheet({ open, onOpenChange, editingRole, existingRoles, onSaved }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingRole) {
      setName(editingRole.name);
      setDescription(editingRole.description || '');
      setSelectedPermissions(editingRole.permissions || []);
      setSelectedTabs(editingRole.tabAccess || []);
      setSelectedWidgets(editingRole.dashboardWidgets || []);
    } else {
      setName('');
      setDescription('');
      setSelectedPermissions([]);
      setSelectedTabs([]);
      setSelectedWidgets([]);
    }
    setNameError('');
  }, [editingRole, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Role name is required');
      return;
    }
    
    const conflict = existingRoles.find((r: any) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== editingRole?.id);
    if (conflict) {
      setNameError('A role with this name already exists');
      return;
    }
    
    setIsSaving(true);
    setNameError('');
    
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        permissions: selectedPermissions,
        tabAccess: selectedTabs,
        dashboardWidgets: selectedWidgets
      };
      
      let result;
      if (editingRole) {
        result = await api.customRoles.update(editingRole.id, payload);
      } else {
        result = await api.customRoles.create(payload);
      }
      
      toast.success(editingRole ? `Role '${name.trim()}' updated.` : `Role '${name.trim()}' created.`);
      onSaved(result);
      onOpenChange(false);
    } catch (err: any) {
      const isNameConflict = err?.message?.toLowerCase().includes('already exists') || err?.message?.toLowerCase().includes('duplicate');
      if (isNameConflict) {
        setNameError(err?.message || 'A role with this name already exists');
      } else {
        toast.error(err?.message || 'Failed to save role');
        setNameError(err?.message || 'Failed to save role');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGroupPermissions = (groupPerms: string[]) => {
    const allSelected = groupPerms.every(p => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !groupPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => Array.from(new Set([...prev, ...groupPerms])));
    }
  };

  const toggleTab = (tabId: string) => {
    setSelectedTabs(prev => {
      const isCurrentlySelected = prev.includes(tabId);
      if (isCurrentlySelected) {
        const tabPerms = TAB_CRUD_PERMISSIONS[tabId] || [];
        if (tabPerms.length > 0) {
          setSelectedPermissions(currentPerms => currentPerms.filter(p => !tabPerms.includes(p)));
        }
        return prev.filter(t => t !== tabId);
      }
      return [...prev, tabId];
    });
  };

  const toggleCrudPermission = (permString: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permString) ? prev.filter(p => p !== permString) : [...prev, permString]
    );
  };

  const toggleWidget = (widgetId: string) => {
    setSelectedWidgets(prev => prev.includes(widgetId) ? prev.filter(w => w !== widgetId) : [...prev, widgetId]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl gap-0">
        <SheetHeader>
          <SheetTitle>{editingRole ? `Edit Role — ${editingRole.name}` : 'Create Custom Role'}</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="role-name">Role Name <span className="text-destructive">*</span></Label>
              <Input 
                id="role-name" 
                value={name} 
                onChange={e => { setName(e.target.value); setNameError(''); }}
                placeholder="e.g. Finance Team"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea 
                id="role-desc" 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                placeholder="What can users with this role do?"
                rows={2}
              />
            </div>
          </div>

          <Separator />
          
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Function Permissions</h3>
            {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]: any) => (
              <div key={groupName} className="space-y-2 border rounded-lg p-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="font-medium text-sm">{groupName}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs px-2"
                    onClick={() => toggleGroupPermissions(perms)}
                  >
                    {perms.every((p: string) => selectedPermissions.includes(p)) ? 'Clear all' : 'Select all'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {perms.map((p: string) => (
                    <div key={p} className="flex items-start space-x-2">
                      <Checkbox 
                        id={`perm-${p}`}
                        checked={selectedPermissions.includes(p)}
                        onCheckedChange={(checked) => {
                          setSelectedPermissions(prev => 
                            checked ? [...prev, p] : prev.filter(x => x !== p)
                          );
                        }}
                      />
                      <label htmlFor={`perm-${p}`} className="text-xs font-medium leading-none cursor-pointer">
                        {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator />

           <div className="space-y-3">
            <h3 className="font-semibold text-sm">Tab Access</h3>
            <div className="space-y-3 border rounded-lg p-3">
              {TAB_OPTIONS.map(tab => {
                const isSelected = selectedTabs.includes(tab.id);
                const hasCrud = TAB_CRUD_PERMISSIONS[tab.id]?.length > 0;
                const activeCrudPerms = hasCrud 
                  ? TAB_CRUD_PERMISSIONS[tab.id].filter(p => selectedPermissions.includes(p)) 
                  : [];
                const isReadOnly = isSelected && hasCrud && activeCrudPerms.length === 0;

                return (
                  <div key={tab.id} className="flex flex-col space-y-2 pb-3 border-b last:border-0 last:pb-0">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`tab-${tab.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleTab(tab.id)}
                      />
                      <label htmlFor={`tab-${tab.id}`} className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer flex-1">
                        <div className="flex items-center gap-1.5 p-1 rounded-md bg-muted/50 border">
                          <tab.icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        {tab.label}
                      </label>
                      {isReadOnly && (
                        <Badge variant="outline" className="text-[10px]">Read only</Badge>
                      )}
                    </div>
                    {isSelected && hasCrud && (
                      <div className="pl-8 flex flex-wrap gap-4">
                        {TAB_CRUD_PERMISSIONS[tab.id].map(perm => {
                          const actionMatch = perm.match(/^(create|update|delete)/);
                          const actionLabel = actionMatch ? actionMatch[1].charAt(0).toUpperCase() + actionMatch[1].slice(1) : perm;
                          return (
                            <div key={perm} className="flex items-center space-x-1.5">
                              <Checkbox 
                                id={`crud-${perm}`}
                                checked={selectedPermissions.includes(perm)}
                                onCheckedChange={() => toggleCrudPermission(perm)}
                                className="w-3.5 h-3.5"
                              />
                              <label htmlFor={`crud-${perm}`} className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                                {actionLabel}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Dashboard Widgets</h3>
            <div className="flex flex-wrap gap-2">
              {WIDGET_OPTIONS.map(widget => (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                    selectedWidgets.includes(widget.id) 
                      ? 'bg-primary/10 border-primary/30 text-primary-text ' 
                      : 'bg-transparent border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {widget.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingRole ? 'Save Changes' : 'Save Role'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
