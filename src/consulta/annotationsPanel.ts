import { eq, and, isNull, like } from 'drizzle-orm';
import type { FolioDatabase } from '@/db/client';
import { getDb } from '@/db/client';
import { decks } from '@/db/schema';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { loadConsultaUnits } from './units';
import { locate, type AnnotationColor, type AnnotationKind } from '@/webview/shared/anchor';

export interface PanelAnnotationItem {
  id: string;
  noteId: string;
  unitIndex: number;
  deckPath: string;
  kind: AnnotationKind;
  color: AnnotationColor;
  quote: string;
  note: string;
  start: number;
  end: number;
  prefix: string;
  suffix: string;
}

export interface PanelOrphanItem {
  id: string;
  noteId: string;
  deckPath?: string;
  kind: AnnotationKind;
  color: AnnotationColor;
  quote: string;
  note: string;
  reason: 'unlocatable' | 'note_deleted';
}

export interface DeckAnnotationsResult {
  annotations: PanelAnnotationItem[];
  orphans: PanelOrphanItem[];
}

export interface LoadDeckAnnotationsOptions {
  includeSubdecks?: boolean;
  db?: FolioDatabase;
}

/**
 * Remove tags HTML e decodifica entidades para obter o textContent do verso
 * para validação de âncoras no ambiente nativo (fora da WebView).
 */
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Carrega todas as anotações ativas do deck (e subdecks) na ordem rigorosa de leitura da Consulta,
 * identificando e separando as anotações órfãs (tanto trechos apagados do verso quanto notas deletadas).
 * Conforme MODO_CONSULTA.md §3, §5 e §9.
 */
export function loadDeckAnnotations(
  deckId: string,
  options?: LoadDeckAnnotationsOptions
): DeckAnnotationsResult {
  const db = options?.db ?? getDb();
  const includeSubdecks = options?.includeSubdecks ?? true;
  const annotationsRepo = new AnnotationsRepository(db);

  // 1. Obtém as unidades completas do deck na ordem natural da Consulta
  const units = loadConsultaUnits({
    deckId,
    includeSubdecks,
    db,
  });

  const validAnnotations: PanelAnnotationItem[] = [];
  const orphanItems: PanelOrphanItem[] = [];
  const seenOrphanIds = new Set<string>();

  // 2. Classifica as anotações das unidades ativas: localizáveis vs não localizáveis (órfãs de edição)
  for (const unit of units) {
    const text = stripHtmlToText(unit.backHtml);
    const fakeNode = { textContent: text } as unknown as Node;

    for (const ann of unit.annotations) {
      const loc = locate(fakeNode, {
        quote: ann.quote,
        prefix: ann.prefix,
        suffix: ann.suffix,
        start: ann.start,
        end: ann.end,
      });

      if (!loc) {
        // Trecho não encontrado no texto atual da nota (ex: foi apagado no editor de cards)
        if (!seenOrphanIds.has(ann.id)) {
          seenOrphanIds.add(ann.id);
          orphanItems.push({
            id: ann.id,
            noteId: ann.note_id,
            deckPath: unit.deckPath,
            kind: ann.kind,
            color: ann.color,
            quote: ann.quote,
            note: ann.note,
            reason: 'unlocatable',
          });
        }
      } else {
        // Anotação válida posicionada na unidade
        validAnnotations.push({
          id: ann.id,
          noteId: ann.note_id,
          unitIndex: unit.index,
          deckPath: unit.deckPath,
          kind: ann.kind,
          color: ann.color,
          quote: ann.quote,
          note: ann.note,
          start: ann.start,
          end: ann.end,
          prefix: ann.prefix,
          suffix: ann.suffix,
        });
      }
    }
  }

  // 3. Busca anotações órfãs de notas excluídas ou inexistentes (MODO_CONSULTA.md §4)
  let targetDeckIds: string[] | undefined;
  const baseDeck = db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), isNull(decks.deleted_at)))
    .all()[0];

  if (baseDeck) {
    if (includeSubdecks) {
      const subdecks = db
        .select({ id: decks.id })
        .from(decks)
        .where(and(like(decks.name, `${baseDeck.name}::%`), isNull(decks.deleted_at)))
        .all();
      targetDeckIds = [baseDeck.id, ...subdecks.map((s) => s.id)];
    } else {
      targetDeckIds = [baseDeck.id];
    }
  }

  const deletedNoteOrphans = annotationsRepo.listOrphans(targetDeckIds);
  for (const orphan of deletedNoteOrphans) {
    if (!seenOrphanIds.has(orphan.id)) {
      seenOrphanIds.add(orphan.id);
      orphanItems.push({
        id: orphan.id,
        noteId: orphan.note_id,
        kind: orphan.kind,
        color: orphan.color,
        quote: orphan.quote,
        note: orphan.note,
        reason: 'note_deleted',
      });
    }
  }

  return {
    annotations: validAnnotations,
    orphans: orphanItems,
  };
}

/**
 * Filtra a lista de anotações mantendo apenas aquelas que possuem nota escrita pelo usuário.
 */
export function filterAnnotationsWithNotesOnly(
  items: PanelAnnotationItem[]
): PanelAnnotationItem[] {
  return items.filter((item) => Boolean(item.note && item.note.trim().length > 0));
}
