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
  archived?: boolean;
  richContent?: any; // Plate.js Value (JSON) for rich text with images
  rank?: number; // Pre-assigned rank for consistent display across windows
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

// Helper function to migrate old object-format notes to array format
const migrateNotesData = (rawData: string): string => {
  try {
    const parsed = JSON.parse(rawData);

    // If it's already an array, return as-is
    if (Array.isArray(parsed)) {
      return rawData;
    }

    // If it's an object (old format: { [id]: note }), convert to array
    if (parsed && typeof parsed === 'object') {
      const notesArray = Object.values(parsed);
      console.log('Migrating notes from object format to array format:', notesArray.length, 'notes');
      return JSON.stringify(notesArray);
    }

    // If it's something else, return empty array
    return '[]';
  } catch (error) {
    console.error('Failed to migrate notes data:', error);
    return '[]';
  }
};

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
        const rawValue = localStorage.getItem(key);

        // Special handling for notes atom to migrate old format
        if (key === 'lovpen-notes' && rawValue) {
          const migratedValue = migrateNotesData(rawValue);

          // Update localStorage with migrated data if it changed
          if (migratedValue !== rawValue) {
            localStorage.setItem(key, migratedValue);
            console.log('Notes data migrated and saved to localStorage');
          }

          return migratedValue;
        }

        return rawValue;
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

// Image display settings
export const imageMaxHeightAtom = atomWithStorage<number>(
  'lovpen-image-max-height',
  600, // Default: 600px
  createTauriStorage<number>(),
  { getOnInit: true }
);

// Derived atom for note statistics
export const noteStatsAtom = atom((get) => {
  const notes = get(notesAtom);

  // Safety check: ensure notes is an array
  if (!Array.isArray(notes)) {
    console.error('noteStatsAtom: notes is not an array:', typeof notes, notes);
    return {
      total: 0,
      today: 0,
      pinned: 0,
      archived: 0,
      weekCount: 0,
      avgLength: 0,
      streak: 0
    };
  }

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
    pinned: notes.filter(n => n.pinned).length,
    archived: notes.filter(n => n.archived).length,
    weekCount: weekNotes.length,
    avgLength,
    streak
  };
});
