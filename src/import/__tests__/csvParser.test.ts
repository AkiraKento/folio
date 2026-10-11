import { isNull } from 'drizzle-orm';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import * as schema from '@/db/schema';
import { DecksRepository } from '@/db/repositories/decks';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import type { FolioDatabase } from '@/db/client';
import type { ImportProgress } from '../types';
import {
  parseCsv,
  getCsvPreview,
  importCsv,
} from '../csvParser';

describe('CSV Parser e Importer (M6)', () => {
  describe('parseCsv', () => {
    it('deve fazer parse de formato padrão frente;verso;tags', () => {
      const csv = `Qual o osso mais longo do corpo humano?;Fêmur;anatomia osso
Qual a capital do Brasil?;Brasília;geografia brasil`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({
        front: 'Qual o osso mais longo do corpo humano?',
        back: 'Fêmur',
        tags: ['anatomia', 'osso'],
      });
      expect(result.rows[1]).toEqual({
        front: 'Qual a capital do Brasil?',
        back: 'Brasília',
        tags: ['geografia', 'brasil'],
      });
      expect(result.delimiter).toBe(';');
    });

    it('deve ignorar linha de cabeçalho típica frente;verso;tags', () => {
      const csv = `Frente;Verso;Tags
O que é sístole?;Contração do músculo cardíaco;cardio fisiologia
O que é diástole?;Relaxamento do músculo cardíaco;cardio fisiologia`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(2);
      expect(result.hasHeader).toBe(true);
      expect(result.rows[0].front).toBe('O que é sístole?');
      expect(result.rows[1].front).toBe('O que é diástole?');
    });

    it('deve suportar cabeçalhos em inglês como front;back;tags', () => {
      const csv = `front;back;tags
Mitocôndria;Produção de ATP;biologia`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(1);
      expect(result.hasHeader).toBe(true);
      expect(result.rows[0].front).toBe('Mitocôndria');
      expect(result.rows[0].back).toBe('Produção de ATP');
      expect(result.rows[0].tags).toEqual(['biologia']);
    });

    it('deve tratar campos entre aspas contendo ponto e vírgula e aspas escapadas', () => {
      const csv = `"Pergunta com ; no meio";"Resposta com ""aspas duplas"" e ; ponto";medicina`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].front).toBe('Pergunta com ; no meio');
      expect(result.rows[0].back).toBe('Resposta com "aspas duplas" e ; ponto');
      expect(result.rows[0].tags).toEqual(['medicina']);
    });

    it('deve tratar campos multilinhas com quebras de linha dentro de aspas', () => {
      const csv = `"Pergunta linha 1\nPergunta linha 2";"Resposta linha 1\nResposta linha 2";geral`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(1);
      // Quebras de linha em texto puro viram <br> para manter legibilidade visual
      expect(result.rows[0].front).toBe('Pergunta linha 1<br>Pergunta linha 2');
      expect(result.rows[0].back).toBe('Resposta linha 1<br>Resposta linha 2');
      expect(result.rows[0].tags).toEqual(['geral']);
    });

    it('deve preservar tags HTML se o campo já contiver marcações HTML', () => {
      const csv = `<b>Pergunta em negrito</b>;<p>Parágrafo 1</p><p>Parágrafo 2</p>;html`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].front).toBe('<b>Pergunta em negrito</b>');
      expect(result.rows[0].back).toBe('<p>Parágrafo 1</p><p>Parágrafo 2</p>');
    });

    it('deve parsear tags separadas por espaço, vírgula ou prefixadas com #', () => {
      const csv = `Pergunta 1;Resposta 1;#cardio #hipertensao
Pergunta 2;Resposta 2;neuro, anatomia, snc
Pergunta 3;Resposta 3;`;

      const result = parseCsv(csv);
      expect(result.rows[0].tags).toEqual(['cardio', 'hipertensao']);
      expect(result.rows[1].tags).toEqual(['neuro', 'anatomia', 'snc']);
      expect(result.rows[2].tags).toEqual([]);
    });

    it('deve aceitar linhas com apenas frente e verso sem coluna de tags', () => {
      const csv = `Pergunta única;Resposta única`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].front).toBe('Pergunta única');
      expect(result.rows[0].back).toBe('Resposta única');
      expect(result.rows[0].tags).toEqual([]);
    });

    it('deve ignorar linhas vazias ou com espaços em branco', () => {
      const csv = `
        
Frente 1;Verso 1;tag1

Frente 2;Verso 2;tag2
   
`;

      const result = parseCsv(csv);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].front).toBe('Frente 1');
      expect(result.rows[1].front).toBe('Frente 2');
    });

    it('deve suportar delimitador vírgula quando não houver ponto e vírgula', () => {
      const csv = `Front,Back,Tags
"Cell membrane","Lipid bilayer","biology"
"Nucleus","Genetic material","genetics"`;

      const result = parseCsv(csv);
      expect(result.delimiter).toBe(',');
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].front).toBe('Cell membrane');
      expect(result.rows[0].back).toBe('Lipid bilayer');
      expect(result.rows[0].tags).toEqual(['biology']);
    });

    it('deve suportar delimitador tab quando não houver ponto e vírgula nem vírgula', () => {
      const csv = `Front\tBack\tTags\nPerg1\tResp1\ttag1\nPerg2\tResp2\ttag2`;

      const result = parseCsv(csv);
      expect(result.delimiter).toBe('\t');
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].front).toBe('Perg1');
      expect(result.rows[0].back).toBe('Resp1');
    });
  });

  describe('getCsvPreview', () => {
    it('deve gerar prévia com contagens corretas e nome do deck derivado do arquivo', () => {
      const csv = `Frente;Verso;Tags
Qual a função dos rins?;Filtração do sangue;nefro
Qual o néfron?;Unidade funcional do rim;nefro`;

      const preview = getCsvPreview(csv, 'Nefrologia Clinica.csv');
      expect(preview.totalNotes).toBe(2);
      expect(preview.totalCards).toBe(2);
      expect(preview.totalMedia).toBe(0);
      expect(preview.modelsCount).toBe(1);
      expect(preview.decks).toHaveLength(1);
      expect(preview.decks[0].name).toBe('Nefrologia Clinica');
      expect(preview.decks[0].notesCount).toBe(2);
      expect(preview.decks[0].cardsCount).toBe(2);
    });

    it('deve usar fallback amigável quando não houver nome de arquivo', () => {
      const csv = `Pergunta;Resposta;tag`;
      const preview = getCsvPreview(csv);
      expect(preview.decks[0].name).toBe('CSV Importado');
    });
  });

  describe('importCsv', () => {
    let db: FolioDatabase;

    beforeEach(() => {
      const context = createTestDatabase();
      db = context.db;
    });

    it('deve importar notas e criar cards FSRS iniciais em um novo deck', async () => {
      const csv = `Frente 1;Verso 1;tag1 tag2
Frente 2;Verso 2;tag3`;

      const result = await importCsv(csv, db, {
        deckName: 'Biologia Celular',
      });

      expect(result.importedDecks).toBe(1);
      expect(result.importedNotes).toBe(2);
      expect(result.importedCards).toBe(2);
      expect(result.importedMedia).toBe(0);
      expect(result.deckIds).toHaveLength(1);

      // Verifica criação do deck
      const decksRepo = new DecksRepository(db);
      const deck = decksRepo.getById(result.deckIds[0]);
      expect(deck).toBeDefined();
      expect(deck?.name).toBe('Biologia Celular');

      // Verifica inserção das notas
      const allNotes = db.select().from(schema.notes).all();
      expect(allNotes).toHaveLength(2);
      expect(allNotes[0].deck_id).toBe(deck!.id);
      expect(allNotes[0].note_type_id).toBe(BUILTIN_NOTE_TYPE_IDS.BASIC);
      expect(allNotes[0].fields).toEqual({
        Frente: 'Frente 1',
        Verso: 'Verso 1',
      });
      expect(allNotes[0].tags).toEqual(['tag1', 'tag2']);

      // Verifica criação dos cards com estado inicial FSRS
      const allCards = db.select().from(schema.cards).all();
      expect(allCards).toHaveLength(2);
      expect(allCards[0].note_id).toBe(allNotes[0].id);
      expect(allCards[0].deck_id).toBe(deck!.id);
      expect(allCards[0].ord).toBe(0);
      expect(allCards[0].state).toBe(0); // Novo
      expect(allCards[0].reps).toBe(0);
      expect(allCards[0].lapses).toBe(0);
      expect(allCards[0].stability).toBe(0);
      expect(allCards[0].difficulty).toBe(0);
      expect(allCards[0].due).toBeGreaterThan(0);
    });

    it('deve importar em um deck já existente sem duplicar o deck', async () => {
      const decksRepo = new DecksRepository(db);
      const existingDeck = decksRepo.create({ name: 'Medicina::Farmacologia' });

      const csv = `Fármaco A;Mecanismo A;farmaco
Fármaco B;Mecanismo B;farmaco`;

      const result = await importCsv(csv, db, {
        deckId: existingDeck.id,
      });

      expect(result.importedDecks).toBe(1);
      expect(result.importedNotes).toBe(2);
      expect(result.deckIds[0]).toBe(existingDeck.id);

      // Não deve ter criado outro deck
      const decks = db.select().from(schema.decks).where(isNull(schema.decks.deleted_at)).all();
      expect(decks).toHaveLength(1);
      expect(decks[0].id).toBe(existingDeck.id);
    });

    it('deve reportar progresso por etapas durante a importação', async () => {
      const csv = `Q1;A1\nQ2;A2\nQ3;A3`;
      const progressCalls: string[] = [];

      await importCsv(csv, db, {
        deckName: 'Teste Progresso',
        onProgress: (p: ImportProgress) => {
          progressCalls.push(p.stage);
        },
      });

      expect(progressCalls).toContain('importing_decks');
      expect(progressCalls).toContain('importing_notes');
      expect(progressCalls).toContain('importing_cards');
      expect(progressCalls).toContain('completed');
    });

    it('deve lançar erro se o CSV não contiver nenhuma linha válida', async () => {
      const csv = `Frente;Verso;Tags\n   \n`;
      await expect(importCsv(csv, db)).rejects.toThrow(
        /Nenhuma nota encontrada no arquivo CSV/
      );
    });
  });
});
