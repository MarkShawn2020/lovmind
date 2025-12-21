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
  manualTitle?: boolean; // If true, title was manually edited and should not be auto-updated
  isDraft?: boolean; // If true, note is a draft (not submitted yet)
  submittedAt?: string; // Timestamp when note was submitted (converted from draft to note)
  createdAt?: string; // Timestamp when note was first created (first input)
  updatedAt?: string; // Timestamp when note was last updated
}

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);
};

// Create Tauri Store instance (with in-memory cache)
let store: Store | null = null;
let storeReady = false;
let isInitializing = false;
let initializationPromise: Promise<Store | null> | null = null;
const memoryCache = new Map<string, string>();

// Truncate log output for large data
const truncateLog = (value: string, maxLength = 200): string => {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + `... (${value.length} chars total)`;
};

const initStore = async (): Promise<Store | null> => {
  // Return existing store if already initialized
  if (storeReady && store) {
    return store;
  }

  // Return in-flight initialization promise to prevent duplicate initialization
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  // Only initialize in Tauri environment
  if (!isTauri()) {
    return null;
  }

  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log('[Store] Initializing Tauri Store...');
      store = await Store.load('lovpen-notes.json');

      // Load existing data into memory cache
      const keys = await store.keys();
      console.log('[Store] Loading', keys.length, 'keys from store');

      for (const key of keys) {
        const value = await store.get<string>(key);
        if (value !== null && value !== undefined) {
          memoryCache.set(key, value);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Store] Loaded "${key}":`, truncateLog(value));
          }
        }
      }

      storeReady = true;
      console.log('[Store] Initialization complete. Cache size:', memoryCache.size);
      return store;
    } catch (error) {
      console.error('[Store] Failed to initialize:', error);
      return null;
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
};

// Initialize store on module load
initStore();

// Export function to wait for store initialization
export const waitForStoreReady = async (): Promise<boolean> => {
  if (storeReady) return true;
  if (!isTauri()) return true; // Non-Tauri uses localStorage, always ready

  await initStore();
  return storeReady;
};

// Export function to check if store is ready (sync)
export const isStoreReady = (): boolean => {
  if (!isTauri()) return true;
  return storeReady;
};

// Export function to get a value directly from store (after init)
export const getStoreValue = async <T>(key: string, defaultValue: T): Promise<T> => {
  await waitForStoreReady();

  // Try memory cache first
  if (memoryCache.has(key)) {
    try {
      return JSON.parse(memoryCache.get(key)!) as T;
    } catch {
      return defaultValue;
    }
  }

  // Fallback to direct store read
  if (store) {
    const value = await store.get<string>(key);
    if (value !== null && value !== undefined) {
      try {
        return JSON.parse(value) as T;
      } catch {
        return defaultValue;
      }
    }
  }

  return defaultValue;
};

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

// Notes storage: localStorage in web builds, in-memory in Tauri (backend persists notes)
const createNotesStorage = <T>() => {
  return createJSONStorage<T>(() => ({
    getItem: (key: string) => {
      if (isTauri()) {
        return null;
      }

      const rawValue = localStorage.getItem(key);

      // Special handling for notes atom to migrate old format
      if (key === 'lovpen-notes' && rawValue) {
        const migratedValue = migrateNotesData(rawValue);

        // Update localStorage with migrated data if it changed
        if (migratedValue !== rawValue) {
          localStorage.setItem(key, migratedValue);
          if (process.env.NODE_ENV === 'development') {
            console.log('[Storage] Notes data migrated in localStorage');
          }
        }

        return migratedValue;
      }

      return rawValue;
    },

    setItem: (key: string, value: string) => {
      if (isTauri()) {
        return;
      }
      localStorage.setItem(key, value);
    },

    removeItem: (key: string) => {
      if (isTauri()) {
        return;
      }
      localStorage.removeItem(key);
    },
  }));
};

// Custom storage implementation using memory cache + async Tauri Store
const createTauriStorage = <T>() => {
  return createJSONStorage<T>(() => ({
    getItem: (key: string) => {
      // Use memory cache for sync access
      if (memoryCache.has(key)) {
        const value = memoryCache.get(key) || null;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Storage] Cache hit for "${key}":`, truncateLog(value || ''));
        }
        return value;
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
            if (process.env.NODE_ENV === 'development') {
              console.log('[Storage] Notes data migrated in localStorage');
            }
          }

          return migratedValue;
        }

        return rawValue;
      }

      // For Tauri: If not in memory cache, try lazy-loading from store
      // This helps with race conditions where atoms initialize before full store load
      if (storeReady && store) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Storage] Cache miss for "${key}", attempting lazy load`);
        }
        // Schedule async load to populate cache for next access
        store.get<string>(key).then(value => {
          if (value !== null && value !== undefined) {
            memoryCache.set(key, value);
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Storage] Lazy loaded "${key}":`, truncateLog(value));
            }
          }
        }).catch(error => {
          console.error(`[Storage] Failed to lazy load "${key}":`, error);
        });
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
  createNotesStorage<Note[]>(),
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
  240, // Default: 240px
  createTauriStorage<number>(),
  { getOnInit: true }
);

// Pinned notes section collapse state
export const isPinnedCollapsedAtom = atomWithStorage<boolean>(
  'lovpen-pinned-collapsed',
  false, // Default: expanded
  createTauriStorage<boolean>(),
  { getOnInit: true }
);

// Cloud storage settings (Qiniu)
export interface CloudStorageSettings {
  enabled: boolean;
  provider: 'qiniu' | 'local'; // Extensible for future providers
  qiniu: {
    accessKey: string;
    secretKey: string;
    bucket: string;
    domain: string; // CDN domain for accessing uploaded files
    region: 'z0' | 'z1' | 'z2' | 'na0' | 'as0'; // Qiniu regions
  };
}

export const defaultCloudStorageSettings: CloudStorageSettings = {
  enabled: false,
  provider: 'local',
  qiniu: {
    accessKey: '',
    secretKey: '',
    bucket: '',
    domain: '',
    region: 'z0', // Default: East China
  },
};

export const cloudStorageSettingsAtom = atomWithStorage<CloudStorageSettings>(
  'lovpen-cloud-storage',
  defaultCloudStorageSettings,
  createTauriStorage<CloudStorageSettings>(),
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
