import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// cms2.bizarch-design.com/editor/ にデプロイ想定
// dist/ をそのまま editor/ ディレクトリにアップロードする
export default defineConfig({
  site: 'https://cms2.bizarch-design.com',
  base: '/editor',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    react(),
    tailwind({
      // 既存サイトと衝突しないように applyBaseStyles をfalseにし、独自global.cssで管理
      applyBaseStyles: false,
    }),
  ],
});
