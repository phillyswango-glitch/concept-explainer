<!--
	PagedAttentionSim — simulation interactive d'allocation mémoire
	KV cache : Naive (contigu, max-size reservation) vs PagedAttention (blocks).

	5 requêtes arrivent sur clic. Côte à côte tu vois :
	  - Naive : chaque requête réserve un bloc CONTIGU de taille max (8 blocs).
	    Même si elle n'utilise que 3 blocs, les 5 autres sont "réservés mais vides".
	  - Paged : chaque requête prend exactement N blocs (n'importe où, pas
	    forcément contigus). Pas de gaspillage.

	À la 5ᵉ requête, le mode Naive est plein (32 blocs réservés / 14 réellement
	utilisés) → impossible d'accepter une nouvelle requête. Le mode Paged
	a encore 18 blocs libres et accepte facilement.
-->
<script lang="ts">
	const TOTAL_BLOCKS = 32; // mémoire totale
	const MAX_TOKENS_PER_REQUEST = 8; // max tokens (= blocs) qu'une requête peut atteindre
	const BLOCK_SIZE = 1; // 1 token par bloc (pour simplifier la viz)

	interface Request {
		id: number;
		length: number; // nb de tokens (blocs) effectivement utilisés
		color: string;
	}

	const COLORS = ['#a855f7', '#06b6d4', '#22c55e', '#fb923c', '#facc15', '#ec4899', '#3b82f6'];

	// Séquence pré-définie de requêtes pour reproductibilité pédagogique
	const REQUEST_SEQUENCE: { length: number }[] = [
		{ length: 3 }, // R1: utilise 3 blocs, naive en réserve 8
		{ length: 6 }, // R2: utilise 6 blocs, naive en réserve 8
		{ length: 2 }, // R3: utilise 2 blocs, naive en réserve 8
		{ length: 4 }, // R4: utilise 4 blocs, naive en réserve 8 (total naive: 32 = full)
		{ length: 5 }, // R5: 5 blocs, naive REFUSE (plus de place), paged accepte
		{ length: 3 } // R6: 3 blocs, idem
	];

	let requests = $state<Request[]>([]);
	let naiveRefused = $state<number[]>([]); // ids refusés en mode naive

	function addRequest() {
		if (requests.length >= REQUEST_SEQUENCE.length) return;
		const next = REQUEST_SEQUENCE[requests.length];
		const id = requests.length + 1;
		const color = COLORS[(id - 1) % COLORS.length];
		// Vérifie si naive peut l'accepter
		const naiveReserved = requests.length * MAX_TOKENS_PER_REQUEST;
		if (naiveReserved + MAX_TOKENS_PER_REQUEST > TOTAL_BLOCKS) {
			naiveRefused = [...naiveRefused, id];
		}
		requests = [...requests, { id, length: next.length, color }];
	}

	function reset() {
		requests = [];
		naiveRefused = [];
	}

	// === NAIVE MODE ===
	// Chaque requête réserve un bloc contigu de MAX_TOKENS_PER_REQUEST.
	// On marque utilisés (couleur pleine) vs réservés-vides (couleur translucide).
	function naiveBlocks(): { owner: number | null; used: boolean }[] {
		const blocks: { owner: number | null; used: boolean }[] = Array(TOTAL_BLOCKS)
			.fill(null)
			.map(() => ({ owner: null, used: false }));
		// On itère les requêtes acceptées en naive (= pas dans naiveRefused)
		const accepted = requests.filter((r) => !naiveRefused.includes(r.id));
		accepted.forEach((req, idx) => {
			const start = idx * MAX_TOKENS_PER_REQUEST;
			for (let i = 0; i < MAX_TOKENS_PER_REQUEST; i++) {
				if (start + i >= TOTAL_BLOCKS) break;
				blocks[start + i] = {
					owner: req.id,
					used: i < req.length
				};
			}
		});
		return blocks;
	}

	// === PAGED MODE ===
	// Chaque requête prend exactement req.length blocs (n'importe où, ici on les place séquentiellement libres).
	function pagedBlocks(): { owner: number | null; used: boolean }[] {
		const blocks: { owner: number | null; used: boolean }[] = Array(TOTAL_BLOCKS)
			.fill(null)
			.map(() => ({ owner: null, used: false }));
		let cursor = 0;
		for (const req of requests) {
			for (let i = 0; i < req.length; i++) {
				if (cursor >= TOTAL_BLOCKS) break;
				blocks[cursor] = { owner: req.id, used: true };
				cursor++;
			}
		}
		return blocks;
	}

	const naiveData = $derived(naiveBlocks());
	const pagedData = $derived(pagedBlocks());

	function ownerColor(ownerId: number | null): string | null {
		if (ownerId === null) return null;
		const req = requests.find((r) => r.id === ownerId);
		return req?.color ?? null;
	}

	// Stats
	const naiveStats = $derived.by(() => {
		const accepted = requests.length - naiveRefused.length;
		const reserved = accepted * MAX_TOKENS_PER_REQUEST;
		const used = requests
			.filter((r) => !naiveRefused.includes(r.id))
			.reduce((a, r) => a + r.length, 0);
		const wasted = reserved - used;
		const free = TOTAL_BLOCKS - reserved;
		const util = TOTAL_BLOCKS > 0 ? (used / TOTAL_BLOCKS) * 100 : 0;
		return { accepted, reserved, used, wasted, free, util, refused: naiveRefused.length };
	});

	const pagedStats = $derived.by(() => {
		const used = requests.reduce((a, r) => a + r.length, 0);
		const free = TOTAL_BLOCKS - used;
		const util = TOTAL_BLOCKS > 0 ? (used / TOTAL_BLOCKS) * 100 : 0;
		return { accepted: requests.length, used, free, util, refused: 0 };
	});
</script>

<figure class="pas">
	<header class="pas-header">
		<h3 class="pas-title">🧪 Simulation : 32 blocs mémoire, 6 requêtes</h3>
		<p class="pas-desc">
			Chaque requête peut produire jusqu'à <strong>{MAX_TOKENS_PER_REQUEST} tokens</strong>.
			Clique « + Ajouter une requête » pour voir l'allocation se faire en
			temps réel — à gauche en mode Naive, à droite en mode PagedAttention.
		</p>
	</header>

	<div class="pas-controls">
		<button type="button" class="pas-btn pas-btn-add" onclick={addRequest} disabled={requests.length >= REQUEST_SEQUENCE.length}>
			+ Ajouter une requête {requests.length < REQUEST_SEQUENCE.length ? `(R${requests.length + 1}, ${REQUEST_SEQUENCE[requests.length].length} tokens)` : '(toutes envoyées)'}
		</button>
		<button type="button" class="pas-btn" onclick={reset}>↻ Reset</button>
	</div>

	<div class="pas-grids">
		<!-- ============ NAIVE ============ -->
		<div class="pas-mode">
			<div class="pas-mode-head">
				<span class="pas-mode-emoji">❌</span>
				<div>
					<div class="pas-mode-title">Naive (allocation contiguë max-size)</div>
					<div class="pas-mode-sub">Réserve {MAX_TOKENS_PER_REQUEST} blocs par requête, même si peu utilisés</div>
				</div>
			</div>

			<div class="pas-memory">
				{#each naiveData as block, i (i)}
					<div
						class="pas-cell {block.used ? 'is-used' : block.owner !== null ? 'is-reserved' : 'is-free'}"
						style={block.owner !== null ? `background-color: ${block.used ? ownerColor(block.owner) : ownerColor(block.owner) + '33'}; border-color: ${ownerColor(block.owner)};` : ''}
						title={block.owner !== null ? (block.used ? `R${block.owner} (utilisé)` : `R${block.owner} (réservé vide)`) : 'libre'}
					></div>
				{/each}
			</div>

			<div class="pas-stats">
				<div class="pas-stat">
					<div class="pas-stat-label">Acceptées</div>
					<div class="pas-stat-val">{naiveStats.accepted}/{requests.length}</div>
				</div>
				<div class="pas-stat">
					<div class="pas-stat-label">Réservés</div>
					<div class="pas-stat-val">{naiveStats.reserved} / {TOTAL_BLOCKS}</div>
				</div>
				<div class="pas-stat">
					<div class="pas-stat-label">Réellement utilisés</div>
					<div class="pas-stat-val">{naiveStats.used}</div>
				</div>
				<div class="pas-stat pas-stat-bad">
					<div class="pas-stat-label">Gaspillage</div>
					<div class="pas-stat-val">{naiveStats.wasted} blocs</div>
				</div>
				<div class="pas-stat">
					<div class="pas-stat-label">Utilisation</div>
					<div class="pas-stat-val">{naiveStats.util.toFixed(0)}%</div>
				</div>
				{#if naiveStats.refused > 0}
					<div class="pas-stat pas-stat-failed">
						<div class="pas-stat-label">❌ REFUSÉES</div>
						<div class="pas-stat-val">{naiveStats.refused}</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- ============ PAGED ============ -->
		<div class="pas-mode pas-mode-win">
			<div class="pas-mode-head">
				<span class="pas-mode-emoji">✅</span>
				<div>
					<div class="pas-mode-title">PagedAttention (allocation par blocs)</div>
					<div class="pas-mode-sub">Alloue exactement le nb de blocs nécessaires, n'importe où en mémoire</div>
				</div>
			</div>

			<div class="pas-memory">
				{#each pagedData as block, i (i)}
					<div
						class="pas-cell {block.used ? 'is-used' : 'is-free'}"
						style={block.owner !== null ? `background-color: ${ownerColor(block.owner)}; border-color: ${ownerColor(block.owner)};` : ''}
						title={block.owner !== null ? `R${block.owner}` : 'libre'}
					></div>
				{/each}
			</div>

			<div class="pas-stats">
				<div class="pas-stat pas-stat-good">
					<div class="pas-stat-label">Acceptées</div>
					<div class="pas-stat-val">{pagedStats.accepted}/{requests.length}</div>
				</div>
				<div class="pas-stat">
					<div class="pas-stat-label">Utilisés</div>
					<div class="pas-stat-val">{pagedStats.used} / {TOTAL_BLOCKS}</div>
				</div>
				<div class="pas-stat pas-stat-good">
					<div class="pas-stat-label">Libres</div>
					<div class="pas-stat-val">{pagedStats.free}</div>
				</div>
				<div class="pas-stat pas-stat-good">
					<div class="pas-stat-label">Utilisation</div>
					<div class="pas-stat-val">{pagedStats.util.toFixed(0)}%</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Légende -->
	<div class="pas-legend">
		<div class="pas-leg">
			<div class="pas-leg-sq pas-leg-used" style="background:#a855f7"></div>
			Bloc utilisé (vrais tokens)
		</div>
		<div class="pas-leg">
			<div class="pas-leg-sq pas-leg-reserved" style="background:rgba(168, 85, 247, 0.2); border-color:#a855f7"></div>
			Bloc réservé mais vide (gaspillage en Naive)
		</div>
		<div class="pas-leg">
			<div class="pas-leg-sq pas-leg-free"></div>
			Bloc libre
		</div>
	</div>

	<!-- Requêtes -->
	{#if requests.length > 0}
		<div class="pas-requests">
			<div class="pas-req-title">📋 Requêtes envoyées</div>
			<div class="pas-req-list">
				{#each requests as r (r.id)}
					<div class="pas-req" class:is-refused={naiveRefused.includes(r.id)}>
						<span class="pas-req-color" style="background: {r.color}"></span>
						<strong>R{r.id}</strong>
						<span>· {r.length} tokens</span>
						{#if naiveRefused.includes(r.id)}
							<span class="pas-req-tag">❌ Refusée en Naive · Acceptée en Paged</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Insight -->
	{#if requests.length >= 4}
		<div class="pas-insight">
			<span class="pas-insight-emoji">💡</span>
			<div>
				<strong>Ce que tu vois</strong> — Après {requests.length} requêtes :
				<strong>Naive</strong> a {naiveStats.reserved} blocs réservés (dont
				<strong>{naiveStats.wasted} de gaspillage</strong>) et seulement
				<strong>{naiveStats.util.toFixed(0)}%</strong> d'utilisation réelle.
				<strong>Paged</strong> a {pagedStats.util.toFixed(0)}% d'utilisation,
				{pagedStats.free} blocs libres encore.
				{#if naiveRefused.length > 0}
					<strong style="color:#fb923c">Naive a déjà refusé {naiveRefused.length} requête{naiveRefused.length > 1 ? 's' : ''}</strong> alors que la mémoire effective est largement disponible.
				{/if}
			</div>
		</div>
	{/if}
</figure>

<style>
	.pas {
		background: #0f172a; border-radius: 1rem; padding: 1.25rem;
		display: flex; flex-direction: column; gap: 0.85rem;
	}
	.pas-header { padding: 0; }
	.pas-title { font-family: var(--font-display); font-size: 1.1rem; color: #facc15; margin: 0 0 0.3rem; }
	.pas-desc { font-size: 0.88rem; color: #cbd5e1; line-height: 1.5; margin: 0; }
	.pas-controls { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.pas-btn {
		padding: 0.55rem 1.1rem; background: #1e293b; border: 1px solid #475569;
		border-radius: 999px; color: #cbd5e1; font-family: var(--font-mono); font-size: 0.82rem;
		cursor: pointer;
	}
	.pas-btn-add { background: #06b6d4; border-color: #06b6d4; color: #0f172a; font-weight: 600; }
	.pas-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.pas-grids { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
	@media (max-width: 720px) { .pas-grids { grid-template-columns: 1fr; } }

	.pas-mode {
		padding: 1rem; background: #1e293b; border-radius: 0.75rem;
		border-left: 4px solid #dc2626;
		display: flex; flex-direction: column; gap: 0.65rem;
	}
	.pas-mode-win { border-left-color: #22c55e; }
	.pas-mode-head { display: flex; gap: 0.6rem; align-items: center; }
	.pas-mode-emoji { font-size: 1.5rem; }
	.pas-mode-title { font-family: var(--font-display); font-weight: 700; color: #e2e8f0; font-size: 0.95rem; }
	.pas-mode-sub { font-size: 0.78rem; color: #94a3b8; }

	.pas-memory {
		display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px;
		padding: 0.5rem; background: #0f172a; border-radius: 0.5rem;
	}
	.pas-cell {
		aspect-ratio: 1; border: 1.5px solid #334155; border-radius: 3px;
		transition: all 0.3s ease;
	}
	.pas-cell.is-used { /* color set inline */ }
	.pas-cell.is-reserved { /* color set inline */ }
	.pas-cell.is-free { background: transparent; border-color: #334155; }

	.pas-stats {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(85px, 1fr)); gap: 0.4rem;
	}
	.pas-stat {
		padding: 0.4rem 0.5rem; background: #0f172a; border-radius: 0.35rem;
		text-align: center;
	}
	.pas-stat-label {
		font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase;
		color: #94a3b8; letter-spacing: 0.05em;
	}
	.pas-stat-val {
		font-family: var(--font-display); font-size: 1rem; font-weight: 700;
		color: #e2e8f0; margin-top: 0.2rem;
	}
	.pas-stat-good { background: #14321a; }
	.pas-stat-good .pas-stat-val { color: #4ade80; }
	.pas-stat-bad { background: #321a14; }
	.pas-stat-bad .pas-stat-val { color: #fb923c; }
	.pas-stat-failed { background: #320e14; border: 1px solid #dc2626; }
	.pas-stat-failed .pas-stat-val { color: #f87171; }

	.pas-legend { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; color: #cbd5e1; padding: 0.5rem 0.85rem; background: #1e293b; border-radius: 0.5rem; }
	.pas-leg { display: flex; align-items: center; gap: 0.4rem; }
	.pas-leg-sq { width: 16px; height: 16px; border: 1.5px solid #475569; border-radius: 3px; }

	.pas-requests {
		padding: 0.7rem 0.85rem; background: #1e293b; border-radius: 0.5rem;
	}
	.pas-req-title { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.4rem; }
	.pas-req-list { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.pas-req {
		display: flex; gap: 0.4rem; align-items: center;
		padding: 0.3rem 0.6rem; background: #0f172a; border-radius: 999px;
		font-size: 0.8rem; color: #cbd5e1;
	}
	.pas-req.is-refused { border: 1px solid #fb923c; }
	.pas-req-color { width: 12px; height: 12px; border-radius: 50%; }
	.pas-req-tag { font-size: 0.72rem; color: #fb923c; font-style: italic; }

	.pas-insight {
		display: flex; gap: 0.7rem; padding: 0.85rem 1rem;
		background: #1e1810; border-left: 4px solid #facc15;
		border-radius: 0.5rem; color: #fef3c7;
		font-size: 0.88rem; line-height: 1.55;
	}
	.pas-insight-emoji { font-size: 1.5rem; flex-shrink: 0; }
</style>
