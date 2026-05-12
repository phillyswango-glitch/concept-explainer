import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Static adapter + SPA fallback : produit un dossier `build/` qui contient
		// index.html + tous les assets. Le fallback fait que toutes les routes
		// inconnues côté serveur tombent sur index.html et le routing client prend
		// le relais. Parfait pour un site de contenu purement client-side sur Netlify.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		})
	}
};

export default config;
