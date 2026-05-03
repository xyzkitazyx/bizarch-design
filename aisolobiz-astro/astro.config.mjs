import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://aisolobiz.bizarch-design.com',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    tailwind({
      // 既存 common.css と衝突しないよう、Tailwind の base reset は無効化
      applyBaseStyles: false,
    }),
  ],
  build: {
    // dist/ に直接 .html を出力（aisolobiz/index.html 互換のフラット構成）
    format: 'file',
  },
});
