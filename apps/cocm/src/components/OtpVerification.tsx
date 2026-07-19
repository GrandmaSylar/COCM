import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from './ui/input-otp';
import { ChurchIcon, ArrowLeft, Mail, Phone, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface OtpVerificationProps {
  userId: string;
  tempToken: string;
  method: 'email' | 'phone';
  destination: string;
  onVerified: (session: any, user: any) => void;
  onCancel: () => void;
}

export function OtpVerification({ userId, tempToken, method, destination, onVerified, onCancel }: OtpVerificationProps) {
  const [otpValue, setOtpValue] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // OTP expiry countdown
  useEffect(() => {
    if (timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleVerify = async () => {
    if (otpValue.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await api.auth.verifyOtp({ userId, tempToken, code: otpValue });
      if (response && response.session && response.user) {
        onVerified(response.session, response.user);
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
      setOtpValue('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError('');

    try {
      await api.auth.resendOtp({ userId, tempToken });
      setResendCooldown(60);
      setTimeRemaining(300);
      setOtpValue('');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code. Please sign in again.');
    } finally {
      setIsResending(false);
    }
  };

  const isExpired = timeRemaining <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <ChurchIcon className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <div>
              <CardTitle className="text-xl">Two-Factor Verification</CardTitle>
              <CardDescription className="text-base mt-2">
                <span className="flex items-center justify-center gap-2">
                  {method === 'email' ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  Enter the 6-digit code sent to
                </span>
                <span className="font-medium text-foreground mt-1 block">{destination}</span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* OTP Input */}
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otpValue}
                onChange={setOtpValue}
                disabled={isVerifying || isExpired}
              >
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

            {/* Timer */}
            <div className="text-center text-sm">
              {isExpired ? (
                <span className="text-destructive font-medium">Code expired. Please resend or sign in again.</span>
              ) : (
                <span className="text-muted-foreground">
                  Code expires in <span className="font-medium text-foreground">{formatTime(timeRemaining)}</span>
                </span>
              )}
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Verify Button */}
            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={isVerifying || otpValue.length !== 6 || isExpired}
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </Button>

            {/* Resend & Back */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className="gap-1"
              >
                <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
                {isResending
                  ? 'Sending...'
                  : resendCooldown > 0
                  ? `Resend (${resendCooldown}s)`
                  : 'Resend code'}
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground border-t pt-3">
              <p>Church of Christ, Mataheko Congregation (CoC.M)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
