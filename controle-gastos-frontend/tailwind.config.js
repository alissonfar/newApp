/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Inclui todos os arquivos JS/JSX/TS/TSX dentro de src
    "./public/index.html"      // Inclui o HTML principal, se necessário
  ],
  important: true, // Força todas as classes Tailwind a usar !important
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: true, // Garante que o preflight do Tailwind será usado
  }
} 