import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'campaign-dashboard-theme'; // 'light' | 'dark' | 'system'
const ThemeContext = createContext(null);

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  const [resolvedTheme, setResolvedTheme] = useState(() => (theme === 'dark' || (theme === 'system' && systemPrefersDark()) ? 'dark' : 'light'));

  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(theme === 'dark' || (theme === 'system' && systemPrefersDark()) ? 'dark' : 'light');
    if (theme !== 'system') return;
    // В 'system' режиме следим за живой сменой темы ОС (раньше .dark ставился
    // один раз при загрузке через prefers-color-scheme и не реагировал дальше).
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyTheme('system');
      setResolvedTheme(systemPrefersDark() ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  function setTheme(next) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage недоступен (приватный режим и т.п.) — тема просто не переживёт reload */
    }
  }

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
