import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from './ui/input-otp';
import { ChurchIcon, ArrowLeft, Mail, Phone, RefreshCw, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

type Step = 'identifier' | 'choose-method' | 'otp' | 'new-password' | 'success';

export function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP state
  const [userId, setUserId] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [destination, setDestination] = useState('');
  const [hasPhone, setHasPhone] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300);

  // Password state
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // OTP expiry countdown
  useEffect(() => {
    if (step !== 'otp' || timeRemaining <= 0) return;
    const timer = setInterval(() => setTimeRemaining(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [step, timeRemaining]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Step 1: Submit identifier
  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // First try with email method to see if user exists and has phone
      const response = await api.auth.forgotPassword(identifier, 'email');
      setUserId(response.userId);
      setTempToken(response.tempToken);
      setDestination(response.destination);
      setHasPhone(response.hasPhone);

      if (response.hasPhone) {
        // User has both email and phone - let them choose
        setStep('choose-method');
      } else {
        // Only email available - go straight to OTP
        setDeliveryMethod('email');
        setResendCooldown(60);
        setTimeRemaining(300);
        setStep('otp');
      }
    } catch (err: any) {
      setError(err?.message || 'Account not found. Please check your email or phone number.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Choose method and send OTP
  const handleMethodSelect = async (method: 'email' | 'phone') => {
    setDeliveryMethod(method);
    setIsLoading(true);
    setError('');

    try {
      // Delete previous OTP and send with chosen method
      const response = await api.auth.forgotPassword(identifier, method);
      setUserId(response.userId);
      setTempToken(response.tempToken);
      setDestination(response.destination);
      setResendCooldown(60);
      setTimeRemaining(300);
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Failed to send verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify OTP
  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await api.auth.verifyResetOtp({ userId, tempToken, code: otpValue });
      setResetToken(response.resetToken);
      setStep('new-password');
    } catch (err: any) {
      setError(err?.message || 'Incorrect code. Please try again.');
      setOtpValue('');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.auth.forgotPassword(identifier, deliveryMethod);
      setTempToken(response.tempToken);
      setResendCooldown(60);
      setTimeRemaining(300);
      setOtpValue('');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await api.auth.resetPassword({ userId, resetToken, newPassword });
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isExpired = timeRemaining <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <ChurchIcon className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>

            {step === 'identifier' && (
              <div>
                <CardTitle className="text-xl">Forgot Password?</CardTitle>
                <CardDescription>Enter your email or phone number to reset your password</CardDescription>
              </div>
            )}
            {step === 'choose-method' && (
              <div>
                <CardTitle className="text-xl">Choose Verification Method</CardTitle>
                <CardDescription>How would you like to receive your verification code?</CardDescription>
              </div>
            )}
            {step === 'otp' && (
              <div>
                <CardTitle className="text-xl">Enter Verification Code</CardTitle>
                <CardDescription>
                  <span className="flex items-center justify-center gap-2">
                    {deliveryMethod === 'email' ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                    Code sent to
                  </span>
                  <span className="font-medium text-foreground mt-1 block">{destination}</span>
                </CardDescription>
              </div>
            )}
            {step === 'new-password' && (
              <div>
                <CardTitle className="text-xl">Set New Password</CardTitle>
                <CardDescription>Enter your new password below</CardDescription>
              </div>
            )}
            {step === 'success' && (
              <div>
                <div className="flex justify-center mb-2">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <CardTitle className="text-xl">Password Reset!</CardTitle>
                <CardDescription>Your password has been changed successfully. You can now sign in.</CardDescription>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: Enter identifier */}
            {step === 'identifier' && (
              <form onSubmit={handleIdentifierSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or Phone Number</Label>
                  <Input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your email or phone number"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Looking up account...' : 'Continue'}
                </Button>
                <button type="button" onClick={onBackToLogin} className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </form>
            )}

            {/* Step 2: Choose method */}
            {step === 'choose-method' && (
              <div className="space-y-3">
                <div
                  className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleMethodSelect('email')}
                >
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">Send code to your email address</p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleMethodSelect('phone')}
                >
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Phone SMS</p>
                    <p className="text-sm text-muted-foreground">Send code to your phone number</p>
                  </div>
                </div>
                {isLoading && <p className="text-center text-sm text-muted-foreground">Sending code...</p>}
                <button type="button" onClick={() => setStep('identifier')} className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </div>
            )}

            {/* Step 3: OTP verification */}
            {step === 'otp' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue} disabled={isLoading || isExpired}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="text-center text-sm">
                  {isExpired ? (
                    <span className="text-destructive font-medium">Code expired. Please resend.</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Expires in <span className="font-medium text-foreground">{formatTime(timeRemaining)}</span>
                    </span>
                  )}
                </div>

                <Button className="w-full" onClick={handleVerifyOtp} disabled={isLoading || otpValue.length !== 6 || isExpired}>
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Button>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => { setStep('identifier'); setError(''); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                    <ArrowLeft className="h-4 w-4" />
                    Start over
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isLoading}
                    className="gap-1"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend code'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: New password */}
            {step === 'new-password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Resetting password...' : 'Reset Password'}
                </Button>
              </form>
            )}

            {/* Step 5: Success */}
            {step === 'success' && (
              <Button onClick={onBackToLogin} className="w-full">
                Back to Login
              </Button>
            )}

            <div className="text-center text-xs text-muted-foreground border-t pt-3">
              <p>Church of Christ, Mataheko Congregation (CoC.M)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
