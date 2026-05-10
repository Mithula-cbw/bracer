import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GoogleUser {
  name: string;
  email: string;
  avatar: string;
}

interface AppState {
  currentTheme: 'light' | 'dark';
  isGoogleAuthed: boolean;
  googleUser: GoogleUser | null;

  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setGoogleAuth: (user: GoogleUser) => void;
  clearGoogleAuth: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentTheme: 'light',
      isGoogleAuthed: false,
      googleUser: null,

      setTheme: (theme) => set({ currentTheme: theme }),
      toggleTheme: () =>
        set({ currentTheme: get().currentTheme === 'light' ? 'dark' : 'light' }),
      setGoogleAuth: (user) => set({ isGoogleAuthed: true, googleUser: user }),
      clearGoogleAuth: () => set({ isGoogleAuthed: false, googleUser: null }),
    }),
    {
      name: 'bracer-app-store',
      partialize: (state) => ({
        // Only persist theme; auth is re-established on load
        currentTheme: state.currentTheme,
      }),
    }
  )
);
