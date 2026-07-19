import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface FixRetryPanelProps {
  reason: string;
  onRetry: () => void;
}

export function FixRetryPanel({ reason, onRetry }: FixRetryPanelProps) {
  return (
    <div className="mb-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">
          Sync Execution Paused
        </h2>
      </div>
      <p className="text-sm text-red-800 dark:text-red-300 mb-4">
        We encountered a persistent network or server error while trying to sync your changes: <br/>
        <span className="inline-block mt-2 font-mono bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50">
          {reason || "Unknown error"}
        </span>
      </p>
      <p className="text-sm text-red-800 dark:text-red-300 mb-4">
        Your offline changes are safely saved on this device. Please check your connection or wait a moment, then try again.
      </p>
      <div className="flex justify-end pt-3 border-t border-red-200 dark:border-red-800/50">
        <Button size="sm" onClick={onRetry} className="bg-red-600 hover:bg-red-700 text-white">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Sync Now
        </Button>
      </div>
    </div>
  );
}
