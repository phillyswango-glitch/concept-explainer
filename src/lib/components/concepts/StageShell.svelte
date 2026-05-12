<!--
	StageShell.svelte
	-----------------
	Enveloppe visuelle d'UNE étape du pipeline Transformer.
	Header cliquable (emoji + titre + shapes in/out) + corps collapsible.

	Design inspiré du Transformer Explainer (Poloclub, §2 "Reducing Complexity
	via Multi-Level Abstractions") : par défaut l'apprenant voit la structure,
	un clic déplie les détails mathématiques.
-->
<script lang="ts">
	interface Props {
		/** Identifiant unique pour aria-controls. */
		id: string;
		/** Emoji affiché en grand à gauche. */
		emoji: string;
		/** Titre de l'étape. */
		title: string;
		/** Forme du tenseur d'entrée — affichée en monospace. */
		shapeIn: string;
		/** Forme du tenseur de sortie. */
		shapeOut: string;
		/** L'étape est-elle dépliée ? */
		isOpen: boolean;
		/** Callback au clic sur le header. */
		onToggle: () => void;
		/** Mode compact : sous-étape à l'intérieur d'un bloc parent. */
		compact?: boolean;
		/** Contenu du corps (formules, explications, mini-viz). */
		children: import('svelte').Snippet;
	}

	let {
		id,
		emoji,
		title,
		shapeIn,
		shapeOut,
		isOpen,
		onToggle,
		compact = false,
		children
	}: Props = $props();
</script>

<section
	class="overflow-hidden rounded-2xl border bg-white transition-all {isOpen
		? 'border-hf-amber shadow-[0_4px_16px_rgb(0_0_0_/_0.06)]'
		: 'border-slate-200'}"
>
	<button
		type="button"
		onclick={onToggle}
		class="hover:bg-hf-cream/50 flex w-full items-center gap-3 px-5 text-left {compact
			? 'py-3'
			: 'py-4'}"
		aria-expanded={isOpen}
		aria-controls="stage-body-{id}"
	>
		<span class="leading-none {compact ? 'text-2xl' : 'text-3xl'}" aria-hidden="true">
			{emoji}
		</span>
		<div class="flex-1">
			<div
				class="font-display text-ink-900 font-semibold {compact ? 'text-base' : 'text-lg'}"
			>
				{title}
			</div>
			<div class="text-ink-500 mt-0.5 font-mono text-xs">
				{shapeIn} <span aria-hidden="true">→</span> {shapeOut}
			</div>
		</div>
		<span class="text-ink-500 text-sm" aria-hidden="true">
			{isOpen ? '▼' : '▶'}
		</span>
	</button>

	{#if isOpen}
		<div
			id="stage-body-{id}"
			class="border-t border-slate-100 bg-slate-50/40 px-5 py-4"
		>
			{@render children()}
		</div>
	{/if}
</section>
