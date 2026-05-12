<!--
	LossCurveSim — affiche les courbes de loss simulées pour 4
	configurations de learning rate. Pré-calculé pour une démo
	pédagogique claire.
-->
<script lang="ts">
	type Scenario = 'too-low' | 'sweet' | 'too-high' | 'nan';
	let scenario = $state<Scenario>('sweet');

	interface Config {
		id: Scenario;
		name: string;
		emoji: string;
		lr: string;
		verdict: string;
		color: string;
		// 60 points de loss
		curve: number[];
	}

	function generateCurve(id: Scenario): number[] {
		const pts: number[] = [];
		const N = 60;
		for (let i = 0; i < N; i++) {
			let l: number;
			if (id === 'too-low') {
				l = 2.4 * Math.exp(-i / 90) + 0.05 * Math.sin(i / 8);
			} else if (id === 'sweet') {
				l = 2.4 * Math.exp(-i / 18) + 0.5 + 0.04 * Math.sin(i / 4);
			} else if (id === 'too-high') {
				// monte puis oscille fort
				if (i < 8) l = 2.4 + i * 0.3;
				else l = 4.5 + 1.8 * Math.sin(i / 3) + (Math.random() - 0.5) * 0.4;
			} else {
				// NaN — explose
				if (i < 5) l = 2.4 + i * 0.8;
				else if (i < 12) l = 8 + i * 1.5;
				else l = NaN;
			}
			pts.push(l);
		}
		return pts;
	}

	const CONFIGS: Record<Scenario, Config> = {
		'too-low': {
			id: 'too-low',
			name: 'Trop bas',
			emoji: '🐢',
			lr: 'LR = 1e-5',
			verdict: 'Convergence très lente. Au step 60, on est encore à ~1.6 — il faudrait 500+ steps pour finir. Tu paies du compute pour rien.',
			color: '#94a3b8',
			curve: generateCurve('too-low')
		},
		sweet: {
			id: 'sweet',
			name: 'Sweet spot',
			emoji: '✅',
			lr: 'LR = 2e-4 (défaut)',
			verdict: 'Descente smooth, atterrit ~0.7 après 60 steps. La courbe attendue d\'un training sain.',
			color: '#22c55e',
			curve: generateCurve('sweet')
		},
		'too-high': {
			id: 'too-high',
			name: 'Trop haut',
			emoji: '⚠️',
			lr: 'LR = 5e-3',
			verdict: 'Instabilité visible — la loss monte et oscille violemment. Le modèle apprend mal, gradients trop grands.',
			color: '#fb923c',
			curve: generateCurve('too-high')
		},
		nan: {
			id: 'nan',
			name: 'Catastrophe',
			emoji: '💥',
			lr: 'LR = 5e-2',
			verdict: 'Explosion. Au step 12 on tombe en NaN — le training est mort. Toujours diviser LR par 2 et relancer.',
			color: '#dc2626',
			curve: generateCurve('nan')
		}
	};

	const current = $derived(CONFIGS[scenario]);

	const W = 520;
	const H = 280;
	const pad = { l: 45, r: 15, t: 20, b: 35 };
	const plotW = W - pad.l - pad.r;
	const plotH = H - pad.t - pad.b;

	function px(i: number): number {
		return pad.l + (i * plotW) / 59;
	}
	function py(loss: number): number {
		// Y: 0 à 12
		if (isNaN(loss)) return pad.t;
		return pad.t + plotH - Math.min(loss, 12) * plotH / 12;
	}

	const curvePoints = $derived.by(() => {
		const valid = current.curve.map((l, i) => ({ i, l })).filter((p) => !isNaN(p.l));
		return valid.map((p) => `${px(p.i)},${py(p.l)}`).join(' ');
	});

	const hasNaN = $derived(current.curve.some((l) => isNaN(l)));
	const nanStep = $derived(current.curve.findIndex((l) => isNaN(l)));
</script>

<div class="lcs">
	<div class="lcs-tabs">
		{#each Object.values(CONFIGS) as cfg (cfg.id)}
			<button
				type="button"
				class="lcs-tab {scenario === cfg.id ? 'is-active' : ''}"
				style="--cfg-color: {cfg.color};"
				onclick={() => (scenario = cfg.id)}
			>
				<span>{cfg.emoji}</span>
				<div class="lcs-tab-body">
					<strong>{cfg.name}</strong>
					<span>{cfg.lr}</span>
				</div>
			</button>
		{/each}
	</div>

	<div class="lcs-viz">
		<svg viewBox="0 0 {W} {H}">
			<rect width={W} height={H} fill="#fff" />

			<!-- Axes -->
			<line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#94a3b8" stroke-width="1.5" />
			<line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#94a3b8" stroke-width="1.5" />

			<!-- Y axis labels -->
			{#each [0, 2, 4, 6, 8, 10, 12] as v (v)}
				<line x1={pad.l - 4} y1={py(v)} x2={pad.l} y2={py(v)} stroke="#94a3b8" stroke-width="1" />
				<text x={pad.l - 7} y={py(v) + 4} text-anchor="end" font-family="monospace" font-size="10" fill="#64748b">{v}</text>
			{/each}
			<text x="12" y={pad.t + plotH / 2} font-family="monospace" font-size="11" fill="#475569" transform="rotate(-90 12 {pad.t + plotH / 2})">Loss</text>

			<!-- X axis labels -->
			{#each [0, 15, 30, 45, 60] as v (v)}
				<line x1={px(v)} y1={H - pad.b} x2={px(v)} y2={H - pad.b + 4} stroke="#94a3b8" stroke-width="1" />
				<text x={px(v)} y={H - pad.b + 16} text-anchor="middle" font-family="monospace" font-size="10" fill="#64748b">{v}</text>
			{/each}
			<text x={pad.l + plotW / 2} y={H - 6} text-anchor="middle" font-family="monospace" font-size="11" fill="#475569">Step</text>

			<!-- Reference dashed line at 0.7 (sweet target) -->
			<line x1={pad.l} y1={py(0.7)} x2={W - pad.r} y2={py(0.7)} stroke="#22c55e" stroke-width="1" stroke-dasharray="4 4" opacity="0.5" />
			<text x={W - pad.r - 4} y={py(0.7) - 4} text-anchor="end" font-family="monospace" font-size="9" fill="#22c55e">target ~0.7</text>

			<!-- Curve -->
			<polyline points={curvePoints} fill="none" stroke={current.color} stroke-width="2.5" />

			<!-- NaN marker -->
			{#if hasNaN}
				<line x1={px(nanStep)} y1={pad.t} x2={px(nanStep)} y2={H - pad.b} stroke="#dc2626" stroke-width="2" stroke-dasharray="4 2" />
				<text x={px(nanStep) + 4} y={pad.t + 20} font-family="monospace" font-size="11" fill="#dc2626" font-weight="700">💥 NaN au step {nanStep}</text>
			{/if}
		</svg>
	</div>

	<div class="lcs-verdict" style="border-left-color: {current.color}; background: {current.color}10;">
		<span class="lcs-verdict-emoji">{current.emoji}</span>
		<div>
			<strong style="color: {current.color}">{current.name}</strong> — {current.verdict}
		</div>
	</div>
</div>

<style>
	.lcs {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.lcs-tabs {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.5rem;
	}
	.lcs-tab {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.6rem 0.85rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 0.6rem;
		cursor: pointer;
		font-size: 0.85rem;
	}
	.lcs-tab:hover { border-color: var(--cfg-color); }
	.lcs-tab.is-active {
		background: var(--cfg-color);
		border-color: var(--cfg-color);
		color: #fff;
	}
	.lcs-tab > span:first-child { font-size: 1.3rem; }
	.lcs-tab-body { display: flex; flex-direction: column; text-align: left; }
	.lcs-tab-body strong {
		font-family: var(--font-display);
		font-size: 0.92rem;
	}
	.lcs-tab-body span {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		opacity: 0.8;
	}

	.lcs-viz {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
	}
	.lcs-viz svg { width: 100%; height: auto; max-height: 320px; display: block; }

	.lcs-verdict {
		display: flex;
		gap: 0.7rem;
		padding: 0.85rem 1rem;
		border-left: 4px solid;
		border-radius: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.5;
	}
	.lcs-verdict-emoji { font-size: 1.5rem; flex-shrink: 0; }
</style>
