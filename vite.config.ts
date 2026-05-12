import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Tailwind v4 s'installe via un plugin Vite — plus de postcss.config.js nécessaire.
// Toute la configuration du design system vit directement dans src/app.css.
export default defineConfig({
	plugins: [tailwindcss(), sveltekit()]
});
