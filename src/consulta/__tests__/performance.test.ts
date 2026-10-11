/**
 * @jest-environment jsdom
 */

import { createTestDatabase } from '@/db/__tests__/test-utils';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { DecksRepository } from '@/db/repositories/decks';
import {
  loadConsultaUnits,
  countConsultaUnits,
  type ConsultaUnit,
} from '../units';
import { toConsultaUnitWeb } from '../bridge';
import { renderUnitsBatch } from '@/webview/consulta/renderer';
import { computeReadingPosition } from '@/webview/consulta/navigation';
import type { ConsultaUnitWeb } from '@/webview/consulta/types';

/**
 * Utilitário que semeia um deck com subdeck e 5.000 notas autorais [EXEMPLO],
 * seus cards correspondentes e 100 anotações de teste para validação de performance.
 */
export function seed5000NotesDeck(context: ReturnType<typeof createTestDatabase>): {
  parentDeckId: string;
  subdeckId: string;
  totalNotes: number;
  totalAnnotations: number;
} {
  const { rawDb, db } = context;

  // Garante os note types embutidos (Básico e Cloze)
  const noteTypesRepo = new NoteTypesRepository(db);
  noteTypesRepo.seedBuiltins();

  const decksRepo = new DecksRepository(db);
  const parentDeck = decksRepo.create({ name: 'Farmacologia' });
  const subdeck = decksRepo.create({ name: 'Farmacologia::Antibióticos' });

  const totalNotes = 5000;
  const parentNotesCount = 3000;
  const subdeckNotesCount = 2000;
  const annotationsCount = 100;

  const now = Date.now();

  rawDb.exec('BEGIN TRANSACTION;');

  const insertNoteStmt = rawDb.prepare(`
    INSERT INTO notes (id, deck_id, note_type_id, fields, tags, source_id, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCardStmt = rawDb.prepare(`
    INSERT INTO cards (id, note_id, deck_id, ord, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, suspended, buried_until, source_id, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAnnStmt = rawDb.prepare(`
    INSERT INTO annotations (id, note_id, group_key, kind, color, quote, prefix, suffix, start, end, note, label, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insere 3.000 notas no deck pai (Básico)
  for (let i = 0; i < parentNotesCount; i++) {
    const noteId = `perf-note-parent-${i.toString().padStart(5, '0')}`;
    const cardId = `perf-card-parent-${i.toString().padStart(5, '0')}`;
    const createdAt = now + i;

    const fieldsJson = JSON.stringify({
      Frente: `[EXEMPLO] Qual é o mecanismo de ação da droga #${i}?`,
      Verso: `[EXEMPLO] A droga #${i} atua inibindo seletivamente a enzima alvo do sistema cardiovascular.`,
    });
    const tagsJson = JSON.stringify(['exemplo', 'farmaco', `classe-${i % 20}`]);

    insertNoteStmt.run(
      noteId,
      parentDeck.id,
      BUILTIN_NOTE_TYPE_IDS.BASIC,
      fieldsJson,
      tagsJson,
      null,
      createdAt,
      createdAt,
      null
    );

    insertCardStmt.run(
      cardId,
      noteId,
      parentDeck.id,
      0,
      createdAt,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      i % 50 === 0 ? 1 : 0, // 2% suspensos
      null,
      null,
      createdAt,
      createdAt,
      null
    );

    // Insere anotação em notas selecionadas (a cada 50 notas até atingir 60)
    if (i < 60 * 50 && i % 50 === 0) {
      const annId = `perf-ann-parent-${i}`;
      insertAnnStmt.run(
        annId,
        noteId,
        null,
        'hl',
        'amarelo',
        'inibindo seletivamente',
        '[EXEMPLO] A droga #... atua ',
        ' a enzima alvo do sistema...',
        30,
        51,
        i % 100 === 0 ? 'Nota importante sobre o mecanismo' : '',
        '',
        createdAt,
        createdAt,
        null
      );
    }
  }

  // Insere 2.000 notas no subdeck (Cloze)
  for (let i = 0; i < subdeckNotesCount; i++) {
    const noteId = `perf-note-sub-${i.toString().padStart(5, '0')}`;
    const cardId = `perf-card-sub-${i.toString().padStart(5, '0')}`;
    const createdAt = now + parentNotesCount + i;

    const fieldsJson = JSON.stringify({
      Texto: `[EXEMPLO] O antibiótico {{c1::Penicilina #${i}}} inibe a síntese de {{c2::parede celular bacteriana}}.`,
      Extra: `[EXEMPLO] Uso clínico frequente em infecções por gram-positivos #${i}.`,
    });
    const tagsJson = JSON.stringify(['exemplo', 'antibioticos', `beta-lactamico-${i % 10}`]);

    insertNoteStmt.run(
      noteId,
      subdeck.id,
      BUILTIN_NOTE_TYPE_IDS.CLOZE,
      fieldsJson,
      tagsJson,
      null,
      createdAt,
      createdAt,
      null
    );

    insertCardStmt.run(
      cardId,
      noteId,
      subdeck.id,
      0,
      createdAt,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      0,
      null,
      null,
      createdAt,
      createdAt,
      null
    );

    // Insere anotações no subdeck (40 anotações)
    if (i < 40 * 50 && i % 50 === 0) {
      const annId = `perf-ann-sub-${i}`;
      insertAnnStmt.run(
        annId,
        noteId,
        null,
        'ul',
        'verde',
        'parede celular',
        'inibe a síntese de ',
        ' bacteriana.',
        45,
        59,
        'Alvo estrutural',
        '',
        createdAt,
        createdAt,
        null
      );
    }
  }

  rawDb.exec('COMMIT;');

  return {
    parentDeckId: parentDeck.id,
    subdeckId: subdeck.id,
    totalNotes,
    totalAnnotations: annotationsCount,
  };
}

describe('Teste de Performance do Modo Consulta com 5.000 Notas (MODO_CONSULTA.md §9)', () => {
  let context: ReturnType<typeof createTestDatabase>;
  let seededData: ReturnType<typeof seed5000NotesDeck>;

  beforeAll(() => {
    context = createTestDatabase();
    const seedStart = performance.now();
    seededData = seed5000NotesDeck(context);
    const seedDuration = performance.now() - seedStart;
    expect(seededData.totalNotes).toBe(5000);
    // Geração em lote via transação SQLite deve ser extremamente rápida (< 1500 ms)
    expect(seedDuration).toBeLessThan(1500);
  });

  describe('Critério §9: Abrir a Consulta de um deck com 5.000 notas em menos de 1 s', () => {
    test('carrega primeiro lote de 30 unidades e renderiza no DOM em menos de 1.000 ms', () => {
      const startOpen = performance.now();

      // 1. Contagem total de unidades (para configurar barra de progresso / hasMore)
      const countStart = performance.now();
      const totalCount = countConsultaUnits({
        db: context.db,
        deckId: seededData.parentDeckId,
        includeSubdecks: true,
      });
      const countTime = performance.now() - countStart;

      expect(totalCount).toBe(5000);

      // 2. Carrega o primeiro lote de 30 unidades da Consulta
      const loadStart = performance.now();
      const batchUnits: ConsultaUnit[] = loadConsultaUnits({
        db: context.db,
        deckId: seededData.parentDeckId,
        includeSubdecks: true,
        limit: 30,
        offset: 0,
      });
      const loadTime = performance.now() - loadStart;

      expect(batchUnits).toHaveLength(30);
      expect(batchUnits[0].index).toBe(0);
      expect(batchUnits[29].index).toBe(29);

      // 3. Converte para o contrato Web da WebView
      const webUnits: ConsultaUnitWeb[] = batchUnits.map((u) => toConsultaUnitWeb(u));

      // 4. Renderiza o lote no DOM (simulando a WebView)
      const renderStart = performance.now();
      const container = document.createElement('div');
      container.id = 'units-list';
      document.body.appendChild(container);

      const renderResult = renderUnitsBatch(container, webUnits, {
        lastDeckPath: '',
      });
      const renderTime = performance.now() - renderStart;

      const totalOpenTime = performance.now() - startOpen;

      // Validações de integridade da UI
      expect(renderResult.renderedCount).toBe(30);
      expect(container.querySelectorAll('.consulta-unit')).toHaveLength(30);
      expect(container.querySelector('.deck-section-header')).not.toBeNull();

      // Critério central da especificação MODO_CONSULTA.md §9:
      // "Abrir a Consulta de um deck com 5.000 notas: primeiro lote visível em menos de 1 s"
      expect(totalOpenTime).toBeLessThan(1000);

      // Limpeza
      container.remove();

      // Registra métricas de tempo para verificação
      expect(countTime).toBeLessThan(500);
      expect(loadTime).toBeLessThan(500);
      expect(renderTime).toBeLessThan(500);
    });

    test('preserva dados essenciais da primeira unidade (frente, verso, tags, status suspenso)', () => {
      const units = loadConsultaUnits({
        db: context.db,
        deckId: seededData.parentDeckId,
        includeSubdecks: true,
        limit: 1,
        offset: 0,
      });

      expect(units).toHaveLength(1);
      const first = units[0];
      expect(first.index).toBe(0);
      expect(first.deckPath).toBe('Farmacologia');
      expect(first.frontHtml).toContain('Qual é o mecanismo de ação da droga #0?');
      expect(first.backHtml).toContain('A droga #0 atua inibindo seletivamente');
      expect(first.tags).toEqual(['exemplo', 'farmaco', 'classe-0']);
      expect(first.suspended).toBe(true); // nota 0 foi marcada como suspensa
      expect(first.annotations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Critério §9: Rolar até o fim sem travar (carregamento contínuo dos 167 lotes)', () => {
    test('percorre todos os lotes de 30 unidades até 5.000 notas de forma rápida e estável', () => {
      const batchSize = 30;
      const totalNotes = seededData.totalNotes;
      const totalBatches = Math.ceil(totalNotes / batchSize);

      const container = document.createElement('div');
      container.id = 'units-list-full-scroll';
      document.body.appendChild(container);

      let currentDeckPath = '';
      let totalRendered = 0;
      const batchTimes: number[] = [];

      const fullScrollStart = performance.now();

      for (let offset = 0; offset < totalNotes; offset += batchSize) {
        const batchStart = performance.now();

        const units = loadConsultaUnits({
          db: context.db,
          deckId: seededData.parentDeckId,
          includeSubdecks: true,
          limit: batchSize,
          offset,
        });

        const webUnits = units.map((u) => toConsultaUnitWeb(u));
        const res = renderUnitsBatch(container, webUnits, {
          lastDeckPath: currentDeckPath,
        });

        currentDeckPath = res.lastDeckPath;
        totalRendered += res.renderedCount;

        const batchElapsed = performance.now() - batchStart;
        batchTimes.push(batchElapsed);
      }

      const totalScrollDuration = performance.now() - fullScrollStart;
      const averageBatchTime =
        batchTimes.reduce((acc, t) => acc + t, 0) / batchTimes.length;

      // Validações de integridade
      expect(totalRendered).toBe(5000);
      expect(container.querySelectorAll('.consulta-unit')).toHaveLength(5000);
      expect(batchTimes).toHaveLength(totalBatches);

      // Cada lote de 30 deve levar muito pouco tempo (média < 100 ms por lote no ambiente de teste)
      expect(averageBatchTime).toBeLessThan(100);

      // O tempo total de carregar e renderizar todas as 5.000 notas no DOM
      // (167 lotes consecutivos) não deve estagnar nem travar
      expect(totalScrollDuration).toBeLessThan(25000);

      // O cálculo de posição de leitura deve responder sem travar no DOM com 5.000 unidades
      const posStart = performance.now();
      const pos = computeReadingPosition(container);
      const posTime = performance.now() - posStart;

      expect(pos).not.toBeNull();
      expect(posTime).toBeLessThan(200);

      // Limpeza
      container.remove();
    });
  });

  describe('Busca e filtros de anotação com 5.000 notas', () => {
    test('filtro onlyWithAnnotations retorna rapidamente apenas as notas anotadas', () => {
      const start = performance.now();
      const unitsWithAnn = loadConsultaUnits({
        db: context.db,
        deckId: seededData.parentDeckId,
        includeSubdecks: true,
        onlyWithAnnotations: true,
      });
      const duration = performance.now() - start;

      expect(unitsWithAnn.length).toBe(100);
      expect(unitsWithAnn.every((u) => u.annotations.length > 0)).toBe(true);
      expect(duration).toBeLessThan(1500);
    });

    test('busca textual por termo específico encontra a unidade certa entre 5.000 notas', () => {
      const start = performance.now();
      const searchResults = loadConsultaUnits({
        db: context.db,
        deckId: seededData.parentDeckId,
        includeSubdecks: true,
        searchQuery: 'Penicilina #1999',
      });
      const duration = performance.now() - start;

      expect(searchResults.length).toBe(1);
      expect(searchResults[0].deckPath).toBe('Farmacologia::Antibióticos');
      expect(searchResults[0].frontHtml).toContain('Penicilina #1999');
      expect(duration).toBeLessThan(2000);
    });

    test('busca por tag filtra corretamente entre 5.000 notas', () => {
      const searchResults = loadConsultaUnits({
        db: context.db,
        deckId: seededData.parentDeckId,
        includeSubdecks: true,
        searchQuery: '#classe-5',
        limit: 50,
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.every((u) => u.tags.includes('classe-5'))).toBe(true);
    });
  });
});
