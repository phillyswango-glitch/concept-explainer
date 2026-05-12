<!--
	MathToggle.svelte
	-----------------
	Petit accordéon pour cacher les équations par défaut. Philosophie :
	l'apprenant joue d'abord avec le widget, puis déplie les maths quand
	il veut creuser. (Progressive disclosure, principe Mayer Segmenting.)
-->
<script lang="ts">
	interface Props {
		/** Label du bouton. Par défaut : "Voir les maths". */
		label?: string;
		children: import('svelte').Snippet;
	}

	let { label = 'Voir les maths', children }: Props = $props();
	let open = $state(false);
</script>

<div class="my-3">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="border-ink-100 hover:border-hf-amber text-ink-700 hover:text-ink-900 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium transition-colors"
		aria-expanded={open}
	>
		<span aria-hidden="true">🧮</span>
		{label}
		<span class="text-ink-500" aria-hidden="true">{open ? '▼' : '▶'}</span>
	</button>
	{#if open}
		<div class="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
			{@render children()}
		</div>
	{/if}
</div>
