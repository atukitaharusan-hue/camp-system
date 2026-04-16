import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ImportHistoryEntry } from '@/types/importHistory';

const MAX_HISTORY = 50;

interface ImportHistoryState {
  entries: ImportHistoryEntry[];
  addEntry: (entry: ImportHistoryEntry) => void;
  clearAll: () => void;
}

export const useImportHistoryStore = create<ImportHistoryState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entry) =>
        set((state) => ({
          entries: [entry, ...state.entries].slice(0, MAX_HISTORY),
        })),

      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'import-history',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
