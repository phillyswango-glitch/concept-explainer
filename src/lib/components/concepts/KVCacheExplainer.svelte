<!--
	KVCacheExplainer.svelte
	=======================
	Explique le KV cache : la grande optimisation d'inférence qui évite
	de recalculer à chaque token.

	Plan didactique (structure commune avec les autres explainers) :
	  🎯 Le problème
	  🔧 Le mécanisme
	  📝 Exemple chiffré
	  ⚠️ Attention
	  🔗 Relations

	Visualisation interactive : comparaison côte à côte "sans cache" (tout
	en orange, recalculé) vs "avec cache" (jaune = déjà en cache, orange =
	nouveau token). Slider pour N tokens, compteurs de FLOPs et mémoire.
-->
<script lang="ts">
	// =========================================================
	// Modèles de référence avec leurs hyperparamètres.
	// Pour chaque modèle : mémoire par token = 2 (K+V) × n_layers × d_model × 2 (fp16)
	// =========================================================
	interface ModelSpec {
		id: string;
		label: string;
		params: string;
		n_layers: number;
		d_model: number;
		n_kv_heads: number; // < n_heads si GQA
		bytes_per_token: number; // calculé : 2 × L × d × 2
	}

	function mk(id: string, label: string, params: string, n_layers: number, d_model: number, n_kv_heads: number): ModelSpec {
		// Mémoire en fp16 (2 octets), K + V stockés, toutes les couches.
		// Avec GQA, K et V sont partagés → on ajuste via le ratio n_kv_heads / n_heads.
		// Ici on suppose d_kv = d_model × (n_kv_heads / n_heads) pour la simplification.
		const bytes = 2 * n_layers * d_model * 2; // approximation simple MHA
		return { id, label, params, n_layers, d_model, n_kv_heads, bytes_per_token: bytes };
	}

	const MODELS: ModelSpec[] = [
		mk('gpt2-small', 'GPT-2 small', '124 M', 12, 768, 12),
		mk('llama-7b', 'LLaMA-7B', '7 B', 32, 4096, 32),
		mk('llama-70b-mha', 'LLaMA-70B (sans GQA)', '70 B', 80, 8192, 64),
		mk('llama-70b-gqa', 'LLaMA-70B (avec GQA, 8 kv-heads)', '70 B', 80, 8192, 8)
	];

	let modelId = $state('llama-7b');
	const model = $derived(MODELS.find((m) => m.id === modelId) ?? MODELS[0]);

	// Pour GQA, on ajuste la mémoire effective : le K/V ne stocke que n_kv_heads / n_heads × d_model
	const bytesPerTokenEffective = $derived.by(() => {
		// Approximation : en GQA, d_kv = d_model × n_kv_heads / n_heads (où n_heads = d_model/64 typiquement)
		const n_heads = model.d_model / 64;
		const ratio = model.n_kv_heads / n_heads;
		return model.bytes_per_token * ratio;
	});

	let N = $state(16); // nb de tokens dans la viz

	// ---------- Métriques live ----------
	/** Mémoire totale du cache (MB) pour N tokens. */
	const cacheMemoryMB = $derived((bytesPerTokenEffective * N) / (1024 * 1024));

	/** Opérations à l'étape courante (proxy didactique : "nb de vecteurs K/V à recalculer"). */
	const opsWithoutCache = $derived(N); // on recalcule les K/V des N tokens
	const opsWithCache = 1; // seulement le nouveau token

	/** Cumul depuis le début de la génération (pour une séquence de N tokens). */
	const totalOpsWithoutCache = $derived((N * (N + 1)) / 2); // 1+2+…+N
	const totalOpsWithCache = $derived(N);
	const speedup = $derived(
		totalOpsWithCache > 0 ? totalOpsWithoutCache / totalOpsWithCache : 1
	);

	/** Mémoire projetée sur un contexte réel de 4096 tokens (plus parlant). */
	const memoryAt4k = $derived((bytesPerTokenEffective * 4096) / (1024 * 1024 * 1024));

	// ---------- Helpers d'affichage ----------
	function fmtBytes(mb: number): string {
		if (mb < 1) return `${(mb * 1024).toFixed(0)} Ko`;
		if (mb < 1024) return `${mb.toFixed(1)} Mo`;
		return `${(mb / 1024).toFixed(2)} Go`;
	}
	function fmtOps(n: number): string {
		if (n < 1000) return `${n}`;
		if (n < 1e6) return `${(n / 1000).toFixed(1)} k`;
		return `${(n / 1e6).toFixed(1)} M`;
	}
</script>

<section class="kv">
	<header class="kv-header">
		<h2 class="kv-h2">🧠 Le KV cache — pourquoi les longs contextes deviennent lents</h2>
		<p class="kv-lead">
			C'est <strong>LA</strong> grande optimisation de l'inférence des LLM.
			Sans elle, générer 1000 tokens serait ~600 fois plus lent. Voyons
			comment.
		</p>
	</header>

	<!-- ==================== ANALOGIE ==================== -->
	<div class="kv-analogy">
		<span class="kv-analogy-emoji">💡</span>
		<div>
			<p>
				<strong>Imagine une longue réunion professionnelle.</strong> À chaque
				nouvelle intervention, est-ce que tu relis <em>toutes</em> tes notes
				depuis le début ? Non : tu <strong>ajoutes</strong> juste la dernière
				phrase à ton cahier, et tu gardes tout le reste en mémoire.
			</p>
			<p>
				Le KV cache, c'est exactement ce réflexe appliqué au Transformer. À
				chaque nouveau token généré, on <strong>ajoute</strong> ses K et V à
				une mémoire GPU, et on <strong>réutilise</strong> tous les précédents.
			</p>
		</div>
	</div>

	<!-- ==================== MINI-LEÇON ==================== -->
	<div class="kv-lesson">
		<div class="kv-block">
			<span class="kv-block-label">🎯 Le problème</span>
			<p>
				Pour calculer l'attention du token N+1, le modèle a besoin des
				<strong>Keys</strong> et <strong>Values</strong> de <em>tous</em> les
				tokens précédents (1…N). Sans optimisation, à chaque nouveau token
				généré, on recalcule <strong>tous</strong> les K et V des N tokens
				précédents — alors qu'ils sont exactement les mêmes qu'avant. Gigantesque gaspillage.
			</p>
		</div>

		<div class="kv-block">
			<span class="kv-block-label">🔧 Le mécanisme</span>
			<p>
				Constat : le <strong>K et le V d'un token ne dépendent QUE de ce
					token</strong> et des poids du modèle. Ils sont
				<strong>invariants</strong> entre les étapes de génération. On les
				stocke donc dans un <strong>cache GPU</strong> dès qu'on les a
				calculés. À l'étape N+1, on calcule seulement les K/V du
				<strong>nouveau</strong> token, et on lit les N précédents depuis le
				cache.
			</p>
		</div>

		<div class="kv-block">
			<span class="kv-block-label">📝 Exemple chiffré — générer 1 000 tokens</span>
			<p>
				<strong>Sans cache</strong> : pour chaque nouveau token i, on
				recalcule les K/V de i tokens. Total : 1 + 2 + … + 1000 ≈
				<strong>500 000 recalculs</strong>.
			</p>
			<p>
				<strong>Avec cache</strong> : on ne calcule que 1 token par étape.
				Total : <strong>1 000 recalculs</strong>.
				<strong class="kv-chip">→ 500× moins de compute</strong>.
			</p>
		</div>

		<div class="kv-block">
			<span class="kv-block-label">⚠️ Attention — la mémoire explose</span>
			<p>
				Le prix du cache : la <strong>mémoire GPU</strong>. Le cache grossit
				linéairement avec la longueur du contexte, et les LLMs modernes ont
				des d_model énormes × beaucoup de couches.
				<strong>C'est le vrai goulot</strong> en déploiement : on fait
				souvent du compute <em>to spare</em>, mais on est bloqué par la VRAM.
			</p>
			<p>
				Exemples concrets (fp16) pour 4 096 tokens de contexte :
			</p>
			<ul class="kv-ex-list">
				<li>GPT-2 small (768 × 12 couches) : <strong>~144 Mo</strong></li>
				<li>LLaMA-7B (4096 × 32 couches) : <strong>~2 Go</strong></li>
				<li>
					LLaMA-70B sans GQA (8192 × 80 couches, 64 têtes) :
					<strong>~10 Go</strong> (pour UN utilisateur)
				</li>
				<li>
					LLaMA-70B <strong>avec GQA</strong> (8 kv-heads) :
					<strong>~1.3 Go</strong> — c'est-à-dire ~8× moins, sans perte de
					qualité significative.
				</li>
			</ul>
		</div>

		<div class="kv-block">
			<span class="kv-block-label">🔗 Relations avec ton corpus</span>
			<p>
				Le papier <strong>GQA</strong> (Ainslie 2023, dans ton corpus !)
				attaque directement ce problème : en partageant les K et V entre
				plusieurs têtes d'attention, on <strong>divise la taille du cache</strong>
				sans perte notable. LLaMA-2 70B, LLaMA-3, Mistral — tous utilisent
				GQA pour cette raison. <strong>vLLM</strong> (que tu rencontres dans
				le livre Kubernetes) y ajoute <em>PagedAttention</em> : une gestion
				mémoire comme un OS, pour servir plusieurs utilisateurs sans
				gaspiller.
			</p>
		</div>
	</div>

	<!-- ==================== VISUALISATION ==================== -->
	<div class="kv-viz">
		<header class="kv-viz-head">
			<div>
				<h3 class="kv-viz-title">Vois la différence en direct</h3>
				<p class="kv-viz-sub">
					Choisis un modèle, bouge le curseur du nombre de tokens générés.
				</p>
			</div>
		</header>

		<!-- Sélection du modèle -->
		<div class="kv-model-picker">
			{#each MODELS as m (m.id)}
				<button
					type="button"
					class="kv-model {modelId === m.id ? 'is-active' : ''}"
					onclick={() => (modelId = m.id)}
				>
					<strong>{m.label}</strong>
					<span class="kv-model-sub">{m.params} · {m.n_layers} couches · d={m.d_model}</span>
				</button>
			{/each}
		</div>

		<!-- Slider N tokens -->
		<div class="kv-slider-row">
			<label for="kv-n">Tokens déjà générés</label>
			<input
				id="kv-n"
				type="range"
				min="1"
				max="40"
				step="1"
				bind:value={N}
				class="kv-slider"
			/>
			<span class="kv-slider-value">N = {N}</span>
		</div>

		<!-- Grilles comparées -->
		<div class="kv-grids">
			<!-- SANS cache -->
			<div class="kv-grid-card">
				<div class="kv-grid-head">
					<span class="kv-grid-title">❌ Sans KV cache</span>
					<span class="kv-grid-hint">tout est recalculé à chaque étape</span>
				</div>
				<div class="kv-grid">
					{#each Array(N) as _, i (i)}
						<div class="kv-cell is-recompute" title="Token {i + 1} — recalculé">
							K V
						</div>
					{/each}
				</div>
				<div class="kv-grid-stats">
					<div class="kv-stat">
						<div class="kv-stat-label">Recalculs à l'étape N+1</div>
						<div class="kv-stat-value">{opsWithoutCache}</div>
					</div>
					<div class="kv-stat">
						<div class="kv-stat-label">Cumul sur {N} étapes</div>
						<div class="kv-stat-value">{fmtOps(totalOpsWithoutCache)}</div>
					</div>
				</div>
			</div>

			<!-- AVEC cache -->
			<div class="kv-grid-card is-solution">
				<div class="kv-grid-head">
					<span class="kv-grid-title">✅ Avec KV cache</span>
					<span class="kv-grid-hint">on ajoute seulement le nouveau token</span>
				</div>
				<div class="kv-grid">
					{#each Array(N) as _, i (i)}
						<div
							class="kv-cell {i === N - 1 ? 'is-new' : 'is-cached'}"
							title={i === N - 1
								? 'Nouveau token — calculé'
								: `Token ${i + 1} — lu depuis le cache`}
						>
							K V
						</div>
					{/each}
				</div>
				<div class="kv-grid-stats">
					<div class="kv-stat">
						<div class="kv-stat-label">Recalculs à l'étape N+1</div>
						<div class="kv-stat-value">{opsWithCache}</div>
					</div>
					<div class="kv-stat">
						<div class="kv-stat-label">Cumul sur {N} étapes</div>
						<div class="kv-stat-value">{fmtOps(totalOpsWithCache)}</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Récap global -->
		<div class="kv-recap">
			<div class="kv-recap-card">
				<div class="kv-recap-label">🚀 Gain en compute</div>
				<div class="kv-recap-value">× {speedup.toFixed(1)}</div>
				<div class="kv-recap-sub">sur les {N} étapes affichées</div>
			</div>
			<div class="kv-recap-card">
				<div class="kv-recap-label">💾 Mémoire cache</div>
				<div class="kv-recap-value">{fmtBytes(cacheMemoryMB)}</div>
				<div class="kv-recap-sub">
					sur {model.label} pour N = {N}
				</div>
			</div>
			<div class="kv-recap-card is-warn">
				<div class="kv-recap-label">📏 Si on va à 4 096 tokens</div>
				<div class="kv-recap-value">{memoryAt4k.toFixed(2)} Go</div>
				<div class="kv-recap-sub">
					{model.n_kv_heads < model.d_model / 64
						? '(avec GQA — déjà optimisé)'
						: '(sans GQA)'}
				</div>
			</div>
		</div>

		<p class="kv-caption">
			👆 Passe de <strong>LLaMA-70B sans GQA</strong> à <strong>LLaMA-70B avec
				GQA</strong> pour voir la mémoire chuter ~8× — c'est pourquoi GQA est
			désormais dans quasi tous les LLM modernes.
		</p>
	</div>
</section>

<style>
	.kv {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 2rem;
		background: linear-gradient(180deg, #f0f9ff 0%, #fff 100%);
		border: 1px solid #e2e8f0;
		border-radius: 1.5rem;
	}

	.kv-header {
		text-align: center;
	}
	.kv-h2 {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0 0 0.5rem;
	}
	.kv-lead {
		color: var(--color-ink-700);
		font-size: 1rem;
		line-height: 1.55;
		margin: 0 auto;
		max-width: 640px;
	}

	.kv-analogy {
		display: flex;
		gap: 1rem;
		background: var(--color-hf-cream);
		border-left: 4px solid var(--color-hf-amber);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}
	.kv-analogy-emoji {
		font-size: 1.75rem;
		flex-shrink: 0;
	}
	.kv-analogy p {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		color: var(--color-ink-900);
		line-height: 1.55;
	}
	.kv-analogy p:last-child {
		margin-bottom: 0;
	}

	/* Mini-leçon blocs */
	.kv-lesson {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.kv-block {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 0.9rem 1.1rem;
	}
	.kv-block-label {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-ink-900);
		margin-bottom: 0.4rem;
	}
	.kv-block p {
		margin: 0 0 0.45rem;
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--color-ink-700);
	}
	.kv-block p:last-child {
		margin-bottom: 0;
	}
	.kv-chip {
		background: var(--color-hf-yellow);
		padding: 0.15rem 0.5rem;
		border-radius: 0.3rem;
		color: var(--color-ink-900);
		font-weight: 700;
	}
	.kv-ex-list {
		margin: 0.3rem 0 0;
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.kv-ex-list li {
		font-size: 0.88rem;
		color: var(--color-ink-700);
	}

	/* Visualisation */
	.kv-viz {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
	}
	.kv-viz-head {
		text-align: center;
	}
	.kv-viz-title {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.kv-viz-sub {
		font-size: 0.85rem;
		color: var(--color-ink-500);
		margin: 0.2rem 0 0;
	}

	.kv-model-picker {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.5rem;
	}
	.kv-model {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.6rem 0.8rem;
		background: #f8fafc;
		border: 2px solid #e2e8f0;
		border-radius: 0.6rem;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
	}
	.kv-model:hover {
		border-color: var(--color-hf-amber);
	}
	.kv-model.is-active {
		background: var(--color-hf-cream);
		border-color: var(--color-hf-amber);
	}
	.kv-model strong {
		font-family: var(--font-display);
		font-size: 0.9rem;
		color: var(--color-ink-900);
	}
	.kv-model-sub {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-ink-500);
	}

	.kv-slider-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.kv-slider-row label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-ink-500);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.kv-slider {
		flex: 1;
		accent-color: var(--color-hf-amber);
	}
	.kv-slider-value {
		background: var(--color-hf-yellow);
		padding: 0.2rem 0.6rem;
		border-radius: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.kv-grids {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.kv-grid-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
	}
	.kv-grid-card.is-solution {
		background: #f0fdf4;
		border-color: #86efac;
	}
	.kv-grid-head {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.kv-grid-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--color-ink-900);
	}
	.kv-grid-hint {
		font-size: 0.75rem;
		color: var(--color-ink-500);
		font-style: italic;
	}
	.kv-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		min-height: 80px;
		padding: 0.5rem;
		background: #fff;
		border-radius: 0.5rem;
	}
	.kv-cell {
		width: 24px;
		height: 24px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 8px;
		font-weight: 700;
		color: rgba(0, 0, 0, 0.6);
	}
	.kv-cell.is-recompute {
		background: #ff9d00;
		color: #fff;
		animation: pulse 1.5s ease-in-out infinite;
	}
	.kv-cell.is-cached {
		background: #fde68a;
		color: var(--color-ink-700);
	}
	.kv-cell.is-new {
		background: #ff9d00;
		color: #fff;
		animation: pulse 1.2s ease-in-out infinite;
		box-shadow: 0 0 0 2px rgba(255, 157, 0, 0.3);
	}
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.kv-grid-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.kv-stat {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.35rem;
		padding: 0.45rem;
		text-align: center;
	}
	.kv-stat-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		color: var(--color-ink-500);
		letter-spacing: 0.05em;
	}
	.kv-stat-value {
		font-family: var(--font-mono);
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin-top: 0.2rem;
	}

	.kv-recap {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.5rem;
	}
	.kv-recap-card {
		padding: 0.75rem;
		background: var(--color-hf-cream);
		border: 1px solid var(--color-hf-amber);
		border-radius: 0.75rem;
		text-align: center;
	}
	.kv-recap-card.is-warn {
		background: #fef3c7;
		border-color: #f59e0b;
	}
	.kv-recap-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--color-ink-500);
		letter-spacing: 0.05em;
	}
	.kv-recap-value {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0.25rem 0;
	}
	.kv-recap-sub {
		font-size: 0.75rem;
		color: var(--color-ink-500);
	}

	.kv-caption {
		text-align: center;
		font-size: 0.85rem;
		font-style: italic;
		color: var(--color-ink-700);
		margin: 0;
	}

	/* Mobile */
	@media (max-width: 700px) {
		.kv {
			padding: 1.25rem;
		}
		.kv-grids {
			grid-template-columns: 1fr;
		}
	}
</style>
