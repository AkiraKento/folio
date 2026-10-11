import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import { CardView } from './CardView';
import type { useCardEditor } from '@/cards/useCardEditor';
import type { Deck, NoteType } from '@/db/schema';

export interface CardEditorViewProps {
  editor: ReturnType<typeof useCardEditor>;
  onBack: () => void;
  isEditing?: boolean;
}

export function CardEditorView({
  editor,
  onBack,
  isEditing = false,
}: CardEditorViewProps) {
  const { theme } = useTheme();
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [modelModalOpen, setModelModalOpen] = useState(false);

  const {
    loading,
    saving,
    availableDecks,
    availableNoteTypes,
    currentDeck,
    currentNoteType,
    fields,
    tags,
    activeTab,
    previewSide,
    previewCardOrd,
    expectedOrds,
    mediaBasePath,
    previewHtml,
    errorMessage,
    successMessage,
    setSelectedDeckId,
    setSelectedNoteTypeId,
    setFieldValue,
    setTags,
    setActiveFieldName,
    setActiveTab,
    setPreviewSide,
    setPreviewCardOrd,
    insertClozeShortcut,
    insertImageFromGallery,
    save,
    clearError,
    clearSuccess,
  } = editor;

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
          {strings.common.loading}
        </Text>
      </View>
    );
  }

  const isClozeModel = currentNoteType?.kind === 'cloze';
  const hasMultipleCards = expectedOrds.length > 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Barra de cabeçalho */}
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
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={strings.deckDetail.backButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.backArrow, { color: theme.fg }]}>←</Text>
          <Text style={[styles.backText, { color: theme.fg }]}>
            {strings.deckDetail.backButton}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.fg }]} numberOfLines={1}>
          {isEditing ? strings.cardEditor.titleEdit : strings.cardEditor.titleNew}
        </Text>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: theme.accent, opacity: saving ? 0.7 : 1 },
          ]}
          onPress={async () => {
            await save();
          }}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={strings.cardEditor.save}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>{strings.cardEditor.save}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Alternador de abas Editar / Prévia */}
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'edit' && { borderBottomColor: theme.accent, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('edit')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel={strings.cardEditor.tabEdit}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'edit' ? theme.accent : theme.fgMuted },
              activeTab === 'edit' && styles.tabTextActive,
            ]}
          >
            {strings.cardEditor.tabEdit}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'preview' && { borderBottomColor: theme.accent, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('preview')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel={strings.cardEditor.tabPreview}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'preview' ? theme.accent : theme.fgMuted },
              activeTab === 'preview' && styles.tabTextActive,
            ]}
          >
            {strings.cardEditor.tabPreview}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mensagens de erro ou sucesso */}
      {errorMessage && (
        <View style={[styles.banner, { backgroundColor: '#ffebee', borderColor: '#ffcdd2' }]}>
          <Text style={[styles.bannerText, { color: '#c62828' }]}>{errorMessage}</Text>
          <TouchableOpacity
            onPress={clearError}
            style={styles.bannerClose}
            accessibilityRole="button"
            accessibilityLabel={strings.common.close}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#c62828', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {successMessage && (
        <View style={[styles.banner, { backgroundColor: '#e8f5e9', borderColor: '#c8e6c9' }]}>
          <Text style={[styles.bannerText, { color: '#2e7d32' }]}>{successMessage}</Text>
          <TouchableOpacity
            onPress={clearSuccess}
            style={styles.bannerClose}
            accessibilityRole="button"
            accessibilityLabel={strings.common.close}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#2e7d32', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conteúdo: Aba Editar */}
      {activeTab === 'edit' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Seletores de Deck e Modelo */}
          <View style={styles.selectorsRow}>
            {/* Seletor de Deck */}
            <TouchableOpacity
              style={[
                styles.selectorPill,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
              onPress={() => setDeckModalOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={strings.cardEditor.deck}
            >
              <Text style={[styles.selectorLabel, { color: theme.fgMuted }]}>
                {strings.cardEditor.deck}:
              </Text>
              <Text style={[styles.selectorValue, { color: theme.fg }]} numberOfLines={1}>
                {currentDeck ? currentDeck.name.split('::').pop() : strings.cardEditor.selectDeck}
              </Text>
              <Text style={[styles.chevron, { color: theme.fgMuted }]}>▾</Text>
            </TouchableOpacity>

            {/* Seletor de Modelo */}
            <TouchableOpacity
              style={[
                styles.selectorPill,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
              onPress={() => setModelModalOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={strings.cardEditor.model}
            >
              <Text style={[styles.selectorLabel, { color: theme.fgMuted }]}>
                {strings.cardEditor.model}:
              </Text>
              <Text style={[styles.selectorValue, { color: theme.fg }]} numberOfLines={1}>
                {currentNoteType ? currentNoteType.name : strings.cardEditor.selectModel}
              </Text>
              <Text style={[styles.chevron, { color: theme.fgMuted }]}>▾</Text>
            </TouchableOpacity>
          </View>

          {/* Barra de atalhos ergonômica */}
          <View
            style={[
              styles.toolbarRow,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <TouchableOpacity
              style={[styles.toolbarButton, { backgroundColor: theme.elevated2 }]}
              onPress={insertImageFromGallery}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={strings.cardEditor.insertImage}
            >
              <Text style={[styles.toolbarIcon, { color: theme.accent }]}>🖼</Text>
              <Text style={[styles.toolbarButtonText, { color: theme.fg }]}>
                {strings.cardEditor.insertImage}
              </Text>
            </TouchableOpacity>

            {isClozeModel && (
              <TouchableOpacity
                style={[styles.toolbarButton, { backgroundColor: theme.elevated2 }]}
                onPress={insertClozeShortcut}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={strings.cardEditor.insertCloze}
              >
                <Text style={[styles.toolbarIcon, { color: theme.accent }]}>
                  {strings.cardEditor.clozeShortcut}
                </Text>
                <Text style={[styles.toolbarButtonText, { color: theme.fg }]}>
                  {strings.cardEditor.insertCloze}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Campos do Modelo */}
          {currentNoteType?.fields.map((field) => (
            <View key={field.name} style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.fg }]}>{field.name}</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: theme.elevated,
                    borderColor: theme.border,
                    color: theme.fg,
                  },
                ]}
                value={fields[field.name] ?? ''}
                onChangeText={(val) => setFieldValue(field.name, val)}
                onFocus={() => setActiveFieldName(field.name)}
                placeholder={`${field.name}...`}
                placeholderTextColor={theme.fgMuted}
                multiline
                textAlignVertical="top"
              />
            </View>
          ))}

          {/* Campo de Tags */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.fg }]}>{strings.cardEditor.tags}</Text>
            <TextInput
              style={[
                styles.tagsInput,
                {
                  backgroundColor: theme.elevated,
                  borderColor: theme.border,
                  color: theme.fg,
                },
              ]}
              value={tags}
              onChangeText={setTags}
              placeholder={strings.cardEditor.tagsPlaceholder}
              placeholderTextColor={theme.fgMuted}
              autoCapitalize="none"
            />
          </View>
        </ScrollView>
      ) : (
        /* Conteúdo: Aba Prévia */
        <View style={styles.previewContainer}>
          {/* Barra de alternância da prévia */}
          <View
            style={[
              styles.previewControlsBar,
              { backgroundColor: theme.elevated, borderBottomColor: theme.border },
            ]}
          >
            {/* Alternador Frente / Verso */}
            <View style={[styles.sideToggleGroup, { backgroundColor: theme.elevated2 }]}>
              <TouchableOpacity
                style={[
                  styles.sideToggleButton,
                  previewSide === 'front' && { backgroundColor: theme.accent },
                ]}
                onPress={() => setPreviewSide('front')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: previewSide === 'front' }}
                accessibilityLabel={strings.cardEditor.previewFront}
              >
                <Text
                  style={[
                    styles.sideToggleText,
                    { color: previewSide === 'front' ? '#ffffff' : theme.fg },
                  ]}
                >
                  {strings.cardEditor.previewFront}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sideToggleButton,
                  previewSide === 'back' && { backgroundColor: theme.accent },
                ]}
                onPress={() => setPreviewSide('back')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: previewSide === 'back' }}
                accessibilityLabel={strings.cardEditor.previewBack}
              >
                <Text
                  style={[
                    styles.sideToggleText,
                    { color: previewSide === 'back' ? '#ffffff' : theme.fg },
                  ]}
                >
                  {strings.cardEditor.previewBack}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Alternador de Card Ordinal se houver múltiplos cards */}
            {hasMultipleCards && (
              <View style={styles.ordTabs}>
                {expectedOrds.map((ord, idx) => (
                  <TouchableOpacity
                    key={ord}
                    style={[
                      styles.ordTabButton,
                      {
                        backgroundColor:
                          previewCardOrd === ord ? theme.elevated2 : 'transparent',
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setPreviewCardOrd(ord)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: previewCardOrd === ord }}
                    accessibilityLabel={strings.cardEditor.cardOrdinal(idx + 1, expectedOrds.length)}
                  >
                    <Text
                      style={[
                        styles.ordTabText,
                        {
                          color: previewCardOrd === ord ? theme.accent : theme.fgMuted,
                          fontWeight: previewCardOrd === ord ? '700' : '500',
                        },
                      ]}
                    >
                      {strings.cardEditor.cardOrdinal(idx + 1, expectedOrds.length)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Renderização real do card via CardView com WebView */}
          {previewHtml ? (
            <View style={styles.cardViewWrapper}>
              <CardView
                html={previewHtml}
                side={previewSide}
                css={currentNoteType?.css}
                mediaBasePath={mediaBasePath}
                cardOrd={previewCardOrd}
                style={styles.cardView}
              />
            </View>
          ) : (
            <View style={[styles.center, { flex: 1 }]}>
              <Text style={{ color: theme.fgMuted, fontSize: 15 }}>
                {strings.cardEditor.emptyPreview}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Modal de Escolha do Deck */}
      <Modal visible={deckModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.fg }]}>
              {strings.cardEditor.changeDeck}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {availableDecks.map((d: Deck) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.modalOptionItem,
                    { borderBottomColor: theme.border },
                    d.id === currentDeck?.id && { backgroundColor: theme.elevated2 },
                  ]}
                  onPress={() => {
                    setSelectedDeckId(d.id);
                    setDeckModalOpen(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={d.name}
                  accessibilityState={{ selected: d.id === currentDeck?.id }}
                >
                  <Text style={[styles.modalOptionText, { color: theme.fg }]}>{d.name}</Text>
                  {d.id === currentDeck?.id && (
                    <Text style={{ color: theme.accent, fontWeight: 'bold' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: theme.elevated2 }]}
              onPress={() => setDeckModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={strings.common.close}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCloseText, { color: theme.fg }]}>
                {strings.common.close}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Escolha do Modelo */}
      <Modal visible={modelModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.fg }]}>
              {strings.cardEditor.changeModel}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {availableNoteTypes.map((nt: NoteType) => (
                <TouchableOpacity
                  key={nt.id}
                  style={[
                    styles.modalOptionItem,
                    { borderBottomColor: theme.border },
                    nt.id === currentNoteType?.id && { backgroundColor: theme.elevated2 },
                  ]}
                  onPress={() => {
                    setSelectedNoteTypeId(nt.id);
                    setModelModalOpen(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={nt.name}
                  accessibilityState={{ selected: nt.id === currentNoteType?.id }}
                >
                  <Text style={[styles.modalOptionText, { color: theme.fg }]}>{nt.name}</Text>
                  {nt.id === currentNoteType?.id && (
                    <Text style={{ color: theme.accent, fontWeight: 'bold' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: theme.elevated2 }]}
              onPress={() => setModelModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={strings.common.close}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCloseText, { color: theme.fg }]}>
                {strings.common.close}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    gap: 8,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  saveButton: {
    minHeight: 38,
    minWidth: 70,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  selectorsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  selectorValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 12,
    marginLeft: 4,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    gap: 10,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  toolbarIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 100,
  },
  tagsInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 44,
    fontSize: 14,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerText: {
    fontSize: 13,
    flex: 1,
  },
  bannerClose: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
  },
  previewControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sideToggleGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  sideToggleButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ordTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  ordTabButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordTabText: {
    fontSize: 12,
  },
  cardViewWrapper: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalOptionItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalCloseButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
