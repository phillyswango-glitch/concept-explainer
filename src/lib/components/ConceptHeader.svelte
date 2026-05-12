<!--
	ConceptHeader.svelte
	--------------------
	En-tête de page de concept :
	- Emoji + titre + tagline (accroche en une phrase).
	- Lien vers le papier arXiv d'origine.
	- Table des matières des 6 niveaux de Bloom, cliquables en ancres.

	Principe Mayer "Pre-training" : en montrant d'emblée la structure complète,
	on donne à l'apprenant une carte mentale avant l'exploration.
-->
<script lang="ts">
	import type { Concept } from '$lib/data/concepts';
	import { BLOOM_LEVELS } from '$lib/design/bloom';

	interface Props {
		concept: Concept;
	}

	let { concept }: Props = $props();

	const arxivUrl = $derived(`https://arxiv.org/abs/${concept.paper.arxivId}`);
</script>

<header class="from-hf-cream mb-10 rounded-[1.25rem] bg-gradient-to-br to-white p-10">
	<!-- Bloc titre -->
	<div class="mb-6 flex items-start gap-5">
		<span class="text-6xl leading-none" aria-hidden="true">{concept.emoji}</span>
		<div class="flex-1">
			<h1 class="font-display text-ink-900 text-4xl font-bold tracking-tight md:text-5xl">
				{concept.title}
			</h1>
			<p class="text-ink-700 mt-2 text-lg">{concept.tagline}</p>
		</div>
	</div>

	<!-- Référence au papier -->
	<a
		href={arxivUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="text-ink-700 hover:text-hf-amber inline-flex items-center gap-2 text-sm underline decoration-dotted underline-offset-4 transition-colors"
	>
		📄 {concept.paper.authors}, <em>{concept.paper.title}</em>, {concept.paper.year}
		<span class="text-ink-500 font-mono text-xs">(arXiv:{concept.paper.arxivId})</span>
	</a>

	<!-- Table des matières : les 6 étapes de Bloom en chips cliquables.
	     Principe Pre-training + Signaling. -->
	<nav class="mt-8" aria-label="Parcours pédagogique de la page">
		<p class="text-ink-500 mb-3 font-mono text-xs tracking-wider uppercase">
			Parcours en 6 étapes
		</p>
		<ol class="flex flex-wrap gap-2">
			{#each BLOOM_LEVELS as level (level.id)}
				<li>
					<a
						href="#{level.id}"
						class="border-ink-100 hover:border-hf-amber inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-sm transition-colors"
						style="--accent: var(--color-{level.colorToken});"
					>
						<span class="text-ink-500 font-mono text-xs">{level.order}</span>
						<span aria-hidden="true">{level.emoji}</span>
						<span class="text-ink-700">{level.verb}</span>
					</a>
				</li>
			{/each}
		</ol>
	</nav>
</header>
