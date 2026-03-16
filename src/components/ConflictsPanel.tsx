import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Loader2, AlertTriangle, CheckCircle2, Server, Smartphone } from "lucide-react";
import { getConflicts, removeConflict, ConflictEntry } from "../services/offlineStore";
import { invalidateApiCache } from "../services/apiClient";
import { api } from "../services/api";
import { toast } from "sonner";

interface ConflictsPanelProps {
  onAllResolved: () => void;
}

export function ConflictsPanel({ onAllResolved }: ConflictsPanelProps) {
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [resolving, setResolving] = useState<number | null>(null);

  const loadConflicts = async () => {
    try {
      const data = await getConflicts();
      setConflicts(data);
    } catch (err) {
      console.error("Failed to load conflicts:", err);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  const getApiModule = (moduleName: string) => {
    const apiMap: Record<string, any> = {
      members: api.members,
      attendance: api.attendance,
      giving: api.giving,
      expenses: api.expenses,
    };
    return apiMap[moduleName];
  };

  const getRecordIdentifier = (conflict: ConflictEntry) => {
    const payload = conflict.localPayload as any;
    // Attempt to find a recognizable name in the payload
    const name = payload.name || payload.title || payload.description || payload.id || "Unknown Record";
    return name;
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const getDiffSummary = (payload: any) => {
    if (!payload) return "No data";
    if (payload.deleted) return "Record deleted online";
    
    // Simple summary: show keys and values (omitting large objects/arrays)
    const entries = Object.entries(payload).filter(([k, v]) => 
      k !== 'id' && typeof v !== 'object'
    ).slice(0, 3);
    
    if (entries.length === 0) return "Modified";
    
    return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  };

  const handleResolve = async (conflict: ConflictEntry, action: 'keep-mine' | 'keep-server') => {
    if (!conflict.id) return;
    setResolving(conflict.id);

    try {
      const apiModule = getApiModule(conflict.module);
      if (!apiModule) {
        throw new Error(`Unknown module: ${conflict.module}`);
      }

      const localPayload = conflict.localPayload as any;
      const serverPayload = conflict.serverPayload as any;
      const recordId = conflict.recordId || localPayload.id;

      if (action === 'keep-mine') {
        if (serverPayload?.deleted) {
          // Recreate the record
          // Remove ID so backend can assign a new one, or pass it if backend supports forced IDs
          const { id, ...createPayload } = localPayload;
          await apiModule.create(createPayload);
        } else {
          // Overwrite server version
          await apiModule.update(recordId, localPayload);
        }
      } else if (action === 'keep-server') {
        if (serverPayload?.deleted) {
          // Server deleted it, we accept. No API call needed.
        } else {
          // Align local with server
          await apiModule.update(recordId, serverPayload);
        }
      }

      // Success
      await removeConflict(conflict.id);
      invalidateApiCache('/' + conflict.module);
      
      const remainingConflicts = await getConflicts();
      setConflicts(remainingConflicts);
      toast.success('Conflict resolved');

      if (remainingConflicts.length === 0) {
        onAllResolved();
        window.dispatchEvent(new Event("conflicts-resolved"));
      }

    } catch (err: any) {
      console.error("Failed to resolve conflict:", err);
      toast.error(`Resolution failed: ${err.message || 'Unknown error'}`);
    } finally {
      setResolving(null);
    }
  };

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-orange-900 dark:text-orange-200">
          Sync Conflicts ({conflicts.length})
        </h2>
      </div>
      
      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <div key={conflict.id} className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-orange-200 dark:border-orange-800/50">
              <h3 className="font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                <span className="uppercase text-xs font-bold bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded-full">
                  {capitalize(conflict.module)}
                </span>
                {getRecordIdentifier(conflict)}
              </h3>
              <span className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                {new Date(conflict.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Local Version */}
              <div className="bg-white dark:bg-background border border-orange-100 dark:border-orange-900/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <Smartphone className="w-4 h-4 text-blue-500" />
                    Your version (offline)
                  </span>
                </div>
                <div className="text-muted-foreground bg-muted/50 p-2 rounded line-clamp-3 font-mono text-xs">
                  {getDiffSummary(conflict.localPayload)}
                </div>
              </div>

              {/* Server Version */}
              <div className="bg-white dark:bg-background border border-orange-100 dark:border-orange-900/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <Server className="w-4 h-4 text-emerald-500" />
                    Server version
                  </span>
                </div>
                <div className={`p-2 rounded line-clamp-3 font-mono text-xs ${
                  (conflict.serverPayload as any)?.deleted 
                    ? "text-red-600 bg-red-50 dark:bg-red-950/30 italic" 
                    : "text-muted-foreground bg-muted/50"
                }`}>
                  {getDiffSummary(conflict.serverPayload)}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t border-orange-200 dark:border-orange-800/50">
              <Button
                variant="outline"
                size="sm"
                className="bg-white dark:bg-background hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700"
                disabled={resolving !== null}
                onClick={() => handleResolve(conflict, 'keep-server')}
              >
                {resolving === conflict.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                Keep Server's
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={resolving !== null}
                onClick={() => handleResolve(conflict, 'keep-mine')}
              >
                {resolving === conflict.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Keep Mine
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
