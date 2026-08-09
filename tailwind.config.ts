import type { Config } from 'tailwindcss';

// Design tokens live in app/tokens.css (CSS custom properties); this bridges
// them to Tailwind utilities. Keep the two in sync.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        tertiary: 'var(--tertiary)',
        'tone-1': 'var(--tone-1)',
        'tone-2': 'var(--tone-2)',
        'tone-3': 'var(--tone-3)',
        'tone-4': 'var(--tone-4)',
        'tone-5': 'var(--tone-5)',
        'bg-base': 'var(--bg-base)',
        'bg-elevated': 'var(--bg-elevated)',
        'text-hi': 'var(--text-hi)',
        'text-mid': 'var(--text-mid)',
        'text-low': 'var(--text-low)',
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-ui)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-8)',
        DEFAULT: 'var(--radius-12)',
        md: 'var(--radius-16)',
        lg: 'var(--radius-20)',
        xl: 'var(--radius-24)',
        '2xl': 'var(--radius-32)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
      },
    },
  },
  plugins: [],
} satisfies Config;
