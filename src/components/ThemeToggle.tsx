'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'gh_dashboard_theme';
const ORDER: Theme[] = ['light', 'dark', 'system'];

const LABEL: Record<Theme, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

function apply(theme: Theme) {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') setTheme(stored);
    setMounted(true);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    apply(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      onClick={cycle}
      aria-label={LABEL[theme]}
      title={LABEL[theme]}
      className="tap-safe inline-flex items-center justify-center rounded-lg border border-line bg-surface-raised p-2 text-muted shadow-sm transition-all duration-instant ease-out hover:-translate-y-px hover:border-line-strong hover:text-ink"
    >
      <Icon aria-hidden className="h-4 w-4" style={{ opacity: mounted ? 1 : 0 }} />
    </button>
  );
}
