/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#8b5cf6", // Violet 500
        "primary-dark": "#7c3aed", // Violet 600
        "background-light": "#f8fafc", // Slate 50
        "background-dark": "#080c14", // Deep midnight black
        "card-dark": "rgba(15, 23, 42, 0.65)", // Frosted glass card
        "card-hover": "rgba(30, 41, 59, 0.8)", // Glass hover card
        "surface-dark": "rgba(30, 41, 59, 0.65)",
        "surface-darker": "#080c14",
        "text-secondary": "#94a3b8", // Slate 400
        "accent-green": "#10b981", // Emerald 500 (Neon Green)
        "accent-red": "#ef4444", // Red 500 (Neon Red)
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
