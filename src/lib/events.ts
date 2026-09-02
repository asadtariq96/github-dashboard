import type { Mode } from './config';

type Listener = () => void;

class EventEmitter {
  private listeners: Map<Mode, Set<Listener>> = new Map();

  subscribe(mode: Mode, listener: Listener): () => void {
    let set = this.listeners.get(mode);
    if (!set) {
      set = new Set();
      this.listeners.set(mode, set);
    }
    set.add(listener);
    return () => {
      this.listeners.get(mode)?.delete(listener);
    };
  }

  emit(mode: Mode): void {
    const set = this.listeners.get(mode);
    if (!set) return;
    Array.from(set).forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    });
  }
}

// Global emitter singleton across the Next.js runtime
const globalForEvents = globalThis as unknown as {
  prEventEmitter?: EventEmitter;
};

export const prEventEmitter = globalForEvents.prEventEmitter ?? new EventEmitter();
if (process.env.NODE_ENV !== 'production') {
  globalForEvents.prEventEmitter = prEventEmitter;
}
