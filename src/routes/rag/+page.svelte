<!--
	/rag — Lab RAG avec Milvus, focus profondeur sur tous les concepts.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';

	const SAMPLE_TEXT = `L'acide chlorhydrique (HCl, CAS 7647-01-0) est un acide fort très corrosif. Il est classé GHS05 et GHS07. La manipulation requiert des équipements de protection individuels. Lunettes de sécurité EN166 obligatoires, gants nitrile épais (épaisseur supérieure à 0,4 millimètres), blouse manches longues. Pour les volumes supérieurs à 100 millilitres, la manipulation doit s'effectuer sous sorbonne. En cas de projection oculaire, la procédure d'urgence est la suivante : rincer immédiatement à la douche oculaire pendant 15 minutes minimum. Retirer les lentilles de contact si possible pendant le rinçage. Appeler le SAMU au 15 et la médecine du travail. Conserver le contenant du produit pour identification ultérieure. Tout contact oculaire avec une base forte ou un acide fort nécessite une consultation ophtalmologique en urgence.`;

	type ChunkStrategy = 'fixed' | 'sentence' | 'recursive' | 'semantic';
	let chunkStrategy = $state<ChunkStrategy>('fixed');

	const CHUNK_CONFIGS: Record<ChunkStrategy, { name: string; emoji: string; description: string; chunks: string[] }> = {
		fixed: {
			name: 'Fixed-size',
			emoji: '✂️',
			description: 'Découpe tous les 200 caractères sans tenir compte du sens. Simple et rapide, mais coupe au milieu des phrases. Risque : un chunk peut commencer par "...rincer immédiatement à la douche oculaire."',
			chunks: [
				"L'acide chlorhydrique (HCl, CAS 7647-01-0) est un acide fort très corrosif. Il est classé GHS05 et GHS07. La manipulation requiert des équipements de protection individuels. ",
				"Lunettes de sécurité EN166 obligatoires, gants nitrile épais (épaisseur supérieure à 0,4 millimètres), blouse manches longues. Pour les volumes supérieurs à 100 millilitres,",
				" la manipulation doit s'effectuer sous sorbonne. En cas de projection oculaire, la procédure d'urgence est la suivante : rincer immédiatement à la douche oculaire pendant 15 minutes",
				" minimum. Retirer les lentilles de contact si possible pendant le rinçage. Appeler le SAMU au 15 et la médecine du travail. Conserver le contenant du produit pour identification ultérieure.",
				" Tout contact oculaire avec une base forte ou un acide fort nécessite une consultation ophtalmologique en urgence."
			]
		},
		sentence: {
			name: 'Sentence-based',
			emoji: '📖',
			description: "Coupe à chaque phrase (point, point d'interrogation, point d'exclamation). Garantit des chunks lisibles, mais variabilité de taille importante. Une phrase peut faire 5 mots, une autre 50.",
			chunks: [
				"L'acide chlorhydrique (HCl, CAS 7647-01-0) est un acide fort très corrosif.",
				"Il est classé GHS05 et GHS07.",
				"La manipulation requiert des équipements de protection individuels.",
				"Lunettes de sécurité EN166 obligatoires, gants nitrile épais (épaisseur supérieure à 0,4 millimètres), blouse manches longues.",
				"Pour les volumes supérieurs à 100 millilitres, la manipulation doit s'effectuer sous sorbonne.",
				"En cas de projection oculaire, la procédure d'urgence est la suivante : rincer immédiatement à la douche oculaire pendant 15 minutes minimum.",
				"Retirer les lentilles de contact si possible pendant le rinçage.",
				"Appeler le SAMU au 15 et la médecine du travail.",
				"Conserver le contenant du produit pour identification ultérieure.",
				"Tout contact oculaire avec une base forte ou un acide fort nécessite une consultation ophtalmologique en urgence."
			]
		},
		recursive: {
			name: 'Recursive',
			emoji: '🔄',
			description: "Stratégie LangChain : essaie d'abord de couper sur les double-newlines (paragraphes), puis newlines, puis points, puis espaces. Cible une taille (ex : 300 chars) avec un overlap (ex : 50 chars) pour préserver le contexte aux frontières.",
			chunks: [
				"L'acide chlorhydrique (HCl, CAS 7647-01-0) est un acide fort très corrosif. Il est classé GHS05 et GHS07. La manipulation requiert des équipements de protection individuels.",
				"La manipulation requiert des équipements de protection individuels. Lunettes de sécurité EN166 obligatoires, gants nitrile épais (épaisseur supérieure à 0,4 millimètres), blouse manches longues.",
				"Pour les volumes supérieurs à 100 millilitres, la manipulation doit s'effectuer sous sorbonne. En cas de projection oculaire, la procédure d'urgence est la suivante : rincer immédiatement à la douche oculaire pendant 15 minutes minimum.",
				"En cas de projection oculaire, la procédure d'urgence est la suivante : rincer immédiatement à la douche oculaire pendant 15 minutes minimum. Retirer les lentilles de contact si possible pendant le rinçage. Appeler le SAMU au 15 et la médecine du travail.",
				"Conserver le contenant du produit pour identification ultérieure. Tout contact oculaire avec une base forte ou un acide fort nécessite une consultation ophtalmologique en urgence."
			]
		},
		semantic: {
			name: 'Semantic',
			emoji: '🧠',
			description: "Coupe aux endroits où la similarité sémantique entre phrases consécutives chute. Embedde chaque phrase, calcule la similarité cosinus avec la précédente, coupe quand la similarité passe sous un seuil. Résultat : chunks cohérents thématiquement.",
			chunks: [
				"L'acide chlorhydrique (HCl, CAS 7647-01-0) est un acide fort très corrosif. Il est classé GHS05 et GHS07.",
				"La manipulation requiert des équipements de protection individuels. Lunettes de sécurité EN166 obligatoires, gants nitrile épais (épaisseur supérieure à 0,4 millimètres), blouse manches longues. Pour les volumes supérieurs à 100 millilitres, la manipulation doit s'effectuer sous sorbonne.",
				"En cas de projection oculaire, la procédure d'urgence est la suivante : rincer immédiatement à la douche oculaire pendant 15 minutes minimum. Retirer les lentilles de contact si possible pendant le rinçage. Appeler le SAMU au 15 et la médecine du travail.",
				"Conserver le contenant du produit pour identification ultérieure. Tout contact oculaire avec une base forte ou un acide fort nécessite une consultation ophtalmologique en urgence."
			]
		}
	};
	const currentChunks = $derived(CHUNK_CONFIGS[chunkStrategy]);

	let hnswLayer = $state(2);
	let hnswHop = $state(0);
</script>

<svelte:head><title>RAG avec Milvus — Architecture complète</title></svelte:head>

<article class="rag">
	<header class="rag-hero">
		<span class="rag-hero-emoji">📚</span>
		<h1 class="rag-h1">RAG avec Milvus — Architecture complète</h1>
		<p class="rag-hero-lead">
			Donner à ton LLM accès à des documents qu'il consulte. Cette page va au fond : <strong>chunking sémantique,
			HNSW, top-k, MMR, consistency levels Milvus, hybrid search</strong> — chaque concept détaillé avec son rôle,
			ses pièges, et son intégration dans ton agent défense.
		</p>
	</header>

	<nav class="rag-toc">
		<p class="rag-toc-label">📍 Parcours</p>
		<ol class="rag-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#chunking">1. Chunking — comparateur interactif ⭐</a></li>
			<li><a href="#embeddings">2. Embeddings — dense, sparse, modèles</a></li>
			<li><a href="#index">3. Vector index — HNSW visualisé ⭐</a></li>
			<li><a href="#distance">4. Distance metrics — cosine, L2, IP</a></li>
			<li><a href="#topk">5. Top-K, MMR, reranking</a></li>
			<li><a href="#milvus">6. Milvus — consistency levels, partitions</a></li>
			<li><a href="#code">7. Code complet — défense + Milvus</a></li>
			<li><a href="#glossaire">8. Glossaire</a></li>
		</ol>
	</nav>

	<section id="prereq" class="rag-section">
		<h2 class="rag-h2">0️⃣ Avant de commencer</h2>
		<div class="rag-prereq-grid">
			<details class="rag-prereq">
				<summary>📚 Pourquoi RAG plutôt que fine-tuning</summary>
				<div><p>Pour <strong>injecter des connaissances factuelles</strong> (« quel est le calendrier de Persée ? »), le fine-tuning est mauvais — il provoque des hallucinations confiantes. Le RAG est la bonne réponse : on récupère les documents pertinents, on les met dans le contexte, le LLM répond. Connaissance externe, pas mémorisée.</p></div>
			</details>
			<details class="rag-prereq">
				<summary>🔢 Embedding (rappel)</summary>
				<div><p>Vecteur de N nombres (384, 768, 1024) qui représente un texte. Deux textes sémantiquement proches ont des embeddings proches. Calculé par un modèle dédié (BGE, E5, GTE…) — pas le même que le LLM qui répond.</p></div>
			</details>
			<details class="rag-prereq">
				<summary>🧊 Cosine similarity</summary>
				<div><p>Mesure d'angle entre deux vecteurs, dans [-1, 1]. 1 = identiques, 0 = orthogonaux, -1 = opposés. Pour des embeddings normalisés, équivalent au produit scalaire. Métrique standard.</p></div>
			</details>
			<details class="rag-prereq">
				<summary>📦 Top-K</summary>
				<div><p>Récupérer les K documents les plus proches de la requête. K typique : 3-5 pour un agent. Trop grand = bruit ; trop petit = on rate des infos. Détails en section 5.</p></div>
			</details>
			<details class="rag-prereq">
				<summary>🗺️ HNSW (Hierarchical Navigable Small World)</summary>
				<div><p>Index vectoriel le plus utilisé en production. Construction : un graphe à plusieurs couches où chaque nœud pointe vers ses voisins proches. La couche du haut est éparse (routage rapide), celles du bas sont denses (précision). Recherche en ~O(log N). Détaillé visuellement en section 3.</p></div>
			</details>
			<details class="rag-prereq">
				<summary>🔄 Bounded staleness (Milvus)</summary>
				<div><p>Niveau de consistance de Milvus : tu acceptes que les requêtes voient des données légèrement en retard (typiquement quelques secondes), en échange de meilleures performances. Détaillé en section 6.</p></div>
			</details>
			<details class="rag-prereq">
				<summary>🎯 Reranking</summary>
				<div><p>Phase post-récupération : on prend les top-K (ex : 30) du vector search, on les ré-ordonne avec un modèle plus précis (cross-encoder). On garde le top-N (ex : 5). Plus lent mais beaucoup plus précis.</p></div>
			</details>
			<details class="rag-prereq">
				<summary>🔍 BM25 / sparse search</summary>
				<div><p>Approche lexicale classique (recherche par mots-clés). Complémentaire des embeddings : excellent pour les acronymes, noms propres, codes exacts. En hybrid search, on combine les deux.</p></div>
			</details>
		</div>
	</section>

	<section id="chunking" class="rag-section">
		<h2 class="rag-h2">1️⃣ Chunking — la décision la plus sous-estimée</h2>
		<p>Un mauvais chunking gâche tout le reste. Si tes chunks coupent au milieu d'une procédure, le LLM ne pourra pas répondre correctement même avec le meilleur HNSW. <strong>4 stratégies à connaître</strong>, comparées interactivement sur le même texte source.</p>

		<div class="rag-chunk-sim">
			<div class="rag-chunk-tabs">
				{#each Object.entries(CHUNK_CONFIGS) as [id, c] (id)}
					<button type="button" class="rag-chunk-tab {chunkStrategy === id ? 'is-active' : ''}" onclick={() => (chunkStrategy = id as ChunkStrategy)}>
						<span>{c.emoji}</span> {c.name}
					</button>
				{/each}
			</div>
			<p class="rag-chunk-desc">{currentChunks.description}</p>
			<div class="rag-chunk-source">
				<div class="rag-chunk-label">📄 Texte source</div>
				<p>{SAMPLE_TEXT}</p>
			</div>
			<div class="rag-chunk-result">
				<div class="rag-chunk-label">✂️ Découpé en {currentChunks.chunks.length} chunks ({currentChunks.name})</div>
				<div class="rag-chunk-list">
					{#each currentChunks.chunks as chunk, i (i)}
						<div class="rag-chunk-item">
							<span class="rag-chunk-num">#{i + 1}</span>
							<span class="rag-chunk-text">{chunk}</span>
							<span class="rag-chunk-len">{chunk.length} chars</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<Callout variant="insight" title="🎯 Quand utiliser quelle stratégie">
			<table class="rag-table">
				<thead><tr><th>Stratégie</th><th>Quand</th><th>Risque</th></tr></thead>
				<tbody>
					<tr><td>Fixed-size</td><td>Prototypes rapides, corpus très uniformes</td><td>Coupe au milieu des phrases → embeddings dégradés</td></tr>
					<tr><td>Sentence-based</td><td>Texte naturel bien ponctué</td><td>Tailles très variables → pertinence inégale</td></tr>
					<tr><td>Recursive (LangChain)</td><td>Standard de facto, marche bien partout</td><td>Pas optimal sur du code ou des tables</td></tr>
					<tr><td>Semantic</td><td>Docs longs avec changements de sujet</td><td>Coûteux à l'indexation (un embedding par phrase)</td></tr>
				</tbody>
			</table>
			<p>Pour défense : <strong>Recursive avec overlap 50</strong> pour démarrer. <strong>Semantic</strong> sur docs très longs (notes de programme 50 pages).</p>
		</Callout>
	</section>

	<section id="embeddings" class="rag-section">
		<h2 class="rag-h2">2️⃣ Embeddings — dense, sparse, modèles</h2>
		<h3 class="rag-h3">Dense vs sparse</h3>
		<table class="rag-table">
			<thead><tr><th></th><th>Dense</th><th>Sparse</th></tr></thead>
			<tbody>
				<tr><td>Dimensions</td><td>384-1024 tous remplis</td><td>30k-50k, ~99% à zéro</td></tr>
				<tr><td>Modèles</td><td>BGE-m3, mE5, GTE</td><td>BM25, SPLADE</td></tr>
				<tr><td>Force</td><td>Sémantique : « voiture » matche « auto »</td><td>Lexical : « CAS 7647-01-0 » matche exactement</td></tr>
				<tr><td>Faiblesse</td><td>Mauvais sur acronymes, codes exacts</td><td>Manque les synonymes</td></tr>
			</tbody>
		</table>

		<h3 class="rag-h3">Modèles d'embedding recommandés</h3>
		<table class="rag-table">
			<thead><tr><th>Modèle</th><th>Dim</th><th>FR</th><th>Particularité</th></tr></thead>
			<tbody>
				<tr><td><code>BAAI/bge-m3</code></td><td>1024</td><td>✅ excellent</td><td>Multilingue, dense + sparse + multi-vec. <strong>Recommandé.</strong></td></tr>
				<tr><td><code>intfloat/multilingual-e5-large</code></td><td>1024</td><td>✅ très bon</td><td>Alternative éprouvée.</td></tr>
				<tr><td><code>OrdalieTech/Solon-embeddings-large</code></td><td>1024</td><td>✅ optimisé FR</td><td>Fine-tuné spécifiquement français.</td></tr>
				<tr><td><code>sentence-transformers/all-MiniLM-L6-v2</code></td><td>384</td><td>⚠️ EN</td><td>Très léger — prototypes.</td></tr>
			</tbody>
		</table>

		<Callout variant="info" title="💡 Pour ton projet souverain">
			<p><strong>BGE-m3</strong> : Apache 2.0, multilingue, excellent en français, support sparse intégré. Tourne sur ta RTX 5000 en quelques ms par texte.</p>
		</Callout>
	</section>

	<section id="index" class="rag-section">
		<h2 class="rag-h2">3️⃣ Vector index — HNSW expliqué visuellement ⭐</h2>
		<p>Une fois les embeddings calculés, comment retrouver rapidement les K plus proches parmi 10M vecteurs ? <strong>Pas avec une recherche linéaire</strong>. On utilise un <strong>index vectoriel</strong>. Le plus populaire : HNSW.</p>

		<h3 class="rag-h3">HNSW en une phrase</h3>
		<p>Construire un <strong>graphe à plusieurs couches</strong> où chaque document pointe vers ses voisins proches. Pour chercher, on descend les couches en suivant les liens qui se rapprochent de la requête — comme une carte routière où on prend d'abord l'autoroute (couche haute, éparse), puis les départementales, puis les rues (couches basses, denses).</p>

		<div class="rag-hnsw">
			<div class="rag-hnsw-controls">
				<label>Couche affichée :
					<select bind:value={hnswLayer} class="rag-hnsw-select">
						<option value={2}>Couche 2 (haute, éparse) — entrée</option>
						<option value={1}>Couche 1 (intermédiaire)</option>
						<option value={0}>Couche 0 (basse, dense) — précision</option>
					</select>
				</label>
				<label>Étape de recherche :
					<input type="range" min="0" max={6} bind:value={hnswHop} class="rag-hnsw-slider" />
					<span class="rag-hnsw-hop">{hnswHop} / 6</span>
				</label>
			</div>

			<svg viewBox="0 0 720 400" class="rag-hnsw-svg">
				<defs>
					<marker id="hnsw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#ff9d00" />
					</marker>
				</defs>

				{#if hnswLayer === 2}
					<text x="20" y="30" font-family="monospace" font-size="11" fill="#a855f7" font-weight="700">Couche 2 — éparse, 4 nœuds (entrée)</text>
					<line x1="150" y1="100" x2="350" y2="180" stroke="#475569" stroke-width="1" />
					<line x1="350" y1="180" x2="550" y2="120" stroke="#475569" stroke-width="1" />
					<line x1="550" y1="120" x2="600" y2="300" stroke="#475569" stroke-width="1" />
					<line x1="600" y1="300" x2="150" y2="100" stroke="#475569" stroke-width="1" />
					{#if hnswHop >= 1}
						<line x1="150" y1="100" x2="350" y2="180" stroke="#ff9d00" stroke-width="3" marker-end="url(#hnsw-arrow)" />
					{/if}
					<circle cx="150" cy="100" r="14" fill="#ff9d00" stroke="#fff" stroke-width="2" /><text x="150" y="104" text-anchor="middle" font-family="monospace" font-size="10" fill="#fff">0</text>
					<circle cx="350" cy="180" r="14" fill="#a855f7" stroke="#fff" stroke-width="2" /><text x="350" y="184" text-anchor="middle" font-family="monospace" font-size="10" fill="#fff">1</text>
					<circle cx="550" cy="120" r="14" fill="#a855f7" stroke="#fff" stroke-width="2" /><text x="550" y="124" text-anchor="middle" font-family="monospace" font-size="10" fill="#fff">2</text>
					<circle cx="600" cy="300" r="14" fill="#a855f7" stroke="#fff" stroke-width="2" /><text x="600" y="304" text-anchor="middle" font-family="monospace" font-size="10" fill="#fff">3</text>
					<circle cx="380" cy="220" r="10" fill="#facc15" stroke="#fff" stroke-width="2" />
					<text x="380" y="245" text-anchor="middle" font-family="monospace" font-size="10" fill="#facc15" font-weight="700">requête</text>
				{:else if hnswLayer === 1}
					<text x="20" y="30" font-family="monospace" font-size="11" fill="#06b6d4" font-weight="700">Couche 1 — intermédiaire, 12 nœuds</text>
					{#each [[80,80,200,60],[200,60,340,90],[340,90,480,70],[480,70,600,90],[120,200,280,180],[280,180,440,200],[440,200,580,180],[160,320,340,330],[340,330,520,320],[80,80,120,200],[340,90,280,180],[480,70,440,200]] as [x1,y1,x2,y2] (`${x1}-${y1}-${x2}-${y2}`)}
						<line {x1} {y1} {x2} {y2} stroke="#475569" stroke-width="0.8" opacity="0.6" />
					{/each}
					{#if hnswHop >= 2}
						<line x1="200" y1="60" x2="280" y2="180" stroke="#ff9d00" stroke-width="2.5" marker-end="url(#hnsw-arrow)" />
					{/if}
					{#if hnswHop >= 3}
						<line x1="280" y1="180" x2="340" y2="330" stroke="#ff9d00" stroke-width="2.5" marker-end="url(#hnsw-arrow)" />
					{/if}
					{#each [[80,80],[200,60],[340,90],[480,70],[600,90],[120,200],[280,180],[440,200],[580,180],[160,320],[340,330],[520,320]] as [x,y], i (`${x}-${y}`)}
						<circle cx={x} cy={y} r="11" fill={i === 6 ? '#ff9d00' : '#06b6d4'} stroke="#fff" stroke-width="1.5" />
						<text x={x} y={y + 3} text-anchor="middle" font-family="monospace" font-size="9" fill="#fff">{i}</text>
					{/each}
					<circle cx="380" cy="230" r="10" fill="#facc15" stroke="#fff" stroke-width="2" />
					<text x="380" y="255" text-anchor="middle" font-family="monospace" font-size="10" fill="#facc15" font-weight="700">requête</text>
				{:else}
					<text x="20" y="30" font-family="monospace" font-size="11" fill="#22c55e" font-weight="700">Couche 0 — dense, 36 nœuds (tous les documents)</text>
					{#each Array(36) as _, i (i)}
						{@const row = Math.floor(i / 9)}
						{@const col = i % 9}
						{@const x = 70 + col * 75 + (row % 2 === 1 ? 35 : 0)}
						{@const y = 60 + row * 80}
						<circle cx={x} cy={y} r="8" fill={i === 18 ? '#ff9d00' : '#22c55e'} stroke="#fff" stroke-width="1" />
						<text x={x} y={y + 3} text-anchor="middle" font-family="monospace" font-size="7" fill="#fff">{i}</text>
					{/each}
					{#if hnswHop >= 4}
						<line x1="305" y1="220" x2="380" y2="220" stroke="#ff9d00" stroke-width="2.5" marker-end="url(#hnsw-arrow)" />
					{/if}
					{#if hnswHop >= 5}
						<line x1="380" y1="220" x2="455" y2="220" stroke="#ff9d00" stroke-width="2.5" marker-end="url(#hnsw-arrow)" />
					{/if}
					{#if hnswHop >= 6}
						<circle cx="455" cy="220" r="14" fill="none" stroke="#facc15" stroke-width="3">
							<animate attributeName="r" values="14;20;14" dur="1.2s" repeatCount="indefinite" />
						</circle>
					{/if}
					<text x="50" y="380" font-family="monospace" font-size="10" fill="#cbd5e1">→ top-K récupéré au step 6</text>
				{/if}
			</svg>

			<div class="rag-hnsw-explain">
				{#if hnswHop === 0}
					<p>👀 <strong>Step 0</strong> — Vue initiale. Le point orange marque l'<em>entry point</em> du graphe (couche la plus haute). La requête (jaune) cherche ses voisins.</p>
				{:else if hnswHop <= 2}
					<p>🛬 <strong>Step {hnswHop}</strong> — On parcourt la couche haute en suivant le voisin le plus proche de la requête. Quand on ne peut plus se rapprocher, on descend.</p>
				{:else if hnswHop <= 4}
					<p>🛣️ <strong>Step {hnswHop}</strong> — Couche intermédiaire. On affine en suivant les voisins. Plus de nœuds, plus de précision.</p>
				{:else}
					<p>🎯 <strong>Step {hnswHop}</strong> — Couche dense (tous les documents). On trouve les top-K voisins finaux. ~6 hops sur un graphe de 36 docs — au lieu des 36 comparaisons d'une recherche linéaire.</p>
				{/if}
			</div>
		</div>

		<h3 class="rag-h3">Paramètres HNSW dans Milvus</h3>
		<table class="rag-table">
			<thead><tr><th>Param</th><th>Défaut</th><th>Effet</th><th>Quand changer</th></tr></thead>
			<tbody>
				<tr><td><code>M</code></td><td>16</td><td>Nb de voisins par nœud. Plus = meilleur recall, plus de RAM.</td><td>32 si + précision, 8 si VRAM limitée</td></tr>
				<tr><td><code>efConstruction</code></td><td>200</td><td>Effort à l'indexation. Plus = meilleur graphe, build plus long.</td><td>400+ pour 10M+ docs</td></tr>
				<tr><td><code>ef</code> (search)</td><td>100</td><td>Effort à la recherche. Plus = meilleur recall, plus lent.</td><td>40-80 si latence critique, 200+ si précision critique</td></tr>
			</tbody>
		</table>

		<h3 class="rag-h3">HNSW vs autres index Milvus</h3>
		<table class="rag-table">
			<thead><tr><th>Index</th><th>Vitesse</th><th>RAM</th><th>Recall</th><th>Usage</th></tr></thead>
			<tbody>
				<tr><td><code>FLAT</code></td><td>Lent O(N)</td><td>Min</td><td>100% exact</td><td>Petits corpus &lt; 100k, ground truth</td></tr>
				<tr><td><code>IVF_FLAT</code></td><td>Moyen</td><td>Moyen</td><td>~95%</td><td>Moyens corpus, contrôle fin</td></tr>
				<tr><td><code>HNSW</code></td><td>Rapide</td><td>Élevé</td><td>~99%</td><td><strong>Recommandé production</strong></td></tr>
				<tr><td><code>DISKANN</code></td><td>Variable</td><td>Min (SSD)</td><td>~95%</td><td>Énormes corpus 1B+</td></tr>
				<tr><td><code>GPU_CAGRA</code></td><td>Ultra rapide</td><td>VRAM</td><td>~98%</td><td>Si GPU dédié à l'index</td></tr>
			</tbody>
		</table>
	</section>

	<section id="distance" class="rag-section">
		<h2 class="rag-h2">4️⃣ Distance metrics</h2>
		<p>Pour comparer 2 vecteurs, Milvus propose 3 métriques. <strong>Le choix dépend de comment ton modèle d'embedding a été entraîné</strong>.</p>
		<div class="rag-dist-grid">
			<div class="rag-dist">
				<div class="rag-dist-emoji">📐</div>
				<h4>COSINE</h4>
				<p>1 − cos(angle). Range [0, 2], 0 = identique. Insensible à la magnitude — focus sur la direction.</p>
				<p class="rag-dist-when"><strong>Quand</strong> : sentence-transformers, BGE, E5. <em>Le plus courant.</em></p>
			</div>
			<div class="rag-dist">
				<div class="rag-dist-emoji">📏</div>
				<h4>L2 (Euclidean)</h4>
				<p>Distance euclidienne : √Σ(a−b)². Sensible à la magnitude.</p>
				<p class="rag-dist-when"><strong>Quand</strong> : embeddings non normalisés.</p>
			</div>
			<div class="rag-dist">
				<div class="rag-dist-emoji">🔘</div>
				<h4>IP (Inner Product)</h4>
				<p>Produit scalaire : Σa·b. Pour vecteurs normalisés, équivalent à COSINE mais plus rapide.</p>
				<p class="rag-dist-when"><strong>Quand</strong> : embeddings normalisés.</p>
			</div>
		</div>
		<Callout variant="info" title="💡 Règle pratique"><p><strong>Lis la doc du modèle d'embedding.</strong> BGE-m3 → cosine. mE5 → cosine. SPLADE → IP. Le mauvais choix dégrade le recall de 10-30 %.</p></Callout>
	</section>

	<section id="topk" class="rag-section">
		<h2 class="rag-h2">5️⃣ Top-K, MMR, et reranking</h2>
		<h3 class="rag-h3">Top-K — combien de documents récupérer</h3>
		<p>Top-K = nb de documents remontés après vector search. Tu vas <strong>les mettre dans le prompt</strong>, donc K impacte directement le coût d'inférence et la qualité.</p>
		<table class="rag-table">
			<thead><tr><th>K</th><th>Effet</th></tr></thead>
			<tbody>
				<tr><td><strong>1-2</strong></td><td>Risqué : si le top-1 est mauvais, tu rates l'info.</td></tr>
				<tr><td><strong>3-5</strong></td><td><strong>Sweet spot pour la plupart des agents.</strong></td></tr>
				<tr><td><strong>10-20</strong></td><td>Plus de chance d'avoir l'info, saturation du contexte. Utiliser avec reranking.</td></tr>
				<tr><td><strong>50+</strong></td><td>Phase avant un reranker, jamais directement dans le prompt.</td></tr>
			</tbody>
		</table>

		<h3 class="rag-h3">MMR — Maximal Marginal Relevance</h3>
		<p>Problème : top-K donne souvent <em>10 docs très proches</em> les uns des autres (redondance). MMR rééquilibre : <strong>il favorise les docs pertinents qui sont aussi divers</strong>.</p>
		<pre class="rag-code"><code>{`# Avec MMR (lambda 0.5 = équilibre pertinence/diversité)
results = vector_store.max_marginal_relevance_search(
    query=question, k=5, fetch_k=20, lambda_mult=0.5
)
# → 5 docs pertinents ET complémentaires`}</code></pre>

		<h3 class="rag-h3">Reranking — la touche finale</h3>
		<p>Le vector search est rapide mais imprécis. Un reranker (cross-encoder) est lent mais précis. <strong>Recette gagnante : vector search top-30 → reranker top-5</strong>.</p>
		<pre class="rag-code"><code>{`from sentence_transformers import CrossEncoder

reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")  # Apache 2.0, marche en FR

candidates = milvus.search(query_vector, top_k=30)
pairs = [(question, doc.text) for doc in candidates]
scores = reranker.predict(pairs)
top_5 = sorted(zip(candidates, scores), key=lambda x: -x[1])[:5]`}</code></pre>
	</section>

	<section id="milvus" class="rag-section">
		<h2 class="rag-h2">6️⃣ Milvus — consistency levels et partitions</h2>
		<h3 class="rag-h3">Les 4 niveaux de consistance</h3>
		<p>Milvus est distribué. Quand tu insères un vecteur, il n'est pas instantanément visible — il faut le temps de la propagation. Tu choisis quel niveau de cohérence tu veux.</p>
		<table class="rag-table">
			<thead><tr><th>Niveau</th><th>Délai</th><th>Cas d'usage</th></tr></thead>
			<tbody>
				<tr><td><code>Strong</code></td><td>Aucun (read-after-write garanti)</td><td>Test d'intégrité, debug. Lent.</td></tr>
				<tr><td><code>Bounded</code></td><td>Borné (typique 3 sec)</td><td><strong>Production standard.</strong> 3 sec de retard max pour des lectures rapides.</td></tr>
				<tr><td><code>Session</code></td><td>Read-your-writes par session</td><td>Une session voit ses écritures, sans cohérence globale.</td></tr>
				<tr><td><code>Eventually</code></td><td>Non borné</td><td>Le plus rapide, le moins consistent. Stats, analytics.</td></tr>
			</tbody>
		</table>

		<Callout variant="warning" title="🔐 Pour ton projet défense : Bounded">
			<p><strong>Bounded</strong> est le bon choix : tu acceptes qu'un doc indexé il y a 3 sec ne soit pas encore visible. En échange, les requêtes sont 5× plus rapides qu'en Strong.</p>
			<pre class="rag-code" style="margin-top:0.6rem"><code>{`# Recherche en Bounded (défaut prod)
collection.search(query_vector, consistency_level="Bounded")

# Recherche en Strong (cas spécifique : test d'intégration post-insertion)
collection.search(query_vector, consistency_level="Strong")`}</code></pre>
		</Callout>

		<h3 class="rag-h3">Partitions — sécurité physique par classification</h3>
		<p>Milvus permet de créer des <strong>partitions logiques</strong> dans une collection. Tu peux limiter une recherche à certaines partitions — c'est la clé pour appliquer la sécurité par habilitation au niveau du store.</p>
		<pre class="rag-code"><code>{`# Partitions par niveau de classification
collection.create_partition("cls_NP")
collection.create_partition("cls_DR")
collection.create_partition("cls_CD")
collection.create_partition("cls_SD")
collection.create_partition("cls_TSD")

# Insertion dans la bonne partition
collection.insert([vec, metadata], partition_name="cls_CD")

# Recherche limitée aux partitions autorisées par l'habilitation
collection.search(
    query_vector,
    partition_names=["cls_NP", "cls_DR", "cls_CD"],
    # Pas SD ni TSD si user_clearance = CD
)`}</code></pre>
		<p><strong>Avantage majeur</strong> : la sécurité par habilitation est appliquée AU NIVEAU DU STORE — Milvus ne peut <em>physiquement pas</em> retourner un doc d'une partition exclue, même si une bug dans ton code essayait.</p>
	</section>

	<section id="code" class="rag-section">
		<h2 class="rag-h2">7️⃣ Code complet — défense + Milvus</h2>
		<pre class="rag-code"><code>{`from pymilvus import MilvusClient, DataType
from sentence_transformers import SentenceTransformer, CrossEncoder

# === 1. Setup Milvus ===
client = MilvusClient(uri="https://milvus.intranet:19530", token="...")

schema = client.create_schema(auto_id=True)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("text", DataType.VARCHAR, max_length=8192)
schema.add_field("classification", DataType.VARCHAR, max_length=8)
schema.add_field("source_id", DataType.VARCHAR, max_length=64)
schema.add_field("embedding", DataType.FLOAT_VECTOR, dim=1024)

# Index HNSW + cosine
index_params = client.prepare_index_params()
index_params.add_index(
    field_name="embedding", index_type="HNSW", metric_type="COSINE",
    params={"M": 16, "efConstruction": 200}
)
client.create_collection("defense_docs", schema=schema, index_params=index_params)

for level in ["NP", "DR", "CD", "SD", "TSD"]:
    client.create_partition("defense_docs", f"cls_{level}")

# === 2. Indexation avec chunking recursive ===
embedder = SentenceTransformer("BAAI/bge-m3")
def index_document(text, classification, source_id):
    chunks = recursive_split(text, size=400, overlap=50)
    for chunk in chunks:
        vec = embedder.encode(chunk, normalize_embeddings=True)
        client.insert("defense_docs", [{
            "text": chunk, "classification": classification,
            "source_id": source_id, "embedding": vec.tolist()
        }], partition_name=f"cls_{classification}")

# === 3. Recherche filtrée par habilitation + reranking ===
def search_for_user(query, user_clearance, top_k=5):
    LEVELS = {"NP": 1, "DR": 2, "CD": 3, "SD": 4, "TSD": 5}
    user_level = LEVELS[user_clearance]
    allowed = [f"cls_{lvl}" for lvl, n in LEVELS.items() if n <= user_level]

    query_vec = embedder.encode(query, normalize_embeddings=True)
    results = client.search(
        "defense_docs", data=[query_vec.tolist()],
        partition_names=allowed,       # ← sécurité par habilitation
        limit=30,                       # vector search large
        output_fields=["text", "classification", "source_id"],
        search_params={"params": {"ef": 100}},
        consistency_level="Bounded",
    )

    # Reranking cross-encoder
    reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")
    candidates = [r["entity"] for r in results[0]]
    pairs = [(query, c["text"]) for c in candidates]
    scores = reranker.predict(pairs)
    return [c for c, _ in sorted(zip(candidates, scores), key=lambda x: -x[1])[:top_k]]`}</code></pre>
	</section>

	<section id="glossaire" class="rag-section">
		<h2 class="rag-h2">8️⃣ Glossaire</h2>
		<dl class="rag-glossary">
			<div class="rag-gl-row"><dt>BGE-m3</dt><dd>Modèle d'embedding multilingue (Apache 2.0) supportant dense + sparse + multi-vector. Recommandé pour le français.</dd></div>
			<div class="rag-gl-row"><dt>Bounded staleness</dt><dd>Niveau de consistance Milvus : tu acceptes un délai borné (~3s) entre insertion et visibilité, en échange de meilleures perfs.</dd></div>
			<div class="rag-gl-row"><dt>Chunking sémantique</dt><dd>Découper un texte aux endroits où la similarité entre phrases consécutives chute. Produit des chunks thématiquement cohérents.</dd></div>
			<div class="rag-gl-row"><dt>Cosine similarity</dt><dd>Mesure d'angle entre deux vecteurs, [-1, 1]. Métrique standard pour la recherche sémantique.</dd></div>
			<div class="rag-gl-row"><dt>Cross-encoder</dt><dd>Architecture qui prend une PAIRE (query, doc) et produit un score. Lent mais précis. Utilisé en reranking.</dd></div>
			<div class="rag-gl-row"><dt>DISKANN</dt><dd>Index vectoriel Milvus pour très gros corpus (1B+ docs). SSD, faible RAM.</dd></div>
			<div class="rag-gl-row"><dt>efConstruction / ef</dt><dd>Paramètres HNSW : effort à l'indexation / à la recherche.</dd></div>
			<div class="rag-gl-row"><dt>Embedding dense</dt><dd>Vecteur de N floats (384-1024) tous remplis. Capture la sémantique.</dd></div>
			<div class="rag-gl-row"><dt>Embedding sparse</dt><dd>Vecteur très haute dim (~50k), 99% à zéro. Capture le lexical (BM25, SPLADE).</dd></div>
			<div class="rag-gl-row"><dt>HNSW</dt><dd>Hierarchical Navigable Small World. Index vectoriel à plusieurs couches, le plus utilisé. ~O(log N) en recherche.</dd></div>
			<div class="rag-gl-row"><dt>Hybrid search</dt><dd>Combiner dense + sparse search. Améliore le recall sur acronymes, codes.</dd></div>
			<div class="rag-gl-row"><dt>IVF</dt><dd>Inverted File index. Partitionne l'espace en clusters.</dd></div>
			<div class="rag-gl-row"><dt>M (HNSW)</dt><dd>Nb de voisins par nœud. Défaut 16.</dd></div>
			<div class="rag-gl-row"><dt>Milvus</dt><dd>Base vectorielle open-source (Apache 2.0). Production-grade, K8s-natif.</dd></div>
			<div class="rag-gl-row"><dt>MMR</dt><dd>Maximal Marginal Relevance. Équilibre pertinence et diversité.</dd></div>
			<div class="rag-gl-row"><dt>Partition (Milvus)</dt><dd>Sous-ensemble logique d'une collection. Filtre physique par classification.</dd></div>
			<div class="rag-gl-row"><dt>Recall</dt><dd>% des vrais top-K que l'index retrouve.</dd></div>
			<div class="rag-gl-row"><dt>Reranking</dt><dd>Ré-ordonner les top-K avec un cross-encoder. Recette : top-30 → rerank → top-5.</dd></div>
			<div class="rag-gl-row"><dt>Top-K</dt><dd>K documents les plus proches. Sweet spot agent : K=3-5.</dd></div>
		</dl>
	</section>
</article>

<style>
	.rag { max-width: 1240px; margin: 0 auto; padding: 2rem 1rem 4rem; display: flex; flex-direction: column; gap: 2rem; }
	.rag :global(p) { max-width: 880px; }
	.rag-hero { text-align: center; padding: 2rem 1.5rem; background: linear-gradient(135deg, #f0fdfa 0%, #fff 100%); border-radius: 1.5rem; border: 1px solid #14b8a6; }
	.rag-hero-emoji { font-size: 4rem; display: block; }
	.rag-h1 { font-family: var(--font-display); font-size: 2.25rem; font-weight: 700; margin: 0.5rem 0 0; color: var(--color-ink-900); }
	.rag-hero-lead { font-size: 1rem; max-width: 680px; margin: 0.85rem auto 0; line-height: 1.6; color: var(--color-ink-700); }
	.rag-toc { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem 1.5rem; }
	.rag-toc-label { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem; }
	.rag-toc-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0; }
	.rag-toc-list a { color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem; }
	.rag-toc-list a:hover { color: #14b8a6; }
	.rag-section { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 80px; }
	.rag-h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-ink-900); margin: 0; }
	.rag-h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; color: var(--color-ink-900); margin: 1rem 0 0.5rem; }

	.rag-prereq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem; }
	.rag-prereq { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
	.rag-prereq summary { cursor: pointer; padding: 0.85rem 1rem; font-family: var(--font-display); font-weight: 600; color: var(--color-ink-900); list-style: none; }
	.rag-prereq summary::-webkit-details-marker { display: none; }
	.rag-prereq summary::after { content: '▶'; float: right; color: var(--color-ink-500); font-size: 0.7rem; transition: transform 0.15s; }
	.rag-prereq[open] summary::after { transform: rotate(90deg); }
	.rag-prereq[open] summary { background: #f0fdfa; border-bottom: 1px solid #e2e8f0; }
	.rag-prereq > div { padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; }

	.rag-chunk-sim { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.rag-chunk-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.rag-chunk-tab { padding: 0.5rem 1rem; background: #fff; border: 2px solid #e2e8f0; border-radius: 999px; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }
	.rag-chunk-tab:hover { border-color: #14b8a6; }
	.rag-chunk-tab.is-active { background: #14b8a6; border-color: #14b8a6; color: #fff; font-weight: 600; }
	.rag-chunk-desc { background: #fff; border-left: 3px solid #14b8a6; border-radius: 0.4rem; padding: 0.7rem 0.9rem; font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	.rag-chunk-source, .rag-chunk-result { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.6rem; padding: 0.85rem; }
	.rag-chunk-source p { margin: 0.4rem 0 0; font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.6; }
	.rag-chunk-label { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: var(--color-ink-500); }
	.rag-chunk-list { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem; }
	.rag-chunk-item { display: grid; grid-template-columns: 36px 1fr 70px; gap: 0.5rem; align-items: start; padding: 0.5rem 0.7rem; background: #f8fafc; border-radius: 0.4rem; border-left: 3px solid #14b8a6; }
	.rag-chunk-num { font-family: var(--font-mono); font-size: 0.78rem; color: #14b8a6; font-weight: 700; }
	.rag-chunk-text { font-size: 0.85rem; color: var(--color-ink-700); line-height: 1.5; }
	.rag-chunk-len { font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-ink-500); text-align: right; }

	.rag-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; background: #fff; border-radius: 0.5rem; overflow: hidden; border: 1px solid #e2e8f0; }
	.rag-table thead { background: #f0fdfa; }
	.rag-table th { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: var(--color-ink-700); text-align: left; padding: 0.5rem 0.7rem; }
	.rag-table td { padding: 0.5rem 0.7rem; border-bottom: 1px solid #f1f5f9; color: var(--color-ink-700); vertical-align: top; }
	.rag-table code { background: #f0fdfa; color: #134e4a; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-family: var(--font-mono); font-size: 0.85em; }

	.rag-hnsw { background: #0f172a; border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
	.rag-hnsw-controls { display: flex; gap: 1rem; flex-wrap: wrap; }
	.rag-hnsw-controls label { display: flex; align-items: center; gap: 0.5rem; color: #cbd5e1; font-family: var(--font-mono); font-size: 0.78rem; }
	.rag-hnsw-select { padding: 0.4rem 0.7rem; background: #1e293b; border: 1px solid #475569; border-radius: 0.4rem; color: #e2e8f0; font-family: var(--font-mono); font-size: 0.8rem; }
	.rag-hnsw-slider { width: 200px; accent-color: #14b8a6; }
	.rag-hnsw-hop { font-family: var(--font-mono); font-size: 0.8rem; color: #14b8a6; font-weight: 700; }
	.rag-hnsw-svg { width: 100%; height: auto; max-height: 420px; background: #1e293b; border-radius: 0.5rem; }
	.rag-hnsw-explain { padding: 0.75rem 1rem; background: #1e293b; border-left: 3px solid #14b8a6; border-radius: 0.4rem; font-size: 0.88rem; color: #cbd5e1; line-height: 1.55; }
	.rag-hnsw-explain p { margin: 0; }

	.rag-dist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.6rem; }
	.rag-dist { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; }
	.rag-dist-emoji { font-size: 1.75rem; }
	.rag-dist h4 { font-family: var(--font-mono); font-size: 1rem; font-weight: 700; color: var(--color-ink-900); margin: 0.3rem 0 0.4rem; }
	.rag-dist p { font-size: 0.88rem; color: var(--color-ink-700); margin: 0 0 0.4rem; line-height: 1.55; }
	.rag-dist-when { font-size: 0.82rem !important; color: var(--color-ink-500) !important; }

	.rag-code { background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem; border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.6; margin: 0.5rem 0; white-space: pre-wrap; word-break: break-word; }
	.rag-glossary { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.rag-gl-row { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.65rem 1rem; display: grid; grid-template-columns: 200px 1fr; gap: 1rem; }
	.rag-gl-row dt { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: #14b8a6; }
	.rag-gl-row dd { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	@media (max-width: 600px) { .rag-gl-row { grid-template-columns: 1fr; gap: 0.25rem; } }
</style>
