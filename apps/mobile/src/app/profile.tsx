import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, H2, Paragraph, Button, Spinner, Avatar } from 'tamagui';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setProfile({
            name: session.user.user_metadata?.name || 'Administrator',
            email: session.user.email || '',
            role: session.user.user_metadata?.role || 'Admin',
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    try {
      await api.auth.signOut();
      await supabase.auth.signOut();
      router.replace('/');
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="$primary" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" padding="$5" space="$5">
      {/* Header card with Avatar */}
      <Card 
        padding="$5" 
        borderRadius="$5" 
        backgroundColor="$cardBackground" 
        borderColor="$borderColor"
        borderWidth={1}
        alignItems="center"
        elevate
      >
        <Avatar circular size="$6" marginBottom="$3">
          <Avatar.Image src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" />
          <Avatar.Fallback bc="$primary" />
        </Avatar>
        <H2 color="$color" fontWeight="800" fontSize={22}>{profile?.name}</H2>
        <Paragraph color="$colorPress" fontSize={14}>{profile?.email}</Paragraph>
        <YStack backgroundColor="rgba(0, 122, 255, 0.1)" px="$3" py="$1" borderRadius="$5" marginTop="$2">
          <Text color="#007AFF" fontSize={12} fontWeight="700" textTransform="uppercase">
            {profile?.role}
          </Text>
        </YStack>
      </Card>

      {/* Settings list */}
      <YStack space="$3" flex={1}>
        <Text color="$color" fontSize={16} fontWeight="700" paddingLeft="$2">Account Actions</Text>
        
        {/* Logout Button */}
        <Button 
          theme="red"
          backgroundColor="#FF3B30"
          height={48}
          borderRadius="$3"
          onPress={handleSignOut}
          pressStyle={{ scale: 0.98 }}
        >
          <Text color="#FFFFFF" fontWeight="700" fontSize={15}>Sign Out</Text>
        </Button>

        {/* Close/Back Button */}
        <Button 
          variant="outlined"
          height={48}
          borderRadius="$3"
          borderColor="$borderColor"
          onPress={() => router.back()}
          pressStyle={{ scale: 0.98 }}
        >
          <Text color="$color" fontWeight="600" fontSize={15}>Back to Dashboard</Text>
        </Button>
      </YStack>
    </YStack>
  );
}
