// Mode SPA pur : aucune génération SSR ni prérender.
// Toutes les pages sont rendues côté client après chargement de index.html.
// Permet d'héberger sur n'importe quel CDN statique (Netlify, Cloudflare Pages,
// GitHub Pages, S3) sans runtime serveur.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
