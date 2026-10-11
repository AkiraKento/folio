import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import {
  assembleConsultaUnit,
  assembleConsultaUnits,
  compareDeckPaths,
  loadConsultaUnits,
  type AssembleUnitInput,
} from '../units';

describe('src/consulta/units.ts', () => {
  describe('compareDeckPaths', () => {
    test('ordena caminhos de deck de forma natural, ignorando acento e caixa', () => {
      const paths = [
        'Capítulo 10',
        'capítulo 2',
        'Álgebra',
        'anatomia',
        'Medicina::Cardiologia',
        'Medicina',
        'Medicina::Arritmias',
      ];

      paths.sort(compareDeckPaths);

      expect(paths).toEqual([
        'Álgebra',
        'anatomia',
        'capítulo 2',
        'Capítulo 10',
        'Medicina',
        'Medicina::Arritmias',
        'Medicina::Cardiologia',
      ]);
    });

    test('respeita a hierarquia com :: e coloca decks pai antes de subdecks', () => {
      const paths = ['Biologia::Genética', 'Biologia', 'Biologia::Botânica'];
      paths.sort(compareDeckPaths);

      expect(paths).toEqual(['Biologia', 'Biologia::Botânica', 'Biologia::Genética']);
    });
  });

  describe('assembleConsultaUnit', () => {
    test('monta unidade para nota Básica com frente e verso preenchidos', () => {
      const input: AssembleUnitInput = {
        note: {
          id: 'note-basic-1',
          deck_id: 'deck-1',
          note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
          fields: {
            Frente: 'O que é sístole?',
            Verso: 'Contração ventricular.',
          },
          tags: ['cardio', 'ciclo'],
          source_id: null,
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
        },
        deck: { name: 'Medicina::Cardiologia' },
        noteType: {
          kind: 'basic',
          templates: [
            {
              name: 'Card 1',
              ord: 0,
              front: '{{Frente}}',
              back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Verso}}',
            },
          ],
        },
        cards: [
          {
            id: 'card-1',
            note_id: 'note-basic-1',
            deck_id: 'deck-1',
            ord: 0,
            due: 1000,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            last_review: null,
            suspended: 0,
            buried_until: null,
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
        ],
        annotations: [],
      };

      const unit = assembleConsultaUnit(input, 0);

      expect(unit.index).toBe(0);
      expect(unit.noteId).toBe('note-basic-1');
      expect(unit.deckPath).toBe('Medicina::Cardiologia');
      expect(unit.frontHtml).toContain('O que é sístole?');
      expect(unit.backHtml).toContain('Contração ventricular.');
      expect(unit.tags).toEqual(['cardio', 'ciclo']);
      expect(unit.suspended).toBe(false);
      expect(unit.annotations).toEqual([]);
    });

    test('nota Cloze com c1..c3: 1 unidade com todas as lacunas reveladas', () => {
      const input: AssembleUnitInput = {
        note: {
          id: 'note-cloze-1',
          deck_id: 'deck-1',
          note_type_id: BUILTIN_NOTE_TYPE_IDS.CLOZE,
          fields: {
            Texto: 'A {{c1::penicilina}} foi descoberta por {{c2::Alexander Fleming}} em {{c3::1928}}.',
            'Verso extra': 'Nobel em 1945.',
          },
          tags: ['antibioticos'],
          source_id: null,
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
        },
        deck: { name: 'Farmacologia' },
        noteType: {
          kind: 'cloze',
          templates: [
            {
              name: 'Cloze',
              ord: 0,
              front: '{{cloze:Texto}}',
              back: '{{cloze:Texto}}\n\n<hr id="answer">\n\n{{Verso extra}}',
            },
          ],
        },
        cards: [
          {
            id: 'c1',
            note_id: 'note-cloze-1',
            deck_id: 'deck-1',
            ord: 0,
            due: 1000,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            last_review: null,
            suspended: 0,
            buried_until: null,
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
          {
            id: 'c2',
            note_id: 'note-cloze-1',
            deck_id: 'deck-1',
            ord: 1,
            due: 1000,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            last_review: null,
            suspended: 0,
            buried_until: null,
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
          {
            id: 'c3',
            note_id: 'note-cloze-1',
            deck_id: 'deck-1',
            ord: 2,
            due: 1000,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            last_review: null,
            suspended: 0,
            buried_until: null,
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
        ],
        annotations: [],
      };

      const unit = assembleConsultaUnit(input, 5);

      expect(unit.index).toBe(5);
      // Todas as lacunas reveladas e destacadas com <span class="cloze">
      expect(unit.frontHtml).toContain('<span class="cloze">penicilina</span>');
      expect(unit.frontHtml).toContain('<span class="cloze">Alexander Fleming</span>');
      expect(unit.frontHtml).toContain('<span class="cloze">1928</span>');
      expect(unit.frontHtml).not.toContain('[...]');

      expect(unit.backHtml).toContain('<span class="cloze">penicilina</span>');
      expect(unit.backHtml).toContain('Nobel em 1945.');
    });

    test('nota Básico + invertido gera 1 unidade renderizando o card ord = 0', () => {
      const input: AssembleUnitInput = {
        note: {
          id: 'note-rev-1',
          deck_id: 'deck-1',
          note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED,
          fields: {
            Frente: 'Brasil',
            Verso: 'Brasília',
          },
          tags: [],
          source_id: null,
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
        },
        deck: { name: 'Geografia' },
        noteType: {
          kind: 'basic_reversed',
          templates: [
            {
              name: 'Card 1',
              ord: 0,
              front: '{{Frente}}',
              back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Verso}}',
            },
            {
              name: 'Card 2',
              ord: 1,
              front: '{{Verso}}',
              back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Frente}}',
            },
          ],
        },
        cards: [
          {
            id: 'c1',
            note_id: 'note-rev-1',
            deck_id: 'deck-1',
            ord: 0,
            due: 1000,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            last_review: null,
            suspended: 0,
            buried_until: null,
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
          {
            id: 'c2',
            note_id: 'note-rev-1',
            deck_id: 'deck-1',
            ord: 1,
            due: 1000,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            last_review: null,
            suspended: 0,
            buried_until: null,
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
        ],
        annotations: [],
      };

      const unit = assembleConsultaUnit(input, 0);

      expect(unit.frontHtml).toContain('Brasil');
      expect(unit.backHtml).toContain('Brasília');
    });

    test('marca suspended apenas se todos os cards associados estiverem suspensos', () => {
      const baseInput: AssembleUnitInput = {
        note: {
          id: 'note-susp-1',
          deck_id: 'deck-1',
          note_type_id: BUILTIN_NOTE_TYPE_IDS.CLOZE,
          fields: { Texto: '{{c1::A}} {{c2::B}}' },
          tags: [],
          source_id: null,
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
        },
        deck: { name: 'D' },
        noteType: {
          kind: 'cloze',
          templates: [{ name: 'C', ord: 0, front: '{{cloze:Texto}}', back: '{{cloze:Texto}}' }],
        },
      };

      // Cenário 1: 1 suspenso e 1 ativo -> não suspenso
      const unitPartiallySuspended = assembleConsultaUnit(
        {
          ...baseInput,
          cards: [
            {
              id: 'c1',
              note_id: 'note-susp-1',
              deck_id: 'deck-1',
              ord: 0,
              due: 0,
              stability: 0,
              difficulty: 0,
              elapsed_days: 0,
              scheduled_days: 0,
              learning_steps: 0,
              reps: 0,
              lapses: 0,
              state: 0,
              last_review: null,
              suspended: 1,
              buried_until: null,
              source_id: null,
              created_at: 0,
              updated_at: 0,
              deleted_at: null,
            },
            {
              id: 'c2',
              note_id: 'note-susp-1',
              deck_id: 'deck-1',
              ord: 1,
              due: 0,
              stability: 0,
              difficulty: 0,
              elapsed_days: 0,
              scheduled_days: 0,
              learning_steps: 0,
              reps: 0,
              lapses: 0,
              state: 0,
              last_review: null,
              suspended: 0,
              buried_until: null,
              source_id: null,
              created_at: 0,
              updated_at: 0,
              deleted_at: null,
            },
          ],
        },
        0
      );
      expect(unitPartiallySuspended.suspended).toBe(false);

      // Cenário 2: Todos suspensos -> suspenso
      const unitAllSuspended = assembleConsultaUnit(
        {
          ...baseInput,
          cards: [
            {
              id: 'c1',
              note_id: 'note-susp-1',
              deck_id: 'deck-1',
              ord: 0,
              due: 0,
              stability: 0,
              difficulty: 0,
              elapsed_days: 0,
              scheduled_days: 0,
              learning_steps: 0,
              reps: 0,
              lapses: 0,
              state: 0,
              last_review: null,
              suspended: 1,
              buried_until: null,
              source_id: null,
              created_at: 0,
              updated_at: 0,
              deleted_at: null,
            },
            {
              id: 'c2',
              note_id: 'note-susp-1',
              deck_id: 'deck-1',
              ord: 1,
              due: 0,
              stability: 0,
              difficulty: 0,
              elapsed_days: 0,
              scheduled_days: 0,
              learning_steps: 0,
              reps: 0,
              lapses: 0,
              state: 0,
              last_review: null,
              suspended: 1,
              buried_until: null,
              source_id: null,
              created_at: 0,
              updated_at: 0,
              deleted_at: null,
            },
          ],
        },
        0
      );
      expect(unitAllSuspended.suspended).toBe(true);
    });

    test('ordena anotações associadas por start ascendente', () => {
      const ann1 = {
        id: 'ann-1',
        note_id: 'n1',
        group_key: null,
        kind: 'hl' as const,
        color: 'amarelo' as const,
        quote: 'trecho 2',
        prefix: '',
        suffix: '',
        start: 50,
        end: 58,
        note: '',
        label: '',
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
      };
      const ann2 = {
        id: 'ann-2',
        note_id: 'n1',
        group_key: null,
        kind: 'ul' as const,
        color: 'verde' as const,
        quote: 'trecho 1',
        prefix: '',
        suffix: '',
        start: 10,
        end: 18,
        note: '',
        label: '',
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
      };

      const unit = assembleConsultaUnit(
        {
          note: {
            id: 'n1',
            deck_id: 'd1',
            note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
            fields: { Frente: 'Q', Verso: 'V' },
            tags: [],
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
          deck: { name: 'D' },
          noteType: {
            kind: 'basic',
            templates: [{ name: 'Card 1', ord: 0, front: '{{Frente}}', back: '{{Verso}}' }],
          },
          annotations: [ann1, ann2],
        },
        0
      );

      expect(unit.annotations.map((a) => a.id)).toEqual(['ann-2', 'ann-1']);
    });
  });

  describe('assembleConsultaUnits (ordenação e indexação)', () => {
    test('ordena por caminho do deck -> notes.created_at -> cards.ord e indexa de 0..N', () => {
      const noteType = {
        kind: 'basic' as const,
        templates: [{ name: 'Card 1', ord: 0, front: '{{Frente}}', back: '{{Verso}}' }],
      };

      const inputs: AssembleUnitInput[] = [
        {
          note: {
            id: 'n-deckB-late',
            deck_id: 'dB',
            note_type_id: 't1',
            fields: { Frente: 'B2', Verso: 'VB2' },
            tags: [],
            source_id: null,
            created_at: 5000,
            updated_at: 5000,
            deleted_at: null,
          },
          deck: { name: 'Biologia::Zoologia' },
          noteType,
          cards: [],
        },
        {
          note: {
            id: 'n-deckA',
            deck_id: 'dA',
            note_type_id: 't1',
            fields: { Frente: 'A', Verso: 'VA' },
            tags: [],
            source_id: null,
            created_at: 1000,
            updated_at: 1000,
            deleted_at: null,
          },
          deck: { name: 'Anatomia' },
          noteType,
          cards: [],
        },
        {
          note: {
            id: 'n-deckB-early',
            deck_id: 'dB',
            note_type_id: 't1',
            fields: { Frente: 'B1', Verso: 'VB1' },
            tags: [],
            source_id: null,
            created_at: 2000,
            updated_at: 2000,
            deleted_at: null,
          },
          deck: { name: 'Biologia::Zoologia' },
          noteType,
          cards: [],
        },
      ];

      const units = assembleConsultaUnits(inputs);

      expect(units).toHaveLength(3);
      expect(units[0].noteId).toBe('n-deckA');
      expect(units[0].index).toBe(0);

      expect(units[1].noteId).toBe('n-deckB-early');
      expect(units[1].index).toBe(1);

      expect(units[2].noteId).toBe('n-deckB-late');
      expect(units[2].index).toBe(2);
    });
  });

  describe('loadConsultaUnits (integração com SQLite)', () => {
    let db: ReturnType<typeof createTestDatabase>['db'];
    let decksRepo: DecksRepository;
    let notesRepo: NotesRepository;
    let cardsRepo: CardsRepository;
    let annotationsRepo: AnnotationsRepository;
    let noteTypesRepo: NoteTypesRepository;

    beforeEach(() => {
      const context = createTestDatabase();
      db = context.db;
      decksRepo = new DecksRepository(db);
      notesRepo = new NotesRepository(db);
      cardsRepo = new CardsRepository(db);
      annotationsRepo = new AnnotationsRepository(db);
      noteTypesRepo = new NoteTypesRepository(db);
      noteTypesRepo.seedBuiltins();
    });

    test('carrega unidades de um deck e de seus subdecks na ordem natural', () => {
      const parentDeck = decksRepo.create({ name: 'Medicina' });
      const childDeck = decksRepo.create({ name: 'Medicina::Cardiologia' });
      const unrelatedDeck = decksRepo.create({ name: 'Direito' });

      const n1 = notesRepo.create({
        deck_id: parentDeck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: { Frente: 'Q1', Verso: 'V1' },
        created_at: 1000,
      });
      cardsRepo.create({ note_id: n1.id, deck_id: parentDeck.id, ord: 0, due: 0 });

      const n2 = notesRepo.create({
        deck_id: childDeck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: { Frente: 'Q2', Verso: 'V2' },
        created_at: 2000,
      });
      cardsRepo.create({ note_id: n2.id, deck_id: childDeck.id, ord: 0, due: 0 });

      const n3 = notesRepo.create({
        deck_id: unrelatedDeck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: { Frente: 'Q3', Verso: 'V3' },
        created_at: 500,
      });
      cardsRepo.create({ note_id: n3.id, deck_id: unrelatedDeck.id, ord: 0, due: 0 });

      // Anotação em n2
      annotationsRepo.create({
        note_id: n2.id,
        kind: 'hl',
        color: 'amarelo',
        quote: 'V2',
        start: 0,
        end: 2,
      });

      const units = loadConsultaUnits({ deckId: parentDeck.id, db });

      expect(units).toHaveLength(2);
      expect(units[0].noteId).toBe(n1.id);
      expect(units[0].deckPath).toBe('Medicina');
      expect(units[0].index).toBe(0);

      expect(units[1].noteId).toBe(n2.id);
      expect(units[1].deckPath).toBe('Medicina::Cardiologia');
      expect(units[1].index).toBe(1);
      expect(units[1].annotations).toHaveLength(1);
    });

    test('respeita paginação (limit e offset) mantendo index absoluto', () => {
      const deck = decksRepo.create({ name: 'Lotes' });

      for (let i = 0; i < 5; i++) {
        const note = notesRepo.create({
          deck_id: deck.id,
          note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
          fields: { Frente: `Frente ${i}`, Verso: `Verso ${i}` },
          created_at: 1000 + i * 100,
        });
        cardsRepo.create({ note_id: note.id, deck_id: deck.id, ord: 0, due: 0 });
      }

      // Primeiro lote de 2
      const batch1 = loadConsultaUnits({ deckId: deck.id, limit: 2, offset: 0, db });
      expect(batch1).toHaveLength(2);
      expect(batch1[0].index).toBe(0);
      expect(batch1[1].index).toBe(1);

      // Segundo lote de 2
      const batch2 = loadConsultaUnits({ deckId: deck.id, limit: 2, offset: 2, db });
      expect(batch2).toHaveLength(2);
      expect(batch2[0].index).toBe(2);
      expect(batch2[1].index).toBe(3);
    });

    test('ignora notas, decks e anotações excluídas logicamente', () => {
      const deck = decksRepo.create({ name: 'Deletados' });
      const n1 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: { Frente: 'Ativa', Verso: 'Ativa' },
        created_at: 1000,
      });
      cardsRepo.create({ note_id: n1.id, deck_id: deck.id, ord: 0, due: 0 });

      const n2 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
        fields: { Frente: 'Deletada', Verso: 'Deletada' },
        created_at: 2000,
      });
      cardsRepo.create({ note_id: n2.id, deck_id: deck.id, ord: 0, due: 0 });
      notesRepo.softDelete(n2.id);

      const ann = annotationsRepo.create({
        note_id: n1.id,
        kind: 'hl',
        color: 'verde',
        quote: 'Ativa',
        start: 0,
        end: 5,
      });
      annotationsRepo.softDelete(ann.id);

      const units = loadConsultaUnits({ deckId: deck.id, db });
      expect(units).toHaveLength(1);
      expect(units[0].noteId).toBe(n1.id);
      expect(units[0].annotations).toHaveLength(0);
    });
  });
});
