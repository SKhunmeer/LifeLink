/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(214.3 31.8% 91.4%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 84% 4.9%)",
        primary: {
          DEFAULT: "#e11d48", // Rose/Crimson
          dark: "#be123c",
          light: "#ffe4e6",
        },
        navy: {
          DEFAULT: "#0f172a",
          800: "#1e293b",
          900: "#0a0f1d",
        },
        emerald: {
          DEFAULT: "#10b981",
          light: "#d1fae5",
        },
        amber: {
          DEFAULT: "#f59e0b",
          light: "#fef3c7",
        }
      },
    },
  },
  plugins: [],
}
