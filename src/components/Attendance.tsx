import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Calendar, Users, Plus, TrendingUp, Search, Clock, Edit, Trash2, X, Settings, ArrowLeft, UserCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Member } from './Members';
import { api } from '../services/api';

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
}

// Permanent service that cannot be modified
const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true
};

export function Attendance({ onRecordAttendance, onMarkAttendance }: AttendanceProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [showServiceManager, setShowServiceManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, canAccess } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [attendanceData, servicesData] = await Promise.all([
          api.attendance.getAll(),
          api.services.getAll()
        ]);
        setRecords(attendanceData || []);
        setCustomServices(servicesData || []);
      } catch (error) {
        console.error('Failed to fetch attendance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const canRecordAttendance = canAccess('record_attendance');
  const canManageServices = canAccess('manage_services');

  // Get all available service types
  const allServiceTypes = [
    SUNDAY_MAIN_SERVICE.name,
    ...customServices.filter(s => s.isActive).map(s => s.name)
  ];

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.serviceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = selectedServiceType === 'all' || record.serviceType === selectedServiceType;
    return matchesSearch && matchesService;
  });

  // Calculate stats
  const totalServices = records.length;
  const averageAttendance = totalServices > 0 ? Math.round(records.reduce((sum, record) => sum + record.totalCount, 0) / totalServices) : 0;
  const thisWeekAttendance = records.filter(record => {
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

  const handleDeleteService = (serviceId: string) => {
    if (confirm('Are you sure you want to delete this custom service? This action cannot be undone.')) {
      setCustomServices(prev => prev.filter(service => service.id !== serviceId));
    }
  };

  const handleToggleService = (serviceId: string) => {
    setCustomServices(prev => prev.map(service => 
      service.id === serviceId ? { ...service, isActive: !service.isActive } : service
    ));
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
      onAdd={(newService) => {
        const service: CustomService = {
          id: (customServices.length + 1).toString(),
          ...newService,
          isActive: true,
          createdBy: user?.name || 'Unknown',
          createdAt: new Date().toISOString().split('T')[0]
        };
        setCustomServices(prev => [...prev, service]);
      }}
    />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Attendance</h1>
          <p className="text-muted-foreground">
            Track and manage service attendance
          </p>
        </div>
        <div className="flex gap-2">
          {canManageServices && (
            <Button variant="outline" onClick={() => setShowServiceManager(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Services
            </Button>
          )}
          {canRecordAttendance && (
            <>
              <Button variant="outline" onClick={onMarkAttendance}>
                <UserCheck className="w-4 h-4 mr-2" />
                Mark Attendance
              </Button>
              <Button onClick={onRecordAttendance}>
                <Plus className="w-4 h-4 mr-2" />
                Record Attendance
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalServices}</p>
                <p className="text-sm text-muted-foreground">Total Services</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{averageAttendance}</p>
                <p className="text-sm text-muted-foreground">Average Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{thisWeekAttendance}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{record.serviceType}</h3>
                        {record.isCustomService && (
                          <Badge variant="outline" className="text-xs">Custom</Badge>
                        )}
                        {!record.isCustomService && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">Permanent</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.date)}
                        {record.startTime && record.endTime && (
                          <span className="ml-2">
                            {formatTime(record.startTime)} - {formatTime(record.endTime)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {record.totalCount}
                    </div>
                    <p className="text-xs text-muted-foreground">attendees</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Recorded members: {record.attendees.length}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {((record.attendees.length / 355) * 100).toFixed(1)}% of members
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Mobile Floating Action Button */}
      {canRecordAttendance && (
        <div className="lg:hidden fixed bottom-20 right-4">
          <Button
            onClick={onRecordAttendance}
            size="lg"
            className="rounded-full w-14 h-14 shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
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
}

function ServiceManager({ customServices, onBack, onDelete, onToggle, onAdd }: ServiceManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [] as number[]
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <form onSubmit={handleAddService} className="space-y-4 mb-6 p-4 border rounded-lg bg-muted/50">
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
                  <div className="flex-1">
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
                  <div className="flex gap-2">
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
  const [attendees, setAttendees] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersData, servicesData] = await Promise.all([
          api.members.getAll(),
          api.services.getAll()
        ]);
        setMembers(membersData || []);
        setCustomServices(servicesData || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, []);

  // Get available service types
  const availableServices = [
    SUNDAY_MAIN_SERVICE.name,
    ...customServices.filter(s => s.isActive).map(s => s.name)
  ];

  const filteredMembers = members.filter(member =>
    `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMemberToggle = (memberId: string) => {
    setAttendees(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

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
    if (!serviceType || !totalCount) return;

    setIsLoading(true);

    try {
      await api.attendance.create({
        date,
        serviceType,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        attendees,
        totalCount: parseInt(totalCount),
        isCustomService: serviceType !== SUNDAY_MAIN_SERVICE.name
      });
      onSave({
        date,
        serviceType,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        attendees,
        totalCount: parseInt(totalCount),
        isCustomService: serviceType !== SUNDAY_MAIN_SERVICE.name
      });
    } catch (error) {
      console.error('Failed to record attendance:', error);
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
          <h1>Record Attendance</h1>
          <p className="text-muted-foreground">
            Mark attendance for today's service
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
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Mark Individual Members (Optional)</Label>
                <Badge variant="outline">
                  {attendees.length} selected
                </Badge>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <div className="p-4 space-y-3">
                  {filteredMembers.map((member) => (
                    <div key={member.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={member.id}
                        checked={attendees.includes(member.id)}
                        onCheckedChange={() => handleMemberToggle(member.id)}
                      />
                      <label htmlFor={member.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {member.firstName[0]}{member.lastName[0]}
                            </span>
                          </div>
                          <span>{member.firstName} {member.lastName}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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