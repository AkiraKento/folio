import {
  logError,
  logWarn,
  getErrorLogs,
  getDiagnosticReport,
  clearErrorLogs,
  copyOrShareDiagnostic,
} from '../errorLog';
import { Share } from 'react-native';

describe('errorLog', () => {
  beforeEach(async () => {
    await clearErrorLogs();
    jest.clearAllMocks();
  });

  it('registra erro com nível, contexto e mensagem sanitizados', async () => {
    const error = new Error('Falha na conexão local');
    const entry = logError('DatabaseTest', error);

    expect(entry.level).toBe('error');
    expect(entry.context).toBe('DatabaseTest');
    expect(entry.message).toBe('Falha na conexão local');
    expect(entry.stack).toBeDefined();

    const logs = await getErrorLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].id).toBe(entry.id);
  });

  it('registra aviso com nível warn e mensagem adicional', async () => {
    const entry = logWarn('NotificationTest', 'Permissão negada', 'usuário cancelou');

    expect(entry.level).toBe('warn');
    expect(entry.context).toBe('NotificationTest');
    expect(entry.message).toContain('Permissão negada');
    expect(entry.message).toContain('usuário cancelou');

    const logs = await getErrorLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('warn');
  });

  it('mantém buffer circular limitado a no máximo 50 entradas', async () => {
    for (let i = 0; i < 60; i++) {
      logError('LoopTest', `Erro número ${i}`);
    }

    const logs = await getErrorLogs();
    expect(logs.length).toBe(50);
    // Mais recente primeiro
    expect(logs[0].message).toBe('Erro número 59');
  });

  it('gera relatório de diagnóstico técnico formatado sem dados pessoais', async () => {
    logError('MigrationError', new Error('Tabela corrompida'));

    const report = await getDiagnosticReport();
    expect(report).toContain('=== RELATÓRIO DE DIAGNÓSTICO WEISS ===');
    expect(report).toContain('Versão: 0.1.1');
    expect(report).toContain('[ERROR] [MigrationError] Tabela corrompida');
    expect(report).toContain('Nenhum dado de estudo ou card foi incluído');
  });

  it('dispara Share.share no copyOrShareDiagnostic', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({
      action: Share.sharedAction,
    });

    logError('ShareContext', 'Erro de teste para compartilhamento');
    const result = await copyOrShareDiagnostic();

    expect(shareSpy).toHaveBeenCalled();
    expect(result.action).toBe('shared');
  });
});
