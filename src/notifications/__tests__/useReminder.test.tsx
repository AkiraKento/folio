import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { useReminder, type UseReminderOptions } from '../useReminder';
import * as notificationService from '../notificationService';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { SettingsRepository } from '@/db/repositories/settings';
import type { FolioDatabase } from '@/db/client';

// Mock do notificationService
jest.mock('../notificationService', () => {
  const actual = jest.requireActual('../notificationService');
  return {
    ...actual,
    scheduleDailyReminder: jest.fn().mockResolvedValue({ success: true, notificationId: 'test-id' }),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
    sendTestNotification: jest.fn().mockResolvedValue({ success: true, notificationId: 'test-id' }),
    hasNotificationPermission: jest.fn().mockResolvedValue(true),
    requestNotificationPermission: jest.fn().mockResolvedValue(true),
  };
});

function TestReminderHookComponent({
  options,
  onHook,
}: {
  options?: UseReminderOptions;
  onHook: (data: ReturnType<typeof useReminder>) => void;
}) {
  const result = useReminder(options);
  onHook(result);
  return <Text testID="rendered">Loaded</Text>;
}

describe('useReminder hook', () => {
  let db: FolioDatabase;
  let settingsRepo: SettingsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    const testDb = createTestDatabase();
    db = testDb.db;
    settingsRepo = new SettingsRepository(db);
  });

  it('inicia com os valores padrão quando não há configurações salvas', async () => {
    let hookData!: ReturnType<typeof useReminder>;

    await act(async () => {
      ReactTestRenderer.create(
        <TestReminderHookComponent
          options={{ db }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    expect(hookData.enabled).toBe(false);
    expect(hookData.time).toBe('20:00');
  });

  it('carrega valores persistidos nas configurações', async () => {
    settingsRepo.set('dailyReminderEnabled', true);
    settingsRepo.set('dailyReminderTime', '21:15');

    let hookData!: ReturnType<typeof useReminder>;

    await act(async () => {
      ReactTestRenderer.create(
        <TestReminderHookComponent
          options={{ db }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    expect(hookData.enabled).toBe(true);
    expect(hookData.time).toBe('21:15');
  });

  it('ativa o lembrete e persiste a configuração quando toggleReminder(true) é chamado', async () => {
    const onSent = jest.fn();
    let hookData!: ReturnType<typeof useReminder>;

    await act(async () => {
      ReactTestRenderer.create(
        <TestReminderHookComponent
          options={{ db, onNotificationSent: onSent }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    let success = false;
    await act(async () => {
      success = await hookData.toggleReminder(true);
    });

    expect(success).toBe(true);
    expect(hookData.enabled).toBe(true);
    expect(notificationService.scheduleDailyReminder).toHaveBeenCalledWith(20, 0);
    expect(settingsRepo.get('dailyReminderEnabled')).toBe(true);
    expect(onSent).toHaveBeenCalled();
  });

  it('desativa o lembrete e cancela as notificações quando toggleReminder(false) é chamado', async () => {
    settingsRepo.set('dailyReminderEnabled', true);

    let hookData!: ReturnType<typeof useReminder>;
    await act(async () => {
      ReactTestRenderer.create(
        <TestReminderHookComponent
          options={{ db }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    await act(async () => {
      await hookData.toggleReminder(false);
    });

    expect(hookData.enabled).toBe(false);
    expect(notificationService.cancelDailyReminder).toHaveBeenCalled();
    expect(settingsRepo.get('dailyReminderEnabled')).toBe(false);
  });

  it('trata erro se a permissão for negada ao ativar o lembrete', async () => {
    (notificationService.scheduleDailyReminder as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Permissão negada',
    });

    const onError = jest.fn();
    let hookData!: ReturnType<typeof useReminder>;

    await act(async () => {
      ReactTestRenderer.create(
        <TestReminderHookComponent
          options={{ db, onError }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    let success = false;
    await act(async () => {
      success = await hookData.toggleReminder(true);
    });

    expect(success).toBe(false);
    expect(hookData.enabled).toBe(false);
    expect(hookData.error).toBe('Permissão negada');
    expect(onError).toHaveBeenCalledWith('Permissão negada');
  });

  it('atualiza o horário e reagenda a notificação se o lembrete estiver ativo', async () => {
    settingsRepo.set('dailyReminderEnabled', true);

    let hookData!: ReturnType<typeof useReminder>;
    await act(async () => {
      ReactTestRenderer.create(
        <TestReminderHookComponent
          options={{ db }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    await act(async () => {
      await hookData.updateTime('07:30');
    });

    expect(hookData.time).toBe('07:30');
    expect(settingsRepo.get('dailyReminderTime')).toBe('07:30');
    expect(notificationService.scheduleDailyReminder).toHaveBeenCalledWith(7, 30);
  });

  it('dispara notificação de teste com triggerTestNotification', async () => {
    const onSent = jest.fn();
    let hookData!: ReturnType<typeof useReminder>;

    await act(async () => {
      ReactTestRenderer.create(
        <TestReminderHookComponent
          options={{ db, onNotificationSent: onSent }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    let success = false;
    await act(async () => {
      success = await hookData.triggerTestNotification();
    });

    expect(success).toBe(true);
    expect(notificationService.sendTestNotification).toHaveBeenCalled();
    expect(onSent).toHaveBeenCalled();
  });
});
