import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: (localStorage.getItem('app-theme') as Theme) || 'system',
  resolvedTheme: 'light',

  setTheme: (theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let currentResolvedTheme: 'light' | 'dark' = 'light';

    if (theme === 'system') {
      currentResolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      currentResolvedTheme = theme as 'light' | 'dark';
    }

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
