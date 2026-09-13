import React, { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Alert as RNAlert } from 'react-native';
import { YStack, XStack, Text, Card, Button, Input, Spinner } from 'tamagui';
import { ArrowLeft, Users, Calendar, Clock, Save, Info } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getLocalCustomServices,
  upsertLocalAttendanceRecord,
  LocalAttendanceRecord
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { enqueueSyncTask, syncCustomServices } from '../../lib/syncEngine';

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function RecordGeneralAttendanceScreen() {
  const router = useRouter();

  const [serviceType, setServiceType] = useState(SUNDAY_MAIN_SERVICE);
  const [availableServices, setAvailableServices] = useState<string[]>([SUNDAY_MAIN_SERVICE]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('13:00');

  // Demographic headcount breakdown
  const [menCount, setMenCount] = useState('0');
  const [womenCount, setWomenCount] = useState('0');
  const [childrenCount, setChildrenCount] = useState('0');
  const [visitorsCount, setVisitorsCount] = useState('0');
  const [totalCount, setTotalCount] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadServices() {
      try {
        await syncCustomServices().catch(() => {});
        const customSvcs = await getLocalCustomServices();
        const activeCustomNames = customSvcs
          .filter(s => s.is_active === 1 && s.name !== SUNDAY_MAIN_SERVICE)
          .map(s => s.name);
        setAvailableServices(Array.from(new Set([SUNDAY_MAIN_SERVICE, ...activeCustomNames])));
      } catch (err) {
        console.error('Failed to load custom services:', err);
      }
    }
    loadServices();
  }, []);

  // Recalculate suggested total when breakdown numbers change
  const handleBreakdownChange = (field: 'men' | 'women' | 'children' | 'visitors', val: string) => {
    const num = parseInt(val) || 0;
    let m = field === 'men' ? num : parseInt(menCount) || 0;
    let w = field === 'women' ? num : parseInt(womenCount) || 0;
    let c = field === 'children' ? num : parseInt(childrenCount) || 0;
    let v = field === 'visitors' ? num : parseInt(visitorsCount) || 0;

    if (field === 'men') setMenCount(val);
    if (field === 'women') setWomenCount(val);
    if (field === 'children') setChildrenCount(val);
    if (field === 'visitors') setVisitorsCount(val);

    const calcSum = m + w + c + v;
    if (calcSum > 0) {
      setTotalCount(calcSum.toString());
    }
  };

  const handleSave = async () => {
    const tot = parseInt(totalCount);
    if (!serviceType || isNaN(tot) || tot <= 0) {
      RNAlert.alert('Validation Error', 'Please select a service type and enter a total attendance count.');
      return;
    }

    setLoading(true);
    try {
      const rec: LocalAttendanceRecord = {
        id: generateUUID(),
        date,
        service_type: serviceType,
        start_time: startTime,
        end_time: endTime,
        total_count: tot,
        is_custom_service: serviceType !== SUNDAY_MAIN_SERVICE ? 1 : 0,
        status: 'finalized',
        attendance_type: 'general',
        men_count: parseInt(menCount) || 0,
        women_count: parseInt(womenCount) || 0,
        children_count: parseInt(childrenCount) || 0,
        visitors_count: parseInt(visitorsCount) || 0,
        created_at: new Date().toISOString(),
      };

      await upsertLocalAttendanceRecord(rec);
      await enqueueSyncTask('INSERT', '/attendance', rec);

      RNAlert.alert('Success', `Head count recorded for ${serviceType}! Total: ${tot}`, [
        { text: 'OK', onPress: () => router.push('/attendance' as any) }
      ]);
    } catch (err) {
      console.error('Failed to save general headcount record:', err);
      RNAlert.alert('Error', 'Failed to save head count. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'left', 'right']}>
      <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack px="$4" py="$3" alignItems="center" space="$2" borderBottomWidth={1} borderColor="$borderColor">
        <TouchableOpacity onPress={() => router.back()}>
          <YStack p="$2" borderRadius="$3" backgroundColor="$borderColor" opacity={0.8}>
            <ArrowLeft size={18} color="$color" />
          </YStack>
        </TouchableOpacity>
        <YStack>
          <Text color="$color" fontSize={18} fontWeight="800">Record General Attendance</Text>
          <Text color="$colorPress" fontSize={12}>Record head count for today's service</Text>
        </YStack>
      </XStack>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack space="$4">

          {/* Info Banner */}
          <Card p="$3.5" borderRadius="$4" borderWidth={1} borderColor="rgba(0, 122, 255, 0.3)" backgroundColor="rgba(0, 122, 255, 0.05)">
            <XStack space="$2.5" alignItems="center">
              <Info size={20} color="#007AFF" />
              <Text color="$color" fontSize={12} flex={1}>
                This records total head count only. To mark individual member attendance and affect member statuses, use <Text fontWeight="800">Mark Individual Attendance</Text>.
              </Text>
            </XStack>
          </Card>

          {/* Form */}
          <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
            <YStack space="$3.5">
              <Text color="$color" fontSize={15} fontWeight="800">Service Information</Text>

              {/* Service Type Picker */}
              <YStack space="$1.5">
                <Text color="$colorPress" fontSize={11} fontWeight="700">Service Type *</Text>
                <XStack flexWrap="wrap" space="$1.5">
                  {availableServices.map(st => {
                    const isSelected = serviceType === st;
                    return (
                      <TouchableOpacity key={st} onPress={() => setServiceType(st)}>
                        <YStack
                          px="$3"
                          py="$2"
                          borderRadius="$3"
                          borderWidth={1}
                          borderColor={isSelected ? '#FF9500' : '$borderColor'}
                          backgroundColor={isSelected ? 'rgba(255, 149, 0, 0.15)' : '$background'}
                        >
                          <Text color={isSelected ? '#FF9500' : '$color'} fontSize={13} fontWeight={isSelected ? '800' : '600'}>
                            {st}
                          </Text>
                        </YStack>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>
              </YStack>

              {/* Date */}
              <YStack space="$1">
                <Text color="$colorPress" fontSize={11} fontWeight="700">Date (YYYY-MM-DD) *</Text>
                <Input value={date} onChangeText={setDate} backgroundColor="$background" borderColor="$borderColor" />
              </YStack>

              {/* Time */}
              <XStack space="$2">
                <YStack flex={1} space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Start Time</Text>
                  <Input value={startTime} onChangeText={setStartTime} backgroundColor="$background" borderColor="$borderColor" />
                </YStack>
                <YStack flex={1} space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">End Time</Text>
                  <Input value={endTime} onChangeText={setEndTime} backgroundColor="$background" borderColor="$borderColor" />
                </YStack>
              </XStack>

              {/* Demographic Breakdown Fields */}
              <Text color="$color" fontSize={14} fontWeight="800" marginTop="$2">Head Count Breakdown</Text>
              
              <XStack space="$2">
                <YStack flex={1} space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Men</Text>
                  <Input keyboardType="numeric" value={menCount} onChangeText={v => handleBreakdownChange('men', v)} backgroundColor="$background" borderColor="$borderColor" />
                </YStack>
                <YStack flex={1} space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Women</Text>
                  <Input keyboardType="numeric" value={womenCount} onChangeText={v => handleBreakdownChange('women', v)} backgroundColor="$background" borderColor="$borderColor" />
                </YStack>
              </XStack>

              <XStack space="$2">
                <YStack flex={1} space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Children</Text>
                  <Input keyboardType="numeric" value={childrenCount} onChangeText={v => handleBreakdownChange('children', v)} backgroundColor="$background" borderColor="$borderColor" />
                </YStack>
                <YStack flex={1} space="$1">
                  <Text color="$colorPress" fontSize={11} fontWeight="700">Visitors</Text>
                  <Input keyboardType="numeric" value={visitorsCount} onChangeText={v => handleBreakdownChange('visitors', v)} backgroundColor="$background" borderColor="$borderColor" />
                </YStack>
              </XStack>

              {/* Total Count */}
              <YStack space="$1" marginTop="$1">
                <Text color="$colorPress" fontSize={12} fontWeight="800">Total Attendance Count *</Text>
                <Input
                  keyboardType="numeric"
                  placeholder="Enter total headcount"
                  value={totalCount}
                  onChangeText={setTotalCount}
                  backgroundColor="$background"
                  borderColor="#FF9500"
                  borderWidth={2}
                  fontSize={16}
                  fontWeight="800"
                />
              </YStack>

              <Button backgroundColor="#FF9500" onPress={handleSave} disabled={loading} marginTop="$3" size="$4">
                {loading ? <Spinner color="white" /> : (
                  <XStack space="$2" alignItems="center">
                    <Save size={18} color="white" />
                    <Text color="white" fontWeight="800" fontSize={14}>Save Head Count</Text>
                  </XStack>
                )}
              </Button>
            </YStack>
          </Card>

        </YStack>
      </ScrollView>
    </YStack>
    </SafeAreaView>
  );
}
