/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { arcane: { night: '#020617', card: '#1e1b4b', violet: '#8b5cf6', gold: '#fbbf24' } },
      fontFamily: { display: ['Cinzel', 'serif'], accent: ['MedievalSharp', 'cursive'], body: ['Quicksand', 'sans-serif'] },
    },
  },
  plugins: [],
}
