<!--
	ConceptPage.svelte
	------------------
	Template de haut niveau utilisé par CHAQUE page de concept.
	Il compose :
	  1. <ConceptHeader>  (titre, tagline, papier, table des matières)
	  2. Un slot pour les 6 <BloomSection> passés par la page enfant
	  3. Un footer "Concepts liés" pour la navigation latérale

	Utilisation typique (dans /routes/transformer/+page.svelte) :

		<ConceptPage concept={CONCEPT_BY_SLUG.transformer}>
			<BloomSection level="remember"> … </BloomSection>
			<BloomSection level="understand"> … </BloomSection>
			… etc pour les 6 niveaux …
		</ConceptPage>
-->
<script lang="ts">
	import { CONCEPT_BY_SLUG, type Concept } from '$lib/data/concepts';
	import ConceptHeader from './ConceptHeader.svelte';

	interface Props {
		concept: Concept;
		children: import('svelte').Snippet;
	}

	let { concept, children }: Props = $props();

	// Hydrate les concepts liés (prérequis) pour le footer de navigation.
	const relatedConcepts = $derived(
		concept.prerequisites
			.map((slug) => CONCEPT_BY_SLUG[slug])
			.filter((c): c is Concept => c !== undefined)
	);
</script>

<article class="mx-auto max-w-4xl px-4 py-10 md:px-8">
	<ConceptHeader {concept} />

	<!-- Les 6 BloomSection sont passées ici, dans l'ordre.
	     Espacement généreux entre sections = principe Segmenting :
	     chaque bloc se distingue nettement du suivant. -->
	<div class="space-y-8">
		{@render children()}
	</div>

	<!-- Navigation vers les concepts liés. -->
	{#if relatedConcepts.length > 0}
		<footer class="border-ink-100 mt-16 border-t pt-8">
			<p class="text-ink-500 mb-4 font-mono text-xs tracking-wider uppercase">
				🔗 Concepts liés
			</p>
			<ul class="flex flex-wrap gap-3">
				{#each relatedConcepts as related (related.slug)}
					<li>
						<a
							href="/{related.slug}"
							class="border-ink-100 hover:border-hf-amber hover:bg-hf-cream inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 transition-all"
						>
							<span class="text-2xl" aria-hidden="true">{related.emoji}</span>
							<div>
								<div class="text-ink-900 font-medium">{related.title}</div>
								<div class="text-ink-500 text-xs">{related.paper.authors}, {related.paper.year}</div>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</footer>
	{/if}
</article>
