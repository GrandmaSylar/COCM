import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  H2, 
  Input, 
  Button, 
  Spinner 
} from 'tamagui';
import { Check, ArrowLeft, MapPin } from '@tamagui/lucide-icons';
import { supabase } from '../../lib/supabase';
import { upsertLocalVisitor } from '../../lib/db';
import { getChurchZones } from '../../lib/options';
import { enqueueSyncTask } from '../../lib/syncEngine';
import { generateUUID } from '../../lib/uuid';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppHeader } from '../../components/AppHeader';

export default function AddVisitorScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [residence, setResidence] = useState('');
  const [potentialZone, setPotentialZone] = useState('A');
  const [zonesList, setZonesList] = useState<string[]>(['A', 'B', 'F', 'K', 'M', 'R']);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getChurchZones().then(z => {
      if (z.length > 0) setZonesList(z);
    }).catch(err => console.warn('Error fetching zones in AddVisitor:', err));
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter the visitor name.');
      return;
    }

    setSubmitting(true);
    try {
      const newId = generateUUID();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // 1. Instant 0ms SQLite local write
      await upsertLocalVisitor({
        id: newId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        visit_date: visitDate || today,
        potential_zone: potentialZone,
        follow_up_status: 'pending',
        notes: notes.trim() || undefined,
        raw_json: JSON.stringify({ residence: residence.trim() }),
        created_at: now
      });

      // 2. Outbox & Live Sync
      const payload = {
        id: newId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        residence: residence.trim() || undefined,
        potential_zone: potentialZone,
        visit_date: visitDate || today,
        created_at: now
      };

      try {
        const { error } = await supabase.from('visitors').insert(payload);
        if (error) {
          console.warn('Supabase visitor insert failed, queuing to sync_queue:', error);
          await enqueueSyncTask({
            operation: 'INSERT',
            table_name: 'visitors',
            payload
          });
        }
      } catch (netErr) {
        await enqueueSyncTask({
          operation: 'INSERT',
          table_name: 'visitors',
          payload
        });
      }

      Alert.alert('Success', 'Visitor registered successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err) {
      console.error('Failed adding visitor:', err);
      Alert.alert('Error', 'Failed to save visitor record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Add Visitor"
        subtitle="Log First-Time Church Guest"
        showBack
        backTitle="Visitors"
        rightElement={
          <Button 
            size="$3" 
            backgroundColor="#34C759" 
            borderRadius="$3"
            onPress={handleSubmit}
            disabled={submitting}
            icon={submitting ? <Spinner size="small" color="#FFFFFF" /> : <Check size={14} color="#FFFFFF" />}
            pressStyle={{ scale: 0.98 }}
          >
            <Text color="#FFFFFF" fontWeight="700" fontSize={13}>{submitting ? 'Saving...' : 'Save'}</Text>
          </Button>
        }
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <YStack space="$4">
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            elevate
          >
            <YStack space="$4">
              <YStack space="$1.5">
              <Text color="$color" fontSize={13} fontWeight="700">Visitor Full Name *</Text>
              <Input
                placeholder="e.g. Mary Mensah"
                value={name}
                onChangeText={setName}
                backgroundColor="$background"
                borderColor="$borderColor"
                borderRadius="$4"
              />
            </YStack>

            <YStack space="$1.5">
              <NativeDatePicker
                label="Visit Date (YYYY-MM-DD)"
                value={visitDate}
                onChange={setVisitDate}
                accentColor="#34C759"
              />
            </YStack>

            <YStack space="$1.5">
              <Text color="$color" fontSize={13} fontWeight="700">Phone Number</Text>
              <Input
                placeholder="e.g. 0551234567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                backgroundColor="$background"
                borderColor="$borderColor"
                borderRadius="$4"
              />
            </YStack>

            <YStack space="$1.5">
              <Text color="$color" fontSize={13} fontWeight="700">Email Address</Text>
              <Input
                placeholder="e.g. visitor@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                backgroundColor="$background"
                borderColor="$borderColor"
                borderRadius="$4"
              />
            </YStack>

            <YStack space="$1.5">
              <Text color="$color" fontSize={13} fontWeight="700">Residence / Location</Text>
              <Input
                placeholder="e.g. Mataheko, Accra"
                value={residence}
                onChangeText={setResidence}
                backgroundColor="$background"
                borderColor="$borderColor"
                borderRadius="$4"
              />
            </YStack>

            <YStack space="$1.5">
              <Text color="$color" fontSize={13} fontWeight="700">Potential Zone</Text>
              <XStack space="$2" flexWrap="wrap">
                {zonesList.map(z => (
                  <TouchableOpacity
                    key={z}
                    onPress={() => setPotentialZone(z)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: potentialZone === z ? '#34C759' : 'rgba(142,142,147,0.12)',
                      marginBottom: 6
                    }}
                  >
                    <Text color={potentialZone === z ? '#FFFFFF' : '$color'} fontSize={13} fontWeight="700">
                      Zone {z}
                    </Text>
                  </TouchableOpacity>
                ))}
              </XStack>
            </YStack>

            <YStack space="$1.5">
              <Text color="$color" fontSize={13} fontWeight="700">Follow-up Notes</Text>
              <Input
                placeholder="e.g. First time visitor, invited by Deacon Kwame"
                value={notes}
                onChangeText={setNotes}
                backgroundColor="$background"
                borderColor="$borderColor"
                borderRadius="$4"
              />
            </YStack>

            <Button
              marginTop="$2"
              height={48}
              backgroundColor="#34C759"
              borderRadius="$4"
              onPress={handleSubmit}
              disabled={submitting}
              icon={submitting ? <Spinner color="#FFFFFF" /> : <Check size={18} color="#FFFFFF" />}
            >
              <Text color="#FFFFFF" fontWeight="800" fontSize={15}>
                {submitting ? 'Saving...' : 'Save Visitor'}
              </Text>
            </Button>
          </YStack>
        </Card>
      </YStack>
    </ScrollView>
  </YStack>
);
}
