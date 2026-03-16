import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Calendar, Users, Plus, TrendingUp, Search, Clock, Edit, Trash2, X, Settings, ArrowLeft, UserCheck, Lock, Unlock, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Member } from './Members';
import { api } from '../services/api';
import { toast } from 'sonner';
import { getFriendlyMessage } from '../utils/error-handler';
import { useCachedData, clearCacheByPattern } from '../hooks/useCachedData';
import { AbsenteeReview } from './AbsenteeReview';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface AttendanceRecord {
  id: string;
  date: string;
  serviceType: string;
  startTime?: string;
  endTime?: string;
  attendees: string[]; // member ids (computed from attendance_entries JOIN)
  totalCount: number;
  isCustomService?: boolean;
  customServiceId?: string;
  attendanceType?: 'individual' | 'general';
  menCount?: number;
  womenCount?: number;
  childrenCount?: number;
  visitorsCount?: number;
  // Audit fields
  createdAt?: string;
  createdBy?: string;
}

interface CustomService {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  isActive: boolean;
  // Audit fields
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AttendanceProps {
  onRecordAttendance: () => void;
  onMarkAttendance: () => void;
  onViewRecord: (id: string) => void;
}

// Permanent service that cannot be modified
const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true
};

export function Attendance({ onRecordAttendance, onMarkAttendance, onViewRecord }: AttendanceProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [selectedAttendanceType, setSelectedAttendanceType] = useState('all');
  const [showServiceManager, setShowServiceManager] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user, canAccess } = useAuth();
  const { isOnline } = useNetworkStatus();

  const { data: cachedAttendance, loading: loadingAttendance, refresh: refreshAttendance } = useCachedData<any[]>(
    'attendance-records',
    () => api.attendance.getAll(),
    { duration: 2 * 60 * 1000 }
  );
  const { data: cachedServices, loading: loadingServices, refresh: refreshServices } = useCachedData<any[]>(
    'custom-services',
    () => api.services.getAll(),
    { duration: 5 * 60 * 1000 }
  );

  const loading = loadingAttendance || loadingServices;

  useEffect(() => {
    if (cachedAttendance) setRecords(cachedAttendance);
  }, [cachedAttendance]);

  useEffect(() => {
    if (cachedServices) setCustomServices(cachedServices);
  }, [cachedServices]);

  useEffect(() => {
    const handleSync = () => {
      refreshAttendance();
      refreshServices();
    };
    window.addEventListener('sync-queue-updated', handleSync);
    return () => window.removeEventListener('sync-queue-updated', handleSync);
  }, [refreshAttendance, refreshServices]);

  const canRecordAttendance = canAccess('record_attendance');
  const canManageServices = canAccess('manage_services');
  const isDev = user?.role === 'dev';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshAttendance(), refreshServices()]);
    } finally {
      setRefreshing(false);
    }
  };

  const [, setTick] = useState(0);
  // Update every minute to refresh edit window timers
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const getEditWindowInfo = (createdAt?: string) => {
    if (!createdAt) return { canEdit: false, timeRemaining: 0, label: 'Unknown' };
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;
    const remaining = Math.max(0, twelveHours - (now - created));
    if (remaining > 0) {
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      return { canEdit: true, timeRemaining: remaining, label: `${hours}h ${minutes}m remaining` };
    }
    return { canEdit: false, timeRemaining: 0, label: 'Locked' };
  };

  // Get all available service types
  const allServiceTypes = [
    SUNDAY_MAIN_SERVICE.name,
    ...customServices.filter(s => s.isActive && s.name !== SUNDAY_MAIN_SERVICE.name).map(s => s.name)
  ];

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.serviceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = selectedServiceType === 'all' || record.serviceType === selectedServiceType;
    const matchesType = selectedAttendanceType === 'all' || record.attendanceType === selectedAttendanceType;
    return matchesSearch && matchesService && matchesType;
  });

  // Calculate stats - prefer general (head count) records for trend stats
  const generalRecords = records.filter(r => r.attendanceType === 'general');
  const statsRecords = generalRecords.length > 0 ? generalRecords : records;
  const totalServices = records.length;
  const averageAttendance = statsRecords.length > 0 ? Math.round(statsRecords.reduce((sum, record) => sum + record.totalCount, 0) / statsRecords.length) : 0;
  const thisWeekAttendance = statsRecords.filter(record => {
    const recordDate = new Date(record.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return recordDate >= weekAgo && recordDate <= now;
  }).reduce((sum, record) => sum + record.totalCount, 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!isOnline) {
      toast.warning('Reconnect to delete records.');
      return;
    }
    if (confirm('Are you sure you want to delete this custom service? This action cannot be undone.')) {
      try {
        await api.services.delete(serviceId);
        clearCacheByPattern('custom-services');
        setCustomServices(prev => prev.filter(service => service.id !== serviceId));
        toast.success('Service deleted successfully');
      } catch (error) {
        console.error('Failed to delete service:', error);
        toast.error(getFriendlyMessage(error));
      }
    }
  };

  const handleToggleService = async (serviceId: string) => {
    const service = customServices.find(s => s.id === serviceId);
    if (!service) return;

    try {
      await api.services.update(serviceId, { is_active: !service.isActive });
      clearCacheByPattern('custom-services');
      setCustomServices(prev => prev.map(s =>
        s.id === serviceId ? { ...s, isActive: !s.isActive } : s
      ));
      toast.success(`Service ${service.isActive ? 'deactivated' : 'activated'}`);
    } catch (error) {
      console.error('Failed to toggle service:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Attendance</h1>
          <p className="text-muted-foreground">Loading attendance data...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (showServiceManager && canManageServices) {
    return <ServiceManager
      customServices={customServices}
      onBack={() => setShowServiceManager(false)}
      onDelete={handleDeleteService}
      onToggle={handleToggleService}
      onAdd={async (newService) => {
        try {
          const serviceData = {
            name: newService.name,
            description: newService.description,
            start_date: newService.startDate,
            end_date: newService.endDate,
            start_time: newService.startTime,
            end_time: newService.endTime,
            days_of_week: newService.daysOfWeek,
            is_active: true
          };
          const createdService = await api.services.create(serviceData);
          clearCacheByPattern('custom-services');
          // Convert response to camelCase for local state
          const service: CustomService = {
            id: createdService.id,
            name: createdService.name,
            description: createdService.description,
            startDate: createdService.start_date || createdService.startDate,
            endDate: createdService.end_date || createdService.endDate,
            startTime: createdService.start_time || createdService.startTime,
            endTime: createdService.end_time || createdService.endTime,
            daysOfWeek: createdService.days_of_week || createdService.daysOfWeek,
            isActive: createdService.is_active ?? createdService.isActive ?? true,
            createdBy: user?.name || 'Unknown',
            createdAt: createdService.created_at || new Date().toISOString()
          };
          setCustomServices(prev => [...prev, service]);
          toast.success('Service created successfully');
        } catch (error) {
          console.error('Failed to create service:', error);
          toast.error(getFriendlyMessage(error));
        }
      }}
      onRefresh={async () => { await refreshServices(); }}
    />;
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Attendance</h1>
            {!isOnline && (
              <Badge variant="outline" className="mb-2 bg-amber-100 text-amber-800 border-amber-200">
                <WifiOff className="w-3 h-3 mr-1" />
                Cached Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Track and manage service attendance
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {canManageServices && (
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setShowServiceManager(true)}>
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Manage Services</span>
              <span className="sm:hidden">Services</span>
            </Button>
          )}
          {canRecordAttendance && (
            <>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={onMarkAttendance}>
                <UserCheck className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Mark Individual</span>
                <span className="sm:hidden">Individual</span>
              </Button>
              <Button size="sm" className="text-xs sm:text-sm" onClick={onRecordAttendance}>
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Record Head Count</span>
                <span className="sm:hidden">Head Count</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Service Info Alert */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          <strong>Sunday Main Service:</strong> Every Sunday, 8:00 AM - 1:00 PM (Permanent service)
          {customServices.filter(s => s.isActive).length > 0 && (
            <span className="block mt-1">
              <strong>Custom Services:</strong> {customServices.filter(s => s.isActive).length} active
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 stagger-children">
        <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-blue-500/50 via-blue-500/40 to-transparent border border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
            <Calendar className="w-20 h-20 text-blue-600" />
          </div>
          <div className="relative z-10">
            <div className="w-11 h-11 rounded-xl bg-blue-500/40 flex items-center justify-center mb-4 text-blue-600 group-hover:scale-110 transition-transform duration-300">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-4xl font-bold tracking-tighter text-foreground mb-1 group-hover:translate-x-1 transition-transform">{totalServices}</div>
            <div className="text-sm font-medium text-muted-foreground">Total Services</div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-500/50 via-emerald-500/40 to-transparent border border-emerald-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
            <Users className="w-20 h-20 text-emerald-600" />
          </div>
          <div className="relative z-10">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/40 flex items-center justify-center mb-4 text-emerald-600 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-4xl font-bold tracking-tighter text-foreground mb-1 group-hover:translate-x-1 transition-transform">{averageAttendance}</div>
            <div className="text-sm font-medium text-muted-foreground">Average Attendance</div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-blue-500/50 via-blue-500/40 to-transparent border border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/50 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
            <TrendingUp className="w-20 h-20 text-blue-600" />
          </div>
          <div className="relative z-10">
            <div className="w-11 h-11 rounded-xl bg-blue-500/40 flex items-center justify-center mb-4 text-blue-600 group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-4xl font-bold tracking-tighter text-foreground mb-1 group-hover:translate-x-1 transition-transform">{thisWeekAttendance}</div>
            <div className="text-sm font-medium text-muted-foreground">This Week</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by service type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {allServiceTypes.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedAttendanceType} onValueChange={setSelectedAttendanceType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="general">Head Count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Attendance Records */}
      <div className="space-y-4">
        <h2>Recent Services</h2>
        {records.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium mb-2">No Attendance Records Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start tracking attendance for your church services. Sunday Main Service is available by default.
                </p>
                {canRecordAttendance && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onMarkAttendance}>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Mark Individual Attendance
                    </Button>
                    <Button onClick={onRecordAttendance}>
                      <Plus className="w-4 h-4 mr-2" />
                      Record Group Attendance
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No attendance records found matching your filters.</p>
            </CardContent>
          </Card>
        ) : (
          filteredRecords.map((record) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 icon-bg-pink rounded-full flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base truncate">{record.serviceType}</h3>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {record.attendanceType === 'general' ? (
                          <Badge variant="outline" className="text-[10px] sm:text-xs badge-info">Head Count</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] sm:text-xs badge-warning">Individual</Badge>
                        )}
                        {record.isCustomService && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs">Custom</Badge>
                        )}
                        {!record.isCustomService && (
                          <Badge variant="default" className="text-[10px] sm:text-xs badge-success border-none">Permanent</Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {formatDate(record.date)}
                        {record.startTime && record.endTime && (
                          <span className="ml-1 sm:ml-2">
                            {formatTime(record.startTime)} - {formatTime(record.endTime)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right flex sm:block items-center gap-2 ml-13 sm:ml-0">
                    <div className="text-xl sm:text-2xl font-bold text-primary">
                      {record.totalCount}
                    </div>
                    <p className="text-xs text-muted-foreground">attendees</p>
                  </div>
                </div>
                
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {record.attendanceType === 'individual'
                        ? `Recorded members: ${record.attendees.length}`
                        : 'Head count record'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const editInfo = getEditWindowInfo(record.createdAt);
                        return (
                          <>
                            {(editInfo.canEdit || isDev) ? (
                              <Badge variant="outline" className="text-[10px] sm:text-xs badge-success">
                                <Unlock className="w-3 h-3 mr-1" />
                                {isDev && !editInfo.canEdit ? 'Dev' : editInfo.label}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] sm:text-xs badge-muted">
                                <Lock className="w-3 h-3 mr-1" />
                                {editInfo.label}
                              </Badge>
                            )}
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onViewRecord(record.id)}>
                              {(editInfo.canEdit || isDev) && canRecordAttendance ? (
                                <><Edit className="w-3 h-3 mr-1" /> Edit</>
                              ) : (
                                <>View</>
                              )}
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  );
}

// Service Manager Component
interface ServiceManagerProps {
  customServices: CustomService[];
  onBack: () => void;
  onDelete: (serviceId: string) => void;
  onToggle: (serviceId: string) => void;
  onAdd: (service: Omit<CustomService, 'id' | 'isActive' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onRefresh: () => Promise<void>;
}

function ServiceManager({ customServices, onBack, onDelete, onToggle, onAdd, onRefresh }: ServiceManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [] as number[]
  });
  const { isOnline } = useNetworkStatus();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.startDate || !formData.endDate || 
        !formData.startTime || !formData.endTime || formData.daysOfWeek.length === 0) return;

    onAdd({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      startDate: formData.startDate,
      endDate: formData.endDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      daysOfWeek: formData.daysOfWeek
    });

    setFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      daysOfWeek: []
    });
    setShowAddForm(false);
  };

  const handleDayToggle = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(dayIndex)
        ? prev.daysOfWeek.filter(d => d !== dayIndex)
        : [...prev.daysOfWeek, dayIndex].sort()
    }));
  };

  const isFormValid = formData.name.trim() && formData.startDate && formData.endDate &&
                     formData.startTime && formData.endTime && formData.daysOfWeek.length > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1>Manage Service Types</h1>
            <p className="text-muted-foreground">
              Add, edit, or remove custom service types
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Permanent Service Info */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          <strong>Sunday Main Service</strong> is a permanent service that runs every Sunday from 8:00 AM to 1:00 PM. 
          This service cannot be modified or removed.
        </AlertDescription>
      </Alert>

      {/* Add New Service */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Services</CardTitle>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {showAddForm ? 'Cancel' : 'Add Service'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form onSubmit={handleAddService} className="space-y-4 mb-6 p-4 border rounded-lg box-muted">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serviceName">Service Name *</Label>
                  <Input
                    id="serviceName"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Easter Revival, Youth Conference"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceDescription">Description</Label>
                  <Input
                    id="serviceDescription"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    min={formData.startDate}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Days of Week *</Label>
                <div className="grid grid-cols-7 gap-2">
                  {dayNames.map((day, index) => (
                    <label key={index} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={formData.daysOfWeek.includes(index)}
                        onCheckedChange={() => handleDayToggle(index)}
                      />
                      <span className="text-sm">{day.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={!isFormValid}>
                Add Custom Service
              </Button>
            </form>
          )}

          <div className="space-y-4">
            {customServices.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No custom services have been created yet. Add your first custom service above.
                </AlertDescription>
              </Alert>
            ) : (
              customServices.map((service) => (
                <div key={service.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{service.name}</h3>
                      <Badge variant={service.isActive ? 'default' : 'secondary'}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
                    )}
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <strong>Period:</strong> {new Date(service.startDate).toLocaleDateString()} - {new Date(service.endDate).toLocaleDateString()}
                      </p>
                      <p>
                        <strong>Time:</strong> {service.startTime} - {service.endTime}
                      </p>
                      <p>
                        <strong>Days:</strong> {service.daysOfWeek.map(d => dayNames[d]).join(', ')}
                      </p>
                      {service.createdBy && service.createdAt && (
                        <p className="text-xs">
                          Created by {service.createdBy} on {new Date(service.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggle(service.id)}
                    >
                      {service.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(service.id)}
                      className="text-destructive hover:text-destructive"
                      disabled={!isOnline}
                      title={!isOnline ? 'Reconnect to delete records.' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Record Attendance Component
interface RecordAttendanceProps {
  onBack: () => void;
  onSave: (record: Omit<AttendanceRecord, 'id'>) => void;
}

export function RecordAttendance({ onBack, onSave }: RecordAttendanceProps) {
  const [serviceType, setServiceType] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [totalCount, setTotalCount] = useState('');
  const [menCount, setMenCount] = useState('');
  const [womenCount, setWomenCount] = useState('');
  const [childrenCount, setChildrenCount] = useState('');
  const [visitorsCount, setVisitorsCount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { data: cachedSvc } = useCachedData<CustomService[]>(
    'custom-services',
    () => api.services.getAll(),
    { duration: 5 * 60 * 1000 }
  );
  const [customServices, setCustomServices] = useState<CustomService[]>([]);

  useEffect(() => {
    if (cachedSvc) setCustomServices(cachedSvc);
  }, [cachedSvc]);

  // Get available service types
  const availableServices = [
    SUNDAY_MAIN_SERVICE.name,
    ...customServices.filter(s => s.isActive && s.name !== SUNDAY_MAIN_SERVICE.name).map(s => s.name)
  ];

  const handleServiceTypeChange = (value: string) => {
    setServiceType(value);

    // Auto-fill times for Sunday Main Service
    if (value === SUNDAY_MAIN_SERVICE.name) {
      setStartTime(SUNDAY_MAIN_SERVICE.startTime);
      setEndTime(SUNDAY_MAIN_SERVICE.endTime);
    } else {
      // Try to find custom service and auto-fill times
      const customService = customServices.find(s => s.name === value);
      if (customService) {
        setStartTime(customService.startTime);
        setEndTime(customService.endTime);
      } else {
        setStartTime('');
        setEndTime('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceType || !totalCount) {
      toast.error('Please select a service type and enter the total attendance count.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.attendance.create({
        date,
        serviceType,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        attendees: [],
        totalCount: parseInt(totalCount),
        menCount: parseInt(menCount) || 0,
        womenCount: parseInt(womenCount) || 0,
        childrenCount: parseInt(childrenCount) || 0,
        visitorsCount: parseInt(visitorsCount) || 0,
        isCustomService: serviceType !== SUNDAY_MAIN_SERVICE.name,
        attendanceType: 'general'
      });

      console.log('Head count recorded successfully:', result);
      toast.success(`Head count recorded! Total: ${totalCount} attendees.`);

      onSave({
        date,
        serviceType,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        attendees: [],
        totalCount: parseInt(totalCount),
        menCount: parseInt(menCount) || 0,
        womenCount: parseInt(womenCount) || 0,
        childrenCount: parseInt(childrenCount) || 0,
        visitorsCount: parseInt(visitorsCount) || 0,
        isCustomService: serviceType !== SUNDAY_MAIN_SERVICE.name
      });
    } catch (error: any) {
      console.error('Failed to record head count:', error);
      toast.error(error?.message || 'Failed to record head count. Please try again.');
      setIsLoading(false);
    }
  };

  const isValid = serviceType && totalCount && parseInt(totalCount) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Record General Attendance</h1>
          <p className="text-muted-foreground">
            Record head count for today's service
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type *</Label>
                <Select value={serviceType} onValueChange={handleServiceTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                        {type === SUNDAY_MAIN_SERVICE.name && (
                          <span className="text-xs text-muted-foreground ml-2">(Permanent)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={serviceType === SUNDAY_MAIN_SERVICE.name}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={serviceType === SUNDAY_MAIN_SERVICE.name}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menCount">Men</Label>
                <Input
                  id="menCount"
                  type="number"
                  value={menCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMenCount(val);
                    const total = (parseInt(val) || 0) + (parseInt(womenCount) || 0) + (parseInt(childrenCount) || 0) + (parseInt(visitorsCount) || 0);
                    setTotalCount(String(total));
                  }}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="womenCount">Women</Label>
                <Input
                  id="womenCount"
                  type="number"
                  value={womenCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWomenCount(val);
                    const total = (parseInt(menCount) || 0) + (parseInt(val) || 0) + (parseInt(childrenCount) || 0) + (parseInt(visitorsCount) || 0);
                    setTotalCount(String(total));
                  }}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="childrenCount">Children</Label>
                <Input
                  id="childrenCount"
                  type="number"
                  value={childrenCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setChildrenCount(val);
                    const total = (parseInt(menCount) || 0) + (parseInt(womenCount) || 0) + (parseInt(val) || 0) + (parseInt(visitorsCount) || 0);
                    setTotalCount(String(total));
                  }}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitorsCount">Visitors</Label>
                <Input
                  id="visitorsCount"
                  type="number"
                  value={visitorsCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setVisitorsCount(val);
                    const total = (parseInt(menCount) || 0) + (parseInt(womenCount) || 0) + (parseInt(childrenCount) || 0) + (parseInt(val) || 0);
                    setTotalCount(String(total));
                  }}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalCount">Total Attendance Count *</Label>
              <Input
                id="totalCount"
                type="number"
                value={totalCount}
                onChange={(e) => setTotalCount(e.target.value)}
                placeholder="Enter total number of attendees"
                min="1"
                required
                className="bg-muted font-bold"
              />
            </div>

            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                This records the total head count only. To mark individual member attendance, use <strong>Mark Individual Attendance</strong> instead.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button type="submit" disabled={!isValid || isLoading}>
                {isLoading ? 'Saving...' : 'Save Attendance'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Attendance Detail / Edit Component
interface AttendanceDetailProps {
  recordId: string;
  onBack: () => void;
  onSaved: () => void;
}

export function AttendanceDetail({ recordId, onBack, onSaved }: AttendanceDetailProps) {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTotalCount, setEditTotalCount] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [editAttendees, setEditAttendees] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMenCount, setEditMenCount] = useState('');
  const [editWomenCount, setEditWomenCount] = useState('');
  const [editChildrenCount, setEditChildrenCount] = useState('');
  const [editVisitorsCount, setEditVisitorsCount] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [showAbsenteeReview, setShowAbsenteeReview] = useState(false);
  const { user, canAccess } = useAuth();

  const isDev = user?.role === 'dev';
  const canRecordAttendance = canAccess('record_attendance');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recordData, editStatus] = await Promise.all([
          api.attendance.getById(recordId),
          api.attendance.getEditStatus(recordId)
        ]);
         setRecord(recordData);
        setEditTotalCount(String(recordData.totalCount || 0));
        setEditMenCount(String(recordData.menCount || 0));
        setEditWomenCount(String(recordData.womenCount || 0));
        setEditChildrenCount(String(recordData.childrenCount || 0));
        setEditVisitorsCount(String(recordData.visitorsCount || 0));
        setEditAttendees(recordData.attendees || []);
        setCanEdit((editStatus.canEdit || editStatus.isDev) && canRecordAttendance);

        if (recordData.attendanceType === 'individual') {
          const membersData = await api.members.getAll();
          const activeMembers = membersData?.filter((m: Member) => m.status !== 'blacklisted' && m.status !== 'not baptised') || [];
          setMembers(activeMembers);
        }
      } catch (error) {
        console.error('Failed to fetch attendance record:', error);
        toast.error('Failed to load attendance record.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [recordId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const handleMemberToggle = (memberId: string) => {
    setEditAttendees(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSave = async () => {
    if (!record) return;
    setIsSaving(true);
    try {
      if (record.attendanceType === 'general') {
        await api.attendance.update(recordId, {
          date: record.date,
          serviceType: record.serviceType,
          startTime: record.startTime,
          endTime: record.endTime,
          totalCount: parseInt(editTotalCount),
          menCount: parseInt(editMenCount) || 0,
          womenCount: parseInt(editWomenCount) || 0,
          childrenCount: parseInt(editChildrenCount) || 0,
          visitorsCount: parseInt(editVisitorsCount) || 0,
          isCustomService: record.isCustomService
        });
      } else {
        await api.attendance.update(recordId, {
          date: record.date,
          serviceType: record.serviceType,
          startTime: record.startTime,
          endTime: record.endTime,
          attendees: editAttendees,
          totalCount: editAttendees.length,
          isCustomService: record.isCustomService
        });
      }
      toast.success('Attendance record updated successfully!');
      onSaved();
    } catch (error: any) {
      console.error('Failed to update attendance:', error);
      toast.error(error?.message || 'Failed to update attendance record.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = members.filter(member =>
    `${member.firstName} ${member.lastName} ${member.otherNames || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const presentMembers = members.filter(m => editAttendees.includes(m.id));
  const absentMembers = members.filter(m => !editAttendees.includes(m.id));

  if (showAbsenteeReview && record) {
    return (
      <AbsenteeReview
        attendanceRecordId={recordId}
        absentMemberIds={absentMembers.map(m => m.id)}
        allMembers={members}
        serviceDate={record.date}
        onComplete={() => setShowAbsenteeReview(false)}
        onSkip={() => setShowAbsenteeReview(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1>Attendance Record</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1>Attendance Record</h1>
            <p className="text-muted-foreground">Record not found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1>{record.serviceType}</h1>
              {record.attendanceType === 'general' ? (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">Head Count</Badge>
              ) : (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">Individual</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {formatDate(record.date)}
              {record.startTime && record.endTime && (
                <span className="ml-2">{formatTime(record.startTime)} - {formatTime(record.endTime)}</span>
              )}
            </p>
          </div>
        </div>
        {canEdit && !isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {/* General (Head Count) View/Edit */}
      {record.attendanceType === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle>Head Count</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editMenCount">Men</Label>
                    <Input
                      id="editMenCount"
                      type="number"
                      value={editMenCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditMenCount(val);
                        const total = (parseInt(val) || 0) + (parseInt(editWomenCount) || 0) + (parseInt(editChildrenCount) || 0) + (parseInt(editVisitorsCount) || 0);
                        setEditTotalCount(String(total));
                      }}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editWomenCount">Women</Label>
                    <Input
                      id="editWomenCount"
                      type="number"
                      value={editWomenCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditWomenCount(val);
                        const total = (parseInt(editMenCount) || 0) + (parseInt(val) || 0) + (parseInt(editChildrenCount) || 0) + (parseInt(editVisitorsCount) || 0);
                        setEditTotalCount(String(total));
                      }}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editChildrenCount">Children</Label>
                    <Input
                      id="editChildrenCount"
                      type="number"
                      value={editChildrenCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditChildrenCount(val);
                        const total = (parseInt(editMenCount) || 0) + (parseInt(editWomenCount) || 0) + (parseInt(val) || 0) + (parseInt(editVisitorsCount) || 0);
                        setEditTotalCount(String(total));
                      }}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editVisitorsCount">Visitors</Label>
                    <Input
                      id="editVisitorsCount"
                      type="number"
                      value={editVisitorsCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditVisitorsCount(val);
                        const total = (parseInt(editMenCount) || 0) + (parseInt(editWomenCount) || 0) + (parseInt(editChildrenCount) || 0) + (parseInt(val) || 0);
                        setEditTotalCount(String(total));
                      }}
                      min="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editTotalCount">Total Attendance Count</Label>
                  <Input
                    id="editTotalCount"
                    type="number"
                    value={editTotalCount}
                    onChange={(e) => setEditTotalCount(e.target.value)}
                    min="1"
                    className="bg-muted font-bold"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setEditTotalCount(String(record.totalCount || 0));
                    setEditMenCount(String(record.menCount || 0));
                    setEditWomenCount(String(record.womenCount || 0));
                    setEditChildrenCount(String(record.childrenCount || 0));
                    setEditVisitorsCount(String(record.visitorsCount || 0));
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center py-2">
                  <div className="text-4xl font-bold text-primary">{record.totalCount}</div>
                  <p className="text-muted-foreground mt-1">total people attended</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-6">
                  <div className="text-center p-3 rounded-lg bg-blue-50/50">
                    <div className="text-xl font-semibold text-blue-700">{record.menCount || 0}</div>
                    <p className="text-xs text-blue-600/70 font-medium uppercase tracking-wider">Men</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-pink-50/50">
                    <div className="text-xl font-semibold text-pink-700">{record.womenCount || 0}</div>
                    <p className="text-xs text-pink-600/70 font-medium uppercase tracking-wider">Women</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-purple-50/50">
                    <div className="text-xl font-semibold text-purple-700">{record.childrenCount || 0}</div>
                    <p className="text-xs text-purple-600/70 font-medium uppercase tracking-wider">Children</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-orange-50/50">
                    <div className="text-xl font-semibold text-orange-700">{record.visitorsCount || 0}</div>
                    <p className="text-xs text-orange-600/70 font-medium uppercase tracking-wider">Visitors</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual View/Edit */}
      {record.attendanceType === 'individual' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {isEditing ? editAttendees.length : record.attendees.length}
                </div>
                <p className="text-sm text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {members.length - (isEditing ? editAttendees.length : record.attendees.length)}
                </div>
                <p className="text-sm text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{members.length}</div>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </CardContent>
            </Card>
          </div>

          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit Member Attendance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
                  {filteredMembers.map((member) => {
                    const isPresent = editAttendees.includes(member.id);
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPresent ? 'bg-green-100' : 'bg-red-100'}`}>
                            <span className={`text-xs font-medium ${isPresent ? 'text-green-700' : 'text-red-700'}`}>
                              {member.firstName[0]}{member.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">{member.firstName} {member.lastName}</span>
                            <span className="text-xs text-muted-foreground ml-2">{member.zoneNumber}</span>
                          </div>
                        </div>
                        <Checkbox
                          checked={isPresent}
                          onCheckedChange={() => handleMemberToggle(member.id)}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setEditAttendees(record.attendees || []);
                  }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Present Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-green-600" />
                    Present ({presentMembers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {presentMembers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No members marked present.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y">
                      {presentMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-green-700">
                              {member.firstName[0]}{member.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">{member.firstName} {member.lastName}</span>
                            <span className="text-xs text-muted-foreground ml-2">{member.zoneNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Absent Members */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <X className="w-5 h-5 text-red-600" />
                      Absent ({absentMembers.length})
                    </CardTitle>
                    {canEdit && absentMembers.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setShowAbsenteeReview(true)}>
                        Review Absentees
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {absentMembers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No members absent.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y">
                      {absentMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-red-700">
                              {member.firstName[0]}{member.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">{member.firstName} {member.lastName}</span>
                            <span className="text-xs text-muted-foreground ml-2">{member.zoneNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}