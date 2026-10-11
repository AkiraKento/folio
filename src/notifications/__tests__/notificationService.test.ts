import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  parseTime,
  formatTime,
  setupNotifications,
  hasNotificationPermission,
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
  sendTestNotification,
  DAILY_REMINDER_CHANNEL_ID,
  DAILY_REMINDER_NOTIFICATION_TAG,
} from '../notificationService';

// Mock do expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('test-notification-id-123'),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
  },
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    MAX: 5,
  },
}));

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseTime e formatTime', () => {
    it('faz parse correto de horários válidos no formato HH:mm', () => {
      expect(parseTime('20:00')).toEqual({ hour: 20, minute: 0 });
      expect(parseTime('08:30')).toEqual({ hour: 8, minute: 30 });
      expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
      expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 });
      expect(parseTime('00:00')).toEqual({ hour: 0, minute: 0 });
    });

    it('retorna fallback padrão (20:00) para horários inválidos', () => {
      expect(parseTime('')).toEqual({ hour: 20, minute: 0 });
      expect(parseTime('invalido')).toEqual({ hour: 20, minute: 0 });
      expect(parseTime('24:00')).toEqual({ hour: 20, minute: 0 });
      expect(parseTime('20:60')).toEqual({ hour: 20, minute: 0 });
      expect(parseTime('-5:30')).toEqual({ hour: 20, minute: 0 });
      expect(parseTime('12:abc')).toEqual({ hour: 20, minute: 0 });
    });

    it('formata horários com dois dígitos preenchidos com zero', () => {
      expect(formatTime(20, 0)).toBe('20:00');
      expect(formatTime(8, 5)).toBe('08:05');
      expect(formatTime(0, 0)).toBe('00:00');
      expect(formatTime(23, 59)).toBe('23:59');
    });

    it('ajusta limites fora de faixa na formatação', () => {
      expect(formatTime(25, 65)).toBe('23:59');
      expect(formatTime(-1, -10)).toBe('00:00');
    });
  });

  describe('setupNotifications', () => {
    it('registra o handler de notificação', async () => {
      await setupNotifications();
      expect(Notifications.setNotificationHandler).toHaveBeenCalled();
    });

    it('cria o canal no Android', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

      try {
        await setupNotifications();
        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
          DAILY_REMINDER_CHANNEL_ID,
          expect.objectContaining({
            name: expect.any(String),
            importance: Notifications.AndroidImportance.HIGH,
          })
        );
      } finally {
        Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
      }
    });
  });

  describe('permissões', () => {
    it('retorna true em hasNotificationPermission quando permissão está concedida', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      const granted = await hasNotificationPermission();
      expect(granted).toBe(true);
    });

    it('retorna false em hasNotificationPermission quando permissão não está concedida', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      const granted = await hasNotificationPermission();
      expect(granted).toBe(false);
    });

    it('solicita permissão se ainda não foi concedida', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'undetermined',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      const granted = await requestNotificationPermission();
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
      expect(granted).toBe(true);
    });

    it('retorna false quando o usuário recusa a solicitação', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const granted = await requestNotificationPermission();
      expect(granted).toBe(false);
    });
  });

  describe('scheduleDailyReminder e cancelDailyReminder', () => {
    it('agenda notificação diária com trigger repetitivo', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([]);

      const result = await scheduleDailyReminder(20, 30);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('test-notification-id-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            data: expect.objectContaining({ tag: DAILY_REMINDER_NOTIFICATION_TAG }),
          }),
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 20,
            minute: 30,
            channelId: DAILY_REMINDER_CHANNEL_ID,
          }),
        })
      );
    });

    it('cancela lembretes diários existentes antes de agendar novo', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'old-reminder-1',
          content: { data: { tag: DAILY_REMINDER_NOTIFICATION_TAG } },
          trigger: {},
        },
        {
          identifier: 'other-notification',
          content: { data: { tag: 'other' } },
          trigger: {},
        },
      ]);

      await scheduleDailyReminder(19, 0);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'old-reminder-1'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'other-notification'
      );
    });

    it('retorna erro se a permissão for negada ao tentar agendar', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const result = await scheduleDailyReminder(20, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('permite incluir quantidade de cards pendentes no corpo da notificação', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([]);

      await scheduleDailyReminder(21, 0, 15);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: expect.stringContaining('15 cards pendentes'),
          }),
        })
      );
    });

    it('cancela todos os lembretes diários com a tag do Folio', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'reminder-a',
          content: { data: { tag: DAILY_REMINDER_NOTIFICATION_TAG } },
          trigger: {},
        },
        {
          identifier: 'unrelated',
          content: { data: {} },
          trigger: {},
        },
      ]);

      await cancelDailyReminder();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-a');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('unrelated');
    });
  });

  describe('sendTestNotification', () => {
    it('dispara notificação de teste imediata com trigger null', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      const result = await sendTestNotification();

      expect(result.success).toBe(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: expect.any(String),
            body: expect.any(String),
          }),
          trigger: expect.objectContaining({
            channelId: DAILY_REMINDER_CHANNEL_ID,
          }),
        })
      );
    });
  });
});
