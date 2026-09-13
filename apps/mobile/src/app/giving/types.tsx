import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, TextInput, Alert as RNAlert, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Button, Spinner } from 'tamagui';
import { ArrowLeft, Plus, Trash2, RefreshCw } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  getLocalCustomGivingTypes, 
  upsertLocalCustomGivingType, 
  deleteLocalCustomGivingType, 
  LocalCustomGivingType 
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { syncCustomGivingTypes } from '../../lib/syncEngine';
import { api } from '../../lib/api';
import { useThemeContext } from '../../context/ThemeContext';

export default function CustomGivingTypesScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();

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
      RNAlert.alert('Validation Error', 'Category name is required.');
      return;
    }

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

      try {
        await api.giving.types.create({ name: name.trim(), description: description.trim() || undefined });
      } catch (e) {
        console.warn('Backend custom giving type create warning:', e);
      }

      setName('');
      setDescription('');
      setShowAddForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to add custom giving category:', err);
      RNAlert.alert('Error', 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: LocalCustomGivingType) => {
    try {
      const nextActive = item.is_active === 1 ? 0 : 1;
      await upsertLocalCustomGivingType({ ...item, is_active: nextActive });

      try {
        await api.giving.types.toggle(item.id);
      } catch (e) {}

      loadData();
    } catch (err) {
      console.error('Failed to toggle category:', err);
    }
  };

  const handleDelete = async (id: string) => {
    RNAlert.alert(
      'Delete Category',
      'Are you sure you want to delete this custom giving category?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalCustomGivingType(id);
              try {
                await api.giving.types.delete(id);
              } catch (e) {}
              loadData();
            } catch (err) {
              console.error('Failed to delete custom category:', err);
            }
          }
        }
      ]
    );
  };

  const inputStyle = {
    color: themeColors.text,
    backgroundColor: themeColors.cardBackground,
    borderWidth: 1,
    borderColor: themeColors.borderColor,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.background} animated />
      <YStack flex={1} backgroundColor={themeColors.background}>
        {/* Navigation Header */}
        <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor={themeColors.borderColor}>
          <XStack space="$2" alignItems="center">
            <TouchableOpacity onPress={() => router.back()}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <ArrowLeft size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <YStack>
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Custom Giving Categories</Text>
              <Text color={themeColors.textMuted} fontSize={11}>Manage dynamic offering categories</Text>
            </YStack>
          </XStack>

          <TouchableOpacity onPress={handleRefresh}>
            <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
              <RefreshCw size={18} color={themeColors.text} className={refreshing ? 'animate-spin' : ''} />
            </YStack>
          </TouchableOpacity>
        </XStack>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          <YStack space="$4">

            {/* Add New Category Button / Form Toggle */}
            {!showAddForm ? (
              <Button backgroundColor="#FF9500" size="$4" onPress={() => setShowAddForm(true)}>
                <XStack space="$2" alignItems="center">
                  <Plus size={18} color="white" />
                  <Text color="white" fontWeight="800" fontSize={14}>Add Custom Category</Text>
                </XStack>
              </Button>
            ) : (
              <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="#FF9500" backgroundColor={themeColors.cardBackground}>
                <YStack space="$3">
                  <Text color={themeColors.text} fontSize={15} fontWeight="800">New Custom Giving Category</Text>

                  <YStack space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">CATEGORY NAME *</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Harvest Offering, Building Fund..."
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>

                  <YStack space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">DESCRIPTION (OPTIONAL)</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Purpose of this giving category..."
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>

                  <XStack space="$2" justifyContent="flex-end">
                    <Button size="$3" variant="outlined" onPress={() => setShowAddForm(false)}>
                      <Text color={themeColors.textMuted}>Cancel</Text>
                    </Button>
                    <Button size="$3" backgroundColor="#FF9500" onPress={handleSaveType} disabled={saving}>
                      {saving ? <Spinner color="white" /> : <Text color="white" fontWeight="800">Save</Text>}
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            )}

            {/* List of Custom Categories */}
            <YStack space="$2">
              <Text color={themeColors.text} fontSize={13} fontWeight="800" textTransform="uppercase" letterSpacing={0.5}>
                Categories ({types.length})
              </Text>

              {loading ? (
                <Spinner size="large" color="#FF9500" py="$6" />
              ) : types.length === 0 ? (
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
                  <Text color={themeColors.textMuted} fontSize={13}>No custom giving categories added yet.</Text>
                </Card>
              ) : (
                types.map(item => {
                  const isActive = item.is_active === 1;

                  return (
                    <Card key={item.id} p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack flex={1} space="$1">
                          <XStack space="$2" alignItems="center">
                            <Text color={themeColors.text} fontSize={15} fontWeight="800">{item.name}</Text>
                            <TouchableOpacity onPress={() => handleToggle(item)}>
                              <XStack backgroundColor={isActive ? 'rgba(52, 199, 89, 0.15)' : 'rgba(142, 142, 147, 0.15)'} px="$2" py="$0.5" borderRadius="$2">
                                <Text color={isActive ? '#34C759' : themeColors.textMuted} fontSize={10} fontWeight="800">
                                  {isActive ? 'Active' : 'Inactive'}
                                </Text>
                              </XStack>
                            </TouchableOpacity>
                          </XStack>
                          {item.description && (
                            <Text color={themeColors.textMuted} fontSize={12}>{item.description}</Text>
                          )}
                        </YStack>

                        <TouchableOpacity onPress={() => handleDelete(item.id)}>
                          <YStack p="$2" borderRadius="$3" backgroundColor="rgba(255, 59, 48, 0.15)">
                            <Trash2 size={16} color="#FF3B30" />
                          </YStack>
                        </TouchableOpacity>
                      </XStack>
                    </Card>
                  );
                })
              )}
            </YStack>

          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
