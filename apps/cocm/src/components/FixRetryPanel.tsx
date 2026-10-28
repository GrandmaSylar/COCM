import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface FixRetryPanelProps {
  reason: string;
  onRetry: () => void;
}

export function FixRetryPanel({ reason, onRetry }: FixRetryPanelProps) {
  return (
    <div className="mb-6 bg-destructive/10 border border-destructive/30 rounded-xl p-4 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h2 className="text-lg font-semibold text-destructive">
          Sync Execution Paused
        </h2>
      </div>
      <p className="text-sm text-destructive mb-4">
        We encountered a persistent network or server error while trying to sync your changes: <br/>
        <span className="inline-block mt-2 font-mono bg-destructive/10 px-2 py-1 rounded text-destructive border border-destructive/30">
          {reason || "Unknown error"}
        </span>
      </p>
      <p className="text-sm text-destructive mb-4">
        Your offline changes are safely saved on this device. Please check your connection or wait a moment, then try again.
      </p>
      <div className="flex justify-end pt-3 border-t border-destructive/30">
        <Button size="sm" onClick={onRetry} className="bg-destructive hover:bg-destructive text-white">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Sync Now
        </Button>
      </div>
    </div>
  );
}
