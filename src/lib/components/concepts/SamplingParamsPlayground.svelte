<!--
	SamplingParamsPlayground.svelte
	================================
	Playground interactif pour les paramètres de génération :
	  1. Repetition penalty
	  2. Temperature
	  3. Top-K
	  4. Top-P (nucleus)
	  5. Min-P

	L'ordre d'application est celui utilisé par vLLM et HF Transformers :
	    rep_penalty → T → softmax → top-K → top-P → min-P → tirage.

	Pédagogie : on visualise 15 candidats côte à côte, chacun peut être
	« coupé » par un filtre. L'apprenant voit en direct quel filtre a tué
	quel candidat, et le tirage final ne pioche que dans ce qui survit.
-->
<script lang="ts">
	// =========================================================
	// Distribution d'exemple — 15 candidats pour "Le chat dort sur le ___"
	// Logits plausibles avec un long-tail pour que Top-K/Top-P aient de quoi couper.
	// =========================================================
	interface Candidate {
		token: string;
		logit: number;
	}

	const CANDIDATES: Candidate[] = [
		{ token: 'tapis', logit: 8.2 },
		{ token: 'canapé', logit: 7.1 },
		{ token: 'lit', logit: 6.4 },
		{ token: 'sol', logit: 5.9 },
		{ token: 'coussin', logit: 4.8 },
		{ token: 'plancher', logit: 4.2 },
		{ token: 'meuble', logit: 3.8 },
		{ token: 'dos', logit: 3.4 },
		{ token: 'ventre', logit: 3.1 },
		{ token: 'siège', logit: 2.7 },
		{ token: 'côté', logit: 2.3 },
		{ token: 'fauteuil', logit: 2.0 },
		{ token: 'bureau', logit: 1.7 },
		{ token: 'matelas', logit: 1.4 },
		{ token: 'pouf', logit: 1.0 }
	];

	// =========================================================
	// État des paramètres — tous les curseurs
	// =========================================================
	let temperature = $state(0.7);
	let topK = $state<number>(10); // 0 = désactivé
	let topP = $state<number>(0.9); // 1.0 = désactivé
	let minP = $state<number>(0); // 0 = désactivé
	let repPenalty = $state<number>(1.0); // 1.0 = désactivé
	let alreadyTokens = $state<Set<string>>(new Set());

	function toggleAlready(token: string) {
		const next = new Set(alreadyTokens);
		if (next.has(token)) next.delete(token);
		else next.add(token);
		alreadyTokens = next;
	}

	// =========================================================
	// Presets
	// =========================================================
	interface Preset {
		id: string;
		emoji: string;
		label: string;
		desc: string;
		apply: () => void;
	}
	const PRESETS: Preset[] = [
		{
			id: 'greedy',
			emoji: '🎯',
			label: 'Greedy',
			desc: 'Toujours le plus probable',
			apply: () => {
				temperature = 0.1;
				topK = 1;
				topP = 1.0;
				minP = 0;
				repPenalty = 1.0;
			}
		},
		{
			id: 'balanced',
			emoji: '⚖️',
			label: 'Équilibré',
			desc: 'Classique (ChatGPT default-like)',
			apply: () => {
				temperature = 0.7;
				topK = 0;
				topP = 0.9;
				minP = 0;
				repPenalty = 1.0;
			}
		},
		{
			id: 'creative',
			emoji: '🎨',
			label: 'Créatif',
			desc: 'Prose, écriture, brainstorm',
			apply: () => {
				temperature = 1.0;
				topK = 0;
				topP = 0.95;
				minP = 0.05;
				repPenalty = 1.1;
			}
		},
		{
			id: 'wild',
			emoji: '🌋',
			label: 'Chaotique',
			desc: 'Pour voir le désordre pur',
			apply: () => {
				temperature = 1.5;
				topK = 0;
				topP = 1.0;
				minP = 0;
				repPenalty = 1.0;
			}
		}
	];

	// =========================================================
	// Calcul de la distribution filtrée — cœur pédagogique
	// =========================================================
	interface FilteredCandidate {
		token: string;
		logit: number; // après repetition penalty
		prob: number; // après tous les filtres + renorm
		probBefore: number; // juste après softmax, avant top-k / top-p
		cutBy: string | null; // "top-k" | "top-p" | "min-p" | null
	}

	const filtered = $derived.by<FilteredCandidate[]>(() => {
		// 1. Repetition penalty sur les logits
		const adjusted = CANDIDATES.map((c) => {
			if (alreadyTokens.has(c.token) && repPenalty > 1) {
				// Convention HF : logit /= penalty si déjà généré
				return { ...c, logit: c.logit / repPenalty };
			}
			return { ...c };
		});

		// 2. Temperature + softmax → probs
		const T = Math.max(0.05, temperature);
		const scaled = adjusted.map((c) => c.logit / T);
		const max = Math.max(...scaled);
		const exps = scaled.map((s) => Math.exp(s - max));
		const sum = exps.reduce((a, b) => a + b, 0);
		const probsBefore = exps.map((e) => e / sum);

		// 3. Trié par prob décroissante pour appliquer top-k / top-p
		const indexed = adjusted.map((c, i) => ({
			idx: i,
			token: c.token,
			logit: c.logit,
			probBefore: probsBefore[i]
		}));
		const sorted = [...indexed].sort((a, b) => b.probBefore - a.probBefore);

		const cutByMap = new Map<number, string>();

		// 4. Top-K : garder les K premiers triés
		if (topK > 0) {
			for (let r = topK; r < sorted.length; r++) {
				cutByMap.set(sorted[r].idx, 'top-k');
			}
		}

		// 5. Top-P : trouver le plus petit ensemble dont somme ≥ P
		if (topP < 1.0) {
			let cum = 0;
			let kept = 0;
			for (const s of sorted) {
				if (cutByMap.has(s.idx)) continue;
				cum += s.probBefore;
				kept++;
				if (cum >= topP) break;
			}
			let count = 0;
			for (const s of sorted) {
				if (cutByMap.has(s.idx)) continue;
				count++;
				if (count > kept) cutByMap.set(s.idx, 'top-p');
			}
		}

		// 6. Min-P : seuil relatif au top
		if (minP > 0) {
			const topProb = sorted[0].probBefore;
			for (const s of sorted) {
				if (cutByMap.has(s.idx)) continue;
				if (s.probBefore < minP * topProb) cutByMap.set(s.idx, 'min-p');
			}
		}

		// 7. Renormaliser sur ce qui reste
		const keptProbs = indexed.map((c) =>
			cutByMap.has(c.idx) ? 0 : c.probBefore
		);
		const totalKept = keptProbs.reduce((a, b) => a + b, 0);
		const finalProbs = keptProbs.map((p) => (totalKept > 0 ? p / totalKept : 0));

		return indexed.map((c) => ({
			token: c.token,
			logit: c.logit,
			probBefore: c.probBefore,
			prob: finalProbs[c.idx],
			cutBy: cutByMap.get(c.idx) ?? null
		}));
	});

	const keptCount = $derived(filtered.filter((c) => !c.cutBy).length);

	// =========================================================
	// Sampling
	// =========================================================
	let sampled = $state<string | null>(null);
	function doSample() {
		const r = Math.random();
		let cum = 0;
		for (const c of filtered) {
			cum += c.prob;
			if (r <= cum) {
				sampled = c.token;
				return;
			}
		}
		sampled = filtered.find((c) => c.prob > 0)?.token ?? null;
	}

	// =========================================================
	// Aide contextuelle : quel paramètre expliquer
	// =========================================================
	let openHelp = $state<string | null>(null);
	function toggleHelp(id: string) {
		openHelp = openHelp === id ? null : id;
	}

	const maxProbBefore = $derived(Math.max(...filtered.map((c) => c.probBefore)));
</script>

<section class="spp">
	<header class="spp-header">
		<h2 class="spp-h2">🎛️ Les paramètres de génération</h2>
		<p class="spp-lead">
			La température, c'est bien — mais il existe d'autres leviers pour piloter
			le tirage du prochain token. Voici les 5 principaux, avec leur effet en
			direct sur la distribution.
		</p>
		<p class="spp-context">
			Scénario : on complète <em>« Le chat dort sur le ___ »</em>. Les 15
			candidats ci-dessous ont des scores pré-calculés.
		</p>
	</header>

	<!-- ========== Presets ========== -->
	<div class="spp-presets">
		<span class="spp-presets-label">Essaye un preset :</span>
		{#each PRESETS as p (p.id)}
			<button
				type="button"
				class="spp-preset"
				onclick={p.apply}
				title={p.desc}
			>
				<span aria-hidden="true">{p.emoji}</span>
				<strong>{p.label}</strong>
				<span class="spp-preset-desc">{p.desc}</span>
			</button>
		{/each}
	</div>

	<!-- ========== Distribution ========== -->
	<div class="spp-dist">
		<div class="spp-dist-head">
			<span class="spp-dist-title">Distribution des 15 candidats</span>
			<span class="spp-dist-meta">
				<strong>{keptCount}</strong> / 15 gardés ·
				si tirage : <strong>{filtered[0]?.prob ? (filtered[0].prob * 100).toFixed(0) + '% top-1' : '—'}</strong>
			</span>
		</div>

		{#each filtered as c (c.token)}
			<div class="spp-row {c.cutBy ? 'is-cut' : ''}">
				<button
					type="button"
					class="spp-token-label"
					onclick={() => toggleAlready(c.token)}
					title="Clique pour marquer comme 'déjà généré' (active la repetition penalty)"
				>
					<span>{c.token}</span>
					{#if alreadyTokens.has(c.token)}
						<span class="spp-token-already" aria-label="déjà généré">🔁</span>
					{/if}
				</button>
				<div class="spp-bar-track">
					<div
						class="spp-bar-fill {c.cutBy ? 'is-cut' : ''}"
						style="width: {(c.probBefore / maxProbBefore) * 100}%;"
					></div>
				</div>
				<span class="spp-pct">
					{#if c.cutBy}
						<span class="spp-cut-tag">✖ {c.cutBy}</span>
					{:else}
						{(c.prob * 100).toFixed(1)}%
					{/if}
				</span>
			</div>
		{/each}
	</div>

	<!-- ========== Paramètres ========== -->
	<div class="spp-params">
		<!-- Temperature -->
		<div class="spp-param">
			<div class="spp-param-head">
				<label for="spp-t">🌡️ Température</label>
				<button type="button" class="spp-help-btn" onclick={() => toggleHelp('temp')}>
					❓
				</button>
				<span class="spp-param-value">{temperature.toFixed(2)}</span>
			</div>
			<input
				id="spp-t"
				type="range"
				min="0.1"
				max="2"
				step="0.05"
				bind:value={temperature}
				class="spp-slider"
			/>
			{#if openHelp === 'temp'}
				<div class="spp-help">
					<div class="spp-help-block">
						<span class="spp-help-label">🎯 Le problème</span>
						<p>
							Sans contrôle, le modèle prendrait toujours son top-1 (greedy).
							C'est déterministe et ennuyeux. À l'inverse, tirer totalement
							au hasard donnerait n'importe quoi.
							On veut un <strong>curseur entre les deux</strong>.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔧 Le mécanisme</span>
						<p>
							Avant softmax, on <strong>divise chaque logit par T</strong>.
							T bas → écarts amplifiés → softmax piqué (le top-1 domine
							encore plus). T haut → écarts écrasés → softmax plat (tous
							presque égaux).
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">📝 Exemple chiffré</span>
						<p>
							Logits <code>[8, 5, 2]</code>. Avec <strong>T = 1</strong> :
							probas ≈ <code>95 / 5 / 0 %</code>. Avec
							<strong>T = 2</strong> : <code>73 / 20 / 7 %</code>. Avec
							<strong>T = 0.5</strong> : <code>99 / 1 / 0 %</code>.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">⚠️ Attention</span>
						<p>
							T ≤ 0.1 devient pratiquement du greedy — même prompt =
							toujours même sortie. Fatal pour de l'écriture créative,
							parfait pour du code ou un résumé factuel.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔗 Relations</span>
						<p>
							Se combine idéalement avec <strong>Top-P</strong>. La combo
							<code>T=0.7 + P=0.9</code> est le réglage standard.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Top-K -->
		<div class="spp-param">
			<div class="spp-param-head">
				<label for="spp-k">🎯 Top-K</label>
				<button type="button" class="spp-help-btn" onclick={() => toggleHelp('topk')}>
					❓
				</button>
				<span class="spp-param-value">
					{topK === 0 ? 'désactivé' : `K = ${topK}`}
				</span>
			</div>
			<input
				id="spp-k"
				type="range"
				min="0"
				max="15"
				step="1"
				bind:value={topK}
				class="spp-slider"
			/>
			{#if openHelp === 'topk'}
				<div class="spp-help">
					<div class="spp-help-block">
						<span class="spp-help-label">🎯 Le problème</span>
						<p>
							Dans le vocabulaire, il y a 50 257 tokens. Même ceux qui ont
							0.001 % de probabilité peuvent être tirés. On veut
							<strong>jeter la longue traîne</strong> de tokens évidemment
							mauvais.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔧 Le mécanisme</span>
						<p>
							On trie tous les candidats par probabilité décroissante, on
							garde <strong>les K premiers</strong>, on met les autres à 0,
							et on renormalise pour que les K restants somment à 100 %.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">📝 Exemple chiffré</span>
						<p>
							Distribution <code>[40, 25, 15, 10, 5, 3, 2]</code> %.
							<strong>Top-K = 3</strong> → on garde
							<code>[40, 25, 15]</code>, le reste est coupé. Après renorm :
							<code>[50, 31, 19]</code> %.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">⚠️ Attention</span>
						<p>
							Le K est <strong>fixe</strong> — c'est son défaut. Si le
							modèle est très sûr (top-1 à 95 %), K=50 garde 49 tokens
							inutiles. S'il hésite (top-1 à 5 %), K=50 peut être trop
							restrictif. Top-P a été inventé pour corriger ça.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔗 Relations</span>
						<p>
							<strong>K = 1</strong> ≡ greedy. <strong>K = 0</strong>
							(selon les implémentations) = désactivé. Historiquement le
							premier filtre de la littérature.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Top-P -->
		<div class="spp-param">
			<div class="spp-param-head">
				<label for="spp-p">🧩 Top-P (nucleus)</label>
				<button type="button" class="spp-help-btn" onclick={() => toggleHelp('topp')}>
					❓
				</button>
				<span class="spp-param-value">
					{topP >= 0.999 ? 'désactivé' : `P = ${topP.toFixed(2)}`}
				</span>
			</div>
			<input
				id="spp-p"
				type="range"
				min="0.1"
				max="1.0"
				step="0.01"
				bind:value={topP}
				class="spp-slider"
			/>
			{#if openHelp === 'topp'}
				<div class="spp-help">
					<div class="spp-help-block">
						<span class="spp-help-label">🎯 Le problème</span>
						<p>
							Top-K est rigide : toujours le même nombre de candidats. On
							voudrait <strong>adapter selon la confiance</strong> du
							modèle : restrictif quand il est sûr, permissif quand il
							hésite.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔧 Le mécanisme</span>
						<p>
							On trie par probabilité décroissante, on <strong
								>cumule depuis le top jusqu'à atteindre P</strong
							>, on garde exactement ces tokens. C'est l'« ensemble
							nucléaire » (d'où <em>nucleus sampling</em>, Holtzman 2020).
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">📝 Exemple chiffré</span>
						<p>
							Probas triées <code>[40, 25, 15, 10, 5, 3, 2]</code> %. Avec
							<strong>P = 0.90</strong> : on accumule 40 → 65 → 80 → 90
							(stop). On garde les 4 premiers. Le 5ᵉ (5 %) est coupé.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">⚠️ Attention</span>
						<p>
							<strong>P = 1.0</strong> désactive le filtre. P trop bas
							(0.5) coupe brutalement. Le nombre de tokens gardés varie
							selon la distribution — c'est son avantage et son défaut.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔗 Relations</span>
						<p>
							Le <strong>plus populaire aujourd'hui</strong>. OpenAI,
							Anthropic, HuggingFace exposent tous Top-P. Souvent combiné
							avec T. On le note aussi <code>top_p</code> dans les API.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Min-P -->
		<div class="spp-param">
			<div class="spp-param-head">
				<label for="spp-minp">🔍 Min-P <span class="spp-advanced">avancé</span></label>
				<button type="button" class="spp-help-btn" onclick={() => toggleHelp('minp')}>
					❓
				</button>
				<span class="spp-param-value">
					{minP === 0 ? 'désactivé' : `${(minP * 100).toFixed(0)}%`}
				</span>
			</div>
			<input
				id="spp-minp"
				type="range"
				min="0"
				max="0.3"
				step="0.01"
				bind:value={minP}
				class="spp-slider"
			/>
			{#if openHelp === 'minp'}
				<div class="spp-help">
					<div class="spp-help-block">
						<span class="spp-help-label">🎯 Le problème</span>
						<p>
							Même Top-P peut être trompeur. Si le top-1 est à 90 %, les
							tokens à 2 % sont juste du bruit. Si le top-1 est à 10 %, les
							tokens à 2 % sont proportionnellement intéressants. On veut
							un seuil <strong>relatif au meilleur</strong>, pas absolu.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔧 Le mécanisme</span>
						<p>
							On rejette tout token dont la probabilité est
							<strong
								>inférieure à <code>Min-P × (proba du top-1)</code></strong
							>. Le seuil s'adapte automatiquement à la confiance du
							modèle.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">📝 Exemple chiffré</span>
						<p>
							Top-1 à 50 %, <strong>Min-P = 0.05</strong> → seuil = 2.5 %.
							On garde tous ≥ 2.5 %. Top-1 à 10 %, même Min-P → seuil =
							0.5 %. On devient beaucoup plus tolérant — cohérent avec
							l'incertitude du modèle.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">⚠️ Attention</span>
						<p>
							Paramètre <strong>récent</strong> (≈ 2024) et pas encore
							exposé par toutes les APIs — OpenAI ne l'a pas, Claude non
							plus. <strong>vLLM, llama.cpp, LM Studio</strong> le
							supportent. Valeurs typiques : 0.05 à 0.1.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔗 Relations</span>
						<p>
							Peut <strong>remplacer Top-P</strong> ou s'empiler avec. Les
							deux convergent en pratique ; Min-P est plus simple à régler
							selon certains benchmarks.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Repetition penalty -->
		<div class="spp-param">
			<div class="spp-param-head">
				<label for="spp-rep">🔁 Repetition penalty</label>
				<button type="button" class="spp-help-btn" onclick={() => toggleHelp('rep')}>
					❓
				</button>
				<span class="spp-param-value">
					{repPenalty === 1.0 ? 'désactivé' : `× ${repPenalty.toFixed(2)}`}
				</span>
			</div>
			<input
				id="spp-rep"
				type="range"
				min="1"
				max="2"
				step="0.05"
				bind:value={repPenalty}
				class="spp-slider"
			/>
			{#if openHelp === 'rep'}
				<div class="spp-help">
					<div class="spp-help-block">
						<span class="spp-help-label">🎯 Le problème</span>
						<p>
							Les LLMs <strong>bouclent</strong> : « Le chat le chat le
							chat… ». C'est un effet de renforcement : chaque fois qu'un
							token sort, la probabilité qu'il ressorte augmente (auto-boucle
							d'attention). Il faut casser le cercle.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔧 Le mécanisme</span>
						<p>
							Pour chaque token <strong>déjà apparu</strong> dans la sortie,
							on <strong>divise son logit par <code>penalty</code></strong>
							(≥ 1). Un logit divisé par 1.2 rétrécit ; sa proba baisse.
							Plus le token a déjà été dit, plus on le pénalise fort (dans
							certaines variantes).
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">📝 Exemple chiffré</span>
						<p>
							Prompt déjà : « Le chat est ». Candidat « chat » avec logit
							7.5. <strong>penalty = 1.2</strong> → logit devient
							<code>7.5 / 1.2 = 6.25</code>. Sa proba passe de ~55 % à
							~35 % dans la distribution finale.
							👉 <strong>Clique un token</strong> dans la liste pour voir
							l'effet.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">⚠️ Attention</span>
						<p>
							<strong>Trop haut (&gt; 1.3)</strong> : le modèle évite même
							les mots de liaison légitimes (« le », « est ») et produit
							du français dégradé. <strong>Trop bas (= 1)</strong> : pas
							d'effet. Réglage typique : 1.05 à 1.15.
						</p>
					</div>
					<div class="spp-help-block">
						<span class="spp-help-label">🔗 Relations</span>
						<p>
							<code>frequency_penalty</code> (OpenAI) et
							<code>presence_penalty</code> (OpenAI) sont des variantes
							additives du même concept. Le repetition_penalty de
							HuggingFace est multiplicatif.
						</p>
					</div>
				</div>
			{/if}
			{#if alreadyTokens.size > 0}
				<p class="spp-already-info">
					Déjà généré : {#each [...alreadyTokens] as t, i (t)}{t}{i < alreadyTokens.size - 1 ? ', ' : ''}{/each}
					— <button type="button" class="spp-clear" onclick={() => (alreadyTokens = new Set())}>
						vider
					</button>
				</p>
			{/if}
		</div>
	</div>

	<!-- ========== Tirage ========== -->
	<div class="spp-sample">
		<button type="button" class="spp-sample-btn" onclick={doSample}>
			🎲 Tirer un mot parmi les {keptCount} gardés
		</button>
		{#if sampled}
			<span class="spp-sampled-result">→ <strong>{sampled}</strong></span>
		{/if}
	</div>

	<!-- ========== Note pédagogique ========== -->
	<div class="spp-note">
		<span class="spp-note-emoji">💡</span>
		<div>
			<p>
				<strong>Ordre d'application</strong> (standard vLLM / HuggingFace) :
				repetition penalty → temperature → softmax → Top-K → Top-P → Min-P →
				tirage. On peut combiner plusieurs filtres ; <strong
					>en pratique, Temperature + Top-P</strong
				>
				suffit dans 90 % des cas.
			</p>
			<p>
				⚠️ <strong>Piège courant :</strong> Top-K=1 ou Temperature=0 rend la
				génération <em>déterministe</em> — même prompt ⇒ toujours même sortie.
				Utile pour du code ou des réponses factuelles ; fatal pour de la
				rédaction créative.
			</p>
		</div>
	</div>
</section>

<style>
	.spp {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 2rem;
		background: linear-gradient(180deg, #fff9e6 0%, #fff 100%);
		border: 1px solid #e2e8f0;
		border-radius: 1.5rem;
	}

	.spp-header {
		text-align: center;
	}
	.spp-h2 {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0 0 0.5rem;
	}
	.spp-lead {
		color: var(--color-ink-700);
		font-size: 1rem;
		line-height: 1.55;
		margin: 0 auto;
		max-width: 600px;
	}
	.spp-context {
		margin-top: 0.5rem;
		color: var(--color-ink-500);
		font-size: 0.85rem;
		font-style: italic;
	}

	/* Presets */
	.spp-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		justify-content: center;
	}
	.spp-presets-label {
		font-size: 0.85rem;
		color: var(--color-ink-500);
	}
	.spp-preset {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.5rem 0.9rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 0.6rem;
		cursor: pointer;
		transition: all 0.15s;
		min-width: 140px;
	}
	.spp-preset:hover {
		border-color: var(--color-hf-amber);
		transform: translateY(-1px);
	}
	.spp-preset strong {
		font-family: var(--font-display);
		font-size: 0.95rem;
		color: var(--color-ink-900);
	}
	.spp-preset-desc {
		font-size: 0.7rem;
		color: var(--color-ink-500);
	}

	/* Distribution */
	.spp-dist {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 1rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.875rem;
	}
	.spp-dist-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-bottom: 0.5rem;
		margin-bottom: 0.25rem;
		border-bottom: 1px solid #f1f5f9;
	}
	.spp-dist-title {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--color-ink-900);
	}
	.spp-dist-meta {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-ink-500);
	}
	.spp-row {
		display: grid;
		grid-template-columns: 110px 1fr 110px;
		gap: 0.5rem;
		align-items: center;
		padding: 0.15rem 0;
	}
	.spp-row.is-cut {
		opacity: 0.45;
	}
	.spp-token-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: none;
		padding: 0.2rem 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-ink-900);
		cursor: pointer;
		border-radius: 0.3rem;
		text-align: left;
		transition: background 0.15s;
	}
	.spp-token-label:hover {
		background: var(--color-hf-cream);
	}
	.spp-token-already {
		font-size: 0.75rem;
	}
	.spp-bar-track {
		height: 1.5rem;
		background: #f1f5f9;
		border-radius: 0.3rem;
		overflow: hidden;
	}
	.spp-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--color-hf-amber) 0%, var(--color-hf-yellow) 100%);
		transition: width 0.2s;
	}
	.spp-bar-fill.is-cut {
		background: #cbd5e1;
	}
	.spp-pct {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-ink-700);
		text-align: right;
	}
	.spp-cut-tag {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		background: #f1f5f9;
		color: var(--color-ink-500);
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
	}

	/* Paramètres */
	.spp-params {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.spp-param {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 0.85rem 1rem;
	}
	.spp-param-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.spp-param-head label {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--color-ink-900);
		flex: 1;
	}
	.spp-advanced {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		background: #f1f5f9;
		color: var(--color-ink-500);
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
		margin-left: 0.4rem;
		vertical-align: middle;
	}
	.spp-help-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.9rem;
		padding: 0.2rem 0.4rem;
		border-radius: 50%;
		color: var(--color-ink-500);
		transition: background 0.15s;
	}
	.spp-help-btn:hover {
		background: var(--color-hf-cream);
	}
	.spp-param-value {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
		background: var(--color-hf-yellow);
		padding: 0.2rem 0.6rem;
		border-radius: 0.3rem;
		color: var(--color-ink-900);
	}
	.spp-slider {
		width: 100%;
		accent-color: var(--color-hf-amber);
	}
	.spp-help {
		margin-top: 0.5rem;
		padding: 0.9rem 1rem;
		background: #f8fafc;
		border-left: 3px solid var(--color-hf-amber);
		border-radius: 0.4rem;
		font-size: 0.85rem;
		line-height: 1.55;
		color: var(--color-ink-700);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.spp-help-block {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.spp-help-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		color: var(--color-ink-900);
		text-transform: uppercase;
	}
	.spp-help-block p {
		margin: 0;
	}
	.spp-already-info {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-ink-500);
		font-style: italic;
	}
	.spp-clear {
		background: none;
		border: none;
		color: var(--color-hf-amber);
		text-decoration: underline;
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0;
	}

	/* Tirage */
	.spp-sample {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: center;
		padding: 0.75rem;
	}
	.spp-sample-btn {
		background: var(--color-hf-amber);
		color: white;
		border: none;
		border-radius: 999px;
		padding: 0.7rem 1.5rem;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}
	.spp-sample-btn:hover {
		background: var(--color-hf-yellow);
		color: var(--color-ink-900);
	}
	.spp-sampled-result {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--color-ink-700);
	}
	.spp-sampled-result strong {
		background: var(--color-hf-yellow);
		padding: 0.2rem 0.7rem;
		border-radius: 0.4rem;
	}

	/* Note pédagogique */
	.spp-note {
		display: flex;
		gap: 0.75rem;
		background: var(--color-hf-cream);
		border-left: 4px solid var(--color-hf-amber);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}
	.spp-note-emoji {
		font-size: 1.75rem;
		flex-shrink: 0;
	}
	.spp-note p {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--color-ink-700);
	}
	.spp-note p:last-child {
		margin-bottom: 0;
	}

	/* Mobile */
	@media (max-width: 640px) {
		.spp {
			padding: 1.25rem;
		}
		.spp-row {
			grid-template-columns: 80px 1fr 90px;
			gap: 0.35rem;
		}
		.spp-token-label {
			font-size: 0.75rem;
		}
	}
</style>
