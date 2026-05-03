/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // bizarch-design ブランドカラー
        'electric-blue': '#0066FF',
        'deep-purple': '#8A2BE2',
        'soft-coral': '#FF7A59',
        // エディタUI用補助カラー
        'editor-bg': '#0F1115',
        'editor-panel': '#181B22',
        'editor-border': '#2A2F3A',
        'editor-text': '#E6E8EE',
        'editor-muted': '#8B92A1',
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 8px 24px rgba(0, 102, 255, 0.18)',
        'brand-coral': '0 8px 24px rgba(255, 122, 89, 0.22)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
