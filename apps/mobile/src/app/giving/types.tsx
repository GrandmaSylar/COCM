import React, { useState, useEffect, useCallback } from 'react';
import { Alert as RNAlert, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { Plus, RefreshCw, Tags, Trash2 } from '@tamagui/lucide-icons';
import {
  getLocalCustomGivingTypes,
  upsertLocalCustomGivingType,
  deleteLocalCustomGivingType,
  LocalCustomGivingType
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { pushOrQueue, syncCustomGivingTypes } from '../../lib/syncEngine';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { AppText, Button, EmptyState, IconButton, ListRow, Screen, Section, Sheet, TextField, useToast } from '../../components/ui';
import { haptic } from '../../theme/haptics';
import { space } from '../../theme/tokens';

export default function CustomGivingTypesScreen() {
  const c = useAppColors();
  const toast = useToast();
  const [nameError, setNameError] = useState<string | null>(null);

  const [types, setTypes] = useState<LocalCustomGivingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await getLocalCustomGivingTypes();
      setTypes(cached);

      syncCustomGivingTypes().then(() => getLocalCustomGivingTypes().then(setTypes)).catch(() => {});
    } catch (err) {
      console.error('Failed to load custom giving types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await syncCustomGivingTypes();
      const updated = await getLocalCustomGivingTypes();
      setTypes(updated);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveType = async () => {
    if (!name.trim()) {
      setNameError('Enter a category name.');
      return;
    }
    setNameError(null);

    setSaving(true);
    try {
      const newId = generateUUID();
      const newType = {
        id: newId,
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: 1,
        created_at: new Date().toISOString()
      };

      await upsertLocalCustomGivingType(newType);

      // Queued if offline (a swallowed failure used to lose it on the next sync)
      await pushOrQueue('POST', '/giving/types', { name: name.trim(), description: description.trim() || undefined });

      setName('');
      setDescription('');
      setShowAddForm(false);
      toast.show({ title: 'Category added', message: newType.name });
      loadData();
    } catch (err: any) {
      console.error('Failed to add custom giving category:', err);
      toast.show({ title: 'Couldn’t save category', message: err?.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: LocalCustomGivingType) => {
    try {
      const nextActive = item.is_active === 1 ? 0 : 1;
      await upsertLocalCustomGivingType({ ...item, is_active: nextActive });

      await pushOrQueue('PATCH', `/giving/types/${item.id}/toggle`);

      loadData();
    } catch (err) {
      console.error('Failed to toggle category:', err);
    }
  };

  const handleDelete = async (id: string) => {
    RNAlert.alert(
      'Delete category?',
      'It will no longer appear when recording giving.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalCustomGivingType(id);
              await pushOrQueue('DELETE', `/giving/types/${id}`);
              loadData();
            } catch (err) {
              console.error('Failed to delete custom category:', err);
            }
          }
        }
      ]
    );
  };

  return (
    <Screen>
      <AppHeader
        title="Giving types"
        subtitle="Extra offering categories"
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={RefreshCw} label="Refresh" spinning={refreshing} onPress={handleRefresh} />
            <IconButton icon={Plus} label="Add category" tone="primary" onPress={() => { setNameError(null); setShowAddForm(true); }} />
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
      >
        <AppText variant="caption" tone="muted" style={{ paddingHorizontal: 4 }}>
          Offertory, thanksgiving and donations are always available. Add categories like Building Fund or Harvest here.
        </AppText>
        <Section title={`Categories · ${types.length}`}>
          {loading ? (
            <View style={{ padding: space.md }}><SkeletonList count={3} hasAvatar={false} /></View>
          ) : types.length === 0 ? (
            <EmptyState icon={Tags} title="No extra categories" action={{ label: 'Add category', onPress: () => setShowAddForm(true) }} />
          ) : (
            types.map(item => {
              const isActive = item.is_active === 1;
              return (
                <ListRow
                  key={item.id}
                  icon={Tags}
                  iconTone={isActive ? 'primary' : 'neutral'}
                  title={item.name}
                  subtitle={item.description || (isActive ? 'Shown when recording giving' : 'Hidden')}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Switch
                        value={isActive}
                        onValueChange={() => { haptic.selection(); handleToggle(item); }}
                        trackColor={{ true: c.primary.base, false: c.borderStrong }}
                        thumbColor="#FFFFFF"
                        accessibilityLabel={`${item.name} active`}
                      />
                      <IconButton icon={Trash2} label={`Delete ${item.name}`} tone="danger" size={36} onPress={() => handleDelete(item.id)} />
                    </View>
                  }
                />
              );
            })
          )}
        </Section>
      </ScrollView>

      <Sheet
        visible={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="New giving category"
        footer={<Button label="Save category" loading={saving} fullWidth onPress={handleSaveType} />}
      >
        <TextField
          label="Name *"
          placeholder="e.g. Building fund"
          value={name}
          onChangeText={t => { setName(t); if (nameError) setNameError(null); }}
          error={nameError}
          autoFocus
        />
        <TextField label="Description" placeholder="Optional" value={description} onChangeText={setDescription} />
      </Sheet>
    </Screen>
  );
}
