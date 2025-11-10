import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { Store } from '@tauri-apps/plugin-store';

// Note interface
export interface Note {
  id: string;
  text: string;
  title: string;
  time: string;
  tags: string[];
  favorite?: boolean;
  pinned?: boolean;
}

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);
};

// Create Tauri Store instance (with in-memory cache)
let store: Store | null = null;
let storeReady = false;
const memoryCache = new Map<string, string>();

const initStore = async () => {
  if (!store && isTauri()) {
    try {
      store = await Store.load('lovpen-notes.json');
      storeReady = true;

      // Load existing data into memory cache
      const keys = await store.keys();
      for (const key of keys) {
        const value = await store.get<string>(key);
        if (value !== null && value !== undefined) {
          memoryCache.set(key, value);
        }
      }
    } catch (error) {
      console.error('Failed to initialize Tauri Store:', error);
    }
  }
  return store;
};

// Initialize store on module load
initStore();

// Custom storage implementation using memory cache + async Tauri Store
const createTauriStorage = <T>() => {
  return createJSONStorage<T>(() => ({
    getItem: (key: string) => {
      // Use memory cache for sync access
      if (memoryCache.has(key)) {
        return memoryCache.get(key) || null;
      }

      // Fallback to localStorage if not in cache
      if (!isTauri()) {
        return localStorage.getItem(key);
      }

      return null;
    },

    setItem: (key: string, value: string) => {
      // Update memory cache immediately (sync)
      memoryCache.set(key, value);

      if (!isTauri()) {
        // Fallback to localStorage in non-Tauri environment
        localStorage.setItem(key, value);
        return;
      }

      // Persist to Tauri Store asynchronously
      if (storeReady && store) {
        store.set(key, value).then(() => {
          return store!.save();
        }).catch(error => {
          console.error(`Failed to persist item ${key}:`, error);
        });
      }
    },

    removeItem: (key: string) => {
      // Remove from memory cache immediately (sync)
      memoryCache.delete(key);

      if (!isTauri()) {
        // Fallback to localStorage in non-Tauri environment
        localStorage.removeItem(key);
        return;
      }

      // Remove from Tauri Store asynchronously
      if (storeReady && store) {
        store.delete(key).then(() => {
          return store!.save();
        }).catch(error => {
          console.error(`Failed to remove item ${key}:`, error);
        });
      }
    },
  }));
};

// Atoms with persistence
export const notesAtom = atomWithStorage<Note[]>(
  'lovpen-notes',
  [],
  createTauriStorage<Note[]>(),
  { getOnInit: true }
);

export const contentAtom = atomWithStorage<string>(
  'lovpen-content',
  '',
  createTauriStorage<string>(),
  { getOnInit: true }
);

// Derived atom for note statistics
export const noteStatsAtom = atom((get) => {
  const notes = get(notesAtom);
  const now = new Date();
  const today = now.toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayNotes = notes.filter(n =>
    new Date(n.time).toDateString() === today
  );

  const weekNotes = notes.filter(n =>
    new Date(n.time) >= weekAgo
  );

  // Calculate streak (consecutive days with notes)
  const streak = (() => {
    const sortedDates = [...new Set(notes.map(n =>
      new Date(n.time).toDateString()
    ))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let count = 0;
    const checkDate = new Date();

    for (let i = 0; i < 30; i++) {
      if (sortedDates.includes(checkDate.toDateString())) {
        count++;
      } else if (count > 0) {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return count;
  })();

  const totalChars = notes.reduce((acc, n) => acc + n.text.length, 0);
  const avgLength = notes.length > 0 ? Math.round(totalChars / notes.length) : 0;

  return {
    total: notes.length,
    today: todayNotes.length,
    favorites: notes.filter(n => n.favorite).length,
    pinned: notes.filter(n => n.pinned).length,
    weekCount: weekNotes.length,
    avgLength,
    streak
  };
});
