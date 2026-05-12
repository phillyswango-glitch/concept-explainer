<!--
	Callout.svelte — Encart pédagogique pour insights, pièges ou notes.
	Quatre variantes, chacune avec sa couleur et son emoji par défaut.
-->
<script lang="ts">
	type Variant = 'info' | 'insight' | 'warning' | 'note';

	interface Props {
		variant?: Variant;
		/** Titre court affiché en gras. */
		title?: string;
		children: import('svelte').Snippet;
	}

	let { variant = 'info', title, children }: Props = $props();

	const STYLE: Record<Variant, { emoji: string; bg: string; border: string }> = {
		info: { emoji: '💡', bg: 'bg-blue-50', border: 'border-blue-300' },
		insight: { emoji: '✨', bg: 'bg-hf-cream', border: 'border-hf-amber' },
		warning: { emoji: '⚠️', bg: 'bg-amber-50', border: 'border-amber-400' },
		note: { emoji: '📝', bg: 'bg-slate-50', border: 'border-slate-300' }
	};

	const style = $derived(STYLE[variant]);
</script>

<aside class="my-6 rounded-xl border-l-4 {style.bg} {style.border} p-5" role="note">
	<div class="flex gap-3">
		<span class="text-2xl leading-none" aria-hidden="true">{style.emoji}</span>
		<div class="flex-1">
			{#if title}
				<p class="text-ink-900 mb-1 font-semibold">{title}</p>
			{/if}
			<div class="text-ink-700 text-sm leading-relaxed">
				{@render children()}
			</div>
		</div>
	</div>
</aside>
