<!--
	GraphRAGSimulator.svelte
	========================
	Simulateur step-by-step animé du pipeline GraphRAG complet.

	6 phases que l'utilisateur parcourt avec Précédent / Suivant / Auto :
	  0. Texte source (corpus)
	  1. Extraction LLM — les entités apparaissent une par une
	  2. Relations — les arêtes se dessinent entre entités
	  3. Leiden — les entités se regroupent en communautés colorées
	  4. Résumés — chaque communauté révèle son résumé au clic
	  5. Map-Reduce query — animation des partial responses puis reduce

	Tout est animé via transitions CSS sur transform/opacity.
-->
<script lang="ts">
	type Phase = 0 | 1 | 2 | 3 | 4 | 5;
	let phase = $state<Phase>(0);
	let level = $state(1); // niveau de communauté (0, 1, 2)
	let selectedCommunity = $state<number | null>(null);
	let queryStep = $state(0); // 0=start, 1-4=map partials, 5=reduce done

	// =================== DATA ===================

	interface Entity {
		id: string;
		name: string;
		type: 'company' | 'program' | 'unit' | 'tech' | 'person' | 'location';
		// Membership à chaque niveau hiérarchique
		c0: number;
		c1: number;
		c2: number;
	}

	const ENTITIES: Entity[] = [
		{ id: 'arist', name: 'Aristote-Défense', type: 'company', c0: 0, c1: 0, c2: 0 },
		{ id: 'dga', name: 'DGA-MI', type: 'unit', c0: 0, c1: 0, c2: 1 },
		{ id: 'paris', name: 'Site Paris', type: 'location', c0: 0, c1: 0, c2: 0 },
		{ id: 'toulou', name: 'Site Toulouse', type: 'location', c0: 0, c1: 1, c2: 3 },
		{ id: 'pers', name: 'Programme Persée', type: 'program', c0: 0, c1: 1, c2: 2 },
		{ id: 'apol', name: 'Programme Apollon', type: 'program', c0: 0, c1: 1, c2: 2 },
		{ id: 'leon', name: 'Programme Léonidas', type: 'program', c0: 0, c1: 1, c2: 3 },
		{ id: 'capx', name: 'Cap. Martin', type: 'person', c0: 0, c1: 1, c2: 3 },
		{ id: 'colb', name: 'Col. Bernard', type: 'person', c0: 0, c1: 1, c2: 3 },
		{ id: 'mistral', name: 'Mistral 7B', type: 'tech', c0: 0, c1: 2, c2: 4 },
		{ id: 'milvus', name: 'Milvus Index', type: 'tech', c0: 0, c1: 2, c2: 4 },
		{ id: 'ollama', name: 'Ollama Serveur', type: 'tech', c0: 0, c1: 2, c2: 4 },
		{ id: 'reach', name: 'REACH', type: 'program', c0: 0, c1: 3, c2: 5 },
		{ id: 'anssi', name: 'Référentiel ANSSI', type: 'program', c0: 0, c1: 3, c2: 5 }
	];

	const EDGES: { from: string; to: string; label: string }[] = [
		{ from: 'arist', to: 'dga', label: 'travaille avec' },
		{ from: 'arist', to: 'paris', label: 'siège à' },
		{ from: 'dga', to: 'pers', label: 'pilote' },
		{ from: 'dga', to: 'apol', label: 'pilote' },
		{ from: 'dga', to: 'leon', label: 'pilote' },
		{ from: 'pers', to: 'apol', label: 'lié à' },
		{ from: 'leon', to: 'toulou', label: 'développé à' },
		{ from: 'leon', to: 'capx', label: 'piloté par' },
		{ from: 'colb', to: 'capx', label: 'supervise' },
		{ from: 'arist', to: 'mistral', label: 'fine-tune' },
		{ from: 'mistral', to: 'milvus', label: 'utilise' },
		{ from: 'mistral', to: 'ollama', label: 'servi par' },
		{ from: 'arist', to: 'reach', label: 'conforme à' },
		{ from: 'arist', to: 'anssi', label: 'conforme à' }
	];

	// Couleurs des communautés
	const COMM_COLORS = ['#a855f7', '#06b6d4', '#22c55e', '#fb923c', '#facc15', '#ec4899'];

	// =================== LAYOUT ===================
	// Positions PAR niveau de communauté. Au niveau 0 (racine, 1 commu),
	// tout est en un grand cercle. Au niveau 1, 4 quadrants. Au niveau 2,
	// 6 zones distinctes.

	const W = 640;
	const H = 380;

	// Position « graphe sans communautés » (utilisé phases 1-2)
	const GRAPH_LAYOUT: Record<string, { x: number; y: number }> = {
		arist: { x: 330, y: 70 },
		dga: { x: 180, y: 150 },
		paris: { x: 270, y: 50 },
		toulou: { x: 330, y: 200 },
		pers: { x: 100, y: 250 },
		apol: { x: 90, y: 330 },
		leon: { x: 210, y: 290 },
		capx: { x: 420, y: 310 },
		colb: { x: 340, y: 340 },
		mistral: { x: 500, y: 140 },
		milvus: { x: 580, y: 220 },
		ollama: { x: 540, y: 310 },
		reach: { x: 430, y: 50 },
		anssi: { x: 490, y: 60 }
	};

	// Centres de chaque communauté pour chaque niveau
	const COMM_CENTERS_L1 = [
		{ x: 180, y: 130 }, // C0 — Org (Aristote, DGA, sites Paris)
		{ x: 230, y: 290 }, // C1 — Programmes + personnel
		{ x: 540, y: 150 }, // C2 — Stack IA
		{ x: 540, y: 310 } // C3 — Conformité
	];

	const COMM_CENTERS_L2 = [
		{ x: 130, y: 110 }, // C0 — Aristote + sites
		{ x: 280, y: 110 }, // C1 — DGA-MI
		{ x: 130, y: 300 }, // C2 — Persée + Apollon
		{ x: 320, y: 310 }, // C3 — Léonidas + personnel + Toulouse
		{ x: 530, y: 140 }, // C4 — Stack IA
		{ x: 530, y: 310 } // C5 — Conformité
	];

	function getCommunity(e: Entity, lvl: number): number {
		if (lvl === 0) return e.c0;
		if (lvl === 1) return e.c1;
		return e.c2;
	}

	function commColor(commId: number): string {
		return COMM_COLORS[commId % COMM_COLORS.length];
	}

	// Calcule la position d'une entité selon la phase et le niveau
	function entityPos(e: Entity): { x: number; y: number } {
		if (phase <= 2) {
			// Phase 1-2 : layout libre du graphe
			return GRAPH_LAYOUT[e.id];
		}
		// Phase 3+ : regroupé par communauté du niveau courant
		const lvl = level;
		const comm = getCommunity(e, lvl);
		let center: { x: number; y: number };
		if (lvl === 0) center = { x: W / 2, y: H / 2 };
		else if (lvl === 1) center = COMM_CENTERS_L1[comm];
		else center = COMM_CENTERS_L2[comm];
		// Offset déterministe par entité (pour ne pas que toutes se superposent)
		const idHash = e.id.charCodeAt(0) + e.id.charCodeAt(1);
		const angle = ((idHash * 137) % 360) * (Math.PI / 180);
		const radius = lvl === 0 ? 130 : lvl === 1 ? 55 : 38;
		return {
			x: center.x + radius * Math.cos(angle),
			y: center.y + radius * Math.sin(angle)
		};
	}

	function getEntity(id: string): Entity {
		return ENTITIES.find((e) => e.id === id)!;
	}

	// =================== EXTRACTION ANIMATION ===================
	// En phase 1, on révèle les entités progressivement
	let revealedCount = $state(0);
	let extractInterval: ReturnType<typeof setInterval> | null = null;

	function startExtraction() {
		if (extractInterval) clearInterval(extractInterval);
		revealedCount = 0;
		extractInterval = setInterval(() => {
			if (revealedCount < ENTITIES.length) {
				revealedCount++;
			} else {
				if (extractInterval) clearInterval(extractInterval);
				extractInterval = null;
			}
		}, 300);
	}

	function isRevealed(idx: number): boolean {
		if (phase === 0) return false;
		if (phase === 1) return idx < revealedCount;
		return true; // phases 2+ : toutes visibles
	}

	// =================== EDGES ANIMATION ===================
	let edgesRevealed = $state(0);
	let edgeInterval: ReturnType<typeof setInterval> | null = null;

	function startEdgesAnim() {
		if (edgeInterval) clearInterval(edgeInterval);
		edgesRevealed = 0;
		edgeInterval = setInterval(() => {
			if (edgesRevealed < EDGES.length) {
				edgesRevealed++;
			} else {
				if (edgeInterval) clearInterval(edgeInterval);
				edgeInterval = null;
			}
		}, 200);
	}

	function isEdgeVisible(idx: number): boolean {
		if (phase < 2) return false;
		if (phase === 2) return idx < edgesRevealed;
		return true;
	}

	// =================== SUMMARIES ===================
	const SUMMARIES: Record<number, Record<number, { title: string; text: string; entities: string[] }>> = {
		1: {
			0: {
				title: 'Organisation & sites',
				text: "Cette communauté regroupe l'entreprise Aristote-Défense, son partenaire institutionnel DGA-MI, et les sites associés (Paris siège, Toulouse R&D). C'est le cœur organisationnel.",
				entities: ['Aristote-Défense', 'DGA-MI', 'Site Paris']
			},
			1: {
				title: 'Programmes opérationnels & personnel',
				text: 'Communauté centrée sur les programmes militaires Persée, Apollon, Léonidas pilotés par DGA-MI. Inclut le personnel impliqué (Cap. Martin, Col. Bernard) et le site de Toulouse où se concentre l\'effort Léonidas.',
				entities: ['Programme Persée', 'Programme Apollon', 'Programme Léonidas', 'Cap. Martin', 'Col. Bernard', 'Site Toulouse']
			},
			2: {
				title: 'Stack IA technique',
				text: 'L\'ensemble de la stack technique d\'IA générative : Mistral 7B fine-tuné, indexé par Milvus, servi par Ollama. C\'est le tooling moderne adopté.',
				entities: ['Mistral 7B', 'Milvus Index', 'Ollama Serveur']
			},
			3: {
				title: 'Conformité réglementaire',
				text: 'Référentiels et conformités auxquels Aristote-Défense est tenu : REACH pour les substances chimiques, ANSSI pour la cybersécurité.',
				entities: ['REACH', 'Référentiel ANSSI']
			}
		},
		2: {
			0: { title: 'Aristote + sites', text: 'Aristote-Défense et son siège parisien.', entities: ['Aristote-Défense', 'Site Paris'] },
			1: { title: 'DGA-MI (institutionnel)', text: 'L\'interlocuteur institutionnel principal.', entities: ['DGA-MI'] },
			2: { title: 'Programmes Persée/Apollon', text: 'Les deux programmes étroitement liés.', entities: ['Programme Persée', 'Programme Apollon'] },
			3: { title: 'Léonidas + équipe', text: 'Léonidas, le personnel qui le pilote, et son site Toulouse. Une cellule dense.', entities: ['Programme Léonidas', 'Cap. Martin', 'Col. Bernard', 'Site Toulouse'] },
			4: { title: 'Stack IA', text: 'Mistral, Milvus, Ollama.', entities: ['Mistral 7B', 'Milvus Index', 'Ollama Serveur'] },
			5: { title: 'Conformité', text: 'REACH + ANSSI.', entities: ['REACH', 'Référentiel ANSSI'] }
		}
	};

	function getSummariesForLevel(lvl: number) {
		return SUMMARIES[lvl] ?? {};
	}

	const summariesEntries = $derived(Object.entries(getSummariesForLevel(level)));

	// =================== QUERY MAP-REDUCE ===================
	const QUERY = "Quels sont les principaux thèmes opérationnels et leurs interdépendances dans cet écosystème ?";

	const PARTIAL_RESPONSES: Record<number, string> = {
		0: "L'organisation s'articule autour d'Aristote-Défense, prestataire de DGA-MI, avec un siège à Paris.",
		1: "Trois programmes opérationnels (Persée, Apollon, Léonidas) pilotés par DGA-MI. Léonidas concentre les ressources à Toulouse, avec Cap. Martin et Col. Bernard.",
		2: "Stack IA standardisée : Mistral 7B fine-tuné, indexé par Milvus, servi par Ollama. Choix open-source cohérent.",
		3: "L'entreprise respecte deux référentiels distincts : REACH (chimie) et ANSSI (cyber)."
	};

	const FINAL_RESPONSE = "L'écosystème s'organise autour de 4 axes interdépendants : (1) Organisation — Aristote-Défense agit pour DGA-MI depuis Paris ; (2) Programmes — 3 programmes (Persée, Apollon, Léonidas) avec Léonidas comme effort prioritaire à Toulouse, doté d'une équipe dédiée (Martin/Bernard) ; (3) Stack IA — adoption homogène de Mistral 7B, Milvus, Ollama ; (4) Conformité — double exigence REACH + ANSSI. Le lien principal : Aristote-Défense, qui irradie toutes les communautés.";

	let queryAutoInterval: ReturnType<typeof setInterval> | null = null;

	function startQueryAnimation() {
		if (queryAutoInterval) clearInterval(queryAutoInterval);
		queryStep = 0;
		queryAutoInterval = setInterval(() => {
			if (queryStep < 5) {
				queryStep++;
			} else {
				if (queryAutoInterval) clearInterval(queryAutoInterval);
				queryAutoInterval = null;
			}
		}, 900);
	}

	// =================== NAV ===================

	function nextPhase() {
		if (phase < 5) {
			phase = (phase + 1) as Phase;
			// Animations spécifiques par phase
			if (phase === 1) startExtraction();
			else if (phase === 2) startEdgesAnim();
			else if (phase === 5) startQueryAnimation();
		}
	}

	function prevPhase() {
		if (phase > 0) {
			phase = (phase - 1) as Phase;
			// reset les animations
			if (extractInterval) clearInterval(extractInterval);
			if (edgeInterval) clearInterval(edgeInterval);
			if (queryAutoInterval) clearInterval(queryAutoInterval);
			if (phase === 0) revealedCount = 0;
			if (phase < 2) edgesRevealed = 0;
			if (phase < 5) queryStep = 0;
		}
	}

	function reset() {
		if (extractInterval) clearInterval(extractInterval);
		if (edgeInterval) clearInterval(edgeInterval);
		if (queryAutoInterval) clearInterval(queryAutoInterval);
		phase = 0;
		revealedCount = 0;
		edgesRevealed = 0;
		queryStep = 0;
		selectedCommunity = null;
	}

	// Communauté active pendant l'animation map-reduce
	const activeMapCommunity = $derived(queryStep >= 1 && queryStep <= 4 ? queryStep - 1 : null);

	// =================== PHASE CAPTIONS ===================
	const PHASE_INFOS: Record<Phase, { title: string; emoji: string; description: string }> = {
		0: { emoji: '📜', title: 'Phase 0 — Le corpus source', description: 'Tu pars d\'un corpus de textes. Ici on a 4 documents fictifs sur l\'écosystème défense. À ce stade, aucune structure n\'est extraite. Clique « Démarrer extraction » pour lancer la phase 1.' },
		1: { emoji: '🔍', title: 'Phase 1 — Extraction par LLM', description: 'Le LLM lit chaque document et identifie les entités (entreprises, programmes, personnes, sites, technologies). Chaque entité apparaît dès qu\'elle est détectée. 14 entités extraites au total.' },
		2: { emoji: '🔗', title: 'Phase 2 — Construction du graphe', description: 'Pour chaque paire d\'entités co-occurrantes, le LLM identifie la relation qui les lie. Les arêtes se dessinent progressivement. On obtient un knowledge graph complet.' },
		3: { emoji: '🌿', title: 'Phase 3 — Leiden détecte les communautés', description: 'L\'algorithme Leiden analyse la densité des connexions et regroupe les nœuds en communautés. Bouge le slider de niveau pour voir la hiérarchie : niveau 0 = racine (1 commu), niveau 1 = 4 grandes thématiques, niveau 2 = 6 sous-communautés.' },
		4: { emoji: '📝', title: 'Phase 4 — Résumés de communautés', description: 'Pour chaque communauté à chaque niveau, le LLM génère un résumé structuré. Clique sur un nœud d\'une communauté ci-dessous pour révéler son résumé.' },
		5: { emoji: '🔀', title: 'Phase 5 — Map-Reduce query', description: 'Question globale ! Le système interroge chaque communauté en parallèle (Map), récupère leurs réponses partielles, puis les synthétise en une réponse finale (Reduce). Regarde le processus se dérouler.' }
	};
	const currentInfo = $derived(PHASE_INFOS[phase]);
</script>

<figure class="gs">
	<!-- Header -->
	<header class="gs-header">
		<div class="gs-phase-info">
			<span class="gs-phase-emoji">{currentInfo.emoji}</span>
			<div>
				<div class="gs-phase-title">{currentInfo.title}</div>
				<div class="gs-phase-desc">{currentInfo.description}</div>
			</div>
		</div>
	</header>

	<!-- Visualization principale -->
	<div class="gs-viz">
		<svg viewBox="0 0 {W} {H}" class="gs-svg">
			<defs>
				<marker id="gs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
					<path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
				</marker>
				<marker id="gs-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
					<path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15" />
				</marker>
			</defs>

			<!-- Phase 0 : Documents source -->
			{#if phase === 0}
				<g class="gs-docs">
					{#each [0, 1, 2, 3] as i (i)}
						<rect x={80 + i * 130} y={H / 2 - 70} width="100" height="140" rx="6" fill="#1e293b" stroke="#475569" stroke-width="2" />
						<text x={130 + i * 130} y={H / 2 - 50} text-anchor="middle" font-family="monospace" font-size="11" fill="#cbd5e1">Doc {i + 1}</text>
						{#each [0, 1, 2, 3, 4] as line (line)}
							<line x1={92 + i * 130} y1={H / 2 - 30 + line * 14} x2={168 + i * 130} y2={H / 2 - 30 + line * 14} stroke="#475569" stroke-width="1" opacity="0.6" />
						{/each}
					{/each}
				</g>
				<text x={W / 2} y={H - 30} text-anchor="middle" font-family="monospace" font-size="11" fill="#94a3b8">4 documents · ~20k tokens au total</text>
			{/if}

			<!-- Phases 1+ : entités + arêtes -->
			{#if phase >= 1}
				<!-- Arêtes -->
				{#each EDGES as edge, i (`${edge.from}-${edge.to}`)}
					{@const from = entityPos(getEntity(edge.from))}
					{@const to = entityPos(getEntity(edge.to))}
					{@const visible = isEdgeVisible(i)}
					<line
						x1={from.x}
						y1={from.y}
						x2={to.x}
						y2={to.y}
						stroke="#475569"
						stroke-width="1.5"
						opacity={visible ? (phase === 5 ? 0.25 : 0.6) : 0}
						class="gs-edge"
						marker-end="url(#gs-arrow)"
					/>
				{/each}

				<!-- Nœuds -->
				{#each ENTITIES as e, i (e.id)}
					{@const pos = entityPos(e)}
					{@const revealed = isRevealed(i)}
					{@const lvl = level}
					{@const commId = getCommunity(e, lvl)}
					{@const colored = phase >= 3}
					{@const color = colored ? commColor(commId) : '#06b6d4'}
					{@const dimmed = phase === 5 && activeMapCommunity !== null && commId !== activeMapCommunity}
					<g
						class="gs-node"
						transform="translate({pos.x}, {pos.y})"
						style="opacity: {revealed ? (dimmed ? 0.25 : 1) : 0};"
					>
						<circle r="18" fill={color} fill-opacity="0.2" stroke={color} stroke-width="2" />
						<text x="0" y="-23" text-anchor="middle" font-family="monospace" font-size="9" fill="#cbd5e1">{e.name}</text>
						<text x="0" y="4" text-anchor="middle" font-family="monospace" font-size="7" fill={color} font-weight="700">{e.type}</text>
					</g>
				{/each}
			{/if}

			<!-- Phase 4 : labels des communautés -->
			{#if phase >= 3}
				{@const centers = level === 1 ? COMM_CENTERS_L1 : level === 2 ? COMM_CENTERS_L2 : [{ x: W / 2, y: H / 2 }]}
				{#each centers as c, i (i)}
					{@const summary = getSummariesForLevel(level)[i]}
					{#if summary}
						<text
							x={c.x}
							y={c.y - 75}
							text-anchor="middle"
							font-family="monospace"
							font-size="10"
							font-weight="700"
							fill={commColor(i)}
							class="gs-comm-label"
						>
							C{i} — {summary.title}
						</text>
					{/if}
				{/each}
			{/if}

			<!-- Phase 5 : animation des partial responses -->
			{#if phase === 5 && queryStep >= 1}
				{@const centers = level === 1 ? COMM_CENTERS_L1 : COMM_CENTERS_L2}
				{#each centers.slice(0, level === 1 ? 4 : 6) as c, i (i)}
					{#if queryStep >= i + 1 && i < 4}
						<g class="gs-partial">
							<circle cx={c.x} cy={c.y} r="32" fill="none" stroke={commColor(i)} stroke-width="2" stroke-dasharray="4 3">
								<animate attributeName="r" values="28;36;28" dur="1.4s" repeatCount="indefinite" />
							</circle>
							<text x={c.x} y={c.y - 90} text-anchor="middle" font-family="monospace" font-size="10" fill={commColor(i)} font-weight="700">✓ partial {i}</text>
						</g>
					{/if}
				{/each}
			{/if}
		</svg>
	</div>

	<!-- Phase-specific content panel -->
	{#if phase === 0}
		<div class="gs-panel">
			<div class="gs-panel-head">📄 Échantillon du corpus</div>
			<div class="gs-text">
				« <em>Aristote-Défense travaille avec la DGA-MI depuis son siège parisien. Le programme Léonidas, développé à Toulouse, est piloté par le Capitaine Martin sous la supervision du Colonel Bernard. La société utilise Mistral 7B fine-tuné, indexé via Milvus, et servi par Ollama. Aristote-Défense est conforme aux référentiels REACH et ANSSI…</em> »
			</div>
		</div>
	{:else if phase === 4}
		<div class="gs-panel">
			<div class="gs-panel-head">📝 Résumés au niveau {level} — clique sur un onglet</div>
			<div class="gs-summary-tabs">
				{#each summariesEntries as [id, _] (id)}
					{@const commId = parseInt(id)}
					<button
						type="button"
						class="gs-summary-tab {selectedCommunity === commId ? 'is-active' : ''}"
						style="--c-color: {commColor(commId)};"
						onclick={() => (selectedCommunity = commId)}
					>
						C{commId}
					</button>
				{/each}
			</div>
			{#if selectedCommunity !== null && getSummariesForLevel(level)[selectedCommunity]}
				{@const s = getSummariesForLevel(level)[selectedCommunity]}
				<div class="gs-summary-content" style="border-left-color: {commColor(selectedCommunity)};">
					<div class="gs-summary-title" style="color: {commColor(selectedCommunity)};">📌 {s.title}</div>
					<div class="gs-summary-text">{s.text}</div>
					<div class="gs-summary-entities">
						<strong>Entités-clés :</strong>
						{#each s.entities as ent (ent)}
							<span class="gs-summary-pill">{ent}</span>
						{/each}
					</div>
				</div>
			{:else}
				<div class="gs-summary-hint">👆 Clique un onglet C0, C1, C2… pour voir le résumé généré par le LLM pour cette communauté.</div>
			{/if}
		</div>
	{:else if phase === 5}
		<div class="gs-panel">
			<div class="gs-panel-head">🔀 Map-Reduce en action</div>
			<div class="gs-query-box">
				<strong>❓ Question :</strong> {QUERY}
			</div>

			<div class="gs-map-grid">
				{#each Object.entries(PARTIAL_RESPONSES) as [id, response] (id)}
					{@const commId = parseInt(id)}
					{@const isActive = queryStep >= commId + 1}
					<div class="gs-map-card" class:is-active={isActive} style="--c-color: {commColor(commId)};">
						<div class="gs-map-head">
							<span class="gs-map-dot" style="background: {commColor(commId)};"></span>
							<strong>C{commId} → partial response</strong>
							{#if isActive}<span class="gs-map-check">✓</span>{/if}
						</div>
						<div class="gs-map-text">
							{#if isActive}
								{response}
							{:else}
								<em>en attente…</em>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			{#if queryStep >= 5}
				<div class="gs-reduce">
					<div class="gs-reduce-head">🧮 Reduce — synthèse finale</div>
					<div class="gs-reduce-text">{FINAL_RESPONSE}</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Slider niveau (visible en phase 3+) -->
	{#if phase >= 3 && phase < 5}
		<div class="gs-level-controls">
			<label class="gs-level-label">
				Niveau de communauté :
				<input
					type="range"
					min="0"
					max="2"
					bind:value={level}
					class="gs-level-slider"
				/>
				<span class="gs-level-val">
					{level === 0 ? 'Niveau 0 — racine (1 commu)' : level === 1 ? 'Niveau 1 — mid (4 commus)' : 'Niveau 2 — fine (6 commus)'}
				</span>
			</label>
		</div>
	{/if}

	<!-- Navigation phases -->
	<div class="gs-nav">
		<div class="gs-progress">
			{#each [0, 1, 2, 3, 4, 5] as p (p)}
				<button
					type="button"
					class="gs-dot {phase === p ? 'is-active' : ''} {phase > p ? 'is-done' : ''}"
					onclick={() => {
						phase = p as Phase;
						if (p === 1) startExtraction();
						else if (p === 2) startEdgesAnim();
						else if (p === 5) startQueryAnimation();
					}}
					aria-label="Phase {p}"
				></button>
			{/each}
		</div>
		<div class="gs-nav-buttons">
			<button type="button" class="gs-btn" onclick={prevPhase} disabled={phase === 0}>◀ Précédent</button>
			<button type="button" class="gs-btn" onclick={reset}>↻ Reset</button>
			<button type="button" class="gs-btn gs-btn-next" onclick={nextPhase} disabled={phase === 5}>
				{phase === 0 ? '▶ Démarrer extraction' : 'Suivant ▶'}
			</button>
		</div>
	</div>
</figure>

<style>
	.gs {
		background: #0f172a;
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.gs-header { padding: 0.85rem 1rem; background: #1e293b; border-radius: 0.6rem; border-left: 3px solid #a855f7; }
	.gs-phase-info { display: flex; gap: 0.9rem; align-items: flex-start; }
	.gs-phase-emoji { font-size: 2rem; flex-shrink: 0; }
	.gs-phase-title { font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; color: #facc15; }
	.gs-phase-desc { font-size: 0.88rem; color: #cbd5e1; line-height: 1.55; margin-top: 0.25rem; }

	.gs-viz { background: #1e293b; border-radius: 0.75rem; padding: 0.5rem; }
	.gs-svg { width: 100%; height: auto; max-height: 460px; display: block; }

	.gs-node {
		transition: opacity 0.4s ease, transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.gs-edge { transition: opacity 0.3s; }

	.gs-panel {
		background: #1e293b;
		border-radius: 0.6rem;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.gs-panel-head {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #facc15;
		font-weight: 600;
	}
	.gs-text {
		font-size: 0.88rem;
		color: #cbd5e1;
		line-height: 1.6;
		padding: 0.7rem 0.9rem;
		background: #0f172a;
		border-radius: 0.4rem;
		border-left: 3px solid #06b6d4;
	}

	.gs-summary-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.gs-summary-tab {
		padding: 0.4rem 0.85rem;
		background: #0f172a;
		border: 2px solid var(--c-color, #475569);
		border-radius: 0.4rem;
		color: var(--c-color, #cbd5e1);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}
	.gs-summary-tab.is-active { background: var(--c-color, #06b6d4); color: #0f172a; }
	.gs-summary-content {
		background: #0f172a;
		border-left: 4px solid;
		border-radius: 0.4rem;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.gs-summary-title { font-family: var(--font-display); font-weight: 700; font-size: 0.95rem; }
	.gs-summary-text { font-size: 0.88rem; color: #cbd5e1; line-height: 1.55; }
	.gs-summary-entities { font-size: 0.82rem; color: #94a3b8; }
	.gs-summary-pill {
		display: inline-block;
		background: #1e293b;
		padding: 0.15rem 0.5rem;
		border-radius: 0.25rem;
		margin: 0.15rem 0.2rem 0 0;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: #cbd5e1;
	}
	.gs-summary-hint { padding: 0.7rem 0.9rem; background: #0f172a; border-radius: 0.4rem; font-style: italic; color: #94a3b8; font-size: 0.86rem; }

	.gs-query-box {
		padding: 0.7rem 0.9rem;
		background: #0f172a;
		border-left: 3px solid #facc15;
		border-radius: 0.4rem;
		font-size: 0.88rem;
		color: #cbd5e1;
	}
	.gs-map-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	@media (max-width: 600px) { .gs-map-grid { grid-template-columns: 1fr; } }
	.gs-map-card {
		padding: 0.6rem 0.8rem;
		background: #0f172a;
		border: 1px solid #334155;
		border-left: 3px solid #334155;
		border-radius: 0.4rem;
		opacity: 0.5;
		transition: all 0.4s;
	}
	.gs-map-card.is-active {
		opacity: 1;
		border-left-color: var(--c-color);
		border-color: var(--c-color);
	}
	.gs-map-head { display: flex; gap: 0.4rem; align-items: center; font-size: 0.78rem; color: #cbd5e1; margin-bottom: 0.3rem; font-family: var(--font-mono); }
	.gs-map-dot { width: 10px; height: 10px; border-radius: 50%; }
	.gs-map-check { margin-left: auto; color: #22c55e; font-weight: 700; }
	.gs-map-text { font-size: 0.82rem; color: #cbd5e1; line-height: 1.5; }

	.gs-reduce {
		padding: 0.85rem 1rem;
		background: #1e1810;
		border: 1px solid #f59e0b;
		border-left: 4px solid #f59e0b;
		border-radius: 0.5rem;
		margin-top: 0.5rem;
	}
	.gs-reduce-head { font-family: var(--font-display); font-weight: 700; color: #facc15; margin-bottom: 0.4rem; }
	.gs-reduce-text { font-size: 0.88rem; color: #fef3c7; line-height: 1.6; }

	.gs-level-controls { padding: 0.6rem 0.85rem; background: #1e293b; border-radius: 0.5rem; }
	.gs-level-label { display: flex; gap: 0.6rem; align-items: center; color: #cbd5e1; font-family: var(--font-mono); font-size: 0.78rem; flex-wrap: wrap; }
	.gs-level-slider { flex: 1; min-width: 180px; accent-color: #a855f7; }
	.gs-level-val { background: #a855f7; color: #fff; padding: 0.2rem 0.6rem; border-radius: 0.3rem; font-weight: 700; }

	.gs-nav { display: flex; flex-direction: column; gap: 0.6rem; }
	.gs-progress { display: flex; gap: 0.4rem; justify-content: center; }
	.gs-dot {
		width: 14px; height: 14px; border-radius: 50%;
		background: #334155; border: 2px solid transparent;
		cursor: pointer; transition: all 0.2s; padding: 0;
	}
	.gs-dot:hover { background: #475569; }
	.gs-dot.is-done { background: #a855f7; }
	.gs-dot.is-active { background: #facc15; border-color: #facc15; transform: scale(1.3); }

	.gs-nav-buttons { display: flex; gap: 0.4rem; justify-content: center; flex-wrap: wrap; }
	.gs-btn { padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #475569; border-radius: 999px; color: #cbd5e1; font-family: var(--font-mono); font-size: 0.82rem; cursor: pointer; }
	.gs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.gs-btn-next { background: #a855f7; border-color: #a855f7; color: #fff; font-weight: 600; }

	.gs-comm-label { transition: opacity 0.3s; }
</style>
