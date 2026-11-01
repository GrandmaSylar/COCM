// Building blocks for the Services screens. Each mirrors a component of the web Services page
// (apps/cocm/src/components/Services.tsx) and keeps its figures and rules.
import React, { useMemo, useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Banknote, ChevronRight, Phone, Receipt, UserMinus, UserPlus, Users } from '@tamagui/lucide-icons';
import { useAppColors } from '../context/ThemeContext';
import { AppText, Badge, FilterChips, PressableScale, ProgressBar, Section, Surface } from './ui';
import type { Tone } from './ui';
import type { ServiceDateDetail, ServiceDateSummary } from '../lib/serviceRecords';
import { radius, space } from '../theme/tokens';

export const ghs = (n: number) => `GH₵ ${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d: string, weekday: 'short' | 'long' = 'short', withYear = true) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-GB', { weekday, ...(withYear ? { year: 'numeric' as const } : {}), month: weekday === 'long' ? 'long' : 'short', day: 'numeric' });
};

export function monthLabel(d: string) {
  const date = new Date(d + '-01');
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** Same grouping the web page uses for the service type badge colour. */
export function typeTone(serviceType: string): Tone {
  const t = (serviceType || '').toLowerCase();
  if (!t) return 'info';
  if (t.includes('sunday')) return 'primary';
  if (t.includes('midweek')) return 'warning';
  if (t.includes('prayer')) return 'success';
  return 'info';
}

export const serviceHref = (date: string, type?: string) =>
  `/services/detail?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type || '')}` as any;

function Dot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

function Metric({ icon: Icon, color, value, note }: { icon: any; color: string; value: string; note?: string }) {
  return (
    <View style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon size={16} color={color} />
      <AppText variant="bodyMedium" numeric>{value}</AppText>
      {note ? <AppText variant="caption" tone="muted">{note}</AppText> : null}
    </View>
  );
}

function initialsOf2(name: string, fallback: string) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || fallback;
}

function Avatar2({ text, tone }: { text: string; tone: 'success' | 'warning' | 'primary' | 'info' }) {
  const c = useAppColors();
  const t = c[tone];
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: t.soft }}>
      <AppText variant="captionStrong" style={{ color: t.text }}>{text}</AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------------------------

export function StatsBar({ records, total }: { records: ServiceDateSummary[]; total: number }) {
  const att = records.reduce((n, r) => n + (r.totalAttendance || 0), 0);
  const giving = records.reduce((n, r) => n + (r.totalGiving || 0), 0);
  const avg = records.length ? Math.round(att / records.length) : 0;
  const Tile = ({ label, value, tone }: { label: string; value: string; tone?: 'success' }) => (
    <Surface style={{ flex: 1, gap: 2 }}>
      <AppText variant="title" numeric tone={tone}>{value}</AppText>
      <AppText variant="caption" tone="muted">{label}</AppText>
    </Surface>
  );
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Tile label="Total services" value={String(total)} />
        <Tile label="Average attendance" value={String(avg)} />
      </View>
      <Tile label="Total giving" value={ghs(giving)} tone="success" />
    </View>
  );
}

export function FeaturedCard({ sr, onPress }: { sr: ServiceDateSummary; onPress: () => void }) {
  const c = useAppColors();
  const rate = sr.membersRegistered > 0 ? Math.min(100, Math.round(((sr.totalAttendance || 0) / sr.membersRegistered) * 100)) : 0;
  const expenses = sr.expensesTotal || 0;
  const hasChildren = (sr.childrenAttendanceCount || 0) > 0 || (sr.childrenGivingTotal || 0) > 0 || (sr.childrenVisitorsCount || 0) > 0;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${sr.serviceType}, ${fmtDate(sr.serviceDate)}`}>
      <Surface style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <AppText variant="bodyStrong" style={{ flexShrink: 1 }}>{fmtDate(sr.serviceDate)}</AppText>
          <Badge label={sr.serviceType || 'Service'} tone={typeTone(sr.serviceType)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm }}>
          <Metric icon={Users} color={c.primary.base} value={String(sr.totalAttendance)} note={`· ${rate}%`} />
          <Metric icon={Banknote} color={c.success.base} value={ghs(sr.totalGiving)} />
          <Metric icon={UserMinus} color={c.warning.base} value={String(sr.absenteesCount)} note="absent" />
          <Metric icon={UserPlus} color={c.info.base} value={String(sr.visitorsCount)} note="visitors" />
          {expenses > 0 ? <Metric icon={Receipt} color={c.danger.base} value={ghs(expenses)} /> : null}
        </View>
        {expenses > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border }}>
            <AppText variant="caption" tone="muted">Net giving (after expenses)</AppText>
            <AppText variant="captionStrong" tone="success" numeric>{ghs((sr.totalGiving || 0) - expenses)}</AppText>
          </View>
        ) : null}
        {hasChildren ? (
          <View style={{ gap: space.xs, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border }}>
            <AppText variant="captionStrong" tone="muted">CHILDREN</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm }}>
              <Metric icon={Users} color={c.primary.base} value={String(sr.childrenAttendanceCount || 0)} />
              <Metric icon={Banknote} color={c.success.base} value={ghs(sr.childrenGivingTotal || 0)} />
              <Metric icon={UserPlus} color={c.info.base} value={String(sr.childrenVisitorsCount || 0)} />
            </View>
          </View>
        ) : null}
      </Surface>
    </PressableScale>
  );
}

export function TimelineRow({ sr, onPress, last }: { sr: ServiceDateSummary; onPress: () => void; last: boolean }) {
  const c = useAppColors();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${sr.serviceType}, ${fmtDate(sr.serviceDate)}`}>
      <View style={{ padding: space.md, gap: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{fmtDate(sr.serviceDate)}</AppText>
          <Badge label={sr.serviceType || 'Service'} tone={typeTone(sr.serviceType)} />
          <ChevronRight size={18} color={c.textSubtle} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Users size={14} color={c.primary.base} />
            <AppText variant="caption" numeric>{sr.totalAttendance}</AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Banknote size={14} color={c.success.base} />
            <AppText variant="caption" numeric>{ghs(sr.totalGiving)}</AppText>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function SetupCard({ setup, onPress }: { setup: any; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="View or edit this service setup">
      <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <AppText variant="bodyStrong">{fmtDate(setup.serviceDate, 'long')}</AppText>
            <Badge label={setup.serviceType} tone={typeTone(setup.serviceType)} />
          </View>
          <AppText variant="caption" tone="muted">
            MC: {setup.mcName || 'TBA'}  ·  Preacher: {setup.preacherName || 'TBA'}
          </AppText>
        </View>
        <AppText variant="captionStrong" tone="primary">View / Edit</AppText>
      </Surface>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------------------------

function sumEntries(rows: any[] | undefined) {
  return (rows ?? []).reduce((sum: number, r: any) => {
    const entries = (r.entries ?? []).length;
    return sum + (entries > 0 ? entries : r.totalCount || 0);
  }, 0);
}

function AttendanceRing({ percent }: { percent: number }) {
  const c = useAppColors();
  const r = 20;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={26} cy={26} r={r} stroke={c.surfaceMuted} strokeWidth={4} fill="none" />
        <Circle cx={26} cy={26} r={r} stroke={c.info.base} strokeWidth={4} fill="none" strokeDasharray={`${circumference}`} strokeDashoffset={circumference * (1 - percent / 100)} strokeLinecap="round" />
      </Svg>
      <AppText variant="captionStrong" style={{ position: 'absolute', color: c.info.text }}>{percent}%</AppText>
    </View>
  );
}

export function OverviewSection({ sr }: { sr: ServiceDateDetail }) {
  const c = useAppColors();
  const expensesTotal = (sr.expenses ?? []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const net = sr.totalGivingAmount - expensesTotal;
  const membersRegistered = sr.membersRegistered ?? sr.services?.[0]?.attendance?.membersRegistered ?? 0;
  const rate = membersRegistered > 0 ? Math.min(100, Math.round((sr.totalAttendance / membersRegistered) * 100)) : 0;
  const childrenCount = sumEntries(sr.childrenAttendance);
  const combined = sr.totalAttendance + childrenCount;
  const noReason = (sr.absentees ?? []).filter(a => !a.requestedPermission).length;
  const withPermission = (sr.absentees ?? []).filter(a => a.requestedPermission).length;
  const perHead = combined > 0 ? sr.totalGivingAmount / combined : 0;

  const Card = ({ dot, label, children, wide }: { dot?: string; label: string; children: React.ReactNode; wide?: boolean }) => (
    <Surface style={{ width: wide ? '100%' : '48.5%', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {dot ? <Dot color={dot} /> : null}
        <AppText variant="captionStrong" tone="muted">{label.toUpperCase()}</AppText>
      </View>
      {children}
    </Surface>
  );

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      <Card label="Attendance" wide>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <AppText variant="title" numeric>{combined}</AppText>
            <AppText variant="caption" tone="muted">Adults: {sr.totalAttendance} · Children: {childrenCount}</AppText>
          </View>
          <AttendanceRing percent={rate} />
        </View>
      </Card>
      <Card label="Total giving" dot={c.success.base}>
        <AppText variant="title" tone="success" numeric numberOfLines={1} adjustsFontSizeToFit>{ghs(sr.totalGivingAmount)}</AppText>
        <AppText variant="caption" tone="muted">{ghs(perHead)} per head</AppText>
      </Card>
      {expensesTotal > 0 ? (
        <Card label="Net giving" dot={c.success.base}>
          <AppText variant="title" tone="success" numeric numberOfLines={1} adjustsFontSizeToFit>{ghs(net)}</AppText>
          <AppText variant="caption" tone="muted">After {ghs(expensesTotal)} expenses</AppText>
        </Card>
      ) : null}
      <Card label="Absentees" dot={c.warning.base}>
        <AppText variant="title" numeric>{sr.absentees?.length ?? 0}</AppText>
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {noReason > 0 ? <Badge label={`${noReason} no reason`} tone="danger" /> : null}
          {withPermission > 0 ? <Badge label={`${withPermission} with permission`} tone="warning" /> : null}
        </View>
      </Card>
      <Card label="Visitors" dot={c.primary.base}>
        <AppText variant="title" numeric>{sr.visitors?.length ?? 0}</AppText>
        <AppText variant="caption" tone="muted">{sr.visitors?.length ?? 0} adult · {sr.childrenVisitors?.length ?? 0} children</AppText>
      </Card>
    </View>
  );
}

export function SetupSection({ setup }: { setup: any }) {
  const c = useAppColors();
  if (!setup) return null;
  const fields: [string, string | undefined][] = [
    ['Master of ceremonies', setup.mcName],
    ['Preacher', setup.preacherName],
    ['Theme / topic', setup.sermonTopic],
  ];
  return (
    <View style={{ gap: space.sm }}>
      <Surface style={{ gap: space.sm }}>
        {fields.filter(([, v]) => v).map(([label, value]) => (
          <View key={label}>
            <AppText variant="captionStrong" tone="muted">{label.toUpperCase()}</AppText>
            <AppText variant="bodyMedium">{value}</AppText>
          </View>
        ))}
      </Surface>
      {setup.programme && setup.programme.length > 0 ? (
        <Section title="Order of service">
          {setup.programme.map((row: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderBottomWidth: i === setup.programme.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
              <AppText variant="caption" tone="muted" style={{ width: 84 }}>{row.startTime}{row.endTime ? ` – ${row.endTime}` : ''}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium">{row.activity}</AppText>
                <AppText variant="caption" tone="muted">{row.assignedMemberName || '—'}</AppText>
              </View>
            </View>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

export function GivingBreakdown({ sr }: { sr: ServiceDateDetail }) {
  const c = useAppColors();
  const expensesTotal = (sr.expenses ?? []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const net = sr.totalGivingAmount - expensesTotal;
  const perHead = sr.totalAttendance > 0 ? sr.totalGivingAmount / sr.totalAttendance : 0;
  let offering = 0, donation = 0, thanksgiving = 0, cash = 0;
  for (const svc of sr.services ?? []) {
    if (!svc.giving) continue;
    offering += svc.giving.offeringAmount || svc.giving.offering_amount || 0;
    donation += svc.giving.donationAmount || svc.giving.donation_amount || 0;
    thanksgiving += svc.giving.thanksgivingAmount || svc.giving.thanksgiving_amount || 0;
    cash += svc.giving.cashAmount || svc.giving.cash_amount || 0;
  }
  const categories = [
    { key: 'offering', label: 'Offering', amount: offering, color: c.info.base },
    { key: 'donation', label: 'Donation', amount: donation, color: c.success.base },
    { key: 'thanksgiving', label: 'Thanksgiving', amount: thanksgiving, color: c.warning.base },
    { key: 'cash', label: 'Cash', amount: cash, color: c.primary.base },
  ].filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);

  let trend: React.ReactNode = null;
  const prev = sr.previousServiceGiving;
  if (prev && prev.totalGivingAmount > 0) {
    const diff = sr.totalGivingAmount - prev.totalGivingAmount;
    const pct = Math.abs(Number(((diff / prev.totalGivingAmount) * 100).toFixed(1)));
    trend = <Badge label={`${diff >= 0 ? '↑' : '↓'} ${pct}%`} tone={diff >= 0 ? 'success' : 'danger'} />;
  }

  return (
    <Surface style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Giving breakdown · {ghs(sr.totalGivingAmount)}</AppText>
          <AppText variant="caption" tone="muted">{ghs(perHead)} per head</AppText>
        </View>
        {trend}
      </View>
      {sr.totalGivingAmount > 0 ? (
        <>
          <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: c.surfaceMuted }}>
            {categories.map(cat => (
              <View key={cat.key} style={{ flex: cat.amount, backgroundColor: cat.color }} />
            ))}
          </View>
          <View style={{ gap: space.sm }}>
            {categories.map(cat => {
              const pct = Math.round((cat.amount / sr.totalGivingAmount) * 100);
              return (
                <View key={cat.key} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Dot color={cat.color} />
                    <AppText variant="caption" tone="muted" style={{ flex: 1 }}>{cat.label} · {pct}%</AppText>
                    <AppText variant="captionStrong" numeric>{ghs(cat.amount)}</AppText>
                  </View>
                  <ProgressBar percent={pct} color={cat.color} />
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <AppText variant="caption" tone="muted" align="center">No giving recorded.</AppText>
      )}
      {expensesTotal > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.sm, borderRadius: radius.md, backgroundColor: c.surfaceMuted }}>
          <AppText variant="caption" tone="muted">Net giving (after expenses)</AppText>
          <AppText variant="captionStrong" tone="success" numeric>{ghs(net)}</AppText>
        </View>
      ) : null}
    </Surface>
  );
}

export function ExpenseList({ expenses }: { expenses: any[] }) {
  const c = useAppColors();
  if (!expenses || expenses.length === 0) return null;
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  return (
    <Section title={`Expenses (${expenses.length})`}>
      {expenses.map(e => (
        <View key={e.id} style={{ padding: space.md, gap: 4, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
            <AppText variant="bodyMedium" style={{ flex: 1 }}>{e.details}</AppText>
            <AppText variant="bodyStrong" numeric>{ghs(e.amount)}</AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            {e.paymentMethodName ? <Badge label={e.paymentMethodName} tone="neutral" /> : null}
            {e.approvedByName ? <AppText variant="caption" tone="muted">Approved by {e.approvedByName}</AppText> : null}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.md, backgroundColor: c.surfaceMuted }}>
        <AppText variant="caption" tone="muted">Total expenses</AppText>
        <AppText variant="captionStrong" tone="warning" numeric>{ghs(total)}</AppText>
      </View>
    </Section>
  );
}

type PersonType = 'absentee' | 'visitor' | 'member';

export function PersonList({ items, type, onViewMember, onConvertVisitor }: {
  items: any[];
  type: PersonType;
  onViewMember?: (id: string) => void;
  onConvertVisitor?: (visitor: any) => void;
}) {
  const c = useAppColors();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'no-reason' | 'with-permission'>('all');
  const showSearch = items.length > 5;

  const shown = useMemo(() => {
    let result = items;
    if (type === 'absentee') {
      if (filter === 'no-reason') result = result.filter(a => !a.requestedPermission);
      else if (filter === 'with-permission') result = result.filter(a => a.requestedPermission);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(item => (type === 'absentee' ? (item.memberName || '') : `${item.firstName || ''} ${item.lastName || ''}`).toLowerCase().includes(q));
    }
    return result;
  }, [items, type, filter, query]);

  return (
    <View style={{ gap: space.sm }}>
      {showSearch ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name…"
          placeholderTextColor={c.textSubtle}
          accessibilityLabel="Search name"
          style={{ height: 40, borderRadius: radius.md, paddingHorizontal: space.md, backgroundColor: c.surfaceMuted, color: c.text }}
        />
      ) : null}
      {type === 'absentee' ? (
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${items.length})` },
            { value: 'no-reason', label: `No reason (${items.filter(a => !a.requestedPermission).length})` },
            { value: 'with-permission', label: `With permission (${items.filter(a => a.requestedPermission).length})` },
          ]}
        />
      ) : null}
      {items.length === 0 ? (
        <AppText variant="caption" tone="muted" align="center" style={{ paddingVertical: space.md }}>
          {type === 'absentee' ? 'All members were present 🎉' : 'No visitors recorded'}
        </AppText>
      ) : (
        <View style={{ borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
          {shown.map((item, i) => {
            const id = item.memberId || item.id;
            const name = type === 'absentee' ? item.memberName : `${item.firstName || ''} ${item.lastName || ''}`.trim();
            const initials = type === 'absentee'
              ? initialsOf2(item.memberName, 'AB')
              : (`${item.firstName?.[0] || ''}${item.lastName?.[0] || ''}`.toUpperCase() || (type === 'visitor' ? 'V' : 'M'));
            const avatarTone = type === 'absentee' ? (item.requestedPermission ? 'success' : 'warning') : type === 'visitor' ? 'primary' : 'info';
            const tappable = type === 'absentee' && onViewMember && id;
            return (
              <PressableScale
                key={id || i}
                onPress={tappable ? () => onViewMember!(id) : undefined}
                disabled={!tappable}
                accessibilityRole={tappable ? 'button' : undefined}
              >
                <View style={{ padding: space.md, gap: space.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: i === shown.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                  <Avatar2 text={initials} tone={avatarTone} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyMedium" numberOfLines={1}>{name}</AppText>
                    {type === 'visitor' && item.phone ? (
                      <PressableScale onPress={() => Linking.openURL(`tel:${item.phone}`)} accessibilityRole="button" accessibilityLabel={`Call ${item.phone}`}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Phone size={12} color={c.textMuted} />
                          <AppText variant="caption" tone="muted">{item.phone}</AppText>
                        </View>
                      </PressableScale>
                    ) : null}
                    {type === 'absentee' ? (
                      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        <Badge label={`${item.reason || 'No reason'}${item.requestedPermission ? ' (permission)' : ''}`} tone={item.requestedPermission ? 'success' : 'danger'} />
                        {item.zone ? <Badge label={`Zone ${item.zone}`} tone="info" /> : null}
                      </View>
                    ) : null}
                    {type === 'member' && item.zone ? <Badge label={`Zone ${item.zone}`} tone="info" /> : null}
                  </View>
                  {type === 'visitor' && onConvertVisitor ? (
                    <PressableScale onPress={() => onConvertVisitor(item)} accessibilityRole="button" accessibilityLabel={`Convert ${name} to a member`}>
                      <View style={{ paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}>
                        <AppText variant="captionStrong">Convert</AppText>
                      </View>
                    </PressableScale>
                  ) : null}
                </View>
              </PressableScale>
            );
          })}
          {shown.length === 0 ? <AppText variant="caption" tone="muted" align="center" style={{ padding: space.md }}>No matches found</AppText> : null}
        </View>
      )}
    </View>
  );
}

export function PeopleSection({ sr, onViewMember, onConvertVisitor }: { sr: ServiceDateDetail; onViewMember?: (id: string) => void; onConvertVisitor?: (v: any) => void }) {
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <AppText variant="bodyStrong">Absentees ({sr.absentees?.length ?? 0})</AppText>
        <PersonList items={sr.absentees || []} type="absentee" onViewMember={onViewMember} />
      </View>
      <View style={{ gap: space.sm }}>
        <AppText variant="bodyStrong">Visitors ({sr.visitors?.length ?? 0})</AppText>
        <PersonList items={sr.visitors || []} type="visitor" onConvertVisitor={onConvertVisitor} />
      </View>
      {(sr.newMembers?.length ?? 0) > 0 ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="bodyStrong">New members ({sr.newMembers.length})</AppText>
          <PersonList items={sr.newMembers} type="member" />
        </View>
      ) : null}
    </View>
  );
}

function MiniList({ title, items, tone, nameOf }: { title: string; items: any[]; tone: 'primary' | 'success' | 'warning'; nameOf: (i: any) => string }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="bodyStrong">{title}</AppText>
      <Surface style={{ gap: space.sm }}>
        {items.map((it, i) => {
          const n = nameOf(it);
          return (
            <View key={it.id ?? i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Avatar2 text={n.trim().slice(0, 2).toUpperCase() || 'CH'} tone={tone} />
              <AppText variant="body">{n}</AppText>
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

export function hasChildrenData(sr: ServiceDateDetail) {
  return (sr.childrenAttendance?.length || 0) + (sr.childrenGiving?.length || 0) + (sr.childrenVisitors?.length || 0) + (sr.newChildMembers?.length || 0) > 0;
}

export function ChildrenSection({ sr }: { sr: ServiceDateDetail }) {
  const c = useAppColors();
  const [filter, setFilter] = useState('');
  const attended = sumEntries(sr.childrenAttendance);
  const giving = sr.childrenGiving?.reduce((s: number, g: any) => s + (g.totalAmount || 0), 0) || 0;
  const visitors = sr.childrenVisitors?.length || 0;
  const hasAny = attended > 0 || giving > 0 || visitors > 0 || (sr.newChildMembers?.length || 0) > 0;
  if (!hasAny) return null;

  const attendanceList = sr.childrenAttendance?.flatMap(r => r.entries ?? []) || [];
  const filtered = attendanceList.filter((x: any) => (x.childName || '').toLowerCase().includes(filter.toLowerCase()));
  let offering = 0, cash = 0, momo = 0;
  for (const g of sr.childrenGiving ?? []) {
    offering += g.offeringAmount || 0;
    cash += g.cashAmount || 0;
    momo += g.mobileMoneyAmount || 0;
  }
  const cats = [
    { key: 'offering', label: 'Offering', amount: offering, color: c.primary.base },
    { key: 'cash', label: 'Cash', amount: cash, color: c.success.base },
    { key: 'momo', label: 'Mobile money', amount: momo, color: c.info.base },
  ].filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {[
          { label: 'Attended', value: String(attended), tone: 'primary' as const },
          { label: 'Giving', value: ghs(giving), tone: 'success' as const },
          { label: 'Visitors', value: String(visitors), tone: 'warning' as const },
        ].map(t => (
          <View key={t.label} style={{ flex: 1, padding: space.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: c[t.tone].soft }}>
            <AppText variant="bodyStrong" numeric adjustsFontSizeToFit numberOfLines={1} style={{ color: c[t.tone].text }}>{t.value}</AppText>
            <AppText variant="captionStrong" style={{ color: c[t.tone].text }}>{t.label.toUpperCase()}</AppText>
          </View>
        ))}
      </View>

      {attendanceList.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="bodyStrong">Children attendance</AppText>
          {attendanceList.length > 10 ? (
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Search…"
              placeholderTextColor={c.textSubtle}
              accessibilityLabel="Search children"
              style={{ height: 40, borderRadius: radius.md, paddingHorizontal: space.md, backgroundColor: c.surfaceMuted, color: c.text }}
            />
          ) : null}
          <Surface style={{ gap: space.sm }}>
            {filtered.map((e: any) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Avatar2 text={(e.childName || '').substring(0, 2).toUpperCase() || 'CH'} tone="primary" />
                <AppText variant="body">{e.childName}</AppText>
              </View>
            ))}
          </Surface>
        </View>
      ) : null}

      {giving > 0 ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="bodyStrong">Children giving breakdown</AppText>
          <Surface style={{ gap: space.sm }}>
            {cats.map(cat => {
              const pct = Math.round((cat.amount / giving) * 100);
              return (
                <View key={cat.key} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Dot color={cat.color} />
                    <AppText variant="caption" tone="muted" style={{ flex: 1 }}>{cat.label} · {pct}%</AppText>
                    <AppText variant="captionStrong" numeric>{ghs(cat.amount)}</AppText>
                  </View>
                  <ProgressBar percent={pct} color={cat.color} />
                </View>
              );
            })}
          </Surface>
        </View>
      ) : null}

      {(sr.childrenVisitors?.length || 0) > 0 ? (
        <MiniList title={`Children visitors (${sr.childrenVisitors!.length})`} items={sr.childrenVisitors!} tone="warning" nameOf={v => `${v.firstName || ''} ${v.lastName || ''}`.trim()} />
      ) : null}
      {(sr.newChildMembers?.length || 0) > 0 ? (
        <MiniList title={`New child members (${sr.newChildMembers!.length})`} items={sr.newChildMembers!} tone="success" nameOf={m => `${m.firstName || ''} ${m.lastName || ''}`.trim()} />
      ) : null}
    </View>
  );
}
