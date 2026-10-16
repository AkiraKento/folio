import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SettingsView } from '../SettingsView';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { strings } from '../strings';
import { SettingsRepository, DEFAULT_SETTINGS } from '@/db/repositories/settings';
import * as notificationService from '@/notifications/notificationService';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockWebView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      postMessage: jest.fn(),
    }));

    return React.createElement(View, {
      ...props,
      testID: props.testID || 'mock-webview',
    });
  });

  MockWebView.displayName = 'MockWebView';

  return {
    WebView: MockWebView,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

// Mock do notificationService
jest.mock('@/notifications/notificationService', () => {
  const actual = jest.requireActual('@/notifications/notificationService');
  return {
    ...actual,
    scheduleDailyReminder: jest.fn().mockResolvedValue({ success: true, notificationId: 'test-id' }),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
    sendTestNotification: jest.fn().mockResolvedValue({ success: true, notificationId: 'test-id' }),
    hasNotificationPermission: jest.fn().mockResolvedValue(true),
    requestNotificationPermission: jest.fn().mockResolvedValue(true),
  };
});


describe('SettingsView', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let settingsRepo: SettingsRepository;
  let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    const context = createTestDatabase();
    db = context.db;
    settingsRepo = new SettingsRepository(db);
  });

  afterEach(() => {
    if (activeRenderer) {
      act(() => {
        activeRenderer?.unmount();
      });
      activeRenderer = null;
    }
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test('renderiza seções de backup, tema, lembrete diário e agendamento com textos padronizados', async () => {
    await act(async () => {
      activeRenderer = ReactTestRenderer.create(<SettingsView db={db} />);
    });

    const root = activeRenderer!.root;
    const textNodes = root.findAllByType('Text' as unknown as React.ComponentType);
    const allTexts = textNodes.map((n) => n.props.children).flat().join(' ');

    expect(allTexts).toContain(strings.settings.title);
    expect(allTexts).toContain(strings.settings.backupSectionTitle.toUpperCase());
    expect(allTexts).toContain(strings.settings.themeSectionTitle.toUpperCase());
    expect(allTexts).toContain(strings.reminder.sectionTitle.toUpperCase());
    expect(allTexts).toContain(strings.settings.studySectionTitle.toUpperCase());
    expect(allTexts).toContain(strings.feedback.sectionTitle.toUpperCase());
    expect(allTexts).toContain(strings.feedback.sendButton);
    expect(allTexts).toContain(strings.feedback.privacyNotice);
    expect(allTexts).toContain(strings.settings.exportBackupButton);
    expect(allTexts).toContain(strings.settings.restoreBackupButton);
  });

  test('botão voltar chama callback onBack', async () => {
    const onBackMock = jest.fn();
    await act(async () => {
      activeRenderer = ReactTestRenderer.create(<SettingsView db={db} onBack={onBackMock} />);
    });

    const backButton = activeRenderer!.root.findByProps({
      accessibilityLabel: strings.settings.backButton,
    });
    act(() => {
      backButton.props.onPress();
    });

    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  test('permite alternar modo de botões entre 2 e 4 persistindo no banco', async () => {
    await act(async () => {
      activeRenderer = ReactTestRenderer.create(<SettingsView db={db} />);
    });

    const root = activeRenderer!.root;
    const fourButton = root.findByProps({
      accessibilityLabel: strings.settings.buttonMode4,
    });
    expect(fourButton).toBeDefined();

    act(() => {
      fourButton.props.onPress();
    });

    expect(settingsRepo.get('buttonMode')).toBe(4);
  });

  test('permite ativar e desativar o lembrete diário via switch', async () => {
    await act(async () => {
      activeRenderer = ReactTestRenderer.create(<SettingsView db={db} />);
    });

    const root = activeRenderer!.root;
    const reminderSwitch = root.findByProps({
      accessibilityLabel: strings.reminder.enabledTitle,
    });

    // Ativa o lembrete
    await act(async () => {
      reminderSwitch.props.onPress();
    });

    expect(settingsRepo.get('dailyReminderEnabled')).toBe(true);
    expect(notificationService.scheduleDailyReminder).toHaveBeenCalledWith(20, 0);

    // Agora o botão de alterar horário e o botão de teste de notificação estão visíveis
    const testButton = root.findByProps({
      accessibilityLabel: strings.reminder.testNotificationButton,
    });
    expect(testButton).toBeDefined();

    // Clica no botão de teste de notificação
    await act(async () => {
      testButton.props.onPress();
    });

    expect(notificationService.sendTestNotification).toHaveBeenCalled();

    // Desativa o lembrete
    await act(async () => {
      reminderSwitch.props.onPress();
    });

    expect(settingsRepo.get('dailyReminderEnabled')).toBe(false);
    expect(notificationService.cancelDailyReminder).toHaveBeenCalled();
  });

  test('botão Enviar feedback aciona onSendFeedback quando fornecido', async () => {
    const onSendFeedbackMock = jest.fn();
    await act(async () => {
      activeRenderer = ReactTestRenderer.create(
        <SettingsView db={db} onSendFeedback={onSendFeedbackMock} />
      );
    });

    const root = activeRenderer!.root;
    const sendButton = root.findByProps({
      accessibilityLabel: strings.feedback.sendButton,
    });
    expect(sendButton).toBeDefined();

    act(() => {
      sendButton.props.onPress();
    });

    expect(onSendFeedbackMock).toHaveBeenCalledTimes(1);
  });

  test('permite alternar ajuste de cores fixas no modo escuro persistindo no banco', async () => {
    await act(async () => {
      activeRenderer = ReactTestRenderer.create(<SettingsView db={db} />);
    });

    const root = activeRenderer!.root;
    const fixedColorsSwitch = root.findByProps({
      accessibilityLabel: strings.settings.adjustFixedColorsInDarkMode,
    });
    expect(fixedColorsSwitch).toBeDefined();

    // Valor inicial é true (padrão)
    expect(
      settingsRepo.getWithDefault('adjustFixedColorsInDarkMode', DEFAULT_SETTINGS.adjustFixedColorsInDarkMode)
    ).toBe(true);

    // Clica para desativar
    await act(async () => {
      fixedColorsSwitch.props.onPress();
    });

    expect(settingsRepo.get('adjustFixedColorsInDarkMode')).toBe(false);

    // Clica novamente para reativar
    await act(async () => {
      fixedColorsSwitch.props.onPress();
    });

    expect(settingsRepo.get('adjustFixedColorsInDarkMode')).toBe(true);
  });
});
