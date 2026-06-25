/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#dbfcff",
        "primary-container": "#00f0ff",
        "on-primary-container": "#00363a",
        surface: "#0a141d",
        "surface-dim": "#0a141d",
        "surface-container-lowest": "#060f17",
        "surface-container-low": "#131d25",
        "surface-container": "#172129",
        "surface-container-high": "#212b34",
        "surface-container-highest": "#2c363f",
        "on-surface": "#dae3f0",
        "on-surface-variant": "#b9cacb",
        outline: "#849495",
        "outline-variant": "#3b494b",
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
