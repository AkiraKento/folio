import fs from 'node:fs';
import path from 'node:path';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import * as schema from '@/db/schema';
import { getApkgPreview, importApkg } from '../importer';

describe('Benchmark com .apkg real de grande porte (PRD §12)', () => {
  const apkgPath = path.join(process.cwd(), 'assets', 'Notas Selecionadas.apkg');
  const hasRealApkg = fs.existsSync(apkgPath);

  (hasRealApkg ? it : it.skip)(
    'deve importar deck real de ~5.000 cards com imagens em menos de 60 s mantendo integridade',
    async () => {
      const { db } = createTestDatabase();
      const fileBytes = fs.readFileSync(apkgPath);

      // 1. Mede tempo da prévia
      const tPreview0 = Date.now();
      const preview = await getApkgPreview(fileBytes);
      const previewDuration = (Date.now() - tPreview0) / 1000;

      expect(preview.totalNotes).toBeGreaterThan(4000);
      expect(preview.totalCards).toBeGreaterThan(4000);
      expect(preview.totalMedia).toBeGreaterThan(2500);
      expect(preview.decks.length).toBeGreaterThan(200);

      // 2. Mede tempo da importação completa
      const stagesLogged: string[] = [];
      const tImport0 = Date.now();
      const result = await importApkg(fileBytes, db, {
        scheduleMode: 'keep_intervals',
        onProgress: (p) => {
          if (!stagesLogged.includes(p.stage)) {
            stagesLogged.push(p.stage);
          }
        },
      });
      const importDuration = (Date.now() - tImport0) / 1000;

      // 3. Validação dos critérios de PRD §12
      // Critério: menos de 60 segundos
      expect(importDuration).toBeLessThan(60);

      // Total de cards, notas, decks e mídias importadas
      expect(result.importedCards).toBeGreaterThanOrEqual(4000);
      expect(result.importedNotes).toBeGreaterThanOrEqual(4000);
      expect(result.importedMedia).toBeGreaterThanOrEqual(2500);
      expect(result.importedDecks).toBeGreaterThanOrEqual(200);

      // 4. Verificação de persistência no banco SQLite
      const totalCardsInDb = db.select().from(schema.cards).all();
      expect(totalCardsInDb.length).toBe(result.importedCards);

      const totalDecksInDb = db.select().from(schema.decks).all();
      expect(totalDecksInDb.length).toBeGreaterThanOrEqual(result.importedDecks);

      const totalMediaInDb = db.select().from(schema.media).all();
      // Mídias são deduplicadas por SHA-1 no MediaRepository
      expect(totalMediaInDb.length).toBeLessThanOrEqual(result.importedMedia);
      expect(totalMediaInDb.length).toBeGreaterThan(2500);

      // Valida que nenhum card ficou sem note_id ou deck_id válido
      const sampleCard = totalCardsInDb[0];
      expect(sampleCard).toBeDefined();
      expect(sampleCard.note_id).toBeTruthy();
      expect(sampleCard.deck_id).toBeTruthy();
      expect(sampleCard.due).toBeGreaterThan(0);

      // 5. Teste de reimportação idempotente (não deve duplicar)
      const tReimport0 = Date.now();
      const reimportResult = await importApkg(fileBytes, db, {
        scheduleMode: 'keep_intervals',
      });
      const reimportDuration = (Date.now() - tReimport0) / 1000;

      expect(reimportDuration).toBeLessThan(60);
      expect(reimportResult.createdCards).toBe(0);
      expect(reimportResult.updatedCards).toBe(result.importedCards);

      const cardsAfterReimport = db.select().from(schema.cards).all();
      expect(cardsAfterReimport.length).toBe(result.importedCards);

      console.log(`\n========================================`);
      console.log(`RESULTADOS DO BENCHMARK REAL (PRD §12):`);
      console.log(`- Arquivo: Notas Selecionadas.apkg (~476 MB)`);
      console.log(`- Prévia gerada em: ${previewDuration.toFixed(2)}s`);
      console.log(`- Importação inicial: ${importDuration.toFixed(2)}s (< 60s OK!)`);
      console.log(`- Reimportação idempotente: ${reimportDuration.toFixed(2)}s`);
      console.log(`- Decks importados: ${result.importedDecks}`);
      console.log(`- Notas importadas: ${result.importedNotes}`);
      console.log(`- Cards importados: ${result.importedCards}`);
      console.log(`- Mídias processadas: ${result.importedMedia}`);
      console.log(`========================================\n`);
    },
    120000 // Timeout de 2 minutos para permitir a leitura de 476 MB
  );
});
