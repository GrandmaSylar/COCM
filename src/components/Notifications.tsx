import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Bell, CheckCheck, Users, Calendar, DollarSign, Cake, AlertCircle, Eye } from 'lucide-react';
import { api } from '../services/api';

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

const typeIcons: Record<string, any> = {
  member_status_change: Users,
  member_registered: Users,
  giving_record: DollarSign,
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

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [page, showUnreadOnly]);

  const fetchNotifications = async () => {
    setLoading(true);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-secondary" />
          </div>
          <h1>Notifications</h1>
        </div>
        <div className="flex gap-2">
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

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{showUnreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const IconComp = typeIcons[n.type] || Bell;
            const iconColor = typeColors[n.type] || 'text-gray-500';
            return (
              <Card key={n.id} className={`transition-colors ${!n.isRead ? 'border-l-4 border-l-amber-500 bg-amber-500/5' : ''}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={`mt-0.5 ${iconColor}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{n.title}</div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                    {n.tab && (
                      <span className="inline-block mt-1 text-xs bg-muted px-2 py-0.5 rounded capitalize">{n.tab}</span>
                    )}
                  </div>
                  {!n.isRead && (
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => markAsRead(n.id)}>
                      <Eye className="w-3 h-3" />
                    </Button>
                  )}
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
  );
}
