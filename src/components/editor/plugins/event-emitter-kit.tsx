'use client';

import { createSlatePlugin } from 'platejs';

/**
 * Event Emitter Plugin
 *
 * Adds event emitter functionality to the Plate editor.
 * Provides emit/on/off methods for custom events.
 *
 * Usage:
 * ```typescript
 * // Emit events
 * editor.emit('my-event', data);
 *
 * // Listen to events
 * editor.on('my-event', handler);
 *
 * // Remove listeners
 * editor.off('my-event', handler);
 * ```
 */

type EventHandler = (...args: any[]) => void;

interface EventEmitterApi {
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, handler: EventHandler) => void;
  off: (event: string, handler: EventHandler) => void;
}

export const EventEmitterPlugin = createSlatePlugin({
  key: 'event-emitter',
  extendEditor: ({ editor }) => {
    // Skip if already initialized
    if ((editor as any).__eventEmitterInitialized) {
      return editor;
    }

    // Mark as initialized
    (editor as any).__eventEmitterInitialized = true;

    // Event handlers storage
    const eventHandlers = new Map<string, Set<EventHandler>>();

    // Emit event
    (editor as any).emit = (event: string, ...args: any[]) => {
      const handlers = eventHandlers.get(event);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(...args);
          } catch (error) {
            console.error(`[EventEmitter] Error in handler for event "${event}":`, error);
          }
        });
      }
    };

    // Register event listener
    (editor as any).on = (event: string, handler: EventHandler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    };

    // Remove event listener
    (editor as any).off = (event: string, handler: EventHandler) => {
      const handlers = eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          eventHandlers.delete(event);
        }
      }
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[EventEmitterPlugin] Initialized');
    }

    return editor;
  },
});

// Note: TypeScript declaration is not needed because we dynamically
// add emit/on/off to the editor object at runtime
