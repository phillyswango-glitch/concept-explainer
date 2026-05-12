<!--
	AttentionViz.svelte — Visualisation interactive d'une tête d'attention.
	=====================================================================
	Principe pédagogique :
	  - L'apprenant survole ou clique un token.
	  - Des arcs partent de ce token vers tous les autres, l'épaisseur et
	    l'opacité étant proportionnelles à l'attention que le token de
	    gauche "accorde" au token de droite.
	  - Un sélecteur permet de basculer entre deux têtes (syntaxique vs
	    sémantique) pour illustrer le multi-head.

	Implémentation :
	  - On dessine en SVG natif (pas besoin de D3 pour un graphe aussi petit).
	  - Les courbes sont des cubic Bezier calculées manuellement : c'est
	    pédagogique — on voit exactement comment on trace un arc.

	Alignement Mayer :
	  - Signaling : le token sélectionné est mis en évidence (fond jaune HF).
	  - Spatial Contiguity : légende directement sous la viz.
	  - Segmenting : l'apprenant contrôle — rien ne bouge tant qu'il n'agit pas.
-->
<script lang="ts">
	import { SAMPLE_HEADS, SAMPLE_TOKENS } from '$lib/data/attention-sample';

	// État local de la viz (runes Svelte 5).
	let selectedHeadId = $state(SAMPLE_HEADS[0].id);
	let hoveredTokenIdx = $state<number | null>(0); // on démarre avec le 1er token actif

	// Tête active dérivée du sélecteur.
	const activeHead = $derived(
		SAMPLE_HEADS.find((h) => h.id === selectedHeadId) ?? SAMPLE_HEADS[0]
	);

	// Indice du token dont on montre les arcs. Au repos = 0 (premier token).
	const sourceIdx = $derived(hoveredTokenIdx ?? 0);

	// Scores d'attention du token source vers tous les autres.
	const attentionScores = $derived(activeHead.matrix[sourceIdx] ?? []);

	// -----------------------------------------------------------------
	// Géométrie — coordonnées des tokens sur deux lignes horizontales.
	// Ligne du haut = "d'où part l'attention" (source, query).
	// Ligne du bas = "vers où va l'attention" (target, key).
	// -----------------------------------------------------------------
	const WIDTH = 720;
	const HEIGHT = 280;
	const PADDING_X = 60;
	const TOP_Y = 50;
	const BOTTOM_Y = 220;

	function tokenX(idx: number): number {
		const usable = WIDTH - 2 * PADDING_X;
		return PADDING_X + (idx * usable) / (SAMPLE_TOKENS.length - 1);
	}

	/**
	 * Construit le chemin SVG d'un arc entre deux tokens.
	 * On utilise une courbe de Bézier cubique : deux points de contrôle
	 * "tirent" la courbe vers le milieu, créant un arc élégant.
	 */
	function arcPath(fromIdx: number, toIdx: number): string {
		const x1 = tokenX(fromIdx);
		const y1 = TOP_Y + 8;
		const x2 = tokenX(toIdx);
		const y2 = BOTTOM_Y - 8;
		const midY = (y1 + y2) / 2;
		return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
	}
</script>

<figure class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
	<!-- Barre de contrôle : sélecteur de tête d'attention. -->
	<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
		<span class="text-ink-500 font-mono text-xs tracking-wider uppercase">Tête :</span>
		{#each SAMPLE_HEADS as head (head.id)}
			<button
				type="button"
				onclick={() => (selectedHeadId = head.id)}
				class="rounded-full border px-3 py-1.5 text-sm transition-all {selectedHeadId === head.id
					? 'bg-hf-yellow border-hf-amber text-ink-900 font-medium'
					: 'border-slate-200 bg-white text-ink-700 hover:border-hf-amber'}"
			>
				<span aria-hidden="true">{head.emoji}</span>
				{head.name}
			</button>
		{/each}
		<p class="text-ink-500 ml-auto text-xs italic">{activeHead.description}</p>
	</div>

	<!-- Zone SVG principale. -->
	<svg
		viewBox="0 0 {WIDTH} {HEIGHT}"
		class="h-auto w-full"
		role="img"
		aria-label="Graphe d'attention entre tokens"
	>
		<!-- Dégradé réutilisable pour les arcs. -->
		<defs>
			<linearGradient id="arc-gradient" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#FF9D00" />
				<stop offset="100%" stop-color="#FFD21E" />
			</linearGradient>
		</defs>

		<!-- Libellé de la ligne du haut. -->
		<text x={PADDING_X - 15} y={TOP_Y - 25} class="fill-slate-500 font-mono text-[11px]" text-anchor="end">
			Query
		</text>
		<text x={PADDING_X - 15} y={BOTTOM_Y + 30} class="fill-slate-500 font-mono text-[11px]" text-anchor="end">
			Key
		</text>

		<!-- Arcs depuis le token source vers tous les autres. -->
		{#each attentionScores as score, idx (idx)}
			{#if score > 0.03 && idx !== sourceIdx}
				<path
					d={arcPath(sourceIdx, idx)}
					stroke="url(#arc-gradient)"
					stroke-width={Math.max(1, score * 20)}
					fill="none"
					opacity={Math.min(1, score * 2)}
					stroke-linecap="round"
				/>
				<!-- Étiquette du score au milieu de l'arc. -->
				<text
					x={(tokenX(sourceIdx) + tokenX(idx)) / 2}
					y={(TOP_Y + BOTTOM_Y) / 2}
					class="fill-ink-700 font-mono text-[10px]"
					text-anchor="middle"
					opacity={score > 0.1 ? 1 : 0}
				>
					{score.toFixed(2)}
				</text>
			{/if}
		{/each}

		<!-- Tokens du haut (cliquables/survolables). -->
		{#each SAMPLE_TOKENS as token, idx (idx)}
			<g
				role="button"
				tabindex="0"
				aria-label="Token {token}, cliquer pour voir son attention"
				onmouseenter={() => (hoveredTokenIdx = idx)}
				onfocus={() => (hoveredTokenIdx = idx)}
				onclick={() => (hoveredTokenIdx = idx)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') hoveredTokenIdx = idx;
				}}
				style="cursor: pointer;"
			>
				<rect
					x={tokenX(idx) - 34}
					y={TOP_Y - 18}
					width={68}
					height={32}
					rx={8}
					fill={idx === sourceIdx ? '#FFD21E' : '#ffffff'}
					stroke={idx === sourceIdx ? '#FF9D00' : '#e2e8f0'}
					stroke-width={idx === sourceIdx ? 2 : 1}
				/>
				<text
					x={tokenX(idx)}
					y={TOP_Y + 3}
					text-anchor="middle"
					class="fill-ink-900 text-sm font-medium"
				>
					{token}
				</text>
			</g>
		{/each}

		<!-- Tokens du bas (cibles, non interactifs). -->
		{#each SAMPLE_TOKENS as token, idx (idx)}
			<g>
				<rect
					x={tokenX(idx) - 34}
					y={BOTTOM_Y - 14}
					width={68}
					height={32}
					rx={8}
					fill={idx === sourceIdx ? '#FFF9E6' : '#f8fafc'}
					stroke="#e2e8f0"
				/>
				<text
					x={tokenX(idx)}
					y={BOTTOM_Y + 7}
					text-anchor="middle"
					class="fill-ink-700 text-sm"
				>
					{token}
				</text>
			</g>
		{/each}
	</svg>

	<!-- Légende / aide à la lecture, juste sous la viz (Spatial Contiguity). -->
	<figcaption class="border-t border-slate-200 bg-slate-50 p-4 text-sm">
		<p class="text-ink-700">
			<strong>👆 Survole ou clique un token du haut.</strong> Les arcs montrent
			vers quels mots il « porte attention ». L'épaisseur de l'arc est proportionnelle
			au score d'attention (la somme vaut 1 par ligne — c'est un softmax).
		</p>
	</figcaption>
</figure>
