import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { strings } from '@/ui/strings';
import type { ReminderTime, NotificationScheduleResult } from './types';

export const DAILY_REMINDER_CHANNEL_ID = 'daily-reminder';
export const DAILY_REMINDER_NOTIFICATION_TAG = 'folio_daily_reminder';
export const DEFAULT_REMINDER_HOUR = 20;
export const DEFAULT_REMINDER_MINUTE = 0;

/**
 * Converte string no formato "HH:mm" em objeto { hour, minute }.
 * Retorna o padrão 20:00 se a string for inválida.
 */
export function parseTime(timeStr: string): ReminderTime {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  }

  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) {
    return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  }

  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);

  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  }

  return { hour, minute };
}

/**
 * Formata hora e minuto no formato "HH:mm" com zero à esquerda.
 */
export function formatTime(hour: number, minute: number): string {
  const clampedHour = Math.max(0, Math.min(23, Math.floor(hour)));
  const clampedMinute = Math.max(0, Math.min(59, Math.floor(minute)));

  const hStr = clampedHour.toString().padStart(2, '0');
  const mStr = clampedMinute.toString().padStart(2, '0');

  return `${hStr}:${mStr}`;
}

/**
 * Inicializa os handlers globais de notificação e o canal do Android.
 */
export async function setupNotifications(): Promise<void> {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DAILY_REMINDER_CHANNEL_ID, {
        name: strings.reminder.channelName,
        description: strings.reminder.channelDescription,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3a9d7f',
        sound: 'default',
      });
    }
  } catch (error) {
    console.warn('Erro ao configurar handlers de notificação:', error);
  }
}

/**
 * Verifica se a permissão para notificações já está concedida.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Solicita permissão ao usuário para exibir notificações.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status === 'granted') {
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Cancela todos os lembretes diários previamente agendados pelo Folio.
 */
export async function cancelDailyReminder(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.content?.data?.tag === DAILY_REMINDER_NOTIFICATION_TAG) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
  } catch (error) {
    console.warn('Erro ao cancelar lembretes diários:', error);
  }
}

/**
 * Agenda o lembrete diário para o horário informado.
 */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  pendingCardsCount?: number
): Promise<NotificationScheduleResult> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: strings.reminder.permissionDenied,
      };
    }

    // Cancela agendamentos anteriores para evitar duplicatas
    await cancelDailyReminder();

    const body =
      typeof pendingCardsCount === 'number' && pendingCardsCount > 0
        ? strings.reminder.notificationBodyWithCards(pendingCardsCount)
        : strings.reminder.notificationBodyDefault;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.reminder.notificationTitle,
        body,
        sound: true,
        data: { tag: DAILY_REMINDER_NOTIFICATION_TAG },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: DAILY_REMINDER_CHANNEL_ID,
      },
    });

    return {
      success: true,
      notificationId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Dispara uma notificação imediata de teste para validação no aparelho.
 */
export async function sendTestNotification(): Promise<NotificationScheduleResult> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: strings.reminder.permissionDenied,
      };
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.reminder.testNotificationTitle,
        body: strings.reminder.testNotificationBody,
        sound: true,
        data: { tag: 'test_notification' },
      },
      trigger: {
        channelId: DAILY_REMINDER_CHANNEL_ID,
      },
    });

    return {
      success: true,
      notificationId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
