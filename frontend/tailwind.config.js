/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enables class-based dark mode
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}', // Adjust this to match your source folder
  ],
  theme: {
    extend: {}, // Add custom theme settings here if needed
  },
  plugins: [], // Add Tailwind plugins here if needed
}
