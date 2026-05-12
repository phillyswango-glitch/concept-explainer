<!--
	+layout.svelte — Enveloppe globale de toutes les pages.
	Importe la feuille de style (tokens + Tailwind + KaTeX) et
	affiche une barre de navigation minimaliste.
-->
<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Concept Explainer — Les LLMs démystifiés</title>
</svelte:head>

<!-- Barre de navigation persistante, légère, non intrusive. -->
<nav class="border-ink-100 sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md">
	<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
		<a href="/" class="flex items-center gap-2 font-semibold">
			<span class="text-2xl" aria-hidden="true">✨</span>
			<span class="font-display text-ink-900 text-lg">Concept Explainer</span>
		</a>
		<div class="text-ink-500 font-mono text-xs">Phase 1 · 3 concepts</div>
	</div>
</nav>

<main>
	{@render children()}
</main>

<footer class="border-ink-100 mt-24 border-t py-10">
	<div class="mx-auto max-w-6xl px-4 text-center md:px-8">
		<p class="text-ink-500 text-sm">
			Construit avec SvelteKit · Pédagogie Bloom × Mayer · Inspiré de
			<a
				href="https://poloclub.github.io/transformer-explainer/"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-hf-amber underline decoration-dotted underline-offset-4"
				>Poloclub Transformer Explainer</a
			>
		</p>
	</div>
</footer>
