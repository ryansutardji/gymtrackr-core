/** @type {import('tailwindcss').Config} */
// Colors mirror lib/theme.ts — keep the two in sync.
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#16191d',
        surface: '#1f2429',
        row: '#262b31',
        raised: '#2c3238',
        line: '#3a4148',
        text: '#e6e8ea',
        muted: '#8b939b',
        'dim-line': '#4a525a',
        sage: '#8fc4ab',
        'sage-pressed': '#7bb399',
        destructive: '#e8a29a',
      },
      fontFamily: {
        figtree: ['Figtree_400Regular'],
        'figtree-medium': ['Figtree_500Medium'],
        'figtree-semibold': ['Figtree_600SemiBold'],
        'figtree-bold': ['Figtree_700Bold'],
      },
    },
  },
  plugins: [],
};
