import { renderTemplate } from './template';
import type {
  NoteTypeTemplate,
  RenderCardFullInput,
  RenderCardInput,
  RenderCardResult,
} from './types';

/**
 * Seleciona a definição de template apropriada e o número de cloze para um card.
 */
function resolveTemplateAndCloze(
  noteType: RenderCardInput['noteType'],
  cardOrd: number
): { templateDef: NoteTypeTemplate | undefined; clozeNumber: number | undefined } {
  if (noteType.kind === 'cloze') {
    const templateDef = noteType.templates[0];
    const clozeNumber = cardOrd + 1;
    return { templateDef, clozeNumber };
  }

  const templateDef =
    noteType.templates.find((t) => t.ord === cardOrd) ?? noteType.templates[0];
  return { templateDef, clozeNumber: undefined };
}

/**
 * Renderiza um lado específico de um card ('front' ou 'back').
 * No caso de 'back', se o template utilizar {{FrontSide}}, a frente é renderizada
 * automaticamente antes para fornecer o conteúdo.
 */
export function renderCardSide(input: RenderCardInput): string {
  const { templateDef, clozeNumber } = resolveTemplateAndCloze(input.noteType, input.cardOrd);

  if (!templateDef) {
    return '';
  }

  if (input.side === 'front') {
    return renderTemplate(templateDef.front, {
      fields: input.fields,
      side: 'front',
      cardOrd: input.cardOrd,
      clozeNumber,
      tags: input.tags,
      deckName: input.deckName,
      cardName: templateDef.name,
      allClozesRevealed: input.allClozesRevealed,
    });
  }

  // side === 'back': renderiza a frente primeiro para resolver {{FrontSide}}
  const frontHtml = renderTemplate(templateDef.front, {
    fields: input.fields,
    side: 'front',
    cardOrd: input.cardOrd,
    clozeNumber,
    tags: input.tags,
    deckName: input.deckName,
    cardName: templateDef.name,
    allClozesRevealed: input.allClozesRevealed,
  });

  return renderTemplate(templateDef.back, {
    fields: input.fields,
    side: 'back',
    frontHtml,
    cardOrd: input.cardOrd,
    clozeNumber,
    tags: input.tags,
    deckName: input.deckName,
    cardName: templateDef.name,
    allClozesRevealed: input.allClozesRevealed,
  });
}

/**
 * Renderiza tanto a frente quanto o verso de um card, garantindo que
 * {{FrontSide}} no verso receba exatamente o HTML produzido na frente.
 */
export function renderCard(input: RenderCardFullInput): RenderCardResult {
  const { templateDef, clozeNumber } = resolveTemplateAndCloze(input.noteType, input.cardOrd);

  if (!templateDef) {
    return { front: '', back: '' };
  }

  const front = renderTemplate(templateDef.front, {
    fields: input.fields,
    side: 'front',
    cardOrd: input.cardOrd,
    clozeNumber,
    tags: input.tags,
    deckName: input.deckName,
    cardName: templateDef.name,
    allClozesRevealed: input.allClozesRevealed,
  });

  const back = renderTemplate(templateDef.back, {
    fields: input.fields,
    side: 'back',
    frontHtml: front,
    cardOrd: input.cardOrd,
    clozeNumber,
    tags: input.tags,
    deckName: input.deckName,
    cardName: templateDef.name,
    allClozesRevealed: input.allClozesRevealed,
  });

  return { front, back };
}
