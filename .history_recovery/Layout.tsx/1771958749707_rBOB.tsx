import { ReactNode } from "react";
import { Button } from "./ui/button";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
  User,
  Baby,
  ReceiptText,
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
    { id: "children", label: "Children", icon: Baby },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "giving", label: "Giving", icon: Banknote },
    { id: "expenses", label: "Expenses", icon: ReceiptText },
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

  return (
    <>
      <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
        {/* Mobile Header */}
        <div className="lg:hidden bg-card border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/newlogo.png" alt="logo" className="w-8 h-8 object-contain" />
            <h1 className="text-lg font-medium">CoC.M</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell for Mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("notifications")}
              className="w-8 h-8 p-0 relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center animate-soft-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
            {/* Theme Toggle for Mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-8 h-8 p-0"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            {/* Mobile User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 focus:outline-none ring-2 ring-primary/30 hover:ring-primary/60 transition-all" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-gradient-end))' }}>
                  {user?.name?.charAt(0) || <User className="w-4 h-4" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <p className="font-semibold text-sm truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigate("settings")} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-menu-btn"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30" id="sidebar-nav">
            <div className="flex flex-col flex-grow bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border shadow-sm overflow-y-auto">
              <div className="flex items-center justify-between flex-shrink-0 px-4 py-4 border-b border-sidebar-border/50">
                <div className="flex items-center gap-2 min-w-0">
                  <img src="/newlogo.png" alt="logo" className="w-7 h-7 object-contain shrink-0" />
                  <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent truncate" style={{ backgroundImage: 'linear-gradient(135deg, var(--primary), var(--primary-gradient-end))' }}>
                    CoC.M
                  </h1>
                </div>
                {/* Theme Toggle for Desktop */}
                <div className="flex gap-0.5 p-1 bg-sidebar-accent/50 rounded-lg border border-sidebar-border/50 shrink-0 ml-2">
                  {[
                    { value: "light", icon: Sun },
                    { value: "dark", icon: Moon },
                    { value: "system", icon: Monitor },
                  ].map(({ value, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={theme === value ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTheme(value as any)}
                      className={`h-6 w-6 p-0 rounded-md transition-all duration-200 ${
                        theme === value 
                          ? "bg-background text-foreground shadow-sm scale-110" 
                          : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                      }`}
                      title={value}
                    >
                      <Icon className="h-3 w-3" />
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between py-4">
                {/* Notification Bell */}
                <div className="px-4 pb-2">
                  <button
                    onClick={() => onNavigate("notifications")}
                    className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      currentPage === "notifications"
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:translate-x-1"
                    }`}
                  >
                    <div className="relative">
                      <Bell className={`w-5 h-5 mr-3 transition-transform duration-300 ${currentPage === "notifications" ? "rotate-12" : "group-hover:rotate-12"}`} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse border-2 border-sidebar">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="font-medium">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full px-2 py-0.5 border border-amber-500/20">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
                
                <nav className="flex-1 px-4 space-y-1.5">
                  <p className="px-4 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2 mt-2">Menu</p>
                  {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:translate-x-1"
                        }`}
                      >
                        {isActive && (
                            <div className="absolute inset-0 bg-white/10 dark:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                        <Icon className={`w-5 h-5 mr-3 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="px-4 pt-4 mt-auto">
                    <div className="p-4 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ring-2 ring-background" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-gradient-end))' }}>
                                {user?.name?.charAt(0) || "U"}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-semibold truncate">{user?.name}</p>
                                <p className="text-xs text-muted-foreground capitalize truncate">
                                {user?.role}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={logout}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Log Out
                        </Button>
                    </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div
                className="fixed inset-y-0 left-0 w-[80%] max-w-[300px] bg-card border-r shadow-2xl animate-slide-in-left p-0 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-sidebar/50">
                    <div className="flex items-center gap-2">
                      <img src="/newlogo.png" alt="logo" className="w-8 h-8 object-contain" />
                      <h1 className="text-lg font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, var(--primary), var(--primary-gradient-end))' }}>CoC.M</h1>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-6">
                    <nav className="space-y-1.5">
                        {filteredNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPage === item.id;
                        return (
                            <button
                            key={item.id}
                            onClick={() => {
                                onNavigate(item.id);
                                setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                isActive
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            }`}
                            >
                            <Icon className={`w-5 h-5 mr-3 ${isActive ? "animate-pulse" : ""}`} />
                            <span className="font-medium text-sm">{item.label}</span>
                            </button>
                        );
                        })}
                    </nav>
                  </div>

                  <div className="p-4 border-t border-border/50 bg-sidebar/30">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {user?.name?.charAt(0)}
                        </div>
                        <div>
                            <p className="font-semibold text-sm">{user?.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                        </div>
                    </div>
                    <Button
                      onClick={logout}
                      variant="outline"
                      className="w-full justify-center"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 lg:ml-64 overflow-x-hidden content-watermark min-h-screen bg-muted/40 dark:bg-background">
            {/* Desktop Top Bar */}
            <div className="hidden lg:flex items-center justify-end px-8 py-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-accent transition-colors focus:outline-none group">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-gradient-end))' }}>
                      {user?.name?.charAt(0) || <User className="w-4 h-4" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold leading-none">{user?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">{user?.role}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <p className="font-semibold text-sm truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onNavigate("settings")} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <main className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-x-hidden max-w-[1600px] mx-auto">
              <div
                key={currentPage}
                className="page-transition min-h-[calc(100vh-4rem)]" // Ensure min height for transition
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Mobile FAB - Opens/Closes Left Nav (outside main container for proper fixed positioning) */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        id="mobile-fab-nav"
        className={`lg:hidden w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          mobileMenuOpen
            ? "bg-card text-foreground border-2"
            : "bg-primary text-primary-foreground hover:scale-110 hover:shadow-2xl"
        }`}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "16px",
          zIndex: 9999,
        }}
      >
        {mobileMenuOpen ? (
          <ArrowRight className="w-6 h-6" />
        ) : (
          <ArrowLeft className="w-6 h-6" />
        )}
      </button>
    </>
  );
}
