<!--
	CrossEntropySim — slider sur p (proba prédite du bon token),
	affiche la courbe -log(p) et la valeur de loss correspondante.
-->
<script lang="ts">
	let p = $state(0.7);

	const loss = $derived(-Math.log(p));

	const W = 480;
	const H = 280;
	const padding = { left: 50, right: 20, top: 20, bottom: 40 };
	const plotW = W - padding.left - padding.right;
	const plotH = H - padding.top - padding.bottom;

	// X axis: p from 0.01 to 1
	// Y axis: loss from 0 to 5
	function px(pVal: number): number {
		return padding.left + (pVal - 0.01) * plotW / 0.99;
	}
	function py(lossVal: number): number {
		return padding.top + plotH - Math.min(lossVal, 5) * plotH / 5;
	}

	// Curve points
	const curvePoints = $derived.by(() => {
		const pts: string[] = [];
		for (let pi = 0.01; pi <= 1.001; pi += 0.01) {
			pts.push(`${px(pi)},${py(-Math.log(pi))}`);
		}
		return pts.join(' ');
	});

	const interpretation = $derived.by(() => {
		if (p >= 0.9) return { emoji: '✅', text: 'Excellent — le modèle est très confiant sur le bon token. Loss minimale.' };
		if (p >= 0.5) return { emoji: '🟡', text: 'Acceptable — le modèle hésite. Continue le training.' };
		if (p >= 0.1) return { emoji: '⚠️', text: 'Mauvais — la proba du bon token est faible. Le modèle se trompe souvent.' };
		return { emoji: '💥', text: 'Catastrophique — quasi-aléatoire. Vérifie le dataset.' };
	});
</script>

<div class="ces">
	<div class="ces-controls">
		<label class="ces-label">
			Probabilité prédite du bon token (p)
			<input type="range" min="0.01" max="1" step="0.01" bind:value={p} class="ces-slider" />
			<span class="ces-val">{p.toFixed(2)}</span>
		</label>
	</div>

	<div class="ces-viz">
		<svg viewBox="0 0 {W} {H}">
			<!-- Background -->
			<rect width={W} height={H} fill="#fff" />

			<!-- Axes -->
			<line x1={padding.left} y1={padding.top} x2={padding.left} y2={H - padding.bottom} stroke="#94a3b8" stroke-width="1.5" />
			<line x1={padding.left} y1={H - padding.bottom} x2={W - padding.right} y2={H - padding.bottom} stroke="#94a3b8" stroke-width="1.5" />

			<!-- Y axis labels -->
			{#each [0, 1, 2, 3, 4, 5] as v (v)}
				<line x1={padding.left - 4} y1={py(v)} x2={padding.left} y2={py(v)} stroke="#94a3b8" stroke-width="1" />
				<text x={padding.left - 8} y={py(v) + 4} text-anchor="end" font-family="monospace" font-size="10" fill="#64748b">{v}</text>
			{/each}
			<text x="15" y={padding.top + plotH / 2} font-family="monospace" font-size="11" fill="#475569" transform="rotate(-90 15 {padding.top + plotH / 2})">Loss = -log(p)</text>

			<!-- X axis labels -->
			{#each [0.1, 0.3, 0.5, 0.7, 0.9, 1.0] as v (v)}
				<line x1={px(v)} y1={H - padding.bottom} x2={px(v)} y2={H - padding.bottom + 4} stroke="#94a3b8" stroke-width="1" />
				<text x={px(v)} y={H - padding.bottom + 18} text-anchor="middle" font-family="monospace" font-size="10" fill="#64748b">{v.toFixed(1)}</text>
			{/each}
			<text x={padding.left + plotW / 2} y={H - 6} text-anchor="middle" font-family="monospace" font-size="11" fill="#475569">p (probabilité du bon token)</text>

			<!-- Loss curve -->
			<polyline points={curvePoints} fill="none" stroke="#ff9d00" stroke-width="2.5" />

			<!-- Vertical guide from current p -->
			<line x1={px(p)} y1={H - padding.bottom} x2={px(p)} y2={py(loss)} stroke="#facc15" stroke-width="1.5" stroke-dasharray="3 3" />
			<line x1={padding.left} y1={py(loss)} x2={px(p)} y2={py(loss)} stroke="#facc15" stroke-width="1.5" stroke-dasharray="3 3" />

			<!-- Current point -->
			<circle cx={px(p)} cy={py(loss)} r="7" fill="#ff9d00" stroke="#fff" stroke-width="2" />
			<text x={px(p) + 12} y={py(loss) - 8} font-family="monospace" font-size="11" fill="#1a1a1a" font-weight="700">
				p={p.toFixed(2)}, loss={loss.toFixed(2)}
			</text>
		</svg>
	</div>

	<div class="ces-interp" data-emoji={interpretation.emoji}>
		<span class="ces-interp-emoji">{interpretation.emoji}</span>
		<div>
			<strong>p = {p.toFixed(2)} → loss = {loss.toFixed(3)}</strong> — {interpretation.text}
		</div>
	</div>

	<div class="ces-takeaways">
		<h4>💡 Ce que tu dois retenir</h4>
		<ul>
			<li><strong>p = 1.0</strong> → loss = 0 (modèle parfaitement confiant).</li>
			<li><strong>p = 0.5</strong> → loss = 0.69. Si tu vois cette valeur en moyenne, ton modèle est ~50/50 sur chaque token.</li>
			<li><strong>p = 0.1</strong> → loss = 2.3. Le modèle se trompe la plupart du temps.</li>
			<li><strong>Plus p → 0</strong>, plus la loss <strong>explose</strong>. La courbe est non-linéaire : passer de 0.05 à 0.01 ajoute presque 2 points de loss.</li>
			<li>La loss reportée par Unsloth = moyenne de <code>-log(p)</code> sur tous les tokens du batch.</li>
		</ul>
	</div>
</div>

<style>
	.ces {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.ces-controls { display: flex; }
	.ces-label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-ink-700);
	}
	.ces-slider { flex: 1; accent-color: var(--color-hf-amber); }
	.ces-val {
		background: var(--color-hf-amber);
		color: #fff;
		padding: 0.2rem 0.6rem;
		border-radius: 0.3rem;
		font-weight: 700;
		min-width: 50px;
		text-align: center;
	}

	.ces-viz {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
	}
	.ces-viz svg { width: 100%; height: auto; max-height: 320px; display: block; }

	.ces-interp {
		display: flex;
		gap: 0.7rem;
		padding: 0.85rem 1rem;
		background: #fff;
		border-left: 4px solid var(--color-hf-amber);
		border-radius: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.5;
	}
	.ces-interp-emoji { font-size: 1.5rem; flex-shrink: 0; }

	.ces-takeaways {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
		padding: 1rem;
	}
	.ces-takeaways h4 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--color-ink-900);
	}
	.ces-takeaways ul {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.88rem;
		color: var(--color-ink-700);
		line-height: 1.6;
	}
	.ces-takeaways li { margin: 0.25rem 0; }
	.ces-takeaways code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}
</style>
