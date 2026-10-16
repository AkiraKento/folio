import * as FileSystem from 'expo-file-system/legacy';
import type { NoteType } from '@/db/schema';
import { EXEMPLO_AVICENA_PNG_BASE64, RAW_MODEL_FIXTURES } from './generated';

export { EXEMPLO_AVICENA_PNG_BASE64, RAW_MODEL_FIXTURES };

export interface ModelFixtureMeta {
  name: string;
  type: 'standard' | 'cloze';
  fields: readonly string[];
  templates: readonly string[];
}

export interface ModelFixtureExample {
  id: string;
  label: string;
  noteType: string;
  tags: string[];
  fields: Record<string, string>;
  cardOrd?: number;
}

export interface ModelFixture {
  id: string;
  key: 'avicena' | 'anking';
  model: ModelFixtureMeta;
  frontHtml: string;
  backHtml: string;
  styleCss: string;
  example: ModelFixtureExample;
  examples: ModelFixtureExample[];
  toNoteType: () => NoteType;
}

const avicenaRaw = RAW_MODEL_FIXTURES.avicena;
const ankingRaw = RAW_MODEL_FIXTURES.anking;

const AVICENA_CLOZE_EXAMPLE: ModelFixtureExample = {
  id: 'avicena-cloze',
  label: 'Avicena · Cloze (exemplo.json)',
  noteType: avicenaRaw.example.noteType,
  tags: [...avicenaRaw.example.tags],
  fields: { ...avicenaRaw.example.fields },
  cardOrd: 0,
};

const AVICENA_BASIC_EXAMPLE: ModelFixtureExample = {
  id: 'avicena-basico',
  label: 'Avicena · Básico (pergunta e resposta)',
  noteType: avicenaRaw.example.noteType,
  tags: ['Assunto::ClínicaMédica', 'origem::ExemploBásico'],
  fields: {
    question:
      '<p><strong>Clínica Médica.</strong> Qual é o critério diagnóstico sintético de exemplo para a síndrome fictícia de Weiss?</p>',
    answer:
      '<div class="FlashcardAnswerJSX__Answer-sc-k6880g-1 bDwuow"><p><strong>Clínica Médica.</strong> O diagnóstico requer a presença de <strong>dois critérios maiores</strong> associados a um achado laboratorial típico.</p><p><em>Observação clínica com </em><u>destaque</u><em> e imagem ilustrativa:</em></p><img src="exemplo-avicena.png"></div>',
    reference:
      '<p class="FlashcardAnswerJSX__Reference-sc-k6880g-2 gWUDhV"></p><p><em>Manual Sintético de Clínica</em>, <strong>Cap. 4</strong>.</p><p></p>',
  },
  cardOrd: 0,
};

const ANKING_MULTI_CLOZE_EXAMPLE: ModelFixtureExample = {
  id: 'anking-cloze-multiplo',
  label: 'AnKing · Cloze múltiplo + One by one (exemplo.json)',
  noteType: ankingRaw.example.noteType,
  tags: [...ankingRaw.example.tags],
  fields: { ...ankingRaw.example.fields },
  cardOrd: 0,
};

const ANKING_SINGLE_CLOZE_EXAMPLE: ModelFixtureExample = {
  id: 'anking-cloze-unico',
  label: 'AnKing · Cloze único',
  noteType: ankingRaw.example.noteType,
  tags: ['1°semestre', 'Fisio', 'Cardio::Exemplo'],
  fields: {
    Text: 'O potencial de ação cardíaco de resposta rápida depende da abertura dos canais de {{c1::sódio voltagem-dependentes (Nav1.5)::Canal iônico}} na fase 0.',
    Extra: '<b>Correlação fisiológica:</b> bloqueadores da classe I atuam diretamente nessa fase.',
    'Personal Notes': '',
    'Missed Questions': '',
    'One by one': '',
  },
  cardOrd: 0,
};

function buildNoteTypeFromFixture(
  id: string,
  meta: ModelFixtureMeta,
  frontHtml: string,
  backHtml: string,
  styleCss: string
): NoteType {
  return {
    id,
    name: meta.name,
    kind: meta.type === 'cloze' ? 'cloze' : 'custom',
    fields: meta.fields.map((name, idx) => ({ name, ord: idx })),
    templates: meta.templates.map((name, idx) => ({
      name,
      ord: idx,
      front: frontHtml,
      back: backHtml,
    })),
    css: styleCss,
    source_id: null,
    created_at: 0,
    updated_at: 0,
    deleted_at: null,
  };
}

export const AVICENA_FIXTURE: ModelFixture = {
  id: 'fixture-avicena',
  key: 'avicena',
  model: avicenaRaw.model,
  frontHtml: avicenaRaw.frontHtml,
  backHtml: avicenaRaw.backHtml,
  styleCss: avicenaRaw.styleCss,
  example: AVICENA_CLOZE_EXAMPLE,
  examples: [AVICENA_CLOZE_EXAMPLE, AVICENA_BASIC_EXAMPLE],
  toNoteType: () =>
    buildNoteTypeFromFixture(
      'fixture-avicena',
      avicenaRaw.model,
      avicenaRaw.frontHtml,
      avicenaRaw.backHtml,
      avicenaRaw.styleCss
    ),
};

export const ANKING_FIXTURE: ModelFixture = {
  id: 'fixture-anking',
  key: 'anking',
  model: ankingRaw.model,
  frontHtml: ankingRaw.frontHtml,
  backHtml: ankingRaw.backHtml,
  styleCss: ankingRaw.styleCss,
  example: ANKING_MULTI_CLOZE_EXAMPLE,
  examples: [ANKING_MULTI_CLOZE_EXAMPLE, ANKING_SINGLE_CLOZE_EXAMPLE],
  toNoteType: () =>
    buildNoteTypeFromFixture(
      'fixture-anking',
      ankingRaw.model,
      ankingRaw.frontHtml,
      ankingRaw.backHtml,
      ankingRaw.styleCss
    ),
};

export function getCardModelFixtures(): Record<'avicena' | 'anking', ModelFixture> {
  return {
    avicena: AVICENA_FIXTURE,
    anking: ANKING_FIXTURE,
  };
}

export function listCardModelFixtures(): ModelFixture[] {
  return [AVICENA_FIXTURE, ANKING_FIXTURE];
}

/**
 * Garante que a imagem sintética `exemplo-avicena.png` exista na pasta de mídia local
 * do dispositivo/emulador para que o Laboratório de cards exiba imagens via baseUrl.
 */
export async function ensureFixtureMediaFiles(): Promise<string> {
  const baseDocDir = FileSystem.documentDirectory ?? '';
  if (!baseDocDir) {
    return '';
  }

  const normalizedDoc = baseDocDir.endsWith('/') ? baseDocDir : `${baseDocDir}/`;
  const mediaDir = `${normalizedDoc}media/`;

  try {
    const dirInfo = await FileSystem.getInfoAsync(mediaDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
    }

    const avicenaImgPath = `${mediaDir}exemplo-avicena.png`;
    const imgInfo = await FileSystem.getInfoAsync(avicenaImgPath);
    if (!imgInfo.exists) {
      await FileSystem.writeAsStringAsync(avicenaImgPath, EXEMPLO_AVICENA_PNG_BASE64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const ankingIconPath = `${mediaDir}_AnKingIconSmall.png`;
    const iconInfo = await FileSystem.getInfoAsync(ankingIconPath);
    if (!iconInfo.exists) {
      await FileSystem.writeAsStringAsync(ankingIconPath, EXEMPLO_AVICENA_PNG_BASE64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  } catch {
    // Em ambiente de teste sem FileSystem real, ignora silenciosamente
  }

  return mediaDir;
}
