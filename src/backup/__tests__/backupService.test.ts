import JSZip from 'jszip';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { exportBackup, getBackupPreview, restoreBackup } from '../backupService';
import { DecksRepository } from '@/db/repositories/decks';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { SettingsRepository } from '@/db/repositories/settings';
import { ConsultaPosRepository } from '@/db/repositories/consulta-pos';
import { MediaRepository } from '@/db/repositories/media';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('backupService', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let noteTypesRepo: NoteTypesRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;
  let annRepo: AnnotationsRepository;
  let revRepo: ReviewLogsRepository;
  let settingsRepo: SettingsRepository;
  let posRepo: ConsultaPosRepository;
  let mediaRepo: MediaRepository;

  // Mock media storage
  let mediaStorage: Map<string, Uint8Array>;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    noteTypesRepo = new NoteTypesRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);
    annRepo = new AnnotationsRepository(db);
    revRepo = new ReviewLogsRepository(db);
    settingsRepo = new SettingsRepository(db);
    posRepo = new ConsultaPosRepository(db);
    mediaRepo = new MediaRepository(db);

    mediaStorage = new Map<string, Uint8Array>();
    noteTypesRepo.seedBuiltins();
  });

  const mockMediaReader = async (filename: string): Promise<Uint8Array | null> => {
    return mediaStorage.get(filename) ?? null;
  };

  const mockMediaWriter = async (filename: string, bytes: Uint8Array): Promise<void> => {
    mediaStorage.set(filename, bytes);
  };

  test('exporta backup com dados de todas as tabelas e arquivos de mídia em um zip válido', async () => {
    // 1. Cria dados no banco
    const deck = decksRepo.create({
      id: 'deck-1',
      name: 'Medicina::Cardiologia',
      area: 'Medicina',
      description: 'Deck de teste para backup',
    });

    const basicType = noteTypesRepo.getByKind('basic')[0];
    const note = notesRepo.create({
      id: 'note-1',
      deck_id: deck.id,
      note_type_id: basicType.id,
      fields: {
        Frente: 'O que é valva mitral?',
        Verso: 'Valva que separa o átrio esquerdo do ventrículo esquerdo.',
      },
      tags: ['cardiologia', 'anatomia'],
    });

    const card = cardsRepo.create({
      id: 'card-1',
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: Date.now() + 86400000,
      stability: 2.5,
      difficulty: 4.8,
      elapsed_days: 1,
      scheduled_days: 3,
      reps: 2,
      lapses: 0,
      state: 2,
    });

    revRepo.create({
      id: 'rev-1',
      card_id: card.id,
      rating: 3,
      state: 1,
      due: Date.now() + 86400000,
      stability: 2.5,
      difficulty: 4.8,
      elapsed_days: 1,
      last_elapsed_days: 0,
      scheduled_days: 3,
      review_ms: 4500,
      reviewed_at: Date.now() - 10000,
    });

    annRepo.create({
      id: 'ann-1',
      note_id: note.id,
      kind: 'hl',
      color: 'amarelo',
      quote: 'átrio esquerdo',
      prefix: 'separa o ',
      suffix: ' do ventrículo',
      start: 15,
      end: 29,
      note: 'Importante lembrar a relação atrioventricular',
    });

    settingsRepo.set('desiredRetention', 0.85);
    posRepo.save('Medicina::Cardiologia', 4, 120.5);

    mediaRepo.create({
      id: 'media-1',
      filename: 'coracao.png',
      sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
      bytes: 4,
      mime: 'image/png',
    });
    mediaStorage.set('coracao.png', new Uint8Array([137, 80, 78, 71]));

    // 2. Exporta o backup
    const exported = await exportBackup(db, {
      mediaReader: mockMediaReader,
    });

    expect(exported.zipData).toBeInstanceOf(Uint8Array);
    expect(exported.zipData.length).toBeGreaterThan(0);
    expect(exported.base64).toBeDefined();
    expect(exported.result.fileName).toMatch(/^folio-backup-\d{4}-\d{2}-\d{2}/);
    expect(exported.result.stats.decks).toBeGreaterThanOrEqual(1);
    expect(exported.result.stats.notes).toBe(1);
    expect(exported.result.stats.cards).toBe(1);
    expect(exported.result.stats.reviewLogs).toBe(1);
    expect(exported.result.stats.annotations).toBe(1);
    expect(exported.result.stats.media).toBe(1);
    expect(exported.result.mediaCount).toBe(1);

    // 3. Verifica integridade do zip gerado com JSZip
    const zip = await JSZip.loadAsync(exported.zipData);
    expect(zip.file('backup.json')).not.toBeNull();
    expect(zip.file('media/coracao.png')).not.toBeNull();

    const jsonStr = await zip.file('backup.json')!.async('string');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.manifest.app).toBe('folio');
    expect(parsed.manifest.version).toBe(1);
    expect(parsed.data.decks.some((d: { id: string }) => d.id === 'deck-1')).toBe(true);
    expect(parsed.data.notes[0].id).toBe('note-1');
    expect(parsed.data.annotations[0].quote).toBe('átrio esquerdo');
  });

  test('getBackupPreview extrai estatísticas corretamente e valida arquivo corrompido', async () => {
    // 1. Cria um zip válido com backup
    decksRepo.create({ id: 'd-1', name: 'Direito Civil' });
    mediaRepo.create({
      id: 'm-1',
      filename: 'doc.png',
      sha1: 'abc',
      bytes: 2,
      mime: 'image/png',
    });
    mediaStorage.set('doc.png', new Uint8Array([1, 2]));

    const { zipData } = await exportBackup(db, { mediaReader: mockMediaReader });

    const preview = await getBackupPreview(zipData);
    expect(preview.valid).toBe(true);
    expect(preview.stats.decks).toBeGreaterThanOrEqual(1);
    expect(preview.mediaInZip).toBe(1);
    expect(preview.exportedAt).toBeGreaterThan(0);

    // 2. Testa com zip inválido (sem backup.json)
    const emptyZip = new JSZip();
    emptyZip.file('other.txt', 'hello');
    const emptyZipData = await emptyZip.generateAsync({ type: 'uint8array' });

    await expect(getBackupPreview(emptyZipData)).rejects.toThrow();
  });

  test('roundtrip fiel em banco limpo reproduz decks, cards, FSRS, anotações e mídia (PRD §12)', async () => {
    // Banco Origem
    const deckOrigem = decksRepo.create({
      id: 'orig-deck-1',
      name: 'Psicologia::Cognição',
      area: 'Psicologia',
    });

    const clozeType = noteTypesRepo.getByKind('cloze')[0];
    const noteOrigem = notesRepo.create({
      id: 'orig-note-1',
      deck_id: deckOrigem.id,
      note_type_id: clozeType.id,
      fields: {
        Texto: 'A memória de {{c1::trabalho}} tem capacidade {{c2::limitada}}.',
        Extra: 'Modelo de Baddeley',
      },
      tags: ['psicologia', 'memoria'],
    });

    const cardC1 = cardsRepo.create({
      id: 'orig-card-c1',
      note_id: noteOrigem.id,
      deck_id: deckOrigem.id,
      ord: 0,
      due: 1770000000000,
      stability: 15.4,
      difficulty: 3.2,
      elapsed_days: 10,
      scheduled_days: 15,
      reps: 5,
      lapses: 1,
      state: 2,
      last_review: 1769000000000,
    });

    const cardC2 = cardsRepo.create({
      id: 'orig-card-c2',
      note_id: noteOrigem.id,
      deck_id: deckOrigem.id,
      ord: 1,
      due: 1770500000000,
      stability: 22.1,
      difficulty: 2.1,
      elapsed_days: 12,
      scheduled_days: 20,
      reps: 6,
      lapses: 0,
      state: 2,
      last_review: 1769200000000,
    });

    revRepo.create({
      id: 'orig-rev-1',
      card_id: cardC1.id,
      rating: 3,
      state: 2,
      due: 1770000000000,
      stability: 15.4,
      difficulty: 3.2,
      elapsed_days: 10,
      last_elapsed_days: 5,
      scheduled_days: 15,
      review_ms: 3200,
      reviewed_at: 1769000000000,
    });

    annRepo.create({
      id: 'orig-ann-1',
      note_id: noteOrigem.id,
      kind: 'ul',
      color: 'azul',
      quote: 'capacidade',
      prefix: 'de trabalho tem ',
      suffix: ' limitada.',
      start: 24,
      end: 34,
      note: 'Capacidade média de 4 itens (Cowan)',
    });

    settingsRepo.set('buttonMode', 4);
    settingsRepo.set('theme', 'dark');
    posRepo.save('Psicologia::Cognição', 2, 85);

    const testImgBytes = new Uint8Array([1, 2, 3, 4, 5]);
    mediaRepo.create({
      id: 'orig-med-1',
      filename: 'baddeley.jpg',
      sha1: '12345abcde',
      bytes: 5,
      mime: 'image/jpeg',
    });
    mediaStorage.set('baddeley.jpg', testImgBytes);

    // Exporta do banco Origem
    const { zipData } = await exportBackup(db, {
      mediaReader: mockMediaReader,
    });

    // Cria banco Destino limpo
    const destContext = createTestDatabase();
    const destDb = destContext.db;
    const destMediaStorage = new Map<string, Uint8Array>();

    const destMediaWriter = async (filename: string, bytes: Uint8Array): Promise<void> => {
      destMediaStorage.set(filename, bytes);
    };

    // Restaura no banco Destino em modo 'replace'
    const restoreResult = await restoreBackup(zipData, destDb, {
      mode: 'replace',
      mediaWriter: destMediaWriter,
    });

    expect(restoreResult.mode).toBe('replace');
    expect(restoreResult.restoredStats.notes).toBe(1);
    expect(restoreResult.restoredStats.cards).toBe(2);
    expect(restoreResult.restoredStats.annotations).toBe(1);
    expect(restoreResult.restoredMediaCount).toBe(1);

    // Validações minuciosas no banco Destino
    const destDecks = new DecksRepository(destDb);
    const destNotes = new NotesRepository(destDb);
    const destCards = new CardsRepository(destDb);
    const destAnn = new AnnotationsRepository(destDb);
    const destRev = new ReviewLogsRepository(destDb);
    const destSettings = new SettingsRepository(destDb);
    const destPos = new ConsultaPosRepository(destDb);
    const destMedia = new MediaRepository(destDb);

    // Deck
    const recoveredDeck = destDecks.getById('orig-deck-1');
    expect(recoveredDeck).not.toBeNull();
    expect(recoveredDeck?.name).toBe('Psicologia::Cognição');

    // Nota
    const recoveredNote = destNotes.getById('orig-note-1');
    expect(recoveredNote).not.toBeNull();
    expect(recoveredNote?.fields.Texto).toContain('{{c1::trabalho}}');
    expect(recoveredNote?.tags).toEqual(['psicologia', 'memoria']);

    // Cards e FSRS
    const recoveredC1 = destCards.getById('orig-card-c1');
    expect(recoveredC1).not.toBeNull();
    expect(recoveredC1?.stability).toBeCloseTo(15.4);
    expect(recoveredC1?.difficulty).toBeCloseTo(3.2);
    expect(recoveredC1?.due).toBe(1770000000000);
    expect(recoveredC1?.reps).toBe(5);

    const recoveredC2 = destCards.getById('orig-card-c2');
    expect(recoveredC2).not.toBeNull();
    expect(recoveredC2?.id).toBe(cardC2.id);
    expect(recoveredC2?.stability).toBeCloseTo(22.1);
    expect(recoveredC2?.difficulty).toBeCloseTo(2.1);

    // Histórico de revisão
    const recoveredRevLogs = destRev.listByCard('orig-card-c1');
    expect(recoveredRevLogs).toHaveLength(1);
    expect(recoveredRevLogs[0].review_ms).toBe(3200);

    // Anotação
    const recoveredAnnList = destAnn.listByNote('orig-note-1');
    expect(recoveredAnnList).toHaveLength(1);
    expect(recoveredAnnList[0].quote).toBe('capacidade');
    expect(recoveredAnnList[0].note).toBe('Capacidade média de 4 itens (Cowan)');
    expect(recoveredAnnList[0].color).toBe('azul');
    expect(recoveredAnnList[0].kind).toBe('ul');

    // Configurações e Consulta Pos
    expect(destSettings.get('buttonMode')).toBe(4);
    expect(destSettings.get('theme')).toBe('dark');
    const recoveredPos = destPos.get('Psicologia::Cognição');
    expect(recoveredPos?.unit_index).toBe(2);
    expect(recoveredPos?.scroll_offset).toBe(85);

    // Mídia no banco e no disco
    const recoveredMediaRow = destMedia.getByFilename('baddeley.jpg');
    expect(recoveredMediaRow).not.toBeNull();
    expect(recoveredMediaRow?.sha1).toBe('12345abcde');
    expect(destMediaStorage.get('baddeley.jpg')).toEqual(testImgBytes);
  });

  test('modo merge preserva dados locais não conflitantes e atualiza coincidentes', async () => {
    // 1. Cria deck local no banco que NÃO está no backup
    decksRepo.create({
      id: 'local-deck-only',
      name: 'Deck Apenas Local',
    });

    // 2. Prepara backup com deck compartilhado
    decksRepo.create({
      id: 'shared-deck',
      name: 'Nome Antigo',
    });

    await exportBackup(db, {
      mediaReader: mockMediaReader,
    });

    // Modifica o banco simulando evolução antes da restauração
    db.update(schema.decks)
      .set({ name: 'Nome Atualizado no Backup' })
      .where(eq(schema.decks.id, 'shared-deck'))
      .run();

    // Exporta o backup com 'Nome Atualizado no Backup'
    const backupComAtualizacao = await exportBackup(db, {
      mediaReader: mockMediaReader,
    });

    // Restaura no modo 'merge' em outro banco que tem 'local-deck-only' e 'Nome Antigo'
    const otherContext = createTestDatabase();
    const otherDb = otherContext.db;
    const otherDecks = new DecksRepository(otherDb);
    otherDecks.create({ id: 'local-deck-only', name: 'Deck Apenas Local' });
    otherDecks.create({ id: 'shared-deck', name: 'Nome Antigo' });

    await restoreBackup(backupComAtualizacao.zipData, otherDb, {
      mode: 'merge',
      mediaWriter: mockMediaWriter,
    });

    // 'local-deck-only' continuou existindo
    expect(otherDecks.getById('local-deck-only')).not.toBeNull();
    // 'shared-deck' foi atualizado para o nome do backup
    expect(otherDecks.getById('shared-deck')?.name).toBe('Nome Atualizado no Backup');
  });

  test('backup preserva anotações órfãs (MODO_CONSULTA.md §4)', async () => {
    const deck = decksRepo.create({ id: 'd-orf', name: 'Direito Penal' });
    const basicType = noteTypesRepo.getByKind('basic')[0];
    const note = notesRepo.create({
      id: 'n-orf',
      deck_id: deck.id,
      note_type_id: basicType.id,
      fields: { Frente: 'F', Verso: 'V' },
    });

    // Cria anotação
    annRepo.create({
      id: 'ann-orf',
      note_id: note.id,
      quote: 'V',
      start: 0,
      end: 1,
      kind: 'hl',
      color: 'laranja',
    });

    // Exclui logicamente a nota (tornando a anotação órfã)
    notesRepo.softDelete(note.id);

    const { zipData } = await exportBackup(db, { mediaReader: mockMediaReader });

    // Restaura em banco novo
    const newContext = createTestDatabase();
    const newDb = newContext.db;
    await restoreBackup(zipData, newDb, { mode: 'replace', mediaWriter: mockMediaWriter });

    const newAnn = new AnnotationsRepository(newDb);
    const annRow = newAnn.getById('ann-orf');
    expect(annRow).not.toBeNull();
    expect(annRow?.quote).toBe('V');
  });
});
