<!--
	+page.svelte — Page d'accueil de l'application.
	Affiche les cartes de concepts de la phase 1, groupés par couche
	(architecture / capacité / agentique) pour donner immédiatement une
	carte mentale de l'écosystème (principe Pre-training de Mayer).
-->
<script lang="ts">
	import { CONCEPTS, type ConceptLayer } from '$lib/data/concepts';

	// Groupe les concepts par couche pédagogique.
	const phase1 = CONCEPTS.filter((c) => c.phase === 1);

	const LAYER_LABELS: Record<ConceptLayer, { title: string; subtitle: string; emoji: string }> = {
		architecture: {
			title: "Fondations d'architecture",
			subtitle: 'La brique technique sur laquelle tout repose.',
			emoji: '🏛️'
		},
		capability: {
			title: 'Capacités & alignement',
			subtitle: 'Comment on obtient un modèle utile et aligné.',
			emoji: '🎯'
		},
		agentic: {
			title: 'Systèmes agentiques',
			subtitle: 'Quand le modèle raisonne, agit, consulte.',
			emoji: '🤖'
		},
		training: {
			title: 'Entraînement & fine-tuning',
			subtitle: 'Apprends à entraîner et adapter un LLM toi-même.',
			emoji: '🎓'
		}
	};
</script>

<div class="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
	<!-- Accroche de la page d'accueil. -->
	<section class="mx-auto mb-16 max-w-3xl text-center">
		<span class="text-6xl" aria-hidden="true">✨</span>
		<h1 class="font-display text-ink-900 mt-6 text-5xl font-bold tracking-tight md:text-6xl">
			Les LLMs, <span class="text-hf-amber">démystifiés.</span>
		</h1>
		<p class="text-ink-700 mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
			Chaque concept-clé expliqué en 6 étapes progressives, avec un diagramme
			interactif et une analogie du quotidien. Conçu pour un apprenant motivé,
			pas pour un chercheur pressé.
		</p>
	</section>

	<!-- Grille des concepts, groupés par couche. -->
	<section class="space-y-12">
		{#each Object.entries(LAYER_LABELS) as [layerId, layer] (layerId)}
			{@const conceptsInLayer = phase1.filter((c) => c.layer === layerId)}
			{#if conceptsInLayer.length > 0}
				<div>
					<div class="mb-4 flex items-center gap-3">
						<span class="text-3xl" aria-hidden="true">{layer.emoji}</span>
						<div>
							<h2 class="font-display text-ink-900 text-2xl font-bold">{layer.title}</h2>
							<p class="text-ink-500 text-sm">{layer.subtitle}</p>
						</div>
					</div>
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each conceptsInLayer as concept (concept.slug)}
							<a
								href="/{concept.slug}"
								class="border-ink-100 hover:border-hf-amber hover:bg-hf-cream group relative rounded-[1.25rem] border bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(0_0_0_/_0.08)]"
							>
								<div class="mb-3 text-4xl" aria-hidden="true">{concept.emoji}</div>
								<h3 class="font-display text-ink-900 text-xl font-bold">{concept.title}</h3>
								<p class="text-ink-700 mt-2 text-sm leading-relaxed">{concept.tagline}</p>
								<p class="text-ink-500 mt-4 font-mono text-xs">
									{concept.paper.authors} · {concept.paper.year}
								</p>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</section>

	<!-- Bannière synthèse projet — montre comment les briques s'assemblent -->
	<section class="mx-auto mt-16 max-w-5xl">
		<a
			href="/projet-souverain"
			class="block overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-8 text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-2xl md:p-10"
		>
			<div class="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
				<div class="text-6xl" aria-hidden="true">🛰️</div>
				<div class="flex-1">
					<p class="font-mono text-xs uppercase tracking-widest text-amber-300">
						Synthèse · Architecture · Cas concrets
					</p>
					<h2 class="font-display mt-2 text-2xl font-bold md:text-3xl">
						Et maintenant, comment on assemble tout ça en projet réel ?
					</h2>
					<p class="mt-3 max-w-2xl text-base leading-relaxed text-slate-200">
						Regard critique sur les 11 technos vues, stack proposée pour
						un contexte <strong class="text-amber-200">Défense + Cyber + air-gap</strong>,
						architecture complète et 3 cas d'usage concrets (agent
						documentaire, triage SOC, rédaction CR multi-agent) — avec
						roadmap d'implémentation en 3 sprints.
					</p>
					<div class="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 font-mono text-sm font-semibold text-slate-900">
						Découvrir le projet COAS →
					</div>
				</div>
			</div>
		</a>
	</section>
</div>
