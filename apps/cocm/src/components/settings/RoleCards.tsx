import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Edit, Trash2, Users, Crown } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { roleColors, allPermissions } from './shared';

// ----- New Components for Custom Roles -----

export function SystemRoleCard({ role, label, permissions, users, isExpanded, onToggleExpand, onTogglePermission }: any) {
  const { isDev } = useAuth();
  const isDevRole = role === 'dev';
  
  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Badge className={(roleColors as any)[role]}>{label}</Badge>
            {isDevRole && <span className="text-sm text-primary-text">Supreme Access</span>}
          </div>
          <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={onToggleExpand}>
            <Users className="w-3 h-3 mr-1" />
            {users.length} Users
          </Badge>
        </div>
        
        {isExpanded && users.length > 0 && (
          <div className="text-sm text-muted-foreground bg-muted/20 p-2 rounded-md">
            {users.map((u: any) => u.name).join(', ')}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {allPermissions.map((permission: string) => {
            const hasPermission = permissions.includes(permission);
            return (
              <div
                key={permission}
                className={`flex items-center space-x-2 p-2 rounded border min-w-0 ${isDev && !isDevRole ? 'cursor-pointer hover:bg-muted/50' : ''} ${hasPermission ? 'bg-success-soft border-success/30 ' : 'bg-muted border-border '}`}
                onClick={() => !isDevRole && isDev && onTogglePermission(permission)}
              >
                {isDev && !isDevRole && (
                  <Checkbox
                    checked={hasPermission}
                    onCheckedChange={() => onTogglePermission(permission)}
                    disabled={isDevRole}
                  />
                )}
                <span className={`text-xs truncate ${hasPermission ? 'text-success-text' : 'text-muted-foreground'}`}>
                  {permission.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
                {isDevRole && <Crown className="w-3 h-3 text-primary-text ml-auto flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function CustomRoleCard({ role, isExpanded, onToggleExpand, onEdit, onDelete }: any) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{role.name}</CardTitle>
            {role.description && <CardDescription className="text-xs line-clamp-2 mt-1">{role.description}</CardDescription>}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button aria-label="Edit" size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button aria-label="Delete" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2">
          {role.permissions?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {role.permissions.slice(0, 3).map((p: string) => (
                <Badge key={p} className="bg-success-soft text-success-text hover:bg-success-soft text-[10px] px-1.5 py-0">
                  {p.replace(/_/g, ' ')}
                </Badge>
              ))}
              {role.permissions.length > 3 && (
                <Badge className="bg-success-soft text-success-text text-[10px] px-1.5 py-0">+{role.permissions.length - 3}</Badge>
              )}
            </div>
          )}
          {role.tabAccess?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {role.tabAccess.slice(0, 3).map((t: string) => (
                <Badge key={t} className="bg-info-soft text-info-text hover:bg-info-soft text-[10px] px-1.5 py-0">
                  {t}
                </Badge>
              ))}
              {role.tabAccess.length > 3 && (
                <Badge className="bg-info-soft text-info-text text-[10px] px-1.5 py-0">+{role.tabAccess.length - 3}</Badge>
              )}
            </div>
          )}
          {role.dashboardWidgets?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {role.dashboardWidgets.slice(0, 3).map((w: string) => (
                <Badge key={w} className="bg-muted text-foreground hover:bg-muted text-[10px] px-1.5 py-0 ">
                  {w.replace(/-/g, ' ')}
                </Badge>
              ))}
              {role.dashboardWidgets.length > 3 && (
                <Badge className="bg-muted text-foreground text-[10px] px-1.5 py-0">+{role.dashboardWidgets.length - 3}</Badge>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 mt-auto border-t text-xs text-muted-foreground flex items-center justify-between">
          <span title={new Date(role.createdAt).toLocaleString()}>
            Created by {role.createdByName || role.createdBy || 'System'} · {new Date(role.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Badge variant="secondary" className="cursor-pointer text-[10px] h-5" onClick={onToggleExpand}>
            <Users className="w-3 h-3 mr-1" />
            {role.users?.length || 0}
          </Badge>
        </div>
        
        {isExpanded && role.users?.length > 0 && (
          <div className="text-xs bg-muted/30 p-2 rounded mt-2 max-h-24 overflow-y-auto">
            {role.users.map((u: any) => u.name).join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
