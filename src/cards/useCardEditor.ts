import { useState, useEffect, useCallback } from 'react';
import { DecksRepository } from '@/db/repositories/decks';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { NotesRepository } from '@/db/repositories/notes';
import { BUILTIN_NOTE_TYPE_IDS, getExpectedCardOrdsForNote } from '@/db/builtin-note-types';
import { createNoteWithCards, updateNoteWithCards } from './cardCreationService';
import { pickImageAndSave, getMediaDirectory } from '@/media/mediaService';
import { renderCardSide } from '@/render/card';
import { extractClozeNumbers } from '@/render/cloze';
import type { Deck, NoteType } from '@/db/schema';
import { strings } from '@/ui/strings';

export interface UseCardEditorOptions {
  initialDeckId?: string;
  noteId?: string;
}

export function useCardEditor(options?: UseCardEditorOptions) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableDecks, setAvailableDecks] = useState<Deck[]>([]);
  const [availableNoteTypes, setAvailableNoteTypes] = useState<NoteType[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(options?.initialDeckId ?? '');
  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState<string>(BUILTIN_NOTE_TYPE_IDS.BASIC);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string>('');
  const [activeFieldName, setActiveFieldName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [previewCardOrd, setPreviewCardOrd] = useState<number>(0);
  const [mediaBasePath, setMediaBasePath] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Inicializa dados do banco
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const decksRepo = new DecksRepository();
        const noteTypesRepo = new NoteTypesRepository();
        noteTypesRepo.seedBuiltins();

        const allDecks = decksRepo.listAll();
        const allNoteTypes = noteTypesRepo.list();

        setAvailableDecks(allDecks);
        setAvailableNoteTypes(allNoteTypes);

        // Define deck inicial
        if (options?.initialDeckId && allDecks.some((d) => d.id === options.initialDeckId)) {
          setSelectedDeckId(options.initialDeckId);
        } else if (allDecks.length > 0) {
          setSelectedDeckId(allDecks[0].id);
        }

        // Se estiver editando nota existente
        if (options?.noteId) {
          const notesRepo = new NotesRepository();
          const existingNote = notesRepo.getById(options.noteId);
          if (existingNote) {
            setSelectedDeckId(existingNote.deck_id);
            setSelectedNoteTypeId(existingNote.note_type_id);
            setFields(existingNote.fields);
            setTags(existingNote.tags.join(' '));
          }
        } else {
          // Novo card: inicializa campos vazios com base no note type selecionado
          const currentNoteType =
            allNoteTypes.find((nt) => nt.id === BUILTIN_NOTE_TYPE_IDS.BASIC) ?? allNoteTypes[0];
          if (currentNoteType) {
            const initialFields: Record<string, string> = {};
            for (const f of currentNoteType.fields) {
              initialFields[f.name] = '';
            }
            setFields(initialFields);
            setActiveFieldName(currentNoteType.fields[0]?.name ?? null);
          }
        }

        const mediaDir = await getMediaDirectory();
        setMediaBasePath(mediaDir);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao inicializar editor');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [options?.initialDeckId, options?.noteId]);

  // Altera note type e atualiza chaves dos campos
  const handleSelectNoteType = useCallback(
    (noteTypeId: string) => {
      setSelectedNoteTypeId(noteTypeId);
      const noteType = availableNoteTypes.find((nt) => nt.id === noteTypeId);
      if (!noteType) return;

      setFields((prev) => {
        const next: Record<string, string> = {};
        for (const f of noteType.fields) {
          next[f.name] = prev[f.name] ?? '';
        }
        return next;
      });

      setActiveFieldName(noteType.fields[0]?.name ?? null);
      setPreviewCardOrd(0);
    },
    [availableNoteTypes]
  );

  const setFieldValue = useCallback((name: string, value: string) => {
    setFields((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const currentNoteType = availableNoteTypes.find((nt) => nt.id === selectedNoteTypeId);
  const currentDeck = availableDecks.find((d) => d.id === selectedDeckId);

  // Calcula ords esperados para a prévia
  const expectedOrds = currentNoteType ? getExpectedCardOrdsForNote(currentNoteType, fields) : [0];

  // Insere atalho cloze no campo ativo
  const insertClozeShortcut = useCallback(() => {
    const targetField = activeFieldName ?? currentNoteType?.fields[0]?.name;
    if (!targetField) return;

    const currentText = fields[targetField] ?? '';
    const existingClozes = extractClozeNumbers(currentText);
    const nextClozeNum = existingClozes.length > 0 ? Math.max(...existingClozes) + 1 : 1;

    const clozeSnippet = `{{c${nextClozeNum}::...}}`;
    const newText = currentText ? `${currentText} ${clozeSnippet}` : clozeSnippet;

    setFieldValue(targetField, newText);
  }, [activeFieldName, currentNoteType, fields, setFieldValue]);

  // Seleciona imagem e anexa no campo ativo
  const insertImageFromGallery = useCallback(async () => {
    try {
      const result = await pickImageAndSave();
      if (!result) return;

      const targetField = activeFieldName ?? currentNoteType?.fields[0]?.name;
      if (!targetField) return;

      const currentText = fields[targetField] ?? '';
      const newText = currentText ? `${currentText}\n${result.imgTag}` : result.imgTag;

      setFieldValue(targetField, newText);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao selecionar imagem');
    }
  }, [activeFieldName, currentNoteType, fields, setFieldValue]);

  // Renderiza HTML para a prévia
  const previewHtml = useCallback(() => {
    if (!currentNoteType) return '';

    const parsedTags = tags
      .split(' ')
      .map((t) => t.trim())
      .filter(Boolean);

    return renderCardSide({
      noteType: currentNoteType,
      fields,
      side: previewSide,
      cardOrd: previewCardOrd,
      tags: parsedTags,
      deckName: currentDeck?.name,
    });
  }, [currentNoteType, currentDeck, fields, previewSide, previewCardOrd, tags]);

  // Salva o card
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!selectedDeckId) {
      setErrorMessage(strings.cardEditor.errorDeckRequired);
      return false;
    }

    if (!currentNoteType) {
      return false;
    }

    const firstFieldName = currentNoteType.fields[0]?.name;
    const firstFieldValue = firstFieldName ? fields[firstFieldName]?.trim() : '';

    if (!firstFieldValue) {
      setErrorMessage(strings.cardEditor.errorFirstFieldRequired);
      return false;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const parsedTags = tags
        .split(' ')
        .map((t) => t.trim())
        .filter(Boolean);

      if (options?.noteId) {
        updateNoteWithCards({
          noteId: options.noteId,
          deckId: selectedDeckId,
          noteTypeId: selectedNoteTypeId,
          fields,
          tags: parsedTags,
        });
        setSuccessMessage(strings.cardEditor.cardUpdated);
      } else {
        createNoteWithCards({
          deckId: selectedDeckId,
          noteTypeId: selectedNoteTypeId,
          fields,
          tags: parsedTags,
        });
        setSuccessMessage(strings.cardEditor.cardSaved);

        // Limpa os campos para o próximo card mantendo modelo e deck selecionados
        const resetFields: Record<string, string> = {};
        for (const f of currentNoteType.fields) {
          resetFields[f.name] = '';
        }
        setFields(resetFields);
        setTags('');
        setPreviewCardOrd(0);
      }

      return true;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar card');
      return false;
    } finally {
      setSaving(false);
    }
  }, [selectedDeckId, currentNoteType, fields, tags, options?.noteId, selectedNoteTypeId]);

  return {
    loading,
    saving,
    availableDecks,
    availableNoteTypes,
    currentDeck,
    currentNoteType,
    selectedDeckId,
    selectedNoteTypeId,
    fields,
    tags,
    activeFieldName,
    activeTab,
    previewSide,
    previewCardOrd,
    expectedOrds,
    mediaBasePath,
    previewHtml: previewHtml(),
    errorMessage,
    successMessage,
    setSelectedDeckId,
    setSelectedNoteTypeId: handleSelectNoteType,
    setFieldValue,
    setTags,
    setActiveFieldName,
    setActiveTab,
    setPreviewSide,
    setPreviewCardOrd,
    insertClozeShortcut,
    insertImageFromGallery,
    save: handleSave,
    clearError: () => setErrorMessage(null),
    clearSuccess: () => setSuccessMessage(null),
  };
}
