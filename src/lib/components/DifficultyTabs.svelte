<!--
	DifficultyTabs.svelte — onglets à difficulté croissante (4 niveaux).

	Pédagogie : chaque concept se présente en 4 angles, l'apprenant choisit
	où il se sent confortable et peut monter en difficulté à son rythme.

	  🌱 Niveau 1 — Express     : analogie courte, 30 secondes de lecture
	  🤝 Niveau 2 — Pédagogue   : explication longue par un ami brillant et patient
	  🛠️ Niveau 3 — Pratique    : ce que tu fais réellement, paramètres, code
	  🔬 Niveau 4 — Profond     : maths, formules, papiers, internals

	Le niveau "Pédagogue" est le cœur — il prend le temps, anticipe les
	confusions, multiplie les exemples, sans jargon mais sans simplification
	excessive. C'est le niveau le plus utile pour un débutant motivé.
-->
<script lang="ts">
	type Tab = 'intuitive' | 'friend' | 'practical' | 'deep';

	interface Props {
		title: string;
		tagline?: string;
		intuitive: import('svelte').Snippet;
		friend: import('svelte').Snippet;
		practical: import('svelte').Snippet;
		deep: import('svelte').Snippet;
		id?: string;
		/** Niveau ouvert par défaut. Par défaut 'friend' car c'est le plus pédagogique. */
		defaultTab?: Tab;
	}

	let {
		title,
		tagline,
		intuitive,
		friend,
		practical,
		deep,
		id,
		defaultTab = 'friend'
	}: Props = $props();

	let active = $state<Tab>(defaultTab);

	const TABS: { id: Tab; emoji: string; label: string; sub: string }[] = [
		{ id: 'intuitive', emoji: '🌱', label: 'Niveau 1', sub: 'Express' },
		{ id: 'friend', emoji: '🤝', label: 'Niveau 2', sub: 'Pédagogue' },
		{ id: 'practical', emoji: '🛠️', label: 'Niveau 3', sub: 'Pratique' },
		{ id: 'deep', emoji: '🔬', label: 'Niveau 4', sub: 'Profond' }
	];
</script>

<section {id} class="dt-card">
	<header class="dt-header">
		<h3 class="dt-title">{title}</h3>
		{#if tagline}
			<p class="dt-tagline">{tagline}</p>
		{/if}
	</header>

	<div class="dt-tabs" role="tablist" aria-label="Niveau de difficulté">
		{#each TABS as t (t.id)}
			<button
				type="button"
				role="tab"
				class="dt-tab {active === t.id ? 'is-active' : ''}"
				onclick={() => (active = t.id)}
				aria-selected={active === t.id}
			>
				<span class="dt-tab-emoji" aria-hidden="true">{t.emoji}</span>
				<span class="dt-tab-label">{t.label}</span>
				<span class="dt-tab-sub">{t.sub}</span>
			</button>
		{/each}
	</div>

	<div class="dt-content" role="tabpanel">
		{#if active === 'intuitive'}{@render intuitive()}{/if}
		{#if active === 'friend'}{@render friend()}{/if}
		{#if active === 'practical'}{@render practical()}{/if}
		{#if active === 'deep'}{@render deep()}{/if}
	</div>
</section>

<style>
	.dt-card {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.dt-header {
		padding: 1rem 1.25rem 0.75rem;
		border-bottom: 1px solid #f1f5f9;
	}
	.dt-title {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.dt-tagline {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--color-ink-500);
		font-style: italic;
	}
	.dt-tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-bottom: 1px solid #e2e8f0;
		background: #f8fafc;
	}
	.dt-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.05rem;
		padding: 0.65rem 0.3rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		color: var(--color-ink-500);
		transition: all 0.15s;
	}
	.dt-tab:hover {
		background: rgba(255, 157, 0, 0.05);
		color: var(--color-ink-700);
	}
	.dt-tab.is-active {
		background: #fff;
		color: var(--color-ink-900);
		border-bottom-color: var(--color-hf-amber);
		font-weight: 600;
	}
	.dt-tab-emoji {
		font-size: 1.05rem;
	}
	.dt-tab-label {
		font-size: 0.78rem;
	}
	.dt-tab-sub {
		font-size: 0.65rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}
	.dt-tab.is-active .dt-tab-sub {
		opacity: 1;
		color: var(--color-hf-amber);
	}
	.dt-content {
		padding: 1.25rem;
		font-size: 0.95rem;
		color: var(--color-ink-700);
		line-height: 1.65;
	}
	:global(.dt-content p) {
		margin: 0 0 0.85rem;
	}
	:global(.dt-content p:last-child) {
		margin-bottom: 0;
	}
	:global(.dt-content code) {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}
	/* Reset pour le code à l'intérieur d'un pre : pas de fond ni padding
	   (sinon chaque ligne du bloc reçoit une bande de fond → effet zébré) */
	:global(.dt-content pre code) {
		background: transparent;
		padding: 0;
		font-size: 1em;
		border-radius: 0;
	}
	:global(.dt-content pre) {
		background: #1a1a1a;
		color: #e2e8f0;
		padding: 0.85rem 1rem;
		border-radius: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		line-height: 1.6;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0.5rem 0;
	}
	:global(.dt-content strong) {
		color: var(--color-ink-900);
	}
	:global(.dt-content ul, .dt-content ol) {
		margin: 0 0 0.85rem;
		padding-left: 1.25rem;
	}
	:global(.dt-content li) {
		margin: 0.3rem 0;
	}
	:global(.dt-content h4) {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 1rem 0 0.4rem;
	}

	@media (max-width: 600px) {
		.dt-tabs {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
