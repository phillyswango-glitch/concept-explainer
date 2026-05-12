<!--
	BloomSection.svelte
	-------------------
	Bloc sémantique correspondant à UN niveau de Bloom sur une page de concept.

	Usage :
		<BloomSection level="remember">
			<p>Contenu du niveau Retenir…</p>
		</BloomSection>

	Choix de design (alignés sur Mayer) :
	- Un ruban de couleur à gauche + un emoji grand format à droite
	  = double signal (couleur + icône) pour encoder le niveau cognitif
	  (principe Signaling).
	- Le titre et le verbe sont côte à côte, pas empilés
	  (principe Spatial Contiguity).
	- Le contenu passé via children est placé immédiatement sous l'en-tête,
	  sans décoration superflue (principe Coherence : zéro bruit visuel).
-->
<script lang="ts">
	import { BLOOM_BY_ID, type BloomLevelId } from '$lib/design/bloom';

	interface Props {
		/** Identifiant du niveau de Bloom (remember, understand, …). */
		level: BloomLevelId;
		/** Contenu rendu dans la section. */
		children: import('svelte').Snippet;
	}

	let { level, children }: Props = $props();

	// On récupère la métadonnée du niveau (emoji, titre, couleur…).
	const meta = $derived(BLOOM_BY_ID[level]);
</script>

<section
	id={meta.id}
	class="bloom-section group relative scroll-mt-20 rounded-[1.25rem] bg-white p-8 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_8px_24px_rgb(0_0_0_/_0.06)] transition-shadow hover:shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_12px_32px_rgb(0_0_0_/_0.08)]"
	aria-labelledby="{meta.id}-title"
>
	<!-- Ruban de couleur vertical à gauche — signal cognitif constant. -->
	<div
		class="absolute top-0 left-0 h-full w-1.5 rounded-l-[1.25rem]"
		style="background-color: var(--color-{meta.colorToken});"
		aria-hidden="true"
	></div>

	<!-- En-tête : emoji + numéro + titre + verbe Bloom. -->
	<header class="mb-4 flex items-center gap-4">
		<span class="text-4xl leading-none" aria-hidden="true">{meta.emoji}</span>
		<div>
			<p class="text-ink-500 font-mono text-xs tracking-wider uppercase">
				Étape {meta.order} · {meta.verb}
			</p>
			<h2
				id="{meta.id}-title"
				class="font-display text-ink-900 text-2xl font-bold tracking-tight"
			>
				{meta.title}
			</h2>
		</div>
	</header>

	<!-- Contenu libre, fourni par la page consommatrice.
	     La classe "prose" applique une typographie de lecture confortable. -->
	<div class="prose prose-slate max-w-none">
		{@render children()}
	</div>
</section>

<style>
	/* Animation subtile à l'apparition — 200ms, single shot, pas d'autoplay bruyant. */
	.bloom-section {
		animation: fade-in 0.3s ease-out;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
