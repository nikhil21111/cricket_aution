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
        "primary": "#e11d48", // Editorial Crimson
        "primary-dark": "#be123c",
        "background-light": "#ffffff",
        "background-dark": "#0f172a", // Editorial Ink
        "card-dark": "#1e293b",
        "card-light": "#f8fafc",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-secondary-dark": "#94a3b8",
        "accent-cobalt": "#2563eb",
        "accent-green": "#10b981", // Pitch Green
        "accent-red": "#ef4444",
        "accent-amber": "#f59e0b",
      },
      fontFamily: {
        "display": ["Outfit", "sans-serif"],
        "body": ["Source Sans 3", "sans-serif"],
        "mono": ["Geist Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: '0px',
        'sm': '0px',
        'md': '0px',
        'lg': '0px',
        'xl': '0px',
        '2xl': '0px',
        '3xl': '0px',
        'full': '9999px',
      },
    },
  },
  plugins: [],
}
