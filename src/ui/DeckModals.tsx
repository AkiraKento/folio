import React, { useState, useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import type { Deck } from '@/db/schema';

// ---------------------------------------------------------------------------
// 1. CreateDeckModal
// ---------------------------------------------------------------------------
export interface CreateDeckModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string | null) => void;
  availableDecks: Deck[];
  initialParentId?: string | null;
}

export function CreateDeckModal({
  visible,
  onClose,
  onCreate,
  availableDecks,
  initialParentId = null,
}: CreateDeckModalProps) {
  const { theme } = useTheme();
  const [deckName, setDeckName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(initialParentId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDeckName('');
      setDescription('');
      setSelectedParentId(initialParentId ?? null);
      setErrorMessage(null);
    }
  }, [visible, initialParentId]);

  const handleSubmit = () => {
    const trimmed = deckName.trim();
    if (!trimmed) {
      setErrorMessage(strings.decks.errorNameRequired);
      return;
    }

    let fullName = trimmed;
    if (selectedParentId) {
      const parent = availableDecks.find((d) => d.id === selectedParentId);
      if (parent) {
        fullName = trimmed.startsWith(`${parent.name}::`)
          ? trimmed
          : `${parent.name}::${trimmed}`;
      }
    }

    try {
      onCreate(fullName, description.trim() || null);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.fg }]}>
                {strings.decks.createDeckModalTitle}
              </Text>

              {errorMessage && (
                <View style={[styles.errorContainer, { backgroundColor: theme.elevated2 }]}>
                  <Text style={[styles.errorText, { color: theme.fg }]}>{errorMessage}</Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: theme.fgMuted }]}>
                {strings.decks.deckNameLabel}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.canvas,
                    color: theme.fg,
                    borderColor: theme.border,
                  },
                ]}
                placeholder={strings.decks.deckNamePlaceholder}
                placeholderTextColor={theme.fgMuted}
                value={deckName}
                onChangeText={(text) => {
                  setDeckName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
              />

              <Text style={[styles.inputLabel, { color: theme.fgMuted }]}>
                {strings.decks.parentDeckLabel}
              </Text>
              <ScrollView style={styles.parentScroll} nestedScrollEnabled>
                <TouchableOpacity
                  style={[
                    styles.parentOptionRow,
                    {
                      backgroundColor: selectedParentId === null ? theme.elevated2 : 'transparent',
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setSelectedParentId(null)}
                  accessibilityRole="button"
                  accessibilityLabel={strings.decks.noParent}
                >
                  <Text style={[styles.parentOptionText, { color: theme.fg }]}>
                    {selectedParentId === null ? '✓ ' : '  '}
                    {strings.decks.noParent}
                  </Text>
                </TouchableOpacity>

                {availableDecks.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.parentOptionRow,
                      {
                        backgroundColor: selectedParentId === d.id ? theme.elevated2 : 'transparent',
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setSelectedParentId(d.id)}
                    accessibilityRole="button"
                    accessibilityLabel={d.name}
                  >
                    <Text
                      style={[
                        styles.parentOptionText,
                        { color: theme.fg, fontWeight: selectedParentId === d.id ? '700' : '400' },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedParentId === d.id ? '✓ ' : '  '}
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: theme.fgMuted }]}>
                {strings.decks.deckDescriptionLabel}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.canvas,
                    color: theme.fg,
                    borderColor: theme.border,
                  },
                ]}
                placeholder={strings.decks.deckDescriptionPlaceholder}
                placeholderTextColor={theme.fgMuted}
                value={description}
                onChangeText={setDescription}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={strings.common.cancel}
                >
                  <Text style={[styles.buttonText, { color: theme.fgMuted }]}>
                    {strings.common.cancel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, { backgroundColor: theme.accent }]}
                  onPress={handleSubmit}
                  accessibilityRole="button"
                  accessibilityLabel={strings.decks.create}
                >
                  <Text style={styles.primaryButtonText}>{strings.decks.create}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 2. RenameDeckModal
// ---------------------------------------------------------------------------
export interface RenameDeckModalProps {
  visible: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
}

export function RenameDeckModal({
  visible,
  onClose,
  onRename,
  currentName,
}: RenameDeckModalProps) {
  const { theme } = useTheme();
  const parts = currentName.split('::');
  const parentPath = parts.length > 1 ? parts.slice(0, -1).join('::') : null;
  const initialShortName = parts[parts.length - 1];

  const [name, setName] = useState(initialShortName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const p = currentName.split('::');
      setName(p[p.length - 1]);
      setErrorMessage(null);
    }
  }, [visible, currentName]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage(strings.decks.errorNameRequired);
      return;
    }

    let fullName = trimmed;
    if (parentPath) {
      fullName = trimmed.startsWith(`${parentPath}::`)
        ? trimmed
        : `${parentPath}::${trimmed}`;
    }

    try {
      onRename(fullName);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.fg }]}>
                {strings.decks.renameDeckModalTitle}
              </Text>

              {parentPath && (
                <Text style={[styles.parentContextText, { color: theme.fgMuted }]}>
                  Em: {parentPath.replace(/::/g, ' :: ')}
                </Text>
              )}

              {errorMessage && (
                <View style={[styles.errorContainer, { backgroundColor: theme.elevated2 }]}>
                  <Text style={[styles.errorText, { color: theme.fg }]}>{errorMessage}</Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: theme.fgMuted }]}>
                {strings.decks.newDeckNameLabel}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.canvas,
                    color: theme.fg,
                    borderColor: theme.border,
                  },
                ]}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={strings.common.cancel}
                >
                  <Text style={[styles.buttonText, { color: theme.fgMuted }]}>
                    {strings.common.cancel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, { backgroundColor: theme.accent }]}
                  onPress={handleSubmit}
                  accessibilityRole="button"
                  accessibilityLabel={strings.common.save}
                >
                  <Text style={styles.primaryButtonText}>{strings.common.save}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 3. MoveDeckModal
// ---------------------------------------------------------------------------
export interface MoveDeckModalProps {
  visible: boolean;
  onClose: () => void;
  onMove: (newParentId: string | null) => void;
  currentDeck: Deck;
  availableDecks: Deck[];
}

export function MoveDeckModal({
  visible,
  onClose,
  onMove,
  currentDeck,
  availableDecks,
}: MoveDeckModalProps) {
  const { theme } = useTheme();
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtra para não permitir mover para si mesmo ou descendentes
  const eligibleDecks = availableDecks.filter(
    (d) => d.id !== currentDeck.id && !d.name.startsWith(`${currentDeck.name}::`)
  );

  useEffect(() => {
    if (visible) {
      // Determina o pai atual se houver
      const lastIndex = currentDeck.name.lastIndexOf('::');
      if (lastIndex !== -1) {
        const parentName = currentDeck.name.slice(0, lastIndex);
        const parent = availableDecks.find((d) => d.name === parentName);
        setSelectedParentId(parent ? parent.id : null);
      } else {
        setSelectedParentId(null);
      }
      setErrorMessage(null);
    }
  }, [visible, currentDeck, availableDecks]);

  const handleSubmit = () => {
    try {
      onMove(selectedParentId);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.fg }]}>
                {strings.decks.moveDeckModalTitle}
              </Text>

              {errorMessage && (
                <View style={[styles.errorContainer, { backgroundColor: theme.elevated2 }]}>
                  <Text style={[styles.errorText, { color: theme.fg }]}>{errorMessage}</Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: theme.fgMuted }]}>
                {strings.decks.selectNewParent}
              </Text>

              <ScrollView style={styles.moveScroll} nestedScrollEnabled>
                <TouchableOpacity
                  style={[
                    styles.parentOptionRow,
                    {
                      backgroundColor: selectedParentId === null ? theme.elevated2 : 'transparent',
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setSelectedParentId(null)}
                  accessibilityRole="button"
                  accessibilityLabel={strings.decks.moveToRoot}
                >
                  <Text style={[styles.parentOptionText, { color: theme.fg }]}>
                    {selectedParentId === null ? '✓ ' : '  '}
                    {strings.decks.moveToRoot}
                  </Text>
                </TouchableOpacity>

                {eligibleDecks.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.parentOptionRow,
                      {
                        backgroundColor: selectedParentId === d.id ? theme.elevated2 : 'transparent',
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setSelectedParentId(d.id)}
                    accessibilityRole="button"
                    accessibilityLabel={d.name}
                  >
                    <Text
                      style={[
                        styles.parentOptionText,
                        { color: theme.fg, fontWeight: selectedParentId === d.id ? '700' : '400' },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedParentId === d.id ? '✓ ' : '  '}
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={strings.common.cancel}
                >
                  <Text style={[styles.buttonText, { color: theme.fgMuted }]}>
                    {strings.common.cancel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, { backgroundColor: theme.accent }]}
                  onPress={handleSubmit}
                  accessibilityRole="button"
                  accessibilityLabel={strings.decks.move}
                >
                  <Text style={styles.primaryButtonText}>{strings.decks.move}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 4. DeckOptionsMenuModal
// ---------------------------------------------------------------------------
export interface DeckOptionsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  deckName: string;
  onRename: () => void;
  onMove: () => void;
  onCreateSubdeck: () => void;
  onDelete: () => void;
}

export function DeckOptionsMenuModal({
  visible,
  onClose,
  deckName,
  onRename,
  onMove,
  onCreateSubdeck,
  onDelete,
}: DeckOptionsMenuModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.menuCard, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
              <Text style={[styles.menuTitle, { color: theme.fg }]} numberOfLines={1}>
                {deckName}
              </Text>

              <TouchableOpacity
                style={[styles.menuOptionRow, { borderTopColor: theme.border }]}
                onPress={() => {
                  onClose();
                  onRename();
                }}
                accessibilityRole="button"
                accessibilityLabel={strings.decks.rename}
              >
                <Text style={[styles.menuOptionText, { color: theme.fg }]}>
                  ✏️  {strings.decks.rename}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuOptionRow, { borderTopColor: theme.border }]}
                onPress={() => {
                  onClose();
                  onMove();
                }}
                accessibilityRole="button"
                accessibilityLabel={strings.decks.move}
              >
                <Text style={[styles.menuOptionText, { color: theme.fg }]}>
                  📁  {strings.decks.move}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuOptionRow, { borderTopColor: theme.border }]}
                onPress={() => {
                  onClose();
                  onCreateSubdeck();
                }}
                accessibilityRole="button"
                accessibilityLabel={strings.decks.createSubdeck}
              >
                <Text style={[styles.menuOptionText, { color: theme.fg }]}>
                  ➕  {strings.decks.createSubdeck}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuOptionRow, { borderTopColor: theme.border }]}
                onPress={() => {
                  onClose();
                  onDelete();
                }}
                accessibilityRole="button"
                accessibilityLabel={strings.decks.deleteDeck}
              >
                <Text style={[styles.menuOptionText, styles.deleteText]}>
                  🗑️  {strings.decks.deleteDeck}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuCancelRow, { backgroundColor: theme.elevated2 }]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={strings.common.cancel}
              >
                <Text style={[styles.menuCancelText, { color: theme.fgMuted }]}>
                  {strings.common.cancel}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    paddingTop: 16,
    paddingBottom: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  parentContextText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  parentScroll: {
    maxHeight: 120,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    marginVertical: 4,
  },
  moveScroll: {
    maxHeight: 200,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    marginVertical: 8,
  },
  parentOptionRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  parentOptionText: {
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  button: {
    minHeight: 44,
    minWidth: 90,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {},
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorContainer: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#d32f2f',
    fontWeight: '500',
  },
  menuOptionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  deleteText: {
    color: '#d32f2f',
  },
  menuCancelRow: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  menuCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
