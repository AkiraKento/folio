import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/ui/theme';
import { strings } from '@/ui/strings';
import { ConsultaView, type ConsultaViewHandle } from '@/ui/ConsultaView';
import { Snackbar } from '@/ui/Snackbar';
import {
  loadConsultaUnits,
  countConsultaUnits,
  type ConsultaUnit,
} from '@/consulta/units';
import { DecksRepository } from '@/db/repositories/decks';
import { CardsRepository } from '@/db/repositories/cards';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { SettingsRepository } from '@/db/repositories/settings';
import { ConsultaPosRepository } from '@/db/repositories/consulta-pos';
import type { SavedAnnotation } from '@/webview/consulta/protocol';
import type { UnitMenuAction } from '@/webview/consulta/types';
import { AnnotationsPanel } from '@/ui/AnnotationsPanel';
import type { PanelOrphanItem } from '@/consulta/annotationsPanel';
import { ConsultaSearchBar } from '@/ui/ConsultaSearchBar';
import { logError, logWarn } from '@/logging';

const BATCH_SIZE = 30;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 26;
const DEFAULT_FONT_SIZE = 17;

export default function ConsultaScreen() {
  const {
    id,
    unitIndex: paramUnitIndex,
    offset: paramOffset,
    noteId: paramNoteId,
  } = useLocalSearchParams<{
    id: string;
    unitIndex?: string;
    offset?: string;
    noteId?: string;
  }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [deckName, setDeckName] = useState<string>('');
  const [units, setUnits] = useState<ConsultaUnit[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const consultaViewRef = useRef<ConsultaViewHandle>(null);
  const positionRestoredRef = useRef(false);
  const [initialPosition, setInitialPosition] = useState<{
    unitIndex: number;
    offset: number;
  } | undefined>(undefined);

  const [deletedAnnotation, setDeletedAnnotation] = useState<{
    annotation: SavedAnnotation;
    unitIndex: number;
  } | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const [panelVisible, setPanelVisible] = useState(false);
  const [deletedOrphanId, setDeletedOrphanId] = useState<string | null>(null);
  const [orphanSnackbarVisible, setOrphanSnackbarVisible] = useState(false);

  // Estado da busca e filtros (MODO_CONSULTA.md §3)
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [matchingCount, setMatchingCount] = useState(0);

  // Rastreia aberturas da Consulta para validação de hipóteses (PRD §4)
  const hasTrackedOpenRef = useRef(false);
  useEffect(() => {
    if (id && !hasTrackedOpenRef.current) {
      hasTrackedOpenRef.current = true;
      try {
        new SettingsRepository().increment('consultaOpenCount');
      } catch (err) {
        logWarn('ConsultaScreen', 'Falha ao incrementar consultaOpenCount', String(err));
      }
    }
  }, [id]);

  // Carrega o primeiro lote de unidades considerando busca, filtros e posição salva
  const loadUnits = useCallback(
    (query: string, notesOnly: boolean) => {
      if (!id) return;
      setLoading(true);

      try {
        const decksRepo = new DecksRepository();
        const deck = decksRepo.getById(id);
        if (deck) {
          setDeckName(deck.name.split('::').pop() ?? deck.name);
        }

        const settingsRepo = new SettingsRepository();
        const savedFontSize = settingsRepo.get<number>('fontSize');
        if (
          typeof savedFontSize === 'number' &&
          savedFontSize >= MIN_FONT_SIZE &&
          savedFontSize <= MAX_FONT_SIZE
        ) {
          setFontSize(savedFontSize);
        }

        let targetUnitIndex = 0;
        let targetOffset = 0;
        if (paramNoteId) {
          try {
            const allCandidates = loadConsultaUnits({
              deckId: id,
              includeSubdecks: true,
            });
            const idx = allCandidates.findIndex((u) => u.noteId === paramNoteId);
            if (idx >= 0) {
              targetUnitIndex = idx;
              targetOffset = 0;
              setInitialPosition({ unitIndex: targetUnitIndex, offset: 0 });
            }
          } catch (err) {
            logWarn('ConsultaScreen', 'Falha ao buscar índice da nota por paramNoteId', String(err));
          }
        } else if (paramUnitIndex !== undefined) {
          targetUnitIndex = parseInt(paramUnitIndex, 10) || 0;
          targetOffset = paramOffset !== undefined ? parseInt(paramOffset, 10) || 0 : 0;
          setInitialPosition({ unitIndex: targetUnitIndex, offset: targetOffset });
        } else {
          try {
            const consultaPosRepo = new ConsultaPosRepository();
            const savedPos = consultaPosRepo.get(id);
            if (savedPos) {
              targetUnitIndex = savedPos.unit_index;
              targetOffset = savedPos.scroll_offset;
              setInitialPosition({ unitIndex: targetUnitIndex, offset: targetOffset });
            }
          } catch (err) {
            logWarn('ConsultaScreen', 'Falha ao buscar posição salva em consulta_pos', String(err));
          }
        }

        const initialLimit = Math.max(BATCH_SIZE, targetUnitIndex + 1 + 10);
        const initialUnits = loadConsultaUnits({
          deckId: id,
          searchQuery: query,
          onlyWithAnnotations: notesOnly,
          limit: initialLimit,
          offset: 0,
          includeSubdecks: true,
        });

        const totalCount = countConsultaUnits({
          deckId: id,
          searchQuery: query,
          onlyWithAnnotations: notesOnly,
          includeSubdecks: true,
        });

        setUnits(initialUnits);
        setMatchingCount(totalCount);
        setHasMore(initialUnits.length < totalCount);
      } catch (err) {
        logError('ConsultaScreen', err, 'Falha ao carregar unidades iniciais da Consulta');
      } finally {
        setLoading(false);
      }
    },
    [id, paramUnitIndex, paramOffset, paramNoteId]
  );

  useEffect(() => {
    loadUnits(searchQuery, onlyWithNotes);
  }, [loadUnits, searchQuery, onlyWithNotes]);

  // Carrega o próximo lote de 30 unidades quando a WebView solicita
  const handleNeedMore = useCallback(() => {
    if (!id || !hasMore) return;

    try {
      const nextOffset = units.length;
      const nextBatch = loadConsultaUnits({
        deckId: id,
        searchQuery,
        onlyWithAnnotations: onlyWithNotes,
        limit: BATCH_SIZE,
        offset: nextOffset,
        includeSubdecks: true,
      });

      if (nextBatch.length > 0) {
        setUnits((prev) => [...prev, ...nextBatch]);
      }
      setHasMore(units.length + nextBatch.length < matchingCount);
    } catch (err) {
      logError('ConsultaScreen', err, 'Falha ao carregar lote adicional de unidades');
    }
  }, [id, hasMore, units.length, searchQuery, onlyWithNotes, matchingCount]);

  const handleSearchQueryChange = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);
  }, []);

  const handleToggleOnlyWithNotes = useCallback((enabled: boolean) => {
    setOnlyWithNotes(enabled);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery('');
    setOnlyWithNotes(false);
  }, []);

  const handleToggleSearch = useCallback(() => {
    if (searchVisible) {
      handleCloseSearch();
    } else {
      setSearchVisible(true);
    }
  }, [searchVisible, handleCloseSearch]);

  const handleReviewFiltered = useCallback(() => {
    setNoticeMessage(strings.consulta.reviewFilteredNotice);
  }, []);

  // Ações do menu contextual da unidade
  const handleMenuAction = useCallback(
    (action: UnitMenuAction, noteId: string, _unitIndex: number) => {
      switch (action) {
        case 'edit': {
          router.push({
            pathname: '/card/editor',
            params: { deckId: id, noteId },
          });
          break;
        }
        case 'review': {
          setNoticeMessage(strings.consulta.unitReviewNotice);
          break;
        }
        case 'toggleSuspend': {
          try {
            const cardsRepo = new CardsRepository();
            const noteCards = cardsRepo.listByNote(noteId);
            const anyActive = noteCards.some((c) => !c.suspended);

            for (const c of noteCards) {
              if (anyActive) {
                cardsRepo.suspend(c.id);
              } else {
                cardsRepo.unsuspend(c.id);
              }
            }

            // Atualiza o estado da unidade na UI
            setUnits((prev) =>
              prev.map((u) =>
                u.noteId === noteId
                  ? { ...u, suspended: anyActive }
                  : u
              )
            );
          } catch (err) {
            logError('ConsultaScreen', err, 'Falha ao alterar estado suspenso do card');
          }
          break;
        }
      }
    },
    [id, router]
  );

  const increaseFontSize = () => {
    setFontSize((prev) => {
      const next = Math.min(MAX_FONT_SIZE, prev + 1);
      try {
        new SettingsRepository().set('fontSize', next);
      } catch (err) {
        logWarn('ConsultaScreen', 'Falha ao salvar aumento de fonte', String(err));
      }
      return next;
    });
  };

  const decreaseFontSize = () => {
    setFontSize((prev) => {
      const next = Math.max(MIN_FONT_SIZE, prev - 1);
      try {
        new SettingsRepository().set('fontSize', next);
      } catch (err) {
        logWarn('ConsultaScreen', 'Falha ao salvar diminuição de fonte', String(err));
      }
      return next;
    });
  };

  const handleAnnotationDeleted = useCallback(
    (annotation: SavedAnnotation, unitIndex: number) => {
      setDeletedAnnotation({ annotation, unitIndex });
      setSnackbarVisible(true);
    },
    []
  );

  const handleUndoDelete = useCallback(() => {
    if (!deletedAnnotation) return;
    try {
      new AnnotationsRepository().restore(deletedAnnotation.annotation.id);
      consultaViewRef.current?.sendRestoreAnnotation(
        deletedAnnotation.annotation,
        deletedAnnotation.unitIndex
      );
    } catch (err) {
      logError('ConsultaScreen', err, 'Falha ao restaurar anotação apagada');
    } finally {
      setSnackbarVisible(false);
      setDeletedAnnotation(null);
    }
  }, [deletedAnnotation]);

  const handleSelectAnnotation = useCallback(
    ({ unitIndex, annotationId }: { unitIndex: number; annotationId: string }) => {
      // Se a unidade selecionada no painel ainda não estiver no lote carregado, carrega até alcançá-la
      if (unitIndex >= units.length && id) {
        try {
          const neededCount = unitIndex + 1;
          const additionalUnits = loadConsultaUnits({
            deckId: id,
            limit: neededCount - units.length + BATCH_SIZE,
            offset: units.length,
            includeSubdecks: true,
          });
          if (additionalUnits.length > 0) {
            setUnits((prev) => [...prev, ...additionalUnits]);
          }
        } catch (err) {
          logError('ConsultaScreen', err, 'Falha ao carregar unidades adicionais no goto');
        }
      }

      // Rola até a unidade e pisca o grifo (MODO_CONSULTA.md §3)
      consultaViewRef.current?.sendGoto(unitIndex, annotationId);
    },
    [id, units.length]
  );

  const handleOrphanDeleted = useCallback((orphan: PanelOrphanItem) => {
    setDeletedOrphanId(orphan.id);
    setOrphanSnackbarVisible(true);
  }, []);

  const handleUndoDeleteOrphan = useCallback(() => {
    if (!deletedOrphanId) return;
    try {
      new AnnotationsRepository().restore(deletedOrphanId);
    } catch (err) {
      logError('ConsultaScreen', err, 'Falha ao restaurar anotação órfã');
    } finally {
      setOrphanSnackbarVisible(false);
      setDeletedOrphanId(null);
    }
  }, [deletedOrphanId]);

  const handleBack = useCallback(() => {
    try {
      consultaViewRef.current?.sendFlushPosition();
    } catch (err) {
      logWarn('ConsultaScreen', 'Falha ao enviar flush de posição', String(err));
    }
    setTimeout(() => {
      router.back();
    }, 50);
  }, [router]);

  const handleRendered = useCallback(
    (_count: number) => {
      if (!positionRestoredRef.current && initialPosition) {
        positionRestoredRef.current = true;
        consultaViewRef.current?.sendGoto(
          initialPosition.unitIndex,
          undefined,
          initialPosition.offset
        );
      }
    },
    [initialPosition]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom']}
    >
      {/* Barra superior de navegação da Consulta (MODO_CONSULTA.md §3) */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.elevated,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={strings.deckDetail.backButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.backArrow, { color: theme.fg }]}>←</Text>
          <Text
            style={[styles.headerTitle, { color: theme.fg }]}
            numberOfLines={1}
          >
            {deckName || strings.consulta.title}
          </Text>
        </TouchableOpacity>

        {/* Controles: Busca 🔍, Fonte A− A+, Painel ☰ */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleToggleSearch}
            accessibilityRole="button"
            accessibilityLabel={
              searchVisible
                ? strings.consulta.searchClose
                : strings.consulta.searchButton
            }
          >
            <Text
              style={[
                styles.controlIcon,
                {
                  color:
                    searchVisible || searchQuery || onlyWithNotes
                      ? theme.accent
                      : theme.fg,
                },
              ]}
            >
              🔍
            </Text>
          </TouchableOpacity>

          <View style={[styles.fontControls, { backgroundColor: theme.elevated2 }]}>
            <TouchableOpacity
              style={[
                styles.fontButton,
                fontSize <= MIN_FONT_SIZE && styles.fontButtonDisabled,
              ]}
              onPress={decreaseFontSize}
              disabled={fontSize <= MIN_FONT_SIZE}
              accessibilityRole="button"
              accessibilityLabel={strings.consulta.fontSizeDecrease}
            >
              <Text
                style={[
                  styles.fontButtonText,
                  { color: fontSize <= MIN_FONT_SIZE ? theme.fgMuted : theme.fg },
                ]}
              >
                A−
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.fontButton,
                fontSize >= MAX_FONT_SIZE && styles.fontButtonDisabled,
              ]}
              onPress={increaseFontSize}
              disabled={fontSize >= MAX_FONT_SIZE}
              accessibilityRole="button"
              accessibilityLabel={strings.consulta.fontSizeIncrease}
            >
              <Text
                style={[
                  styles.fontButtonText,
                  { color: fontSize >= MAX_FONT_SIZE ? theme.fgMuted : theme.fg },
                ]}
              >
                A+
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setPanelVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={strings.consulta.annotations}
          >
            <Text style={[styles.controlIcon, { color: theme.fg }]}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de busca e filtros da Consulta (MODO_CONSULTA.md §3) */}
      <ConsultaSearchBar
        visible={searchVisible}
        query={searchQuery}
        onlyWithNotes={onlyWithNotes}
        matchingCount={matchingCount}
        onQueryChange={handleSearchQueryChange}
        onToggleOnlyWithNotes={handleToggleOnlyWithNotes}
        onReviewFiltered={handleReviewFiltered}
        onClose={handleCloseSearch}
      />

      {/* Aviso temporário para ações em desenvolvimento */}
      {noticeMessage && (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.elevated2,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.noticeText, { color: theme.fg }]}>
            {noticeMessage}
          </Text>
          <TouchableOpacity
            onPress={() => setNoticeMessage(null)}
            style={styles.noticeCloseButton}
          >
            <Text style={[styles.noticeCloseText, { color: theme.accent }]}>
              {strings.common.close}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conteúdo principal */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
            {strings.consulta.loadingUnits}
          </Text>
        </View>
      ) : units.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: theme.fgMuted }]}>
            {searchQuery.trim().length > 0 || onlyWithNotes
              ? strings.consulta.searchEmptyResults
              : strings.consulta.emptyList}
          </Text>
        </View>
      ) : (
        <ConsultaView
          ref={consultaViewRef}
          units={units}
          hasMore={hasMore}
          initialPosition={initialPosition}
          resetKey={`${searchQuery}-${onlyWithNotes}`}
          fontSize={fontSize}
          theme={isDark ? 'dark' : 'light'}
          deckQuery={id}
          onNeedMore={handleNeedMore}
          onMenuAction={handleMenuAction}
          onAnnotationDeleted={handleAnnotationDeleted}
          onRendered={handleRendered}
          onOpenEditor={(noteId) => {
            router.push({
              pathname: '/card/editor',
              params: { deckId: id, noteId },
            });
          }}
          onSetFont={(size) => setFontSize(size)}
        />
      )}

      {/* Snackbar flutuante com Desfazer ao apagar grifo (MODO_CONSULTA.md §3) */}
      <Snackbar
        visible={snackbarVisible}
        message={strings.consulta.highlightRemoved}
        actionText={strings.common.undo}
        durationMs={6000}
        onAction={handleUndoDelete}
        onDismiss={() => {
          setSnackbarVisible(false);
          setDeletedAnnotation(null);
        }}
      />

      {/* Painel de Anotações ☰ (MODO_CONSULTA.md §3, §5) */}
      {id ? (
        <AnnotationsPanel
          visible={panelVisible}
          onClose={() => setPanelVisible(false)}
          deckId={id}
          deckName={deckName}
          onSelectAnnotation={handleSelectAnnotation}
          onDeleteOrphan={handleOrphanDeleted}
        />
      ) : null}

      {/* Snackbar flutuante com Desfazer ao apagar órfã */}
      <Snackbar
        visible={orphanSnackbarVisible}
        message={strings.consulta.panelDeletedSnackbar}
        actionText={strings.common.undo}
        durationMs={6000}
        onAction={handleUndoDeleteOrphan}
        onDismiss={() => {
          setOrphanSnackbarVisible(false);
          setDeletedOrphanId(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    maxWidth: '55%',
    paddingHorizontal: 6,
    gap: 6,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  controlIcon: {
    fontSize: 18,
  },
  fontControls: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
  },
  fontButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  fontButtonDisabled: {
    opacity: 0.4,
  },
  fontButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  noticeCard: {
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeCloseButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCloseText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
