/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'electric-blue': '#0066FF',
        'deep-purple': '#8A2BE2',
        'soft-coral': '#FF7A59',
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', '"Meiryo"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
