<!--
	GradientDescentSim — simulateur interactif de descente de gradient
	sur un paysage de loss 2D, avec contrôle du learning rate.

	Loss : f(x,y) = 0.5·x² + 2·y² (vallée elliptique anisotrope).
	Gradients : ∂f/∂x = x, ∂f/∂y = 4y
	Update     : x ← x(1−lr), y ← y(1−4·lr)
	Stabilité y : converge si |1−4lr| < 1 → 0 < lr < 0.5
	  - lr ∈ [0.01, 0.08] : descente lente
	  - lr ∈ [0.08, 0.22] : sweet spot, convergence smooth
	  - lr ∈ [0.22, 0.45] : oscillation visible sur y (1−4lr est négatif)
	  - lr ≥ 0.5         : divergence sur y (|1−4lr| ≥ 1)
-->
<script lang="ts">
	const START_X = 8;
	const START_Y = 4;

	let lr = $state(0.15);
	let posX = $state(START_X);
	let posY = $state(START_Y);
	let trajectory = $state<{ x: number; y: number }[]>([{ x: START_X, y: START_Y }]);
	let isPlaying = $state(false);
	let diverged = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	// f(x,y) = 0.5x² + 2y²
	function loss(x: number, y: number): number {
		return 0.5 * x * x + 2 * y * y;
	}

	function step() {
		if (diverged) return;
		const gradX = posX;
		const gradY = 4 * posY;
		const newX = posX - lr * gradX;
		const newY = posY - lr * gradY;
		if (Math.abs(newX) > 14 || Math.abs(newY) > 7 || !isFinite(newX) || !isFinite(newY)) {
			diverged = true;
			isPlaying = false;
			if (playInterval) clearInterval(playInterval);
			return;
		}
		posX = newX;
		posY = newY;
		trajectory = [...trajectory.slice(-100), { x: posX, y: posY }];
	}

	function reset() {
		if (playInterval) clearInterval(playInterval);
		isPlaying = false;
		diverged = false;
		posX = START_X;
		posY = START_Y;
		trajectory = [{ x: posX, y: posY }];
	}

	function togglePlay() {
		if (diverged) reset();
		if (isPlaying) {
			isPlaying = false;
			if (playInterval) clearInterval(playInterval);
		} else {
			isPlaying = true;
			playInterval = setInterval(step, 220);
		}
	}

	// Reset automatique quand on change le LR
	$effect(() => {
		lr;
		reset();
	});

	const currentLoss = $derived(loss(posX, posY));
	const stepCount = $derived(trajectory.length - 1);

	// Conversion coordonnées : x ∈ [-12, 12] → 0..W, y ∈ [-6, 6] → 0..H
	const W = 520;
	const H = 320;
	function px(x: number): number {
		return W / 2 + (x * W) / 24;
	}
	function py(y: number): number {
		return H / 2 - (y * H) / 12;
	}

	// Verdict pédagogique
	const verdict = $derived.by(() => {
		if (lr < 0.08)
			return {
				emoji: '🐢',
				title: 'Trop bas',
				text: "La descente est très lente. Tu vas brûler du compute pour rien — il faut beaucoup de steps pour atteindre le minimum.",
				color: '#94a3b8'
			};
		if (lr <= 0.22)
			return {
				emoji: '✅',
				title: 'Sweet spot',
				text: 'Descente smooth, convergence rapide et stable vers le minimum. C\'est ce qu\'on veut.',
				color: '#22c55e'
			};
		if (lr <= 0.45)
			return {
				emoji: '⚠️',
				title: 'Oscillation visible',
				text: "La trajectoire zigzague sur l'axe y (1−4·lr devient négatif). Le modèle apprend mais avec du bruit. Borderline.",
				color: '#fb923c'
			};
		return {
			emoji: '💥',
			title: 'Divergence',
			text: "La loss explose, la bille sort du paysage. En vrai training : NaN. Diviser le learning rate par 2 et relancer.",
			color: '#dc2626'
		};
	});
</script>

<div class="gds">
	<div class="gds-controls">
		<label class="gds-label">
			Learning rate
			<input type="range" min="0.01" max="0.60" step="0.01" bind:value={lr} class="gds-slider" />
			<span class="gds-val">{lr.toFixed(2)}</span>
		</label>
		<button type="button" class="gds-btn gds-btn-play" onclick={togglePlay}>
			{isPlaying ? '⏸ Pause' : '▶ Animer'}
		</button>
		<button type="button" class="gds-btn" onclick={step} disabled={diverged}>Pas suivant</button>
		<button type="button" class="gds-btn gds-btn-reset" onclick={reset}>↻ Reset</button>
	</div>

	<div class="gds-viz">
		<svg viewBox="0 0 {W} {H}">
			<defs>
				<radialGradient id="gds-bowl" cx="50%" cy="50%" rx="50%" ry="50%">
					<stop offset="0%" stop-color="#22c55e" stop-opacity="0.6" />
					<stop offset="50%" stop-color="#facc15" stop-opacity="0.3" />
					<stop offset="100%" stop-color="#dc2626" stop-opacity="0.15" />
				</radialGradient>
			</defs>

			<rect width={W} height={H} fill="#0f172a" />
			<ellipse cx={W / 2} cy={H / 2} rx={W / 2 - 10} ry={H / 2 - 10} fill="url(#gds-bowl)" />

			<!-- Contours : 0.5x² + 2y² = c. Demi-axes : √(2c) sur x, √(c/2) sur y. -->
			{#each [0.5, 2, 5, 10, 20, 40, 72] as c (c)}
				<ellipse
					cx={W / 2}
					cy={H / 2}
					rx={Math.sqrt(2 * c) * (W / 24)}
					ry={Math.sqrt(c / 2) * (H / 12)}
					fill="none"
					stroke="#475569"
					stroke-width="0.8"
					stroke-dasharray="2 2"
				/>
			{/each}

			<line x1={W / 2} y1="0" x2={W / 2} y2={H} stroke="#334155" stroke-width="0.5" />
			<line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#334155" stroke-width="0.5" />

			<circle cx={W / 2} cy={H / 2} r="5" fill="#22c55e" stroke="#fff" stroke-width="1.5" />
			<text x={W / 2 + 12} y={H / 2 - 6} font-family="monospace" font-size="10" fill="#22c55e">min (loss = 0)</text>

			{#if trajectory.length > 1}
				<polyline
					points={trajectory.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
					fill="none"
					stroke="#ff9d00"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<!-- Petits points sur chaque step pour visualiser la vitesse -->
				{#each trajectory as p, i (i)}
					{#if i > 0 && i < trajectory.length - 1}
						<circle cx={px(p.x)} cy={py(p.y)} r="2.5" fill="#ff9d00" opacity={0.6} />
					{/if}
				{/each}
			{/if}

			<circle cx={px(posX)} cy={py(posY)} r="9" fill={diverged ? '#dc2626' : '#ff9d00'} stroke="#fff" stroke-width="2">
				{#if !diverged}
					<animate attributeName="r" values="9;11;9" dur="0.9s" repeatCount="indefinite" />
				{/if}
			</circle>
			<text x={px(posX) + 14} y={py(posY) + 4} font-family="monospace" font-size="10" fill={diverged ? '#dc2626' : '#ff9d00'}>
				({posX.toFixed(2)}, {posY.toFixed(2)})
			</text>

			{#if diverged}
				<text x={W / 2} y="25" text-anchor="middle" font-family="monospace" font-size="14" fill="#dc2626" font-weight="700">
					💥 DIVERGENCE — la bille est sortie du paysage
				</text>
			{/if}
		</svg>
	</div>

	<div class="gds-stats">
		<div class="gds-stat">
			<div class="gds-stat-label">Step</div>
			<div class="gds-stat-val">{stepCount}</div>
		</div>
		<div class="gds-stat">
			<div class="gds-stat-label">Loss actuelle</div>
			<div class="gds-stat-val">{diverged ? '∞' : currentLoss.toFixed(3)}</div>
		</div>
		<div class="gds-stat">
			<div class="gds-stat-label">Gradient |∇L|</div>
			<div class="gds-stat-val gds-stat-val-small">{Math.sqrt(posX * posX + 16 * posY * posY).toFixed(2)}</div>
		</div>
	</div>

	<div class="gds-verdict" style="border-left-color: {verdict.color}; background: {verdict.color}1a;">
		<span class="gds-verdict-emoji">{verdict.emoji}</span>
		<div>
			<strong style="color: {verdict.color}">{verdict.title}</strong> (LR = {lr.toFixed(2)}, facteur sur y = {(1 - 4 * lr).toFixed(2)}) — {verdict.text}
		</div>
	</div>

	<div class="gds-hint">
		💡 <strong>Essaye dans cet ordre</strong> : commence à <strong>LR = 0.05</strong>
		(▶ Animer, descente lente), puis <strong>0.15</strong> (sweet spot), puis
		<strong>0.30</strong> (oscillation visible sur l'axe y), puis
		<strong>0.55</strong> (la bille sort du paysage en quelques steps =
		divergence).
	</div>
</div>

<style>
	.gds {
		background: #0f172a;
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.gds-controls {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.gds-label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: #cbd5e1;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		flex: 1;
		min-width: 280px;
	}
	.gds-slider { flex: 1; accent-color: #ff9d00; }
	.gds-val {
		background: #ff9d00;
		color: #0f172a;
		padding: 0.2rem 0.6rem;
		border-radius: 0.3rem;
		font-weight: 700;
		min-width: 50px;
		text-align: center;
	}
	.gds-btn {
		padding: 0.5rem 1rem;
		background: #1e293b;
		border: 1px solid #475569;
		border-radius: 999px;
		color: #cbd5e1;
		font-family: var(--font-mono);
		font-size: 0.82rem;
		cursor: pointer;
	}
	.gds-btn:hover { border-color: #ff9d00; color: #fff; }
	.gds-btn-reset { color: #94a3b8; }

	.gds-viz {
		background: #1e293b;
		border-radius: 0.6rem;
		padding: 0.5rem;
	}
	.gds-viz svg { width: 100%; height: auto; max-height: 360px; display: block; }

	.gds-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.5rem;
	}
	.gds-stat {
		background: #1e293b;
		padding: 0.65rem 0.85rem;
		border-radius: 0.5rem;
	}
	.gds-stat-label {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		color: #94a3b8;
	}
	.gds-stat-val {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 700;
		color: #ff9d00;
		margin-top: 0.2rem;
	}
	.gds-stat-val-small { font-size: 0.9rem; }

	.gds-verdict {
		display: flex;
		gap: 0.7rem;
		padding: 0.85rem 1rem;
		border-left: 4px solid;
		border-radius: 0.5rem;
		font-size: 0.9rem;
		color: #cbd5e1;
		line-height: 1.5;
	}
	.gds-verdict-emoji { font-size: 1.5rem; flex-shrink: 0; }

	.gds-btn-play {
		background: #ff9d00; border-color: #ff9d00; color: #0f172a; font-weight: 600;
	}
	.gds-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.gds-hint {
		padding: 0.7rem 0.95rem;
		background: #1e293b;
		border: 1px dashed #475569;
		border-radius: 0.5rem;
		font-size: 0.85rem;
		color: #cbd5e1;
		line-height: 1.6;
	}
	.gds-hint strong { color: #facc15; }
</style>
