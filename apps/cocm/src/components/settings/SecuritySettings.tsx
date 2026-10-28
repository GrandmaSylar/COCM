import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Shield, Mail, Phone, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { getFriendlyMessage } from '../../utils/error-handler';

// Security / 2FA Settings Component
export function SecuritySettings() {
  const { user, isDev } = useAuth();
  const [twoFAMethod, setTwoFAMethod] = useState<'none' | 'email' | 'phone'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load current 2FA preference from profile
  useEffect(() => {
    const loadPreference = async () => {
      if (!user) return;
      try {
        const { supabase } = await import('@cms/shared');
        const { data: profile } = await supabase
          .from('profiles')
          .select('two_fa_method, phone')
          .eq('id', user.id)
          .single();
        if (profile?.two_fa_method) {
          setTwoFAMethod(profile.two_fa_method);
        }
      } catch (err) {
        console.error('Failed to load 2FA preference:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreference();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.auth.update2FAPreference(twoFAMethod);
      toast.success(
        twoFAMethod === 'none'
          ? 'Two-factor authentication disabled'
          : `Two-factor authentication enabled via ${twoFAMethod === 'email' ? 'Email' : 'Phone SMS'}`
      );
    } catch (err: any) {
      toast.error(getFriendlyMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading security settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication (2FA)
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account. After entering your password, you'll be asked for a verification code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              twoFAMethod === 'none' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            }`}
            onClick={() => setTwoFAMethod('none')}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              twoFAMethod === 'none' ? 'border-primary' : 'border-muted-foreground'
            }`}>
              {twoFAMethod === 'none' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <div>
              <p className="font-medium">Off</p>
              <p className="text-sm text-muted-foreground">Password only (less secure)</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              twoFAMethod === 'email' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            }`}
            onClick={() => setTwoFAMethod('email')}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              twoFAMethod === 'email' ? 'border-primary' : 'border-muted-foreground'
            }`}>
              {twoFAMethod === 'email' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Email OTP</p>
              <p className="text-sm text-muted-foreground">Receive a 6-digit code via email ({user?.email})</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              twoFAMethod === 'phone' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50 opacity-60'
            }`}
            onClick={() => setTwoFAMethod('phone')}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              twoFAMethod === 'phone' ? 'border-primary' : 'border-muted-foreground'
            }`}>
              {twoFAMethod === 'phone' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Phone SMS OTP</p>
              <p className="text-sm text-muted-foreground">Receive a 6-digit code via SMS</p>
            </div>
          </div>
        </div>

        {twoFAMethod === 'phone' && (
          <Alert>
            <Phone className="h-4 w-4" />
            <AlertDescription>
              Make sure your phone number is set in your profile. SMS charges may apply.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save 2FA Preference'}
          </Button>

          {/* Test Sentry Error Button */}
          {isDev && (
            <Button 
              variant="destructive"
              onClick={() => {
                throw new Error("Sentry Test Error from User Request");
              }}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Test Sentry Error
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
