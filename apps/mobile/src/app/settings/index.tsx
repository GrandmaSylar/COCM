import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, TextInput, Switch, Alert as RNAlert, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Button, Spinner } from 'tamagui';
import { ArrowLeft, Plus, Trash2, Settings, Moon, Sun, RefreshCw, Check, Shield, Database, Palette } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeContext } from '../../context/ThemeContext';
import { 
  getLocalDropdownOptions, 
  upsertLocalDropdownOption, 
  deleteLocalDropdownOption,
  LocalDropdownOption,
  getLocalMembers,
  getLocalGivingRecords,
  getLocalExpenses
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { syncDropdownOptions } from '../../lib/options';
import { syncAllMetadata, flushSyncQueue } from '../../lib/syncEngine';

export default function SettingsScreen() {
  const router = useRouter();
  const { isDark, toggleTheme, themeColors } = useThemeContext();

  const [activeTab, setActiveTab] = useState<'options' | 'theme' | 'diagnostics'>('options');
  const [selectedCategory, setSelectedCategory] = useState<'ministries' | 'position_held' | 'roles'>('ministries');

  const [options, setOptions] = useState<LocalDropdownOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [savingOption, setSavingOption] = useState(false);

  // Diagnostics stats
  const [dbStats, setDbStats] = useState({ members: 0, giving: 0, expenses: 0 });
  const [flushing, setFlushing] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const cached = await getLocalDropdownOptions(selectedCategory);
      setOptions(cached);
    } catch (err) {
      console.error('Failed to load dropdown options:', err);
    } finally {
      setLoadingOptions(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    async function loadDbCounts() {
      try {
        const [m, g, e] = await Promise.all([getLocalMembers(), getLocalGivingRecords(), getLocalExpenses()]);
        setDbStats({ members: m.length, giving: g.length, expenses: e.length });
      } catch (err) {}
    }
    loadDbCounts();
  }, []);

  const handleAddOption = async () => {
    if (!newLabel.trim()) {
      RNAlert.alert('Validation Error', 'Option name / label is required.');
      return;
    }

    setSavingOption(true);
    try {
      const newId = generateUUID();
      const option: LocalDropdownOption = {
        id: newId,
        category: selectedCategory,
        label: newLabel.trim(),
        value: newLabel.trim(),
        sort_order: options.length + 1,
        is_active: 1,
        updated_at: new Date().toISOString()
      };

      await upsertLocalDropdownOption(option);
      setNewLabel('');
      setShowAddForm(false);
      loadOptions();
    } catch (err) {
      console.error('Failed to add dropdown option:', err);
      RNAlert.alert('Error', 'Failed to save dropdown option.');
    } finally {
      setSavingOption(false);
    }
  };

  const handleToggleActive = async (item: LocalDropdownOption) => {
    try {
      const nextActive = item.is_active === 1 ? 0 : 1;
      await upsertLocalDropdownOption({ ...item, is_active: nextActive });
      loadOptions();
    } catch (err) {
      console.error('Failed to toggle option active state:', err);
    }
  };

  const handleDeleteOption = async (id: string) => {
    RNAlert.alert(
      'Delete Option',
      'Are you sure you want to remove this dropdown option?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalDropdownOption(id);
              loadOptions();
            } catch (err) {
              console.error('Failed to delete dropdown option:', err);
            }
          }
        }
      ]
    );
  };

  const handleFlushAndResync = async () => {
    setFlushing(true);
    try {
      await flushSyncQueue();
      await syncAllMetadata();
      RNAlert.alert('Success', 'Local database successfully synchronized with server.');
    } catch (err) {
      RNAlert.alert('Sync Error', 'Failed to sync with server.');
    } finally {
      setFlushing(false);
    }
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
        {/* Header */}
        <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor={themeColors.borderColor}>
          <XStack space="$2" alignItems="center">
            <TouchableOpacity onPress={() => router.back()}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <ArrowLeft size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <YStack>
              <Text color={themeColors.text} fontSize={18} fontWeight="900">App & System Settings</Text>
              <Text color={themeColors.textMuted} fontSize={11}>Manage dynamic options, theme & database</Text>
            </YStack>
          </XStack>
        </XStack>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <YStack space="$4">

            {/* Sub-Tabs */}
            <XStack backgroundColor={isDark ? '#1C1C1E' : '#E5E5EA'} p="$1" borderRadius="$4">
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setActiveTab('options')}>
                <YStack
                  py="$2"
                  borderRadius="$3"
                  backgroundColor={activeTab === 'options' ? (isDark ? '#2C2C2E' : '#FFFFFF') : 'transparent'}
                  alignItems="center"
                >
                  <Text color={activeTab === 'options' ? themeColors.text : themeColors.textMuted} fontSize={12} fontWeight={activeTab === 'options' ? '800' : '600'}>
                    Dropdown Options
                  </Text>
                </YStack>
              </TouchableOpacity>

              <TouchableOpacity style={{ flex: 1 }} onPress={() => setActiveTab('theme')}>
                <YStack
                  py="$2"
                  borderRadius="$3"
                  backgroundColor={activeTab === 'theme' ? (isDark ? '#2C2C2E' : '#FFFFFF') : 'transparent'}
                  alignItems="center"
                >
                  <Text color={activeTab === 'theme' ? themeColors.text : themeColors.textMuted} fontSize={12} fontWeight={activeTab === 'theme' ? '800' : '600'}>
                    Appearance
                  </Text>
                </YStack>
              </TouchableOpacity>

              <TouchableOpacity style={{ flex: 1 }} onPress={() => setActiveTab('diagnostics')}>
                <YStack
                  py="$2"
                  borderRadius="$3"
                  backgroundColor={activeTab === 'diagnostics' ? (isDark ? '#2C2C2E' : '#FFFFFF') : 'transparent'}
                  alignItems="center"
                >
                  <Text color={activeTab === 'diagnostics' ? themeColors.text : themeColors.textMuted} fontSize={12} fontWeight={activeTab === 'diagnostics' ? '800' : '600'}>
                    Diagnostics
                  </Text>
                </YStack>
              </TouchableOpacity>
            </XStack>

            {/* Tab 1: Dropdown Options Manager */}
            {activeTab === 'options' && (
              <YStack space="$4">
                {/* Category Chips Selector */}
                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">SELECT DROPDOWN CATEGORY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {(['ministries', 'position_held', 'roles'] as const).map(cat => {
                      const isSelected = selectedCategory === cat;
                      const catLabels: Record<string, string> = {
                        ministries: 'Ministries',
                        position_held: 'Church Positions',
                        roles: 'Member Roles'
                      };
                      return (
                        <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)}>
                          <YStack
                            px="$3"
                            py="$1.5"
                            borderRadius="$3"
                            borderWidth={1}
                            borderColor={isSelected ? '#007AFF' : themeColors.borderColor}
                            backgroundColor={isSelected ? 'rgba(0, 122, 255, 0.15)' : themeColors.cardBackground}
                          >
                            <Text color={isSelected ? '#007AFF' : themeColors.textMuted} fontSize={12} fontWeight={isSelected ? '800' : '600'}>
                              {catLabels[cat]}
                            </Text>
                          </YStack>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </YStack>

                {/* Add Option Form / Toggle */}
                {!showAddForm ? (
                  <Button backgroundColor="#007AFF" size="$4" onPress={() => setShowAddForm(true)}>
                    <XStack space="$2" alignItems="center">
                      <Plus size={18} color="white" />
                      <Text color="white" fontWeight="800" fontSize={14}>Add Dropdown Option</Text>
                    </XStack>
                  </Button>
                ) : (
                  <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="#007AFF" backgroundColor={themeColors.cardBackground}>
                    <YStack space="$3">
                      <Text color={themeColors.text} fontSize={15} fontWeight="800">New Option</Text>
                      <TextInput
                        value={newLabel}
                        onChangeText={setNewLabel}
                        placeholder="Option name (e.g. Media Ministry, Pastor)..."
                        placeholderTextColor={themeColors.textMuted}
                        style={inputStyle}
                      />
                      <XStack space="$2" justifyContent="flex-end">
                        <Button size="$3" variant="outlined" onPress={() => setShowAddForm(false)}>
                          <Text color={themeColors.textMuted}>Cancel</Text>
                        </Button>
                        <Button size="$3" backgroundColor="#007AFF" onPress={handleAddOption} disabled={savingOption}>
                          {savingOption ? <Spinner color="white" /> : <Text color="white" fontWeight="800">Save</Text>}
                        </Button>
                      </XStack>
                    </YStack>
                  </Card>
                )}

                {/* List of Options */}
                {loadingOptions ? (
                  <Spinner size="large" color="#007AFF" py="$6" />
                ) : options.length === 0 ? (
                  <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
                    <Text color={themeColors.textMuted} fontSize={13}>No custom options added for this category yet.</Text>
                  </Card>
                ) : (
                  <YStack space="$2">
                    {options.map(item => {
                      const isActive = item.is_active === 1;
                      return (
                        <Card key={item.id} p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                          <XStack justifyContent="space-between" alignItems="center">
                            <YStack flex={1} space="$1">
                              <XStack space="$2" alignItems="center">
                                <Text color={themeColors.text} fontSize={15} fontWeight="800">{item.label}</Text>
                                <TouchableOpacity onPress={() => handleToggleActive(item)}>
                                  <XStack backgroundColor={isActive ? 'rgba(52, 199, 89, 0.15)' : 'rgba(142, 142, 147, 0.15)'} px="$2" py="$0.5" borderRadius="$2">
                                    <Text color={isActive ? '#34C759' : themeColors.textMuted} fontSize={10} fontWeight="800">
                                      {isActive ? 'Active' : 'Inactive'}
                                    </Text>
                                  </XStack>
                                </TouchableOpacity>
                              </XStack>
                            </YStack>

                            <TouchableOpacity onPress={() => handleDeleteOption(item.id)}>
                              <YStack p="$2" borderRadius="$3" backgroundColor="rgba(255, 59, 48, 0.15)">
                                <Trash2 size={16} color="#FF3B30" />
                              </YStack>
                            </TouchableOpacity>
                          </XStack>
                        </Card>
                      );
                    })}
                  </YStack>
                )}
              </YStack>
            )}

            {/* Tab 2: Theme & Appearance */}
            {activeTab === 'theme' && (
              <YStack space="$4">
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                  <XStack justifyContent="space-between" alignItems="center">
                    <XStack space="$3" alignItems="center">
                      <YStack p="$2.5" borderRadius="$4" backgroundColor={isDark ? 'rgba(255, 149, 0, 0.15)' : 'rgba(0, 122, 255, 0.15)'}>
                        {isDark ? <Sun size={24} color="#FF9500" /> : <Moon size={24} color="#007AFF" />}
                      </YStack>
                      <YStack>
                        <Text color={themeColors.text} fontSize={16} fontWeight="800">Theme Mode</Text>
                        <Text color={themeColors.textMuted} fontSize={12}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
                      </YStack>
                    </XStack>

                    <Switch
                      value={isDark}
                      onValueChange={toggleTheme}
                      trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                      thumbColor="#FFFFFF"
                    />
                  </XStack>
                </Card>

                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                  <YStack space="$2">
                    <Text color={themeColors.text} fontSize={15} fontWeight="800">System Color Palette</Text>
                    <Text color={themeColors.textMuted} fontSize={12}>Accent colors utilized across church financial and operational modules.</Text>

                    <XStack space="$2" mt="$2">
                      <YStack flex={1} p="$3" borderRadius="$3" backgroundColor="rgba(0, 122, 255, 0.15)" alignItems="center">
                        <Text color="#007AFF" fontSize={12} fontWeight="800">Primary Blue</Text>
                      </YStack>
                      <YStack flex={1} p="$3" borderRadius="$3" backgroundColor="rgba(52, 199, 89, 0.15)" alignItems="center">
                        <Text color="#34C759" fontSize={12} fontWeight="800">Giving Green</Text>
                      </YStack>
                      <YStack flex={1} p="$3" borderRadius="$3" backgroundColor="rgba(255, 59, 48, 0.15)" alignItems="center">
                        <Text color="#FF3B30" fontSize={12} fontWeight="800">Expense Red</Text>
                      </YStack>
                    </XStack>
                  </YStack>
                </Card>
              </YStack>
            )}

            {/* Tab 3: Diagnostics & Info */}
            {activeTab === 'diagnostics' && (
              <YStack space="$4">
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                  <YStack space="$3">
                    <Text color={themeColors.text} fontSize={15} fontWeight="800">Local Embedded Database Status</Text>

                    <YStack space="$2">
                      <XStack justifyContent="space-between" p="$2.5" borderRadius="$3" backgroundColor={themeColors.borderColor}>
                        <Text color={themeColors.textMuted} fontSize={13}>Cached Members:</Text>
                        <Text color={themeColors.text} fontSize={13} fontWeight="800">{dbStats.members} Records</Text>
                      </XStack>

                      <XStack justifyContent="space-between" p="$2.5" borderRadius="$3" backgroundColor={themeColors.borderColor}>
                        <Text color={themeColors.textMuted} fontSize={13}>Cached Giving Registers:</Text>
                        <Text color={themeColors.text} fontSize={13} fontWeight="800">{dbStats.giving} Records</Text>
                      </XStack>

                      <XStack justifyContent="space-between" p="$2.5" borderRadius="$3" backgroundColor={themeColors.borderColor}>
                        <Text color={themeColors.textMuted} fontSize={13}>Cached Expenses:</Text>
                        <Text color={themeColors.text} fontSize={13} fontWeight="800">{dbStats.expenses} Records</Text>
                      </XStack>
                    </YStack>

                    <Button backgroundColor="#007AFF" size="$4" onPress={handleFlushAndResync} disabled={flushing}>
                      {flushing ? <Spinner color="white" /> : (
                        <XStack space="$2" alignItems="center">
                          <RefreshCw size={18} color="white" />
                          <Text color="white" fontWeight="800" fontSize={14}>Force Sync & Flush Queue</Text>
                        </XStack>
                      )}
                    </Button>
                  </YStack>
                </Card>

                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
                  <YStack alignItems="center" space="$1">
                    <Text color={themeColors.text} fontSize={16} fontWeight="900">COCM Portal Mobile</Text>
                    <Text color={themeColors.textMuted} fontSize={12}>Version 1.0.0 • Embedded SQLite Engine</Text>
                  </YStack>
                </Card>
              </YStack>
            )}

          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
