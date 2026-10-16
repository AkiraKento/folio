import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { LogEntry, LogLevel } from './types';

const MAX_LOG_ENTRIES = 50;
const memoryBuffer: LogEntry[] = [];
let writeInProgress = false;

function getLogFilePath(): string | null {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) return null;
  return `${baseDir}logs/error.log`;
}

function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Erro desconhecido';
  // Limita o tamanho da mensagem para evitar payloads enormes
  return msg.length > 500 ? `${msg.slice(0, 500)}...` : msg;
}

function sanitizeStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  return stack.length > 2000 ? `${stack.slice(0, 2000)}...` : stack;
}

/**
 * Persiste o buffer de memória no arquivo de log circular em disco.
 */
async function persistBufferToFile(): Promise<void> {
  if (writeInProgress) return;
  const filePath = getLogFilePath();
  if (!filePath) return;

  writeInProgress = true;
  try {
    const logsDir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    const dirInfo = await FileSystem.getInfoAsync(logsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(logsDir, { intermediates: true });
    }

    const payload = JSON.stringify(memoryBuffer);
    await FileSystem.writeAsStringAsync(filePath, payload, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // Falha silenciosa no I/O de disco mantém o buffer em memória intacto
  } finally {
    writeInProgress = false;
  }
}

/**
 * Carrega logs persistidos previamente para o buffer de memória.
 */
async function loadLogsFromFile(): Promise<void> {
  const filePath = getLogFilePath();
  if (!filePath) return;

  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) return;

    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (content) {
      const parsed: LogEntry[] = JSON.parse(content);
      if (Array.isArray(parsed)) {
        memoryBuffer.length = 0;
        memoryBuffer.push(...parsed.slice(-MAX_LOG_ENTRIES));
      }
    }
  } catch {
    // Mantém o buffer atual em caso de falha de leitura
  }
}

/**
 * Registra uma entrada no log circular (em memória e em disco).
 * Respeita estritamente a privacidade: nenhum dado pessoal ou de estudo é gravado.
 */
export function recordLog(
  level: LogLevel,
  context: string,
  errorOrMessage: unknown,
  extraMessage?: string
): LogEntry {
  const now = new Date();
  let message = '';
  let stack: string | undefined;

  if (errorOrMessage instanceof Error) {
    message = sanitizeErrorMessage(errorOrMessage.message);
    stack = sanitizeStack(errorOrMessage.stack);
  } else if (typeof errorOrMessage === 'string') {
    message = sanitizeErrorMessage(errorOrMessage);
  } else if (errorOrMessage !== undefined && errorOrMessage !== null) {
    try {
      message = sanitizeErrorMessage(JSON.stringify(errorOrMessage));
    } catch {
      message = sanitizeErrorMessage(String(errorOrMessage));
    }
  } else {
    message = 'Erro não especificado';
  }

  if (extraMessage) {
    message = `${message} (${sanitizeErrorMessage(extraMessage)})`;
  }

  const entry: LogEntry = {
    id: generateLogId(),
    timestamp: now.getTime(),
    isoTime: now.toISOString(),
    level,
    context: sanitizeErrorMessage(context),
    message,
    stack,
  };

  memoryBuffer.push(entry);
  if (memoryBuffer.length > MAX_LOG_ENTRIES) {
    memoryBuffer.splice(0, memoryBuffer.length - MAX_LOG_ENTRIES);
  }

  // Tenta persistir sem travar a thread
  persistBufferToFile().catch(() => {});

  return entry;
}

/**
 * Registra um erro no log local.
 */
export function logError(context: string, error: unknown, extraMessage?: string): LogEntry {
  return recordLog('error', context, error, extraMessage);
}

/**
 * Registra um aviso no log local.
 */
export function logWarn(context: string, message: unknown, extraMessage?: string): LogEntry {
  return recordLog('warn', context, message, extraMessage);
}

/**
 * Retorna todas as entradas de log salvas (mais recentes primeiro).
 */
export async function getErrorLogs(): Promise<LogEntry[]> {
  if (memoryBuffer.length === 0) {
    await loadLogsFromFile();
  }
  return [...memoryBuffer].reverse();
}

/**
 * Limpa o histórico de logs em memória e em disco.
 */
export async function clearErrorLogs(): Promise<void> {
  memoryBuffer.length = 0;
  const filePath = getLogFilePath();
  if (filePath) {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    } catch {
      // Ignora erro ao apagar arquivo inexistente
    }
  }
}

/**
 * Monta o relatório de diagnóstico técnico formatado como texto.
 * Sem dados de estudo, ideal para envio via WhatsApp ou suporte.
 */
export async function getDiagnosticReport(): Promise<string> {
  const logs = await getErrorLogs();
  const now = new Date().toISOString();
  const appVersion = '0.1.1';
  const platformStr = `${Platform.OS} ${Platform.Version || ''}`.trim();

  const lines: string[] = [
    '=== RELATÓRIO DE DIAGNÓSTICO WEISS ===',
    `Versão: ${appVersion}`,
    `Plataforma: ${platformStr}`,
    `Data UTC: ${now}`,
    `Erros registrados: ${logs.length}`,
    'Privacidade: Nenhum dado de estudo ou card foi incluído.',
    '----------------------------------------',
  ];

  if (logs.length === 0) {
    lines.push('Nenhum erro registrado no histórico recente.');
  } else {
    for (const log of logs.slice(0, 20)) {
      lines.push(`[${log.isoTime}] [${log.level.toUpperCase()}] [${log.context}] ${log.message}`);
      if (log.stack) {
        // Pega as primeiras 3 linhas do stack para manter conciso
        const shortStack = log.stack.split('\n').slice(0, 3).join('\n  ');
        lines.push(`  Stack: ${shortStack}`);
      }
      lines.push('');
    }
  }

  lines.push('========================================');
  return lines.join('\n');
}

/**
 * Dispara o diálogo nativo de compartilhamento (WhatsApp, Copiar, etc.) com o relatório de diagnóstico.
 */
export async function copyOrShareDiagnostic(): Promise<{
  action: 'shared' | 'dismissed' | 'copied' | 'error';
  message?: string;
}> {
  try {
    const report = await getDiagnosticReport();
    const result = await Share.share({
      title: 'Diagnóstico Weiss',
      message: report,
    });

    if (result.action === Share.sharedAction) {
      return { action: 'shared' };
    }
    return { action: 'dismissed' };
  } catch (err) {
    logError('DiagnosticShare', err);
    return {
      action: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
