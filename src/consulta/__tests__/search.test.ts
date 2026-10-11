import {
  normalizeSearchText,
  stripHtml,
  matchesSearchText,
  matchesConsultaUnit,
  filterConsultaUnits,
  type ConsultaFilter,
} from '../search';
import { loadConsultaUnits, type ConsultaUnit } from '../units';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import type { Annotation } from '@/db/schema';

describe('src/consulta/search.ts - MODO_CONSULTA.md §3', () => {
  describe('normalizeSearchText', () => {
    test('remove acentos gráficos e diacríticos mantendo os caracteres base', () => {
      expect(normalizeSearchText('Insuficiência Cardíaca')).toBe('insuficiencia cardiaca');
      expect(normalizeSearchText('Coração, Ação, Reação')).toBe('coracao, acao, reacao');
      expect(normalizeSearchText('ÁÉÍÓÚ áéíóú ÂÊÎÔÛ âêîôû ÃÕ ãõ ÄËÏÖÜ äëïöü Çç')).toBe(
        'aeiou aeiou aeiou aeiou ao ao aeiou aeiou cc'
      );
    });

    test('converte para minúsculas e remove espaços das bordas', () => {
      expect(normalizeSearchText('   CARDIOLOGIA PEDIÁTRICA   ')).toBe('cardiologia pediatrica');
    });

    test('trata strings vazias, nulas ou só com espaços', () => {
      expect(normalizeSearchText('')).toBe('');
      expect(normalizeSearchText('   ')).toBe('');
      expect(normalizeSearchText(null as unknown as string)).toBe('');
      expect(normalizeSearchText(undefined as unknown as string)).toBe('');
    });
  });

  describe('stripHtml', () => {
    test('remove tags HTML simples e preserva o texto interno', () => {
      expect(stripHtml('<p>Qual a <b>primeira linha</b> na ICFEr?</p>')).toBe(
        'Qual a primeira linha na ICFEr?'
      );
    });

    test('remove tags de cloze e span preservando o conteúdo das lacunas', () => {
      expect(
        stripHtml('IECA/BRA ou <span class="cloze">INRA</span> e <span class="cloze">betabloqueador</span>.')
      ).toBe('IECA/BRA ou INRA e betabloqueador.');
    });

    test('decodifica entidades HTML comuns', () => {
      expect(stripHtml('Pressão &amp; volume &nbsp; &lt;120/80&gt;')).toBe(
        'Pressão & volume <120/80>'
      );
    });

    test('remove blocos <style> e <script>', () => {
      expect(
        stripHtml('<style>.card { color: red; }</style><p>Texto limpo</p><script>alert(1);</script>')
      ).toBe('Texto limpo');
    });
  });

  describe('matchesSearchText', () => {
    const text = 'Os quatro pilares do tratamento da insuficiência cardíaca com fração reduzida';

    test('encontra correspondência sem acento e sem caixa', () => {
      expect(matchesSearchText(text, 'insuficiencia')).toBe(true);
      expect(matchesSearchText(text, 'INSUFICIÊNCIA')).toBe(true);
      expect(matchesSearchText(text, 'cardíaca')).toBe(true);
      expect(matchesSearchText(text, 'cardiaca')).toBe(true);
    });

    test('suporta múltiplos termos (tokens) em qualquer ordem', () => {
      expect(matchesSearchText(text, 'quatro pilares')).toBe(true);
      expect(matchesSearchText(text, 'pilares quatro')).toBe(true);
      expect(matchesSearchText(text, 'icfer insuficiencia quatro')).toBe(false); // icfer não está no texto
      expect(matchesSearchText(text, 'reduzida pilares cardiaca')).toBe(true);
    });

    test('retorna falso quando algum termo não é encontrado', () => {
      expect(matchesSearchText(text, 'neurologia')).toBe(false);
      expect(matchesSearchText(text, 'insuficiencia renal')).toBe(false);
    });

    test('retorna verdadeiro quando a busca está vazia', () => {
      expect(matchesSearchText(text, '')).toBe(true);
      expect(matchesSearchText(text, '   ')).toBe(true);
    });
  });

  describe('matchesConsultaUnit', () => {
    const sampleAnnotation: Annotation = {
      id: 'ann-1',
      note_id: 'note-1',
      group_key: null,
      kind: 'hl',
      color: 'amarelo',
      quote: 'quatro pilares',
      prefix: '',
      suffix: '',
      start: 10,
      end: 24,
      note: 'memorizar isso',
      label: '',
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
    };

    const unitWithAnnotation: ConsultaUnit = {
      index: 0,
      noteId: 'note-1',
      deckPath: 'Medicina::Cardiologia',
      frontHtml: '<p>Qual a <b>primeira linha</b> na ICFEr?</p>',
      backHtml: '<p>IECA/BRA ou INRA, betabloqueador e os quatro pilares.</p>',
      tags: ['cardio', 'icfer'],
      suspended: false,
      annotations: [sampleAnnotation],
    };

    const unitWithoutAnnotation: ConsultaUnit = {
      index: 1,
      noteId: 'note-2',
      deckPath: 'Medicina::Pneumologia',
      frontHtml: '<p>Qual o tratamento inicial da Asma?</p>',
      backHtml: '<p>Beta-2 agonista inalatório e corticoide.</p>',
      tags: ['pneumo', 'asma'],
      suspended: false,
      annotations: [],
    };

    test('encontra termo na frente do card sem acento e sem caixa', () => {
      expect(matchesConsultaUnit(unitWithAnnotation, { query: 'primeira linha' })).toBe(true);
      expect(matchesConsultaUnit(unitWithAnnotation, { query: 'PRIMEIRA LINHA' })).toBe(true);
      expect(matchesConsultaUnit(unitWithAnnotation, { query: 'icfer' })).toBe(true);
    });

    test('encontra termo no verso do card sem acento e sem caixa', () => {
      expect(matchesConsultaUnit(unitWithAnnotation, { query: 'betabloqueador' })).toBe(true);
      expect(matchesConsultaUnit(unitWithAnnotation, { query: 'quatro pilares' })).toBe(true);
      expect(matchesConsultaUnit(unitWithoutAnnotation, { query: 'corticoide' })).toBe(true);
    });

    test('encontra termo nas tags', () => {
      expect(matchesConsultaUnit(unitWithAnnotation, { query: 'cardio' })).toBe(true);
      expect(matchesConsultaUnit(unitWithoutAnnotation, { query: 'pneumo' })).toBe(true);
      expect(matchesConsultaUnit(unitWithoutAnnotation, { query: '#asma' })).toBe(true);
    });

    test('filtra com interruptor "só unidades com anotação"', () => {
      const filterWithAnnOnly: ConsultaFilter = { onlyWithAnnotations: true };
      expect(matchesConsultaUnit(unitWithAnnotation, filterWithAnnOnly)).toBe(true);
      expect(matchesConsultaUnit(unitWithoutAnnotation, filterWithAnnOnly)).toBe(false);
    });

    test('combina busca textual e interruptor "só unidades com anotação"', () => {
      // Bate no texto E tem anotação -> true
      expect(
        matchesConsultaUnit(unitWithAnnotation, {
          query: 'betabloqueador',
          onlyWithAnnotations: true,
        })
      ).toBe(true);

      // Bate no texto MAS NÃO tem anotação -> false
      expect(
        matchesConsultaUnit(unitWithoutAnnotation, {
          query: 'corticoide',
          onlyWithAnnotations: true,
        })
      ).toBe(false);

      // Tem anotação MAS NÃO bate no texto -> false
      expect(
        matchesConsultaUnit(unitWithAnnotation, {
          query: 'neurologia',
          onlyWithAnnotations: true,
        })
      ).toBe(false);
    });
  });

  describe('filterConsultaUnits', () => {
    const units: ConsultaUnit[] = [
      {
        index: 0,
        noteId: 'n1',
        deckPath: 'Deck 1',
        frontHtml: 'Frente 1',
        backHtml: 'Verso 1 com Insuficiência',
        tags: ['tag1'],
        suspended: false,
        annotations: [{ id: 'a1' } as Annotation],
      },
      {
        index: 1,
        noteId: 'n2',
        deckPath: 'Deck 1',
        frontHtml: 'Frente 2 Asma',
        backHtml: 'Verso 2',
        tags: ['tag2'],
        suspended: false,
        annotations: [],
      },
      {
        index: 2,
        noteId: 'n3',
        deckPath: 'Deck 1',
        frontHtml: 'Frente 3 Insuficiência Renal',
        backHtml: 'Verso 3',
        tags: ['tag3'],
        suspended: false,
        annotations: [{ id: 'a2' } as Annotation],
      },
    ];

    test('filtra e reordena os índices sequencialmente a partir de 0', () => {
      const filtered = filterConsultaUnits(units, { query: 'insuficiencia' });
      expect(filtered).toHaveLength(2);
      expect(filtered[0].noteId).toBe('n1');
      expect(filtered[0].index).toBe(0);
      expect(filtered[1].noteId).toBe('n3');
      expect(filtered[1].index).toBe(1);
    });

    test('filtra apenas com anotações', () => {
      const filtered = filterConsultaUnits(units, { onlyWithAnnotations: true });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((u: ConsultaUnit) => u.noteId)).toEqual(['n1', 'n3']);
      expect(filtered[0].index).toBe(0);
      expect(filtered[1].index).toBe(1);
    });

    test('retorna todas as unidades reindexadas quando filtro está vazio', () => {
      const filtered = filterConsultaUnits(units, {});
      expect(filtered).toHaveLength(3);
      expect(filtered[0].index).toBe(0);
      expect(filtered[1].index).toBe(1);
      expect(filtered[2].index).toBe(2);
    });
  });

  describe('loadConsultaUnits com busca e filtro (integração com SQLite)', () => {
    let db: ReturnType<typeof createTestDatabase>['db'];
    let decksRepo: DecksRepository;
    let notesRepo: NotesRepository;
    let cardsRepo: CardsRepository;
    let annotationsRepo: AnnotationsRepository;
    let noteTypesRepo: NoteTypesRepository;

    beforeEach(() => {
      const testDb = createTestDatabase();
      db = testDb.db;
      decksRepo = new DecksRepository(db);
      notesRepo = new NotesRepository(db);
      cardsRepo = new CardsRepository(db);
      annotationsRepo = new AnnotationsRepository(db);
      noteTypesRepo = new NoteTypesRepository(db);
      noteTypesRepo.seedBuiltins();
    });

    test('filtra unidades por texto ignorando acentos e maiúsculas', () => {
      const deck = decksRepo.create({ name: 'Medicina::Cardio' });

      // Nota 1: Insuficiência Cardíaca
      const n1 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: {
          Frente: 'Definição de Insuficiência Cardíaca',
          Verso: 'Síndrome clínica complexa de disfunção ventricular.',
        },
        tags: ['ic', 'clinica'],
      });
      cardsRepo.create({ note_id: n1.id, deck_id: deck.id, ord: 0, due: 0 });

      // Nota 2: Hipertensão Arterial Sistêmica
      const n2 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: {
          Frente: 'Diagnóstico de Hipertensão Arterial',
          Verso: 'PA sustentada >= 140x90 mmHg em duas ou mais consultas.',
        },
        tags: ['has', 'pressao'],
      });
      cardsRepo.create({ note_id: n2.id, deck_id: deck.id, ord: 0, due: 0 });

      // Busca sem acento: "insuficiencia"
      const results = loadConsultaUnits({
        deckId: deck.id,
        searchQuery: 'insuficiencia',
        db,
      });

      expect(results).toHaveLength(1);
      expect(results[0].noteId).toBe(n1.id);
      expect(results[0].index).toBe(0);

      // Busca em maiúsculas: "HIPERTENSAO"
      const resultsHas = loadConsultaUnits({
        deckId: deck.id,
        searchQuery: 'HIPERTENSAO',
        db,
      });

      expect(resultsHas).toHaveLength(1);
      expect(resultsHas[0].noteId).toBe(n2.id);
      expect(resultsHas[0].index).toBe(0);

      // Busca por tag: "pressao"
      const resultsTag = loadConsultaUnits({
        deckId: deck.id,
        searchQuery: 'pressao',
        db,
      });

      expect(resultsTag).toHaveLength(1);
      expect(resultsTag[0].noteId).toBe(n2.id);
    });

    test('filtra unidades com interruptor "só unidades com anotação"', () => {
      const deck = decksRepo.create({ name: 'Medicina::Farmaco' });

      const n1 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: { Frente: 'Fármaco A', Verso: 'Mecanismo A' },
        tags: ['farmaco'],
      });
      cardsRepo.create({ note_id: n1.id, deck_id: deck.id, ord: 0, due: 0 });

      const n2 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: { Frente: 'Fármaco B', Verso: 'Mecanismo B' },
        tags: ['farmaco'],
      });
      cardsRepo.create({ note_id: n2.id, deck_id: deck.id, ord: 0, due: 0 });

      // Cria anotação apenas em n1
      annotationsRepo.create({
        note_id: n1.id,
        kind: 'hl',
        color: 'amarelo',
        quote: 'Mecanismo A',
        start: 0,
        end: 11,
      });

      const resultsWithAnn = loadConsultaUnits({
        deckId: deck.id,
        onlyWithAnnotations: true,
        db,
      });

      expect(resultsWithAnn).toHaveLength(1);
      expect(resultsWithAnn[0].noteId).toBe(n1.id);
      expect(resultsWithAnn[0].annotations).toHaveLength(1);
    });

    test('aplica paginação (limit e offset) sobre os resultados filtrados', () => {
      const deck = decksRepo.create({ name: 'Geral' });

      for (let i = 1; i <= 5; i++) {
        const note = notesRepo.create({
          deck_id: deck.id,
          note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
          fields: {
            Frente: `Questão ${i} sobre Cardiologia`,
            Verso: `Resposta ${i}`,
          },
          tags: ['cardio'],
        });
        cardsRepo.create({ note_id: note.id, deck_id: deck.id, ord: 0, due: 0 });
      }

      // Lote 1 de 2 unidades
      const batch1 = loadConsultaUnits({
        deckId: deck.id,
        searchQuery: 'cardiologia',
        limit: 2,
        offset: 0,
        db,
      });
      expect(batch1).toHaveLength(2);
      expect(batch1[0].index).toBe(0);
      expect(batch1[1].index).toBe(1);

      // Lote 2 de 2 unidades
      const batch2 = loadConsultaUnits({
        deckId: deck.id,
        searchQuery: 'cardiologia',
        limit: 2,
        offset: 2,
        db,
      });
      expect(batch2).toHaveLength(2);
      expect(batch2[0].index).toBe(2);
      expect(batch2[1].index).toBe(3);
    });
  });
});
