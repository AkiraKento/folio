export interface ReminderTime {
  hour: number;
  minute: number;
}

export interface ReminderConfig {
  enabled: boolean;
  time: string; // "HH:mm"
}

export interface NotificationScheduleResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}
