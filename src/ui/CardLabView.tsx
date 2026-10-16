import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb, type FolioDatabase } from '@/db/client';
import * as schema from '@/db/schema';
import type { NoteType } from '@/db/schema';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { DEFAULT_SETTINGS, SettingsRepository } from '@/db/repositories/settings';

import { renderCard } from '@/render';
import {
  ensureFixtureMediaFiles,
  listCardModelFixtures,
  type ModelFixture,
  type ModelFixtureExample,
} from '@/webview/card/__fixtures__';
import type { CardSide, ThemeMode } from '@/webview/card/types';
import { useMediaDirectory } from '@/media';
import { CardView } from './CardView';
import { Snackbar } from './Snackbar';
import { strings } from './strings';
import { useTheme } from './theme';

export interface CardLabViewProps {
  onBack?: () => void;
  db?: FolioDatabase;
}

interface LabModelItem {
  id: string;
  name: string;
  isFixture: boolean;
  noteType: NoteType;
  fixture?: ModelFixture;
}

function buildDefaultFieldsForNoteType(noteType: NoteType): {
  fields: Record<string, string>;
  tags: string[];
  cardOrd: number;
} {
  const fields: Record<string, string> = {};
  const sortedFields = [...noteType.fields].sort((a, b) => a.ord - b.ord);

  if (noteType.kind === 'cloze') {
    sortedFields.forEach((f, idx) => {
      if (idx === 0) {
        fields[f.name] =
          'Texto de exemplo com {{c1::lacuna principal::dica}} no laboratório.';
      } else {
        fields[f.name] = idx === 1 ? 'Observação extra de exemplo.' : '';
      }
    });
  } else {
    sortedFields.forEach((f, idx) => {
      if (idx === 0) {
        fields[f.name] = '<p><strong>Pergunta de exemplo:</strong> qual é o conceito testado?</p>';
      } else if (idx === 1) {
        fields[f.name] = '<p><strong>Resposta de exemplo:</strong> definição sintética no laboratório.</p>';
      } else {
        fields[f.name] = `<p>Campo ${f.name} de exemplo</p>`;
      }
    });
  }

  return {
    fields,
    tags: ['exemplo::laboratorio', 'weiss::teste'],
    cardOrd: 0,
  };
}

export function CardLabView({ onBack, db }: CardLabViewProps) {
  const { theme } = useTheme();
  const database = db ?? getDb();
  const defaultMediaDir = useMediaDirectory();
  const [mediaDir, setMediaDir] = useState<string>(defaultMediaDir);

  const fixtures = useMemo(() => listCardModelFixtures(), []);
  const [dbModels, setDbModels] = useState<NoteType[]>([]);
  const executeModelScripts = useMemo(() => {
    try {
      const repo = new SettingsRepository(database);
      return repo.getWithDefault<boolean>(
        'executeModelScripts',
        DEFAULT_SETTINGS.executeModelScripts
      );
    } catch {
      return DEFAULT_SETTINGS.executeModelScripts;
    }
  }, [database]);

  useEffect(() => {
    try {
      const repo = new NoteTypesRepository(database);
      setDbModels(repo.list());
    } catch {
      setDbModels([]);
    }
  }, [database]);

  useEffect(() => {
    let active = true;
    ensureFixtureMediaFiles().then((dir) => {
      if (active && dir) {
        setMediaDir(dir);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo<LabModelItem[]>(() => {
    const fixtureItems: LabModelItem[] = fixtures.map((fx) => ({
      id: fx.id,
      name: fx.model.name,
      isFixture: true,
      noteType: fx.toNoteType(),
      fixture: fx,
    }));

    const databaseItems: LabModelItem[] = dbModels.map((nt) => ({
      id: nt.id,
      name: nt.name,
      isFixture: false,
      noteType: nt,
    }));

    return [...fixtureItems, ...databaseItems];
  }, [fixtures, dbModels]);

  const [selectedItemId, setSelectedItemId] = useState<string>(
    () => items[0]?.id ?? 'fixture-avicena'
  );
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [side, setSide] = useState<CardSide>('front');
  const [cardTheme, setCardTheme] = useState<ThemeMode>('light');
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [realNoteOverride, setRealNoteOverride] = useState<{
    fields: Record<string, string>;
    tags: string[];
    cardOrd: number;
  } | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((it) => it.id === selectedItemId) ?? items[0],
    [items, selectedItemId]
  );

  const activeFixtureExample = useMemo<ModelFixtureExample | null>(() => {
    if (!selectedItem?.fixture) return null;
    if (selectedExampleId) {
      const found = selectedItem.fixture.examples.find((ex) => ex.id === selectedExampleId);
      if (found) return found;
    }
    return selectedItem.fixture.example;
  }, [selectedItem, selectedExampleId]);

  const activeNoteData = useMemo(() => {
    if (realNoteOverride) {
      return realNoteOverride;
    }
    if (activeFixtureExample) {
      return {
        fields: activeFixtureExample.fields,
        tags: activeFixtureExample.tags,
        cardOrd: activeFixtureExample.cardOrd ?? 0,
      };
    }
    if (selectedItem) {
      return buildDefaultFieldsForNoteType(selectedItem.noteType);
    }
    return { fields: {}, tags: [], cardOrd: 0 };
  }, [realNoteOverride, activeFixtureExample, selectedItem]);

  const rendered = useMemo(() => {
    if (!selectedItem) {
      return { front: '', back: '' };
    }
    return renderCard({
      noteType: selectedItem.noteType,
      fields: activeNoteData.fields,
      cardOrd: activeNoteData.cardOrd,
      tags: activeNoteData.tags,
      deckName: 'Laboratório::Exemplo',
    });
  }, [selectedItem, activeNoteData]);

  const handleSelectModel = (item: LabModelItem) => {
    setSelectedItemId(item.id);
    setSelectedExampleId(item.fixture?.example.id ?? null);
    setRealNoteOverride(null);
  };

  const handleOpenRandomRealNote = () => {
    if (!selectedItem) return;

    try {
      // Para modelos de fixture, procura primeiro um note_type no banco com o mesmo nome
      let targetNoteTypeIds: string[] = [];

      if (selectedItem.isFixture) {
        const matchingNoteTypes = dbModels.filter(
          (nt) => nt.name.trim().toLowerCase() === selectedItem.name.trim().toLowerCase()
        );
        targetNoteTypeIds = matchingNoteTypes.map((nt) => nt.id);
      } else {
        targetNoteTypeIds = [selectedItem.noteType.id];
      }

      if (targetNoteTypeIds.length === 0) {
        setSnackbarMessage(strings.cardLab.noRealNoteFound);
        return;
      }

      const candidateNotes = database
        .select()
        .from(schema.notes)
        .where(
          and(
            eq(schema.notes.note_type_id, targetNoteTypeIds[0]),
            isNull(schema.notes.deleted_at)
          )
        )
        .limit(100)
        .all();

      if (candidateNotes.length === 0) {
        setSnackbarMessage(strings.cardLab.noRealNoteFound);
        return;
      }

      const randomIndex = Math.floor(Math.random() * candidateNotes.length);
      const chosenNote = candidateNotes[randomIndex];

      setRealNoteOverride({
        fields: chosenNote.fields,
        tags: chosenNote.tags,
        cardOrd: 0,
      });
      setSnackbarMessage(strings.cardLab.realNoteLoaded);
    } catch {
      setSnackbarMessage(strings.cardLab.noRealNoteFound);
    }
  };

  return (
    <View testID="card-lab-view" style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Cabeçalho */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.elevated, borderBottomColor: theme.border },
        ]}
      >
        {onBack ? (
          <TouchableOpacity
            testID="card-lab-back-button"
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={strings.cardLab.backButton}
          >
            <Text style={[styles.backButtonText, { color: theme.accent }]}>
              ← {strings.cardLab.backButton}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={[styles.headerTitle, { color: theme.fg }]}>
          {strings.cardLab.title}
        </Text>
        <View style={styles.backPlaceholder} />
      </View>

      {/* Seletor de Modelos (Fixtures + Banco) */}
      <View
        style={[
          styles.controlsPanel,
          { backgroundColor: theme.elevated, borderBottomColor: theme.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modelsRow}
        >
          {items.map((item) => {
            const isSelected = item.id === selectedItem?.id;
            return (
              <TouchableOpacity
                key={item.id}
                testID={`card-lab-model-${item.id}`}
                style={[
                  styles.modelChip,
                  {
                    backgroundColor: isSelected ? theme.accent : theme.elevated2,
                    borderColor: isSelected ? theme.accent : theme.border,
                  },
                ]}
                onPress={() => handleSelectModel(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} (${
                  item.isFixture ? strings.cardLab.fixtureBadge : strings.cardLab.dbModelBadge
                })`}
              >
                <Text
                  style={[
                    styles.modelChipTitle,
                    { color: isSelected ? '#ffffff' : theme.fg },
                  ]}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.modelChipBadge,
                    { color: isSelected ? 'rgba(255,255,255,0.85)' : theme.fgMuted },
                  ]}
                >
                  {item.isFixture ? strings.cardLab.fixtureBadge : strings.cardLab.dbModelBadge}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Seletor de variações da fixture (ex.: Avicena Cloze vs Básico, AnKing Cloze Múltiplo vs Único) */}
        {selectedItem?.fixture && selectedItem.fixture.examples.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.variantsRow}
          >
            {selectedItem.fixture.examples.map((ex) => {
              const isExSelected = !realNoteOverride && activeFixtureExample?.id === ex.id;
              return (
                <TouchableOpacity
                  key={ex.id}
                  testID={`card-lab-variant-${ex.id}`}
                  style={[
                    styles.variantButton,
                    {
                      backgroundColor: isExSelected ? theme.elevated2 : 'transparent',
                      borderColor: isExSelected ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => {
                    setRealNoteOverride(null);
                    setSelectedExampleId(ex.id);
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.variantButtonText,
                      {
                        color: isExSelected ? theme.accent : theme.fgMuted,
                        fontWeight: isExSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {ex.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Controles Frente/Verso, Claro/Escuro e Modo de Visualização */}
        <View style={styles.togglesRow}>
          {viewMode === 'single' && (
            <>
              <View style={[styles.segmentedGroup, { borderColor: theme.border }]}>
                <TouchableOpacity
                  testID="card-lab-side-front"
                  style={[
                    styles.segmentButton,
                    side === 'front' && { backgroundColor: theme.accent },
                  ]}
                  onPress={() => setSide('front')}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: side === 'front' ? '#ffffff' : theme.fg },
                    ]}
                  >
                    {strings.cardLab.sideFront}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="card-lab-side-back"
                  style={[
                    styles.segmentButton,
                    side === 'back' && { backgroundColor: theme.accent },
                  ]}
                  onPress={() => setSide('back')}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: side === 'back' ? '#ffffff' : theme.fg },
                    ]}
                  >
                    {strings.cardLab.sideBack}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.segmentedGroup, { borderColor: theme.border }]}>
                <TouchableOpacity
                  testID="card-lab-theme-light"
                  style={[
                    styles.segmentButton,
                    cardTheme === 'light' && { backgroundColor: theme.accent },
                  ]}
                  onPress={() => setCardTheme('light')}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: cardTheme === 'light' ? '#ffffff' : theme.fg },
                    ]}
                  >
                    {strings.cardLab.themeLight}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="card-lab-theme-dark"
                  style={[
                    styles.segmentButton,
                    cardTheme === 'dark' && { backgroundColor: theme.accent },
                  ]}
                  onPress={() => setCardTheme('dark')}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: cardTheme === 'dark' ? '#ffffff' : theme.fg },
                    ]}
                  >
                    {strings.cardLab.themeDark}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={[styles.segmentedGroup, { borderColor: theme.border }]}>
            <TouchableOpacity
              testID="card-lab-view-single"
              style={[
                styles.segmentButton,
                viewMode === 'single' && { backgroundColor: theme.accent },
              ]}
              onPress={() => setViewMode('single')}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: viewMode === 'single' ? '#ffffff' : theme.fg },
                ]}
              >
                {strings.cardLab.viewSingle}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="card-lab-view-grid"
              style={[
                styles.segmentButton,
                viewMode === 'grid' && { backgroundColor: theme.accent },
              ]}
              onPress={() => setViewMode('grid')}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: viewMode === 'grid' ? '#ffffff' : theme.fg },
                ]}
              >
                {strings.cardLab.viewGrid}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botão de Nota Real Aleatória */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            testID="card-lab-random-real-note"
            style={[
              styles.actionButton,
              { backgroundColor: theme.elevated2, borderColor: theme.border },
            ]}
            onPress={handleOpenRandomRealNote}
            accessibilityRole="button"
            accessibilityLabel={strings.cardLab.openRandomRealNoteButton}
          >
            <Text style={[styles.actionButtonText, { color: theme.fg }]}>
              🎲 {strings.cardLab.openRandomRealNoteButton}
            </Text>
          </TouchableOpacity>

          {realNoteOverride && (
            <TouchableOpacity
              testID="card-lab-reset-sample"
              style={[
                styles.actionButton,
                { backgroundColor: theme.elevated2, borderColor: theme.accent },
              ]}
              onPress={() => setRealNoteOverride(null)}
              accessibilityRole="button"
              accessibilityLabel={strings.cardLab.resetToSampleButton}
            >
              <Text style={[styles.actionButtonText, { color: theme.accent }]}>
                ↺ {strings.cardLab.resetToSampleButton}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Área de Renderização do Card */}
      {viewMode === 'single' ? (
        <View style={styles.previewArea}>
          <CardView
            testID="card-lab-preview"
            html={side === 'front' ? rendered.front : rendered.back}
            side={side}
            theme={cardTheme}
            css={selectedItem?.noteType.css ?? undefined}
            isBuiltinModel={
              selectedItem
                ? (Object.values(BUILTIN_NOTE_TYPE_IDS) as string[]).includes(
                    selectedItem.noteType.id
                  )
                : false
            }
            executeModelScripts={executeModelScripts}
            cardId={`lab-card-${selectedItem?.id ?? 'default'}`}
            noteId={`lab-note-${selectedItem?.id ?? 'default'}`}
            fields={activeNoteData.fields}
            mediaBasePath={mediaDir}
            cardOrd={activeNoteData.cardOrd}
            tags={activeNoteData.tags}
            style={styles.cardView}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.gridContainer}>
          {(
            [
              { s: 'front' as CardSide, t: 'light' as ThemeMode, label: 'Frente · Claro' },
              { s: 'back' as CardSide, t: 'light' as ThemeMode, label: 'Verso · Claro' },
              { s: 'front' as CardSide, t: 'dark' as ThemeMode, label: 'Frente · Escuro' },
              { s: 'back' as CardSide, t: 'dark' as ThemeMode, label: 'Verso · Escuro' },
            ] as const
          ).map((cell) => (
            <View
              key={`${cell.s}-${cell.t}`}
              style={[styles.gridCell, { borderColor: theme.border }]}
            >
              <View style={[styles.gridCellHeader, { backgroundColor: theme.elevated2 }]}>
                <Text style={[styles.gridCellLabel, { color: theme.fg }]}>{cell.label}</Text>
              </View>
              <View style={styles.gridCardWrapper}>
                <CardView
                  testID={`card-lab-grid-${cell.s}-${cell.t}`}
                  html={cell.s === 'front' ? rendered.front : rendered.back}
                  side={cell.s}
                  theme={cell.t}
                  css={selectedItem?.noteType.css ?? undefined}
                  isBuiltinModel={
                    selectedItem
                      ? (Object.values(BUILTIN_NOTE_TYPE_IDS) as string[]).includes(
                          selectedItem.noteType.id
                        )
                      : false
                  }
                  executeModelScripts={executeModelScripts}
                  cardId={`lab-card-${selectedItem?.id ?? 'default'}`}
                  noteId={`lab-note-${selectedItem?.id ?? 'default'}`}
                  fields={activeNoteData.fields}
                  mediaBasePath={mediaDir}
                  cardOrd={activeNoteData.cardOrd}
                  tags={activeNoteData.tags}
                  style={styles.cardView}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      )}


      <Snackbar
        visible={snackbarMessage !== null}
        message={snackbarMessage ?? ''}
        durationMs={3500}
        onDismiss={() => setSnackbarMessage(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backPlaceholder: {
    width: 60,
  },
  controlsPanel: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  modelsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  modelChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  modelChipTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  modelChipBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
  variantsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  variantButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  variantButtonText: {
    fontSize: 12,
  },
  togglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  segmentedGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewArea: {
    flex: 1,
  },
  cardView: {
    flex: 1,
  },
  gridContainer: {
    padding: 12,
    gap: 12,
  },
  gridCell: {
    height: 320,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridCellHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gridCellLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  gridCardWrapper: {
    flex: 1,
  },
});
