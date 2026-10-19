import { defineConfig } from 'vite';

export default defineConfig({
  // Enables relative asset paths so the build works out-of-the-box on GitHub Pages,
  // subpaths, Vercel, Netlify, Cloudflare Pages, or custom domains.
  base: './'
});
