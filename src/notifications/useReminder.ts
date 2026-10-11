import { useState, useCallback, useEffect } from 'react';
import { SettingsRepository } from '@/db/repositories/settings';
import { getDb, type FolioDatabase } from '@/db/client';
import { strings } from '@/ui/strings';
import {
  parseTime,
  formatTime,
  scheduleDailyReminder,
  cancelDailyReminder,
  sendTestNotification,
  hasNotificationPermission,
} from './notificationService';

export interface UseReminderOptions {
  db?: FolioDatabase;
  onNotificationSent?: (message: string) => void;
  onError?: (error: string) => void;
}

export function useReminder(options?: UseReminderOptions) {
  const database = options?.db ?? getDb();
  const [settingsRepo] = useState(() => new SettingsRepository(database));

  const [enabled, setEnabled] = useState<boolean>(
    () => settingsRepo.get<boolean>('dailyReminderEnabled') ?? false
  );
  const [time, setTime] = useState<string>(
    () => settingsRepo.get<string>('dailyReminderTime') ?? '20:00'
  );
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Verifica status atual da permissão
  useEffect(() => {
    hasNotificationPermission().then(setPermissionGranted);
  }, []);

  const toggleReminder = useCallback(
    async (targetEnabled: boolean) => {
      setIsLoading(true);
      setError(null);

      try {
        if (targetEnabled) {
          const { hour, minute } = parseTime(time);
          const result = await scheduleDailyReminder(hour, minute);

          if (!result.success) {
            const err = result.error ?? strings.reminder.permissionDenied;
            setError(err);
            options?.onError?.(err);
            setIsLoading(false);
            return false;
          }

          settingsRepo.set<boolean>('dailyReminderEnabled', true);
          setEnabled(true);
          setPermissionGranted(true);
          options?.onNotificationSent?.(strings.reminder.reminderScheduled(time));
          setIsLoading(false);
          return true;
        } else {
          await cancelDailyReminder();
          settingsRepo.set<boolean>('dailyReminderEnabled', false);
          setEnabled(false);
          options?.onNotificationSent?.(strings.reminder.reminderDisabled);
          setIsLoading(false);
          return true;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        options?.onError?.(errorMsg);
        setIsLoading(false);
        return false;
      }
    },
    [options, settingsRepo, time]
  );

  const updateTime = useCallback(
    async (newTime: string) => {
      const { hour, minute } = parseTime(newTime);
      const formatted = formatTime(hour, minute);

      setTime(formatted);
      settingsRepo.set<string>('dailyReminderTime', formatted);

      // Se o lembrete estiver ativo, reagenda para o novo horário
      if (enabled) {
        setIsLoading(true);
        const result = await scheduleDailyReminder(hour, minute);
        setIsLoading(false);

        if (!result.success) {
          const err = result.error ?? strings.reminder.permissionDenied;
          setError(err);
          options?.onError?.(err);
          return false;
        }

        options?.onNotificationSent?.(strings.reminder.reminderScheduled(formatted));
      }

      return true;
    },
    [enabled, options, settingsRepo]
  );

  const triggerTestNotification = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await sendTestNotification();
    setIsLoading(false);

    if (result.success) {
      options?.onNotificationSent?.(strings.reminder.testNotificationSent);
      return true;
    } else {
      const err = result.error ?? strings.reminder.permissionDenied;
      setError(err);
      options?.onError?.(err);
      return false;
    }
  }, [options]);

  return {
    enabled,
    time,
    permissionGranted,
    isLoading,
    error,
    toggleReminder,
    updateTime,
    triggerTestNotification,
  };
}
