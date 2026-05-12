<!--
	KVCacheCalculator — calculateur interactif de la taille du KV cache.
	Slider modèle + slider context length → taille en MB/GB + comparaison
	avec / sans GQA.

	Formule : KV_size = 2 (K+V) × num_layers × num_kv_heads × head_dim × seq_len × bytes
-->
<script lang="ts">
	interface ModelSpec {
		id: string;
		name: string;
		layers: number;
		num_heads: number; // queries
		num_kv_heads: number; // K/V (peut être < num_heads si GQA)
		head_dim: number;
		params_b: number; // milliards
		hasGQA: boolean;
	}

	const MODELS: ModelSpec[] = [
		{ id: 'gpt2', name: 'GPT-2 small', layers: 12, num_heads: 12, num_kv_heads: 12, head_dim: 64, params_b: 0.124, hasGQA: false },
		{ id: 'llama7b', name: 'Llama 7B (no GQA)', layers: 32, num_heads: 32, num_kv_heads: 32, head_dim: 128, params_b: 6.74, hasGQA: false },
		{ id: 'mistral7b', name: 'Mistral 7B (GQA)', layers: 32, num_heads: 32, num_kv_heads: 8, head_dim: 128, params_b: 7.24, hasGQA: true },
		{ id: 'llama13b', name: 'Llama 13B (no GQA)', layers: 40, num_heads: 40, num_kv_heads: 40, head_dim: 128, params_b: 13, hasGQA: false },
		{ id: 'llama70b', name: 'Llama 2 70B (GQA, 8 kv-heads)', layers: 80, num_heads: 64, num_kv_heads: 8, head_dim: 128, params_b: 70, hasGQA: true },
		{ id: 'mixtral8x7b', name: 'Mixtral 8x7B (GQA)', layers: 32, num_heads: 32, num_kv_heads: 8, head_dim: 128, params_b: 46.7, hasGQA: true }
	];

	let modelId = $state('mistral7b');
	let seqLen = $state(4096);
	let precisionBytes = $state(2); // fp16 = 2 bytes ; fp8 = 1

	const model = $derived(MODELS.find((m) => m.id === modelId) ?? MODELS[0]);

	// Bytes par token = 2 (K+V) × layers × num_kv_heads × head_dim × bytes
	const bytesPerToken = $derived(2 * model.layers * model.num_kv_heads * model.head_dim * precisionBytes);
	const cacheBytes = $derived(bytesPerToken * seqLen);
	const cacheMB = $derived(cacheBytes / 1024 / 1024);
	const cacheGB = $derived(cacheBytes / 1024 / 1024 / 1024);

	// Poids du modèle (approximation: params × precision)
	const weightsBytes = $derived(model.params_b * 1e9 * precisionBytes);
	const weightsGB = $derived(weightsBytes / 1024 / 1024 / 1024);

	// Comparaison "no GQA" (équivalent) : num_kv_heads = num_heads
	const cacheNoGQABytes = $derived(2 * model.layers * model.num_heads * model.head_dim * precisionBytes * seqLen);
	const cacheNoGQAGB = $derived(cacheNoGQABytes / 1024 / 1024 / 1024);
	const gqaSavings = $derived(model.num_heads / model.num_kv_heads);

	function fmt(gb: number): string {
		if (gb < 0.01) return `${(gb * 1024).toFixed(1)} MB`;
		if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
		return `${gb.toFixed(2)} GB`;
	}
</script>

<figure class="kvc">
	<header class="kvc-header">
		<h3 class="kvc-title">🧮 Calculateur KV cache</h3>
		<p class="kvc-desc">
			Choisis un modèle et la longueur de contexte. Vois la taille du KV
			cache (RAM GPU dédiée juste à ça), comparée au poids du modèle. Et le
			gain de GQA quand le modèle en a.
		</p>
	</header>

	<div class="kvc-controls">
		<label class="kvc-label">
			<span>Modèle</span>
			<select bind:value={modelId} class="kvc-select">
				{#each MODELS as m (m.id)}
					<option value={m.id}>{m.name}</option>
				{/each}
			</select>
		</label>
		<label class="kvc-label">
			<span>Longueur de contexte (tokens)</span>
			<input type="range" min="256" max="32768" step="256" bind:value={seqLen} class="kvc-slider" />
			<span class="kvc-val">{seqLen}</span>
		</label>
		<label class="kvc-label">
			<span>Précision</span>
			<select bind:value={precisionBytes} class="kvc-select">
				<option value={4}>fp32 (4 bytes)</option>
				<option value={2}>fp16 / bf16 (2 bytes)</option>
				<option value={1}>fp8 / int8 (1 byte)</option>
			</select>
		</label>
	</div>

	<div class="kvc-formula">
		<div class="kvc-formula-label">📐 Formule</div>
		<div class="kvc-formula-eq">
			<strong>KV cache</strong> = 2 (K+V) × layers × num_kv_heads × head_dim × seq_len × bytes
		</div>
		<div class="kvc-formula-num">
			= 2 × <span class="kvc-h">{model.layers}</span> × <span class="kvc-h">{model.num_kv_heads}</span> × <span class="kvc-h">{model.head_dim}</span> × <span class="kvc-h">{seqLen}</span> × <span class="kvc-h">{precisionBytes}</span> bytes = <strong>{fmt(cacheGB)}</strong>
		</div>
	</div>

	<div class="kvc-stats">
		<div class="kvc-stat kvc-stat-primary">
			<div class="kvc-stat-label">💾 KV cache total</div>
			<div class="kvc-stat-val">{fmt(cacheGB)}</div>
			<div class="kvc-stat-sub">soit {(bytesPerToken / 1024).toFixed(1)} KB/token</div>
		</div>
		<div class="kvc-stat">
			<div class="kvc-stat-label">⚖️ Poids du modèle</div>
			<div class="kvc-stat-val">{fmt(weightsGB)}</div>
			<div class="kvc-stat-sub">~{model.params_b}B params @ {precisionBytes} bytes</div>
		</div>
		<div class="kvc-stat">
			<div class="kvc-stat-label">📊 Ratio cache/modèle</div>
			<div class="kvc-stat-val">{(cacheGB / weightsGB * 100).toFixed(0)}%</div>
			<div class="kvc-stat-sub">du poids du modèle</div>
		</div>
	</div>

	{#if model.hasGQA}
		<div class="kvc-gqa">
			<div class="kvc-gqa-emoji">⚡</div>
			<div>
				<strong>Économie GQA</strong> — Ce modèle utilise <strong>{model.num_kv_heads} kv-heads</strong> pour {model.num_heads} q-heads.
				Sans GQA, le KV cache serait <strong>{fmt(cacheNoGQAGB)}</strong> ({gqaSavings}× plus). GQA divise donc la mémoire requise par <strong>{gqaSavings}</strong>.
			</div>
		</div>
	{:else}
		<div class="kvc-no-gqa">
			<div class="kvc-gqa-emoji">⚠️</div>
			<div>
				<strong>Ce modèle n'utilise pas GQA</strong> — chaque head a son propre K/V.
				Si GQA était appliqué avec 8 kv-heads, le cache serait <strong>{fmt(cacheGB * 8 / model.num_kv_heads)}</strong> au lieu de {fmt(cacheGB)}.
			</div>
		</div>
	{/if}

	<div class="kvc-bars">
		<div class="kvc-bars-title">📏 Comparaison visuelle</div>
		<div class="kvc-bar-row">
			<span class="kvc-bar-label">Poids modèle</span>
			<div class="kvc-bar-track">
				<div class="kvc-bar-fill kvc-bar-weights" style="width: {Math.min(100, weightsGB * 5)}%"></div>
			</div>
			<span class="kvc-bar-val">{fmt(weightsGB)}</span>
		</div>
		<div class="kvc-bar-row">
			<span class="kvc-bar-label">KV cache @ {seqLen}t</span>
			<div class="kvc-bar-track">
				<div class="kvc-bar-fill kvc-bar-cache" style="width: {Math.min(100, cacheGB * 5)}%"></div>
			</div>
			<span class="kvc-bar-val">{fmt(cacheGB)}</span>
		</div>
		{#if model.hasGQA}
			<div class="kvc-bar-row">
				<span class="kvc-bar-label">KV cache sans GQA</span>
				<div class="kvc-bar-track">
					<div class="kvc-bar-fill kvc-bar-warn" style="width: {Math.min(100, cacheNoGQAGB * 5)}%"></div>
				</div>
				<span class="kvc-bar-val">{fmt(cacheNoGQAGB)}</span>
			</div>
		{/if}
	</div>
</figure>

<style>
	.kvc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
	.kvc-header { padding: 0; }
	.kvc-title { font-family: var(--font-display); font-size: 1.1rem; color: var(--color-ink-900); margin: 0 0 0.3rem; }
	.kvc-desc { font-size: 0.88rem; color: var(--color-ink-700); margin: 0; line-height: 1.5; }

	.kvc-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.6rem; }
	.kvc-label { display: flex; flex-direction: column; gap: 0.3rem; font-family: var(--font-mono); font-size: 0.78rem; color: var(--color-ink-700); }
	.kvc-label > span:first-child { font-weight: 600; }
	.kvc-select, .kvc-slider {
		padding: 0.45rem 0.65rem; background: #fff; border: 1px solid #e2e8f0;
		border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.85rem;
	}
	.kvc-slider { padding: 0; height: 6px; accent-color: #06b6d4; }
	.kvc-val { background: #06b6d4; color: #fff; padding: 0.15rem 0.5rem; border-radius: 0.3rem; align-self: flex-start; font-weight: 600; }

	.kvc-formula { padding: 0.85rem 1rem; background: #0f172a; border-radius: 0.5rem; color: #e2e8f0; }
	.kvc-formula-label { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: #facc15; margin-bottom: 0.4rem; }
	.kvc-formula-eq { font-family: var(--font-mono); font-size: 0.85rem; color: #cbd5e1; margin-bottom: 0.35rem; }
	.kvc-formula-num { font-family: var(--font-mono); font-size: 0.82rem; color: #cbd5e1; }
	.kvc-h { background: #facc15; color: #0f172a; padding: 0.05rem 0.35rem; border-radius: 0.2rem; font-weight: 700; }

	.kvc-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem; }
	.kvc-stat { padding: 0.7rem 0.85rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem; text-align: center; }
	.kvc-stat-primary { background: #ecfeff; border-color: #06b6d4; }
	.kvc-stat-label { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: var(--color-ink-500); }
	.kvc-stat-val { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; color: var(--color-ink-900); margin: 0.25rem 0; }
	.kvc-stat-primary .kvc-stat-val { color: #06b6d4; }
	.kvc-stat-sub { font-size: 0.72rem; color: var(--color-ink-500); }

	.kvc-gqa, .kvc-no-gqa {
		display: flex; gap: 0.7rem; padding: 0.85rem 1rem; border-radius: 0.5rem;
		font-size: 0.88rem; line-height: 1.55; color: var(--color-ink-700);
	}
	.kvc-gqa { background: #f0fdf4; border-left: 4px solid #22c55e; }
	.kvc-no-gqa { background: #fef3c7; border-left: 4px solid #f59e0b; }
	.kvc-gqa-emoji { font-size: 1.5rem; flex-shrink: 0; }

	.kvc-bars { padding: 0.85rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem; }
	.kvc-bars-title { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: var(--color-ink-500); margin-bottom: 0.5rem; }
	.kvc-bar-row { display: grid; grid-template-columns: 130px 1fr 80px; gap: 0.6rem; align-items: center; margin: 0.3rem 0; }
	.kvc-bar-label { font-size: 0.82rem; color: var(--color-ink-700); }
	.kvc-bar-track { height: 18px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
	.kvc-bar-fill { height: 100%; transition: width 0.3s; }
	.kvc-bar-weights { background: linear-gradient(90deg, #1e293b 0%, #475569 100%); }
	.kvc-bar-cache { background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%); }
	.kvc-bar-warn { background: linear-gradient(90deg, #fb923c 0%, #ea580c 100%); }
	.kvc-bar-val { font-family: var(--font-mono); font-size: 0.8rem; color: var(--color-ink-700); text-align: right; font-weight: 600; }
</style>
