import { createTestDatabase, seedBasicNoteType } from '@/db/__tests__/test-utils';
import { SettingsRepository } from '@/db/repositories/settings';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import {
  calculate14DayReviewCount,
  generateTestStatsExportText,
  getTestStats,
} from '../testStats';

describe('Estatísticas do Teste (PRD §4)', () => {
  describe('calculate14DayReviewCount', () => {
    const fixedNow = new Date('2026-10-15T12:00:00Z');
    const DAY_MS = 86_400_000;

    test('retorna 0 para histórico vazio de revisões', () => {
      expect(calculate14DayReviewCount([], { now: fixedNow })).toBe(0);
    });

    test('conta dias únicos com revisão na janela de 14 dias', () => {
      // Cria revisões para hoje, ontem, 3 dias atrás e 7 dias atrás
      const nowMs = fixedNow.getTime();
      const timestamps = [
        nowMs, // hoje
        nowMs - 1 * DAY_MS, // 1 dia atrás
        nowMs - 1 * DAY_MS + 3600_000, // 1 dia atrás (outra revisão no mesmo dia)
        nowMs - 3 * DAY_MS, // 3 dias atrás
        nowMs - 7 * DAY_MS, // 7 dias atrás
      ];

      const count = calculate14DayReviewCount(timestamps, { now: fixedNow });
      expect(count).toBe(4);
    });

    test('ignora revisões que ocorreram antes da janela de 14 dias', () => {
      const nowMs = fixedNow.getTime();
      const timestamps = [
        nowMs, // hoje (dia 0) -> dentro
        nowMs - 13 * DAY_MS, // 13 dias atrás -> dentro (limite)
        nowMs - 14 * DAY_MS - 3600_000, // 14+ dias atrás -> fora da janela de 14 dias
        nowMs - 30 * DAY_MS, // 30 dias atrás -> fora
      ];

      const count = calculate14DayReviewCount(timestamps, { now: fixedNow });
      expect(count).toBe(2);
    });

    test('respeita rolloverHour na separação dos dias de estudo', () => {
      // 03:00 da manhã no dia 15 com rollover às 04:00 pertence ao dia de estudo 14
      const earlyMorning15 = new Date('2026-10-15T03:00:00').getTime();
      const afternoon14 = new Date('2026-10-14T15:00:00').getTime();

      const count = calculate14DayReviewCount([earlyMorning15, afternoon14], {
        now: new Date('2026-10-15T12:00:00'),
        rolloverHour: 4,
      });

      // Ambas as revisões caíram no mesmo dia de estudo (dia 14)
      expect(count).toBe(1);
    });
  });

  describe('getTestStats', () => {
    let db: ReturnType<typeof createTestDatabase>['db'];
    let settingsRepo: SettingsRepository;
    let annotationsRepo: AnnotationsRepository;
    let decksRepo: DecksRepository;
    let notesRepo: NotesRepository;
    let noteTypeId: string;
    let defaultDeckId: string;

    beforeEach(() => {
      const ctx = createTestDatabase();
      db = ctx.db;
      settingsRepo = new SettingsRepository(db);
      annotationsRepo = new AnnotationsRepository(db);
      decksRepo = new DecksRepository(db);
      notesRepo = new NotesRepository(db);

      noteTypeId = seedBasicNoteType(db);
      const deck = decksRepo.create({ name: 'Medicina' });
      defaultDeckId = deck.id;
    });

    test('calcula status das 3 hipóteses quando vazias', () => {
      const stats = getTestStats({ db, now: new Date('2026-10-15T12:00:00Z') });

      expect(stats.hypothesis1.isMet).toBe(false);
      expect(stats.hypothesis1.daysReviewedIn14Days).toBe(0);
      expect(stats.hypothesis1.targetDays).toBe(10);
      expect(stats.hypothesis1.windowDays).toBe(14);

      expect(stats.hypothesis2.isMet).toBe(false);
      expect(stats.hypothesis2.consultaOpenCount).toBe(0);
      expect(stats.hypothesis2.annotationsCount).toBe(0);

      expect(stats.hypothesis3.isMet).toBe(false);
      expect(stats.hypothesis3.hasImportedApkg).toBe(false);

      expect(stats.totalGoalsMet).toBe(0);
      expect(stats.exportText).toContain('=== FOLIO · ESTATÍSTICAS DO TESTE (PRD §4) ===');
    });

    test('marca Hipótese 1 como atingida quando há 10 ou mais dias com revisão', () => {
      const DAY_MS = 86_400_000;
      const now = new Date('2026-10-15T12:00:00Z');
      const nowMs = now.getTime();

      // Gera revisões em 10 dias distintos dentro dos últimos 14 dias
      const reviewTimestamps: number[] = [];
      for (let i = 0; i < 10; i++) {
        reviewTimestamps.push(nowMs - i * DAY_MS);
      }

      const stats = getTestStats({
        db,
        now,
        reviewTimestamps,
        currentStreak: 10,
        retentionRate: 0.92,
      });

      expect(stats.hypothesis1.daysReviewedIn14Days).toBe(10);
      expect(stats.hypothesis1.isMet).toBe(true);
      expect(stats.totalGoalsMet).toBe(1);
    });

    test('marca Hipótese 2 como atingida quando Consulta >= 3 aberturas e >= 5 grifos', () => {
      const now = Date.now();
      const note = notesRepo.create({
        deck_id: defaultDeckId,
        note_type_id: noteTypeId,
        fields: { Frente: 'Pergunta', Verso: 'Resposta com texto longo' },
        tags: [],
      });

      // Insere 5 anotações na nota existente
      for (let i = 0; i < 5; i++) {
        annotationsRepo.create({
          note_id: note.id,
          kind: 'hl',
          color: 'amarelo',
          quote: `Trecho anotado ${i}`,
          start: i * 2,
          end: i * 2 + 2,
        });
      }

      // Consulta aberta 2 vezes (abaixo da meta de 3)
      settingsRepo.set('consultaOpenCount', 2);
      let stats = getTestStats({ db, now });
      expect(stats.hypothesis2.isOpensMet).toBe(false);
      expect(stats.hypothesis2.isAnnotationsMet).toBe(true);
      expect(stats.hypothesis2.isMet).toBe(false);

      // Incrementa para 3 aberturas
      settingsRepo.set('consultaOpenCount', 3);
      stats = getTestStats({ db, now });
      expect(stats.hypothesis2.isOpensMet).toBe(true);
      expect(stats.hypothesis2.isAnnotationsMet).toBe(true);
      expect(stats.hypothesis2.isMet).toBe(true);
      expect(stats.totalGoalsMet).toBe(1);
    });

    test('marca Hipótese 3 como atingida via apkgImportCount ou decks com source_id', () => {
      // Inicialmente não atingida
      let stats = getTestStats({ db });
      expect(stats.hypothesis3.isMet).toBe(false);

      // Teste via apkgImportCount
      settingsRepo.set('apkgImportCount', 1);
      stats = getTestStats({ db });
      expect(stats.hypothesis3.isMet).toBe(true);
      expect(stats.hypothesis3.hasImportedApkg).toBe(true);

      // Reseta apkgImportCount e testa via deck com source_id
      settingsRepo.set('apkgImportCount', 0);
      decksRepo.create({ name: 'Anki Importado', source_id: 'anki-deck-123' });
      stats = getTestStats({ db });
      expect(stats.hypothesis3.isMet).toBe(true);
      expect(stats.hypothesis3.importedDecksCount).toBe(1);
    });

    test('marca todas as 3 hipóteses como atingidas e computa totalGoalsMet = 3', () => {
      const DAY_MS = 86_400_000;
      const now = new Date('2026-10-15T12:00:00Z');
      const nowMs = now.getTime();

      // H1: 12 dias de revisão
      const reviewTimestamps: number[] = [];
      for (let i = 0; i < 12; i++) {
        reviewTimestamps.push(nowMs - i * DAY_MS);
      }

      // H2: 4 aberturas e 6 anotações
      settingsRepo.set('consultaOpenCount', 4);
      const noteH2 = notesRepo.create({
        deck_id: defaultDeckId,
        note_type_id: noteTypeId,
        fields: { Frente: 'H2 Frente', Verso: 'H2 Verso com texto bastante longo para vários grifos' },
        tags: [],
      });
      for (let i = 0; i < 6; i++) {
        annotationsRepo.create({
          note_id: noteH2.id,
          kind: 'hl',
          color: 'verde',
          quote: `Grifo ${i}`,
          start: i * 2,
          end: i * 2 + 2,
        });
      }

      // H3: 1 importação de apkg
      settingsRepo.set('apkgImportCount', 1);

      const stats = getTestStats({
        db,
        now,
        reviewTimestamps,
        currentStreak: 12,
        retentionRate: 0.88,
      });

      expect(stats.hypothesis1.isMet).toBe(true);
      expect(stats.hypothesis2.isMet).toBe(true);
      expect(stats.hypothesis3.isMet).toBe(true);
      expect(stats.totalGoalsMet).toBe(3);

      expect(stats.exportText).toContain('Metas atingidas: 3/3');
      expect(stats.exportText).toContain('Status: [ATINGIDA]');
    });
  });

  describe('generateTestStatsExportText', () => {
    test('formata relatório de texto completo e legível', () => {
      const text = generateTestStatsExportText(
        {
          hypothesis1: {
            daysReviewedIn14Days: 11,
            targetDays: 10,
            windowDays: 14,
            isMet: true,
            currentStreak: 5,
            totalReviews: 240,
          },
          hypothesis2: {
            consultaOpenCount: 6,
            targetOpens: 3,
            isOpensMet: true,
            annotationsCount: 12,
            targetAnnotations: 5,
            isAnnotationsMet: true,
            isMet: true,
          },
          hypothesis3: {
            hasImportedApkg: true,
            apkgImportCount: 1,
            importedDecksCount: 2,
            importedCardsCount: 350,
            isMet: true,
          },
          totalGoalsMet: 3,
          retentionRate: 0.91,
          generatedAt: new Date('2026-10-15T18:00:00Z').getTime(),
        },
        {
          appVersion: '0.1.0',
          totalCards: 350,
        }
      );

      expect(text).toContain('=== FOLIO · ESTATÍSTICAS DO TESTE (PRD §4) ===');
      expect(text).toContain('Metas atingidas: 3/3');
      expect(text).toContain('11/14 dias');
      expect(text).toContain('Aberturas da Consulta: 6/3');
      expect(text).toContain('Grifos e anotações criados: 12/5');
      expect(text).toContain('Importou arquivo .apkg: Sim');
      expect(text).toContain('Total de cards no banco: 350');
      expect(text).toContain('Taxa de retenção: 91%');
    });
  });
});
