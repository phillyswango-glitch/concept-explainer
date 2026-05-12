<!--
	PipelineArrow.svelte — Petite flèche verticale entre deux stages du pipeline.
-->
<script lang="ts">
	interface Props {
		/** Flèche plus petite pour les sous-étapes d'un bloc. */
		small?: boolean;
	}
	let { small = false }: Props = $props();
</script>

<div class="flex justify-center {small ? 'py-1' : 'py-2'}">
	<svg
		width={small ? 14 : 18}
		height={small ? 16 : 22}
		viewBox="0 0 18 22"
		aria-hidden="true"
	>
		<path
			d="M9 0 V18 M3 12 L9 20 L15 12"
			stroke="#cbd5e1"
			stroke-width="2"
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</div>
