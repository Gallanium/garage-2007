/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Цветовая палитра из GDD для атмосферы 2000-х
        'garage-metal': '#6B6B6B',      // Металлический серый
        'garage-rust': '#D2691E',       // Ржавый оранжевый
        'garage-blue': '#003D7A',       // Тёмно-синий
        'garage-yellow': '#E6B800',     // Грязно-жёлтый
        'garage-brown': '#8B4513',      // Красно-коричневый
      },
      fontFamily: {
        // Press Start 2P — основной шрифт проекта (пиксельный, ретро)
        'sans': ['"Press Start 2P"', 'cursive'],
        'mono': ['"Press Start 2P"', 'cursive'],
        'pixel': ['"Press Start 2P"', 'cursive'],
      },
      fontSize: {
        'game-xs':   ['8px',  { lineHeight: '10px' }],
        'game-sm':   ['10px', { lineHeight: '12px' }],
        'game-base': ['12px', { lineHeight: '16px' }],
      },
    },
  },
  plugins: [],
}