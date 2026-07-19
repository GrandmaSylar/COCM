import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@cms/shared';

interface UseRealtimeAttendanceOptions {
  onSessionFinalized?: (data: { absentMemberIds: string[] }) => void;
  onSessionCancelled?: () => void;
}

export function useRealtimeAttendance(
  attendanceRecordId: string | null,
  options?: UseRealtimeAttendanceOptions
) {
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<any>(null);
  const onFinalizedRef = useRef(options?.onSessionFinalized);
  const onCancelledRef = useRef(options?.onSessionCancelled);

  // Keep refs in sync
  useEffect(() => {
    onFinalizedRef.current = options?.onSessionFinalized;
    onCancelledRef.current = options?.onSessionCancelled;
  }, [options?.onSessionFinalized, options?.onSessionCancelled]);

  // Load existing entries when record is ready
  useEffect(() => {
    if (!attendanceRecordId) {
      setIsReady(false);
      return;
    }

    // Initial load
    supabase
      .from('attendance_entries')
      .select('member_id')
      .eq('attendance_record_id', attendanceRecordId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Realtime] Initial load error:', error);
        }
        if (data) setPresentIds(new Set(data.map(r => r.member_id)));
        setIsReady(true);
      });

    // Use a single channel with broadcast for both mark/unmark
    const channel = supabase
      .channel(`attendance-live-${attendanceRecordId}`, {
        config: { broadcast: { self: false } }
      })
      // Listen for postgres INSERT changes (for cross-device marks)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_entries',
        filter: `attendance_record_id=eq.${attendanceRecordId}`
      }, (payload) => {
        console.log('[Realtime] INSERT received:', payload.new.member_id);
        setPresentIds(prev => new Set([...prev, payload.new.member_id]));
      })
      // Listen for broadcast unmark events (workaround for DELETE not filtering)
      .on('broadcast', { event: 'unmark' }, (payload) => {
        console.log('[Realtime] UNMARK broadcast received:', payload.payload.memberId);
        setPresentIds(prev => {
          const next = new Set(prev);
          next.delete(payload.payload.memberId);
          return next;
        });
      })
      // Listen for session finalized broadcast
      .on('broadcast', { event: 'session_finalized' }, (payload) => {
        console.log('[Realtime] SESSION FINALIZED received:', payload.payload);
        onFinalizedRef.current?.(payload.payload);
      })
      .on('broadcast', { event: 'session_cancelled' }, () => {
        console.log('[Realtime] SESSION CANCELLED received');
        onCancelledRef.current?.();
      })
      .subscribe((status, err) => {
        console.log('[Realtime] Subscription status:', status, err || '');
      });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Cleaning up channel');
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [attendanceRecordId]);

  const markPresent = useCallback(async (memberId: string) => {
    if (!attendanceRecordId) return;
    
    // Optimistic UI update
    setPresentIds(prev => new Set([...prev, memberId]));
    
    const { error } = await supabase.from('attendance_entries').insert({
      attendance_record_id: attendanceRecordId,
      member_id: memberId
    });
    
    if (error) {
      console.error('[Realtime] Insert error:', error);
      // Rollback optimistic update
      setPresentIds(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  }, [attendanceRecordId]);

  const markAbsent = useCallback(async (memberId: string) => {
    if (!attendanceRecordId) return;
    
    // Optimistic UI update
    setPresentIds(prev => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    
    const { error } = await supabase.from('attendance_entries')
      .delete()
      .eq('attendance_record_id', attendanceRecordId)
      .eq('member_id', memberId);
    
    if (error) {
      console.error('[Realtime] Delete error:', error);
      // Rollback optimistic update
      setPresentIds(prev => new Set([...prev, memberId]));
      return;
    }

    // Broadcast the unmark to other devices (since DELETE postgres_changes is unreliable)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'unmark',
      payload: { memberId }
    });
  }, [attendanceRecordId]);

  // Broadcast session finalized to all other devices
  const broadcastFinalized = useCallback((totalPresent: number, absentMemberIds: string[]) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'session_finalized',
      payload: { totalPresent, absentMemberIds }
    });
  }, []);

  // Broadcast session cancelled to all other devices
  const broadcastCancelled = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'session_cancelled',
      payload: {}
    });
  }, []);

  const toggleMember = useCallback((memberId: string) => {
    if (presentIds.has(memberId)) {
      markAbsent(memberId);
    } else {
      markPresent(memberId);
    }
  }, [presentIds, markPresent, markAbsent]);

  return { presentIds, isReady, toggleMember, markPresent, markAbsent, broadcastFinalized, broadcastCancelled };
}
