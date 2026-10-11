/**
 * @jest-environment jsdom
 */
import { createConsultaApp, type ConsultaApp } from '../app';
import type { ConsultaUnitWeb } from '../types';

describe('ConsultaApp - WebView Controller (MODO_CONSULTA.md §3, §8)', () => {
  let mountRoot: HTMLDivElement;
  let sentMessages: string[];
  let app: ConsultaApp;

  const mockUnits: ConsultaUnitWeb[] = [
    {
      index: 0,
      noteId: 'n-1',
      deckPath: 'Cardio',
      frontHtml: '<div>Frente 1</div>',
      backHtml: '<div>Verso 1</div>',
      tags: ['t1'],
      suspended: false,
      annotations: [],
    },
    {
      index: 1,
      noteId: 'n-2',
      deckPath: 'Cardio',
      frontHtml: '<div>Frente 2</div>',
      backHtml: '<div>Verso 2</div>',
      tags: [],
      suspended: false,
      annotations: [],
    },
  ];

  beforeEach(() => {
    mountRoot = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(mountRoot);
    sentMessages = [];
  });

  afterEach(() => {
    app?.dispose();
    document.body.innerHTML = '';
  });

  function parseEmittedEvents(): { type: string; payload: unknown }[] {
    return sentMessages.map((m) => JSON.parse(m));
  }

  test('inicializa com initialData contendo fontSize, theme e unidades', () => {
    app = createConsultaApp({
      mountRoot,
      win: window,
      post: (raw) => sentMessages.push(raw),
      initialData: {
        theme: 'dark',
        fontSize: 20,
        lastColor: 'verde',
        showFront: true,
        units: mockUnits,
        hasMore: false,
      },
    });

    const rootEl = mountRoot.querySelector<HTMLElement>('#consulta-root')!;
    expect(rootEl.classList.contains('theme-dark')).toBe(true);
    expect(rootEl.style.getPropertyValue('--consulta-font-size')).toBe('20px');

    const settings = app.getSettings();
    expect(settings.fontSize).toBe(20);
    expect(settings.theme).toBe('dark');
    expect(app.getUnits().length).toBe(2);

    const emitted = parseEmittedEvents();
    expect(emitted.some((e) => e.type === 'ready')).toBe(true);
    expect(emitted.some((e) => e.type === 'rendered')).toBe(true);
  });

  test('restaura initialPosition para "Continuar lendo"', () => {
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    app = createConsultaApp({
      mountRoot,
      win: window,
      post: (raw) => sentMessages.push(raw),
      initialData: {
        theme: 'light',
        fontSize: 17,
        lastColor: 'amarelo',
        showFront: true,
        units: mockUnits,
        hasMore: false,
        initialPosition: { unitIndex: 1, offset: 50 },
      },
    });

    // scrollTo foi chamado para a posição de leitura da unidade 1 com offset
    expect(scrollToSpy).toHaveBeenCalled();
    scrollToSpy.mockRestore();
  });

  test('setFontSize vindo do RN altera a fonte e atualiza a variável CSS dinamicamente', () => {
    app = createConsultaApp({
      mountRoot,
      win: window,
      post: (raw) => sentMessages.push(raw),
    });

    const rootEl = mountRoot.querySelector<HTMLElement>('#consulta-root')!;
    expect(rootEl.style.getPropertyValue('--consulta-font-size')).toBe('17px');

    // RN envia setFontSize = 24
    app.receive(JSON.stringify({ type: 'setFontSize', payload: { fontSize: 24 } }));

    expect(rootEl.style.getPropertyValue('--consulta-font-size')).toBe('24px');
    expect(app.getSettings().fontSize).toBe(24);

    // Clamping mínimo (14)
    app.receive(JSON.stringify({ type: 'setFontSize', payload: { fontSize: 10 } }));
    expect(rootEl.style.getPropertyValue('--consulta-font-size')).toBe('14px');

    // Clamping máximo (26)
    app.receive(JSON.stringify({ type: 'setFontSize', payload: { fontSize: 35 } }));
    expect(rootEl.style.getPropertyValue('--consulta-font-size')).toBe('26px');
  });

  test('setFont acionado internamente emite setFont para o React Native', () => {
    app = createConsultaApp({
      mountRoot,
      win: window,
      post: (raw) => sentMessages.push(raw),
    });

    app.setFont(22);

    const rootEl = mountRoot.querySelector<HTMLElement>('#consulta-root')!;
    expect(rootEl.style.getPropertyValue('--consulta-font-size')).toBe('22px');

    const emitted = parseEmittedEvents();
    const setFontEvent = emitted.find((e) => e.type === 'setFont');
    expect(setFontEvent).toBeDefined();
    expect(setFontEvent?.payload).toBe(22);
  });

  test('flushPosition força emissão imediata da posição de leitura', () => {
    app = createConsultaApp({
      mountRoot,
      win: window,
      post: (raw) => sentMessages.push(raw),
      initialData: {
        theme: 'light',
        fontSize: 17,
        lastColor: 'amarelo',
        showFront: true,
        units: mockUnits,
        hasMore: false,
      },
    });

    app.flushPosition();

    const emitted = parseEmittedEvents();
    const positionEvent = emitted.find((e) => e.type === 'position');
    expect(positionEvent).toBeDefined();
    expect(typeof (positionEvent?.payload as { unitIndex: number })?.unitIndex).toBe('number');
  });

  test('recebe evento flushPosition do RN e dispara emissão de position', () => {
    app = createConsultaApp({
      mountRoot,
      win: window,
      post: (raw) => sentMessages.push(raw),
      initialData: {
        theme: 'light',
        fontSize: 17,
        lastColor: 'amarelo',
        showFront: true,
        units: mockUnits,
        hasMore: false,
      },
    });

    // Limpa mensagens anteriores
    sentMessages = [];

    // RN manda flushPosition
    app.receive(JSON.stringify({ type: 'flushPosition', payload: null }));

    const emitted = parseEmittedEvents();
    const positionEvent = emitted.find((e) => e.type === 'position');
    expect(positionEvent).toBeDefined();
  });
});
