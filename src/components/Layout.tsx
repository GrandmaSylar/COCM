import { ReactNode } from 'react';
import { Button } from './ui/button';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import {
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Home,
  Menu,
  X,
  Play,
  Moon,
  Sun,
  Monitor,
  Shield,
  UserPlus,
  HelpCircle,
  ClipboardList,
  Bell,
  Church
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, logout, hasTabAccess } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await api.notifications.getUnreadCount();
        setUnreadCount(data?.count || 0);
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'services', label: 'Services', icon: Church },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'visitors', label: 'Visitors', icon: UserPlus },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'giving', label: 'Giving', icon: DollarSign },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'activity-log', label: 'Activity Log', icon: ClipboardList },
    { id: 'help', label: 'Help', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredNavItems = navigationItems.filter(item => {
    // Always visible tabs
    if (['dashboard', 'help', 'settings'].includes(item.id)) return true;

    // Tab-access-based filtering
    return hasTabAccess(item.id);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden bg-card border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-medium">CoC.M</h1>
        <div className="flex items-center gap-2">
          {/* Notification Bell for Mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('notifications')}
            className="w-8 h-8 p-0 relative"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center animate-soft-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          {/* Theme Toggle for Mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 p-0"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-col flex-grow bg-card border-r overflow-y-auto">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b">
              <h1 className="text-xl font-medium">Church of Christ, Mataheko</h1>
              {/* Theme Toggle for Desktop */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {[
                  { value: 'light', icon: Sun },
                  { value: 'dark', icon: Moon },
                  { value: 'system', icon: Monitor }
                ].map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={theme === value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTheme(value as any)}
                    className="h-6 w-6 p-0"
                    title={value}
                  >
                    <Icon className="h-3 w-3" />
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-between">
              {/* Notification Bell */}
              <div className="px-4 pt-3">
                <button
                  onClick={() => onNavigate('notifications')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 'notifications'
                      ? 'bg-secondary text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/10'
                  }`}
                >
                  <div className="relative">
                    <Bell className="w-5 h-5 mr-3" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-amber-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
              <nav className="flex-1 px-4 py-4 space-y-2">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                        currentPage === item.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
              
              <div className="px-4 py-4 border-t space-y-3">
                <div>
                  <p className="text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>

                <Button onClick={logout} variant="outline" size="sm" className="w-full">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50 animate-fade-in">
            <div className="fixed inset-y-0 left-0 w-64 bg-card shadow-xl animate-slide-in-left">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h1 className="text-lg">Church of Christ, Mataheko</h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                <nav className="flex-1 px-4 py-4 space-y-2">
                  {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                          currentPage === item.id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
                
                <div className="px-4 py-4 border-t space-y-3">
                  <div>
                    <p className="text-sm">{user?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                  </div>

                  <Button onClick={logout} variant="outline" size="sm" className="w-full">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 lg:ml-64">
          <main className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6">
            <div key={currentPage} className="page-transition">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t safe-bottom z-40 animate-slide-in-bottom">
        <div className="flex">
          {filteredNavItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex-1 flex flex-col items-center py-2.5 px-1 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-primary'
                }`}
              >
                <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                  <Icon className="w-5 h-5 mb-0.5" />
                </div>
                <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}