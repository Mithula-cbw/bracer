import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { currentTheme, setTheme } = useAppStore();

  // On first mount: honour system preference if no persisted value
  useEffect(() => {
    const stored = localStorage.getItem('bracer-app-store');
    if (!stored) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply / remove .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [currentTheme]);

  return <>{children}</>;
}
