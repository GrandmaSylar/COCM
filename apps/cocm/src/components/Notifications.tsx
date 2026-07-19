import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Bell, CheckCheck, Users, Calendar, Banknote, Cake, AlertCircle, Eye, ChevronRight, UserPlus, RefreshCw } from 'lucide-react';
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
  member_registered: 'text-emerald-500',
  giving_record: 'text-emerald-500',
  attendance_record: 'text-amber-500',
  birthday: 'text-pink-500',
  system: 'text-secondary',
};

const typeBgColors: Record<string, string> = {
  member_status_change: 'bg-secondary/10',
  member_registered: 'bg-emerald-500/10',
  giving_record: 'bg-emerald-500/10',
  attendance_record: 'bg-amber-500/10',
  birthday: 'bg-pink-500/10',
  system: 'bg-secondary/10',
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
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center shadow-sm">
            <Bell className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Notifications</h1>
            {total > 0 && <p className="text-sm text-muted-foreground">{unreadCount} unread</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={showUnreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowUnreadOnly(!showUnreadOnly); setPage(1); }}
          >
            {showUnreadOnly ? 'Show All' : 'Unread Only'}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-3 h-3 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      <ConflictsPanel onAllResolved={handleRefresh} />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium">{showUnreadOnly ? 'No unread notifications' : 'No notifications yet'}</p>
            <p className="text-sm mt-1">You're all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 stagger-children">
          {notifications.map((n) => {
            const IconComp = typeIcons[n.type] || Bell;
            const iconColor = typeColors[n.type] || 'text-gray-500';
            const iconBg = typeBgColors[n.type] || 'bg-gray-500/10';
            const isClickable = !!onNotificationClick;
            return (
              <Card
                key={n.id}
                className={`transition-all shadow-sm hover:shadow-md ${!n.isRead ? 'border-l-4 border-l-amber-500 bg-amber-500/5' : ''} ${isClickable ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
                onClick={() => isClickable && handleNotificationClick(n)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                    <IconComp className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{n.title}</div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                    {n.tab && (
                      <span className="inline-block mt-1.5 text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{n.tab}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isClickable && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
    </OfflineOverlay>
  );
}
