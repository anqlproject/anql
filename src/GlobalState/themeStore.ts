import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

export const normalizeTheme = (theme: unknown): Theme =>
  theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';

interface ThemeStore {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: normalizeTheme(localStorage.getItem('app-theme')),
  resolvedTheme: 'light',

  setTheme: (preference) => {
    const theme = normalizeTheme(preference);
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'terminal', 'monochrome', 'soft-orange', 'soft-green', 'manuscript');

    const currentResolvedTheme = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;

    root.classList.add(currentResolvedTheme);
    localStorage.setItem('app-theme', theme);

    set({ theme, resolvedTheme: currentResolvedTheme });
  },

  toggleTheme: () => {
    const { resolvedTheme } = get();
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },
}));

// Listen to system theme changes when theme is 'system'
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (e: MediaQueryListEvent) => {
    const { theme } = useThemeStore.getState();
    if (theme === 'system') {
      const isDark = e.matches;
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(isDark ? 'dark' : 'light');
      useThemeStore.setState({ resolvedTheme: isDark ? 'dark' : 'light' });
    }
  };

  mediaQuery.addEventListener('change', handleChange);
}

// Initialize theme on load
if (typeof window !== 'undefined') {
  const { theme, setTheme } = useThemeStore.getState();
  setTheme(theme);
}
