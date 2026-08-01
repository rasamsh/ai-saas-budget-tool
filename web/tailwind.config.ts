import type { Config } from 'tailwindcss'
export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        income:  { DEFAULT: '#22c55e', dark: '#16a34a' },
        expense: { DEFAULT: '#ef4444' },
        invest:  { DEFAULT: '#3b82f6', dark: '#2563eb' },
        debt:    { DEFAULT: '#f59e0b' },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          foreground: 'var(--accent-foreground)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        pixel:   ['var(--font-pixel)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem', card: 'var(--radius-card)' },
    }
  },
  plugins: [],
} satisfies Config
