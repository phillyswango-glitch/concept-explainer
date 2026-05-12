<!--
	/vllm — Lab vLLM avec simulateur PagedAttention + continuous batching.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';
	import KVCacheCalculator from '$lib/components/concepts/KVCacheCalculator.svelte';
	import PagedAttentionSim from '$lib/components/concepts/PagedAttentionSim.svelte';

	// ============================================================
	// Simulateur de continuous batching — comparaison de stratégies
	// ============================================================
	type Strategy = 'no-batch' | 'static' | 'dynamic' | 'continuous-paged';

	let strategy = $state<Strategy>('no-batch');
	let tick = $state(0);

	interface Slot {
		reqId: number | null;
		tokensGenerated: number;
		tokensTotal: number;
		color: string;
	}

	const STRATEGIES: Record<Strategy, { name: string; emoji: string; throughput: number; util: number; latency: string; description: string }> = {
		'no-batch': {
			name: 'Aucun batching',
			emoji: '🐢',
			throughput: 30,
			util: 8,
			latency: '0.5s p50 / 0.5s p99',
			description: 'Une requête à la fois, en série. Latence minimale par requête mais GPU à 8 % d\'utilisation. Inacceptable en prod.'
		},
		static: {
			name: 'Static batching',
			emoji: '📦',
			throughput: 90,
			util: 35,
			latency: '2.0s p50 / 5.5s p99',
			description: 'On accumule N requêtes, on les traite ensemble, on attend toutes pour finir. Padding (les courtes attendent les longues) = beaucoup de gaspillage.'
		},
		dynamic: {
			name: 'Continuous batching',
			emoji: '🔄',
			throughput: 380,
			util: 78,
			latency: '0.8s p50 / 1.4s p99',
			description: 'Les requêtes peuvent rejoindre/quitter le batch à chaque step. Pas d\'attente, pas de padding inutile. Standard moderne.'
		},
		'continuous-paged': {
			name: 'Continuous + PagedAttention (vLLM)',
			emoji: '🚀',
			throughput: 720,
			util: 94,
			latency: '0.6s p50 / 1.0s p99',
			description: 'Continuous batching + KV cache géré comme un OS gère la mémoire (pages). Plus de fragmentation, on peut packer plus de requêtes simultanées.'
		}
	};

	const current = $derived(STRATEGIES[strategy]);

	// Animation des slots GPU
	const NUM_SLOTS = 8;
	const slots = $derived.by<Slot[]>(() => {
		const t = tick;
		const result: Slot[] = [];
		const COLORS = ['#a855f7', '#06b6d4', '#22c55e', '#fb923c', '#facc15', '#ec4899', '#3b82f6', '#14b8a6'];

		if (strategy === 'no-batch') {
			// 1 seul slot actif à la fois
			for (let i = 0; i < NUM_SLOTS; i++) {
				if (i === 0) {
					const reqId = Math.floor(t / 8) + 1;
					result.push({
						reqId,
						tokensGenerated: t % 8,
						tokensTotal: 8,
						color: COLORS[reqId % COLORS.length]
					});
				} else {
					result.push({ reqId: null, tokensGenerated: 0, tokensTotal: 0, color: 'transparent' });
				}
			}
		} else if (strategy === 'static') {
			// Tous remplis au début, attente jusqu'à finir
			const cycle = Math.floor(t / 12);
			const phase = t % 12;
			for (let i = 0; i < NUM_SLOTS; i++) {
				const len = 4 + i; // longueurs variables 4-11
				if (phase < len) {
					result.push({
						reqId: cycle * NUM_SLOTS + i + 1,
						tokensGenerated: phase,
						tokensTotal: len,
						color: COLORS[i % COLORS.length]
					});
				} else {
					// Slot fini mais attend que les autres finissent (padding)
					result.push({
						reqId: cycle * NUM_SLOTS + i + 1,
						tokensGenerated: len,
						tokensTotal: len,
						color: COLORS[i % COLORS.length] + '40'  // grisé
					});
				}
			}
		} else if (strategy === 'dynamic') {
			// Les requêtes finissent et sont remplacées
			for (let i = 0; i < NUM_SLOTS; i++) {
				const startTick = i * 2;
				const len = 5 + (i % 4);
				const localTick = (t - startTick + 100) % len;
				const reqId = Math.floor((t - startTick + 100) / len) + 1;
				result.push({
					reqId,
					tokensGenerated: localTick,
					tokensTotal: len,
					color: COLORS[(reqId * (i + 1)) % COLORS.length]
				});
			}
		} else {
			// continuous-paged : encore plus dense, slots remplis quasi en permanence
			for (let i = 0; i < NUM_SLOTS; i++) {
				const startTick = i;
				const len = 4 + (i % 3);
				const localTick = (t - startTick + 200) % len;
				const reqId = Math.floor((t - startTick + 200) / len) + 1;
				result.push({
					reqId,
					tokensGenerated: localTick,
					tokensTotal: len,
					color: COLORS[(reqId * (i + 2)) % COLORS.length]
				});
			}
		}
		return result;
	});

	let isPlaying = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	function togglePlay() {
		if (isPlaying) {
			stopPlay();
		} else {
			isPlaying = true;
			playInterval = setInterval(() => tick++, 500);
		}
	}
	function stopPlay() {
		isPlaying = false;
		if (playInterval) {
			clearInterval(playInterval);
			playInterval = null;
		}
	}
	function reset() {
		stopPlay();
		tick = 0;
	}

	$effect(() => {
		strategy;
		tick = 0;
		stopPlay();
	});
</script>

<svelte:head><title>vLLM — Inférence LLM haute performance</title></svelte:head>

<article class="vllm">
	<header class="vllm-hero">
		<span class="vllm-hero-emoji">🚀</span>
		<h1 class="vllm-h1">vLLM — Inférence LLM haute performance</h1>
		<p class="vllm-hero-lead">
			Tu as fine-tuné ton Mistral. Maintenant tu veux le servir à 100,
			1000, 10000 utilisateurs. Question : combien de requêtes par
			seconde par GPU ? <strong>vLLM (Kwon et al. 2023)</strong> est le
			standard open-source qui répond à cette question avec PagedAttention
			et continuous batching — <strong>jusqu'à 24× plus de
				throughput</strong> que les solutions naïves. Page interactive : tu
			peux <strong>simuler les 4 stratégies de batching</strong> et voir
			l'impact direct.
		</p>
		<div class="vllm-hero-actions">
			<a href="#simulator" class="vllm-cta">🎮 Simulateur de batching</a>
			<a href="#paged" class="vllm-cta vllm-cta-2">🧠 PagedAttention</a>
		</div>
	</header>

	<nav class="vllm-toc">
		<p class="vllm-toc-label">📍 Parcours</p>
		<ol class="vllm-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#pourquoi">1. Le problème — throughput d'inférence LLM</a></li>
			<li><a href="#simulator">2. Simulateur de batching ⭐</a></li>
			<li><a href="#paged">3. PagedAttention expliqué</a></li>
			<li><a href="#sizing">4. Dimensionnement production ⭐</a></li>
			<li><a href="#deploy">5. Déployer Mistral 7B avec vLLM</a></li>
			<li><a href="#vs">6. vLLM vs Ollama vs TGI vs TensorRT</a></li>
			<li><a href="#sovereign">7. Setup souverain (K8s air-gap)</a></li>
			<li><a href="#glossaire">8. Glossaire</a></li>
		</ol>
	</nav>

	<!-- 0. PRÉREQUIS -->
	<section id="prereq" class="vllm-section">
		<h2 class="vllm-h2">0️⃣ Avant de commencer</h2>
		<div class="vllm-prereq-grid">
			<details class="vllm-prereq">
				<summary>📊 Throughput vs Latence</summary>
				<div>
					<p>
						<strong>Latence</strong> = temps pour traiter UNE requête. Bas = utilisateur content.
						<strong>Throughput</strong> = nombre de requêtes par seconde au total. Haut = serveur économique.
						<strong>Tension</strong> : sans batching, basse latence mais throughput faible. Avec batching agressif, throughput haut mais latence p99 dégradée.
					</p>
				</div>
			</details>
			<details class="vllm-prereq">
				<summary>📦 Static batching</summary>
				<div>
					<p>
						Approche naïve : on accumule N requêtes, on les traite ensemble, on attend que <em>toutes</em> finissent. Problème : la requête la plus longue du batch dicte le temps total. Les courtes finissent et attendent. Énorme padding.
					</p>
				</div>
			</details>
			<details class="vllm-prereq">
				<summary>🔄 Continuous batching</summary>
				<div>
					<p>
						À chaque step de génération, le scheduler peut <strong>ajouter</strong> ou <strong>retirer</strong> des requêtes du batch. Une requête qui finit libère sa place immédiatement. Pas d'attente, pas de padding. Inventé par Orca (Yu et al. 2022), généralisé par vLLM.
					</p>
				</div>
			</details>
			<details class="vllm-prereq">
				<summary>🧠 KV cache (rappel)</summary>
				<div>
					<p>
						Cache GPU des Keys/Values de tous les tokens déjà traités, évite de les recalculer. Pour 1 requête de 4096 tokens sur Mistral 7B = ~2 Go. Pour 16 requêtes en parallèle = 32 Go. Voir la
						<a href="/transformer" style="color:#06b6d4">page Transformer</a> pour le détail.
					</p>
				</div>
			</details>
			<details class="vllm-prereq">
				<summary>📄 Memory paging (analogie OS)</summary>
				<div>
					<p>
						Inspiration directe de PagedAttention : les OS modernes ne donnent pas un bloc mémoire contigu à chaque process. Ils donnent des « pages » de 4 Ko qui peuvent être éparpillées en RAM physique. Avantages : pas de fragmentation, on peut donner exactement ce dont on a besoin. PagedAttention applique ça au KV cache.
					</p>
				</div>
			</details>
			<details class="vllm-prereq">
				<summary>⚙️ Tensor parallelism</summary>
				<div>
					<p>
						Quand le modèle ne tient pas sur 1 GPU, on le découpe entre plusieurs GPUs (les matrices sont splittées en colonnes/lignes). vLLM le supporte nativement avec
						<code>--tensor-parallel-size N</code>.
					</p>
				</div>
			</details>
		</div>
	</section>

	<!-- 1. POURQUOI -->
	<section id="pourquoi" class="vllm-section">
		<h2 class="vllm-h2">1️⃣ Le problème — throughput d'inférence LLM</h2>
		<p>
			Pour servir un LLM en prod, le coût est dominé par le GPU. Un H100
			coûte 30 000 €. Si tu sers 30 req/s par H100, c'est 1000 € par
			req/s. Si tu sers 720 req/s, c'est 42 € par req/s. <strong>Le
			batching change tout.</strong>
		</p>
		<div class="vllm-cost-grid">
			<div class="vllm-cost vllm-cost-bad">
				<div class="vllm-cost-label">Sans batching</div>
				<div class="vllm-cost-val">30 req/s</div>
				<div class="vllm-cost-sub">par GPU H100</div>
				<div class="vllm-cost-coef">→ 1000 €/req/s</div>
			</div>
			<div class="vllm-cost vllm-cost-mid">
				<div class="vllm-cost-label">Static batching</div>
				<div class="vllm-cost-val">90 req/s</div>
				<div class="vllm-cost-sub">par GPU H100</div>
				<div class="vllm-cost-coef">→ 333 €/req/s</div>
			</div>
			<div class="vllm-cost vllm-cost-good">
				<div class="vllm-cost-label">Continuous batching</div>
				<div class="vllm-cost-val">380 req/s</div>
				<div class="vllm-cost-sub">par GPU H100</div>
				<div class="vllm-cost-coef">→ 79 €/req/s</div>
			</div>
			<div class="vllm-cost vllm-cost-best">
				<div class="vllm-cost-label">vLLM (continuous + paged)</div>
				<div class="vllm-cost-val">720 req/s</div>
				<div class="vllm-cost-sub">par GPU H100</div>
				<div class="vllm-cost-coef">→ 42 €/req/s</div>
			</div>
		</div>
	</section>

	<!-- 2. SIMULATEUR -->
	<section id="simulator" class="vllm-section">
		<h2 class="vllm-h2">2️⃣ Simulateur de batching ⭐</h2>
		<p>
			Choisis une stratégie et clique <strong>▶ Animer</strong>. Tu vas
			voir l'utilisation du GPU (8 slots) en temps réel. Plus c'est
			coloré et dense, plus le GPU est occupé. Plus de gris/transparent =
			plus de cycles GPU gaspillés.
		</p>

		<div class="vllm-sim">
			<!-- Sélecteur stratégie -->
			<div class="vllm-sim-tabs">
				{#each Object.entries(STRATEGIES) as [id, s] (id)}
					<button
						type="button"
						class="vllm-sim-tab {strategy === id ? 'is-active' : ''}"
						onclick={() => (strategy = id as Strategy)}
					>
						<span>{s.emoji}</span>
						<div class="vllm-sim-tab-name">{s.name}</div>
					</button>
				{/each}
			</div>

			<!-- Visualisation GPU -->
			<div class="vllm-sim-gpu">
				<div class="vllm-sim-gpu-label">🎮 GPU H100 — 8 slots de batching</div>
				<div class="vllm-sim-slots">
					{#each slots as slot, i (i)}
						<div class="vllm-sim-slot">
							<div class="vllm-sim-slot-label">Slot {i + 1}</div>
							<div class="vllm-sim-slot-track">
								{#if slot.reqId !== null}
									<div
										class="vllm-sim-slot-fill"
										style="width: {(slot.tokensGenerated / slot.tokensTotal) * 100}%; background: {slot.color};"
									>
										<span class="vllm-sim-slot-text">req #{slot.reqId}</span>
									</div>
								{:else}
									<div class="vllm-sim-slot-empty">vide</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Stats temps réel -->
			<div class="vllm-sim-stats">
				<div class="vllm-sim-stat">
					<div class="vllm-sim-stat-label">⚡ Throughput</div>
					<div class="vllm-sim-stat-val">{current.throughput} req/s</div>
				</div>
				<div class="vllm-sim-stat">
					<div class="vllm-sim-stat-label">💪 Utilisation GPU</div>
					<div class="vllm-sim-stat-val">{current.util}%</div>
				</div>
				<div class="vllm-sim-stat">
					<div class="vllm-sim-stat-label">⏱️ Latence</div>
					<div class="vllm-sim-stat-val vllm-sim-stat-val-small">{current.latency}</div>
				</div>
				<div class="vllm-sim-stat">
					<div class="vllm-sim-stat-label">🎬 Tick</div>
					<div class="vllm-sim-stat-val">t = {tick}</div>
				</div>
			</div>

			<div class="vllm-sim-desc">{current.description}</div>

			<!-- Contrôles -->
			<div class="vllm-sim-controls">
				<button type="button" class="vllm-sim-btn vllm-sim-btn-play" onclick={togglePlay}>
					{isPlaying ? '⏸ Pause' : '▶ Animer'}
				</button>
				<button type="button" class="vllm-sim-btn" onclick={() => tick++}>Pas suivant</button>
				<button type="button" class="vllm-sim-btn" onclick={reset}>↻ Reset</button>
			</div>
		</div>

		<Callout variant="insight" title="🔍 Que regarder en cliquant les 4 stratégies">
			<ol>
				<li><strong>🐢 Aucun batching</strong> : 7 slots vides en permanence, 1 seul actif. GPU à 8 %. C'est ce qu'on a sans optimisation.</li>
				<li><strong>📦 Static</strong> : tous les slots remplis au début, mais regarde les slots qui terminent tôt — ils <em>restent grisés</em> en attendant les autres. C'est le padding gaspillé.</li>
				<li><strong>🔄 Continuous</strong> : aucun slot ne reste grisé. Dès qu'une requête finit, une nouvelle prend sa place. Densité maximale.</li>
				<li><strong>🚀 vLLM</strong> : encore plus dense, parce que la mémoire KV est gérée en pages, on peut packer encore plus de requêtes courtes côte à côte.</li>
			</ol>
		</Callout>
	</section>

	<!-- 3. PAGED ATTENTION -->
	<section id="paged" class="vllm-section">
		<h2 class="vllm-h2">3️⃣ KV Cache + PagedAttention — au fond ⭐</h2>

		<h3 class="vllm-h3">D'abord, comprendre le KV cache</h3>
		<p>
			Pour générer le token N+1, un Transformer calcule l'attention sur
			TOUS les tokens précédents (0 à N). L'attention demande
			<code>Q × Kᵀ</code> puis <code>× V</code>. Sans optimisation, à
			chaque nouveau token, on recalcule K et V pour TOUS les tokens depuis
			le début. <strong>C'est absurde</strong> : K et V ne dépendent que
			du token en lui-même, ils sont invariants entre les pas de
			génération. La solution : on les <strong>cache</strong>.
		</p>

		<div class="vllm-kv-grid">
			<div class="vllm-kv-card vllm-kv-bad">
				<div class="vllm-kv-emoji">❌</div>
				<h4>Sans KV cache (naïf)</h4>
				<p>
					Pour générer le token <em>n+1</em>, on recalcule K et V pour les
					tokens 0..n. Au token suivant, on recalcule pour 0..n+1. Etc.
				</p>
				<p>
					Pour une séquence de N tokens, le coût total est
					<strong>O(N²)</strong> en compute juste pour les K/V.
					Insoutenable.
				</p>
			</div>
			<div class="vllm-kv-card vllm-kv-good">
				<div class="vllm-kv-emoji">✅</div>
				<h4>Avec KV cache</h4>
				<p>
					À chaque token généré, on calcule K et V <strong>uniquement
						pour ce nouveau token</strong>, on les ajoute au cache. Pour
					le prochain pas, on lit le cache au lieu de recalculer.
				</p>
				<p>
					Coût total : <strong>O(N)</strong> au lieu de O(N²).
					<strong>Indispensable</strong> pour servir un LLM en temps
					réel.
				</p>
			</div>
		</div>

		<h3 class="vllm-h3">Combien ça pèse ? — calculateur interactif</h3>
		<p>
			Le KV cache est un tableau dans la VRAM du GPU. Sa taille dépend de
			4 paramètres du modèle (layers, kv-heads, head dim, précision) et
			d'<strong>une seule variable runtime</strong> : la longueur du
			contexte.
		</p>

		<KVCacheCalculator />

		<Callout variant="warning" title="🚨 Le vrai problème du KV cache en production">
			<p>
				Le KV cache est <strong>par requête utilisateur</strong>. Si tu
				sers 100 utilisateurs simultanément sur Mistral 7B à 4k tokens,
				tu as besoin de 100 × 512 MB = <strong>50 GB de VRAM</strong>
				rien que pour les caches — plus les poids du modèle (14 GB en
				fp16) — total ~64 GB. <strong>C'est pour ça qu'il faut
					vLLM</strong> : sa gestion intelligente de la VRAM (paged) permet
				de servir bien plus d'utilisateurs avec la même carte.
			</p>
		</Callout>

		<h3 class="vllm-h3">Le problème de l'allocation naïve</h3>
		<p>
			Imagine que le serveur d'inférence doit pré-allouer le KV cache pour
			chaque nouvelle requête. <strong>Question</strong> : combien de
			tokens cette requête va-t-elle générer ? <strong>Réponse</strong>
			: on ne sait pas. La requête peut s'arrêter après 50 tokens ou
			continuer jusqu'à 4096. Pour être sûr, le système naïf
			<strong>réserve d'office le maximum possible</strong>
			(<code>max_new_tokens</code> + <code>prompt_length</code>) en mémoire
			<strong>contiguë</strong>.
		</p>

		<div class="vllm-paged-explain">
			<h4>💥 Conséquence : gaspillage massif (jusqu'à 70 %)</h4>
			<ul>
				<li><strong>Fragmentation interne</strong> : la plupart des requêtes utilisent &lt; 30 % de ce qu'elles ont réservé (la majorité des réponses sont courtes, on a réservé pour le cas extrême).</li>
				<li><strong>Fragmentation externe</strong> : on a 50 % de la VRAM en libre mais éparpillé en petits trous → impossible d'accepter une nouvelle requête qui demande un gros bloc contigu.</li>
				<li><strong>Throughput effondré</strong> : on refuse des requêtes alors que la mémoire effective est libre.</li>
			</ul>
		</div>

		<h3 class="vllm-h3">La solution PagedAttention — inspiration des OS</h3>
		<p>
			Kwon et al. (vLLM 2023) appliquent une idée empruntée à la
			<strong>mémoire virtuelle des OS</strong> : au lieu d'allouer en
			contigu, on découpe le KV cache en <strong>pages</strong> de taille
			fixe (typiquement <strong>16 tokens</strong>). Chaque requête
			<strong>réclame des pages à la demande</strong>, n'importe où en
			mémoire physique. Une <strong>page table</strong> traduit les
			positions logiques (« le 47ᵉ token de la requête R3 ») vers les
			pages physiques.
		</p>

		<h3 class="vllm-h3">Simulation interactive — Naive vs PagedAttention</h3>
		<p>
			Pour bien voir la différence, voici une simulation où tu ajoutes des
			requêtes une par une. <strong>32 blocs mémoire</strong> au total.
			Chaque requête peut atteindre jusqu'à 8 tokens (= 8 blocs).
			Naive réserve 8 blocs contigus dès l'arrivée ; Paged alloue
			exactement le nb de blocs effectivement utilisés.
		</p>

		<PagedAttentionSim />

		<Callout variant="insight" title="🎯 Les 3 bénéfices de PagedAttention">
			<ol>
				<li><strong>Pas de fragmentation interne</strong> — chaque bloc alloué est utilisé. Utilisation VRAM ~96 % vs ~30-50 % naïf.</li>
				<li><strong>Pas de fragmentation externe</strong> — les blocs libres sont uniformes (taille fixe), tout bloc libre est aussi bon qu'un autre.</li>
				<li><strong>Copy-on-write naturel</strong> — si plusieurs requêtes partagent un prompt système, vLLM partage la même page en lecture seule, et fork seulement quand l'une diverge. Énorme économie quand 1000 utilisateurs envoient des requêtes avec le même system prompt de 500 tokens.</li>
			</ol>
		</Callout>

		<h3 class="vllm-h3">Comment vLLM trace ces pages — la page table</h3>
		<p>
			Comme un OS maintient une table de pages mémoire pour chaque
			processus, vLLM maintient une <strong>BlockTable par requête</strong>.
			Voici un exemple concret pour une requête de 35 tokens avec des
			pages de 16 tokens :
		</p>

		<pre class="vllm-code"><code>{`# Requête R5 a généré 35 tokens. Sa BlockTable :
{
  "request_id": "R5",
  "logical_blocks": [
    {"position": [0, 15],   "physical_page": 7},    # tokens 0-15 → page 7
    {"position": [16, 31],  "physical_page": 23},   # tokens 16-31 → page 23
    {"position": [32, 47],  "physical_page": 41}    # tokens 32-35 (partiel) → page 41
  ]
}

# Quand le modèle génère le 36ᵉ token, vLLM voit que la page 41 a encore
# 12 slots libres → pas besoin d'allouer une nouvelle page.
# Quand on atteint le 48ᵉ token, vLLM alloue une 4ᵉ page (la suivante libre).`}</code></pre>

		<Callout variant="info" title="💡 Le bonus prefix caching">
			<p>
				Dans la plupart des déploiements, <strong>90 % des requêtes
					partagent le même system prompt</strong> (« Tu es un assistant
				défense, habilitation : … »). vLLM détecte ça
				automatiquement : si la nouvelle requête commence par les mêmes
				tokens qu'une autre déjà en cache, on <strong>réutilise les
					pages</strong> en lecture seule. Active avec
				<code>--enable-prefix-caching</code>. Gain typique : 30-50 % de
				latence en moins sur le TTFT (Time To First Token) en
				production.
			</p>
		</Callout>
	</section>

	<!-- 4. DIMENSIONNEMENT PRODUCTION -->
	<section id="sizing" class="vllm-section">
		<h2 class="vllm-h2">4️⃣ Dimensionnement production — combien d'utilisateurs sur ton GPU ?</h2>

		<p>
			Tu sais maintenant ce qu'est le KV cache et pourquoi PagedAttention
			existe. <strong>Question concrète</strong> : tu reçois un cahier des
			charges « il faut servir 50 utilisateurs simultanés sur le modèle X
			au contexte Y ». Quel GPU choisir ? Combien de répliques ?
			<strong>Combien d'utilisateurs tu peux mettre par carte ?</strong>
			Cette section te donne la formule maîtresse puis l'applique sur
			trois cas réels avec le calcul step-by-step.
		</p>

		<h3 class="vllm-h3">📐 La formule maîtresse</h3>
		<div class="vllm-formula">
			<code>N_users_max = (VRAM_GPU − W_modèle − C_overhead) ÷ KV_par_user(L_ctx)</code>
		</div>
		<ul class="vllm-formula-legend">
			<li><strong>VRAM_GPU</strong> — VRAM totale du GPU : 24 Go (RTX 4090), 32 Go (RTX 5000 Ada), 40 ou 80 Go (A100), 80 Go (H100), 192 Go (B200).</li>
			<li><strong>W_modèle</strong> — taille des poids : fp16 = 2 octets/paramètre ; FP8 = 1 octet ; AWQ/GPTQ 4-bit ≈ 0,5 octet ; AWQ 8-bit ≈ 1 octet.</li>
			<li><strong>C_overhead</strong> — activations, buffers CUDA, scratch, CUDA graphs : ~2-4 Go. Avec <code>--gpu-memory-utilization 0.92</code> vLLM réserve ~8 % en sécurité.</li>
			<li><strong>KV_par_user(L_ctx)</strong> — KV cache pour 1 user au contexte L_ctx (cf. le calculateur plus haut). <strong>Avec PagedAttention</strong> on prend la valeur effective moyenne ; <strong>sans</strong>, le maximum théorique.</li>
		</ul>

		<Callout variant="info" title="🎯 Naïf vs Paged — d'où vient la différence">
			<p>
				Sans PagedAttention, le scheduler réserve <code>max_model_len</code>
				tokens par requête <em>même si elle n'en utilise que 200</em>.
				Avec PagedAttention, on alloue page par page à la demande.
				<strong>En pratique on observe 3-5× plus d'utilisateurs
					simultanés</strong> sur le même GPU avec le même modèle.
			</p>
		</Callout>

		<!-- ===== SCÉNARIO A ===== -->
		<h3 class="vllm-h3">🎯 Scénario A — Mistral 7B sur RTX 5000 Ada 32 Go @ 4k contexte</h3>
		<p>
			<strong>Cas d'usage</strong> : ton MVP agent défense, ~50 utilisateurs
			habilités CD interrogent l'agent en interne. Contexte moyen 4096
			tokens (system prompt + RAG + question + réponse).
		</p>

		<div class="vllm-sizing">
			<div class="vllm-sizing-math">
				<div class="vllm-sizing-line"><span>VRAM RTX 5000 Ada</span><span>= 32 Go</span></div>
				<div class="vllm-sizing-line"><span>Poids Mistral 7B fp16 (7,24 Md × 2 octets)</span><span>= 14,5 Go</span></div>
				<div class="vllm-sizing-line"><span>Overhead vLLM (activations + CUDA)</span><span>= 2,5 Go</span></div>
				<div class="vllm-sizing-line vllm-sizing-result"><span>→ Budget KV cache disponible</span><span><strong>15,0 Go</strong></span></div>
				<div class="vllm-sizing-sep"></div>
				<div class="vllm-sizing-line"><span>KV par user @ 4096 tokens (32 couches, 8 kv-heads GQA, head_dim 128, fp16)</span><span>= 512 Mo</span></div>
				<div class="vllm-sizing-sep"></div>
				<div class="vllm-sizing-line vllm-sizing-naif"><span>📦 Naïf (réservation max 4096 tokens contigus)</span><span>15 Go ÷ 512 Mo = <strong>~28-30 users</strong></span></div>
				<div class="vllm-sizing-line vllm-sizing-paged"><span>🚀 PagedAttention (alloc dynamique + prefix caching)</span><span>15 Go ÷ ~170 Mo eff. = <strong>~80-100 users</strong></span></div>
			</div>
			<div class="vllm-sizing-comment">
				<p><strong>Pourquoi 170 Mo effectif au lieu de 512 Mo théorique ?</strong></p>
				<ul>
					<li>La plupart des réponses font 200-400 tokens (pas 2000+). Avec paged on n'alloue que ce qui est consommé : moyenne ~1500 tokens au lieu de 4096.</li>
					<li><strong>Prefix caching</strong> — le system prompt (≈500 tokens) est partagé entre tous les utilisateurs. Économie de ~33 % supplémentaire.</li>
					<li>Net effectif : 4096 → ~1500 tokens × 65 % ≈ 1000 tokens utiles → ~125 Mo, avec marge runtime → 170 Mo.</li>
				</ul>
			</div>
		</div>

		<Callout variant="info" title="📊 Throughput estimé pour ce scénario">
			<p>
				Avec ~80 users simultanés et un débit d'environ 35 tokens/s
				par user sur RTX 5000 Ada → <strong>~2 800 tokens/s
				agrégés</strong>, soit 280-350 réponses/minute (500-1000 tokens
				chacune). Largement assez pour 50 utilisateurs interactifs avec
				un facteur de concurrence de 1,5-2.
			</p>
		</Callout>

		<!-- ===== SCÉNARIO B ===== -->
		<h3 class="vllm-h3">🎯 Scénario B — Llama 70B GQA sur H100 80 Go (AWQ 4-bit) @ 8k contexte</h3>
		<p>
			<strong>Cas d'usage</strong> : V2 du projet, on passe au modèle 70B
			pour des analyses plus profondes. Contexte étendu à 8k (longs
			documents OSINT). On quantize en AWQ 4-bit pour rentrer sur 1 carte.
		</p>

		<div class="vllm-sizing">
			<div class="vllm-sizing-math">
				<div class="vllm-sizing-line"><span>VRAM H100 SXM</span><span>= 80 Go</span></div>
				<div class="vllm-sizing-line"><span>Poids Llama 70B AWQ 4-bit (70 Md × 0,5 octet + scales/zeros)</span><span>= 38 Go</span></div>
				<div class="vllm-sizing-line"><span>Overhead vLLM</span><span>= 3 Go</span></div>
				<div class="vllm-sizing-line vllm-sizing-result"><span>→ Budget KV cache disponible</span><span><strong>39 Go</strong></span></div>
				<div class="vllm-sizing-sep"></div>
				<div class="vllm-sizing-line"><span>KV par user @ 8192 tokens (80 couches, 8 kv-heads GQA, head_dim 128, fp16)</span><span>= 1,25 Go</span></div>
				<div class="vllm-sizing-sep"></div>
				<div class="vllm-sizing-line vllm-sizing-naif"><span>📦 Naïf (réservation max 8k contigus)</span><span>39 Go ÷ 1,25 Go = <strong>~31 users</strong></span></div>
				<div class="vllm-sizing-line vllm-sizing-paged"><span>🚀 PagedAttention</span><span>39 Go ÷ ~470 Mo eff. = <strong>~80-85 users</strong></span></div>
			</div>
			<div class="vllm-sizing-comment">
				<p><strong>Notes clés :</strong></p>
				<ul>
					<li><strong>GQA sauve la prod</strong> — sans Grouped-Query Attention (8 kv-heads au lieu de 64), le KV cache ferait ~10 Go par user → seulement 3-4 users sur la carte. GQA est la raison pour laquelle Llama 70B est servable à grande échelle.</li>
					<li><strong>AWQ 4-bit</strong> — qualité ≈ fp16 sur les benchmarks, mais libère ~50 Go. Sans, on rentrerait à peine le modèle (140 Go en fp16, impossible sur 1 H100).</li>
					<li><strong>Si tu as 2× H100</strong>, ajoute <code>--tensor-parallel-size 2</code> et reste en fp16 : ~10× plus de débit, mais 2× plus cher.</li>
				</ul>
			</div>
		</div>

		<!-- ===== SCÉNARIO C ===== -->
		<h3 class="vllm-h3">🎯 Scénario C — Mixtral 8x7B fp16 sur 4× A100 40 Go @ 32k contexte</h3>
		<p>
			<strong>Cas d'usage</strong> : V3 multi-agent avec contexte long
			(32k) pour analyser un dossier entier d'un coup, fp16 pour préserver
			toute la qualité. Distribué sur 4 GPUs via tensor parallelism.
		</p>

		<div class="vllm-sizing">
			<div class="vllm-sizing-math">
				<div class="vllm-sizing-line"><span>VRAM totale (4 × 40 Go)</span><span>= 160 Go</span></div>
				<div class="vllm-sizing-line"><span>Poids Mixtral 8x7B fp16 (46,7 Md × 2 octets)</span><span>= 93 Go</span></div>
				<div class="vllm-sizing-line"><span>Overhead vLLM (4 GPUs, comms NCCL)</span><span>= 12 Go</span></div>
				<div class="vllm-sizing-line vllm-sizing-result"><span>→ Budget KV cache (total cluster)</span><span><strong>55 Go</strong></span></div>
				<div class="vllm-sizing-sep"></div>
				<div class="vllm-sizing-line"><span>KV par user @ 32 768 tokens (32 couches, 8 kv-heads GQA, head_dim 128, fp16)</span><span>= 4,0 Go</span></div>
				<div class="vllm-sizing-sep"></div>
				<div class="vllm-sizing-line vllm-sizing-naif"><span>📦 Naïf (réservation max 32k contigus)</span><span>55 Go ÷ 4 Go = <strong>~13 users</strong></span></div>
				<div class="vllm-sizing-line vllm-sizing-paged"><span>🚀 PagedAttention (peu d'users vraiment à 32k)</span><span>55 Go ÷ ~750 Mo eff. = <strong>~70 users</strong></span></div>
			</div>
			<div class="vllm-sizing-comment">
				<p><strong>Observations critiques sur le long contexte :</strong></p>
				<ul>
					<li><strong>Le contexte coûte cher</strong> — passer de 4k à 32k multiplie le KV cache théorique par 8. À ce stade, seul PagedAttention rend la chose viable.</li>
					<li><strong>Mixtral est MoE</strong> — 8 experts × 7B mais seulement 2 actifs par token. vLLM le gère nativement ; le KV cache est calculé sur l'architecture commune, pas par expert.</li>
					<li><strong>Coût TP=4</strong> — chaque GPU stocke 1/4 du modèle et 1/4 du KV cache, mais l'allreduce NCCL ajoute ~12 Go d'overhead total.</li>
					<li><strong>Si on plafonne à 16k au lieu de 32k</strong>, on remonte à ~140 users. Le long contexte est un luxe : ne l'autorise qu'aux endpoints qui en ont vraiment besoin.</li>
				</ul>
			</div>
		</div>

		<!-- ===== COÛTS €/user/heure ===== -->
		<h3 class="vllm-h3">💰 Le coût par utilisateur — €/user/heure (H100 cloud à 4 €/h)</h3>
		<p>
			Si tu loues 1 H100 à 4 €/h (prix indicatif Lambda Labs, RunPod
			mai 2025), voici ce que coûte servir 1 utilisateur sous différentes
			stratégies, avec Mistral 7B fp16 @ 4k contexte (chiffres indicatifs
			±20 % selon ton workload réel).
		</p>

		<table class="vllm-cost-table">
			<thead>
				<tr><th>Stratégie</th><th>N users sim.</th><th>€/user/h</th><th>€/1M tokens out</th><th>Verdict</th></tr>
			</thead>
			<tbody>
				<tr>
					<td>🐢 No batching</td><td>1</td><td>4,00 €</td><td>~22 €</td>
					<td>Insoutenable en prod</td>
				</tr>
				<tr>
					<td>📦 Static batching (16)</td><td>~12 (50 % padding)</td><td>0,33 €</td><td>~1,80 €</td>
					<td>Vieille école, à éviter</td>
				</tr>
				<tr>
					<td>🔄 Continuous batching</td><td>~50</td><td>0,08 €</td><td>~0,45 €</td>
					<td>Bon, mais sous-optimal sans paged</td>
				</tr>
				<tr class="vllm-cost-row-best">
					<td>🚀 vLLM (paged + prefix)</td><td>~120-150</td><td>0,028 €</td><td>~0,15 €</td>
					<td><strong>Standard prod 2025</strong></td>
				</tr>
			</tbody>
		</table>

		<Callout variant="insight" title="🎯 Référence marché (mai 2026)">
			<p>
				L'API OpenAI GPT-4o-mini facture environ <strong>0,60 € /
				1M tokens output</strong>, Mistral Small environ 0,90 €. Avec
				vLLM auto-hébergé sur ton H100, tu descends à <strong>~0,15 €
				/ 1M tokens</strong> sur ton propre Mistral 7B — ~4× moins
				cher. C'est ce qui rend l'auto-hébergement attractif dès qu'on
				dépasse ~5 millions de tokens/jour. En contexte souverain, le
				calcul est encore plus tranché : l'API publique est tout
				simplement interdite, donc l'auto-hébergement n'est pas une
				option mais une obligation.
			</p>
		</Callout>

		<!-- ===== 5 LEVIERS ===== -->
		<h3 class="vllm-h3">🛠️ 5 leviers pour augmenter N_users à VRAM constante</h3>
		<div class="vllm-levers">
			<div class="vllm-lever">
				<span class="vllm-lever-num">1</span>
				<div>
					<strong>Quantization du modèle</strong> — fp16 → AWQ 4-bit
					libère 75 % de la VRAM des poids. Pour Mistral 7B : 14,5 Go
					→ 4 Go libérés. Qualité quasi identique sur les benchmarks.
					<code>--quantization awq</code>.
				</div>
			</div>
			<div class="vllm-lever">
				<span class="vllm-lever-num">2</span>
				<div>
					<strong>Quantization du KV cache</strong> — fp16 → fp8 ou
					int8 divise par 2 la taille du cache. Sur Hopper+ via
					<code>--kv-cache-dtype fp8</code>. Petite dégradation
					qualité, à benchmarker sur ton cas.
				</div>
			</div>
			<div class="vllm-lever">
				<span class="vllm-lever-num">3</span>
				<div>
					<strong>Réduire <code>max-model-len</code></strong> — si tes
					prompts font en moyenne 2k tokens, ne configure pas
					<code>--max-model-len 32768</code>. Plafonner à 4096 divise
					par 8 le KV cache maximum théorique réservé.
				</div>
			</div>
			<div class="vllm-lever">
				<span class="vllm-lever-num">4</span>
				<div>
					<strong>Activer prefix caching</strong> —
					<code>--enable-prefix-caching</code>. Si 90 % de tes
					requêtes partagent le même system prompt de 500 tokens,
					c'est 30-50 % de KV cache économisé et 30-50 % de TTFT en
					moins.
				</div>
			</div>
			<div class="vllm-lever">
				<span class="vllm-lever-num">5</span>
				<div>
					<strong>Augmenter <code>gpu-memory-utilization</code></strong>
					— défaut 0,90. À 0,95 tu gagnes 5 % de VRAM pour le KV
					cache, mais attention aux OOM en pic. Bien monitorer
					<code>nvidia-smi</code> au stress test avant de pousser.
				</div>
			</div>
		</div>

		<Callout variant="warning" title="🧪 Comment valider en pratique">
			<ol>
				<li><strong>Stress test</strong> — utiliser <code>vllm bench</code> ou <code>locust</code> avec un trafic représentatif (longueurs de prompts/réponses réalistes).</li>
				<li><strong>Mesurer KV cache utilization</strong> — vLLM expose <code>vllm:gpu_cache_usage_perc</code> en Prometheus. Si tu plafonnes à 95 %, tu rejettes des requêtes : augmente la VRAM ou ajoute de la quantization.</li>
				<li><strong>Mesurer P99 latency</strong> — si elle explose au-delà de 60 users alors que ton calcul disait 100, ton workload a probablement plus de tokens out que tu estimais. Ré-ajuster.</li>
				<li><strong>Monitorer eviction</strong> — métrique <code>vllm:num_preemptions_total</code>. Si elle augmente, vLLM swap des séquences (lentes). Réduire <code>max-num-seqs</code> ou augmenter la VRAM.</li>
			</ol>
		</Callout>
	</section>

	<!-- 5. DÉPLOIEMENT -->
	<section id="deploy" class="vllm-section">
		<h2 class="vllm-h2">5️⃣ Déployer Mistral 7B avec vLLM (production)</h2>

		<h3 class="vllm-h3">Mode 1 — Serveur OpenAI-compatible (recommandé)</h3>
		<pre class="vllm-code"><code>{`# Installation
pip install vllm

# Lance le serveur (1 GPU)
python -m vllm.entrypoints.openai.api_server \\
    --model mistralai/Mistral-7B-Instruct-v0.3 \\
    --port 8000 \\
    --max-model-len 8192 \\
    --gpu-memory-utilization 0.95

# Le serveur expose une API compatible OpenAI sur http://localhost:8000
# → tu peux le consommer depuis n'importe quel client OpenAI`}</code></pre>

		<pre class="vllm-code"><code>{`# Côté client — strictement compatible OpenAI
from openai import OpenAI

client = OpenAI(
    base_url="http://vllm.intranet:8000/v1",
    api_key="not-needed"  # ou ton token de gateway interne
)

response = client.chat.completions.create(
    model="mistralai/Mistral-7B-Instruct-v0.3",
    messages=[{"role": "user", "content": "Bonjour"}],
    max_tokens=200
)
# vLLM gère le batching transparent côté serveur — 100 clients en parallèle
# avec la même latence apparente que 1 client.`}</code></pre>

		<h3 class="vllm-h3">Mode 2 — Multi-GPU avec tensor parallelism</h3>
		<pre class="vllm-code"><code>{`# Pour Mixtral 8x7B ou Llama 70B sur 4 GPUs
python -m vllm.entrypoints.openai.api_server \\
    --model mistralai/Mixtral-8x7B-Instruct-v0.1 \\
    --tensor-parallel-size 4 \\
    --max-model-len 32768 \\
    --gpu-memory-utilization 0.95`}</code></pre>

		<h3 class="vllm-h3">Mode 3 — Quantization (gain VRAM)</h3>
		<pre class="vllm-code"><code>{`# Charger en AWQ 4-bit (qualité ≈ fp16, VRAM ÷ 4)
python -m vllm.entrypoints.openai.api_server \\
    --model TheBloke/Mistral-7B-Instruct-v0.3-AWQ \\
    --quantization awq

# Ou GPTQ
python -m vllm.entrypoints.openai.api_server \\
    --model TheBloke/Mistral-7B-Instruct-v0.3-GPTQ \\
    --quantization gptq

# Ou FP8 (Hopper+, le plus rapide)
python -m vllm.entrypoints.openai.api_server \\
    --model neuralmagic/Mistral-7B-Instruct-v0.3-FP8 \\
    --quantization fp8`}</code></pre>
	</section>

	<!-- 5. VS -->
	<section id="vs" class="vllm-section">
		<h2 class="vllm-h2">6️⃣ vLLM vs Ollama vs TGI vs TensorRT-LLM</h2>
		<table class="vllm-vs-table">
			<thead>
				<tr><th>Critère</th><th>🚀 vLLM</th><th>🦙 Ollama</th><th>🤗 TGI</th><th>⚡ TensorRT-LLM</th></tr>
			</thead>
			<tbody>
				<tr><td>Cible</td><td>Production scale</td><td>Dev local</td><td>Production</td><td>Production NVIDIA-only</td></tr>
				<tr><td>Throughput (rel.)</td><td class="vllm-vs-good">⭐⭐⭐⭐⭐</td><td>⭐⭐</td><td>⭐⭐⭐⭐</td><td class="vllm-vs-good">⭐⭐⭐⭐⭐</td></tr>
				<tr><td>Facilité install</td><td>⭐⭐⭐</td><td class="vllm-vs-good">⭐⭐⭐⭐⭐</td><td>⭐⭐⭐⭐</td><td>⭐⭐</td></tr>
				<tr><td>API OpenAI</td><td class="vllm-vs-good">✅</td><td class="vllm-vs-good">✅</td><td class="vllm-vs-good">✅</td><td>via Triton</td></tr>
				<tr><td>PagedAttention</td><td class="vllm-vs-good">✅</td><td>partiel</td><td>✅</td><td>✅</td></tr>
				<tr><td>Continuous batching</td><td class="vllm-vs-good">✅</td><td>partiel</td><td>✅</td><td>✅</td></tr>
				<tr><td>Multi-GPU</td><td class="vllm-vs-good">✅ tensor + pipeline</td><td>limité</td><td>✅</td><td class="vllm-vs-good">✅ optimisé</td></tr>
				<tr><td>Quantization AWQ/GPTQ/FP8</td><td class="vllm-vs-good">✅</td><td>GGUF (q4/q5/q8)</td><td>✅</td><td class="vllm-vs-good">✅ + INT4</td></tr>
				<tr><td>Licence</td><td class="vllm-vs-good">Apache 2.0</td><td class="vllm-vs-good">MIT</td><td>Apache 2.0</td><td>NVIDIA propriétaire</td></tr>
				<tr><td>Quand utiliser</td><td>Prod sérieuse, scale</td><td>Dev/laptop</td><td>HuggingFace ecosystem</td><td>Squeeze ultime sur H100/B200</td></tr>
			</tbody>
		</table>

		<Callout variant="insight" title="🎯 Recommandation pour ton projet souverain">
			<ul>
				<li><strong>Dev local</strong> sur ta GTX 1070 → Ollama (limité par 4 Go VRAM, mais le plus simple).</li>
				<li><strong>Prod air-gap sur RTX 5000 ou A100</strong> → vLLM. Apache 2.0, perf production-grade, OpenAI API compatible.</li>
				<li><strong>Scale extrême sur H100/B200</strong> → TensorRT-LLM (5-15 % plus rapide que vLLM, mais lock-in NVIDIA et plus complexe à opérer).</li>
			</ul>
		</Callout>
	</section>

	<!-- 6. SOUVERAIN -->
	<section id="sovereign" class="vllm-section">
		<h2 class="vllm-h2">7️⃣ Setup souverain — vLLM sur K8s air-gap</h2>
		<pre class="vllm-code"><code>{`# Manifest K8s pour servir Mistral 7B en production air-gap
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-mistral
  namespace: ai-inference
spec:
  replicas: 2  # 2 répliques pour HA
  selector:
    matchLabels:
      app: vllm-mistral
  template:
    metadata:
      labels:
        app: vllm-mistral
    spec:
      containers:
      - name: vllm
        image: registry.intranet/vllm/vllm-openai:v0.6.0  # ton mirror interne
        args:
          - --model=/models/mistral-7b-defense
          - --tensor-parallel-size=1
          - --max-model-len=8192
          - --gpu-memory-utilization=0.92
          - --enable-prefix-caching         # cache le system prompt commun
          - --max-num-seqs=64
          - --quantization=awq               # 4-bit, libère VRAM pour plus de batching
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: 32Gi
        volumeMounts:
        - name: models
          mountPath: /models
          readOnly: true
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: ai-models-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-mistral
  namespace: ai-inference
spec:
  selector:
    app: vllm-mistral
  ports:
  - port: 8000
    targetPort: 8000
---
# NetworkPolicy : seul l'agent LangGraph peut taper sur vLLM
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: vllm-only-from-agents
  namespace: ai-inference
spec:
  podSelector:
    matchLabels:
      app: vllm-mistral
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: defense-agents`}</code></pre>

		<Callout variant="warning" title="🔐 Points sécurité air-gap">
			<ul>
				<li>Image vLLM tirée d'un mirror interne (cosign-signed).</li>
				<li>Models stockés sur PVC chiffré, accessible en read-only.</li>
				<li>NetworkPolicy deny-all par défaut, autorise uniquement les agents LangGraph autorisés.</li>
				<li>Pas de télémétrie sortante (`--disable-log-stats` si pas d'observabilité interne).</li>
				<li>Activer le tracing vers Langfuse interne via OpenInference si besoin d'observation.</li>
			</ul>
		</Callout>
	</section>

	<!-- 7. GLOSSAIRE -->
	<section id="glossaire" class="vllm-section">
		<h2 class="vllm-h2">8️⃣ Glossaire</h2>
		<dl class="vllm-glossary">
			<div class="vllm-gl-row"><dt>AWQ</dt><dd>Activation-aware Weight Quantization. Quantization 4-bit qui préserve les poids les plus importants — qualité ≈ fp16.</dd></div>
			<div class="vllm-gl-row"><dt>Continuous batching</dt><dd>Stratégie où les requêtes peuvent rejoindre/quitter le batch à chaque step. Pas de padding, pas d'attente.</dd></div>
			<div class="vllm-gl-row"><dt>FP8</dt><dd>Format 8-bit float disponible sur Hopper (H100) et Blackwell. Plus rapide que fp16 sans perte significative.</dd></div>
			<div class="vllm-gl-row"><dt>GPTQ</dt><dd>Algorithme de quantization post-training, populaire avant AWQ. 4-bit ou 3-bit possible.</dd></div>
			<div class="vllm-gl-row"><dt>KV cache</dt><dd>Cache GPU des Keys/Values des tokens passés. Voir page Transformer.</dd></div>
			<div class="vllm-gl-row"><dt>PagedAttention</dt><dd>Technique vLLM qui découpe le KV cache en pages (16 tokens) gérées comme la mémoire virtuelle d'un OS. Élimine la fragmentation.</dd></div>
			<div class="vllm-gl-row"><dt>Prefix caching</dt><dd>Cache un préfixe commun (system prompt) entre toutes les requêtes. Massif gain quand 90 % des prompts partagent le même header.</dd></div>
			<div class="vllm-gl-row"><dt>Static batching</dt><dd>Stratégie naïve : on accumule N requêtes, on attend qu'elles finissent toutes. Padding important.</dd></div>
			<div class="vllm-gl-row"><dt>Tensor parallelism</dt><dd>Découper le modèle entre plusieurs GPUs (matrices splittées). Pour les modèles trop gros pour 1 GPU.</dd></div>
			<div class="vllm-gl-row"><dt>TGI</dt><dd>Text Generation Inference. Serveur d'inférence de HuggingFace. Concurrent de vLLM, écosystème HF natif.</dd></div>
			<div class="vllm-gl-row"><dt>Throughput</dt><dd>Nombre de requêtes complétées par seconde. Métrique économique principale d'un serveur LLM.</dd></div>
			<div class="vllm-gl-row"><dt>vLLM</dt><dd>Serveur d'inférence LLM open-source (Apache 2.0). Référence pour la production. Inventeur de PagedAttention.</dd></div>
		</dl>
	</section>
</article>

<style>
	.vllm { max-width: 1240px; margin: 0 auto; padding: 2rem 1rem 4rem; display: flex; flex-direction: column; gap: 2rem; }
	.vllm :global(p) { max-width: 880px; }
	.vllm-hero {
		text-align: center; padding: 2rem 1.5rem;
		background: linear-gradient(135deg, #f0f9ff 0%, #fff 100%);
		border-radius: 1.5rem; border: 1px solid #06b6d4;
	}
	.vllm-hero-emoji { font-size: 4rem; display: block; }
	.vllm-h1 { font-family: var(--font-display); font-size: 2.25rem; font-weight: 700; margin: 0.5rem 0 0; color: var(--color-ink-900); }
	.vllm-hero-lead { font-size: 1rem; max-width: 660px; margin: 0.85rem auto 1.5rem; line-height: 1.6; color: var(--color-ink-700); }
	.vllm-hero-actions { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; }
	.vllm-cta { padding: 0.65rem 1.4rem; background: #06b6d4; color: #fff; border-radius: 999px; text-decoration: none; font-weight: 500; }
	.vllm-cta-2 { background: #fff; color: var(--color-ink-900); border: 2px solid #06b6d4; }

	.vllm-toc { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem 1.5rem; }
	.vllm-toc-label { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem; }
	.vllm-toc-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0; }
	.vllm-toc-list a { color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem; }
	.vllm-toc-list a:hover { color: #06b6d4; }

	.vllm-section { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 80px; }
	.vllm-h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-ink-900); margin: 0; }
	.vllm-h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; color: var(--color-ink-900); margin: 1rem 0 0.5rem; }

	.vllm-prereq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem; }
	.vllm-prereq { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
	.vllm-prereq summary { cursor: pointer; padding: 0.85rem 1rem; font-family: var(--font-display); font-weight: 600; color: var(--color-ink-900); list-style: none; }
	.vllm-prereq summary::-webkit-details-marker { display: none; }
	.vllm-prereq summary::after { content: '▶'; float: right; color: var(--color-ink-500); font-size: 0.7rem; transition: transform 0.15s; }
	.vllm-prereq[open] summary::after { transform: rotate(90deg); }
	.vllm-prereq[open] summary { background: #f0f9ff; border-bottom: 1px solid #e2e8f0; }
	.vllm-prereq > div { padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; }

	.vllm-cost-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.6rem; }
	.vllm-cost { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; text-align: center; }
	.vllm-cost-bad { background: #fef2f2; border-color: #dc2626; }
	.vllm-cost-mid { background: #fff7ed; border-color: #fb923c; }
	.vllm-cost-good { background: #f0fdf4; border-color: #22c55e; }
	.vllm-cost-best { background: #ecfeff; border-color: #06b6d4; border-width: 2px; }
	.vllm-cost-label { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: var(--color-ink-500); }
	.vllm-cost-val { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-ink-900); margin: 0.4rem 0; }
	.vllm-cost-sub { font-size: 0.8rem; color: var(--color-ink-500); }
	.vllm-cost-coef { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.1); font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; }

	/* Simulator */
	.vllm-sim {
		background: #0f172a; border-radius: 1rem; padding: 1.25rem;
		display: flex; flex-direction: column; gap: 0.85rem;
	}
	.vllm-sim-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; }
	.vllm-sim-tab {
		padding: 0.7rem 0.85rem; background: #1e293b; border: 2px solid #334155;
		border-radius: 0.5rem; color: #cbd5e1; cursor: pointer;
		display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;
	}
	.vllm-sim-tab:hover { border-color: #06b6d4; }
	.vllm-sim-tab.is-active { background: #06b6d4; border-color: #06b6d4; color: #fff; font-weight: 600; }
	.vllm-sim-tab-name { text-align: left; flex: 1; }

	.vllm-sim-gpu {
		background: #1e293b; border-radius: 0.75rem; padding: 1rem;
		display: flex; flex-direction: column; gap: 0.5rem;
	}
	.vllm-sim-gpu-label { font-family: var(--font-mono); font-size: 0.8rem; color: #06b6d4; }
	.vllm-sim-slots { display: flex; flex-direction: column; gap: 0.4rem; }
	.vllm-sim-slot { display: grid; grid-template-columns: 60px 1fr; gap: 0.5rem; align-items: center; }
	.vllm-sim-slot-label { font-family: var(--font-mono); font-size: 0.7rem; color: #94a3b8; }
	.vllm-sim-slot-track {
		height: 28px; background: #0f172a; border-radius: 0.4rem;
		position: relative; overflow: hidden;
	}
	.vllm-sim-slot-fill {
		height: 100%; transition: width 0.3s; display: flex; align-items: center;
		padding: 0 0.5rem;
	}
	.vllm-sim-slot-text { font-family: var(--font-mono); font-size: 0.7rem; color: #fff; }
	.vllm-sim-slot-empty {
		font-family: var(--font-mono); font-size: 0.72rem; color: #64748b;
		padding: 0.4rem 0.7rem; font-style: italic;
	}

	.vllm-sim-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem; }
	.vllm-sim-stat { background: #1e293b; padding: 0.7rem 0.9rem; border-radius: 0.5rem; }
	.vllm-sim-stat-label { font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase; color: #94a3b8; }
	.vllm-sim-stat-val { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; color: #06b6d4; margin-top: 0.2rem; }
	.vllm-sim-stat-val-small { font-size: 0.85rem; }

	.vllm-sim-desc { background: #1e293b; padding: 0.75rem 1rem; border-radius: 0.5rem; color: #cbd5e1; font-size: 0.88rem; line-height: 1.5; border-left: 3px solid #06b6d4; }

	.vllm-sim-controls { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
	.vllm-sim-btn {
		padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #475569;
		border-radius: 999px; color: #cbd5e1; font-family: var(--font-mono); cursor: pointer;
	}
	.vllm-sim-btn-play { background: #06b6d4; border-color: #06b6d4; color: #fff; }

	/* PagedAttention viz */
	.vllm-paged-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
	@media (max-width: 720px) { .vllm-paged-grid { grid-template-columns: 1fr; } }
	.vllm-paged-card { padding: 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
	.vllm-paged-bad { border-left: 4px solid #dc2626; }
	.vllm-paged-good { border-left: 4px solid #06b6d4; background: #f0f9ff; }
	.vllm-paged-card h3 { font-family: var(--font-display); font-size: 1.05rem; margin: 0 0 0.6rem; color: var(--color-ink-900); }
	.vllm-paged-card p { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; }
	.vllm-mem-grid { display: grid; grid-template-columns: repeat(16, 1fr); gap: 2px; padding: 0.5rem; background: #0f172a; border-radius: 0.4rem; margin-bottom: 0.6rem; }
	.vllm-mem-cell { aspect-ratio: 1; border-radius: 1px; }
	.vllm-mem-legend { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
	.vllm-mem-leg {
		font-family: var(--font-mono); font-size: 0.7rem; padding: 0.15rem 0.5rem;
		border-radius: 0.25rem; color: #fff;
	}
	.vllm-mem-leg-used { background: #fb923c; }
	.vllm-mem-leg-reserved { background: rgba(251, 146, 60, 0.3); color: var(--color-ink-700); }
	.vllm-mem-leg-free { background: #1e293b; }

	.vllm-vs-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #fff; border-radius: 0.5rem; overflow: hidden; border: 1px solid #e2e8f0; }
	.vllm-vs-table thead { background: #f0f9ff; }
	.vllm-vs-table th { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: var(--color-ink-700); text-align: left; padding: 0.5rem 0.6rem; }
	.vllm-vs-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; color: var(--color-ink-700); }
	.vllm-vs-good { color: #16a34a; font-weight: 600; }

	.vllm-code {
		background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem;
		border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem;
		line-height: 1.6; margin: 0.5rem 0;
		white-space: pre-wrap; word-break: break-word;
	}

	/* ===== KV cache & PagedAttention sections ===== */
	.vllm-kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
	@media (max-width: 720px) { .vllm-kv-grid { grid-template-columns: 1fr; } }
	.vllm-kv-card { padding: 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
	.vllm-kv-bad { border-left: 4px solid #dc2626; }
	.vllm-kv-good { border-left: 4px solid #22c55e; background: #f0fdf4; }
	.vllm-kv-emoji { font-size: 1.5rem; }
	.vllm-kv-card h4 { font-family: var(--font-display); font-size: 1rem; font-weight: 700; margin: 0.3rem 0 0.5rem; color: var(--color-ink-900); }
	.vllm-kv-card p { font-size: 0.9rem; color: var(--color-ink-700); margin: 0 0 0.5rem; line-height: 1.55; }

	.vllm-paged-explain {
		padding: 1rem 1.25rem; background: #fef2f2;
		border-left: 4px solid #dc2626; border-radius: 0.5rem; margin: 0.5rem 0;
	}
	.vllm-paged-explain h4 { font-family: var(--font-display); margin: 0 0 0.4rem; color: #7f1d1d; }
	.vllm-paged-explain ul { margin: 0; padding-left: 1.25rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.55; }
	.vllm-paged-explain li { margin: 0.25rem 0; }

	/* ===== Production sizing section ===== */
	.vllm-formula {
		background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
		color: #e2e8f0; padding: 1.1rem 1.25rem; border-radius: 0.75rem;
		font-family: var(--font-mono); font-size: 1rem; text-align: center;
		border: 2px solid #06b6d4;
		box-shadow: 0 4px 12px rgba(6, 182, 212, 0.15);
	}
	.vllm-formula code { background: transparent; color: #06b6d4; font-size: 1rem; }
	.vllm-formula-legend {
		list-style: none; padding: 0; margin: 0.5rem 0 0;
		display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.4rem;
	}
	.vllm-formula-legend li {
		background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem;
		padding: 0.55rem 0.85rem; font-size: 0.85rem; color: var(--color-ink-700);
		line-height: 1.5;
	}

	.vllm-sizing {
		display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem;
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.85rem;
		padding: 1.25rem; margin: 0.5rem 0;
	}
	@media (max-width: 820px) { .vllm-sizing { grid-template-columns: 1fr; } }
	.vllm-sizing-math {
		display: flex; flex-direction: column; gap: 0.25rem;
		font-family: var(--font-mono); font-size: 0.82rem;
	}
	.vllm-sizing-line {
		display: flex; justify-content: space-between; align-items: center;
		gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 0.35rem;
		background: #f8fafc; color: var(--color-ink-700);
	}
	.vllm-sizing-line span:first-child { color: var(--color-ink-700); }
	.vllm-sizing-line span:last-child { color: var(--color-ink-900); font-weight: 500; white-space: nowrap; }
	.vllm-sizing-result {
		background: #f0f9ff !important; color: #0c4a6e !important;
		border-left: 3px solid #06b6d4; font-weight: 600;
	}
	.vllm-sizing-naif {
		background: #fef2f2 !important; color: #7f1d1d !important;
		border-left: 3px solid #dc2626;
	}
	.vllm-sizing-paged {
		background: #f0fdf4 !important; color: #14532d !important;
		border-left: 3px solid #22c55e;
	}
	.vllm-sizing-sep { height: 1px; background: #e2e8f0; margin: 0.25rem 0; }
	.vllm-sizing-comment {
		background: #fffbeb; border-left: 3px solid #f59e0b;
		padding: 0.85rem 1rem; border-radius: 0.4rem;
		font-size: 0.85rem; color: var(--color-ink-700); line-height: 1.55;
	}
	.vllm-sizing-comment p { margin: 0 0 0.4rem; }
	.vllm-sizing-comment ul { margin: 0; padding-left: 1.1rem; }
	.vllm-sizing-comment li { margin: 0.2rem 0; }

	.vllm-cost-table {
		width: 100%; border-collapse: collapse; font-size: 0.87rem;
		background: #fff; border-radius: 0.5rem; overflow: hidden;
		border: 1px solid #e2e8f0; margin: 0.5rem 0;
	}
	.vllm-cost-table thead { background: #f0f9ff; }
	.vllm-cost-table th {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: var(--color-ink-700); text-align: left; padding: 0.6rem 0.7rem;
	}
	.vllm-cost-table td { padding: 0.55rem 0.7rem; border-bottom: 1px solid #f1f5f9; color: var(--color-ink-700); }
	.vllm-cost-row-best { background: #ecfdf5; }
	.vllm-cost-row-best td { font-weight: 500; color: #064e3b; }

	.vllm-levers { display: flex; flex-direction: column; gap: 0.5rem; margin: 0.5rem 0; }
	.vllm-lever {
		display: grid; grid-template-columns: 36px 1fr; gap: 0.85rem;
		align-items: start;
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.6rem;
		padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700);
		line-height: 1.55;
	}
	.vllm-lever-num {
		display: flex; align-items: center; justify-content: center;
		width: 36px; height: 36px; border-radius: 50%;
		background: #06b6d4; color: #fff; font-family: var(--font-display);
		font-weight: 700; font-size: 1.1rem;
	}
	.vllm-lever code {
		background: #f1f5f9; color: #0c4a6e; padding: 0.05rem 0.35rem;
		border-radius: 0.25rem; font-size: 0.82em;
	}

	.vllm-glossary { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.vllm-gl-row {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem;
		padding: 0.65rem 1rem; display: grid; grid-template-columns: 200px 1fr; gap: 1rem;
	}
	.vllm-gl-row dt { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: #06b6d4; }
	.vllm-gl-row dd { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	@media (max-width: 600px) { .vllm-gl-row { grid-template-columns: 1fr; gap: 0.25rem; } }
</style>
