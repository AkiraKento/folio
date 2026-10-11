import { createTestDatabase, seedBasicNoteType } from './test-utils';
import { DecksRepository } from '../repositories/decks';
import { NotesRepository } from '../repositories/notes';
import { CardsRepository } from '../repositories/cards';

describe('DecksRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);
  });

  test('cria deck com id fornecido ou gerado e recupera por id e nome', () => {
    const deck = decksRepo.create({
      id: 'deck-1',
      name: 'Medicina::Cardiologia',
      area: 'Medicina',
      description: 'Deck de cardiologia',
    });

    expect(deck.id).toBe('deck-1');
    expect(deck.name).toBe('Medicina::Cardiologia');
    expect(deck.created_at).toBeGreaterThan(0);
    expect(deck.deleted_at).toBeNull();

    const byId = decksRepo.getById('deck-1');
    expect(byId?.id).toBe('deck-1');

    const byName = decksRepo.getByName('Medicina::Cardiologia');
    expect(byName?.id).toBe('deck-1');
  });

  test('lista todos os decks ativos em ordem alfabética', () => {
    decksRepo.create({ name: 'Direito::Constitucional' });
    decksRepo.create({ name: 'Biologia' });
    decksRepo.create({ name: 'Direito::Civil' });

    const all = decksRepo.listAll();
    expect(all.map((d) => d.name)).toEqual(['Biologia', 'Direito::Civil', 'Direito::Constitucional']);
  });

  test('renomeia deck e atualiza subdecks em cascata (Pai::Filho)', () => {
    const parent = decksRepo.create({ id: 'p1', name: 'Medicina' });
    const child1 = decksRepo.create({ id: 'c1', name: 'Medicina::Cardio' });
    const subChild = decksRepo.create({ id: 'sc1', name: 'Medicina::Cardio::Valvopatias' });
    const other = decksRepo.create({ id: 'o1', name: 'Direito' });

    decksRepo.rename(parent.id, 'Saúde');

    expect(decksRepo.getById(parent.id)?.name).toBe('Saúde');
    expect(decksRepo.getById(child1.id)?.name).toBe('Saúde::Cardio');
    expect(decksRepo.getById(subChild.id)?.name).toBe('Saúde::Cardio::Valvopatias');
    expect(decksRepo.getById(other.id)?.name).toBe('Direito');
  });

  test('move deck para outro pai e atualiza subdecks em cascata', () => {
    const parentA = decksRepo.create({ id: 'pA', name: 'Medicina' });
    const child = decksRepo.create({ id: 'cA', name: 'Medicina::Cardiologia' });
    const subChild = decksRepo.create({ id: 'scA', name: 'Medicina::Cardiologia::ECG' });
    const parentB = decksRepo.create({ id: 'pB', name: 'Biológicas' });

    // Move Medicina::Cardiologia para dentro de Biológicas
    const moved = decksRepo.move(child.id, parentB.id);
    expect(moved?.name).toBe('Biológicas::Cardiologia');

    // Verifica que o deck e seu subdeck foram atualizados
    expect(decksRepo.getById(child.id)?.name).toBe('Biológicas::Cardiologia');
    expect(decksRepo.getById(subChild.id)?.name).toBe('Biológicas::Cardiologia::ECG');
    // Medicina continua existindo
    expect(decksRepo.getById(parentA.id)?.name).toBe('Medicina');
  });

  test('move deck filho para o nível raiz quando newParentId é null', () => {
    const parent = decksRepo.create({ id: 'p1', name: 'Medicina' });
    const child = decksRepo.create({ id: 'c1', name: 'Medicina::Cardiologia' });
    const subChild = decksRepo.create({ id: 'sc1', name: 'Medicina::Cardiologia::ECG' });

    const moved = decksRepo.move(child.id, null);
    expect(moved?.name).toBe('Cardiologia');
    expect(decksRepo.getById(parent.id)?.name).toBe('Medicina');
    expect(decksRepo.getById(child.id)?.name).toBe('Cardiologia');
    expect(decksRepo.getById(subChild.id)?.name).toBe('Cardiologia::ECG');
  });

  test('rejeita mover deck para dentro de si mesmo ou de seus próprios descendentes', () => {
    const parent = decksRepo.create({ id: 'p1', name: 'Direito' });
    const child = decksRepo.create({ id: 'c1', name: 'Direito::Penal' });
    const subChild = decksRepo.create({ id: 'sc1', name: 'Direito::Penal::Geral' });

    // Mover para si mesmo
    expect(() => decksRepo.move(parent.id, parent.id)).toThrow('Não é possível mover um deck para dentro de si mesmo');

    // Mover para um subdeck
    expect(() => decksRepo.move(parent.id, child.id)).toThrow('Não é possível mover um deck para dentro de seus subdecks');
    expect(() => decksRepo.move(parent.id, subChild.id)).toThrow('Não é possível mover um deck para dentro de seus subdecks');
  });

  test('validações de nomes em create, rename e move', () => {
    decksRepo.create({ name: 'História' });

    // Nome vazio em create
    expect(() => decksRepo.create({ name: '   ' })).toThrow('Nome do deck não pode ser vazio');

    // Nome duplicado em create
    expect(() => decksRepo.create({ name: 'História' })).toThrow('Já existe um deck ativo com o nome "História"');

    // Nome vazio em rename
    const d2 = decksRepo.create({ name: 'Geografia' });
    expect(() => decksRepo.rename(d2.id, '   ')).toThrow('Nome do deck não pode ser vazio');

    // Nome duplicado em rename
    expect(() => decksRepo.rename(d2.id, 'História')).toThrow('Já existe um deck ativo com o nome "História"');

    // Colisão em move
    const math = decksRepo.create({ name: 'Matemática' });
    const algebraRoot = decksRepo.create({ name: 'Álgebra' });
    decksRepo.create({ name: 'Matemática::Álgebra' });
    expect(() => decksRepo.move(algebraRoot.id, math.id)).toThrow('Já existe um deck ativo com o nome "Matemática::Álgebra"');
  });

  test('exclusão lógica (soft delete) oculta o deck e subdecks, e restaurar (Desfazer) recupera', () => {
    const parent = decksRepo.create({ id: 'p1', name: 'Matemática' });
    const child = decksRepo.create({ id: 'c1', name: 'Matemática::Álgebra' });

    decksRepo.softDelete(parent.id);

    // Ocultos por padrão
    expect(decksRepo.getById(parent.id)).toBeNull();
    expect(decksRepo.getById(child.id)).toBeNull();
    expect(decksRepo.listAll()).toHaveLength(0);

    // Visíveis com includeDeleted
    const deletedList = decksRepo.listAll({ includeDeleted: true });
    expect(deletedList).toHaveLength(2);

    // Desfazer / restaurar
    decksRepo.restore(parent.id);
    expect(decksRepo.getById(parent.id)).not.toBeNull();
    expect(decksRepo.getById(child.id)).not.toBeNull();
    expect(decksRepo.listAll()).toHaveLength(2);
  });

  test('rejeita restaurar deck se já existir outro deck ativo com o mesmo nome', () => {
    const original = decksRepo.create({ id: 'p1', name: 'História' });
    decksRepo.softDelete(original.id);

    // Cria outro deck com o mesmo nome enquanto o original está apagado
    decksRepo.create({ id: 'p2', name: 'História' });

    // Tentar restaurar o original deve falhar
    expect(() => decksRepo.restore(original.id)).toThrow(
      'Não é possível restaurar: já existe um deck ativo com o nome "História"'
    );
  });

  test('getDeckTree retorna hierarquia estruturada', () => {
    decksRepo.create({ id: 'p1', name: 'Direito' });
    decksRepo.create({ id: 'c1', name: 'Direito::Penal' });
    decksRepo.create({ id: 'c2', name: 'Direito::Civil' });
    decksRepo.create({ id: 'o1', name: 'Inglês' });

    const tree = decksRepo.getDeckTree();
    expect(tree).toHaveLength(2); // Direito e Inglês no nível raiz

    const direitoNode = tree.find((n) => n.name === 'Direito');
    expect(direitoNode).toBeDefined();
    expect(direitoNode?.children).toHaveLength(2);
    expect(direitoNode?.children.map((c) => c.shortName).sort()).toEqual(['Civil', 'Penal']);
  });

  test('calcula contadores de cards do deck e seus subdecks', () => {
    const ntId = seedBasicNoteType(db);
    const parent = decksRepo.create({ id: 'p1', name: 'História' });
    const child = decksRepo.create({ id: 'c1', name: 'História::Brasil' });

    const note1 = notesRepo.create({
      id: 'n1',
      deck_id: parent.id,
      note_type_id: ntId,
      fields: { Frente: 'F1', Verso: 'V1' },
      tags: [],
    });
    const note2 = notesRepo.create({
      id: 'n2',
      deck_id: child.id,
      note_type_id: ntId,
      fields: { Frente: 'F2', Verso: 'V2' },
      tags: [],
    });

    const now = Date.now();
    // Card novo no pai
    cardsRepo.create({
      id: 'card-1',
      note_id: note1.id,
      deck_id: parent.id,
      ord: 0,
      due: now,
      state: 0, // Novo
    });

    // Card em revisão no filho (vencido)
    cardsRepo.create({
      id: 'card-2',
      note_id: note2.id,
      deck_id: child.id,
      ord: 0,
      due: now - 1000,
      state: 2, // Review
    });

    // Contadores só do filho
    const childCounts = decksRepo.getDeckCounts(child.id, { recursive: false });
    expect(childCounts).toEqual({ new: 0, learning: 0, review: 1, total: 1 });

    // Contadores do pai recursivo (inclui subdecks)
    const parentCounts = decksRepo.getDeckCounts(parent.id, { recursive: true });
    expect(parentCounts).toEqual({ new: 1, learning: 0, review: 1, total: 2 });

    // Testa getDeckTreeWithCounts
    const tree = decksRepo.getDeckTreeWithCounts();
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('p1');
    expect(tree[0].directCounts).toEqual({ new: 1, learning: 0, review: 0, total: 1 });
    expect(tree[0].totalCounts).toEqual({ new: 1, learning: 0, review: 1, total: 2 });
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('c1');
    expect(tree[0].children[0].directCounts).toEqual({ new: 0, learning: 0, review: 1, total: 1 });
    expect(tree[0].children[0].totalCounts).toEqual({ new: 0, learning: 0, review: 1, total: 1 });
  });
});
