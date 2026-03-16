import { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';

interface SplashScreenProps {
  isReady: boolean;
  onComplete: () => void;
}

export function SplashScreen({ isReady, onComplete }: SplashScreenProps) {
  const { isDark } = useTheme();
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const isReadyRef = useRef(isReady);
  const completedRef = useRef(false);

  // Keep ref in sync with prop
  isReadyRef.current = isReady;

  // Minimum duration timer
  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Loader timer — show progress bar if still loading after 1s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReadyRef.current) setShowLoader(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Effect 1: detect readiness and toggle isExiting
  useEffect(() => {
    if (isReady && minDurationElapsed && !isExiting) {
      setIsExiting(true);
    }
  }, [isReady, minDurationElapsed, isExiting]);

  // Effect 2: schedule onComplete when isExiting becomes true
  useEffect(() => {
    if (!isExiting || completedRef.current) return;
    completedRef.current = true;
    const timer = setTimeout(onComplete, 400);
    return () => clearTimeout(timer);
  }, [isExiting, onComplete]);

  // Determine root classes based on motion preference
  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const getExitClass = () => {
    if (!isExiting) return '';
    return prefersReduced ? 'splash-fade-out' : 'splash-exit';
  };

  const rootClasses = [
    prefersReduced ? 'splash-fade-in' : '',
    getExitClass(),
  ].filter(Boolean).join(' ');

  return (
    <div
      className={rootClasses}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 9999,
        backgroundColor: isDark ? '#0f1117' : '#f8f9fc',
      }}
    >
      {/* Gradient overlay */}
      <div
        className="splash-gradient-morph"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: isDark
            ? 'radial-gradient(ellipse at 40% 30%, rgba(96,165,250,0.20) 0%, rgba(37,99,235,0.12) 45%, transparent 70%), radial-gradient(ellipse at 65% 65%, rgba(29,78,216,0.14) 0%, transparent 55%)'
            : 'radial-gradient(ellipse at 40% 30%, rgba(37,99,235,0.18) 0%, rgba(59,130,246,0.10) 40%, transparent 70%), radial-gradient(ellipse at 70% 70%, rgba(29,78,216,0.12) 0%, transparent 60%)',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        {/* Logo container */}
        <div
          className="splash-logo-in"
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
            background: isDark
              ? 'linear-gradient(135deg, #2563eb, #60a5fa)'
              : 'linear-gradient(135deg, #2563eb, #3b82f6)',
            boxShadow: isDark
              ? '0 8px 40px rgba(96,165,250,0.30)'
              : '0 8px 32px rgba(37,99,235,0.25)',
          }}
        >
          <img
            src="/newlogo.png"
            alt="CoC.M Logo"
            width={96}
            height={96}
            style={{ borderRadius: 24 }}
          />
        </div>

        {/* Church name */}
        <p
          className="splash-text-in"
          style={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: 20,
            margin: 0,
            color: isDark ? '#f9fafb' : '#111827',
            animationDelay: '300ms',
          }}
        >
          Church of Christ, Mataheko
        </p>

        {/* Tagline */}
        <p
          className="splash-text-in"
          style={{
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: 13,
            margin: 0,
            color: isDark ? '#9ca3af' : '#6b7280',
            animationDelay: '500ms',
          }}
        >
          Managing God's House
        </p>
      </div>

      {/* Progress bar — shows only when loading takes longer than 1s */}
      {showLoader && !isReady && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            overflow: 'hidden',
          }}
        >
          <div
            className="splash-shimmer"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50%',
              height: '100%',
              background: isDark
                ? 'linear-gradient(90deg, transparent, #60a5fa, #93c5fd, transparent)'
                : 'linear-gradient(90deg, transparent, #2563eb, #3b82f6, transparent)',
            }}
          />
        </div>
      )}
    </div>
  );
}
