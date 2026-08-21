type Listener = () => void;

class EventEmitter {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(): void {
    Array.from(this.listeners).forEach((listener) => {
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
