import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Shield, Mail, Phone, ArrowLeft, Save, Crown } from 'lucide-react';
import { useAuth, UserRole } from '../AuthContext';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { getFriendlyMessage } from '../../utils/error-handler';
import { SystemUser, roleLabels } from './shared';

// Add User Component
export interface AddUserProps {
  onBack: () => void;
  onSave: (user: Omit<SystemUser, 'id' | 'lastLogin'>) => void;
}

export function AddUser({ onBack, onSave }: AddUserProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '' as UserRole | '',
    password: '',
    status: 'active' as 'active' | 'inactive',
    twoFaMethod: 'none' as 'none' | 'email' | 'phone'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const { isDev } = useAuth();

  useEffect(() => {
    if (isDev) {
      api.customRoles.getAll().then(setCustomRoles).catch(console.error);
    }
  }, [isDev]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role) return;

    setIsLoading(true);

    try {
      await api.users.create({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone,
        twoFaMethod: formData.twoFaMethod
      });

      toast.success('User created successfully');
      onBack();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      toast.error(getFriendlyMessage(error));
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isValid = formData.name && formData.email && formData.phone && 
                  formData.role && formData.password;

  return (
    <div className="space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-hidden w-full min-w-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Add System User</h1>
          <p className="text-muted-foreground">
            Create a new user account
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 w-full overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+233 XX XXX XXXX"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">System</div>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem 
                        key={value} 
                        value={value}
                        disabled={value === 'dev' && !isDev}
                      >
                        <div className="flex items-center gap-2">
                          {label}
                          {value === 'dev' && <Crown className="w-3 h-3 text-purple-600" />}
                        </div>
                      </SelectItem>
                    ))}

                    {isDev && customRoles.length > 0 && (
                      <>
                        <Separator className="my-1" />
                        <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">Custom</div>
                        {customRoles.map((cr) => (
                          <SelectItem key={cr.id} value={cr.name}>
                            {cr.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {formData.role === 'dev' && !isDev && (
                  <p className="text-xs text-muted-foreground">
                    Only developers can create other developer accounts.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Enter secure password"
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Two-Factor Authentication</Label>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Enable 2FA</p>
                    <p className="text-xs text-muted-foreground">Require verification code on login</p>
                  </div>
                </div>
                <Switch
                  checked={formData.twoFaMethod !== 'none'}
                  onCheckedChange={(checked) => handleInputChange('twoFaMethod', checked ? 'email' : 'none')}
                />
              </div>
              {formData.twoFaMethod !== 'none' && (
                <div className="flex flex-col gap-3 sm:gap-2">
                  <Button
                    type="button"
                    variant={formData.twoFaMethod === 'email' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleInputChange('twoFaMethod', 'email')}
                    className="gap-1 w-full sm:w-auto"
                  >
                    <Mail className="w-3 h-3" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={formData.twoFaMethod === 'phone' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleInputChange('twoFaMethod', 'phone')}
                    disabled={!formData.phone}
                    className="gap-1 w-full sm:w-auto"
                  >
                    <Phone className="w-3 h-3" />
                    Phone SMS
                  </Button>
                  {!formData.phone && formData.twoFaMethod === 'phone' && (
                    <p className="text-xs text-destructive self-center">Phone number required</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button type="submit" disabled={!isValid || isLoading}>
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Creating...' : 'Create User'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
