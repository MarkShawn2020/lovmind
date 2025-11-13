import { atom } from 'jotai';

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

// SIMPLIFIED ARCHITECTURE:
// - Jotai atoms are in-memory cache only (no persistence)
// - Backend Rust (notes.json) is the single source of truth
// - All persistence goes through invoke() calls to backend

// In-memory atoms (no persistence)
export const notesAtom = atom<Note[]>([]);

export const contentAtom = atom<string>('');

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
