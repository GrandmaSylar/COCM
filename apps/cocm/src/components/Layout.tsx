import { ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Group, GroupRow, StatusNotice } from "./ui/ios";
import { cn } from "./ui/utils";
import {
  Users,
  Calendar,
  Banknote,
  BarChart3,
  Settings,
  LogOut,
  Home,
  Download,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  UserPlus,
  HelpCircle,
  ClipboardList,
  Bell,
  Church,
  Baby,
  Receipt,
  WifiOff,
  Loader2,
  AlertTriangle,
  Share,
  HandHeart,
  Map,
  MoreHorizontal,
  ChevronsUpDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { getPendingQueueCount, getConflicts, retrySyncNow } from "@cms/shared";
import { FixRetryPanel } from "./FixRetryPanel";
import { APP_VERSION } from "../utils/version";
import {
  updateSW,
  needsRefresh,
  beforeInstallPromptEvent,
  setBeforeInstallPromptEvent,
  type BeforeInstallPromptEvent,
} from "../services/pwa";

const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn(className, "animate-spin")} />;

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
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showUpdateBtn, setShowUpdateBtn] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem("pwa-banner-dismissed") === "true"
  );
  const isPermanentlyInstalled = () =>
    localStorage.getItem("pwa-installed") === "true";

  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);

  // Sync Engine State
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'conflicts' | 'fix-retry'>('idle');
  const [syncConflictCount, setSyncConflictCount] = useState(0);
  const [syncFailureReason, setSyncFailureReason] = useState('');
  const [conflictBadgeCount, setConflictBadgeCount] = useState(0);

  // ── Offline: listen for pending queue size ──
  useEffect(() => {
    const updateCount = async () => {
      try {
        const count = await getPendingQueueCount();
        setPendingCount(count);
      } catch (err) {
        console.error("Failed to get pending queue count", err);
      }
    };
    
    updateCount();

    const handleSyncUpdate = () => {
      updateCount();
    };

    window.addEventListener("online", updateCount);
    window.addEventListener("sync-queue-updated", handleSyncUpdate);
    
    return () => {
      window.removeEventListener("online", updateCount);
      window.removeEventListener("sync-queue-updated", handleSyncUpdate);
    };
  }, []);

  // ── Sync Engine Events ──
  useEffect(() => {
    const handleSyncState = (e: Event) => {
      const customEvent = e as CustomEvent<{ state: 'idle' | 'syncing' | 'conflicts' | 'fix-retry' | 'success', conflictCount?: number, failureReason?: string }>;
      const { state, conflictCount, failureReason } = customEvent.detail;

      if (state === 'syncing') {
        setSyncState('syncing');
      } else if (state === 'conflicts') {
        setSyncState('conflicts');
        if (conflictCount !== undefined) {
          setSyncConflictCount(conflictCount);
          setConflictBadgeCount(conflictCount);
        } else {
          // Fallback to fetch
          getConflicts().then(c => {
             setSyncConflictCount(c.length);
             setConflictBadgeCount(c.length);
          });
        }
      } else if (state === 'fix-retry') {
        setSyncState('fix-retry');
        setSyncFailureReason(failureReason || 'Unknown error');
      } else if (state === 'success') {
        setSyncState('idle');
        setSyncConflictCount(0);
        setConflictBadgeCount(0);
      }
    };

    const handleConflictsResolved = () => {
      setSyncState('idle');
      setConflictBadgeCount(0);
      toast.success('✓ All conflicts resolved.');
    };

    window.addEventListener('sync-state', handleSyncState);
    window.addEventListener('conflicts-resolved', handleConflictsResolved);

    // Initial load check for conflicts
    getConflicts().then(c => {
      if (c.length > 0) {
        setSyncState('conflicts');
        setSyncConflictCount(c.length);
        setConflictBadgeCount(c.length);
      }
    });

    return () => {
      window.removeEventListener('sync-state', handleSyncState);
      window.removeEventListener('conflicts-resolved', handleConflictsResolved);
    };
  }, []);

  // ── PWA: listen for beforeinstallprompt & appinstalled ──
  useEffect(() => {
    if (isPermanentlyInstalled() || sessionDismissed) return;

    if (beforeInstallPromptEvent) {
      setShowInstallBanner(true);
    }

    const handleBIP = (e: Event) => {
      e.preventDefault();
      setBeforeInstallPromptEvent(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    const handleInstalled = () => {
      localStorage.setItem("pwa-installed", "true");
      setShowInstallBanner(false);
    };

    window.addEventListener("beforeinstallprompt", handleBIP);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBIP);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [sessionDismissed]);

  // ── PWA: iOS install banner detection ──
  useEffect(() => {
    if (sessionStorage.getItem("pwa-ios-banner-dismissed") === "true") return;
    if (isPermanentlyInstalled()) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isSafari = /safari/i.test(ua);
    const isNotChrome = !/CriOS/i.test(ua);
    const isNotFirefox = !/FxiOS/i.test(ua);
    const isStandalone = (window.navigator as any).standalone === false;

    if ((isIos || isIpadOS) && isSafari && isNotChrome && isNotFirefox && isStandalone) {
      setShowIosBanner(true);
    }
  }, []);

  // ── PWA: listen for service-worker update ──
  useEffect(() => {
    const handleUpdate = () => {
      setShowUpdateBtn(true);
      toast("A new version is available", {
        duration: 10000,
        action: {
          label: "Refresh to update",
          onClick: () => updateSW?.(true),
        },
        icon: <RefreshCw className="w-4 h-4" />,
      });
    };

    if (needsRefresh) {
      handleUpdate();
    }

    window.addEventListener("sw-update-available", handleUpdate);
    return () => window.removeEventListener("sw-update-available", handleUpdate);
  }, []);

  const handleInstallClick = useCallback(async () => {
    const prompt = beforeInstallPromptEvent;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem("pwa-installed", "true");
      setShowInstallBanner(false);
    }
    setBeforeInstallPromptEvent(null);
  }, []);

  const handleDismissBanner = useCallback(() => {
    sessionStorage.setItem("pwa-banner-dismissed", "true");
    setSessionDismissed(true);
    setShowInstallBanner(false);
  }, []);

  const handleDismissIosBanner = useCallback(() => {
    sessionStorage.setItem("pwa-ios-banner-dismissed", "true");
    setShowIosBanner(false);
  }, []);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnread = async () => {
      if (!isOnline) return;
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
  }, [isOnline]);

  const navigationGroups = [
    {
      group: "Core",
      items: [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "services", label: "Services", icon: Church },
      ]
    },
    {
      group: "People",
      items: [
        { id: "members", label: "Members", icon: Users },
        { id: "visitors", label: "Visitors", icon: UserPlus },
        { id: "children", label: "Children", icon: Baby },
      ]
    },
    {
      group: "Operations",
      items: [
        { id: "attendance", label: "Attendance", icon: Calendar },
        { id: "ministry", label: "Ministry", icon: HandHeart },
        { id: "zones", label: "Zones", icon: Map },
        { id: "activity-log", label: "Activity Log", icon: ClipboardList },
      ]
    },
    {
      group: "Finances",
      items: [
        { id: "giving", label: "Giving", icon: Banknote },
        { id: "expenses", label: "Expenses", icon: Receipt },
      ]
    },
    {
      group: "System",
      items: [
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "help", label: "Help", icon: HelpCircle },
        { id: "settings", label: "Settings", icon: Settings },
      ]
    }
  ];

  const filteredNavGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Always visible tabs
      if (["dashboard", "help", "settings"].includes(item.id)) return true;
      // Tab-access-based filtering
      return hasTabAccess(item.id);
    })
  })).filter(group => group.items.length > 0);

  const allItems = filteredNavGroups.flatMap((group) => group.items);
  const labelFor = (id: string) =>
    id === "notifications"
      ? "Notifications"
      : allItems.find((item) => item.id === id)?.label ??
        id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const pageTitle = labelFor(currentPage);

  // Phone tab bar: the four most-used destinations the person can open, then More.
  const preferredTabs = ["dashboard", "members", "attendance", "giving"];
  const tabItems = [
    ...preferredTabs.map((id) => allItems.find((item) => item.id === id)).filter(Boolean),
    ...allItems.filter((item) => !preferredTabs.includes(item.id)),
  ].slice(0, 4) as typeof allItems;
  const moreGroups = filteredNavGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !tabItems.some((tab) => tab.id === item.id)) }))
    .filter((group) => group.items.length > 0);

  const initial = user?.name?.charAt(0) || "U";
  const showInstall = showInstallBanner && !isPermanentlyInstalled();

  // One status notice at a time, most urgent first.
  const notice = !isOnline ? (
    <StatusNotice tone="warning" icon={WifiOff}>
      <strong className="font-semibold">You are offline.</strong>{" "}
      {pendingCount === 0
        ? "Changes will sync when you reconnect."
        : `${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you reconnect.`}
    </StatusNotice>
  ) : syncState === "syncing" ? (
    <StatusNotice tone="info" icon={Spinner}>
      Back online. Syncing {pendingCount} pending change{pendingCount === 1 ? "" : "s"}…
    </StatusNotice>
  ) : syncState === "conflicts" ? (
    <StatusNotice tone="warning" icon={AlertTriangle} action={{ label: "Review", onClick: () => onNavigate("notifications") }}>
      Sync finished with {syncConflictCount} conflict{syncConflictCount === 1 ? "" : "s"} that need your attention.
    </StatusNotice>
  ) : syncState === "fix-retry" ? (
    <StatusNotice tone="danger" icon={AlertTriangle} action={{ label: "Retry", onClick: retrySyncNow }}>
      Sync failed: {syncFailureReason}
    </StatusNotice>
  ) : showUpdateBtn ? (
    <StatusNotice tone="success" icon={RefreshCw} action={{ label: "Update", onClick: () => updateSW?.(true) }}>
      A new version of CoC.M is ready.
    </StatusNotice>
  ) : showInstallBanner && !sessionDismissed && !isPermanentlyInstalled() ? (
    <StatusNotice icon={Download} action={{ label: "Install", onClick: handleInstallClick }} onDismiss={handleDismissBanner}>
      Install CoC.M for a faster experience that also works offline.
    </StatusNotice>
  ) : showIosBanner && !showInstallBanner ? (
    <StatusNotice icon={Share} onDismiss={handleDismissIosBanner}>
      To install, tap Share, then Add to Home Screen.
    </StatusNotice>
  ) : null;

  const themeIcons = { light: Sun, dark: Moon, system: Monitor } as const;

  const accountMenu = (
    <>
      <DropdownMenuLabel className="font-normal">
        <p className="truncate text-sm font-semibold">{user?.name}</p>
        <p className="text-xs capitalize text-muted-foreground">{user?.role}</p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onNavigate("settings")}>
        <Settings className="size-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
        {(["light", "dark", "system"] as const).map((value) => {
          const Icon = themeIcons[value];
          return (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" />
              <span className="capitalize">{value}</span>
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
      {showInstall || showUpdateBtn ? <DropdownMenuSeparator /> : null}
      {showInstall ? (
        <DropdownMenuItem onClick={handleInstallClick}>
          <Download className="size-4" />
          Install app
        </DropdownMenuItem>
      ) : null}
      {showUpdateBtn ? (
        <DropdownMenuItem onClick={() => updateSW?.(true)}>
          <RefreshCw className="size-4" />
          Update available
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={logout}>
        <LogOut className="size-4" />
        Log out
      </DropdownMenuItem>
    </>
  );

  const avatar = (size: string) => (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground", size)}>{initial}</span>
  );

  return (
    <>
      <div className="min-h-dvh w-full max-w-full overflow-x-clip bg-background">
        {/* Desktop sidebar: a translucent source list */}
        <aside
          id="sidebar-nav"
          className="no-print fixed inset-y-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl lg:flex"
        >
          <div className="flex h-14 shrink-0 items-center gap-2.5 px-5">
            <img src="/newlogo.png" alt="" className="size-7 object-contain" />
            <span className="text-[17px] font-semibold tracking-tight">CoC.M</span>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main">
            {filteredNavGroups.map((group) => (
              <div key={group.group} className="mb-2">
                <p className="px-2.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group.group}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition-colors",
                        isActive
                          ? "bg-sidebar-accent font-medium text-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground active:bg-sidebar-accent"
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-sidebar-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60 active:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  {avatar("size-8")}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-tight">{user?.name}</span>
                    <span className="block truncate text-xs capitalize text-muted-foreground">{user?.role}</span>
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                {accountMenu}
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="mt-2 px-2 text-[11px] text-muted-foreground">Version {APP_VERSION}</p>
          </div>
        </aside>

        <div className="min-h-dvh lg:pl-60">
          {/* Top bar: a translucent bar with the page title, content scrolls underneath */}
          <header className="no-print ios-material hairline-b sticky top-0 z-30 pt-safe px-safe">
            <div className="flex h-12 items-center gap-2 px-4 sm:px-6 lg:px-8">
              <img src="/newlogo.png" alt="" className="size-7 shrink-0 object-contain lg:hidden" />
              <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight">{pageTitle}</h2>

              <button
                onClick={() => onNavigate("notifications")}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent active:bg-accent",
                  currentPage === "notifications" ? "text-primary" : "text-foreground"
                )}
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {conflictBadgeCount > 0 && <span className="absolute bottom-1 left-1 size-2 rounded-full bg-warning ring-2 ring-card" />}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:hidden">
                    {avatar("size-8")}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {accountMenu}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="mx-auto max-w-[1400px] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
            {notice ? <div className="mb-4">{notice}</div> : null}
            {syncState === "fix-retry" && <FixRetryPanel reason={syncFailureReason} onRetry={retrySyncNow} />}
            <div key={currentPage} className="page-transition">
              {children}
            </div>
          </main>
        </div>

        {/* Phone tab bar: translucent, with a hairline above, clear of the home indicator */}
        <nav aria-label="Main" className="no-print ios-material hairline-t px-safe fixed inset-x-0 bottom-0 z-40 pb-safe lg:hidden">
          <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabItems.length + 1}, minmax(0, 1fr))` }}>
            {tabItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-[49px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:opacity-60",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-[22px]" />
                  <span className="max-w-full truncate px-1">{item.label}</span>
                </button>
              );
            })}
            <button
              id="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                "flex h-[49px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:opacity-60",
                mobileMenuOpen || !tabItems.some((item) => item.id === currentPage) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="size-[22px]" />
              <span>More</span>
            </button>
          </div>
        </nav>

        {/* More: the rest of the destinations, as grouped lists */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto bg-background p-0">
            <SheetHeader className="px-4 pb-2 pt-5 text-left">
              <SheetTitle className="text-[28px] font-bold leading-tight">More</SheetTitle>
              <SheetDescription className="sr-only">All sections of the app, your account and appearance.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6 pt-2">
              {moreGroups.map((group) => (
                <Group key={group.group} title={group.group}>
                  {group.items.map((item) => (
                    <GroupRow
                      key={item.id}
                      icon={item.icon}
                      iconTone={currentPage === item.id ? "primary" : "gray"}
                      title={item.label}
                      selected={currentPage === item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setMobileMenuOpen(false);
                      }}
                    />
                  ))}
                </Group>
              ))}

              <Group title="Appearance">
                <div className="p-2">
                  <Tabs value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
                    <TabsList className="w-full">
                      {(["light", "dark", "system"] as const).map((value) => {
                        const Icon = themeIcons[value];
                        return (
                          <TabsTrigger key={value} value={value} className="gap-1.5 capitalize">
                            <Icon className="size-4" />
                            {value}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </Tabs>
                </div>
              </Group>

              {showInstall || showUpdateBtn ? (
                <Group>
                  {showInstall ? (
                    <GroupRow
                      icon={Download}
                      iconTone="info"
                      title="Install app"
                      onClick={() => {
                        handleInstallClick();
                        setMobileMenuOpen(false);
                      }}
                    />
                  ) : null}
                  {showUpdateBtn ? <GroupRow icon={RefreshCw} iconTone="success" title="Update available" onClick={() => updateSW?.(true)} /> : null}
                </Group>
              ) : null}

              <Group footer={`Signed in as ${user?.name ?? ""} · ${user?.role ?? ""} · Version ${APP_VERSION}`}>
                <GroupRow icon={LogOut} iconTone="gray" title="Log out" destructive chevron={false} onClick={logout} />
              </Group>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
