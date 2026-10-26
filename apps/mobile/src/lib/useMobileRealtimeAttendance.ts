import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { upsertLocalAttendanceEntry, removeLocalAttendanceEntry } from './db';

interface Options {
  onSessionFinalized?: (data: { absentMemberIds: string[] }) => void;
  onSessionCancelled?: () => void;
}

export function useMobileRealtimeAttendance(
  attendanceRecordId: string | null,
  options?: Options
) {
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!attendanceRecordId) {
      setIsReady(false);
      return;
    }

    // Load initial attendance entries from Supabase (or SQLite)
    supabase
      .from('attendance_entries')
      .select('member_id')
      .eq('attendance_record_id', attendanceRecordId)
      .then(({ data, error }) => {
        if (data) {
          const ids = new Set(data.map(r => r.member_id));
          setPresentIds(ids);

          // Seed local SQLite database with present attendance entries
          data.forEach(entry => {
            upsertLocalAttendanceEntry({
              id: `${attendanceRecordId}_${entry.member_id}`,
              attendance_record_id: attendanceRecordId,
              member_id: entry.member_id,
              created_at: new Date().toISOString()
            }).catch(() => {});
          });
        }
        setIsReady(true);
      });

    // Join real-time WebSocket broadcast channel
    const channel = supabase
      .channel(`attendance-live-${attendanceRecordId}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_entries',
        filter: `attendance_record_id=eq.${attendanceRecordId}`
      }, (payload) => {
        const memberId = payload.new.member_id;
        setPresentIds(prev => new Set([...prev, memberId]));
        upsertLocalAttendanceEntry({
          id: payload.new.id || `${attendanceRecordId}_${memberId}`,
          attendance_record_id: attendanceRecordId,
          member_id: memberId,
          created_at: payload.new.created_at || new Date().toISOString()
        }).catch(() => {});
      })
      .on('broadcast', { event: 'unmark' }, (payload) => {
        const memberId = payload.payload.memberId;
        setPresentIds(prev => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
        removeLocalAttendanceEntry(attendanceRecordId, memberId).catch(() => {});
      })
      .on('broadcast', { event: 'session_finalized' }, (payload) => {
        options?.onSessionFinalized?.(payload.payload);
      })
      .on('broadcast', { event: 'session_cancelled' }, () => {
        options?.onSessionCancelled?.();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [attendanceRecordId]);

  const markPresent = useCallback(async (memberId: string) => {
    if (!attendanceRecordId) return;

    // 0ms Instant Local SQLite Write
    setPresentIds(prev => new Set([...prev, memberId]));
    await upsertLocalAttendanceEntry({
      id: `${attendanceRecordId}_${memberId}`,
      attendance_record_id: attendanceRecordId,
      member_id: memberId,
      created_at: new Date().toISOString()
    });

    // Sync to Supabase
    const { error } = await supabase.from('attendance_entries').insert({
      attendance_record_id: attendanceRecordId,
      member_id: memberId
    });

    if (error) {
      console.warn('[AttendanceLive] Insert error, entry remains queued in SQLite:', error);
    }
  }, [attendanceRecordId]);

  const markAbsent = useCallback(async (memberId: string) => {
    if (!attendanceRecordId) return;

    // 0ms Instant Local SQLite Delete
    setPresentIds(prev => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    await removeLocalAttendanceEntry(attendanceRecordId, memberId);

    // Sync to Supabase
    const { error } = await supabase.from('attendance_entries')
      .delete()
      .eq('attendance_record_id', attendanceRecordId)
      .eq('member_id', memberId);

    if (!error) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'unmark',
        payload: { memberId }
      });
    }
  }, [attendanceRecordId]);

  const toggleMember = useCallback((memberId: string) => {
    if (presentIds.has(memberId)) {
      markAbsent(memberId);
    } else {
      markPresent(memberId);
    }
  }, [presentIds, markPresent, markAbsent]);

  return { presentIds, isReady, toggleMember, markPresent, markAbsent };
}
