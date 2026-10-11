export interface UndoHandler {
  message: string;
  onUndo: () => void;
}

type Listener = (undo: UndoHandler | null) => void;

class DeckUndoStore {
  private current: UndoHandler | null = null;
  private listeners = new Set<Listener>();

  set(undo: UndoHandler | null) {
    this.current = undo;
    this.listeners.forEach((l) => l(this.current));
  }

  get(): UndoHandler | null {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear() {
    this.set(null);
  }
}

export const deckUndoStore = new DeckUndoStore();
