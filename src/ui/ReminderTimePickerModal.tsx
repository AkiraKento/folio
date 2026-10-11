import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import { parseTime, formatTime } from '@/notifications/notificationService';

export interface ReminderTimePickerModalProps {
  visible: boolean;
  currentTime: string;
  onSave: (time: string) => void;
  onClose: () => void;
}

const PRESET_TIMES = ['07:00', '12:30', '18:00', '20:00', '21:30'] as const;

export function ReminderTimePickerModal({
  visible,
  currentTime,
  onSave,
  onClose,
}: ReminderTimePickerModalProps) {
  const { theme } = useTheme();

  const [selectedHour, setSelectedHour] = useState<number>(20);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  useEffect(() => {
    if (visible) {
      const parsed = parseTime(currentTime);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
    }
  }, [visible, currentTime]);

  const incrementHour = () => {
    setSelectedHour((prev) => (prev + 1) % 24);
  };

  const decrementHour = () => {
    setSelectedHour((prev) => (prev - 1 + 24) % 24);
  };

  const incrementMinute = () => {
    setSelectedMinute((prev) => (prev + 5) % 60);
  };

  const decrementMinute = () => {
    setSelectedMinute((prev) => (prev - 5 + 60) % 60);
  };

  const handleApplyPreset = (preset: string) => {
    const parsed = parseTime(preset);
    setSelectedHour(parsed.hour);
    setSelectedMinute(parsed.minute);
  };

  const handleConfirm = () => {
    const formatted = formatTime(selectedHour, selectedMinute);
    onSave(formatted);
    onClose();
  };

  const formattedCurrent = formatTime(selectedHour, selectedMinute);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme.elevated, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.fg }]}>
            {strings.reminder.modalTitle}
          </Text>

          {/* Display Principal do Horário */}
          <View
            style={[
              styles.timeDisplayContainer,
              { backgroundColor: theme.elevated2, borderColor: theme.border },
            ]}
          >
            {/* Coluna da Hora */}
            <View style={styles.pickerColumn}>
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={incrementHour}
                accessibilityRole="button"
                accessibilityLabel={strings.reminder.incrementHour}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustIcon, { color: theme.accent }]}>▲</Text>
              </TouchableOpacity>

              <Text style={[styles.timeDigitText, { color: theme.fg }]}>
                {selectedHour.toString().padStart(2, '0')}
              </Text>

              <TouchableOpacity
                style={styles.adjustButton}
                onPress={decrementHour}
                accessibilityRole="button"
                accessibilityLabel={strings.reminder.decrementHour}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustIcon, { color: theme.accent }]}>▼</Text>
              </TouchableOpacity>
              <Text style={[styles.unitLabel, { color: theme.fgMuted }]}>
                {strings.reminder.hourLabel}
              </Text>
            </View>

            <Text style={[styles.timeColon, { color: theme.fgMuted }]}>:</Text>

            {/* Coluna do Minuto */}
            <View style={styles.pickerColumn}>
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={incrementMinute}
                accessibilityRole="button"
                accessibilityLabel={strings.reminder.incrementMinute}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustIcon, { color: theme.accent }]}>▲</Text>
              </TouchableOpacity>

              <Text style={[styles.timeDigitText, { color: theme.fg }]}>
                {selectedMinute.toString().padStart(2, '0')}
              </Text>

              <TouchableOpacity
                style={styles.adjustButton}
                onPress={decrementMinute}
                accessibilityRole="button"
                accessibilityLabel={strings.reminder.decrementMinute}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustIcon, { color: theme.accent }]}>▼</Text>
              </TouchableOpacity>
              <Text style={[styles.unitLabel, { color: theme.fgMuted }]}>
                {strings.reminder.minuteLabel}
              </Text>
            </View>
          </View>

          {/* Horários Sugeridos / Presets */}
          <Text style={[styles.presetTitle, { color: theme.fgMuted }]}>
            {strings.reminder.presetTimesTitle}
          </Text>
          <View style={styles.presetsRow}>
            {PRESET_TIMES.map((preset) => {
              const isSelected = formattedCurrent === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetBadge,
                    isSelected
                      ? { backgroundColor: theme.accent }
                      : { backgroundColor: theme.elevated2, borderColor: theme.border },
                  ]}
                  onPress={() => handleApplyPreset(preset)}
                  accessibilityRole="button"
                  accessibilityLabel={strings.reminder.presetSelect(preset)}
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetBadgeText,
                      {
                        color: isSelected ? '#ffffff' : theme.fg,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {preset}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: theme.border },
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={strings.reminder.cancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: theme.fgMuted }]}>
                {strings.reminder.cancel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.accent },
              ]}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={strings.reminder.saveTime}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {strings.reminder.saveTime}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  timeDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  pickerColumn: {
    alignItems: 'center',
    width: 80,
  },
  adjustButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeDigitText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
    marginVertical: 4,
  },
  unitLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  timeColon: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
    marginHorizontal: 8,
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetBadge: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBadgeText: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1.4,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
