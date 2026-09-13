import React, { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Alert as RNAlert } from 'react-native';
import { YStack, XStack, Text, Card, Button, Input, Spinner, Theme } from 'tamagui';
import { ArrowLeft, Clock, Plus, Trash2, Check, X, Calendar, RefreshCw } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getLocalCustomServices,
  upsertLocalCustomService,
  toggleLocalCustomService,
  deleteLocalCustomService,
  LocalCustomService
} from '../../../lib/db';
import { generateUUID } from '../../../lib/uuid';
import { enqueueSyncTask, syncCustomServices } from '../../../lib/syncEngine';

const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ServicesManagerScreen() {
  const router = useRouter();
  const [customServices, setCustomServices] = useState<LocalCustomService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('2099-12-31');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([0]); // default Sunday

  const loadServices = async () => {
    setLoading(true);
    try {
      await syncCustomServices().catch(() => {});
      const svcs = await getLocalCustomServices();
      setCustomServices(svcs);
    } catch (e) {
      console.error('Failed to load custom services:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleDayToggle = (dayIndex: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const handleAddService = async () => {
    if (!name.trim() || !startDate || !endDate || !startTime || !endTime || selectedDays.length === 0) {
      RNAlert.alert('Validation Error', 'Please fill in all required service fields.');
      return;
    }

    const newSvc: LocalCustomService = {
      id: generateUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      days_of_week: JSON.stringify(selectedDays),
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    try {
      await upsertLocalCustomService(newSvc);
      await enqueueSyncTask('INSERT', '/services', newSvc);
      setName('');
      setDescription('');
      setShowAddForm(false);
      loadServices();
    } catch (err) {
      console.error('Failed to save custom service:', err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleLocalCustomService(id);
      loadServices();
    } catch (err) {
      console.error('Failed to toggle service:', err);
    }
  };

  const handleDelete = async (id: string, serviceName: string) => {
    RNAlert.alert(
      'Delete Service',
      `Are you sure you want to delete "${serviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLocalCustomService(id);
            await enqueueSyncTask('DELETE', `/services/${id}`, { id });
            loadServices();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'left', 'right']}>
      <YStack flex={1} backgroundColor="$background">
      {/* Navigation Header */}
      <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor="$borderColor">
        <XStack space="$2" alignItems="center">
          <TouchableOpacity onPress={() => router.back()}>
            <YStack p="$2" borderRadius="$3" backgroundColor="$borderColor" opacity={0.8}>
              <ArrowLeft size={18} color="$color" />
            </YStack>
          </TouchableOpacity>
          <YStack>
            <Text color="$color" fontSize={18} fontWeight="800">Manage Service Types</Text>
            <Text color="$colorPress" fontSize={12}>Configure custom church services</Text>
          </YStack>
        </XStack>
        <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)}>
          <XStack backgroundColor={showAddForm ? '$colorPress' : '#FF9500'} px="$3" py="$2" borderRadius="$3" space="$1" alignItems="center">
            {showAddForm ? <X size={16} color="white" /> : <Plus size={16} color="white" />}
            <Text color="white" fontSize={12} fontWeight="700">{showAddForm ? 'Cancel' : 'Add Service'}</Text>
          </XStack>
        </TouchableOpacity>
      </XStack>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack space="$4">

          {/* Permanent Sunday Main Service Card */}
          <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="rgba(255, 149, 0, 0.3)" backgroundColor="rgba(255, 149, 0, 0.05)">
            <XStack space="$3" alignItems="flex-start">
              <YStack p="$2.5" borderRadius="$3" backgroundColor="rgba(255, 149, 0, 0.15)">
                <Clock size={22} color="#FF9500" />
              </YStack>
              <YStack flex={1} space="$1">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text color="$color" fontSize={15} fontWeight="800">{SUNDAY_MAIN_SERVICE.name}</Text>
                  <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                    <Text color="#34C759" fontSize={10} fontWeight="800" textTransform="uppercase">Permanent</Text>
                  </XStack>
                </XStack>
                <Text color="$colorPress" fontSize={12}>{SUNDAY_MAIN_SERVICE.description}</Text>
                <Text color="$colorPress" fontSize={11} fontWeight="600" marginTop="$1">
                  Time: {SUNDAY_MAIN_SERVICE.startTime} - {SUNDAY_MAIN_SERVICE.endTime} (Every Sunday)
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* Add New Custom Service Form */}
          {showAddForm && (
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
              <YStack space="$3">
                <Text color="$color" fontSize={15} fontWeight="800">Add New Custom Service</Text>
                
                <YStack space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Service Name *</Text>
                  <Input
                    placeholder="e.g. Mid-Week Revival, Youth Service"
                    value={name}
                    onChangeText={setName}
                    backgroundColor="$background"
                    borderColor="$borderColor"
                  />
                </YStack>

                <YStack space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Description</Text>
                  <Input
                    placeholder="Optional details"
                    value={description}
                    onChangeText={setDescription}
                    backgroundColor="$background"
                    borderColor="$borderColor"
                  />
                </YStack>

                <XStack space="$2">
                  <YStack flex={1} space="$1">
                    <Text color="$colorPress" fontSize={11} fontWeight="700">Start Time (HH:MM)</Text>
                    <Input value={startTime} onChangeText={setStartTime} placeholder="09:00" backgroundColor="$background" borderColor="$borderColor" />
                  </YStack>
                  <YStack flex={1} space="$1">
                    <Text color="$colorPress" fontSize={11} fontWeight="700">End Time (HH:MM)</Text>
                    <Input value={endTime} onChangeText={setEndTime} placeholder="12:00" backgroundColor="$background" borderColor="$borderColor" />
                  </YStack>
                </XStack>

                <YStack space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Days of Week *</Text>
                  <XStack flexWrap="wrap" space="$1">
                    {DAY_NAMES.map((d, idx) => {
                      const isSelected = selectedDays.includes(idx);
                      return (
                        <TouchableOpacity key={d} onPress={() => handleDayToggle(idx)}>
                          <YStack
                            px="$2.5"
                            py="$1.5"
                            borderRadius="$3"
                            borderWidth={1}
                            borderColor={isSelected ? '#FF9500' : '$borderColor'}
                            backgroundColor={isSelected ? 'rgba(255, 149, 0, 0.15)' : '$background'}
                            marginBottom="$1"
                          >
                            <Text color={isSelected ? '#FF9500' : '$color'} fontSize={12} fontWeight={isSelected ? '800' : '500'}>
                              {d.slice(0, 3)}
                            </Text>
                          </YStack>
                        </TouchableOpacity>
                      );
                    })}
                  </XStack>
                </YStack>

                <Button backgroundColor="#FF9500" onPress={handleAddService} marginTop="$2">
                  <Text color="white" fontWeight="800">Save Custom Service</Text>
                </Button>
              </YStack>
            </Card>
          )}

          {/* List of Custom Services */}
          <YStack space="$2">
            <Text color="$color" fontSize={14} fontWeight="800" textTransform="uppercase" letterSpacing={0.5}>
              Custom Services ({customServices.length})
            </Text>

            {loading ? (
              <Spinner size="large" color="#FF9500" py="$6" />
            ) : customServices.length === 0 ? (
              <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="$borderColor" alignItems="center">
                <Text color="$colorPress" fontSize={13}>No custom services added yet.</Text>
              </Card>
            ) : (
              customServices.map(item => {
                const daysArr: number[] = JSON.parse(item.days_of_week || '[]');
                const daysText = daysArr.map(d => DAY_NAMES[d]?.slice(0, 3)).join(', ');
                const isActive = item.is_active === 1;

                return (
                  <Card key={item.id} p="$3.5" borderRadius="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
                    <XStack justifyContent="space-between" alignItems="flex-start">
                      <YStack flex={1} space="$1">
                        <XStack space="$2" alignItems="center">
                          <Text color="$color" fontSize={15} fontWeight="800">{item.name}</Text>
                          <XStack backgroundColor={isActive ? 'rgba(52, 199, 89, 0.15)' : 'rgba(142, 142, 147, 0.15)'} px="$2" py="$0.5" borderRadius="$2">
                            <Text color={isActive ? '#34C759' : '#8E8E93'} fontSize={10} fontWeight="800">
                              {isActive ? 'Active' : 'Inactive'}
                            </Text>
                          </XStack>
                        </XStack>
                        {item.description && <Text color="$colorPress" fontSize={12}>{item.description}</Text>}
                        <Text color="$colorPress" fontSize={11} fontWeight="600">
                          Time: {item.start_time} - {item.end_time} ({daysText})
                        </Text>
                      </YStack>

                      <XStack space="$2">
                        <TouchableOpacity onPress={() => handleToggle(item.id)}>
                          <YStack px="$2.5" py="$1.5" borderRadius="$3" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
                            <Text color={isActive ? '#FF3B30' : '#34C759'} fontSize={11} fontWeight="700">
                              {isActive ? 'Deactivate' : 'Activate'}
                            </Text>
                          </YStack>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleDelete(item.id, item.name)}>
                          <YStack p="$1.5" borderRadius="$3" backgroundColor="rgba(255, 59, 48, 0.1)">
                            <Trash2 size={16} color="#FF3B30" />
                          </YStack>
                        </TouchableOpacity>
                      </XStack>
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
