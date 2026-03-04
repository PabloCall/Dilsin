/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Adicione isso aqui para "forçar" as cores no CSS final
  safelist: [
    'border-blue-500',
    'border-green-500',
    'border-yellow-500',
  ],
  theme: {
    extend: {
      // ...
    },
  },
  plugins: [],
}