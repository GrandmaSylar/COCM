import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineOverlayProps {
  children: React.ReactNode;
}

export function OfflineOverlay({ children }: OfflineOverlayProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="relative">
      {/* Always render children so shell structure is preserved */}
      <div className={!isOnline ? 'pointer-events-none select-none' : undefined}>
        {children}
      </div>

      {/* Overlay shown when offline */}
      {!isOnline && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <WifiOff className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground max-w-xs">
              This section is unavailable offline. Reconnect to continue.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
