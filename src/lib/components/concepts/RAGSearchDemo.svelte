<!--
	RAGSearchDemo.svelte
	====================
	Démo interactive de recherche vectorielle avec Milvus.

	L'utilisateur :
	- Choisit ou tape une requête
	- Voit les 6 documents (corpus défense fictif) classés par similarité
	- Ajuste top-K et le filtre par classification
	- Voit le contexte qui sera passé au LLM + la réponse simulée
-->
<script lang="ts">
	type Classification = 'NP' | 'DR' | 'CD' | 'SD';

	interface DocChunk {
		id: number;
		title: string;
		content: string;
		classification: Classification;
		// vecteur d'embedding fictif (10 dims pour la viz)
		embedding: number[];
	}

	const CORPUS: DocChunk[] = [
		{
			id: 1,
			title: 'Protocole EPI — Acide chlorhydrique au laboratoire',
			content: 'HCl 37 % (CAS 7647-01-0) requiert lunettes EN166, gants nitrile ≥ 0,4 mm, sorbonne pour > 100 mL. En cas de projection : douche oculaire 15 min minimum.',
			classification: 'DR',
			embedding: [0.85, 0.62, 0.91, 0.34, 0.78, 0.45, 0.82, 0.39, 0.71, 0.55]
		},
		{
			id: 2,
			title: 'Calendrier programme Léonidas — phases et livraisons',
			content: 'Programme Léonidas (CD) : phase 1 prototype au T2 2026, phase 2 essais statiques T4 2026, livraison série T2 2027. Source : note N°2024-AD-0457.',
			classification: 'CD',
			embedding: [0.21, 0.34, 0.18, 0.92, 0.29, 0.87, 0.24, 0.81, 0.26, 0.79]
		},
		{
			id: 3,
			title: 'Réglementation REACH pour produits chimiques',
			content: 'REACH (CE 1907/2006) impose enregistrement préalable de toute substance > 1 t/an. Catégories : enregistrement, évaluation, autorisation, restriction.',
			classification: 'NP',
			embedding: [0.72, 0.55, 0.83, 0.41, 0.69, 0.52, 0.78, 0.46, 0.65, 0.58]
		},
		{
			id: 4,
			title: 'Habilitations défense — guide officier de sécurité',
			content: 'Niveaux : NP < DR < CD < SD < TSD. L\'élévation se fait via demande motivée à la DGSI, avec enquête de sécurité.',
			classification: 'CD',
			embedding: [0.31, 0.42, 0.27, 0.85, 0.38, 0.79, 0.33, 0.76, 0.36, 0.72]
		},
		{
			id: 5,
			title: 'Procédure d\'urgence — projection oculaire produits chimiques',
			content: 'Toute projection : douche oculaire la plus proche, rinçage 15 min minimum, paupières ouvertes, retirer les lentilles pendant le rinçage. Appeler SAMU (15).',
			classification: 'NP',
			embedding: [0.81, 0.59, 0.88, 0.37, 0.75, 0.48, 0.79, 0.42, 0.68, 0.61]
		},
		{
			id: 6,
			title: 'Spécifications programme Persée',
			content: 'Programme Persée (SD) : capacités contre-mesures électroniques bande X. Détails techniques classifiés. Owner : DGA-MI.',
			classification: 'SD',
			embedding: [0.18, 0.31, 0.15, 0.94, 0.26, 0.89, 0.22, 0.83, 0.24, 0.81]
		}
	];

	// Requêtes pré-définies avec embedding fictif
	interface PresetQuery {
		text: string;
		embedding: number[];
		emoji: string;
	}

	const QUERIES: PresetQuery[] = [
		{
			emoji: '🧪',
			text: 'Quels EPI pour manipuler de l\'acide chlorhydrique ?',
			// proche des docs chimie/sécu (1, 3, 5)
			embedding: [0.82, 0.6, 0.9, 0.35, 0.76, 0.46, 0.8, 0.4, 0.69, 0.56]
		},
		{
			emoji: '📅',
			text: 'Quel est le calendrier de livraison du programme Léonidas ?',
			// proche des docs programmes (2, 4, 6)
			embedding: [0.22, 0.36, 0.2, 0.9, 0.31, 0.85, 0.26, 0.79, 0.28, 0.77]
		},
		{
			emoji: '🚨',
			text: 'Procédure en cas d\'accident chimique au labo ?',
			// proche de docs urgence (5, 1, 3)
			embedding: [0.79, 0.58, 0.86, 0.38, 0.74, 0.49, 0.77, 0.43, 0.67, 0.6]
		}
	];

	// =========================================================
	// État
	// =========================================================
	let selectedQueryIdx = $state(0);
	let topK = $state(3);
	let userClearance = $state<Classification>('CD');

	const query = $derived(QUERIES[selectedQueryIdx]);

	// Calcul de similarité cosinus (simplifié) entre query et chaque doc
	function cosineSim(a: number[], b: number[]): number {
		let dot = 0, normA = 0, normB = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
	}

	const LEVELS: Record<Classification, number> = { NP: 1, DR: 2, CD: 3, SD: 4 };

	// Score + filtre habilitation
	const scoredDocs = $derived.by(() => {
		const scored = CORPUS.map((doc) => ({
			...doc,
			score: cosineSim(query.embedding, doc.embedding),
			allowed: LEVELS[doc.classification] <= LEVELS[userClearance]
		}));
		return scored.sort((a, b) => b.score - a.score);
	});

	// Top-K parmi ceux qui passent le filtre
	const topResults = $derived(
		scoredDocs.filter((d) => d.allowed).slice(0, topK)
	);

	// Réponse LLM simulée
	const llmAnswer = $derived.by(() => {
		if (topResults.length === 0) return 'Aucun document accessible. Contacte ton officier de sécurité.';
		const lowestClassif = topResults
			.map((d) => d.classification)
			.sort((a, b) => LEVELS[b] - LEVELS[a])[0];
		const sources = topResults.map((d) => d.title.split(' — ')[0]).join(', ');
		const baseAnswer = topResults[0].content;
		return `[${lowestClassif}] ${baseAnswer}\n\nSources : ${sources}`;
	});
</script>

<figure class="rsd">
	<!-- ============== Sélecteur de requête ============== -->
	<div class="rsd-queries">
		<span class="rsd-label">Requête utilisateur</span>
		<div class="rsd-query-chips">
			{#each QUERIES as q, i (i)}
				<button
					type="button"
					class="rsd-query-chip {selectedQueryIdx === i ? 'is-active' : ''}"
					onclick={() => (selectedQueryIdx = i)}
				>
					<span aria-hidden="true">{q.emoji}</span>
					{q.text}
				</button>
			{/each}
		</div>
	</div>

	<!-- ============== Contrôles ============== -->
	<div class="rsd-controls">
		<div class="rsd-control">
			<label for="rsd-topk">Top-K</label>
			<input id="rsd-topk" type="range" min="1" max="6" step="1" bind:value={topK} />
			<span class="rsd-control-value">{topK}</span>
		</div>
		<div class="rsd-control">
			<label for="rsd-clearance">Habilitation user</label>
			<select id="rsd-clearance" bind:value={userClearance} class="rsd-select">
				<option value="NP">NP</option>
				<option value="DR">DR</option>
				<option value="CD">CD</option>
				<option value="SD">SD</option>
			</select>
		</div>
	</div>

	<!-- ============== Pipeline visualisé ============== -->
	<div class="rsd-pipeline">
		<!-- Étape 1 : Embedding de la query -->
		<div class="rsd-step">
			<div class="rsd-step-num">1</div>
			<div class="rsd-step-body">
				<div class="rsd-step-title">🧮 Embedding de la requête</div>
				<div class="rsd-vec">
					{#each query.embedding as v (v)}
						<div class="rsd-vec-cell" style="background: rgba(255, 157, 0, {v});" title={v.toFixed(2)}></div>
					{/each}
					<span class="rsd-vec-hint">…+ 758 dim</span>
				</div>
			</div>
		</div>

		<!-- Étape 2 : Recherche vectorielle Milvus -->
		<div class="rsd-step">
			<div class="rsd-step-num">2</div>
			<div class="rsd-step-body">
				<div class="rsd-step-title">🔍 Recherche dans Milvus + filtre habilitation</div>
				<div class="rsd-docs">
					{#each scoredDocs as doc, i (doc.id)}
						{@const isTopK = topResults.find((d) => d.id === doc.id) !== undefined}
						{@const filteredOut = !doc.allowed}
						<div class="rsd-doc {isTopK ? 'is-top' : ''} {filteredOut ? 'is-filtered' : ''}">
							<div class="rsd-doc-rank">#{i + 1}</div>
							<div class="rsd-doc-info">
								<div class="rsd-doc-title">
									{doc.title}
									<span class="rsd-classif rsd-classif-{doc.classification}">{doc.classification}</span>
								</div>
								<div class="rsd-doc-content">{doc.content.slice(0, 90)}…</div>
							</div>
							<div class="rsd-doc-score">
								<div class="rsd-score-bar">
									<div class="rsd-score-fill" style="width: {doc.score * 100}%;"></div>
								</div>
								<span class="rsd-score-num">{(doc.score * 100).toFixed(0)}%</span>
							</div>
							{#if filteredOut}
								<div class="rsd-doc-badge rsd-doc-badge-filter">
									✖ filtré (clearance)
								</div>
							{:else if isTopK}
								<div class="rsd-doc-badge rsd-doc-badge-top">
									✓ top-{topK}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Étape 3 : Construction du contexte -->
		<div class="rsd-step">
			<div class="rsd-step-num">3</div>
			<div class="rsd-step-body">
				<div class="rsd-step-title">📋 Contexte injecté dans le prompt</div>
				<pre class="rsd-context"><code>SYSTEM : tu es un assistant docs. Réponds en citant tes sources.

CONTEXTE :
{#each topResults as doc, i (doc.id)}─── doc {i + 1} ({doc.classification}) : {doc.title} ───
{doc.content}

{/each}
QUESTION : {query.text}</code></pre>
			</div>
		</div>

		<!-- Étape 4 : Réponse LLM -->
		<div class="rsd-step">
			<div class="rsd-step-num">4</div>
			<div class="rsd-step-body">
				<div class="rsd-step-title">🤖 Réponse du LLM</div>
				<div class="rsd-answer">{llmAnswer}</div>
			</div>
		</div>
	</div>

	<!-- ============== Conseils ============== -->
	<div class="rsd-tips">
		<strong>💡 À tester :</strong>
		<ul>
			<li>Tape la 2ᵉ requête (Léonidas) et change ton habilitation à NP — le doc Léonidas (CD) est filtré.</li>
			<li>Passe à habilitation SD — le doc Persée (SD) apparaît.</li>
			<li>Bouge le slider top-K à 1 — seul le mieux classé est retenu.</li>
		</ul>
	</div>
</figure>

<style>
	.rsd {
		display: flex; flex-direction: column; gap: 1rem;
		background: #0f172a; border-radius: 1rem; padding: 1.25rem;
		font-feature-settings: 'tnum';
	}
	.rsd-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: #94a3b8;
	}
	.rsd-queries { display: flex; flex-direction: column; gap: 0.5rem; }
	.rsd-query-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.rsd-query-chip {
		padding: 0.5rem 0.85rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 999px; color: #cbd5e1; font-size: 0.85rem; cursor: pointer;
		text-align: left;
	}
	.rsd-query-chip.is-active {
		background: var(--color-hf-amber); border-color: var(--color-hf-amber);
		color: #1e293b; font-weight: 600;
	}
	.rsd-controls {
		display: flex; gap: 1.5rem; flex-wrap: wrap;
		padding: 0.85rem 1rem; background: #1e293b; border-radius: 0.6rem;
	}
	.rsd-control { display: flex; align-items: center; gap: 0.6rem; }
	.rsd-control label {
		font-family: var(--font-mono); font-size: 0.75rem; color: #94a3b8;
		text-transform: uppercase; letter-spacing: 0.05em;
	}
	.rsd-control input[type="range"] { width: 140px; accent-color: var(--color-hf-amber); }
	.rsd-control-value {
		background: var(--color-hf-yellow); padding: 0.2rem 0.6rem;
		border-radius: 0.3rem; font-family: var(--font-mono); font-size: 0.85rem;
		font-weight: 600; color: #1e293b;
	}
	.rsd-select {
		padding: 0.4rem 0.7rem; background: #0f172a; border: 1px solid #334155;
		border-radius: 0.4rem; color: #e2e8f0; font-family: var(--font-mono); font-size: 0.85rem;
	}

	.rsd-pipeline { display: flex; flex-direction: column; gap: 0.75rem; }
	.rsd-step {
		display: grid; grid-template-columns: 36px 1fr; gap: 0.75rem;
		padding: 0.85rem; background: #1e293b; border-radius: 0.6rem;
	}
	.rsd-step-num {
		width: 36px; height: 36px;
		font-family: var(--font-display); font-size: 1.1rem; font-weight: 700;
		background: var(--color-hf-amber); color: #1e293b;
		border-radius: 0.4rem;
		display: flex; align-items: center; justify-content: center;
	}
	.rsd-step-body { display: flex; flex-direction: column; gap: 0.5rem; }
	.rsd-step-title {
		font-family: var(--font-display); font-weight: 600; color: #e2e8f0; font-size: 0.95rem;
	}

	.rsd-vec { display: flex; gap: 2px; align-items: center; }
	.rsd-vec-cell {
		flex: 1; height: 30px; min-width: 14px; border-radius: 3px;
	}
	.rsd-vec-hint {
		margin-left: 0.5rem; font-family: var(--font-mono); font-size: 0.7rem; color: #94a3b8;
	}

	.rsd-docs { display: flex; flex-direction: column; gap: 0.4rem; }
	.rsd-doc {
		display: grid; grid-template-columns: 36px 1fr 140px auto; gap: 0.6rem;
		padding: 0.5rem 0.7rem; background: #0f172a; border-radius: 0.4rem;
		border-left: 3px solid #334155; align-items: center;
		transition: all 0.2s;
	}
	.rsd-doc.is-top {
		border-left-color: var(--color-hf-amber);
		background: #1e1810;
	}
	.rsd-doc.is-filtered {
		opacity: 0.4;
	}
	.rsd-doc-rank {
		font-family: var(--font-mono); font-size: 0.75rem; color: #94a3b8; text-align: center;
	}
	.rsd-doc-title {
		font-family: var(--font-display); font-size: 0.85rem; color: #e2e8f0; font-weight: 600;
	}
	.rsd-doc-content {
		font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;
	}
	.rsd-classif {
		display: inline-block; font-family: var(--font-mono); font-size: 0.62rem; font-weight: 700;
		padding: 0.05rem 0.4rem; border-radius: 0.2rem; margin-left: 0.4rem;
	}
	.rsd-classif-NP { background: #16a34a; color: #fff; }
	.rsd-classif-DR { background: #2563eb; color: #fff; }
	.rsd-classif-CD { background: #f59e0b; color: #1e293b; }
	.rsd-classif-SD { background: #dc2626; color: #fff; }

	.rsd-doc-score { display: flex; align-items: center; gap: 0.4rem; }
	.rsd-score-bar {
		width: 80px; height: 14px; background: #1e293b; border-radius: 0.2rem; overflow: hidden;
	}
	.rsd-score-fill {
		height: 100%; background: linear-gradient(90deg, #06b6d4 0%, #22c55e 100%);
		transition: width 0.3s;
	}
	.rsd-score-num {
		font-family: var(--font-mono); font-size: 0.72rem; color: #cbd5e1; min-width: 36px;
	}
	.rsd-doc-badge {
		font-family: var(--font-mono); font-size: 0.65rem; padding: 0.15rem 0.45rem;
		border-radius: 0.2rem; white-space: nowrap;
	}
	.rsd-doc-badge-top { background: var(--color-hf-amber); color: #1e293b; font-weight: 700; }
	.rsd-doc-badge-filter { background: #7f1d1d; color: #fecaca; }

	.rsd-context {
		margin: 0; padding: 0.7rem 0.85rem; background: #0f172a; border: 1px solid #334155;
		border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.7rem;
		line-height: 1.55; color: #cbd5e1;
		white-space: pre-wrap; word-break: break-word;
		max-height: 200px; overflow-y: auto;
	}
	.rsd-answer {
		padding: 0.85rem 1rem; background: #1e1810;
		border-left: 3px solid #f59e0b; border-radius: 0.4rem;
		font-size: 0.88rem; color: #fef3c7; line-height: 1.6; white-space: pre-line;
	}

	.rsd-tips {
		padding: 0.85rem 1rem; background: #1e293b;
		border: 1px dashed #475569; border-radius: 0.5rem; font-size: 0.85rem; color: #cbd5e1;
		line-height: 1.55;
	}
	.rsd-tips strong { color: var(--color-hf-yellow); }
	.rsd-tips ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
	.rsd-tips li { margin: 0.2rem 0; }

	@media (max-width: 720px) {
		.rsd-doc { grid-template-columns: 30px 1fr; row-gap: 0.3rem; }
		.rsd-doc-score, .rsd-doc-badge { grid-column: 2; }
	}
</style>
