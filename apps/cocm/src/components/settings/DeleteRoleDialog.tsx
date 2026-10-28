import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '../ui/alert-dialog';
import { Separator } from '../ui/separator';
import { Users, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';

export function DeleteRoleDialog({ open, onOpenChange, deleteTarget, allRoles, allSystemUsers, onDeleted }: any) {
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setReassignments({});
    }
  }, [open]);

  const hasUsers = deleteTarget?.users?.length > 0;
  
  const handleConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    
    try {
      if (hasUsers) {
        const payload = Object.entries(reassignments).map(([userId, newRole]) => ({ userId, newRole }));
        await api.customRoles.delete(deleteTarget.id, payload);
        toast.success(`Role '${deleteTarget.name}' deleted. ${payload.length} users reassigned.`);
      } else {
        await api.customRoles.delete(deleteTarget.id);
        toast.success(`Role '${deleteTarget.name}' deleted.`);
      }
      onDeleted(deleteTarget.id);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete role');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!deleteTarget) return null;

  if (!hasUsers) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Role
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const isFormValid = Object.keys(reassignments).length === deleteTarget.users.length && 
                      Object.values(reassignments).every(v => v !== '');

  const otherCustomRoles = allRoles.filter((r: any) => r.id !== deleteTarget.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Role & Reassign Users</DialogTitle>
          <DialogDescription>
            The role <strong>{deleteTarget.name}</strong> has {deleteTarget.users.length} users assigned to it. 
            You must reassign them to a new role before it can be deleted.
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>This action cannot be undone.</AlertDescription>
        </Alert>

        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
          {deleteTarget.users.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between gap-3">
              <span className="text-base font-medium truncate">{u.name}</span>
              <Select 
                value={reassignments[u.id] || ''} 
                onValueChange={(val) => setReassignments(prev => ({ ...prev, [u.id]: val }))}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">System</div>
                  <SelectItem value="dev">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="pastor">Pastor</SelectItem>
                  <SelectItem value="elder">Elder</SelectItem>
                  
                  {otherCustomRoles.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">Custom</div>
                      {otherCustomRoles.map((cr: any) => (
                        <SelectItem key={cr.id} value={cr.name}>{cr.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!isFormValid || isDeleting}>
            {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Reassign & Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
