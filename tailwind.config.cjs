        // tailwind.config.cjs
        /** @type {import('tailwindcss').Config} */
        module.exports = { // <-- Mude "export default" para "module.exports ="
          content: [
            "./index.html",
            "./src/**/*.{js,ts,jsx,tsx}",
          ],
          theme: {
            extend: {},
          },
          plugins: [],
        }
