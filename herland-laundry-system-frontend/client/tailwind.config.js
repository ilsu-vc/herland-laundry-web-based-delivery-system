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
        'herland-blue': '#3878c2',
        'herland-green': '#4bad40',
        'herland-gray': '#b4b4b4',
        'herland-red': '#ff0000',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ["light"],
    darkTheme: "light",
  },
}
