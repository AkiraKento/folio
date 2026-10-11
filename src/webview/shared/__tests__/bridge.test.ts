import {
  createBridgeEndpoint,
  BridgeRemoteError,
  BridgeTimeoutError,
  BridgeDisposedError,
  type BridgeEndpoint,
} from '../bridge';

// Protocolo de teste: "A" faz o papel do React Native e "B" o da WebView.
type AEvents = { ping: { n: number }; hello: null };
type ARequests = { double: { request: number; response: number } };
type BEvents = { pong: { n: number } };
type BRequests = {
  save: { request: { text: string }; response: { id: string; text: string } };
  fail: { request: null; response: never };
  slow: { request: null; response: string };
};

type EndpointA = BridgeEndpoint<AEvents, ARequests, BEvents, BRequests>;
type EndpointB = BridgeEndpoint<BEvents, BRequests, AEvents, ARequests>;

/**
 * Liga dois endpoints como se fossem RN e WebView. As mensagens trafegam como
 * string (igual ao postMessage) e de forma assíncrona (microtarefa).
 */
function createPair(options?: { timeoutMs?: number }) {
  const wireAtoB: string[] = [];
  const wireBtoA: string[] = [];

  const a: EndpointA = createBridgeEndpoint<AEvents, ARequests, BEvents, BRequests>({
    side: 'rn',
    post: (raw: string) => {
      wireAtoB.push(raw);
      queueMicrotask(() => b.receive(raw));
    },
    timeoutMs: options?.timeoutMs,
  });
  const b: EndpointB = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
    side: 'web',
    post: (raw: string) => {
      wireBtoA.push(raw);
      queueMicrotask(() => a.receive(raw));
    },
    timeoutMs: options?.timeoutMs,
  });

  return { a, b, wireAtoB, wireBtoA };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('bridge RN ↔ WebView (MODO_CONSULTA.md §8)', () => {
  test('evento sem id chega ao ouvinte com o payload tipado', async () => {
    const { a, b, wireAtoB } = createPair();
    const received: number[] = [];
    b.on('ping', (payload: { n: number }) => received.push(payload.n));

    a.emit('ping', { n: 7 });
    await flush();

    expect(received).toEqual([7]);
    const sent = JSON.parse(wireAtoB[0]);
    expect(sent).toEqual({ type: 'ping', payload: { n: 7 } });
    expect(sent.id).toBeUndefined();
  });

  test('request recebe a resposta com o mesmo id e o mesmo type', async () => {
    const { a, b, wireBtoA, wireAtoB } = createPair();
    a.handle('save', (payload: { text: string }) => ({ id: 'ann-1', text: payload.text }));

    const result = await b.request('save', { text: 'IECA' });

    expect(result).toEqual({ id: 'ann-1', text: 'IECA' });
    const req = JSON.parse(wireBtoA[0]);
    const res = JSON.parse(wireAtoB[0]);
    expect(req.type).toBe('save');
    expect(typeof req.id).toBe('string');
    expect(res.type).toBe('save');
    expect(res.id).toBe(req.id);
    expect(b.pendingCount()).toBe(0);
  });

  test('tratador assíncrono também responde', async () => {
    const { a, b } = createPair();
    b.handle('double', async (n: number) => {
      await flush();
      return n * 2;
    });
    await expect(a.request('double', 21)).resolves.toBe(42);
  });

  test('requests simultâneos são casados pelo id, mesmo respondidos fora de ordem', async () => {
    const { a, b } = createPair();
    b.handle('double', async (n: number) => {
      // O primeiro demora mais que o segundo
      await new Promise((r) => setTimeout(r, n === 1 ? 20 : 1));
      return n * 2;
    });

    const [r1, r2, r3] = await Promise.all([
      a.request('double', 1),
      a.request('double', 2),
      a.request('double', 3),
    ]);
    expect([r1, r2, r3]).toEqual([2, 4, 6]);
  });

  test('ids são únicos e prefixados pelo lado, sem colisão entre RN e WebView', async () => {
    const { a, b, wireAtoB, wireBtoA } = createPair();
    a.handle('save', (p: { text: string }) => ({ id: 'x', text: p.text }));
    b.handle('double', (n: number) => n * 2);

    await Promise.all([b.request('save', { text: '1' }), b.request('save', { text: '2' })]);
    await a.request('double', 1);

    const webIds = wireBtoA.map((r) => JSON.parse(r)).filter((m) => m.type === 'save').map((m) => m.id);
    const rnIds = wireAtoB.map((r) => JSON.parse(r)).filter((m) => m.type === 'double').map((m) => m.id);
    expect(new Set(webIds).size).toBe(2);
    expect(webIds.every((id: string) => id.startsWith('web-'))).toBe(true);
    expect(rnIds.every((id: string) => id.startsWith('rn-'))).toBe(true);
  });

  test('erro no tratador volta como BridgeRemoteError com a mensagem', async () => {
    const { a, b } = createPair();
    a.handle('fail', () => {
      throw new Error('banco indisponível');
    });

    const promise = b.request('fail', null);
    await expect(promise).rejects.toBeInstanceOf(BridgeRemoteError);
    await expect(b.request('fail', null)).rejects.toThrow('banco indisponível');
  });

  test('request sem tratador do outro lado é rejeitado (não fica pendurado)', async () => {
    const { b } = createPair();
    await expect(b.request('save', { text: 'x' })).rejects.toThrow(/save/);
    expect(b.pendingCount()).toBe(0);
  });

  test('request sem resposta expira com BridgeTimeoutError', async () => {
    jest.useFakeTimers();
    try {
      const lost: string[] = [];
      const b = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
        side: 'web',
        post: (raw: string) => lost.push(raw), // ninguém responde
        timeoutMs: 1000,
      });

      const promise = b.request('slow', null);
      expect(b.pendingCount()).toBe(1);
      jest.advanceTimersByTime(1001);

      await expect(promise).rejects.toBeInstanceOf(BridgeTimeoutError);
      expect(b.pendingCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('timeout por chamada sobrepõe o padrão', async () => {
    jest.useFakeTimers();
    try {
      const b = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
        side: 'web',
        post: () => undefined,
        timeoutMs: 60_000,
      });
      const promise = b.request('slow', null, { timeoutMs: 50 });
      jest.advanceTimersByTime(51);
      await expect(promise).rejects.toBeInstanceOf(BridgeTimeoutError);
    } finally {
      jest.useRealTimers();
    }
  });

  test('resposta atrasada (depois do timeout) é ignorada sem erro', async () => {
    jest.useFakeTimers();
    try {
      const sent: string[] = [];
      const b = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
        side: 'web',
        post: (raw: string) => sent.push(raw),
        timeoutMs: 10,
      });
      const promise = b.request('slow', null);
      jest.advanceTimersByTime(11);
      await expect(promise).rejects.toBeInstanceOf(BridgeTimeoutError);

      const { id } = JSON.parse(sent[0]);
      expect(() => b.receive(JSON.stringify({ type: 'slow', id, payload: 'tarde' }))).not.toThrow();
      expect(b.receive(JSON.stringify({ type: 'slow', id, payload: 'tarde' }))).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('mensagens malformadas são ignoradas', () => {
    const { b } = createPair();
    const spy = jest.fn();
    b.on('ping', spy);

    expect(b.receive('não é json')).toBe(false);
    expect(b.receive('42')).toBe(false);
    expect(b.receive('null')).toBe(false);
    expect(b.receive(JSON.stringify({ payload: 1 }))).toBe(false);
    expect(b.receive(JSON.stringify({ type: 3 }))).toBe(false);
    expect(b.receive(JSON.stringify({ type: 'ping', id: 99 }))).toBe(false);
    expect(b.receive(undefined)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test('aceita mensagem já desserializada (objeto)', () => {
    const { b } = createPair();
    const spy = jest.fn();
    b.on('ping', spy);
    expect(b.receive({ type: 'ping', payload: { n: 1 } })).toBe(true);
    expect(spy).toHaveBeenCalledWith({ n: 1 });
  });

  test('evento sem ouvinte vai para onUnhandled', () => {
    const unhandled = jest.fn();
    const b = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
      side: 'web',
      post: () => undefined,
      onUnhandled: unhandled,
    });
    expect(b.receive(JSON.stringify({ type: 'hello', payload: null }))).toBe(false);
    expect(unhandled).toHaveBeenCalledWith(expect.objectContaining({ type: 'hello' }));
  });

  test('cancelar a inscrição para de receber', async () => {
    const { a, b } = createPair();
    const spy = jest.fn();
    const off = b.on('ping', spy);
    a.emit('ping', { n: 1 });
    await flush();
    off();
    a.emit('ping', { n: 2 });
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('vários ouvintes do mesmo evento recebem; erro em um não derruba os outros', async () => {
    const onError = jest.fn();
    const { a } = createPair();
    const b = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
      side: 'web',
      post: () => undefined,
      onListenerError: onError,
    });
    const second = jest.fn();
    b.on('ping', () => {
      throw new Error('quebrou');
    });
    b.on('ping', second);
    b.receive(JSON.stringify({ type: 'ping', payload: { n: 5 } }));
    expect(second).toHaveBeenCalledWith({ n: 5 });
    expect(onError).toHaveBeenCalled();
    a.dispose();
  });

  test('handle substitui o tratador anterior do mesmo type', async () => {
    const { a, b } = createPair();
    a.handle('save', () => ({ id: '1', text: 'velho' }));
    a.handle('save', () => ({ id: '2', text: 'novo' }));
    await expect(b.request('save', { text: '' })).resolves.toEqual({ id: '2', text: 'novo' });
  });

  test('dispose rejeita os pendentes e para de enviar', async () => {
    const sent: string[] = [];
    const b = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
      side: 'web',
      post: (raw: string) => sent.push(raw),
    });
    const promise = b.request('slow', null);
    b.dispose();
    await expect(promise).rejects.toBeInstanceOf(BridgeDisposedError);
    expect(b.pendingCount()).toBe(0);

    b.emit('pong', { n: 1 });
    expect(sent).toHaveLength(1);
    await expect(b.request('slow', null)).rejects.toBeInstanceOf(BridgeDisposedError);
  });

  test('falha do post ao enviar request rejeita a promessa', async () => {
    const b = createBridgeEndpoint<BEvents, BRequests, AEvents, ARequests>({
      side: 'web',
      post: () => {
        throw new Error('sem ponte');
      },
    });
    await expect(b.request('slow', null)).rejects.toThrow('sem ponte');
    expect(b.pendingCount()).toBe(0);
  });
});
