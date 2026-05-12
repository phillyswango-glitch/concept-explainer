<!--
	/graphrag — Lab GraphRAG (Edge et al. Microsoft, 2024).
	Cas d'usage : sensemaking global sur corpus défense.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';
	import GraphRAGSimulator from '$lib/components/concepts/GraphRAGSimulator.svelte';

	// ============================================================
	// Visualisation interactive — hiérarchie de communautés
	// ============================================================
	let communityLevel = $state(1);
	let queryMode = $state<'index' | 'global' | 'local'>('index');

	// Petit corpus défense : 14 entités avec relations + communautés à 3 niveaux
	interface Entity {
		id: string;
		name: string;
		type: 'company' | 'program' | 'unit' | 'tech' | 'person' | 'location';
		x: number;
		y: number;
		// communautés à chaque niveau (0 = racine, 1 = mid, 2 = fine)
		comm: [number, number, number];
	}

	const ENTITIES: Entity[] = [
		{ id: 'arist', name: 'Aristote-Défense', type: 'company', x: 360, y: 60, comm: [0, 0, 0] },
		{ id: 'dga', name: 'DGA-MI', type: 'unit', x: 200, y: 130, comm: [0, 0, 0] },
		{ id: 'pers', name: 'Programme Persée', type: 'program', x: 100, y: 220, comm: [0, 1, 1] },
		{ id: 'leon', name: 'Programme Léonidas', type: 'program', x: 220, y: 280, comm: [0, 1, 2] },
		{ id: 'apol', name: 'Programme Apollon', type: 'program', x: 80, y: 320, comm: [0, 1, 1] },
		{ id: 'mistral', name: 'Mistral 7B fine-tuné', type: 'tech', x: 540, y: 130, comm: [0, 2, 3] },
		{ id: 'milvus', name: 'Milvus Index', type: 'tech', x: 620, y: 220, comm: [0, 2, 3] },
		{ id: 'ollama', name: 'Ollama Serveur', type: 'tech', x: 580, y: 310, comm: [0, 2, 4] },
		{ id: 'toulou', name: 'Site Toulouse', type: 'location', x: 360, y: 230, comm: [0, 0, 0] },
		{ id: 'paris', name: 'Site Paris', type: 'location', x: 290, y: 60, comm: [0, 0, 0] },
		{ id: 'capx', name: 'Cap. Martin', type: 'person', x: 460, y: 320, comm: [0, 1, 2] },
		{ id: 'colb', name: 'Col. Bernard', type: 'person', x: 380, y: 360, comm: [0, 1, 2] },
		{ id: 'reach', name: 'Conformité REACH', type: 'program', x: 460, y: 60, comm: [0, 3, 5] },
		{ id: 'anssi', name: 'Référentiel ANSSI', type: 'program', x: 520, y: 60, comm: [0, 3, 5] }
	];

	const EDGES: { from: string; to: string; label: string }[] = [
		{ from: 'arist', to: 'dga', label: 'travaille pour' },
		{ from: 'arist', to: 'paris', label: 'siège à' },
		{ from: 'dga', to: 'pers', label: 'pilote' },
		{ from: 'dga', to: 'leon', label: 'pilote' },
		{ from: 'dga', to: 'apol', label: 'pilote' },
		{ from: 'pers', to: 'apol', label: 'composant de' },
		{ from: 'leon', to: 'toulou', label: 'développé à' },
		{ from: 'leon', to: 'capx', label: 'piloté par' },
		{ from: 'leon', to: 'colb', label: 'supervisé par' },
		{ from: 'arist', to: 'mistral', label: 'utilise' },
		{ from: 'mistral', to: 'milvus', label: 'indexe via' },
		{ from: 'mistral', to: 'ollama', label: 'servi par' },
		{ from: 'arist', to: 'reach', label: 'conforme à' },
		{ from: 'arist', to: 'anssi', label: 'conforme à' }
	];

	// Couleurs par communauté
	const COMM_COLORS = ['#a855f7', '#06b6d4', '#fb923c', '#22c55e', '#facc15', '#ec4899', '#3b82f6'];

	function entityColor(e: Entity): string {
		const comm = e.comm[communityLevel];
		return COMM_COLORS[comm % COMM_COLORS.length];
	}

	function getEntity(id: string): Entity | undefined {
		return ENTITIES.find((e) => e.id === id);
	}

	// Communautés à mettre en évidence pour query mode "global"
	const COMMUNITY_SUMMARIES: Record<number, string> = {
		0: 'Communauté 0 — Organisation & sites : Aristote-Défense, DGA-MI, sites Paris et Toulouse',
		1: 'Communauté 1 — Programmes opérationnels : Persée, Léonidas, Apollon + personnel impliqué',
		2: 'Communauté 2 — Stack IA : Mistral 7B, Milvus, Ollama',
		3: 'Communauté 3 — Conformité : REACH, ANSSI'
	};
</script>

<svelte:head><title>GraphRAG — RAG par graphes pour le sensemaking global</title></svelte:head>

<article class="gr">
	<header class="gr-hero">
		<span class="gr-hero-emoji">🕸️</span>
		<h1 class="gr-h1">GraphRAG — RAG par graphes pour le sensemaking global</h1>
		<p class="gr-hero-lead">
			Microsoft Research, avril 2024 (Edge et al., arXiv:2404.16130). Quand
			ton agent doit répondre à <em>« quels sont les thèmes principaux
				dans ce corpus ? »</em>, le RAG vectoriel classique
			<strong>échoue</strong> — il faudrait lire TOUT le corpus. GraphRAG
			règle ça en construisant un knowledge graph + des résumés
			hiérarchiques de communautés. Page comprehensive avec
			<strong>visualisation interactive d'un graphe défense</strong>.
		</p>
		<div class="gr-hero-actions">
			<a href="#viz" class="gr-cta">🎮 Voir le graphe interactif</a>
		</div>
	</header>

	<nav class="gr-toc">
		<p class="gr-toc-label">📍 Parcours</p>
		<ol class="gr-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#pourquoi">1. Pourquoi GraphRAG — la limite du vector RAG</a></li>
			<li><a href="#archi">2. Architecture en 4 phases</a></li>
			<li><a href="#extraction">3. Phase 1 — Extraction par LLM</a></li>
			<li><a href="#leiden">4. Phase 2 — Communautés hiérarchiques (Leiden)</a></li>
			<li><a href="#summaries">5. Phase 3 — Résumés de communautés</a></li>
			<li><a href="#mapreduce">6. Phase 4 — Map-Reduce query ⭐</a></li>
			<li><a href="#viz">7. Visualisation interactive du graphe ⭐</a></li>
			<li><a href="#vs">8. GraphRAG vs Vector RAG — quand quoi</a></li>
			<li><a href="#defense">9. Cas d'usage défense</a></li>
			<li><a href="#code">10. Code — microsoft/graphrag</a></li>
			<li><a href="#glossaire">11. Glossaire</a></li>
		</ol>
	</nav>

	<!-- 0. PRÉREQUIS -->
	<section id="prereq" class="gr-section">
		<h2 class="gr-h2">0️⃣ Avant de commencer</h2>
		<div class="gr-prereq-grid">
			<details class="gr-prereq">
				<summary>🕸️ Knowledge Graph</summary>
				<div><p>Représentation structurée d'un domaine sous forme de <strong>nœuds</strong> (entités : personnes, lieux, programmes, technologies...) et d'<strong>arêtes</strong> (relations entre elles : « travaille pour », « pilote », « utilise »). Format historique : Wikidata, DBpedia. Avec GraphRAG : on le construit automatiquement à partir d'un corpus de textes via un LLM.</p></div>
			</details>
			<details class="gr-prereq">
				<summary>👥 Communauté (community)</summary>
				<div><p>En théorie des graphes : sous-ensemble de nœuds plus densément connectés entre eux qu'avec le reste du graphe. Représente intuitivement un « groupe thématique ». GraphRAG les détecte automatiquement et résume chaque communauté → c'est la clé de son pouvoir de sensemaking.</p></div>
			</details>
			<details class="gr-prereq">
				<summary>🌿 Leiden algorithm</summary>
				<div><p>Algorithme de détection de communautés (Traag, Waltman, van Eck 2019). Successeur de Louvain, garantit que toutes les communautés trouvées sont bien connectées. Itère pour optimiser la modularité. Hiérarchique : on peut détecter récursivement des sous-communautés au sein de chaque communauté.</p></div>
			</details>
			<details class="gr-prereq">
				<summary>🗺️ Sensemaking query</summary>
				<div><p>Terme du papier : une question qui requiert une <strong>compréhension globale</strong> du corpus, pas la récupération d'un fait précis. Exemples : « Quelles sont les tendances émergentes ? », « Qui sont les principaux acteurs et comment se relient-ils ? », « Quels sont les risques transversaux ? ». Vector RAG est incapable d'y répondre.</p></div>
			</details>
			<details class="gr-prereq">
				<summary>🔀 Map-Reduce</summary>
				<div><p>Pattern de calcul distribué (Google 2004) : (1) <strong>Map</strong> = applique une fonction à chaque élément en parallèle ; (2) <strong>Reduce</strong> = agrège tous les résultats partiels. GraphRAG l'applique aux requêtes : map = chaque communauté produit une réponse partielle, reduce = on synthétise en réponse finale.</p></div>
			</details>
			<details class="gr-prereq">
				<summary>📊 Modularité</summary>
				<div><p>Métrique (Newman 2006) qui mesure la qualité d'un partitionnement en communautés. Modularité élevée = beaucoup d'arêtes intra-communauté, peu d'arêtes inter-communautés. Leiden optimise cette mesure.</p></div>
			</details>
		</div>
	</section>

	<!-- 1. POURQUOI -->
	<section id="pourquoi" class="gr-section">
		<h2 class="gr-h2">1️⃣ Pourquoi GraphRAG — la limite du vector RAG</h2>
		<p>Vector RAG (la page <a href="/rag" class="gr-link">RAG avec Milvus</a>) marche très bien pour les questions <strong>locales</strong> : « Quels EPI pour HCl ? ». On embedde la question, on récupère le top-K chunks pertinents, on répond. <strong>Mais il échoue sur les questions globales</strong>.</p>

		<div class="gr-why-grid">
			<div class="gr-why-card gr-why-fail">
				<div class="gr-why-emoji">❌</div>
				<h4>Vector RAG échoue sur ces questions :</h4>
				<ul>
					<li>« Quels sont les principaux thèmes dans ce corpus ? »</li>
					<li>« Comment les programmes X et Y sont-ils liés ? »</li>
					<li>« Quelles tendances transversales sur les 5 dernières années ? »</li>
					<li>« Qui sont les acteurs principaux et leurs relations ? »</li>
					<li>« Quels sont les risques systémiques ? »</li>
				</ul>
				<p>Pourquoi ? Parce qu'il faudrait lire <strong>TOUT le corpus</strong>, pas juste 5 chunks. La question n'a pas de chunks « pertinents » localement.</p>
			</div>
			<div class="gr-why-card gr-why-win">
				<div class="gr-why-emoji">✅</div>
				<h4>GraphRAG les gère parce qu'il :</h4>
				<ul>
					<li>Pré-construit un <strong>knowledge graph</strong> à partir de tout le corpus</li>
					<li>Détecte des <strong>communautés hiérarchiques</strong> (thèmes naturels)</li>
					<li>Pré-génère des <strong>résumés</strong> à chaque niveau de communauté</li>
					<li>À la query : <strong>map-reduce</strong> sur les résumés au bon niveau</li>
				</ul>
				<p>Résultat : tu réponds à une question globale en parcourant <em>quelques dizaines</em> de résumés pré-faits, pas un million de tokens.</p>
			</div>
		</div>
	</section>

	<!-- 2. ARCHI -->
	<section id="archi" class="gr-section">
		<h2 class="gr-h2">2️⃣ Architecture en 4 phases</h2>

		<div class="gr-archi">
			<div class="gr-archi-phase">
				<div class="gr-archi-num">1</div>
				<div class="gr-archi-body">
					<h4>📜 Extraction par LLM (indexation, offline)</h4>
					<p>Le LLM lit chaque document et en extrait des <strong>entités</strong> (avec descriptions) et des <strong>relations</strong> (avec descriptions). Parfois aussi des <strong>covariates</strong> (assertions / claims). Coût : un appel LLM par chunk d'environ 600 tokens.</p>
				</div>
			</div>
			<div class="gr-archi-arrow">↓</div>
			<div class="gr-archi-phase">
				<div class="gr-archi-num">2</div>
				<div class="gr-archi-body">
					<h4>🕸️ Construction du graphe + détection de communautés (offline)</h4>
					<p>Toutes les entités/relations sont consolidées en un graphe unique. On applique <strong>Leiden hiérarchique</strong> : détection de communautés, puis récursivement sous-communautés. On obtient une <strong>hiérarchie multi-niveaux</strong>.</p>
				</div>
			</div>
			<div class="gr-archi-arrow">↓</div>
			<div class="gr-archi-phase">
				<div class="gr-archi-num">3</div>
				<div class="gr-archi-body">
					<h4>📝 Résumés de communautés (LLM, offline)</h4>
					<p>Pour chaque communauté à chaque niveau, le LLM génère un <strong>résumé structuré</strong> (titre, thème, entités-clés, observations, conclusions). Construction bottom-up : on résume les feuilles, puis on agrège vers les communautés parentes.</p>
				</div>
			</div>
			<div class="gr-archi-arrow">↓</div>
			<div class="gr-archi-phase gr-archi-online">
				<div class="gr-archi-num">4</div>
				<div class="gr-archi-body">
					<h4>🔀 Map-Reduce query (online, à chaque question)</h4>
					<p><strong>Map</strong> : pour chaque résumé de communauté du niveau choisi, on demande au LLM une <em>partial response</em> à la question. <strong>Reduce</strong> : on agrège ces réponses partielles en une réponse finale, en éliminant les redondances et en hiérarchisant les insights.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- 3. EXTRACTION -->
	<section id="extraction" class="gr-section">
		<h2 class="gr-h2">3️⃣ Phase 1 — Extraction par LLM</h2>
		<p>Le LLM lit chaque chunk et renvoie des entités + relations structurées. Le prompt système précise les types d'entités attendues (personne, organisation, lieu, programme, technologie…).</p>

		<h3 class="gr-h3">Exemple d'entrée</h3>
		<pre class="gr-code"><code>{`"Le programme Léonidas est piloté par la DGA-MI depuis le site de
Toulouse. Le Capitaine Martin coordonne les essais statiques sous la
supervision du Colonel Bernard. Le système embarqué utilise Mistral 7B
fine-tuné par Aristote-Défense pour l'aide à la décision."`}</code></pre>

		<h3 class="gr-h3">Sortie LLM structurée</h3>
		<pre class="gr-code"><code>{`# Entités extraites
("entity"|||LÉONIDAS|||programme|||"Programme militaire piloté par DGA-MI"|||)
("entity"|||DGA-MI|||organisation|||"Direction des programmes d'armement"|||)
("entity"|||TOULOUSE|||lieu|||"Site de développement du programme Léonidas"|||)
("entity"|||CAPITAINE MARTIN|||personne|||"Coordonne essais statiques Léonidas"|||)
("entity"|||COLONEL BERNARD|||personne|||"Supervise Cap. Martin sur Léonidas"|||)
("entity"|||MISTRAL 7B|||technologie|||"LLM fine-tuné par Aristote-Défense"|||)
("entity"|||ARISTOTE-DÉFENSE|||organisation|||"Entreprise de défense, fine-tune Mistral"|||)

# Relations extraites
("relationship"|||LÉONIDAS|||DGA-MI|||"Léonidas est piloté par DGA-MI"|||7)
("relationship"|||LÉONIDAS|||TOULOUSE|||"Léonidas est développé à Toulouse"|||8)
("relationship"|||CAPITAINE MARTIN|||LÉONIDAS|||"Cap. Martin coordonne Léonidas"|||9)
("relationship"|||COLONEL BERNARD|||CAPITAINE MARTIN|||"Bernard supervise Martin"|||6)
("relationship"|||LÉONIDAS|||MISTRAL 7B|||"Léonidas utilise Mistral pour décision"|||7)
("relationship"|||ARISTOTE-DÉFENSE|||MISTRAL 7B|||"Aristote fine-tune Mistral"|||9)`}</code></pre>

		<Callout variant="info" title="💡 Le poids des relations">
			<p>Le dernier chiffre (1-10) est un <strong>weight</strong> attribué par le LLM. Il représente la force de la relation telle qu'inférée du texte. Sert ensuite à pondérer les arêtes du graphe — Leiden l'utilise pour détecter de meilleures communautés.</p>
		</Callout>
	</section>

	<!-- 4. LEIDEN -->
	<section id="leiden" class="gr-section">
		<h2 class="gr-h2">4️⃣ Phase 2 — Communautés hiérarchiques (Leiden)</h2>
		<p>Une fois le graphe consolidé, on lance <strong>Leiden hiérarchique</strong> : on détecte des communautés, puis récursivement des sous-communautés au sein de chacune, jusqu'à atteindre des feuilles non-partitionnables.</p>

		<h3 class="gr-h3">L'idée intuitive</h3>
		<p>Imagine ton graphe défense : Aristote-Défense, DGA-MI, programmes, sites, personnes, stack IA. Leiden va trouver naturellement des clusters thématiques :</p>
		<ul class="gr-list">
			<li><strong>Niveau 0 (racine)</strong> : tout le graphe, 1 communauté.</li>
			<li><strong>Niveau 1 (mid)</strong> : 3-4 grandes communautés — typiquement {`{programmes opérationnels}`}, {`{stack technique IA}`}, {`{conformité réglementaire}`}, {`{personnel & sites}`}.</li>
			<li><strong>Niveau 2 (fine)</strong> : sous-communautés — programme Persée à part de Léonidas, MLOps à part de l'infra…</li>
		</ul>

		<h3 class="gr-h3">Comment Leiden détecte les communautés — étape par étape</h3>
		<p>Pas de magie. L'algo procède en 3 phases qu'il répète jusqu'à convergence :</p>
		<div class="gr-leiden-steps">
			<div class="gr-leiden-step">
				<div class="gr-leiden-num">1</div>
				<div>
					<strong>Local moving (déplacement local)</strong>
					<p>Pour chaque nœud, on calcule : « si je rejoignais la communauté de mon voisin X, est-ce que la modularité globale augmenterait ? ». Si oui, on déplace. On répète jusqu'à ce qu'aucun déplacement n'améliore la situation.</p>
				</div>
			</div>
			<div class="gr-leiden-step">
				<div class="gr-leiden-num">2</div>
				<div>
					<strong>Refinement (raffinement)</strong>
					<p>L'innovation clé de Leiden vs Louvain. On revisite chaque communauté pour vérifier qu'elle est <em>bien connectée</em> en interne. Si une communauté est en réalité 2 sous-groupes mal liés, on la coupe en 2.</p>
				</div>
			</div>
			<div class="gr-leiden-step">
				<div class="gr-leiden-num">3</div>
				<div>
					<strong>Aggregation (agrégation)</strong>
					<p>On crée un nouveau graphe où chaque <em>communauté</em> devient un super-nœud. Puis on retourne à l'étape 1 sur ce graphe agrégé. On obtient ainsi <strong>plusieurs niveaux hiérarchiques</strong> — c'est ce qui produit la hiérarchie de communautés.</p>
				</div>
			</div>
		</div>

		<h3 class="gr-h3">Modularité — la métrique optimisée</h3>
		<p>
			La <strong>modularité Q</strong> mesure « à quel point un partitionnement est bon ». Définition intuitive : <em>Q = (fraction d'arêtes intra-communauté) − (fraction attendue si les arêtes étaient placées au hasard)</em>. Q maximale ≈ 1 (partition parfaite), Q autour de 0 = partition aléatoire.
		</p>
		<p>
			Sur notre graphe défense après Leiden :
		</p>
		<ul class="gr-list">
			<li>Niveau 0 (1 communauté) : Q = 0 par définition</li>
			<li>Niveau 1 (4 communautés) : Q ≈ 0.61 — très bonne séparation thématique</li>
			<li>Niveau 2 (6 communautés) : Q ≈ 0.74 — encore meilleure</li>
		</ul>

		<h3 class="gr-h3">Pourquoi Leiden et pas Louvain</h3>
		<p>Louvain (l'ancêtre, 2008) a un défaut : il peut produire des communautés <em>déconnectées</em> (un sous-graphe est classé avec d'autres alors qu'il n'y est pas relié — c'est mathématiquement possible parce que Louvain optimise localement sans vérifier la cohérence globale). <strong>Leiden (Traag et al. 2019) garantit la connectivité</strong> de chaque communauté grâce à la phase de refinement. Critique pour la cohérence des résumés.</p>

		<Callout variant="info" title="💡 En pratique : nb d'appels LLM et coût">
			<p>
				Sur un corpus de <strong>1 million de tokens</strong> (équivalent ~10 livres) :
			</p>
			<ul>
				<li><strong>Extraction</strong> : ~1 500 appels LLM (chunks de ~600 tokens). Coût ~$5 avec GPT-4o-mini ou gratuit avec Mistral local.</li>
				<li><strong>Leiden</strong> : <em>pas d'appel LLM</em> — c'est de l'algo pur en quelques secondes.</li>
				<li><strong>Résumés de communautés</strong> : ~200-500 appels LLM selon la granularité. Coût ~$2 (GPT-4o-mini).</li>
				<li><strong>Total indexation</strong> : ~30 min de compute, $5-10 si LLM cloud, $0 si local. <strong>One-shot</strong>.</li>
			</ul>
			<p>
				Pour ton corpus défense souverain : Mistral 7B local → indexation gratuite mais 4-6h sur ta RTX 5000.
			</p>
		</Callout>
	</section>

	<!-- 5. SUMMARIES -->
	<section id="summaries" class="gr-section">
		<h2 class="gr-h2">5️⃣ Phase 3 — Résumés de communautés</h2>
		<p>Pour chaque communauté à chaque niveau, le LLM génère un résumé structuré. Construction <strong>bottom-up</strong> : on commence par les feuilles (les plus fines), puis on aggrège pour les niveaux supérieurs.</p>

		<h3 class="gr-h3">Format d'un résumé de communauté</h3>
		<pre class="gr-code"><code>{`{
  "community_id": 1,
  "level": 1,
  "title": "Programmes opérationnels et personnel",
  "summary": "Cette communauté regroupe les programmes opérationnels
              majeurs (Persée, Léonidas, Apollon) pilotés par la DGA-MI,
              ainsi que le personnel directement impliqué (Cap. Martin
              pour Léonidas, supervision par Col. Bernard).",
  "key_entities": ["LÉONIDAS", "DGA-MI", "CAP. MARTIN", "PERSÉE", "APOLLON"],
  "findings": [
    {
      "summary": "Concentration de l'effort sur le site Toulouse",
      "explanation": "Léonidas est développé à Toulouse..."
    },
    {
      "summary": "Hiérarchie militaire intacte",
      "explanation": "Col. Bernard supervise Cap. Martin sur Léonidas..."
    }
  ],
  "rating": 7.5,
  "rating_explanation": "Programmes sensibles, classifiés CD/SD"
}`}</code></pre>

		<Callout variant="insight" title="🎯 La hiérarchie permet de varier la granularité de la réponse">
			<p>Pour une question très générale (« quel est l'écosystème ? »), on utilise les résumés <strong>niveau 0 ou 1</strong>. Pour une question plus ciblée mais toujours globale (« Comment les programmes opérationnels s'organisent-ils ? »), on prend le <strong>niveau 1 ou 2</strong>. L'utilisateur ou un mini-LLM router choisit le niveau approprié.</p>
		</Callout>
	</section>

	<!-- 6. MAP-REDUCE -->
	<section id="mapreduce" class="gr-section">
		<h2 class="gr-h2">6️⃣ Phase 4 — Map-Reduce query ⭐</h2>
		<p>Une fois l'indexation faite (phases 1-3, offline), à chaque question on procède en 2 étapes parallèles + agrégation finale.</p>

		<div class="gr-mr">
			<svg viewBox="0 0 720 380" class="gr-mr-svg">
				<defs>
					<marker id="gr-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
				</defs>

				<!-- Question -->
				<rect x="280" y="20" width="160" height="40" rx="8" fill="#1e293b" stroke="#facc15" stroke-width="2" />
				<text x="360" y="44" text-anchor="middle" fill="#facc15" font-family="monospace" font-size="13" font-weight="700">❓ Question globale</text>

				<line x1="360" y1="60" x2="360" y2="85" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#gr-arr)" />

				<!-- Map phase -->
				<rect x="40" y="90" width="640" height="50" rx="6" fill="rgba(168, 85, 247, 0.1)" stroke="#a855f7" stroke-width="1" stroke-dasharray="4 3" />
				<text x="360" y="118" text-anchor="middle" fill="#a855f7" font-family="monospace" font-size="13" font-weight="700">🔀 PHASE MAP — chaque communauté répond en parallèle</text>

				<!-- Communautés (5 résumés) -->
				{#each [0, 1, 2, 3, 4] as i (i)}
					<rect x={50 + i * 130} y="160" width="110" height="50" rx="6" fill="#1e293b" stroke={COMM_COLORS[i % COMM_COLORS.length]} stroke-width="1.5" />
					<text x={105 + i * 130} y="180" text-anchor="middle" fill={COMM_COLORS[i % COMM_COLORS.length]} font-family="monospace" font-size="10">Communauté {i}</text>
					<text x={105 + i * 130} y="195" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="8">+ LLM → partial</text>
				{/each}

				<!-- arrows down -->
				{#each [0, 1, 2, 3, 4] as i (i)}
					<line x1={105 + i * 130} y1="210" x2={105 + i * 130} y2="240" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#gr-arr)" />
				{/each}

				<!-- Partial responses -->
				{#each [0, 1, 2, 3, 4] as i (i)}
					<rect x={55 + i * 130} y="245" width="100" height="36" rx="4" fill="#1e293b" stroke="#06b6d4" stroke-width="1.2" />
					<text x={105 + i * 130} y="263" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">Partial {i}</text>
					<text x={105 + i * 130} y="276" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="8">+ score</text>
				{/each}

				<!-- Reduce arrows -->
				{#each [0, 1, 2, 3, 4] as i (i)}
					<line x1={105 + i * 130} y1="281" x2="360" y2="310" stroke="#94a3b8" stroke-width="1" marker-end="url(#gr-arr)" />
				{/each}

				<!-- Reduce phase -->
				<rect x="220" y="315" width="280" height="50" rx="6" fill="#1e293b" stroke="#fb923c" stroke-width="2" />
				<text x="360" y="340" text-anchor="middle" fill="#fb923c" font-family="monospace" font-size="13" font-weight="700">🧮 REDUCE — synthèse finale</text>
				<text x="360" y="357" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="10">LLM agrège, dédoublonne, hiérarchise</text>
			</svg>
		</div>

		<h3 class="gr-h3">Le pseudo-code</h3>
		<pre class="gr-code"><code>{`# Phase Map (en parallèle, sur 30 communautés du niveau choisi)
async def map_step(question, communities):
    partial_responses = await asyncio.gather(*[
        llm.invoke(MAP_PROMPT, summary=c.summary, question=question)
        for c in communities
    ])
    # Chaque partial = {"answer": "...", "score": 0-100}
    # Le score indique la pertinence du résumé pour CETTE question
    return [r for r in partial_responses if r.score > 0]

# Phase Reduce (séquentiel, 1 appel LLM)
def reduce_step(question, partials):
    # Trier par score décroissant
    sorted_partials = sorted(partials, key=lambda p: -p.score)
    # Compresser jusqu'à tenir dans le contexte du LLM
    context = compress_until_fit(sorted_partials, max_tokens=8000)
    return llm.invoke(REDUCE_PROMPT, partials=context, question=question)

# Query end-to-end
async def graphrag_global_query(question, level=1):
    communities = load_communities(level=level)
    partials = await map_step(question, communities)
    return reduce_step(question, partials)`}</code></pre>
	</section>

	<!-- 7. VIZ INTERACTIVE -->
	<section id="viz" class="gr-section">
		<h2 class="gr-h2">7️⃣ Simulateur GraphRAG complet ⭐</h2>
		<p>
			Le simulateur ci-dessous te fait <strong>parcourir les 5 phases</strong>
			du pipeline GraphRAG sur un mini-corpus défense de 14 entités.
			Clique « ▶ Démarrer extraction » et avance étape par étape : tu vois
			les entités apparaître, les relations se dessiner, Leiden faire
			émerger les communautés, les résumés se générer, et enfin une query
			Map-Reduce se dérouler avec ses partial responses.
		</p>

		<GraphRAGSimulator />

		<Callout variant="insight" title="🎯 Ce que tu apprends en parcourant les 5 phases">
			<ol>
				<li><strong>Phase 0 → 1</strong> : passage du texte brut à des entités structurées (le LLM fait ce que tu ferais à la main, mais à grande échelle).</li>
				<li><strong>Phase 1 → 2</strong> : les entités ne suffisent pas — c'est le <strong>réseau de relations</strong> qui crée la valeur informationnelle.</li>
				<li><strong>Phase 2 → 3</strong> : Leiden trouve les communautés <strong>sans supervision</strong> — c'est purement structurel. Bouge le slider pour voir la hiérarchie.</li>
				<li><strong>Phase 3 → 4</strong> : chaque communauté devient une « unité narrative » résumable. Le résumé est un texte court qu'un LLM peut lire et utiliser.</li>
				<li><strong>Phase 5</strong> : à la query, on n'attaque <strong>pas tout le corpus</strong> — juste les résumés des communautés. C'est la clé de la scalabilité de GraphRAG.</li>
			</ol>
		</Callout>

		<!-- Section conservée mais cachée car remplacée par le simulateur -->
		<div class="gr-viz" style="display:none">
			<div class="gr-viz-controls">
				<div class="gr-viz-tabs">
					<button type="button" class="gr-viz-tab {queryMode === 'index' ? 'is-active' : ''}" onclick={() => (queryMode = 'index')}>📜 Indexing</button>
					<button type="button" class="gr-viz-tab {queryMode === 'global' ? 'is-active' : ''}" onclick={() => (queryMode = 'global')}>🌐 Global query</button>
					<button type="button" class="gr-viz-tab {queryMode === 'local' ? 'is-active' : ''}" onclick={() => (queryMode = 'local')}>🎯 Local query</button>
				</div>
				<label class="gr-viz-slider-label">
					Niveau de communauté :
					<input type="range" min="0" max="2" bind:value={communityLevel} class="gr-viz-slider" />
					<span class="gr-viz-level">{communityLevel === 0 ? 'racine (1)' : communityLevel === 1 ? 'mid (4)' : 'fine (6)'}</span>
				</label>
			</div>

			<svg viewBox="0 0 720 420" class="gr-viz-svg">
				<defs>
					<marker id="gr-edge-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
					</marker>
				</defs>

				<!-- Edges -->
				{#each EDGES as edge (`${edge.from}-${edge.to}`)}
					{@const from = getEntity(edge.from)}
					{@const to = getEntity(edge.to)}
					{#if from && to}
						<line
							x1={from.x}
							y1={from.y}
							x2={to.x}
							y2={to.y}
							stroke="#475569"
							stroke-width="1.5"
							opacity={queryMode === 'index' ? 0.7 : 0.4}
							marker-end="url(#gr-edge-arr)"
						/>
					{/if}
				{/each}

				<!-- Entities (coloriés par communauté) -->
				{#each ENTITIES as e (e.id)}
					<g>
						<circle cx={e.x} cy={e.y} r="22" fill={entityColor(e)} fill-opacity="0.25" stroke={entityColor(e)} stroke-width="2" />
						<text x={e.x} y={e.y - 26} text-anchor="middle" font-family="monospace" font-size="9" fill="#cbd5e1">{e.name}</text>
						<text x={e.x} y={e.y + 4} text-anchor="middle" font-family="monospace" font-size="8" fill={entityColor(e)} font-weight="700">{e.type}</text>
					</g>
				{/each}

				<!-- Title overlay -->
				<text x="20" y="30" font-family="monospace" font-size="11" fill="#facc15" font-weight="700">
					Mode : {queryMode === 'index' ? 'Indexation — extraction + Leiden' : queryMode === 'global' ? 'Global query — toutes communautés actives' : 'Local query — vector search classique sur entités proches'}
				</text>
				<text x="20" y="48" font-family="monospace" font-size="10" fill="#94a3b8">
					Niveau {communityLevel} ({communityLevel === 0 ? '1' : communityLevel === 1 ? '4' : '6'} communautés)
				</text>
			</svg>

			{#if queryMode === 'global'}
				<div class="gr-viz-legend">
					<h4>🌐 En mode Global query :</h4>
					<p>Pour la question « Comment l'écosystème défense s'organise-t-il ? », GraphRAG fait map-reduce sur TOUTES les communautés du niveau {communityLevel} :</p>
					<ul>
						{#each Object.entries(COMMUNITY_SUMMARIES).slice(0, communityLevel === 0 ? 1 : communityLevel === 1 ? 4 : 6) as [id, summary] (id)}
							<li><span class="gr-viz-dot" style="background: {COMM_COLORS[Number(id) % COMM_COLORS.length]}"></span> {summary}</li>
						{/each}
					</ul>
					<p style="margin-top:0.5rem; font-style:italic">Chaque résumé → partial response → reduce final.</p>
				</div>
			{:else if queryMode === 'local'}
				<div class="gr-viz-legend">
					<h4>🎯 En mode Local query :</h4>
					<p>Pour « Qui pilote Léonidas ? » (question locale, factuelle), GraphRAG fait simplement un vector search sur les entités proches sémantiquement, suit les arêtes, et formule une réponse — comme un RAG classique boosté par la structure du graphe.</p>
					<p style="font-style:italic">Pas besoin de map-reduce. C'est l'équivalent du vector RAG classique.</p>
				</div>
			{:else}
				<div class="gr-viz-legend">
					<h4>📜 Pendant l'indexation :</h4>
					<p>Le LLM lit tous les documents et extrait entités + relations. Le graphe se construit. Puis Leiden détecte les communautés à plusieurs niveaux. Bouge le slider <strong>« Niveau de communauté »</strong> pour voir le partitionnement évoluer :</p>
					<ul>
						<li><strong>Niveau 0</strong> : tout dans une seule communauté (la racine)</li>
						<li><strong>Niveau 1</strong> : 4 grandes thématiques (mid-level)</li>
						<li><strong>Niveau 2</strong> : 6 sous-communautés (fine-grained)</li>
					</ul>
				</div>
			{/if}
		</div>
	</section>

	<!-- 8. VS -->
	<section id="vs" class="gr-section">
		<h2 class="gr-h2">8️⃣ GraphRAG vs Vector RAG</h2>
		<table class="gr-table">
			<thead><tr><th>Critère</th><th>Vector RAG</th><th>GraphRAG</th></tr></thead>
			<tbody>
				<tr><td>Questions locales (factuelles)</td><td class="gr-good">✅ Excellent</td><td>✅ Très bon (via local query mode)</td></tr>
				<tr><td>Questions globales / sensemaking</td><td class="gr-bad">❌ Échec total</td><td class="gr-good">✅ Spécialité</td></tr>
				<tr><td>Comprehensiveness des réponses</td><td>~60 %</td><td class="gr-good">~85 %</td></tr>
				<tr><td>Diversité des perspectives</td><td>~50 %</td><td class="gr-good">~80 %</td></tr>
				<tr><td>Coût d'indexation</td><td class="gr-good">Faible (juste embeddings)</td><td>Élevé (1 appel LLM/chunk × millions)</td></tr>
				<tr><td>Coût par query (local)</td><td class="gr-good">~$0.001</td><td>~$0.002</td></tr>
				<tr><td>Coût par query (global)</td><td>N/A</td><td>~$0.5 à $2 (map-reduce sur dizaines de communautés)</td></tr>
				<tr><td>Latence par query (global)</td><td>N/A</td><td>15-60 sec (parallélisation)</td></tr>
				<tr><td>Mise à jour incrémentale</td><td class="gr-good">Trivial (re-embed)</td><td>Complexe (re-extraire + re-clusteriser)</td></tr>
				<tr><td>Maturité</td><td class="gr-good">Mainstream</td><td>Émergent (sorti 2024)</td></tr>
			</tbody>
		</table>

		<Callout variant="insight" title="🎯 La règle pragmatique">
			<p>
				<strong>Tu n'as pas à choisir.</strong> Une architecture moderne combine les deux : Vector RAG pour 90 % des questions (factuelles, locales), GraphRAG pour les 10 % de questions « executive » (vue d'ensemble, tendances, relations). Un router LLM en amont décide quelle voie prendre.
			</p>
		</Callout>
	</section>

	<!-- 9. DÉFENSE -->
	<section id="defense" class="gr-section">
		<h2 class="gr-h2">9️⃣ Cas d'usage défense — où GraphRAG brille</h2>

		<div class="gr-defense-grid">
			<div class="gr-defense-card">
				<div class="gr-defense-emoji">🗺️</div>
				<h4>Cartographie d'écosystème</h4>
				<p>« Quels sont les principaux programmes et leurs interdépendances ? » GraphRAG voit le réseau global, vector RAG ne voit qu'un chunk à la fois.</p>
			</div>
			<div class="gr-defense-card">
				<div class="gr-defense-emoji">⚠️</div>
				<h4>Détection de risques transversaux</h4>
				<p>« Quels risques opérationnels affectent plusieurs programmes en même temps ? » La structure communautaire fait émerger les patterns invisibles d'une lecture chunk-par-chunk.</p>
			</div>
			<div class="gr-defense-card">
				<div class="gr-defense-emoji">👥</div>
				<h4>Analyse organisationnelle</h4>
				<p>« Qui sont les acteurs centraux du programme X et leurs réseaux ? » Les communautés font apparaître les hubs (Cap. Martin, Col. Bernard) et leurs portées d'influence.</p>
			</div>
			<div class="gr-defense-card">
				<div class="gr-defense-emoji">📈</div>
				<h4>Tendances et évolution</h4>
				<p>« Comment l'effort R&D s'est-il déplacé en 3 ans ? » Une analyse temporelle des résumés de communautés met en lumière les bascules thématiques.</p>
			</div>
		</div>

		<Callout variant="warning" title="🔐 Considérations sécurité sur le knowledge graph">
			<p>Le knowledge graph extrait est <strong>aussi sensible que les documents sources</strong>. Si tes documents sont CD/SD, le graphe l'est aussi. Stocke-le dans la même infra protégée. Et attention : Leiden ignore les labels de classification — on peut potentiellement déduire des liens sensibles depuis des connexions individuellement non-classifiées. Une <strong>revue manuelle</strong> du graphe extrait est recommandée avant déploiement.</p>
		</Callout>
	</section>

	<!-- 10. CODE -->
	<section id="code" class="gr-section">
		<h2 class="gr-h2">🔟 Code — microsoft/graphrag</h2>
		<p>Microsoft a open-sourcé l'implémentation officielle sous licence MIT : <code>microsoft/graphrag</code> sur GitHub.</p>

		<pre class="gr-code"><code>{`# Installation
pip install graphrag

# Initialisation d'un projet
python -m graphrag.index --init --root ./ragtest

# Le dossier ./ragtest reçoit settings.yaml + prompts/

# Configure settings.yaml pour pointer sur ton LLM local
# (Mistral via Ollama, Llama via vLLM, etc.)
# llm:
#   type: openai_chat
#   api_base: http://ollama.intranet:11434/v1
#   model: mistral-defense:latest

# Lance l'indexation (extraction LLM + Leiden + summaries)
python -m graphrag.index --root ./ragtest

# Le pipeline produit :
#   - parquet files avec entités, relations, communautés
#   - community_reports/ avec les résumés par niveau

# Query globale (sensemaking)
python -m graphrag.query \\
  --root ./ragtest \\
  --method global \\
  "Quels sont les principaux thèmes de ce corpus ?"

# Query locale (factuelle)
python -m graphrag.query \\
  --root ./ragtest \\
  --method local \\
  "Qui pilote le programme Léonidas ?"`}</code></pre>

		<Callout variant="info" title="💡 Pour ton projet souverain">
			<p>microsoft/graphrag est <strong>MIT</strong> et fonctionne avec n'importe quel LLM compatible OpenAI API. Donc Mistral 7B local via Ollama (port 11434) ou vLLM. Pas de dépendance cloud, parfait pour le déploiement air-gap. Note : l'indexation est <strong>coûteuse en appels LLM</strong> — sur un corpus de 100k tokens, compte ~500 appels LLM ; sur 10M tokens, ~50k appels. Planifie sur la nuit.</p>
		</Callout>
	</section>

	<!-- 11. GLOSSAIRE -->
	<section id="glossaire" class="gr-section">
		<h2 class="gr-h2">1️⃣1️⃣ Glossaire</h2>
		<dl class="gr-glossary">
			<div class="gr-gl-row"><dt>Claim / Covariate</dt><dd>Assertion factuelle extraite, attachée à une entité ou relation (ex : « X a été promu en 2023 »). Optionnel dans GraphRAG.</dd></div>
			<div class="gr-gl-row"><dt>Community</dt><dd>Sous-ensemble de nœuds densément connectés entre eux dans un graphe.</dd></div>
			<div class="gr-gl-row"><dt>Community Report</dt><dd>Résumé structuré généré par LLM pour chaque communauté (titre, thème, entités-clés, findings).</dd></div>
			<div class="gr-gl-row"><dt>Comprehensiveness</dt><dd>Métrique évaluation : la réponse couvre-t-elle toutes les facettes de la question ? GraphRAG y excelle.</dd></div>
			<div class="gr-gl-row"><dt>Diversity</dt><dd>Métrique : la réponse présente-t-elle plusieurs perspectives différentes ?</dd></div>
			<div class="gr-gl-row"><dt>Entity</dt><dd>Nœud du graphe : personne, organisation, lieu, programme, technologie… extrait par LLM.</dd></div>
			<div class="gr-gl-row"><dt>Global query</dt><dd>Question requérant une compréhension de tout le corpus (sensemaking). Map-reduce sur les community summaries.</dd></div>
			<div class="gr-gl-row"><dt>GraphRAG</dt><dd>Approche RAG basée sur knowledge graph + communautés hiérarchiques. Microsoft Research 2024.</dd></div>
			<div class="gr-gl-row"><dt>Hierarchical community detection</dt><dd>Détection récursive de sous-communautés au sein de chaque communauté. Permet de varier la granularité.</dd></div>
			<div class="gr-gl-row"><dt>Knowledge graph</dt><dd>Représentation structurée d'un domaine par entités (nœuds) + relations (arêtes).</dd></div>
			<div class="gr-gl-row"><dt>Leiden</dt><dd>Algorithme de détection de communautés (Traag 2019). Successeur de Louvain, garantit la connectivité.</dd></div>
			<div class="gr-gl-row"><dt>Local query</dt><dd>Question factuelle ciblée. GraphRAG fait alors un vector search classique sur entités proches.</dd></div>
			<div class="gr-gl-row"><dt>Map-Reduce</dt><dd>Pattern : Map = exécution parallèle sur N éléments ; Reduce = agrégation des résultats partiels.</dd></div>
			<div class="gr-gl-row"><dt>Modularity</dt><dd>Métrique de qualité d'un partitionnement en communautés. Plus c'est haut, plus les communautés sont bien séparées.</dd></div>
			<div class="gr-gl-row"><dt>Relationship</dt><dd>Arête du graphe : connexion entre deux entités, avec description et poids.</dd></div>
			<div class="gr-gl-row"><dt>Sensemaking</dt><dd>Question nécessitant une compréhension globale, pas la récupération d'un fait. Cas d'usage central de GraphRAG.</dd></div>
		</dl>
	</section>
</article>

<style>
	.gr { max-width: 1240px; margin: 0 auto; padding: 2rem 1rem 4rem; display: flex; flex-direction: column; gap: 2rem; }
	.gr :global(p) { max-width: 880px; }
	.gr-hero { text-align: center; padding: 2rem 1.5rem; background: linear-gradient(135deg, #faf5ff 0%, #fff 100%); border-radius: 1.5rem; border: 1px solid #a855f7; }
	.gr-hero-emoji { font-size: 4rem; display: block; }
	.gr-h1 { font-family: var(--font-display); font-size: 2.25rem; font-weight: 700; margin: 0.5rem 0 0; color: var(--color-ink-900); }
	.gr-hero-lead { font-size: 1rem; max-width: 700px; margin: 0.85rem auto 1.5rem; line-height: 1.6; color: var(--color-ink-700); }
	.gr-hero-actions { display: flex; justify-content: center; }
	.gr-cta { padding: 0.7rem 1.5rem; background: #a855f7; color: #fff; border-radius: 999px; text-decoration: none; font-weight: 500; }
	.gr-link { color: #a855f7; }

	.gr-toc { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem 1.5rem; }
	.gr-toc-label { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem; }
	.gr-toc-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0; }
	.gr-toc-list a { color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem; }
	.gr-toc-list a:hover { color: #a855f7; }

	.gr-section { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 80px; }
	.gr-h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-ink-900); margin: 0; }
	.gr-h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; color: var(--color-ink-900); margin: 1rem 0 0.5rem; }

	.gr-prereq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem; }
	.gr-prereq { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
	.gr-prereq summary { cursor: pointer; padding: 0.85rem 1rem; font-family: var(--font-display); font-weight: 600; color: var(--color-ink-900); list-style: none; }
	.gr-prereq summary::-webkit-details-marker { display: none; }
	.gr-prereq summary::after { content: '▶'; float: right; color: var(--color-ink-500); font-size: 0.7rem; transition: transform 0.15s; }
	.gr-prereq[open] summary::after { transform: rotate(90deg); }
	.gr-prereq[open] summary { background: #faf5ff; border-bottom: 1px solid #e2e8f0; }
	.gr-prereq > div { padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; }

	.gr-why-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
	@media (max-width: 720px) { .gr-why-grid { grid-template-columns: 1fr; } }
	.gr-why-card { padding: 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
	.gr-why-fail { border-left: 4px solid #dc2626; }
	.gr-why-win { border-left: 4px solid #22c55e; background: #f0fdf4; }
	.gr-why-emoji { font-size: 1.75rem; }
	.gr-why-card h4 { font-family: var(--font-display); font-size: 1.05rem; margin: 0.3rem 0 0.6rem; color: var(--color-ink-900); }
	.gr-why-card ul { font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; padding-left: 1.25rem; margin: 0 0 0.5rem; }
	.gr-why-card li { margin: 0.25rem 0; }
	.gr-why-card p { font-size: 0.88rem; color: var(--color-ink-500); font-style: italic; margin: 0; }

	.gr-archi { display: flex; flex-direction: column; align-items: stretch; gap: 0.4rem; max-width: 760px; margin: 0 auto; }
	.gr-archi-phase { display: flex; gap: 1rem; padding: 1rem 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
	.gr-archi-online { background: linear-gradient(90deg, #fef3c7 0%, #fff 50%); border-left: 4px solid #f59e0b; }
	.gr-archi-num { width: 36px; height: 36px; border-radius: 50%; background: #a855f7; color: #fff; font-family: var(--font-display); font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.gr-archi-online .gr-archi-num { background: #f59e0b; }
	.gr-archi-body h4 { font-family: var(--font-display); font-size: 1rem; margin: 0 0 0.4rem; color: var(--color-ink-900); }
	.gr-archi-body p { font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; margin: 0; }
	.gr-archi-arrow { text-align: center; font-size: 1.2rem; color: var(--color-ink-300); font-weight: 700; }

	.gr-leiden-steps {
		display: flex; flex-direction: column; gap: 0.5rem; margin: 0.5rem 0;
	}
	.gr-leiden-step {
		display: flex; gap: 0.85rem; align-items: flex-start;
		padding: 0.85rem 1rem; background: #fff; border: 1px solid #e2e8f0;
		border-left: 4px solid #a855f7; border-radius: 0.6rem;
	}
	.gr-leiden-num {
		width: 32px; height: 32px; border-radius: 50%;
		background: #a855f7; color: #fff;
		font-family: var(--font-display); font-weight: 700;
		display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	}
	.gr-leiden-step strong {
		font-family: var(--font-display); color: var(--color-ink-900);
		display: block; margin-bottom: 0.25rem;
	}
	.gr-leiden-step p {
		font-size: 0.9rem; color: var(--color-ink-700);
		line-height: 1.55; margin: 0;
	}

	.gr-code { background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem; border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.6; margin: 0.5rem 0; white-space: pre-wrap; word-break: break-word; }
	.gr-list { font-size: 0.92rem; color: var(--color-ink-700); line-height: 1.7; }

	.gr-mr { background: #0f172a; border-radius: 1rem; padding: 1rem; }
	.gr-mr-svg { width: 100%; height: auto; max-height: 380px; }

	/* Viz interactive */
	.gr-viz { background: #0f172a; border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; }
	.gr-viz-controls { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: space-between; align-items: center; }
	.gr-viz-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.gr-viz-tab { padding: 0.5rem 0.95rem; background: #1e293b; border: 2px solid #334155; border-radius: 999px; color: #cbd5e1; font-family: var(--font-mono); font-size: 0.78rem; cursor: pointer; }
	.gr-viz-tab.is-active { background: #a855f7; border-color: #a855f7; color: #fff; font-weight: 600; }
	.gr-viz-slider-label { display: flex; align-items: center; gap: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem; color: #cbd5e1; }
	.gr-viz-slider { width: 180px; accent-color: #a855f7; }
	.gr-viz-level { background: #a855f7; color: #fff; padding: 0.2rem 0.6rem; border-radius: 0.3rem; font-weight: 700; }
	.gr-viz-svg { width: 100%; height: auto; max-height: 460px; background: #1e293b; border-radius: 0.5rem; }
	.gr-viz-legend { padding: 0.85rem 1rem; background: #1e293b; border-left: 3px solid #a855f7; border-radius: 0.5rem; color: #cbd5e1; font-size: 0.88rem; line-height: 1.55; }
	.gr-viz-legend h4 { font-family: var(--font-display); font-size: 1rem; margin: 0 0 0.4rem; color: #e2e8f0; }
	.gr-viz-legend p { margin: 0 0 0.4rem; }
	.gr-viz-legend ul { padding-left: 1.25rem; margin: 0.3rem 0; }
	.gr-viz-legend li { margin: 0.25rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
	.gr-viz-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; }

	.gr-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; background: #fff; border-radius: 0.5rem; overflow: hidden; border: 1px solid #e2e8f0; }
	.gr-table thead { background: #faf5ff; }
	.gr-table th { font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; color: var(--color-ink-700); text-align: left; padding: 0.5rem 0.7rem; }
	.gr-table td { padding: 0.5rem 0.7rem; border-bottom: 1px solid #f1f5f9; color: var(--color-ink-700); vertical-align: top; }
	.gr-good { color: #16a34a; font-weight: 600; }
	.gr-bad { color: #dc2626; font-weight: 600; }

	.gr-defense-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.6rem; }
	.gr-defense-card { padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
	.gr-defense-emoji { font-size: 1.75rem; }
	.gr-defense-card h4 { font-family: var(--font-display); font-size: 1rem; margin: 0.3rem 0 0.4rem; color: var(--color-ink-900); }
	.gr-defense-card p { font-size: 0.88rem; color: var(--color-ink-700); margin: 0; line-height: 1.55; }

	.gr-glossary { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.gr-gl-row { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.65rem 1rem; display: grid; grid-template-columns: 220px 1fr; gap: 1rem; }
	.gr-gl-row dt { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: #a855f7; }
	.gr-gl-row dd { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	@media (max-width: 600px) { .gr-gl-row { grid-template-columns: 1fr; gap: 0.25rem; } }
</style>
