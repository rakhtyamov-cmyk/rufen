import { useCallback, useEffect, useState } from 'react';

/** Set<string>, персистентный в localStorage (напр. свёрнутые аккаунты). */
export function useLocalStorageSet(key) {
  const [set, setSet] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch {
      /* localStorage недоступен — состояние просто не переживёт reload */
    }
  }, [key, set]);

  const toggle = useCallback((value) => {
    setSet((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }, []);

  return [set, setSet, toggle];
}
