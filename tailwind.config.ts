import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

export default {
  darkMode: ['selector', ':root[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.3' }],
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.4' }],
        base: ['14px', { lineHeight: '1.4' }],
        lg: ['16px', { lineHeight: '1.35' }],
        xl: ['20px', { lineHeight: '1.3' }],
        '2xl': ['28px', { lineHeight: '1.2' }],
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        row: 'var(--row-height)',
        header: 'var(--header-height)',
        rail: 'var(--rail-width)',
        'rail-collapsed': 'var(--rail-width-collapsed)',
      },
      colors: {
        canvas: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-hover': 'var(--surface-hover)',
        'surface-muted': 'var(--surface-muted)',
        line: 'var(--border)',
        'line-subtle': 'var(--border-subtle)',
        'line-strong': 'var(--border-strong)',
        'line-control': 'var(--border-control)',
        ink: 'var(--text)',
        muted: 'var(--text-muted)',
        dim: 'var(--text-dim)',
        faint: 'var(--text-faint)',
        accent: 'var(--accent)',
        'accent-fill': 'var(--accent-fill)',
        'accent-hover': 'var(--accent-hover)',
        'accent-on': 'var(--accent-on)',
        'accent-wash': 'var(--accent-wash)',
        'accent-border': 'var(--accent-border)',
        ready: 'var(--ready)',
        'ready-fill': 'var(--ready-fill)',
        'ready-wash': 'var(--ready-wash)',
        warn: 'var(--warn)',
        'warn-fill': 'var(--warn-fill)',
        'warn-wash': 'var(--warn-wash)',
        danger: 'var(--danger)',
        'danger-fill': 'var(--danger-fill)',
        'danger-hover': 'var(--danger-hover)',
        'danger-wash': 'var(--danger-wash)',
        'danger-border': 'var(--danger-border)',
        info: 'var(--info)',
        queue: 'var(--queue)',
        'queue-wash': 'var(--queue-wash)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        float: 'var(--shadow-float)',
      },
      transitionDuration: {
        instant: 'var(--dur-instant)',
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        exit: 'var(--dur-exit)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
      },
      zIndex: {
        chrome: '10',
        drawer: '20',
        popover: '40',
        toast: '100',
        modal: '1000',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 2s var(--ease-out) infinite',
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('coarse', '@media (pointer: coarse)');
    }),
  ],
} satisfies Config;
