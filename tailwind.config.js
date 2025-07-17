/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./shiftly-frontend/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './shiftly-frontend/**/*.{js,jsx,ts,tsx}', './public/index.html'],

  plugins: [],
};
