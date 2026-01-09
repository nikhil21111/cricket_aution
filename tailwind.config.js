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
        "primary": "#0db9f2",
        "primary-dark": "#0a9acb",
        "background-light": "#f5f8f8",
        "background-dark": "#101e22",
        "card-dark": "#16262c",
        "card-hover": "#1c2e35",
        "surface-dark": "#1b2427",
        "surface-darker": "#111618",
        "text-secondary": "#9cb2ba",
        "accent-green": "#22c55e",
        "accent-red": "#ef4444",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
