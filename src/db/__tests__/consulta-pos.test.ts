import { createTestDatabase } from './test-utils';
import { ConsultaPosRepository } from '../repositories/consulta-pos';

describe('ConsultaPosRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let posRepo: ConsultaPosRepository;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    posRepo = new ConsultaPosRepository(db);
  });

  test('retorna null para deck sem posição salva', () => {
    expect(posRepo.get('deck-1')).toBeNull();
  });

  test('salva e recupera a posição de leitura de um deck', () => {
    const saved = posRepo.save('deck-1', 5, 240.5);
    expect(saved.deck_query).toBe('deck-1');
    expect(saved.unit_index).toBe(5);
    expect(saved.scroll_offset).toBe(240.5);

    const fetched = posRepo.get('deck-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.unit_index).toBe(5);
    expect(fetched?.scroll_offset).toBe(240.5);
  });

  test('atualiza posição existente atualizando updated_at', () => {
    const initial = posRepo.save('deck-1', 2, 50);
    const updated = posRepo.save('deck-1', 8, 120);

    expect(updated.unit_index).toBe(8);
    expect(updated.scroll_offset).toBe(120);
    expect(updated.created_at).toBe(initial.created_at);
    expect(updated.updated_at).toBeGreaterThanOrEqual(initial.updated_at);

    const fetched = posRepo.get('deck-1');
    expect(fetched?.unit_index).toBe(8);
    expect(fetched?.scroll_offset).toBe(120);
  });

  test('remove posição com delete', () => {
    posRepo.save('deck-1', 4, 100);
    expect(posRepo.get('deck-1')).not.toBeNull();

    const result = posRepo.delete('deck-1');
    expect(result).toBe(true);
    expect(posRepo.get('deck-1')).toBeNull();
  });

  test('getLatest retorna null quando tabela vazia', () => {
    expect(posRepo.getLatest()).toBeNull();
  });

  test('getLatest e list retornam posições ordenadas pela atualização mais recente', async () => {
    posRepo.save('deck-alpha', 2, 50);
    // Simula pequena diferença temporal
    await new Promise((resolve) => setTimeout(resolve, 5));
    posRepo.save('deck-beta', 15, 300);

    const latest = posRepo.getLatest();
    expect(latest).not.toBeNull();
    expect(latest?.deck_query).toBe('deck-beta');
    expect(latest?.unit_index).toBe(15);
    expect(latest?.scroll_offset).toBe(300);

    const all = posRepo.list();
    expect(all).toHaveLength(2);
    expect(all[0].deck_query).toBe('deck-beta');
    expect(all[1].deck_query).toBe('deck-alpha');
  });

  test('getLatest ignora registros excluídos', () => {
    posRepo.save('deck-deleted', 10, 200);
    posRepo.delete('deck-deleted');

    expect(posRepo.getLatest()).toBeNull();
  });
});
