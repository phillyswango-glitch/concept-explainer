<!--
	TransformerPipeline.svelte — parcours narratif pas-à-pas
	========================================================
	Une histoire en 9 écrans. Règle d'or : une idée par écran, une
	analogie prominente, une manipulation, et les détails techniques
	cachés derrière un bouton "🔍 Pour aller plus loin".

	Cible : débutant motivé. Ton : comme si on lui parlait face à face.
	Pas de jargon dans le corps — le jargon vit dans les deep-dives.
-->
<script lang="ts">
	import MathBlock from '$lib/components/MathBlock.svelte';

	// ---------- Étapes (source unique) ----------
	const STEPS = [
		{ id: 'intro', emoji: '👋', title: 'Une question simple' },
		{ id: 'tokenize', emoji: '✂️', title: 'On coupe la phrase en morceaux' },
		{ id: 'embed', emoji: '🔢', title: 'Chaque morceau devient des chiffres' },
		{ id: 'position', emoji: '📍', title: 'On ajoute la position' },
		{ id: 'attention', emoji: '🎯', title: 'Chaque mot regarde les autres' },
		{ id: 'refine', emoji: '🔨', title: 'Chaque mot se met à jour' },
		{ id: 'repeat', emoji: '🔁', title: 'On recommence 12 fois' },
		{ id: 'predict', emoji: '🎰', title: 'On devine le mot suivant' },
		{ id: 'sample', emoji: '🌡️', title: 'Créativité : la température' }
	] as const;

	// ---------- État ----------
	let step = $state(0);
	let prompt = $state('Le chat dort sur le');
	let selectedTokenIdx = $state(1);
	let positionSlider = $state(3);
	let attentionFromIdx = $state(3); // token source de l'attention (on démarre sur "dort")
	let temperature = $state(0.7);
	let showDeepDive = $state(false);

	// Reset le deep-dive à chaque changement d'étape (principe Segmenting)
	$effect(() => {
		step;
		showDeepDive = false;
	});

	// ---------- Données dérivées ----------
	const tokens = $derived.by(() => {
		const words = prompt.trim().split(/\s+/).filter(Boolean);
		return words.map((w, i) => ({ text: i === 0 ? w : ' ' + w }));
	});

	$effect(() => {
		if (selectedTokenIdx >= tokens.length) selectedTokenIdx = 0;
		if (positionSlider >= tokens.length) positionSlider = Math.max(0, tokens.length - 1);
		if (attentionFromIdx >= tokens.length) attentionFromIdx = 0;
	});

	function fakeVector(text: string, dims = 20): number[] {
		const seed = text.charCodeAt(0) + text.length * 17;
		return Array.from({ length: dims }, (_, i) =>
			Math.sin(seed * 0.31 + i * 0.73) * Math.cos(i * 0.19 + seed * 0.07)
		);
	}
	const selectedVector = $derived(
		tokens[selectedTokenIdx] ? fakeVector(tokens[selectedTokenIdx].text.trim()) : []
	);

	function positionalVec(pos: number, dims = 20): number[] {
		return Array.from({ length: dims }, (_, i) =>
			i % 2 === 0 ? Math.sin(pos / Math.pow(10000, i / 768)) : Math.cos(pos / Math.pow(10000, (i - 1) / 768))
		);
	}
	const peVec = $derived(positionalVec(positionSlider));

	// =================================================================
	// Matrice d'attention générée dynamiquement depuis le prompt
	// -----------------------------------------------------------------
	// Ce n'est pas une vraie attention (il faudrait faire tourner le modèle).
	// C'est une approximation pédagogique avec 3 règles simples :
	//   - chaque token écoute un peu lui-même (self-attention)
	//   - il écoute surtout son voisin de gauche (syntaxe bigramme)
	//   - il a un "partenaire sémantique" déterministe (hash de son texte)
	// =================================================================
	function buildAttentionMatrix(toks: { text: string }[]): number[][] {
		const n = toks.length;
		if (n === 0) return [];
		const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
		for (let i = 0; i < n; i++) {
			const row = m[i];
			row[i] = 0.15; // attention sur soi
			if (i > 0) row[i - 1] = 0.35; // voisin de gauche
			if (i > 1) row[0] = 0.05; // premier token (souvent l'article)
			// Partenaire sémantique déterministe : hash du token → autre position
			if (n > 2) {
				const t = toks[i].text.trim().toLowerCase();
				const seed = t.charCodeAt(0) + t.length * 3;
				for (let k = 1; k < n; k++) {
					const j = (i + seed + k) % n;
					if (j !== i && row[j] === 0) {
						row[j] = 0.3;
						break;
					}
				}
			}
			// Répartir le reste uniformément sur les positions encore à 0
			let sum = row.reduce((a, b) => a + b, 0);
			const unfilled = row.filter((v) => v === 0).length;
			if (unfilled > 0 && sum < 1) {
				const each = (1 - sum) / unfilled;
				for (let j = 0; j < n; j++) if (row[j] === 0) row[j] = each;
			}
			// Normalisation finale (somme = 1)
			sum = row.reduce((a, b) => a + b, 0);
			if (sum > 0) for (let j = 0; j < n; j++) row[j] /= sum;
		}
		return m;
	}

	const attentionMatrix = $derived(buildAttentionMatrix(tokens));

	// =================================================================
	// Prédictions dynamiques basées sur le dernier mot du prompt
	// -----------------------------------------------------------------
	// Petit dictionnaire français : si le prompt se termine par un mot
	// connu, on affiche des complétions plausibles. Sinon, fallback.
	// =================================================================
	const COMMON_COMPLETIONS: Record<string, { token: string; logit: number }[]> = {
		le: [
			{ token: 'tapis', logit: 8.2 },
			{ token: 'canapé', logit: 7.1 },
			{ token: 'lit', logit: 6.4 },
			{ token: 'sol', logit: 5.9 },
			{ token: 'coussin', logit: 4.8 }
		],
		la: [
			{ token: 'maison', logit: 7.9 },
			{ token: 'table', logit: 7.2 },
			{ token: 'porte', logit: 6.5 },
			{ token: 'nuit', logit: 6.0 },
			{ token: 'ville', logit: 5.4 }
		],
		les: [
			{ token: 'enfants', logit: 7.4 },
			{ token: 'gens', logit: 7.0 },
			{ token: 'mots', logit: 6.3 },
			{ token: 'jours', logit: 5.9 },
			{ token: 'choses', logit: 5.2 }
		],
		un: [
			{ token: 'chien', logit: 7.6 },
			{ token: 'homme', logit: 7.2 },
			{ token: 'livre', logit: 6.8 },
			{ token: 'ami', logit: 6.1 },
			{ token: 'moment', logit: 5.4 }
		],
		une: [
			{ token: 'fleur', logit: 7.3 },
			{ token: 'femme', logit: 7.0 },
			{ token: 'heure', logit: 6.5 },
			{ token: 'idée', logit: 6.0 },
			{ token: 'chance', logit: 5.3 }
		],
		des: [
			{ token: 'gens', logit: 7.2 },
			{ token: 'années', logit: 6.8 },
			{ token: 'fois', logit: 6.3 },
			{ token: 'choses', logit: 5.9 },
			{ token: 'heures', logit: 5.4 }
		],
		dans: [
			{ token: 'la', logit: 8.0 },
			{ token: 'le', logit: 7.7 },
			{ token: 'les', logit: 6.9 },
			{ token: 'un', logit: 6.1 },
			{ token: 'ce', logit: 5.5 }
		],
		sur: [
			{ token: 'le', logit: 8.1 },
			{ token: 'la', logit: 7.7 },
			{ token: 'les', logit: 6.8 },
			{ token: 'un', logit: 6.0 },
			{ token: 'cette', logit: 5.2 }
		],
		est: [
			{ token: 'un', logit: 7.5 },
			{ token: 'une', logit: 7.2 },
			{ token: 'le', logit: 6.6 },
			{ token: 'très', logit: 6.0 },
			{ token: 'là', logit: 5.5 }
		],
		avec: [
			{ token: 'un', logit: 7.6 },
			{ token: 'une', logit: 7.2 },
			{ token: 'lui', logit: 6.4 },
			{ token: 'elle', logit: 6.0 },
			{ token: 'moi', logit: 5.5 }
		],
		pour: [
			{ token: 'la', logit: 7.7 },
			{ token: 'le', logit: 7.3 },
			{ token: 'les', logit: 6.6 },
			{ token: 'que', logit: 6.1 },
			{ token: 'toi', logit: 5.4 }
		],
		je: [
			{ token: 'suis', logit: 7.9 },
			{ token: 'pense', logit: 7.2 },
			{ token: 'vais', logit: 6.7 },
			{ token: 'ne', logit: 6.1 },
			{ token: 'veux', logit: 5.5 }
		]
	};

	const DEFAULT_CANDIDATES: { token: string; logit: number }[] = [
		{ token: 'et', logit: 6.0 },
		{ token: 'dans', logit: 5.6 },
		{ token: 'avec', logit: 5.3 },
		{ token: 'mais', logit: 5.0 },
		{ token: 'pour', logit: 4.7 }
	];

	const rawLogits = $derived.by(() => {
		const lastWord = prompt.trim().toLowerCase().split(/\s+/).pop() ?? '';
		return COMMON_COMPLETIONS[lastWord] ?? DEFAULT_CANDIDATES;
	});

	/** Le dernier mot de ton prompt a-t-il été reconnu par notre mini-dico ? */
	const predictionIsKnown = $derived.by(() => {
		const lastWord = prompt.trim().toLowerCase().split(/\s+/).pop() ?? '';
		return lastWord in COMMON_COMPLETIONS;
	});

	const probabilities = $derived.by(() => {
		const T = Math.max(0.05, temperature);
		const scaled = rawLogits.map((l) => l.logit / T);
		const max = Math.max(...scaled);
		const exps = scaled.map((s) => Math.exp(s - max));
		const sum = exps.reduce((a, b) => a + b, 0);
		return rawLogits.map((l, i) => ({ token: l.token, p: exps[i] / sum }));
	});
	const topPrediction = $derived(
		[...probabilities].sort((a, b) => b.p - a.p)[0]?.token ?? '?'
	);
	let sampled = $state<string | null>(null);
	function doSample() {
		const r = Math.random();
		let cum = 0;
		for (const p of probabilities) {
			cum += p.p;
			if (r <= cum) {
				sampled = p.token;
				return;
			}
		}
		sampled = probabilities.at(-1)!.token;
	}

	// ---------- Navigation ----------
	function prev() {
		step = Math.max(0, step - 1);
	}
	function next() {
		step = Math.min(STEPS.length - 1, step + 1);
	}
</script>

<div class="tour">
	<!-- ---------- Prompt (toujours visible) ---------- -->
	<div class="tour-prompt">
		<label for="tour-prompt" class="tour-prompt-label">📝 Ton prompt</label>
		<input
			id="tour-prompt"
			type="text"
			bind:value={prompt}
			class="tour-prompt-input"
			placeholder="Tape une phrase…"
		/>
	</div>

	<!-- ---------- Barre de progression ---------- -->
	<div class="tour-progress">
		<div class="tour-progress-info">
			<span class="tour-step-num">Étape {step + 1} / {STEPS.length}</span>
			<span class="tour-step-title">{STEPS[step].emoji} {STEPS[step].title}</span>
		</div>
		<div class="tour-progress-dots" role="tablist">
			{#each STEPS as s, i (s.id)}
				<button
					type="button"
					role="tab"
					class="tour-dot {i === step ? 'is-active' : ''} {i < step ? 'is-done' : ''}"
					onclick={() => (step = i)}
					aria-label="Aller à l'étape {i + 1} : {s.title}"
				></button>
			{/each}
		</div>
	</div>

	<!-- ================== CONTENU DE L'ÉTAPE ================== -->
	<article class="tour-card" aria-live="polite">
		{#if step === 0}
			<!-- ÉTAPE 0 : INTRO -->
			<h2 class="tour-h2">Que fait un Transformer ?</h2>
			<p class="tour-lead">
				Quand tu tapes un début de phrase, un Transformer essaie de
				<strong>deviner le mot suivant</strong>. Simple comme ça.
			</p>

			<div class="tour-big-viz tour-intro-viz">
				<div class="tour-intro-prompt">
					<span class="tour-intro-label">Toi, tu tapes</span>
					<div class="tour-intro-text">"{prompt}<span class="tour-cursor">|</span>"</div>
				</div>
				<div class="tour-intro-arrow" aria-hidden="true">➜</div>
				<div class="tour-intro-predict">
					<span class="tour-intro-label">Lui, il devine</span>
					<div class="tour-intro-word">{topPrediction}</div>
				</div>
			</div>

			{#if !predictionIsKnown}
				<p class="tour-caption tour-caption-mini">
					⚠️ Note pédagogique : on n'exécute pas un vrai modèle ici. Pour
					garder la démo crédible, on reconnaît quelques mots de fin fréquents
					(<em>le, la, les, un, une, des, dans, sur, est, avec, pour, je…</em>).
					Pour un autre prompt, on affiche des candidats génériques.
				</p>
			{/if}
			<p class="tour-caption">
				Dans les 8 étapes suivantes, on va voir
				<strong>comment il fait ce pari</strong>. Aucune magie — que de la
				mécanique.
			</p>
		{:else if step === 1}
			<!-- ÉTAPE 1 : TOKENIZE -->
			<h2 class="tour-h2">On coupe la phrase en morceaux</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					Avant de comprendre une phrase, le modèle la
					<strong>découpe en petits morceaux</strong> — comme tu couperais
					une baguette en tranches avant de manger.
				</p>
			</div>

			<div class="tour-big-viz">
				<div class="tour-tokens">
					{#each tokens as t, i (i)}
						<span class="tour-token-big">{t.text.trim()}</span>
						{#if i < tokens.length - 1}
							<span class="tour-token-sep" aria-hidden="true">✂️</span>
						{/if}
					{/each}
				</div>
			</div>

			<p class="tour-caption">
				✏️ <strong>Modifie ton prompt</strong> en haut — tu verras les
				morceaux changer en temps réel.
			</p>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						Ces morceaux s'appellent des <strong>tokens</strong>. L'algorithme
						qui les crée s'appelle <strong>BPE</strong> (Byte-Pair Encoding). Il
						apprend à découper les mots fréquents en un seul token, les rares en
						plusieurs. GPT-2 a un vocabulaire de 50 257 tokens.
					</p>
				</div>
			</details>
		{:else if step === 2}
			<!-- ÉTAPE 2 : EMBED -->
			<h2 class="tour-h2">Chaque morceau devient des chiffres</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					Un ordinateur ne comprend pas "chat" ou "chien" — il ne comprend
					que des chiffres. Donc on transforme chaque mot en une
					<strong>empreinte unique</strong> de 768 nombres.
				</p>
			</div>

			<div class="tour-big-viz">
				<div class="tour-embed-selector">
					<span class="tour-embed-intro">Choisis un mot à transformer :</span>
					<div class="tour-embed-chips">
						{#each tokens as t, i (i)}
							<button
								type="button"
								class="tour-chip {i === selectedTokenIdx ? 'is-active' : ''}"
								onclick={() => (selectedTokenIdx = i)}
							>
								{t.text.trim()}
							</button>
						{/each}
					</div>
				</div>

				<div class="tour-embed-arrow" aria-hidden="true">
					<span class="tour-embed-chosen">{tokens[selectedTokenIdx]?.text.trim()}</span>
					<span>➜</span>
					<span class="tour-embed-become">empreinte de chiffres</span>
				</div>

				<div class="tour-heat-big">
					{#each selectedVector as v, i (i)}
						<div
							class="tour-heat-cell-big"
							style="background-color: {v >= 0
								? `rgba(255, 157, 0, ${Math.abs(v)})`
								: `rgba(59, 130, 246, ${Math.abs(v)})`};"
							title="chiffre {i + 1}: {v.toFixed(3)}"
						></div>
					{/each}
				</div>
				<p class="tour-caption tour-caption-mini">
					Orange = chiffre positif, bleu = chiffre négatif. (On montre 20
					chiffres sur 768 — juste pour l'image.)
				</p>
			</div>

			<p class="tour-caption">
				👉 <strong>Clique un autre mot</strong>. Son empreinte est différente :
				c'est ce qui permet au modèle de les distinguer.
			</p>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						Ce passage « mot → empreinte » s'appelle l'<strong>embedding</strong>.
						C'est un simple look-up dans une grosse matrice <code>W_E</code>
						de taille 50 257 × 768, apprise à l'entraînement. Des mots proches
						en sens (<em>roi</em> et <em>reine</em>) finissent avec des
						empreintes proches dans l'espace à 768 dimensions.
					</p>
					<MathBlock tex={String.raw`E = W_E[x] \in \mathbb{R}^{n \times 768}`} />
				</div>
			</details>
		{:else if step === 3}
			<!-- ÉTAPE 3 : POSITION -->
			<h2 class="tour-h2">On ajoute la position</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					<strong>"Le chat mange la souris"</strong> ≠
					<strong>"La souris mange le chat"</strong>. Mêmes mots, mais l'ordre
					change tout. Le modèle doit savoir <em>où</em> chaque mot se trouve
					dans la phrase.
				</p>
			</div>

			<div class="tour-big-viz">
				<div class="tour-position-control">
					<label for="tour-pos">Position du mot</label>
					<input
						id="tour-pos"
						type="range"
						min="0"
						max="20"
						step="1"
						bind:value={positionSlider}
						class="tour-slider-big"
					/>
					<span class="tour-position-value">position {positionSlider}</span>
				</div>

				<div class="tour-heat-big">
					{#each peVec as v (v)}
						<div
							class="tour-heat-cell-big"
							style="background-color: {v >= 0
								? `rgba(255, 210, 30, ${Math.abs(v)})`
								: `rgba(59, 130, 246, ${Math.abs(v)})`};"
							title={v.toFixed(3)}
						></div>
					{/each}
				</div>

				<p class="tour-caption tour-caption-mini">
					Chaque position du mot dans la phrase reçoit une <strong>signature unique</strong>
					(un motif de chiffres). On l'ajoute à son empreinte.
				</p>
			</div>

			<p class="tour-caption">
				👆 <strong>Bouge le curseur</strong>. Regarde le motif changer : chaque
				position a sa propre signature — le modèle sait ainsi si le mot est
				premier, deuxième, troisième…
			</p>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						Cette technique s'appelle l'<strong>encodage positionnel</strong>.
						Vaswani (§3.5) utilise des sinus et cosinus de fréquences
						différentes. GPT-2 a préféré apprendre ces motifs plutôt que les
						fixer.
					</p>
					<MathBlock
						tex={String.raw`PE_{(pos, 2i)} = \sin\!\left(\frac{pos}{10000^{2i/d}}\right), \quad PE_{(pos, 2i+1)} = \cos(\ldots)`}
					/>
				</div>
			</details>
		{:else if step === 4}
			<!-- ÉTAPE 4 : ATTENTION -->
			<h2 class="tour-h2">Chaque mot regarde les autres</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					Imagine une <strong>table ronde</strong>. Quand tu veux prendre la
					parole, tu regardes tout le monde — mais tu
					<strong>écoutes plus fort</strong> ceux qui ont une réponse pour toi.
					C'est exactement ce que chaque mot fait ici.
				</p>
			</div>

			<div class="tour-big-viz">
				<p class="tour-attention-instruction">
					👉 <strong>Clique un mot de ton prompt</strong>. Tu verras vers qui
					il « écoute » le plus fort.
				</p>

				{#if tokens.length >= 2}
					<!-- Arcs + tokens dans le même SVG pour alignement parfait -->
					{@const N = tokens.length}
					{@const W = Math.max(420, N * 90)}
					{@const slot = W / N}
					{@const yRow = 150}
					<div class="tour-att-container" style="--att-w: {W}px;">
						<svg viewBox="0 0 {W} 180" class="tour-att-svg" preserveAspectRatio="xMidYMid meet">
							<defs>
								<linearGradient id="att-grad-new" x1="0" y1="1" x2="0" y2="0">
									<stop offset="0%" stop-color="#FFD21E" />
									<stop offset="100%" stop-color="#FF9D00" />
								</linearGradient>
							</defs>

							<!-- Arcs : uniquement depuis le token source sélectionné -->
							{#each attentionMatrix[attentionFromIdx] ?? [] as score, j (j)}
								{#if score > 0.05 && j !== attentionFromIdx}
									{@const x1 = slot * (attentionFromIdx + 0.5)}
									{@const x2 = slot * (j + 0.5)}
									{@const mid = (x1 + x2) / 2}
									{@const height = 40 + Math.abs(attentionFromIdx - j) * 15}
									<path
										d="M {x1} {yRow - 28} Q {mid} {yRow - height} {x2} {yRow - 28}"
										stroke="url(#att-grad-new)"
										stroke-width={Math.max(1.5, score * 22)}
										fill="none"
										opacity={Math.min(1, score * 2 + 0.3)}
										stroke-linecap="round"
									/>
									{#if score > 0.1}
										<text
											x={mid}
											y={yRow - height + 8}
											text-anchor="middle"
											class="tour-att-score-label"
										>{Math.round(score * 100)}%</text>
									{/if}
								{/if}
							{/each}

							<!-- Rangée de tokens -->
							{#each tokens as t, i (i)}
								{@const cx = slot * (i + 0.5)}
								{@const isSrc = i === attentionFromIdx}
								<g
									class="tour-att-token-g {isSrc ? 'is-source' : ''}"
									onclick={() => (attentionFromIdx = i)}
									role="button"
									tabindex="0"
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') attentionFromIdx = i;
									}}
									aria-label="Voir l'attention depuis {t.text.trim()}"
								>
									<rect
										x={cx - 40}
										y={yRow - 18}
										width={80}
										height={36}
										rx={8}
										class="tour-att-token-rect"
										fill={isSrc ? '#FFD21E' : '#ffffff'}
										stroke={isSrc ? '#FF9D00' : '#e2e8f0'}
										stroke-width={isSrc ? 2.5 : 1.5}
									/>
									<text
										x={cx}
										y={yRow + 4}
										text-anchor="middle"
										class="tour-att-token-text"
									>{t.text.trim()}</text>
								</g>
							{/each}
						</svg>
					</div>
				{:else}
					<p class="tour-caption tour-caption-mini">
						✏️ <strong>Tape au moins deux mots</strong> dans ton prompt pour
						voir l'attention.
					</p>
				{/if}
			</div>

			<p class="tour-caption">
				Le mot <strong class="tour-pill-yellow"
					>« {tokens[attentionFromIdx]?.text.trim() ?? '—'} »</strong
				>
				écoute surtout son voisin de gauche et son « partenaire sémantique » —
				c'est une simulation, pas un vrai modèle (voir plus bas).
			</p>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						C'est le cœur du Transformer. Le mécanisme officiel :
						<strong>scaled dot-product attention</strong> (Vaswani §3.2.1).
						Chaque mot produit 3 vecteurs : une <em>Question</em> (Q), une
						<em>Clé</em> (K), une <em>Valeur</em> (V). Les Questions matchent
						les Clés pour donner les scores d'écoute ; on fait ensuite une
						moyenne pondérée des Valeurs.
					</p>
					<MathBlock
						tex={String.raw`\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{Q K^\top}{\sqrt{d_k}}\right) V`}
					/>
					<p>
						Et on fait ça <strong>12 fois en parallèle</strong> avec des
						paramètres différents (<em>multi-head</em>) — chaque tête se
						spécialise sur un type de relation.
					</p>
				</div>
			</details>
		{:else if step === 5}
			<!-- ÉTAPE 5 : RAFFINAGE -->
			<h2 class="tour-h2">Chaque mot se met à jour</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					Après avoir écouté les autres à la table, chaque mot
					<strong>met à jour sa propre empreinte</strong>. Il s'enrichit de
					ce qu'il a entendu.
				</p>
			</div>

			<div class="tour-big-viz">
				<div class="tour-refine-flow">
					<div class="tour-refine-step">
						<div class="tour-refine-emoji">🎯</div>
						<div class="tour-refine-label">Il écoute</div>
						<div class="tour-refine-note">Attention (étape précédente)</div>
					</div>
					<div class="tour-refine-plus">+</div>
					<div class="tour-refine-step">
						<div class="tour-refine-emoji">⚡</div>
						<div class="tour-refine-label">Il réfléchit</div>
						<div class="tour-refine-note">Petit « mini-cerveau » par mot</div>
					</div>
					<div class="tour-refine-plus">=</div>
					<div class="tour-refine-step tour-refine-step-out">
						<div class="tour-refine-emoji">✨</div>
						<div class="tour-refine-label">Empreinte améliorée</div>
						<div class="tour-refine-note">Plus riche, plus contextuelle</div>
					</div>
				</div>
			</div>

			<p class="tour-caption">
				Exemple : <strong>« chat »</strong> démarre avec l'empreinte générique
				d'un chat. Après avoir écouté <strong>« dort »</strong>, son empreinte
				devient celle d'un <em>chat-qui-dort</em>. Plus précise.
			</p>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						Le « mini-cerveau » de chaque mot s'appelle le
						<strong>Feed-Forward Network</strong> (§3.3) — un petit réseau de
						2 couches qui traite chaque mot indépendamment. À lui seul, il
						concentre <strong>~2/3 des paramètres</strong> du modèle.
					</p>
					<p>
						On ajoute aussi des <strong>connexions résiduelles</strong> (on
						additionne l'entrée à la sortie) et des <strong>LayerNorm</strong>
						pour stabiliser l'entraînement.
					</p>
				</div>
			</details>
		{:else if step === 6}
			<!-- ÉTAPE 6 : REPEAT ×12 -->
			<h2 class="tour-h2">On recommence 12 fois</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					Une seule passe ne suffit pas. On
					<strong>refait la table ronde 12 fois</strong>, chaque tour affinant
					la compréhension — comme un groupe qui relit un document plusieurs
					fois jusqu'à le comprendre vraiment.
				</p>
			</div>

			<div class="tour-big-viz">
				<div class="tour-stack">
					{#each Array(12) as _, i (i)}
						<div class="tour-stack-layer" style="--i: {i};">
							<span class="tour-stack-idx">{i + 1}</span>
							<span class="tour-stack-content">Bloc : attention + mini-cerveau</span>
						</div>
					{/each}
				</div>
			</div>

			<p class="tour-caption">
				Les premiers blocs font du travail « grammatical » (qui est le sujet,
				l'objet, etc.). Les derniers font du « sens » (relations sémantiques,
				raisonnement). Plus on empile, plus le modèle devient subtil.
			</p>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						GPT-2 small a 12 couches. GPT-3 en a 96. LLaMA-3 70B en a 80. Plus
						de couches ≈ plus de capacité à raisonner, mais aussi plus de
						calcul et plus de mémoire.
					</p>
				</div>
			</details>
		{:else if step === 7}
			<!-- ÉTAPE 7 : PREDICT -->
			<h2 class="tour-h2">On devine le mot suivant</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					Après les 12 tours, le modèle regarde l'empreinte du
					<strong>dernier mot</strong> et donne une note à chacun des
					<strong>50 257 mots possibles</strong>. Le plus probable gagne.
				</p>
			</div>

			<div class="tour-big-viz">
				<div class="tour-predict-bars">
					{#each probabilities as p (p.token)}
						<div class="tour-predict-row">
							<span class="tour-predict-label">{p.token}</span>
							<div class="tour-predict-track">
								<div class="tour-predict-fill" style="width: {p.p * 100}%;"></div>
							</div>
							<span class="tour-predict-pct">{(p.p * 100).toFixed(0)}%</span>
						</div>
					{/each}
				</div>
				<p class="tour-caption tour-caption-mini">
					Top 5 parmi 50 257 candidats. Ici on ne montre que les plus
					probables.
				</p>
			</div>

			<p class="tour-caption">
				Pour ton prompt <strong class="tour-pill-yellow">« {prompt} »</strong>,
				le modèle mise surtout sur
				<strong>« {probabilities[0]?.token ?? '?'} »</strong>, mais laisse des
				chances à <strong>« {probabilities[1]?.token ?? '?'} »</strong> et
				<strong>« {probabilities[2]?.token ?? '?'} »</strong>.
			</p>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						Les notes brutes s'appellent des <strong>logits</strong>. On les
						convertit en probabilités avec <strong>softmax</strong>. On appelle
						cette étape la <em>LM head</em> (head = « tête » du modèle, pas
						confondre avec les têtes d'attention).
					</p>
				</div>
			</details>
		{:else if step === 8}
			<!-- ÉTAPE 8 : TEMPERATURE + LOOP -->
			<h2 class="tour-h2">Créativité : la température</h2>

			<div class="tour-analogy">
				<span class="tour-analogy-emoji">💡</span>
				<p>
					La <strong>température</strong> règle le niveau de prudence.
					Température basse = le modèle joue safe (toujours le plus probable).
					Température haute = il prend des risques (choix aléatoires, plus
					créatifs).
				</p>
			</div>

			<div class="tour-big-viz">
				<div class="tour-temp-control">
					<label for="tour-temp">Température</label>
					<input
						id="tour-temp"
						type="range"
						min="0.1"
						max="2"
						step="0.05"
						bind:value={temperature}
						class="tour-slider-big"
					/>
					<span class="tour-temp-value">{temperature.toFixed(2)}</span>
				</div>

				<div class="tour-predict-bars">
					{#each probabilities as p (p.token)}
						<div class="tour-predict-row">
							<span class="tour-predict-label">{p.token}</span>
							<div class="tour-predict-track">
								<div class="tour-predict-fill" style="width: {p.p * 100}%;"></div>
							</div>
							<span class="tour-predict-pct">{(p.p * 100).toFixed(0)}%</span>
						</div>
					{/each}
				</div>

				<div class="tour-sample-line">
					<button type="button" class="tour-sample-btn" onclick={doSample}>
						🎲 Tirer un mot
					</button>
					{#if sampled}
						<span>→ <strong class="tour-sampled">{sampled}</strong></span>
					{/if}
				</div>
				<p class="tour-caption tour-caption-mini">
					T = 0.1 : toujours « {topPrediction} ». T = 2 : n'importe quoi peut
					sortir. T ≈ 0.7 : équilibre classique.
				</p>
			</div>

			<div class="tour-loop">
				<span class="tour-loop-emoji">🔁</span>
				<div>
					<strong>Et ça boucle.</strong> Le mot tiré rejoint le prompt, et on
					refait les 8 étapes pour trouver le mot suivant. Encore. Encore.
					Jusqu'à un point final.
				</div>
			</div>

			<details class="tour-deep" bind:open={showDeepDive}>
				<summary>🔍 Pour aller plus loin</summary>
				<div class="tour-deep-body">
					<p>
						On divise les logits par T avant le softmax. T → 0 rend la
						distribution quasi-déterministe (on prend toujours le top 1).
						T → ∞ l'uniformise (tout est équiprobable).
					</p>
					<MathBlock
						tex={String.raw`p_i = \frac{\exp(\text{logit}_i / T)}{\sum_j \exp(\text{logit}_j / T)}`}
					/>
					<p>
						C'est le mode <em>auto-régressif</em> : à chaque tour, on ajoute
						le mot tiré au prompt, et on relance tout.
					</p>
				</div>
			</details>
		{/if}
	</article>

	<!-- ---------- Navigation ---------- -->
	<nav class="tour-nav">
		<button
			type="button"
			class="tour-btn tour-btn-prev"
			onclick={prev}
			disabled={step === 0}
		>
			← Précédent
		</button>
		<span class="tour-nav-count">
			{step + 1} / {STEPS.length}
		</span>
		<button
			type="button"
			class="tour-btn tour-btn-next"
			onclick={next}
			disabled={step === STEPS.length - 1}
		>
			{step === STEPS.length - 1 ? 'Terminé 🎉' : 'Suivant →'}
		</button>
	</nav>
</div>

<style>
	.tour {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		font-feature-settings: 'tnum';
	}

	/* ---------- Prompt toujours visible ---------- */
	.tour-prompt {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 0.85rem 1.1rem;
	}
	.tour-prompt-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-500);
	}
	.tour-prompt-input {
		font-family: var(--font-mono);
		font-size: 1rem;
		padding: 0.5rem 0.8rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
	}
	.tour-prompt-input:focus {
		outline: none;
		border-color: var(--color-hf-amber);
	}

	/* ---------- Progression ---------- */
	.tour-progress {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem 1.1rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
	}
	.tour-progress-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.tour-step-num {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-ink-500);
	}
	.tour-step-title {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-ink-900);
	}
	.tour-progress-dots {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.tour-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #e2e8f0;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s;
		padding: 0;
	}
	.tour-dot:hover {
		background: #fcd34d;
	}
	.tour-dot.is-done {
		background: var(--color-hf-yellow);
	}
	.tour-dot.is-active {
		background: var(--color-hf-amber);
		border-color: var(--color-hf-amber);
		transform: scale(1.3);
	}

	/* ---------- Carte principale de l'étape ---------- */
	.tour-card {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1.5rem;
		padding: 2.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-height: 400px;
	}
	.tour-h2 {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
		text-align: center;
		line-height: 1.2;
	}
	.tour-lead {
		font-size: 1.1rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		text-align: center;
		margin: 0;
	}
	.tour-caption {
		color: var(--color-ink-700);
		font-size: 0.95rem;
		line-height: 1.6;
		margin: 0;
		text-align: center;
	}
	.tour-caption-mini {
		font-size: 0.85rem;
		font-style: italic;
		color: var(--color-ink-500);
	}

	/* ---------- Analogie (bandeau coloré) ---------- */
	.tour-analogy {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		background: var(--color-hf-cream);
		border-left: 4px solid var(--color-hf-amber);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}
	.tour-analogy-emoji {
		font-size: 2rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.tour-analogy p {
		margin: 0;
		font-size: 1rem;
		color: var(--color-ink-900);
		line-height: 1.55;
	}

	/* ---------- Gros visuel central ---------- */
	.tour-big-viz {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
	}

	/* === Étape 0 : intro === */
	.tour-intro-viz {
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.5rem;
	}
	.tour-intro-prompt,
	.tour-intro-predict {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	.tour-intro-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-500);
	}
	.tour-intro-text {
		font-family: var(--font-mono);
		font-size: 1.2rem;
		padding: 0.75rem 1.25rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 0.75rem;
		color: var(--color-ink-900);
	}
	.tour-cursor {
		animation: blink 1s infinite;
		color: var(--color-hf-amber);
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	.tour-intro-arrow {
		font-size: 2rem;
		color: var(--color-hf-amber);
	}
	.tour-intro-word {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		padding: 0.75rem 1.5rem;
		background: var(--color-hf-yellow);
		border-radius: 0.75rem;
		color: var(--color-ink-900);
	}

	/* === Étape 1 : tokens === */
	.tour-tokens {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.tour-token-big {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		background: #fff;
		border: 2px solid var(--color-hf-amber);
		border-radius: 0.75rem;
		padding: 0.6rem 1.1rem;
		color: var(--color-ink-900);
	}
	.tour-token-sep {
		font-size: 1.5rem;
		color: var(--color-hf-amber);
	}

	/* === Étape 2 : embed === */
	.tour-embed-selector {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	.tour-embed-intro {
		font-size: 0.9rem;
		color: var(--color-ink-700);
	}
	.tour-embed-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: center;
	}
	.tour-chip {
		font-family: var(--font-display);
		font-size: 1rem;
		padding: 0.45rem 0.9rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 0.6rem;
		cursor: pointer;
		color: var(--color-ink-700);
		transition: all 0.15s;
	}
	.tour-chip:hover {
		border-color: var(--color-hf-amber);
	}
	.tour-chip.is-active {
		background: var(--color-hf-yellow);
		border-color: var(--color-hf-amber);
		color: var(--color-ink-900);
		font-weight: 600;
	}
	.tour-embed-arrow {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--color-ink-700);
	}
	.tour-embed-chosen {
		background: var(--color-hf-yellow);
		padding: 0.3rem 0.7rem;
		border-radius: 0.4rem;
		font-weight: 600;
	}
	.tour-embed-become {
		font-style: italic;
		color: var(--color-ink-500);
	}

	/* Heatmap grande taille */
	.tour-heat-big {
		display: flex;
		gap: 3px;
		width: 100%;
		max-width: 500px;
	}
	.tour-heat-cell-big {
		flex: 1;
		height: 44px;
		border-radius: 4px;
		min-width: 16px;
	}

	/* === Étape 3 : position === */
	.tour-position-control,
	.tour-temp-control {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		max-width: 500px;
	}
	.tour-position-control label,
	.tour-temp-control label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-500);
		white-space: nowrap;
	}
	.tour-slider-big {
		flex: 1;
		accent-color: var(--color-hf-amber);
		height: 6px;
	}
	.tour-position-value,
	.tour-temp-value {
		background: var(--color-hf-yellow);
		padding: 0.3rem 0.75rem;
		border-radius: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-ink-900);
		white-space: nowrap;
	}

	/* === Étape 4 : attention === */
	.tour-attention-instruction {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-ink-700);
		text-align: center;
	}
	.tour-att-container {
		width: 100%;
		overflow-x: auto;
		display: flex;
		justify-content: center;
	}
	.tour-att-svg {
		width: 100%;
		min-width: var(--att-w);
		max-width: 720px;
		height: auto;
	}
	.tour-att-token-g {
		cursor: pointer;
	}
	.tour-att-token-g:hover .tour-att-token-rect {
		stroke: var(--color-hf-amber);
	}
	.tour-att-token-rect {
		transition: all 0.15s;
	}
	.tour-att-token-text {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 500;
		fill: var(--color-ink-900);
		user-select: none;
	}
	.tour-att-token-g.is-source .tour-att-token-text {
		font-weight: 700;
	}
	.tour-att-score-label {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		fill: var(--color-ink-900);
	}
	.tour-pill-yellow {
		background: var(--color-hf-yellow);
		padding: 0.15rem 0.5rem;
		border-radius: 0.3rem;
		font-weight: 600;
	}

	/* === Étape 5 : refine === */
	.tour-refine-flow {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}
	.tour-refine-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 1rem 1.25rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 0.75rem;
		min-width: 150px;
	}
	.tour-refine-step-out {
		background: var(--color-hf-cream);
		border-color: var(--color-hf-amber);
	}
	.tour-refine-emoji {
		font-size: 2rem;
	}
	.tour-refine-label {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--color-ink-900);
	}
	.tour-refine-note {
		font-size: 0.75rem;
		color: var(--color-ink-500);
		text-align: center;
	}
	.tour-refine-plus {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-hf-amber);
	}

	/* === Étape 6 : stack ×12 === */
	.tour-stack {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		max-width: 420px;
	}
	.tour-stack-layer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.85rem;
		background: linear-gradient(
			90deg,
			var(--color-hf-cream) 0%,
			#fff calc(100% - calc(var(--i, 0) * 2%))
		);
		border: 1px solid #e2e8f0;
		border-radius: 0.45rem;
		animation: slideIn 0.4s ease-out;
		animation-delay: calc(var(--i, 0) * 30ms);
		animation-fill-mode: both;
	}
	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(-12px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.tour-stack-idx {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-hf-amber);
		width: 1.5rem;
	}
	.tour-stack-content {
		font-size: 0.85rem;
		color: var(--color-ink-700);
	}

	/* === Étape 7-8 : prédiction === */
	.tour-predict-bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		max-width: 500px;
	}
	.tour-predict-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.tour-predict-label {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 500;
		width: 5.5rem;
		color: var(--color-ink-900);
	}
	.tour-predict-track {
		flex: 1;
		height: 1.75rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.35rem;
		overflow: hidden;
	}
	.tour-predict-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--color-hf-amber) 0%, var(--color-hf-yellow) 100%);
		transition: width 0.3s;
	}
	.tour-predict-pct {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--color-ink-700);
		width: 3rem;
		text-align: right;
	}

	.tour-sample-line {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
		justify-content: center;
	}
	.tour-sample-btn {
		background: var(--color-hf-amber);
		color: white;
		border: none;
		border-radius: 999px;
		padding: 0.6rem 1.25rem;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}
	.tour-sample-btn:hover {
		background: var(--color-hf-yellow);
		color: var(--color-ink-900);
	}
	.tour-sampled {
		background: var(--color-hf-yellow);
		padding: 0.2rem 0.6rem;
		border-radius: 0.35rem;
		font-family: var(--font-display);
	}

	.tour-loop {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--color-hf-cream);
		border: 1px dashed var(--color-hf-amber);
		border-radius: 0.75rem;
	}
	.tour-loop-emoji {
		font-size: 2rem;
		flex-shrink: 0;
	}
	.tour-loop > div {
		font-size: 0.95rem;
		color: var(--color-ink-700);
		line-height: 1.55;
	}

	/* ---------- Deep-dive (replié par défaut) ---------- */
	.tour-deep {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 0;
		overflow: hidden;
	}
	.tour-deep summary {
		cursor: pointer;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		color: var(--color-ink-700);
		font-weight: 500;
		list-style: none;
	}
	.tour-deep summary::-webkit-details-marker {
		display: none;
	}
	.tour-deep summary::before {
		content: '▶';
		display: inline-block;
		margin-right: 0.5rem;
		color: var(--color-ink-500);
		transition: transform 0.15s;
	}
	.tour-deep[open] summary::before {
		transform: rotate(90deg);
	}
	.tour-deep[open] summary {
		border-bottom: 1px solid #e2e8f0;
	}
	.tour-deep-body {
		padding: 1rem;
		font-size: 0.85rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* ---------- Navigation ---------- */
	.tour-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.tour-btn {
		padding: 0.7rem 1.5rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 999px;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--color-ink-700);
		cursor: pointer;
		transition: all 0.15s;
	}
	.tour-btn:hover:not(:disabled) {
		border-color: var(--color-hf-amber);
	}
	.tour-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.tour-btn-next {
		background: var(--color-hf-amber);
		border-color: var(--color-hf-amber);
		color: white;
	}
	.tour-btn-next:hover:not(:disabled) {
		background: var(--color-hf-yellow);
		color: var(--color-ink-900);
	}
	.tour-nav-count {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--color-ink-500);
	}

	/* ---------- Mobile ---------- */
	@media (max-width: 640px) {
		.tour-card {
			padding: 1.5rem 1rem;
		}
		.tour-h2 {
			font-size: 1.5rem;
		}
		.tour-progress-info {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
