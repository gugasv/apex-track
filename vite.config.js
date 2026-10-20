import { defineConfig } from 'vite';

// Content-Security-Policy for the static build. GitHub Pages can't send headers, so it ships as a
// <meta> tag. It is applied to builds only: the dev server needs inline scripts and a HMR websocket.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // Leaflet and the waypoint popups set inline style attributes
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Map tiles, Leaflet's default marker icons, and Vite-inlined assets
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.tile.opentopomap.org " +
    'https://server.arcgisonline.com https://*.basemaps.cartocdn.com ' +
    'https://*.tile-cyclosm.openstreetmap.fr https://unpkg.com',
  // OSRM street snapping
  "connect-src 'self' https://routing.openstreetmap.de",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

function contentSecurityPolicy() {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend'
        }
      ];
    }
  };
}

export default defineConfig({
  // Enables relative asset paths so the build works out-of-the-box on GitHub Pages,
  // subpaths, Vercel, Netlify, Cloudflare Pages, or custom domains.
  base: './',
  plugins: [contentSecurityPolicy()]
});
