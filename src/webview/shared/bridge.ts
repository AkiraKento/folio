/**
 * Ponte de mensagens React Native ↔ WebView (MODO_CONSULTA.md §8).
 *
 * TS puro, sem dependência de React Native nem do DOM: o mesmo código roda dos
 * dois lados (dentro da WebView e no app) e, no futuro, num iframe na web.
 *
 * Formato no fio: JSON `{type, id?, payload?, error?}`.
 *   - Evento: sem `id`. Ninguém responde.
 *   - Request: com `id`. O outro lado responde com o MESMO `type` e o MESMO `id`
 *     (padrão do `send(cmd, payload, cb)` do add-on). Em caso de falha, a
 *     resposta leva `error` (texto) em vez de `payload`.
 *
 * Os ids levam o prefixo do lado (`rn-` / `web-`), então um request de um lado
 * nunca é confundido com a resposta a um request do outro.
 */

/** Mapa de eventos: type -> payload. */
export type BridgeEventMap = { [type: string]: unknown };

/** Especificação de um request: o que vai e o que volta. */
export interface BridgeRequestSpec<Req = unknown, Res = unknown> {
  request: Req;
  response: Res;
}

/** Mapa de requests: type -> {request, response}. */
export type BridgeRequestMap = { [type: string]: BridgeRequestSpec };

/** Mensagem como trafega no fio, já desserializada. */
export interface BridgeWireMessage {
  type: string;
  id?: string;
  payload?: unknown;
  error?: string;
}

export type BridgeSide = 'rn' | 'web';

export const DEFAULT_BRIDGE_TIMEOUT_MS = 10_000;

/** O outro lado respondeu com erro. */
export class BridgeRemoteError extends Error {
  readonly requestType: string;
  constructor(requestType: string, message: string) {
    super(message);
    this.name = 'BridgeRemoteError';
    this.requestType = requestType;
  }
}

/** O outro lado não respondeu a tempo. */
export class BridgeTimeoutError extends Error {
  readonly requestType: string;
  constructor(requestType: string, timeoutMs: number) {
    super(`Sem resposta para "${requestType}" em ${timeoutMs} ms`);
    this.name = 'BridgeTimeoutError';
    this.requestType = requestType;
  }
}

/** O endpoint foi encerrado (tela fechada) antes da resposta. */
export class BridgeDisposedError extends Error {
  constructor(requestType: string) {
    super(`Ponte encerrada antes da resposta de "${requestType}"`);
    this.name = 'BridgeDisposedError';
  }
}

type RequestHandler<Spec> = Spec extends BridgeRequestSpec<infer Req, infer Res>
  ? (payload: Req) => Res | Promise<Res>
  : never;

/** Tratadores para todos os requests de um mapa (útil para tipar o lado que responde). */
export type BridgeRequestHandlers<R extends object> = {
  [K in keyof R]: RequestHandler<R[K]>;
};

export interface BridgeEndpointOptions {
  /** Lado deste endpoint; vira o prefixo dos ids. */
  side: BridgeSide;
  /** Envia a string serializada para o outro lado. */
  post: (raw: string) => void;
  /** Timeout padrão dos requests. Padrão: 10 s. */
  timeoutMs?: number;
  /** Chamado para mensagens válidas que ninguém tratou (útil para debug). */
  onUnhandled?: (message: BridgeWireMessage) => void;
  /** Chamado quando um ouvinte de evento lança erro. */
  onListenerError?: (error: unknown, message: BridgeWireMessage) => void;
}

export interface BridgeEndpoint<
  OutEvents extends object,
  OutRequests extends object,
  InEvents extends object,
  InRequests extends object,
> {
  /** Envia um evento (sem resposta). */
  emit<K extends keyof OutEvents & string>(type: K, payload: OutEvents[K]): void;
  /** Envia um request e espera a resposta com o mesmo id. */
  request<K extends keyof OutRequests & string>(
    type: K,
    payload: RequestOf<OutRequests[K]>,
    options?: { timeoutMs?: number }
  ): Promise<ResponseOf<OutRequests[K]>>;
  /** Escuta um evento vindo do outro lado. Retorna a função para cancelar. */
  on<K extends keyof InEvents & string>(
    type: K,
    listener: (payload: InEvents[K]) => void
  ): () => void;
  /** Registra o tratador (único) de um request vindo do outro lado. */
  handle<K extends keyof InRequests & string>(
    type: K,
    handler: RequestHandler<InRequests[K]>
  ): () => void;
  /**
   * Entrega uma mensagem recebida (string do postMessage ou objeto).
   * Retorna `true` se ela foi tratada.
   */
  receive(raw: unknown): boolean;
  /** Quantos requests deste lado aguardam resposta. */
  pendingCount(): number;
  /** Rejeita os pendentes e desliga o endpoint. */
  dispose(): void;
}

type RequestOf<Spec> = Spec extends BridgeRequestSpec<infer Req, unknown> ? Req : never;
type ResponseOf<Spec> = Spec extends BridgeRequestSpec<unknown, infer Res> ? Res : never;

interface PendingRequest {
  type: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Converte o que chegou pelo postMessage numa mensagem válida, ou `null`.
 * Aceita string JSON ou objeto já desserializado.
 */
export function parseBridgeMessage(raw: unknown): BridgeWireMessage | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.type !== 'string' || candidate.type.length === 0) return null;
  if (candidate.id !== undefined && typeof candidate.id !== 'string') return null;
  if (candidate.error !== undefined && typeof candidate.error !== 'string') return null;

  return {
    type: candidate.type,
    id: candidate.id as string | undefined,
    payload: candidate.payload,
    error: candidate.error as string | undefined,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro desconhecido';
}

export function createBridgeEndpoint<
  OutEvents extends object,
  OutRequests extends object,
  InEvents extends object,
  InRequests extends object,
>(options: BridgeEndpointOptions): BridgeEndpoint<OutEvents, OutRequests, InEvents, InRequests> {
  const defaultTimeout = options.timeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS;
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const handlers = new Map<string, (payload: unknown) => unknown>();
  const pending = new Map<string, PendingRequest>();
  let sequence = 0;
  let disposed = false;

  function send(message: BridgeWireMessage): void {
    options.post(JSON.stringify(message));
  }

  function nextId(): string {
    sequence += 1;
    return `${options.side}-${sequence.toString(36)}-${Date.now().toString(36)}`;
  }

  function reply(type: string, id: string, result: { payload?: unknown; error?: string }): void {
    if (disposed) return;
    try {
      send(result.error !== undefined ? { type, id, error: result.error } : { type, id, payload: result.payload });
    } catch {
      // Sem canal para responder: o outro lado vai expirar pelo timeout.
    }
  }

  function handleIncomingRequest(message: BridgeWireMessage & { id: string }): boolean {
    const handler = handlers.get(message.type);
    if (!handler) {
      reply(message.type, message.id, { error: `Sem tratador para "${message.type}"` });
      options.onUnhandled?.(message);
      return false;
    }

    let result: unknown;
    try {
      result = handler(message.payload);
    } catch (error) {
      reply(message.type, message.id, { error: errorMessage(error) });
      return true;
    }

    Promise.resolve(result).then(
      (payload) => reply(message.type, message.id, { payload }),
      (error: unknown) => reply(message.type, message.id, { error: errorMessage(error) })
    );
    return true;
  }

  function handleIncomingEvent(message: BridgeWireMessage): boolean {
    const set = listeners.get(message.type);
    if (!set || set.size === 0) {
      options.onUnhandled?.(message);
      return false;
    }
    // Cópia: um ouvinte pode se desinscrever durante a entrega.
    for (const listener of Array.from(set)) {
      try {
        listener(message.payload);
      } catch (error) {
        options.onListenerError?.(error, message);
      }
    }
    return true;
  }

  return {
    emit(type, payload) {
      if (disposed) return;
      send({ type, payload });
    },

    request(type, payload, requestOptions) {
      if (disposed) return Promise.reject(new BridgeDisposedError(type));

      const id = nextId();
      const timeoutMs = requestOptions?.timeoutMs ?? defaultTimeout;

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new BridgeTimeoutError(type, timeoutMs));
        }, timeoutMs);

        pending.set(id, {
          type,
          resolve: resolve as (value: unknown) => void,
          reject,
          timer,
        });

        try {
          send({ type, id, payload });
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error instanceof Error ? error : new Error(errorMessage(error)));
        }
      });
    },

    on(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      const entry = listener as (payload: unknown) => void;
      set.add(entry);
      return () => {
        set.delete(entry);
      };
    },

    handle(type, handler) {
      const entry = handler as unknown as (payload: unknown) => unknown;
      handlers.set(type, entry);
      return () => {
        if (handlers.get(type) === entry) handlers.delete(type);
      };
    },

    receive(raw) {
      if (disposed) return false;
      const message = parseBridgeMessage(raw);
      if (!message) return false;

      if (message.id !== undefined) {
        // 1. Resposta a um request nosso?
        const waiting = pending.get(message.id);
        if (waiting) {
          pending.delete(message.id);
          clearTimeout(waiting.timer);
          if (message.error !== undefined) {
            waiting.reject(new BridgeRemoteError(waiting.type, message.error));
          } else {
            waiting.resolve(message.payload);
          }
          return true;
        }
        // 2. Id com o nosso prefixo e sem pendente: resposta atrasada. Ignora.
        if (message.id.startsWith(`${options.side}-`)) return false;
        // 3. Request do outro lado.
        return handleIncomingRequest(message as BridgeWireMessage & { id: string });
      }

      return handleIncomingEvent(message);
    },

    pendingCount() {
      return pending.size;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const waiting of pending.values()) {
        clearTimeout(waiting.timer);
        waiting.reject(new BridgeDisposedError(waiting.type));
      }
      pending.clear();
      listeners.clear();
      handlers.clear();
    },
  };
}
