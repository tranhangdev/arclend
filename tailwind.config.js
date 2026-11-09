/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        ink: '#141311',
        panel: '#1b1a16',
        raised: '#23211c',
        line: '#2c2a24',
        cream: '#f3ede2',
        muted: '#8f8a7e',
        good: '#8fcf9b',
        bad: '#e58b7e',
      },
    },
  },
  plugins: [],
}
