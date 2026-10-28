import { useState, useEffect } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { EmptyState, Group, IconTile, LargeTitle } from './ui/ios';
import { PullToRefresh } from './ui/ios-gestures';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { MoreHorizontal, Bell, CheckCheck, Users, Calendar, Banknote, Cake, AlertCircle, Eye, ChevronRight, UserPlus, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { supabase } from '@cms/shared';
import { ConflictsPanel } from './ConflictsPanel';
import { OfflineOverlay } from './OfflineOverlay';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  tab: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsProps {
  onNotificationClick?: (notification: Notification) => void;
}

const typeIcons: Record<string, any> = {
  member_status_change: Users,
  member_registered: UserPlus,
  giving_record: Banknote,
  attendance_record: Calendar,
  birthday: Cake,
  system: AlertCircle,
};

const typeColors: Record<string, string> = {
  member_status_change: 'text-secondary',
  member_registered: 'text-success-text',
  giving_record: 'text-success-text',
  attendance_record: 'text-warning-text',
  birthday: 'text-pink-500',
  system: 'text-secondary',
};

const typeBgColors: Record<string, string> = {
  member_status_change: 'bg-secondary/10',
  member_registered: 'bg-success/10',
  giving_record: 'bg-success/10',
  attendance_record: 'bg-warning/10',
  birthday: 'bg-pink-500/10',
  system: 'bg-secondary/10',
};

const typeTones: Record<string, 'primary' | 'gray' | 'success' | 'warning' | 'info'> = {
  member_status_change: 'info',
  member_registered: 'success',
  giving_record: 'success',
  attendance_record: 'warning',
  birthday: 'primary',
  system: 'gray',
};

export function Notifications({ onNotificationClick }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase.channel('user-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchNotifications(false); // Fetch silently on new data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, showUnreadOnly]);

  const fetchNotifications = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.notifications.getAll({ page, limit: 20, unreadOnly: showUnreadOnly });
      setNotifications(data?.notifications || []);
      setTotal(data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchNotifications();
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) {
      await markAsRead(n.id);
    }
    onNotificationClick?.(n);
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <OfflineOverlay>
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4 relative">
      <LargeTitle
        title="Notifications"
        subtitle={total > 0 ? `${unreadCount} unread` : undefined}
        actions={
          <>
            <Button variant={showUnreadOnly ? 'default' : 'soft'} size="sm" onClick={() => { setShowUnreadOnly(!showUnreadOnly); setPage(1); }}>
              {showUnreadOnly ? 'Show All' : 'Unread Only'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="soft" size="icon" aria-label="More actions">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </DropdownMenuItem>
                {unreadCount > 0 && (
                  <DropdownMenuItem onClick={markAllAsRead}>
                    <CheckCheck className="w-4 h-4" />
                    Mark All Read
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <ConflictsPanel onAllResolved={handleRefresh} />

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Group>
          <EmptyState icon={Bell} title={showUnreadOnly ? 'No unread notifications' : 'No notifications yet'} description="You're all caught up!" />
        </Group>
      ) : (
        <Group>
          {notifications.map((n) => {
            const IconComp = typeIcons[n.type] || Bell;
            const tone = typeTones[n.type] || 'gray';
            const isClickable = !!onNotificationClick;
            const content = (
              <>
                <span className={`size-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-primary'}`} aria-label={n.isRead ? undefined : 'Unread'} />
                <IconTile icon={IconComp} tone={tone} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex items-start justify-between gap-2">
                    <span className={`text-[15px] leading-snug ${n.isRead ? '' : 'font-semibold'}`}>{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatTime(n.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">{n.message}</span>
                  {n.tab && <span className="mt-1.5 inline-block rounded-full bg-fill px-2 py-0.5 text-xs capitalize text-muted-foreground">{n.tab}</span>}
                </span>
              </>
            );
            const rowClass = 'relative flex w-full items-start gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-[3.75rem] after:right-0 after:h-px after:bg-separator last:after:hidden';
            return (
              <div key={n.id} className={`flex items-start ${isClickable ? '' : ''}`}>
                {isClickable ? (
                  <button type="button" onClick={() => handleNotificationClick(n)} className={`${rowClass} transition-colors hover:bg-accent/60 active:bg-accent`}>
                    {content}
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/60" />
                  </button>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
                {!n.isRead && (
                  <Button variant="ghost" size="icon" className="mr-1 mt-2 shrink-0" aria-label="Mark as read" onClick={() => markAsRead(n.id)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </Group>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
    </PullToRefresh>
    </OfflineOverlay>
  );
}
