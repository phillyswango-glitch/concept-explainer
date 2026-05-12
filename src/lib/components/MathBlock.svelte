<!--
	MathBlock.svelte — Rendu d'équations LaTeX via KaTeX.
	Deux modes : "inline" (dans une phrase) et "display" (bloc centré).
-->
<script lang="ts">
	import katex from 'katex';

	interface Props {
		/** Code LaTeX à rendre. */
		tex: string;
		/** Mode d'affichage — block par défaut. */
		display?: boolean;
	}

	let { tex, display = true }: Props = $props();

	const html = $derived(
		katex.renderToString(tex, {
			displayMode: display,
			throwOnError: false,
			output: 'html',
			strict: 'ignore'
		})
	);
</script>

{#if display}
	<div class="my-4 overflow-x-auto text-center">
		{@html html}
	</div>
{:else}
	<span>{@html html}</span>
{/if}
