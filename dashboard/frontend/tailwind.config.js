/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        anthropic: {
          cream: '#faf9f0',
          'cream-dark': '#f5f4eb',
          orange: '#d97757',
          'orange-hover': '#c4664a',
          'orange-light': '#e89a7f',
          charcoal: '#1a1a1a',
          'charcoal-light': '#2d2d2d',
          slate: '#4a4a4a',
          'slate-light': '#6b6b6b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
