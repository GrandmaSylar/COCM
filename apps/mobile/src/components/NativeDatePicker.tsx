import React, { useState } from 'react';
import { Platform, Modal, TouchableOpacity } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { YStack, XStack, Text, Input, Button } from 'tamagui';
import { Calendar, Check, X } from '@tamagui/lucide-icons';

export interface NativeDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  maxDate?: Date;
  minDate?: Date;
  accentColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}

export function NativeDatePicker({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  label,
  required = false,
  maxDate,
  minDate,
  accentColor = '#FF9500',
  backgroundColor = '$background',
  borderColor = '$borderColor'
}: NativeDatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => {
    if (value && !isNaN(new Date(value + 'T00:00:00').getTime())) {
      return new Date(value + 'T00:00:00');
    }
    return new Date();
  });

  const parseCurrentDate = (): Date => {
    if (value && !isNaN(new Date(value + 'T00:00:00').getTime())) {
      return new Date(value + 'T00:00:00');
    }
    return new Date();
  };

  const handleOpenPicker = () => {
    const d = parseCurrentDate();
    setTempDate(d);
    setShowPicker(true);
  };

  const formatDateToString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && selectedDate) {
      onChange(formatDateToString(selectedDate));
    }
  };

  const handleIosDone = () => {
    onChange(formatDateToString(tempDate));
    setShowPicker(false);
  };

  return (
    <YStack space="$1.5">
      {label ? (
        <Text color="$colorPress" fontSize={12} fontWeight="600">
          {label} {required ? '*' : ''}
        </Text>
      ) : null}

      <XStack
        alignItems="center"
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        borderWidth={1}
        borderRadius="$3"
        px="$2.5"
        height={42}
      >
        <Input
          flex={1}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          backgroundColor="transparent"
          borderWidth={0}
          height={40}
          fontSize={13}
          color="$color"
        />

        <TouchableOpacity
          onPress={handleOpenPicker}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 6,
            backgroundColor: `${accentColor}1A`,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4
          }}
        >
          <Calendar size={16} color={accentColor} />
          <Text color={accentColor} fontSize={11} fontWeight="700">
            Select
          </Text>
        </TouchableOpacity>
      </XStack>

      {/* Android Native Picker */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={parseCurrentDate()}
          mode="date"
          display="default"
          maximumDate={maxDate}
          minimumDate={minDate}
          onValueChange={(_, d) => {
            setShowPicker(false);
            if (d) onChange(formatDateToString(d));
          }}
          onDismiss={() => setShowPicker(false)}
        />
      )}

      {/* iOS Native Picker Modal */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPicker(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end'
            }}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          >
            <YStack
              backgroundColor="$background"
              borderTopLeftRadius={20}
              borderTopRightRadius={20}
              paddingBottom="$6"
              paddingTop="$3"
              paddingHorizontal="$4"
              onStartShouldSetResponder={() => true}
            >
              {/* Header Bar */}
              <XStack justifyContent="space-between" alignItems="center" py="$2">
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <XStack space="$1" alignItems="center">
                    <X size={16} color="$colorPress" />
                    <Text color="$colorPress" fontSize={14} fontWeight="600">Cancel</Text>
                  </XStack>
                </TouchableOpacity>

                <Text color="$color" fontSize={15} fontWeight="700">Select Date</Text>

                <TouchableOpacity onPress={handleIosDone}>
                  <XStack space="$1" alignItems="center">
                    <Check size={16} color={accentColor} />
                    <Text color={accentColor} fontSize={14} fontWeight="700">Done</Text>
                  </XStack>
                </TouchableOpacity>
              </XStack>

              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                maximumDate={maxDate}
                minimumDate={minDate}
                onValueChange={(_, d) => {
                  if (d) setTempDate(d);
                }}
                style={{ height: 180 }}
              />
            </YStack>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Web Fallback (if running in Expo web preview) */}
      {Platform.OS === 'web' && showPicker && (
        React.createElement('input', {
          type: 'date',
          value: value,
          onChange: (e: any) => {
            onChange(e.target.value);
            setShowPicker(false);
          },
          max: maxDate ? formatDateToString(maxDate) : undefined,
          min: minDate ? formatDateToString(minDate) : undefined,
          style: {
            padding: 8,
            borderRadius: 6,
            border: '1px solid #334155',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            fontSize: 14,
            marginTop: 4
          }
        })
      )}
    </YStack>
  );
}
