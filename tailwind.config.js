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
        "primary": "#8b5cf6", // Violet 500 - Vibrant and modern
        "primary-dark": "#7c3aed", // Violet 600
        "background-light": "#f8fafc", // Slate 50
        "background-dark": "#020617", // Slate 950 - Deep rich dark
        "card-dark": "#0f172a", // Slate 900
        "card-hover": "#1e293b", // Slate 800
        "surface-dark": "#1e293b", // Slate 800
        "surface-darker": "#020617", // Slate 950
        "text-secondary": "#94a3b8", // Slate 400
        "accent-green": "#10b981", // Emerald 500
        "accent-red": "#ef4444", // Red 500
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
