import { createTestDatabase, seedBasicNoteType } from '../../db/__tests__/test-utils';
import { DecksRepository } from '../../db/repositories/decks';
import { NotesRepository } from '../../db/repositories/notes';
import { ConsultaPosRepository } from '../../db/repositories/consulta-pos';
import { SettingsRepository, DEFAULT_SETTINGS } from '../../db/repositories/settings';
import { createConsultaRnBridge, type ConsultaRnBridge } from '../bridge';
import { loadConsultaUnits } from '../units';
import { createBridgeEndpoint, type BridgeEndpoint } from '../../webview/shared/bridge';
import type {
  RnToWebEvents,
  RnToWebRequests,
  WebToRnEvents,
  WebToRnRequests,
} from '../../webview/consulta/protocol';
import { strings } from '../../ui/strings';

describe('Fonte A−/A+ e Continuar Lendo (consulta_pos) (MODO_CONSULTA.md §1, §3, §8, §9)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let consultaPosRepo: ConsultaPosRepository;
  let settingsRepo: SettingsRepository;
  let deckId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;

    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    consultaPosRepo = new ConsultaPosRepository(db);
    settingsRepo = new SettingsRepository(db);

    const noteTypeId = seedBasicNoteType(db);
    const deck = decksRepo.create({ name: 'Cardiologia::Insuficiência Cardíaca' });
    deckId = deck.id;

    // Cria algumas notas para teste de carregamento e paginação
    for (let i = 0; i < 25; i++) {
      notesRepo.create({
        deck_id: deckId,
        note_type_id: noteTypeId,
        fields: { Front: `Frente ${i}`, Back: `Verso da nota ${i}` },
        tags: ['ic'],
      });
    }
  });

  describe('Fonte A−/A+ (14 a 26 px, padrão 17 px)', () => {
    test('configurações padrão incluem fontSize = 17', () => {
      expect(DEFAULT_SETTINGS.fontSize).toBe(17);
      const val = settingsRepo.getWithDefault('fontSize', DEFAULT_SETTINGS.fontSize);
      expect(val).toBe(17);
    });

    test('permite alterar e persistir tamanhos de 14 a 26 px no settingsRepo', () => {
      // Salva 14 (mínimo)
      settingsRepo.set('fontSize', 14);
      expect(settingsRepo.get<number>('fontSize')).toBe(14);

      // Salva 26 (máximo)
      settingsRepo.set('fontSize', 26);
      expect(settingsRepo.get<number>('fontSize')).toBe(26);

      // Incrementa e decrementa
      let current = 17;
      const stepUp = Math.min(26, current + 1);
      settingsRepo.set('fontSize', stepUp);
      expect(settingsRepo.get<number>('fontSize')).toBe(18);

      current = 14;
      const stepDown = Math.max(14, current - 1);
      expect(stepDown).toBe(14); // não desce abaixo do mínimo
    });

    test('ponte RN sincroniza setFontSize para a WebView e persiste setFont recebido', async () => {
      const wireRnToWeb: string[] = [];
      const wireWebToRn: string[] = [];

      let rnBridgeRef: ConsultaRnBridge | null = null;
      const webBridge: BridgeEndpoint<
        WebToRnEvents,
        WebToRnRequests,
        RnToWebEvents,
        RnToWebRequests
      > = createBridgeEndpoint({
        side: 'web',
        post: (raw) => {
          wireWebToRn.push(raw);
          queueMicrotask(() => rnBridgeRef?.receive(raw));
        },
      });

      const rnBridge = createConsultaRnBridge({
        post: (raw) => {
          wireRnToWeb.push(raw);
          queueMicrotask(() => webBridge.receive(raw));
        },
        settingsRepo,
        deckQuery: deckId,
      });
      rnBridgeRef = rnBridge;

      const fontSizesReceivedInWeb: number[] = [];
      webBridge.on('setFontSize', (payload) => {
        fontSizesReceivedInWeb.push(payload.fontSize);
      });

      // RN envia alteração de fonte
      rnBridge.sendFontSize(22);
      await new Promise((r) => setTimeout(r, 10));

      expect(fontSizesReceivedInWeb).toEqual([22]);

      // Web avisa alteração de fonte feita internamente
      webBridge.emit('setFont', 19);
      await new Promise((r) => setTimeout(r, 10));

      expect(settingsRepo.get<number>('fontSize')).toBe(19);

      rnBridge.dispose();
      webBridge.dispose();
    });
  });

  describe('Continuar Lendo (consulta_pos)', () => {
    test('grava e atualiza posição de leitura por deckQuery', () => {
      const rec1 = consultaPosRepo.save(deckId, 5, 120);
      expect(rec1.deck_query).toBe(deckId);
      expect(rec1.unit_index).toBe(5);
      expect(rec1.scroll_offset).toBe(120);

      const fetched = consultaPosRepo.get(deckId);
      expect(fetched).not.toBeNull();
      expect(fetched?.unit_index).toBe(5);
      expect(fetched?.scroll_offset).toBe(120);

      // Atualiza posição do mesmo deck
      const rec2 = consultaPosRepo.save(deckId, 12, 350);
      expect(rec2.unit_index).toBe(12);
      expect(rec2.scroll_offset).toBe(350);

      const fetchedUpdated = consultaPosRepo.get(deckId);
      expect(fetchedUpdated?.unit_index).toBe(12);
      expect(fetchedUpdated?.scroll_offset).toBe(350);
    });

    test('getLatest retorna a leitura mais recente entre múltiplos decks', async () => {
      const deck2 = decksRepo.create({ name: 'Medicina::Farmacologia' });

      consultaPosRepo.save(deckId, 3, 50);
      await new Promise((r) => setTimeout(r, 15));
      consultaPosRepo.save(deck2.id, 8, 200);

      const latest = consultaPosRepo.getLatest();
      expect(latest).not.toBeNull();
      expect(latest?.deck_query).toBe(deck2.id);
      expect(latest?.unit_index).toBe(8);
      expect(latest?.scroll_offset).toBe(200);
    });

    test('evento position da WebView persiste automaticamente no banco', async () => {
      const wireRnToWeb: string[] = [];
      const wireWebToRn: string[] = [];

      let rnBridgeRef: ConsultaRnBridge | null = null;
      const webBridge = createBridgeEndpoint<
        WebToRnEvents,
        WebToRnRequests,
        RnToWebEvents,
        RnToWebRequests
      >({
        side: 'web',
        post: (raw) => {
          wireWebToRn.push(raw);
          queueMicrotask(() => rnBridgeRef?.receive(raw));
        },
      });

      const rnBridge = createConsultaRnBridge({
        post: (raw) => {
          wireRnToWeb.push(raw);
          queueMicrotask(() => webBridge.receive(raw));
        },
        consultaPosRepo,
        deckQuery: deckId,
      });
      rnBridgeRef = rnBridge;

      // Simula WebView reportando posição de leitura (após 1s de debounce)
      webBridge.emit('position', { unitIndex: 14, offset: 275.5 });
      await new Promise((r) => setTimeout(r, 10));

      const pos = consultaPosRepo.get(deckId);
      expect(pos).not.toBeNull();
      expect(pos?.unit_index).toBe(14);
      expect(pos?.scroll_offset).toBe(275.5);

      rnBridge.dispose();
      webBridge.dispose();
    });

    test('flushPosition e dispose salvam a última posição de leitura', async () => {
      let rnBridgeRef: ConsultaRnBridge | null = null;
      const webBridge = createBridgeEndpoint<
        WebToRnEvents,
        WebToRnRequests,
        RnToWebEvents,
        RnToWebRequests
      >({
        side: 'web',
        post: (raw) => {
          queueMicrotask(() => rnBridgeRef?.receive(raw));
        },
      });

      const rnBridge = createConsultaRnBridge({
        post: (raw) => {
          queueMicrotask(() => webBridge.receive(raw));
        },
        consultaPosRepo,
        deckQuery: deckId,
      });
      rnBridgeRef = rnBridge;

      let flushReceived = false;
      webBridge.on('flushPosition', () => {
        flushReceived = true;
        // Na prática a WebView executa emitPosition.flush(), emitindo position
        webBridge.emit('position', { unitIndex: 20, offset: 410 });
      });

      rnBridge.sendFlushPosition();
      await new Promise((r) => setTimeout(r, 10));

      expect(flushReceived).toBe(true);

      rnBridge.dispose();

      const pos = consultaPosRepo.get(deckId);
      expect(pos).not.toBeNull();
      expect(pos?.unit_index).toBe(20);
      expect(pos?.scroll_offset).toBe(410);

      webBridge.dispose();
    });

    test('ao carregar deck com posição salva, carrega lote suficiente para alcançar o targetUnitIndex', () => {
      consultaPosRepo.save(deckId, 18, 150);

      const saved = consultaPosRepo.get(deckId);
      expect(saved).not.toBeNull();

      const targetUnitIndex = saved!.unit_index;
      const batchSize = 30;
      const initialLimit = Math.max(batchSize, targetUnitIndex + 1 + 10);

      const units = loadConsultaUnits({
        db,
        deckId,
        limit: initialLimit,
        offset: 0,
        includeSubdecks: true,
      });

      expect(units.length).toBeGreaterThanOrEqual(19);
      expect(units.some((u) => u.index === targetUnitIndex)).toBe(true);
    });

    test('strings de posição de leitura formatam corretamente para UI', () => {
      expect(strings.consulta.readingPositionUnit(5)).toBe('Unidade 5');
      expect(strings.consulta.readingPositionStart).toBe('Início');
      expect(strings.consulta.fontSizeDecrease).toBe('Diminuir fonte');
      expect(strings.consulta.fontSizeIncrease).toBe('Aumentar fonte');
    });
  });
});
