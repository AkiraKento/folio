import { createTestDatabase } from './test-utils';
import { SettingsRepository, DEFAULT_SETTINGS } from '../repositories/settings';

describe('SettingsRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let settingsRepo: SettingsRepository;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    settingsRepo = new SettingsRepository(db);
  });

  test('recupera valor com padrão quando não configurado', () => {
    const retention = settingsRepo.getWithDefault('desiredRetention', DEFAULT_SETTINGS.desiredRetention);
    expect(retention).toBe(0.9);

    const nonExistent = settingsRepo.get('non_existent_key');
    expect(nonExistent).toBeNull();
  });

  test('grava e recupera tipos variados (string, número, boolean, objeto)', () => {
    settingsRepo.set('theme', 'dark');
    expect(settingsRepo.get<string>('theme')).toBe('dark');

    settingsRepo.set('newCardsPerDay', 30);
    expect(settingsRepo.get<number>('newCardsPerDay')).toBe(30);

    settingsRepo.set('showHighlightsInReview', false);
    expect(settingsRepo.get<boolean>('showHighlightsInReview')).toBe(false);

    settingsRepo.set('dailyReminderEnabled', true);
    expect(settingsRepo.get<boolean>('dailyReminderEnabled')).toBe(true);

    settingsRepo.set('dailyReminderTime', '21:30');
    expect(settingsRepo.get<string>('dailyReminderTime')).toBe('21:30');

    const complex = { nested: { value: 123 }, list: ['a', 'b'] };
    settingsRepo.set('customObj', complex);
    expect(settingsRepo.get<typeof complex>('customObj')).toEqual(complex);
  });

  test('DEFAULT_SETTINGS possui configurações válidas para lembrete diário e estatísticas do teste', () => {
    expect(DEFAULT_SETTINGS.dailyReminderEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.dailyReminderTime).toBe('20:00');
    expect(DEFAULT_SETTINGS.consultaOpenCount).toBe(0);
    expect(DEFAULT_SETTINGS.apkgImportCount).toBe(0);
  });

  test('increment aumenta atomicamente o valor numérico de uma chave', () => {
    expect(settingsRepo.increment('consultaOpenCount')).toBe(1);
    expect(settingsRepo.increment('consultaOpenCount')).toBe(2);
    expect(settingsRepo.increment('consultaOpenCount', 3)).toBe(5);
    expect(settingsRepo.get<number>('consultaOpenCount')).toBe(5);
  });

  test('getAll retorna todas as configurações gravadas', () => {
    settingsRepo.set('key1', 'val1');
    settingsRepo.set('key2', 42);

    const all = settingsRepo.getAll();
    expect(all).toEqual({
      key1: 'val1',
      key2: 42,
    });
  });

  test('remove configuração', () => {
    settingsRepo.set('to_delete', true);
    expect(settingsRepo.get('to_delete')).toBe(true);

    settingsRepo.delete('to_delete');
    expect(settingsRepo.get('to_delete')).toBeNull();
  });
});
