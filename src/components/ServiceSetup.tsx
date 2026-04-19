import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Save, Search, X, Download, Eye } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { useCachedData } from '../hooks/useCachedData';
import { OfflineOverlay } from './OfflineOverlay';
import { generateServiceSetupPDF } from '../utils/export';

// Reusable Member Combobox
function MemberCombobox({ label, value, onChange, members, hideLabel = false }: { label: string, value: string, onChange: (id: string, name: string) => void, members: any[], hideLabel?: boolean }) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMembers = members.filter(m => 
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  return (
    <div className="space-y-1 relative" ref={wrapperRef}>
      {!hideLabel && <Label>{label}</Label>}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <Input
          placeholder={hideLabel ? "Search member..." : `Search member for ${label.toLowerCase()}...`}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
            onChange('', e.target.value);
          }}
          onFocus={() => setShowDropdown(true)}
          className="pl-9 pr-8 text-sm"
        />
        {searchTerm && (
          <button 
            type="button"
            className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchTerm(''); onChange('', ''); setShowDropdown(false); }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && searchTerm && filteredMembers.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-popover text-popover-foreground border rounded-md shadow-md animate-in fade-in-80 zoom-in-95">
          {filteredMembers.map(m => {
            const fullName = `${m.firstName} ${m.lastName}`;
            return (
              <li
                key={m.id}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setSearchTerm(fullName);
                  onChange(m.id, fullName);
                  setShowDropdown(false);
                }}
              >
                {fullName}
              </li>
            );
          })}
        </ul>
      )}
      {showDropdown && searchTerm && filteredMembers.length === 0 && (
        <div className="absolute z-50 w-full mt-1 p-3 text-sm text-muted-foreground text-center bg-popover border rounded-md shadow-md animate-in fade-in-80">
          No members found.
        </div>
      )}
    </div>
  );
}

const DEFAULT_PROGRAMME = [
  { activity: 'Divisional Bible Class', startTime: '08:30', endTime: '09:25', duration: '1 hr', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Opening Prayer', startTime: '09:30', endTime: '09:35', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Worship and Praises', startTime: '09:35', endTime: '10:05', duration: '30 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Scripture Reading', startTime: '10:05', endTime: '10:10', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Sermon', startTime: '10:10', endTime: '10:55', duration: '45 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'After-Sermon Prayer', startTime: '10:55', endTime: '11:00', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: "Lord's Supper & Giving Assistants", startTime: '11:00', endTime: '11:15', duration: '20 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Worship Closing Prayer', startTime: '11:15', endTime: '11:20', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Announcements', startTime: '11:20', endTime: '11:30', duration: '10 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Benediction', startTime: '11:30', endTime: '', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
];

interface ServiceSetupProps {
  onBack: () => void;
  onSaved: () => void;
  initialSetup?: any;
}

export function ServiceSetup({ onBack, onSaved, initialSetup }: ServiceSetupProps) {
  const { data: membersData } = useCachedData('members-list', () => api.members.getAll());
  const { data: servicesData } = useCachedData('custom-services', () => api.services.getAll());
  
  const members = membersData || [];
  const activeServices = servicesData?.filter((s: any) => s.isActive && s.name !== 'Sunday Main Service') || [];

  const [formData, setFormData] = useState({
    serviceDate: new Date().toISOString().split('T')[0],
    time: '',
    serviceType: 'Sunday Main Service',
    mcMemberId: '',
    mcName: '',
    sermonTopic: '',
    scriptureEnglish: '',
    scriptureTwi: '',
    preacherMemberId: '',
    preacherName: '',
  });

  const [programme, setProgramme] = useState(DEFAULT_PROGRAMME.map(row => ({ ...row })));
  
  const [officiators, setOfficiators] = useState([
    { slot: 1, memberId: '', memberName: '' },
    { slot: 2, memberId: '', memberName: '' },
    { slot: 3, memberId: '', memberName: '' },
    { slot: 4, memberId: '', memberName: '' },
    { slot: 5, memberId: '', memberName: '' },
    { slot: 6, memberId: '', memberName: '' },
  ]);

  const [existingSetupId, setExistingSetupId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // Mark dirty if inputs change
  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleProgrammeChange = (index: number, key: string, value: string) => {
    setProgramme(prev => {
      const nw = [...prev];
      nw[index] = { ...nw[index], [key]: value };
      return nw;
    });
    setIsDirty(true);
  };

  const handleOfficiatorChange = (index: number, id: string, name: string) => {
    setOfficiators(prev => {
      const nw = [...prev];
      nw[index] = { ...nw[index], memberId: id, memberName: name };
      return nw;
    });
    setIsDirty(true);
  };

  // Populate from initialSetup
  useEffect(() => {
    if (initialSetup) {
      setExistingSetupId(initialSetup.id);
      setFormData({
        serviceDate: initialSetup.serviceDate || new Date().toISOString().split('T')[0],
        time: initialSetup.time || '',
        serviceType: initialSetup.serviceType || 'Sunday Main Service',
        mcMemberId: initialSetup.mcMemberId || '',
        mcName: initialSetup.mcName || '',
        sermonTopic: initialSetup.sermonTopic || '',
        scriptureEnglish: initialSetup.scriptureEnglish || '',
        scriptureTwi: initialSetup.scriptureTwi || '',
        preacherMemberId: initialSetup.preacherMemberId || '',
        preacherName: initialSetup.preacherName || '',
      });
      if (initialSetup.programme && initialSetup.programme.length > 0) {
        setProgramme(initialSetup.programme);
      }
      if (initialSetup.officiators && initialSetup.officiators.length > 0) {
        // Pad out to 6 slots
        const occ = Array.from({ length: 6 }, (_, i) => {
          const found = initialSetup.officiators.find((o: any) => o.slot === i + 1);
          return found || { slot: i + 1, memberId: '', memberName: '' };
        });
        setOfficiators(occ);
      }
      setIsDirty(false);
    }
  }, [initialSetup]);

  // Load existing setup when date/type changes (only if not currently editing initialSetup)
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (initialSetup) return; 
    }
    
    // Auto fetch only if not loaded from `initialSetup` directly, but let's always fetch to ensure freshness.
    const loadByDate = async () => {
      if (!formData.serviceDate || !formData.serviceType) return;
      try {
        const sr = await api.serviceSetups.getByDate(formData.serviceDate, formData.serviceType);
        if (sr && sr.id) {
          setExistingSetupId(sr.id);
          setFormData(prev => ({
            ...prev,
            time: sr.time || '',
            mcMemberId: sr.mcMemberId || '',
            mcName: sr.mcName || '',
            sermonTopic: sr.sermonTopic || '',
            scriptureEnglish: sr.scriptureEnglish || '',
            scriptureTwi: sr.scriptureTwi || '',
            preacherMemberId: sr.preacherMemberId || '',
            preacherName: sr.preacherName || '',
          }));
          if (sr.programme && sr.programme.length > 0) setProgramme(sr.programme);
          if (sr.officiators && sr.officiators.length > 0) {
            const occ = Array.from({ length: 6 }, (_, i) => {
              const found = sr.officiators.find((o: any) => o.slot === i + 1);
              return found ? { slot: found.slot, memberId: found.memberId, memberName: found.memberName } : { slot: i + 1, memberId: '', memberName: '' };
            });
            setOfficiators(occ);
          }
          setIsDirty(false);
        }
      } catch (err: any) {
        if (err.status === 404) {
          // Reset fields but keep date and type
          setExistingSetupId(null);
          setFormData(prev => ({
            ...prev,
            time: '',
            mcMemberId: '',
            mcName: '',
            sermonTopic: '',
            scriptureEnglish: '',
            scriptureTwi: '',
            preacherMemberId: '',
            preacherName: '',
          }));
          setProgramme(DEFAULT_PROGRAMME.map(row => ({ ...row })));
          setOfficiators([
            { slot: 1, memberId: '', memberName: '' },
            { slot: 2, memberId: '', memberName: '' },
            { slot: 3, memberId: '', memberName: '' },
            { slot: 4, memberId: '', memberName: '' },
            { slot: 5, memberId: '', memberName: '' },
            { slot: 6, memberId: '', memberName: '' },
          ]);
        }
      }
    };
    
    // Only run if not triggered immediately by initialSetup load
    const tid = setTimeout(() => {
      loadByDate();
    }, 500);
    
    return () => clearTimeout(tid);
  }, [formData.serviceDate, formData.serviceType]);

  const handleBack = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to go back?')) {
        onBack();
      }
    } else {
      onBack();
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    
    const sanitizeId = (id: string | null | undefined) => (!id || id === '') ? null : id;
    
    const payload = {
      ...formData,
      mcMemberId: sanitizeId(formData.mcMemberId),
      preacherMemberId: sanitizeId(formData.preacherMemberId),
      programme: programme.map(p => ({
        ...p,
        assignedMemberId: sanitizeId(p.assignedMemberId)
      })),
      officiators: officiators
        .filter(o => o.memberName)
        .map(o => ({
          ...o,
          memberId: sanitizeId(o.memberId)
        }))
    };

    try {
      if (existingSetupId) {
        await api.serviceSetups.update(existingSetupId, payload);
        toast.success('Service Setup updated successfully');
        setIsDirty(false);
        onSaved();
      } else {
        await api.serviceSetups.create(payload);
        toast.success('Service Setup created successfully');
        setIsDirty(false);
        onSaved();
      }
    } catch (err: any) {
      if (err.status === 409) {
        setShowOverwriteDialog(true);
      } else {
        toast.error('Failed to save service setup');
        console.error(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmOverwrite = async () => {
    setShowOverwriteDialog(false);
    setIsSubmitting(true);
    
    const sanitizeId = (id: string | null | undefined) => (!id || id === '') ? null : id;
    
    const payload = {
      ...formData,
      mcMemberId: sanitizeId(formData.mcMemberId),
      preacherMemberId: sanitizeId(formData.preacherMemberId),
      programme: programme.map(p => ({
        ...p,
        assignedMemberId: sanitizeId(p.assignedMemberId)
      })),
      officiators: officiators
        .filter(o => o.memberName)
        .map(o => ({
          ...o,
          memberId: sanitizeId(o.memberId)
        }))
    };
    try {
      // If we got 409, it means the setup exists, but existingSetupId might not be populated in Edge Cases. 
      // Re-fetch to get ID, or update. The backend has GET by date.
      const sr = await api.serviceSetups.getByDate(formData.serviceDate, formData.serviceType);
      await api.serviceSetups.update(sr.id, payload);
      toast.success('Service Setup overwritten successfully');
      setIsDirty(false);
      onSaved();
    } catch (err) {
      toast.error('Failed to overwrite setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      await generateServiceSetupPDF(formData, programme, officiators, 'download');
    } catch (err) {
      toast.error('Failed to generate PDF');
      console.error('PDF Generation Error:', err);
    }
  };

  const handlePreviewPDF = async () => {
    try {
      const blobUrl = await generateServiceSetupPDF(formData, programme, officiators, 'preview');
      if (typeof blobUrl === 'string') {
        setPreviewPdfUrl(blobUrl);
      }
    } catch (err) {
      toast.error('Failed to preview PDF');
      console.error('PDF Preview Error:', err);
    }
  };

  return (
    <OfflineOverlay>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Service Setup</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePreviewPDF} className="gap-2">
              <Eye className="w-4 h-4" /> Preview
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting || !isDirty} className="gap-2">
              <Save className="w-4 h-4" /> Save Setup
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Setup Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="serviceDate">Service Date <span className="text-destructive">*</span></Label>
                <Input 
                  id="serviceDate" 
                  type="date"
                  value={formData.serviceDate}
                  onChange={(e) => handleChange('serviceDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input 
                  id="time" 
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleChange('time', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type <span className="text-destructive">*</span></Label>
                <Select 
                  value={formData.serviceType}
                  onValueChange={(val) => handleChange('serviceType', val)}
                >
                  <SelectTrigger id="serviceType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sunday Main Service">Sunday Main Service</SelectItem>
                    {activeServices.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <MemberCombobox 
                  label="Master of Ceremonies (MC)"
                  value={formData.mcName}
                  members={members}
                  onChange={(id, name) => {
                    handleChange('mcMemberId', id);
                    handleChange('mcName', name);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sermonTopic">Sermon Topic</Label>
                <Input 
                  id="sermonTopic" 
                  value={formData.sermonTopic}
                  onChange={(e) => handleChange('sermonTopic', e.target.value)}
                  placeholder="Topic of the sermon..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scriptureEnglish">Scripture (English)</Label>
                <Input 
                  id="scriptureEnglish" 
                  value={formData.scriptureEnglish}
                  onChange={(e) => handleChange('scriptureEnglish', e.target.value)}
                  placeholder="e.g. John 3:16"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scriptureTwi">Scripture (Twi)</Label>
                <Input 
                  id="scriptureTwi" 
                  value={formData.scriptureTwi}
                  onChange={(e) => handleChange('scriptureTwi', e.target.value)}
                  placeholder="e.g. Yohane 3:16"
                />
              </div>

              <div className="space-y-2 md:col-span-2 max-w-xl">
                <MemberCombobox 
                  label="Preacher"
                  value={formData.preacherName}
                  members={members}
                  onChange={(id, name) => {
                    handleChange('preacherMemberId', id);
                    handleChange('preacherName', name);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Programme Table */}
        <Card>
          <CardHeader>
            <CardTitle>Order of Service (Programme)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                  <th className="px-4 py-3 font-semibold">Activity</th>
                  <th className="px-4 py-3 font-semibold w-24">Start</th>
                  <th className="px-4 py-3 font-semibold w-24">End</th>
                  <th className="px-4 py-3 font-semibold w-28">Duration</th>
                  <th className="px-4 py-3 font-semibold w-64 min-w-[200px]">Assigned Person</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {programme.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-4 py-3 text-center text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">{row.activity}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        value={row.startTime}
                        onChange={(e) => handleProgrammeChange(idx, 'startTime', e.target.value)}
                        className="h-8 px-2 text-xs w-full"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        value={row.endTime}
                        onChange={(e) => handleProgrammeChange(idx, 'endTime', e.target.value)}
                        className="h-8 px-2 text-xs w-full"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="text"
                        value={row.duration}
                        onChange={(e) => handleProgrammeChange(idx, 'duration', e.target.value)}
                        className="h-8 px-2 text-xs w-full"
                        placeholder="e.g. 5 min"
                      />
                    </td>
                    <td className="px-4 py-2 relative">
                      <MemberCombobox 
                        label=""
                        hideLabel={true}
                        value={row.assignedMemberName}
                        members={members}
                        onChange={(id, name) => {
                          handleProgrammeChange(idx, 'assignedMemberId', id);
                          handleProgrammeChange(idx, 'assignedMemberName', name);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Officiators Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Officiators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {officiators.map((off, idx) => (
                <div key={idx}>
                  <MemberCombobox 
                    label={`Slot ${off.slot}`}
                    value={off.memberName}
                    members={members}
                    onChange={(id, name) => handleOfficiatorChange(idx, id, name)}
                  />
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t text-center">
              <p className="text-muted-foreground text-sm italic py-2">
                 Acts 2:38 — Repent and be baptized
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showOverwriteDialog && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-xl border shadow-lg overflow-hidden animate-in zoom-in-95 fade-in-0 p-6">
            <h3 className="text-lg font-semibold mb-2">Setup Already Exists</h3>
            <p className="text-sm text-muted-foreground mb-6">
              A service setup for {formData.serviceDate} ({formData.serviceType}) already exists. 
              Do you want to overwrite it with these new details?
            </p>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowOverwriteDialog(false)}>Cancel</Button>
              <Button type="button" variant="default" onClick={confirmOverwrite}>Overwrite</Button>
            </div>
          </div>
        </div>
      )}

      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-4xl h-[90vh] rounded-xl border shadow-lg flex flex-col overflow-hidden animate-in zoom-in-95 fade-in-0">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">PDF Preview</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPreviewPdfUrl(null)}>Close</Button>
                <Button onClick={handleDownloadPDF} className="gap-2">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-muted p-4">
              <iframe src={previewPdfUrl} className="w-full h-full rounded border bg-white shadow-sm" />
            </div>
          </div>
        </div>
      )}
    </OfflineOverlay>
  );
}
