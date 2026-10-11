import { createTestDatabase, seedBasicNoteType } from '../../db/__tests__/test-utils';
import { DecksRepository } from '../../db/repositories/decks';
import { NotesRepository } from '../../db/repositories/notes';
import { AnnotationsRepository } from '../../db/repositories/annotations';
import { ConsultaPosRepository } from '../../db/repositories/consulta-pos';
import { SettingsRepository } from '../../db/repositories/settings';
import {
  createBridgeEndpoint,
  BridgeRemoteError,
  type BridgeEndpoint,
} from '../../webview/shared/bridge';
import type {
  AnnotationInput,
  ConsultaInitPayload,
  SavedAnnotation,
  RnToWebEvents,
  RnToWebRequests,
  WebToRnEvents,
  WebToRnRequests,
} from '../../webview/consulta/protocol';
import {
  createConsultaRnBridge,
  toConsultaUnitWeb,
  type ConsultaRnBridge,
} from '../bridge';
import type { ConsultaUnit } from '../units';

type WebEndpoint = BridgeEndpoint<
  WebToRnEvents,
  WebToRnRequests,
  RnToWebEvents,
  RnToWebRequests
>;

describe('Ponte RN ↔ WebView da Consulta (MODO_CONSULTA.md §8)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let annotationsRepo: AnnotationsRepository;
  let consultaPosRepo: ConsultaPosRepository;
  let settingsRepo: SettingsRepository;
  let deckId: string;
  let noteId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;

    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    annotationsRepo = new AnnotationsRepository(db);
    consultaPosRepo = new ConsultaPosRepository(db);
    settingsRepo = new SettingsRepository(db);

    const noteTypeId = seedBasicNoteType(db);
    const deck = decksRepo.create({ name: 'Cardiologia' });
    deckId = deck.id;

    const note = notesRepo.create({
      deck_id: deckId,
      note_type_id: noteTypeId,
      fields: { Front: 'Frente', Back: 'Verso com IECA' },
      tags: ['cardio'],
    });
    noteId = note.id;
  });

  /**
   * Conecta um ConsultaRnBridge e um endpoint simulado da WebView em memória.
   */
  function setupConnectedBridges(options?: { deckQuery?: string }) {
    const wireRnToWeb: string[] = [];
    const wireWebToRn: string[] = [];

    const rnBridge: ConsultaRnBridge = createConsultaRnBridge({
      post: (raw: string) => {
        wireRnToWeb.push(raw);
        queueMicrotask(() => webBridge.receive(raw));
      },
      annotationsRepo,
      consultaPosRepo,
      settingsRepo,
      deckQuery: options?.deckQuery ?? deckId,
    });

    const webBridge: WebEndpoint = createBridgeEndpoint<
      WebToRnEvents,
      WebToRnRequests,
      RnToWebEvents,
      RnToWebRequests
    >({
      side: 'web',
      post: (raw: string) => {
        wireWebToRn.push(raw);
        queueMicrotask(() => rnBridge.receive(raw));
      },
    });

    return { rnBridge, webBridge, wireRnToWeb, wireWebToRn };
  }

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  test('converte ConsultaUnit para ConsultaUnitWeb corretamente', () => {
    const unit: ConsultaUnit = {
      index: 0,
      noteId: noteId,
      groupKey: 'grp-1',
      deckPath: 'Medicina::Cardiologia',
      frontHtml: '<b>Frente</b>',
      backHtml: '<i>Verso</i>',
      tags: ['cardio', 'ic'],
      suspended: false,
      annotations: [
        {
          id: 'ann-1',
          note_id: noteId,
          group_key: null,
          kind: 'hl',
          color: 'amarelo',
          quote: 'IECA',
          prefix: '',
          suffix: '',
          start: 0,
          end: 4,
          note: 'Primeira linha',
          label: '',
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
        },
      ],
    };

    const webUnit = toConsultaUnitWeb(unit);
    expect(webUnit.index).toBe(0);
    expect(webUnit.noteId).toBe(noteId);
    expect(webUnit.groupKey).toBe('grp-1');
    expect(webUnit.deckPath).toBe('Medicina::Cardiologia');
    expect(webUnit.annotations[0].quote).toBe('IECA');
    expect(webUnit.annotations[0].color).toBe('amarelo');
  });

  describe('Requests Web → RN com resposta tipada (§8)', () => {
    test('saveAnnotation cria nova anotação, grava no banco e retorna SavedAnnotation', async () => {
      const { webBridge } = setupConnectedBridges();

      const input: AnnotationInput = {
        note_id: noteId,
        kind: 'hl',
        color: 'verde',
        quote: 'IECA',
        prefix: 'com ',
        suffix: ' na IC',
        start: 10,
        end: 14,
        note: 'Nota de estudo',
      };

      const response = await webBridge.request('saveAnnotation', input);

      expect(response).toBeDefined();
      expect(typeof response.id).toBe('string');
      expect(response.note_id).toBe(noteId);
      expect(response.kind).toBe('hl');
      expect(response.color).toBe('verde');
      expect(response.quote).toBe('IECA');
      expect(response.prefix).toBe('com ');
      expect(response.suffix).toBe(' na IC');
      expect(response.start).toBe(10);
      expect(response.end).toBe(14);
      expect(response.note).toBe('Nota de estudo');
      expect(response.created_at).toBeGreaterThan(0);

      // Verifica persistência real no SQLite
      const inDb = annotationsRepo.getById(response.id);
      expect(inDb).not.toBeNull();
      expect(inDb?.quote).toBe('IECA');
      expect(inDb?.color).toBe('verde');
    });

    test('saveAnnotation com id existente atualiza a anotação existente', async () => {
      const { webBridge } = setupConnectedBridges();

      // Cria via repositório
      const created = annotationsRepo.create({
        note_id: noteId,
        kind: 'hl',
        color: 'amarelo',
        quote: 'IECA',
        start: 0,
        end: 4,
      });

      // Atualiza via WebView bridge request
      const updateInput: AnnotationInput = {
        id: created.id,
        note_id: noteId,
        kind: 'ul',
        color: 'azul',
        quote: 'IECA',
        start: 0,
        end: 4,
        note: 'Atualizado para sublinhado azul',
      };

      const response = await webBridge.request('saveAnnotation', updateInput);

      expect(response.id).toBe(created.id);
      expect(response.kind).toBe('ul');
      expect(response.color).toBe('azul');
      expect(response.note).toBe('Atualizado para sublinhado azul');

      const inDb = annotationsRepo.getById(created.id);
      expect(inDb?.kind).toBe('ul');
      expect(inDb?.color).toBe('azul');
      expect(inDb?.note).toBe('Atualizado para sublinhado azul');
    });

    test('deleteAnnotation realiza exclusão lógica e responde { ok: true }', async () => {
      const { webBridge } = setupConnectedBridges();

      const created = annotationsRepo.create({
        note_id: noteId,
        kind: 'hl',
        color: 'rosa',
        quote: 'IECA',
        start: 0,
        end: 4,
      });

      const response = await webBridge.request('deleteAnnotation', { id: created.id });
      expect(response).toEqual({ ok: true });

      // Verificação de exclusão lógica
      const active = annotationsRepo.getById(created.id);
      expect(active).toBeNull();
      const withDeleted = annotationsRepo.getById(created.id, { includeDeleted: true });
      expect(withDeleted?.deleted_at).not.toBeNull();
    });

    test('restoreAnnotation desfaz a exclusão lógica e responde { ok: true }', async () => {
      const { webBridge } = setupConnectedBridges();

      const created = annotationsRepo.create({
        note_id: noteId,
        kind: 'hl',
        color: 'laranja',
        quote: 'IECA',
        start: 0,
        end: 4,
      });
      annotationsRepo.softDelete(created.id);
      expect(annotationsRepo.getById(created.id)).toBeNull();

      const response = await webBridge.request('restoreAnnotation', { id: created.id });
      expect(response).toEqual({ ok: true });

      const restored = annotationsRepo.getById(created.id);
      expect(restored).not.toBeNull();
      expect(restored?.deleted_at).toBeNull();
    });

    test('erro em request devolve BridgeRemoteError com a mensagem de erro', async () => {
      const rnBridge = createConsultaRnBridge({
        post: (raw: string) => queueMicrotask(() => webBridge.receive(raw)),
        onSaveAnnotation: () => {
          throw new Error('Falha de validação da anotação');
        },
      });

      const webBridge: WebEndpoint = createBridgeEndpoint({
        side: 'web',
        post: (raw: string) => queueMicrotask(() => rnBridge.receive(raw)),
      });

      const promise = webBridge.request('saveAnnotation', {
        note_id: noteId,
        kind: 'hl',
        color: 'amarelo',
        quote: 'x',
        start: 0,
        end: 1,
      });

      await expect(promise).rejects.toBeInstanceOf(BridgeRemoteError);
      await expect(promise).rejects.toThrow('Falha de validação da anotação');
    });
  });

  describe('Eventos RN → Web (§8)', () => {
    test('sendInit emite init com tema e fonte corretos', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const received: ConsultaInitPayload[] = [];
      webBridge.on('init', (payload) => received.push(payload));

      const payload: ConsultaInitPayload = {
        theme: 'dark',
        fontSize: 20,
        lastColor: 'verde',
        showFront: false,
      };
      rnBridge.sendInit(payload);
      await flush();

      expect(received).toEqual([payload]);
    });

    test('sendAppend emite append com unidades e hasMore', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const received: unknown[] = [];
      webBridge.on('append', (payload) => received.push(payload));

      const sampleUnit: ConsultaUnit = {
        index: 0,
        noteId: noteId,
        deckPath: 'Cardiologia',
        frontHtml: 'Frente',
        backHtml: 'Verso',
        tags: [],
        suspended: false,
        annotations: [],
      };

      rnBridge.sendAppend([sampleUnit], true);
      await flush();

      expect(received).toHaveLength(1);
      const first = received[0] as { units: unknown[]; hasMore: boolean };
      expect(first.hasMore).toBe(true);
      expect(first.units).toHaveLength(1);
    });

    test('sendReplace emite replace com unidades', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const received: unknown[] = [];
      webBridge.on('replace', (payload) => received.push(payload));

      const sampleUnit: ConsultaUnit = {
        index: 0,
        noteId: noteId,
        deckPath: 'Cardiologia',
        frontHtml: 'Frente editada',
        backHtml: 'Verso editado',
        tags: ['novo'],
        suspended: false,
        annotations: [],
      };

      rnBridge.sendReplace([sampleUnit]);
      await flush();

      expect(received).toHaveLength(1);
      const first = received[0] as { units: unknown[] };
      expect(first.units).toHaveLength(1);
    });

    test('sendGoto emite goto com unitIndex e annotationId', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const received: unknown[] = [];
      webBridge.on('goto', (payload) => received.push(payload));

      rnBridge.sendGoto(12, 'ann-42');
      await flush();

      expect(received).toEqual([{ unitIndex: 12, annotationId: 'ann-42' }]);
    });

    test('sendTheme e sendFontSize transmitem alterações visuais', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const themes: string[] = [];
      const fontSizes: number[] = [];

      webBridge.on('setTheme', (p) => themes.push(p.theme));
      webBridge.on('setFontSize', (p) => fontSizes.push(p.fontSize));

      rnBridge.sendTheme('dark');
      rnBridge.sendFontSize(22);
      await flush();

      expect(themes).toEqual(['dark']);
      expect(fontSizes).toEqual([22]);
    });
  });

  describe('Eventos Web → RN e persistência automática (§8)', () => {
    test('needMore notifica listener cadastrado com índice da unidade', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const received: number[] = [];
      rnBridge.onNeedMore((after: number) => received.push(after));

      webBridge.emit('needMore', { after: 29 });
      await flush();

      expect(received).toEqual([29]);
    });

    test('openEditor notifica listener com noteId', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const received: string[] = [];
      rnBridge.onOpenEditor((id: string) => received.push(id));

      webBridge.emit('openEditor', { noteId: 'note-123' });
      await flush();

      expect(received).toEqual(['note-123']);
    });

    test('position salva automaticamente em consulta_pos e notifica listener', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges({ deckQuery: deckId });
      const received: { unitIndex: number; offset: number }[] = [];
      rnBridge.onPosition((pos: { unitIndex: number; offset: number }) => received.push(pos));

      webBridge.emit('position', { unitIndex: 7, offset: 180.5 });
      await flush();

      expect(received).toEqual([{ unitIndex: 7, offset: 180.5 }]);

      // Persistência em consulta_pos
      const posRecord = consultaPosRepo.get(deckId);
      expect(posRecord).not.toBeNull();
      expect(posRecord?.unit_index).toBe(7);
      expect(posRecord?.scroll_offset).toBe(180.5);
    });

    test('setFont e setColor persistem preferências em settingsRepo', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const fonts: number[] = [];
      const colors: string[] = [];

      rnBridge.onSetFont((f: number) => fonts.push(f));
      rnBridge.onSetColor((c: string) => colors.push(c));

      webBridge.emit('setFont', 24);
      webBridge.emit('setColor', 'rosa');
      await flush();

      expect(fonts).toEqual([24]);
      expect(colors).toEqual(['rosa']);

      expect(settingsRepo.get<number>('fontSize')).toBe(24);
      expect(settingsRepo.get<string>('lastHighlightColor')).toBe('rosa');
    });

    test('menuAction notifica listener de ações do menu contextual', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const actions: unknown[] = [];
      rnBridge.onMenuAction((payload: { action: 'toggleSuspend' | 'review'; noteId: string; unitIndex: number }) => actions.push(payload));

      webBridge.emit('menuAction', {
        action: 'toggleSuspend',
        noteId: noteId,
        unitIndex: 0,
      });
      await flush();

      expect(actions).toEqual([
        { action: 'toggleSuspend', noteId: noteId, unitIndex: 0 },
      ]);
    });

    test('annotationDeleted notifica deleção de grifo vinda da WebView', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const deletedEvents: unknown[] = [];
      rnBridge.onAnnotationDeleted((payload: { annotation: SavedAnnotation; unitIndex: number }) =>
        deletedEvents.push(payload)
      );

      const sampleAnn = {
        id: 'ann-1',
        note_id: noteId,
        group_key: null,
        kind: 'hl' as const,
        color: 'amarelo' as const,
        quote: 'teste',
        prefix: '',
        suffix: '',
        start: 0,
        end: 5,
        note: '',
        label: '',
        created_at: 1000,
        updated_at: 1000,
      };

      webBridge.emit('annotationDeleted', {
        annotation: sampleAnn,
        unitIndex: 2,
      });
      await flush();

      expect(deletedEvents).toEqual([
        { annotation: sampleAnn, unitIndex: 2 },
      ]);
    });

    test('sendRestoreAnnotation envia evento restoreAnnotation para a WebView', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const restoredEvents: unknown[] = [];
      webBridge.on('restoreAnnotation', (payload) => restoredEvents.push(payload));

      const sampleAnn = {
        id: 'ann-1',
        note_id: noteId,
        group_key: null,
        kind: 'hl' as const,
        color: 'amarelo' as const,
        quote: 'teste',
        prefix: '',
        suffix: '',
        start: 0,
        end: 5,
        note: '',
        label: '',
        created_at: 1000,
        updated_at: 1000,
      };

      rnBridge.sendRestoreAnnotation(sampleAnn, 3);
      await flush();

      expect(restoredEvents).toEqual([
        { annotation: sampleAnn, unitIndex: 3 },
      ]);
    });

    test('sendGoto emite goto com offset para a WebView', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      const gotoEvents: unknown[] = [];
      webBridge.on('goto', (payload) => gotoEvents.push(payload));

      rnBridge.sendGoto(12, undefined, 240);
      await flush();

      expect(gotoEvents).toEqual([{ unitIndex: 12, annotationId: undefined, offset: 240 }]);
    });

    test('sendFlushPosition emite flushPosition para a WebView', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges();
      let flushed = false;
      webBridge.on('flushPosition', () => {
        flushed = true;
      });

      rnBridge.sendFlushPosition();
      await flush();

      expect(flushed).toBe(true);
    });

    test('dispose salva última posição reportada em consulta_pos', async () => {
      const { rnBridge, webBridge } = setupConnectedBridges({ deckQuery: deckId });
      webBridge.emit('position', { unitIndex: 19, offset: 350 });
      await flush();

      rnBridge.dispose();

      const saved = consultaPosRepo.get(deckId);
      expect(saved).not.toBeNull();
      expect(saved?.unit_index).toBe(19);
      expect(saved?.scroll_offset).toBe(350);
    });

    test('dispose limpa listeners e endpoints', () => {
      const { rnBridge } = setupConnectedBridges();
      expect(() => rnBridge.dispose()).not.toThrow();
    });
  });
});
