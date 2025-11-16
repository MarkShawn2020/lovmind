/**
 * Simple Event Emitter for Editor
 *
 * Adds event emission capabilities to Plate.js editor instance.
 * This is needed because Plate.js doesn't have a built-in event system.
 */

type EventHandler = (...args: any[]) => void;

export interface EditorEventEmitter {
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, ...args: any[]): void;
}

export function createEditorEventEmitter(): EditorEventEmitter {
  const listeners = new Map<string, Set<EventHandler>>();

  return {
    on(event: string, handler: EventHandler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
      console.log(`[EventEmitter] Registered handler for "${event}". Total: ${listeners.get(event)!.size}`);
    },

    off(event: string, handler: EventHandler) {
      const handlers = listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        console.log(`[EventEmitter] Unregistered handler for "${event}". Remaining: ${handlers.size}`);
      }
    },

    emit(event: string, ...args: any[]) {
      const handlers = listeners.get(event);
      if (handlers && handlers.size > 0) {
        console.log(`[EventEmitter] Emitting "${event}" to ${handlers.size} handlers`);
        handlers.forEach((handler) => {
          try {
            handler(...args);
          } catch (error) {
            console.error(`[EventEmitter] Error in handler for "${event}":`, error);
          }
        });
      } else {
        console.warn(`[EventEmitter] No handlers registered for "${event}"`);
      }
    },
  };
}

/**
 * Attach event emitter to an editor instance
 */
export function attachEventEmitter(editor: any): void {
  if (editor.on && editor.emit) {
    console.log('[EventEmitter] Editor already has event emitter');
    return;
  }

  const emitter = createEditorEventEmitter();
  editor.on = emitter.on.bind(emitter);
  editor.off = emitter.off.bind(emitter);
  editor.emit = emitter.emit.bind(emitter);

  console.log('[EventEmitter] Attached event emitter to editor');
}
