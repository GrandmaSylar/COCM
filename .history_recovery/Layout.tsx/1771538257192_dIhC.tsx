import { ReactNode } from "react";
import { Button } from "./ui/button";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import {
  Users,
  Calendar,
  Banknote,
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
  Church,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../services/api";

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
        console.error("Failed to fetch unread count:", err);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "services", label: "Services", icon: Church },
    { id: "members", label: "Members", icon: Users },
    { id: "visitors", label: "Visitors", icon: UserPlus },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "giving", label: "Giving", icon: Banknote },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "activity-log", label: "Activity Log", icon: ClipboardList },
    { id: "help", label: "Help", icon: HelpCircle },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const filteredNavItems = navigationItems.filter((item) => {
    // Always visible tabs
    if (["dashboard", "help", "settings"].includes(item.id)) return true;

    // Tab-access-based filtering
    return hasTabAccess(item.id);
  });

  // User initials for avatar
  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
        {/* Mobile Header — frosted glass */}
        <div className="lg:hidden bg-card/72 ios-surface border-b border-border/50 px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
          <h1 className="text-base font-semibold tracking-tight">CoC.M</h1>
          <div className="flex items-center gap-1">
            {/* Notification Bell for Mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("notifications")}
              className="w-9 h-9 p-0 relative rounded-full"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#FF3B30] text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-soft-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
            {/* Theme Toggle for Mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 p-0 rounded-full"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-menu-btn"
              className="w-9 h-9 p-0 rounded-full"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex">
          {/* Desktop Sidebar — frosted glass */}
          <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30" id="sidebar-nav">
            <div className="flex flex-col flex-grow bg-sidebar ios-surface border-r border-border/50 overflow-y-auto">
              <div className="flex items-center justify-between flex-shrink-0 px-5 py-4 border-b border-border/50">
                <h1 className="text-base font-semibold tracking-tight leading-tight">
                  Church of Christ,<br />Mataheko
                </h1>
                {/* Theme Toggle — segmented control style */}
                <div className="flex gap-0.5 p-0.5 bg-muted/80 rounded-lg">
                  {[
                    { value: "light", icon: Sun },
                    { value: "dark", icon: Moon },
                    { value: "system", icon: Monitor },
                  ].map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value as any)}
                      className={`h-6 w-6 flex items-center justify-center rounded-md transition-all duration-200 ${
                        theme === value
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={value}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                {/* Notification Bell */}
                <div className="px-3 pt-3">
                  <button
                    onClick={() => onNavigate("notifications")}
                    className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      currentPage === "notifications"
                        ? "bg-primary/12 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <div className="relative">
                      <Bell className="w-[18px] h-[18px] mr-3" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-0.5 bg-[#FF3B30] text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center animate-soft-pulse">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-[#FF3B30] text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
                <nav className="flex-1 px-3 py-2 space-y-0.5">
                  {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] ${
                          currentPage === item.id
                            ? "bg-primary/12 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                      >
                        <Icon className="w-[18px] h-[18px] mr-3 shrink-0" />
                        <span className="text-[13px]">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* User area */}
                <div className="px-3 py-4 border-t border-border/50 space-y-3">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-9 h-9 rounded-full bg-primary/12 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {userInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {user?.role}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={logout}
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Navigation — frosted glass drawer */}
          {mobileMenuOpen && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div
                className="fixed inset-y-0 left-0 w-[75vw] max-w-[280px] bg-card ios-surface shadow-2xl animate-slide-in-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <h1 className="text-base font-semibold">CoC.M</h1>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-8 h-8 p-0 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    {filteredNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onNavigate(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] ${
                            currentPage === item.id
                              ? "bg-primary/12 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px] mr-3 shrink-0" />
                          <span className="text-[13px]">{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  <div className="px-3 py-4 border-t border-border/50 space-y-3">
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-9 h-9 rounded-full bg-primary/12 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {userInitials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {user?.role}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={logout}
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 lg:ml-64 overflow-x-hidden content-watermark">
            <main className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6 overflow-x-hidden max-w-full">
              <div
                key={currentPage}
                className="page-transition overflow-x-hidden"
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Mobile FAB — iOS-style floating action button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        id="mobile-fab-nav"
        className={`lg:hidden w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 active:scale-[0.92] ${
          mobileMenuOpen
            ? "bg-card text-foreground shadow-lg"
            : "bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(0,122,255,0.35)] hover:shadow-[0_6px_20px_rgba(0,122,255,0.45)]"
        }`}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "16px",
          zIndex: 9999,
        }}
      >
        {mobileMenuOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>
    </>
  );
}
