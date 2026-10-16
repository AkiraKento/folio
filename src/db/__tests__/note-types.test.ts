import { createTestDatabase } from './test-utils';
import {
  BUILTIN_NOTE_TYPE_IDS,
  BUILTIN_NOTE_TYPES,
  LEGACY_BUILTIN_NOTE_TYPES,
  getBuiltinNoteTypes,
  getExpectedCardOrdsForNote,
  migrateBuiltinNoteTypes,
  isLegacyUntouchedBuiltin,
} from '../builtin-note-types';
import { NoteTypesRepository } from '../repositories/note-types';
import type { NoteType } from '../schema';

describe('Builtin Note Types', () => {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  test('possui IDs no formato UUID v4 válido e determinístico', () => {
    expect(BUILTIN_NOTE_TYPE_IDS.BASIC).toMatch(uuidV4Regex);
    expect(BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED).toMatch(uuidV4Regex);
    expect(BUILTIN_NOTE_TYPE_IDS.CLOZE).toMatch(uuidV4Regex);

    const ids = Object.values(BUILTIN_NOTE_TYPE_IDS);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('define corretamente o modelo Básico', () => {
    const basic = BUILTIN_NOTE_TYPES.BASIC;
    expect(basic.id).toBe(BUILTIN_NOTE_TYPE_IDS.BASIC);
    expect(basic.name).toBe('Básico');
    expect(basic.kind).toBe('basic');
    expect(basic.fields).toEqual([
      { name: 'Frente', ord: 0 },
      { name: 'Verso', ord: 1 },
    ]);
    expect(basic.templates).toHaveLength(1);
    expect(basic.templates[0].name).toBe('Card 1');
    expect(basic.templates[0].ord).toBe(0);
    expect(basic.templates[0].front).toContain('<div class="main question-field" id="question">{{Frente}}</div>');
    expect(basic.templates[0].back).toContain('<div class="main answer-field" id="answer">{{Verso}}</div>');
    expect(basic.templates[0].back).toContain('{{weiss-tags:Tags}}');
    expect(basic.css).toContain('.main');
    expect(basic.css).toContain('.tag-pill');
  });

  test('define corretamente o modelo Básico + invertido', () => {
    const basicReversed = BUILTIN_NOTE_TYPES.BASIC_REVERSED;
    expect(basicReversed.id).toBe(BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED);
    expect(basicReversed.name).toBe('Básico (e cartão invertido)');
    expect(basicReversed.kind).toBe('basic_reversed');
    expect(basicReversed.fields).toEqual([
      { name: 'Frente', ord: 0 },
      { name: 'Verso', ord: 1 },
    ]);
    expect(basicReversed.templates).toHaveLength(2);
    expect(basicReversed.templates[0].name).toBe('Card 1');
    expect(basicReversed.templates[0].front).toContain('<div class="main question-field" id="question">{{Frente}}</div>');
    expect(basicReversed.templates[0].back).toContain('<div class="main answer-field" id="answer">{{Verso}}</div>');
    expect(basicReversed.templates[0].back).toContain('{{weiss-tags:Tags}}');
    expect(basicReversed.templates[1].name).toBe('Card 2');
    expect(basicReversed.templates[1].front).toContain('<div class="main question-field" id="question">{{Verso}}</div>');
    expect(basicReversed.templates[1].back).toContain('<div class="main answer-field" id="answer">{{Frente}}</div>');
    expect(basicReversed.templates[1].back).toContain('{{weiss-tags:Tags}}');
  });

  test('define corretamente o modelo Cloze', () => {
    const cloze = BUILTIN_NOTE_TYPES.CLOZE;
    expect(cloze.id).toBe(BUILTIN_NOTE_TYPE_IDS.CLOZE);
    expect(cloze.name).toBe('Cloze');
    expect(cloze.kind).toBe('cloze');
    expect(cloze.fields).toEqual([
      { name: 'Texto', ord: 0 },
      { name: 'Verso extra', ord: 1 },
    ]);
    expect(cloze.templates).toHaveLength(1);
    expect(cloze.templates[0].name).toBe('Cloze');
    expect(cloze.templates[0].front).toContain('<div class="main question-field" id="question">{{cloze:Texto}}</div>');
    expect(cloze.templates[0].front).toContain('{{weiss-tags:Tags}}');
    expect(cloze.templates[0].back).toContain('<div class="main answer-field" id="answer">{{cloze:Texto}}</div>');
    expect(cloze.templates[0].back).toContain('{{weiss-tags:Tags}}');
    expect(cloze.css).toContain('.cloze');
    expect(cloze.css).toContain('.main');
  });

  test('getBuiltinNoteTypes retorna os três modelos com timestamps', () => {
    const fixedNow = 1710000000000;
    const list = getBuiltinNoteTypes(fixedNow);
    expect(list).toHaveLength(3);
    for (const item of list) {
      expect(item.created_at).toBe(fixedNow);
      expect(item.updated_at).toBe(fixedNow);
      expect(item.deleted_at).toBeNull();
    }
  });

  describe('getExpectedCardOrdsForNote', () => {
    test('gera ord 0 para nota básica', () => {
      const ords = getExpectedCardOrdsForNote(BUILTIN_NOTE_TYPES.BASIC, {
        Frente: 'Pergunta',
        Verso: 'Resposta',
      });
      expect(ords).toEqual([0]);
    });

    test('gera ord 0 e 1 para nota invertida quando ambos os campos têm conteúdo', () => {
      const ords = getExpectedCardOrdsForNote(BUILTIN_NOTE_TYPES.BASIC_REVERSED, {
        Frente: 'Apple',
        Verso: 'Maçã',
      });
      expect(ords).toEqual([0, 1]);
    });

    test('omite card 2 na nota invertida se o verso estiver vazio', () => {
      const ords = getExpectedCardOrdsForNote(BUILTIN_NOTE_TYPES.BASIC_REVERSED, {
        Frente: 'Somente Frente',
        Verso: '   ',
      });
      expect(ords).toEqual([0]);
    });

    test('detecta números de cloze para nota cloze', () => {
      const ords = getExpectedCardOrdsForNote(BUILTIN_NOTE_TYPES.CLOZE, {
        Texto: 'A capital da {{c1::França}} é {{c2::Paris}}.',
        'Verso extra': 'Mais informações...',
      });
      // c1 vira ord 0, c2 vira ord 1
      expect(ords).toEqual([0, 1]);
    });

    test('deduplica clozes repetidos no mesmo card', () => {
      const ords = getExpectedCardOrdsForNote(BUILTIN_NOTE_TYPES.CLOZE, {
        Texto: '{{c1::Brasília}} foi fundada em {{c1::1960}}.',
        'Verso extra': '',
      });
      expect(ords).toEqual([0]);
    });

    test('mapeia c3 para ord 2 mesmo sem c1 e c2', () => {
      const ords = getExpectedCardOrdsForNote(BUILTIN_NOTE_TYPES.CLOZE, {
        Texto: 'O teste é com {{c3::terceiro}} cloze.',
        'Verso extra': '',
      });
      expect(ords).toEqual([2]);
    });

    test('retorna [0] como fallback se nota cloze não contiver marcações de cloze', () => {
      const ords = getExpectedCardOrdsForNote(BUILTIN_NOTE_TYPES.CLOZE, {
        Texto: 'Texto sem nenhuma lacuna.',
        'Verso extra': '',
      });
      expect(ords).toEqual([0]);
    });
  });
});

describe('NoteTypesRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let repo: NoteTypesRepository;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    repo = new NoteTypesRepository(db);
  });

  test('seedBuiltins insere os 3 note types embutidos e é idempotente', () => {
    const seeded1 = repo.seedBuiltins();
    expect(seeded1).toHaveLength(3);

    const all = repo.list();
    expect(all).toHaveLength(3);

    const basic = repo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC);
    expect(basic?.name).toBe('Básico');
    expect(basic?.kind).toBe('basic');

    const reversed = repo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED);
    expect(reversed?.name).toBe('Básico (e cartão invertido)');
    expect(reversed?.kind).toBe('basic_reversed');

    const cloze = repo.getById(BUILTIN_NOTE_TYPE_IDS.CLOZE);
    expect(cloze?.name).toBe('Cloze');
    expect(cloze?.kind).toBe('cloze');

    // Chamar uma segunda vez não duplica nem quebra
    const seeded2 = repo.seedBuiltins();
    expect(seeded2).toHaveLength(3);
    expect(repo.list()).toHaveLength(3);
  });

  test('recupera note types por kind', () => {
    repo.seedBuiltins();

    const basicList = repo.getByKind('basic');
    expect(basicList).toHaveLength(1);
    expect(basicList[0].id).toBe(BUILTIN_NOTE_TYPE_IDS.BASIC);

    const clozeList = repo.getByKind('cloze');
    expect(clozeList).toHaveLength(1);
    expect(clozeList[0].id).toBe(BUILTIN_NOTE_TYPE_IDS.CLOZE);
  });

  test('cria modelo personalizado', () => {
    const custom = repo.create({
      name: 'Vocabulário',
      kind: 'custom',
      fields: [
        { name: 'Palavra', ord: 0 },
        { name: 'Tradução', ord: 1 },
        { name: 'Exemplo', ord: 2 },
      ],
      templates: [
        {
          name: 'Principal',
          ord: 0,
          front: '{{Palavra}}',
          back: '{{Palavra}}<hr>{{Tradução}}<br><i>{{Exemplo}}</i>',
        },
      ],
      css: '.card { font-size: 20px; }',
    });

    expect(custom.id).toBeDefined();
    expect(custom.name).toBe('Vocabulário');
    expect(custom.fields).toHaveLength(3);

    const found = repo.getById(custom.id);
    expect(found?.name).toBe('Vocabulário');
  });

  test('atualiza modelo existente', () => {
    repo.seedBuiltins();

    const updated = repo.update(BUILTIN_NOTE_TYPE_IDS.BASIC, {
      name: 'Básico Personalizado',
      css: '.card { font-size: 24px; }',
    });

    expect(updated?.name).toBe('Básico Personalizado');
    expect(updated?.css).toContain('24px');

    const fetched = repo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC);
    expect(fetched?.name).toBe('Básico Personalizado');
  });

  test('soft delete remove da listagem mas mantém com includeDeleted', () => {
    repo.seedBuiltins();

    const deleted = repo.softDelete(BUILTIN_NOTE_TYPE_IDS.BASIC);
    expect(deleted).toBe(true);

    const activeList = repo.list();
    expect(activeList).toHaveLength(2);
    expect(activeList.some((nt: NoteType) => nt.id === BUILTIN_NOTE_TYPE_IDS.BASIC)).toBe(false);

    const notFound = repo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC);
    expect(notFound).toBeNull();

    const foundWithDeleted = repo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC, { includeDeleted: true });
    expect(foundWithDeleted).not.toBeNull();
    expect(foundWithDeleted?.deleted_at).toBeGreaterThan(0);
  });

  describe('Migração por Hash dos Modelos Embutidos (M10 Passo 9)', () => {
    test('detecta corretamente modelos legados intocados com isLegacyUntouchedBuiltin', () => {
      expect(isLegacyUntouchedBuiltin(LEGACY_BUILTIN_NOTE_TYPES.BASIC)).toBe(true);
      expect(isLegacyUntouchedBuiltin(LEGACY_BUILTIN_NOTE_TYPES.BASIC_REVERSED)).toBe(true);
      expect(isLegacyUntouchedBuiltin(LEGACY_BUILTIN_NOTE_TYPES.CLOZE)).toBe(true);

      // Modelo com template alterado
      const editedTpl = {
        ...LEGACY_BUILTIN_NOTE_TYPES.BASIC,
        templates: [{ ...LEGACY_BUILTIN_NOTE_TYPES.BASIC.templates[0], front: '{{Custom}}' }],
      };
      expect(isLegacyUntouchedBuiltin(editedTpl)).toBe(false);

      // Modelo com CSS alterado
      const editedCss = {
        ...LEGACY_BUILTIN_NOTE_TYPES.BASIC,
        css: '.card { color: red; }',
      };
      expect(isLegacyUntouchedBuiltin(editedCss)).toBe(false);

      // Novo modelo já migrado
      expect(isLegacyUntouchedBuiltin(BUILTIN_NOTE_TYPES.BASIC)).toBe(false);
    });

    test('migrateBuiltinNoteTypes atualiza modelos legados intocados para o novo padrão Avicena', () => {
      const { db: freshDb } = createTestDatabase();
      const freshRepo = new NoteTypesRepository(freshDb);

      // Insere propositalmente os modelos com conteúdo legado do MVP
      for (const item of Object.values(LEGACY_BUILTIN_NOTE_TYPES)) {
        freshRepo.create(item);
      }

      // Executa a migração
      const result = migrateBuiltinNoteTypes(freshDb);
      expect(result.migratedCount).toBe(3);
      expect(result.untouchedIds).toHaveLength(0);

      // Verifica se o modelo básico no banco agora possui a estrutura Avicena
      const basic = freshRepo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC);
      expect(basic?.templates[0].front).toContain('class="main question-field"');
      expect(basic?.templates[0].back).toContain('class="main answer-field"');
      expect(basic?.templates[0].back).toContain('{{weiss-tags:Tags}}');
      expect(basic?.css).toContain('.main');
      expect(basic?.css).toContain('.tag-pill');
    });

    test('migrateBuiltinNoteTypes NÃO altera modelos que foram modificados pelo usuário', () => {
      const { db: freshDb } = createTestDatabase();
      const freshRepo = new NoteTypesRepository(freshDb);

      // Insere Básico customizado pelo usuário
      freshRepo.create({
        ...LEGACY_BUILTIN_NOTE_TYPES.BASIC,
        css: '.card { color: purple; font-size: 28px; }',
      });
      // Insere Cloze legado intocado
      freshRepo.create(LEGACY_BUILTIN_NOTE_TYPES.CLOZE);

      const result = migrateBuiltinNoteTypes(freshDb);
      expect(result.migratedCount).toBe(2); // Cloze migrado + Basic_Reversed inserido
      expect(result.untouchedIds).toContain(BUILTIN_NOTE_TYPE_IDS.BASIC);

      // O modelo básico do usuário NÃO foi alterado
      const basic = freshRepo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC);
      expect(basic?.css).toBe('.card { color: purple; font-size: 28px; }');
      expect(basic?.templates[0].front).toBe('{{Frente}}');

      // O modelo Cloze foi devidamente migrado
      const cloze = freshRepo.getById(BUILTIN_NOTE_TYPE_IDS.CLOZE);
      expect(cloze?.templates[0].front).toContain('class="main question-field"');
      expect(cloze?.css).toContain('.main');
    });

    test('migrateBuiltinNoteTypes é idempotente ao rodar múltiplas vezes', () => {
      const { db: freshDb } = createTestDatabase();
      const freshRepo = new NoteTypesRepository(freshDb);

      freshRepo.seedBuiltins();

      // Segunda execução
      const result2 = migrateBuiltinNoteTypes(freshDb);
      expect(result2.migratedCount).toBe(0);
      expect(result2.untouchedIds).toHaveLength(0);
    });
  });
});
