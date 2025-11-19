import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth, demoCredentials } from './AuthContext';
import { useTheme } from './ThemeContext';
import { ChurchIcon, Moon, Sun, Monitor, Info, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onForgotPassword: () => void;
  onSignUp: () => void;
}

export function Login({ onForgotPassword, onSignUp }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);
  const { login } = useAuth();
  const { theme, setTheme, isDark } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Add slight delay to show loading state
    setTimeout(async () => {
      const success = await login(email, password);
      if (!success) {
        setError('Invalid email or password. Please check your credentials or try a demo account.');
      }
      setIsLoading(false);
    }, 800);
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
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
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <ChurchIcon className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl">Church Management System</CardTitle>
              <CardDescription className="text-base">
                Church of Christ, Mataheko Congregation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Demo Accounts Info */}
            {showDemoAccounts && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Demo Accounts Available:</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowDemoAccounts(false)}
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {Object.entries(demoCredentials).map(([email, password]) => {
                        const role = email.split('@')[0];
                        const roleColors = {
                          dev: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
                          admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
                          pastor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
                          elder: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        };
                        return (
                          <div key={email} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={roleColors[role as keyof typeof roleColors]}>
                                  {role.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{email}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">Password: {password}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDemoLogin(email, password)}
                              className="h-7 text-xs"
                            >
                              Use
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
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
                <p>© 2024 Church Management System</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}