import { useState, FormEvent } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth, TwoFAData } from './AuthContext';
import { useTheme } from './ThemeContext';
import { Moon, Sun, Eye, EyeOff, User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { getFriendlyMessage } from '../utils/error-handler';
import { sanitizeInput } from '../utils/security';

interface LoginProps {
  onForgotPassword: () => void;
  onSignUp: () => void;
  onRequires2FA?: (data: TwoFAData) => void;
}

export function Login({ onForgotPassword, onSignUp, onRequires2FA }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const cleanIdentifier = sanitizeInput(identifier);
    
    if (!cleanIdentifier) {
        setError('Please enter a valid email or phone number.');
        setIsLoading(false);
        return;
    }

    try {
      const result = await login(cleanIdentifier, password, keepSignedIn);
      // Check if requires2FA exists on result (it might not if success is false)
      if (result.success && 'requires2FA' in result && result.requires2FA && 'twoFAData' in result) {
        if (onRequires2FA) {
          onRequires2FA(result.twoFAData);
        }
      } else if (!result.success) {
        // Safe access to error property
        const errorMessage = 'error' in result ? result.error : 'Invalid credentials';
        setError(errorMessage || 'Invalid email/phone or password.');
      }
    } catch (err: any) {
      setError(getFriendlyMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = handleSubmit;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[100px] animate-pulse" style={{ animationDelay: '1s', animationDuration: '10s' }} />
      
      {/* Theme Toggle (Absolute) */}
      <div className="absolute top-6 right-6 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full hover:bg-accent/50 transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="w-full max-w-md p-6 relative z-10 animate-fade-in-up">
        <div className="glass-card rounded-3xl p-8 sm:p-10 shadow-2xl border-white/20 dark:border-white/10 bg-card/80 backdrop-blur-xl">
          <div className="flex flex-col items-center mb-8 space-y-2 text-center">
            <img src="/newlogo.png" alt="Church of Christ, Mataheko" className="w-24 h-24 object-contain mb-2" />
            <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to Church of Christ, Mataheko
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider ml-1">
                Email or Phone
              </Label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Enter your email or phone"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10 h-11 bg-background/50 border-input/50 focus:bg-background transition-all duration-300 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Password
                </Label>
                <button type="button" onClick={onForgotPassword} className="text-xs text-primary hover:text-primary/80 hover:underline transition-all">
                  Forgot password?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-background/50 border-input/50 focus:bg-background transition-all duration-300 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Keep me signed in */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <div className="relative shrink-0">
                <input
                  type="checkbox"
                  id="keepSignedIn"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-4 h-4 rounded border border-input/70 bg-background/50 peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 flex items-center justify-center">
                  {keepSignedIn && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                      <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Keep me signed in
              </span>
            </label>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-base font-medium shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-0 text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-gradient-end))' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <button type="button" onClick={onSignUp} className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors">
              Create one
            </button>
          </div>
        </div>
        
        <p className="text-center text-xs text-muted-foreground/50 mt-8">
            © {new Date().getFullYear()} Church of Christ, Mataheko. All rights reserved.
        </p>
      </div>
    </div>
  );
}