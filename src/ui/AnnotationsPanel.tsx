import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme, type AnnotationColorName } from './theme';
import { strings } from './strings';
import {
  loadDeckAnnotations,
  filterAnnotationsWithNotesOnly,
  type PanelAnnotationItem,
  type PanelOrphanItem,
} from '@/consulta/annotationsPanel';
import type { FolioDatabase } from '@/db/client';
import { AnnotationsRepository } from '@/db/repositories/annotations';

export interface AnnotationsPanelProps {
  /** Indica se o modal do painel está aberto. */
  visible: boolean;
  /** Callback para fechar o painel. */
  onClose: () => void;
  /** Identificador do deck aberto. */
  deckId: string;
  /** Nome ou caminho do deck (opcional, para contexto). */
  deckName?: string;
  /** Callback ao selecionar uma anotação para rolar até o trecho. */
  onSelectAnnotation: (item: { unitIndex: number; annotationId: string }) => void;
  /** Callback ao solicitar a exclusão de uma anotação órfã (para acionar Snackbar com Desfazer). */
  onDeleteOrphan?: (orphan: PanelOrphanItem) => void;
  /** Instância opcional de AnnotationsRepository para testes/injeção. */
  annotationsRepo?: AnnotationsRepository;
  /** Instância opcional de FolioDatabase para testes/injeção. */
  db?: FolioDatabase;
  /** Identificador para testes automatizados. */
  testID?: string;
}

/**
 * Painel ☰ de Anotações do Modo Consulta (MODO_CONSULTA.md §3, §5).
 * - Lista todas as anotações do deck aberto, na ordem de leitura (decks -> notas -> start asc);
 * - Exibe o trecho (em até 2 linhas) e a nota do usuário associada;
 * - Possui o filtro "Só com nota";
 * - Ao tocar num item, fecha o painel e navega até a unidade na WebView com flash;
 * - No fim, exibe as Órfãs com trecho original e botão Apagar com Desfazer.
 */
export function AnnotationsPanel({
  visible,
  onClose,
  deckId,
  deckName,
  onSelectAnnotation,
  onDeleteOrphan,
  annotationsRepo,
  db,
  testID = 'annotations-panel',
}: AnnotationsPanelProps) {
  const { theme, annotationColors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<PanelAnnotationItem[]>([]);
  const [orphans, setOrphans] = useState<PanelOrphanItem[]>([]);
  const [onlyNotesFilter, setOnlyNotesFilter] = useState(false);

  // Recarrega os dados do painel sempre que ele for aberto
  const refreshData = useCallback(() => {
    if (!visible || !deckId) return;
    setLoading(true);

    try {
      const result = loadDeckAnnotations(deckId, { db, includeSubdecks: true });
      setAnnotations(result.annotations);
      setOrphans(result.orphans);
    } catch {
      // Ignora erro em ambiente de teste sem migrações completas
    } finally {
      setLoading(false);
    }
  }, [visible, deckId, db]);

  useEffect(() => {
    if (visible) {
      refreshData();
    }
  }, [visible, refreshData]);

  const displayedAnnotations = onlyNotesFilter
    ? filterAnnotationsWithNotesOnly(annotations)
    : annotations;

  const handleSelect = (item: PanelAnnotationItem) => {
    onClose();
    onSelectAnnotation({ unitIndex: item.unitIndex, annotationId: item.id });
  };

  const handleDeleteOrphanPress = (orphan: PanelOrphanItem) => {
    try {
      const repo = annotationsRepo ?? new AnnotationsRepository(db);
      repo.softDelete(orphan.id);
      setOrphans((prev) => prev.filter((o) => o.id !== orphan.id));
      onDeleteOrphan?.(orphan);
    } catch {
      // Ignora
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose} accessibilityRole="button">
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Cabeçalho do Painel */}
          <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
            <View style={styles.titleColumn}>
              <View style={styles.titleRow}>
                <Text style={[styles.titleText, { color: theme.fg }]}>
                  {strings.consulta.panelTitle}
                </Text>
                {!loading && (
                  <View style={[styles.counterBadge, { backgroundColor: theme.elevated2 }]}>
                    <Text style={[styles.counterText, { color: theme.fgMuted }]}>
                      {strings.consulta.panelCountAnnotations(annotations.length)}
                    </Text>
                  </View>
                )}
              </View>
              {deckName ? (
                <Text
                  style={[styles.deckSubtitle, { color: theme.fgMuted }]}
                  numberOfLines={1}
                >
                  {deckName}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={strings.common.close}
              activeOpacity={0.7}
              testID={`${testID}-close-button`}
            >
              <Text style={[styles.closeIcon, { color: theme.fgMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Barra de Filtros */}
          <View style={[styles.filterBar, { borderBottomColor: theme.border }]}>
            <View style={styles.filterTabs}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !onlyNotesFilter
                    ? { backgroundColor: theme.accent }
                    : { backgroundColor: theme.elevated2 },
                ]}
                onPress={() => setOnlyNotesFilter(false)}
                accessibilityRole="button"
                accessibilityLabel={strings.consulta.panelAll}
                activeOpacity={0.7}
                testID={`${testID}-filter-all`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    !onlyNotesFilter ? styles.filterChipTextActive : { color: theme.fg },
                  ]}
                >
                  {strings.consulta.panelAll} ({annotations.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  onlyNotesFilter
                    ? { backgroundColor: theme.accent }
                    : { backgroundColor: theme.elevated2 },
                ]}
                onPress={() => setOnlyNotesFilter(true)}
                accessibilityRole="button"
                accessibilityLabel={strings.consulta.panelOnlyWithNotes}
                activeOpacity={0.7}
                testID={`${testID}-filter-only-notes`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    onlyNotesFilter ? styles.filterChipTextActive : { color: theme.fg },
                  ]}
                >
                  ✎ {strings.consulta.panelOnlyWithNotes} (
                  {filterAnnotationsWithNotesOnly(annotations).length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Conteúdo Principal */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
                {strings.common.loading}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              {displayedAnnotations.length === 0 && orphans.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.fgMuted }]}>
                    {onlyNotesFilter
                      ? strings.consulta.panelEmptyFiltered
                      : strings.consulta.panelEmpty}
                  </Text>
                </View>
              ) : null}

              {/* Lista de anotações em ordem de leitura */}
              {displayedAnnotations.length === 0 &&
              onlyNotesFilter &&
              annotations.length > 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.fgMuted }]}>
                    {strings.consulta.panelEmptyFiltered}
                  </Text>
                </View>
              ) : (
                displayedAnnotations.map((item) => {
                  const colorToken =
                    annotationColors[item.color as AnnotationColorName] ??
                    annotationColors.amarelo;
                  const hasNote = Boolean(item.note && item.note.trim().length > 0);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.annotationCard,
                        {
                          backgroundColor: theme.canvas,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => handleSelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.quote}. ${item.note || ''}`}
                      activeOpacity={0.7}
                      testID={`${testID}-item-${item.id}`}
                    >
                      <View style={styles.cardHeader}>
                        {/* Indicador visual de cor e tipo (grifo ou sublinhado) */}
                        <View style={styles.cardBadgeRow}>
                          <View
                            style={[
                              styles.colorDot,
                              {
                                backgroundColor:
                                  item.kind === 'ul'
                                    ? colorToken.underline
                                    : colorToken.highlight,
                              },
                            ]}
                          />
                          <Text style={[styles.deckSectionText, { color: theme.fgMuted }]}>
                            {item.deckPath}
                          </Text>
                        </View>

                        <Text style={[styles.jumpHintText, { color: theme.accent }]}>
                          {strings.consulta.panelJumpTo} →
                        </Text>
                      </View>

                      {/* Trecho citado (até 2 linhas) */}
                      <Text
                        style={[
                          styles.quoteText,
                          { color: theme.fg },
                          item.kind === 'ul' && {
                            textDecorationLine: 'underline',
                            textDecorationColor: colorToken.underline,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.quote}
                      </Text>

                      {/* Nota do usuário (se preenchida) */}
                      {hasNote && (
                        <View
                          style={[
                            styles.noteContainer,
                            {
                              backgroundColor: theme.elevated2,
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <Text style={[styles.noteIconText, { color: theme.accent }]}>✎</Text>
                          <Text style={[styles.noteText, { color: theme.fg }]}>
                            {item.note}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Seção final: Órfãs (MODO_CONSULTA.md §3, §5) */}
              {orphans.length > 0 && (
                <View style={[styles.orphansSection, { borderTopColor: theme.border }]}>
                  <View style={styles.orphansHeader}>
                    <View style={styles.orphansTitleRow}>
                      <Text style={[styles.orphansTitleText, { color: theme.fg }]}>
                        {strings.consulta.panelOrphansTitle}
                      </Text>
                      <View
                        style={[
                          styles.counterBadge,
                          { backgroundColor: theme.elevated2 },
                        ]}
                      >
                        <Text style={[styles.counterText, { color: theme.fgMuted }]}>
                          {strings.consulta.panelCountOrphans(orphans.length)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.orphansDescription, { color: theme.fgMuted }]}>
                      {strings.consulta.panelOrphansDescription}
                    </Text>
                  </View>

                  {orphans.map((orphan) => {
                    const hasNote = Boolean(orphan.note && orphan.note.trim().length > 0);

                    return (
                      <View
                        key={orphan.id}
                        style={[
                          styles.orphanCard,
                          {
                            backgroundColor: theme.canvas,
                            borderColor: theme.border,
                          },
                        ]}
                        testID={`${testID}-orphan-${orphan.id}`}
                      >
                        <View style={styles.orphanContent}>
                          <Text
                            style={[styles.orphanQuoteText, { color: theme.fgMuted }]}
                            numberOfLines={2}
                          >
                            {orphan.quote}
                          </Text>

                          {hasNote && (
                            <View
                              style={[
                                styles.noteContainer,
                                {
                                  backgroundColor: theme.elevated2,
                                  borderColor: theme.border,
                                },
                              ]}
                            >
                              <Text style={[styles.noteIconText, { color: theme.accent }]}>
                                ✎
                              </Text>
                              <Text style={[styles.noteText, { color: theme.fg }]}>
                                {orphan.note}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Botão Apagar com alvo de toque mínimo de 44px */}
                        <TouchableOpacity
                          style={[
                            styles.deleteButton,
                            { borderColor: theme.border },
                          ]}
                          onPress={() => handleDeleteOrphanPress(orphan)}
                          accessibilityRole="button"
                          accessibilityLabel={strings.consulta.panelDeleteOrphan}
                          activeOpacity={0.7}
                          testID={`${testID}-orphan-delete-${orphan.id}`}
                        >
                          <Text style={styles.deleteButtonText}>
                            {strings.consulta.panelDeleteOrphan}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    maxHeight: '88%',
    minHeight: 320,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleColumn: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
  },
  deckSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  counterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  annotationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    minHeight: 44,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  deckSectionText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jumpHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  noteIconText: {
    fontSize: 13,
    fontWeight: '700',
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  orphansSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  orphansHeader: {
    gap: 4,
    marginBottom: 4,
  },
  orphansTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orphansTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  orphansDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  orphanCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orphanContent: {
    flex: 1,
    gap: 6,
  },
  orphanQuoteText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  deleteButton: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e0457b',
  },
});
