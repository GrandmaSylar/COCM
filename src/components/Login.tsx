import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth, TwoFAData } from './AuthContext';
import { useTheme } from './ThemeContext';
import { ChurchIcon, Moon, Sun, Monitor, Eye, EyeOff } from 'lucide-react';
import { getFriendlyMessage } from '../utils/error-handler';

interface LoginProps {
  onForgotPassword: () => void;
  onSignUp: () => void;
  onRequires2FA?: (data: TwoFAData) => void;
}

import { sanitizeInput } from '../utils/security';

export function Login({ onForgotPassword, onSignUp, onRequires2FA }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  // ... existing state ...
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { theme, setTheme, isDark } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Sanitize inputs
    const cleanIdentifier = sanitizeInput(identifier);
    // Note: We typically don't sanitize passwords as special chars are valid, 
    // but we should ensure it's a string and trim if policy allows (though usually not trim password).
    // Supabase handles the password hash safely.
    // However, user requested "avoid all risks", so we will ensure it's not a script.
    // Actually, sanitizing password might execute unwanted logic if password contains < or >.
    // We will just use it as is, but rely on parameterized queries. 
    // Wait, XSS in password field? Only if we display the password back.
    // SQLi? Supabase handles it.
    // So sanitizing identifier is key.
    
    if (!cleanIdentifier) {
        setError('Please enter a valid email or phone number.');
        setIsLoading(false);
        return;
    }

    try {
      const result = await login(cleanIdentifier, password);
      if (result.success && result.requires2FA && result.twoFAData) {
        if (onRequires2FA) {
          onRequires2FA(result.twoFAData);
        }
      } else if (!result.success) {
        setError(result.error || 'Invalid email/phone or password. Please check your credentials.');
      }
    } catch (err: any) {
      setError(getFriendlyMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Theme Selector */}
        <div className="flex justify-center">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {themeOptions.map(({ value, icon: Icon, label }) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTheme(value as any)}
                className="h-8 w-8 p-0"
                title={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src="/newlogo.png" alt="Church of Christ, Mataheko" className="w-32 h-32 object-contain" />
            </div>
            <div>
              <CardTitle className="text-2xl">Church Management System</CardTitle>
              <CardDescription className="text-base">
                Church of Christ, Mataheko Congregation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or Phone Number</Label>
                <Input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. email@example.com or 0201234567"
                  required
                  autoComplete="email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Additional Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-muted-foreground hover:text-primary underline"
                >
                  Forgot Password?
                </button>
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-muted-foreground hover:text-primary underline"
                >
                  Create Account
                </button>
              </div>
              
              <div className="text-center text-xs text-muted-foreground border-t pt-3">
                <p>Church of Christ, Mataheko Congregation (CoC.M)</p>
                <p>© 2026 Church Management System</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}