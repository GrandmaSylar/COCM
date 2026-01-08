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
  HelpCircle
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, logout, canAccess } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'visitors', label: 'Visitors', icon: UserPlus },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'giving', label: 'Giving', icon: DollarSign },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'help', label: 'Help', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredNavItems = navigationItems.filter(item => {
    // Help is always visible
    if (item.id === 'help') return true;
    
    // Permission-based filtering
    switch (item.id) {
      case 'dashboard':
        return true; // Everyone can see dashboard
      case 'members':
        return canAccess('view_members');
      case 'visitors':
        return canAccess('view_members'); // Same permissions as members
      case 'attendance':
        return canAccess('view_attendance');
      case 'giving':
        return canAccess('view_giving');
      case 'reports':
        return canAccess('view_reports');
      case 'settings':
        return canAccess('manage_settings') || canAccess('manage_users');
      default:
        return true;
    }
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden bg-card border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-medium">CoC.M</h1>
        <div className="flex items-center gap-2">
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
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50">
            <div className="fixed inset-y-0 left-0 w-64 bg-card shadow-xl">
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
          <main className="p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="flex">
          {filteredNavItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex-1 flex flex-col items-center py-2 px-1 ${
                  currentPage === item.id
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}