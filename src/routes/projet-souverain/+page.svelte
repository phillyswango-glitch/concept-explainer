<!--
	/projet-souverain — Synthèse critique et architecture du projet COAS
	(Centre Opérationnel d'Agents Souverains) en contexte Défense / Cyber / Air-gap.

	Page de synthèse qui :
	  1. Critique les technos vues (forces/faiblesses dans le contexte)
	  2. Propose une stack cohérente
	  3. Décrit l'architecture air-gap
	  4. Détaille 3 cas d'usage concrets
	  5. Donne une roadmap d'implémentation
	  6. Liste les risques + mitigations
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';
	import DifficultyTabs from '$lib/components/DifficultyTabs.svelte';

	type Verdict = 'keep' | 'replace' | 'caution' | 'drop';
	interface TechRow {
		tech: string;
		emoji: string;
		role: string;
		strengths: string;
		weaknesses: string;
		verdict: Verdict;
		decision: string;
	}

	const TECH_CRITIQUE: TechRow[] = [
		{
			tech: 'vLLM',
			emoji: '🚀',
			role: 'Inference runtime LLM',
			strengths: 'Apache 2.0, PagedAttention, continuous batching, multi-GPU tensor parallel, AWQ/FP8/GPTQ supportés. API OpenAI-compatible → portabilité immédiate du code client.',
			weaknesses: 'Python-only en server (≈ pas un binaire statique « shipable »). HA non triviale (kube + healthchecks à câbler). Pas de signature de réponse côté serveur — à ajouter au reverse proxy.',
			verdict: 'keep',
			decision: 'GARDER. Standard de facto en 2025-26, conforme à nos contraintes.'
		},
		{
			tech: 'LangGraph',
			emoji: '🦜',
			role: 'Orchestration d\'agents stateful',
			strengths: 'Notion d\'état explicite + checkpointer = audit trail naturel. Conditional edges = règles métier lisibles. Multi-agent supervisor mature. Compatible OpenAI-like API (donc vLLM).',
			weaknesses: 'Version 0.x, breaking changes encore réguliers. Python-only. Couplé à l\'écosystème LangChain (poids historique). Documentation parfois en retard sur le code.',
			verdict: 'keep',
			decision: 'GARDER, mais épingler une version (lockfile + cosign) et tester les upgrades en CI avant promotion.'
		},
		{
			tech: 'Milvus',
			emoji: '🗄️',
			role: 'Vector database',
			strengths: 'Très scalable (milliards de vecteurs), filtrage par payload natif, IVF/HNSW/DiskANN, multi-tenant.',
			weaknesses: 'Lourd à opérer en air-gap : etcd + Pulsar/Kafka + S3-compatible. ~3-4 services à déployer + monitorer. Surdimensionné si on a < 50M de vecteurs.',
			verdict: 'replace',
			decision: 'REMPLACER par Qdrant. 1 binaire Rust, payload filter natif, perf similaire jusqu\'à 100M de vecteurs. On garde Milvus en option pour V3 si on dépasse.'
		},
		{
			tech: 'MCP',
			emoji: '🔌',
			role: 'Standard d\'exposition de tools',
			strengths: 'Standard naissant Anthropic. Découplage agent/outils. Bibliothèque croissante de serveurs MCP open-source.',
			weaknesses: '⚠️ Standard de 2024, encore en mouvement. Sécurité (auth, sandboxing) en construction. Stdio transport peu adapté au K8s air-gap.',
			verdict: 'caution',
			decision: 'À UTILISER AVEC PARCIMONIE. En V1 : tools en direct via @tool LangGraph (plus simple à auditer). Réintroduire MCP en V2 quand on en aura besoin pour exposer des tools partagés entre agents.'
		},
		{
			tech: 'RAG (Milvus → Qdrant + BGE-m3 + HNSW)',
			emoji: '📚',
			role: 'Recherche documentaire vectorielle',
			strengths: 'Pattern bien compris, fonctionne très bien sur la plupart des use cases métiers. Filtrage par habilitation au niveau payload = sécurité au niveau du store, pas du LLM.',
			weaknesses: 'Embeddings sensibles à la qualité du chunking. Reranking nécessaire pour les questions complexes (BGE-reranker ou Cohere local-friendly). Pas magique : si les docs sont mal écrits, le RAG ne sauvera pas.',
			verdict: 'keep',
			decision: 'GARDER comme socle. Ajouter reranker en V2 quand on aura mesuré la qualité.'
		},
		{
			tech: 'GraphRAG (Microsoft)',
			emoji: '🕸️',
			role: 'RAG sur graphe de connaissances',
			strengths: 'Excellent pour les questions « connect-the-dots » qui demandent de croiser plusieurs documents. Community summaries permettent du global Q&A.',
			weaknesses: '⚠️ Très coûteux en compute à l\'indexation (1k$ pour 1M tokens chez OpenAI public, équivalent ~100h GPU local). Qualité des communautés Leiden variable selon le corpus. Difficile à mettre à jour incrémentalement.',
			verdict: 'caution',
			decision: 'PAS EN V1. Réévaluer en V3 sur un sous-corpus spécifique (ex: retours d\'expérience opérationnels). Trop d\'overhead pour démarrer.'
		},
		{
			tech: 'Unsloth',
			emoji: '🦥',
			role: 'Fine-tuning LoRA/QLoRA optimisé',
			strengths: 'Apache 2.0, 2× plus rapide que HF Trainer + 50% moins de VRAM. UI Studio simple. Parfait pour notre RTX 5000.',
			weaknesses: 'Linux-only. Single-GPU principalement (multi-GPU via Pro $$ ou DeepSpeed manuel). Optimisations fragiles aux nouvelles versions de transformers.',
			verdict: 'keep',
			decision: 'GARDER pour la phase fine-tuning. Pinner versions + valider chaque upgrade.'
		},
		{
			tech: 'Langfuse',
			emoji: '🔭',
			role: 'Observabilité LLM (traces, eval, datasets)',
			strengths: 'Apache 2.0 self-hostable, UI excellente, dataset/eval workflow intégré. Standard ouvert OpenTelemetry-compatible.',
			weaknesses: 'Dépend de ClickHouse + PostgreSQL → 2 bases à opérer. UI demande maj régulières. Onglet eval encore en évolution.',
			verdict: 'keep',
			decision: 'GARDER. ClickHouse est une charge OPS acceptable au regard du gain observabilité.'
		},
		{
			tech: 'RAGAS',
			emoji: '🧪',
			role: 'Évaluation automatique de RAG',
			strengths: 'Métriques standard (faithfulness, answer_relevancy, context_precision/recall). Reproductible en CI.',
			weaknesses: '⚠️ LLM-as-judge → biais du juge. Coûteux si on lance sur l\'ensemble du corpus. Pas suffisant : doit être complété par une eval humaine (au moins 50 exemples annotés).',
			verdict: 'caution',
			decision: 'GARDER mais en complément, pas en remplacement, d\'une eval humaine. Lancer en CI mais ne pas bloquer le déploiement sur le seul score automatique.'
		},
		{
			tech: 'LiteLLM',
			emoji: '🚦',
			role: 'Gateway / proxy LLM unifié',
			strengths: 'Une seule API pour 100+ providers. Routing, fallback, rate-limit, cost tracking centralisés.',
			weaknesses: 'En air-gap, on n\'a qu\'un seul provider (vLLM interne). Le ROI de LiteLLM est faible. Sauf si on prévoit plusieurs modèles internes (Mistral + Llama + reranker).',
			verdict: 'caution',
			decision: 'METTRE EN V2 quand on aura ≥ 3 modèles servis. En V1 : appel direct à vLLM via openai SDK.'
		}
	];

	const VERDICT_LABEL: Record<Verdict, { label: string; color: string; emoji: string }> = {
		keep: { label: 'Garder', color: '#22c55e', emoji: '✅' },
		replace: { label: 'Remplacer', color: '#f59e0b', emoji: '🔄' },
		caution: { label: 'Avec prudence', color: '#fb923c', emoji: '⚠️' },
		drop: { label: 'Écarter', color: '#dc2626', emoji: '❌' }
	};

	// Active filter on critique table
	let verdictFilter = $state<Verdict | 'all'>('all');
	const filteredTech = $derived(
		verdictFilter === 'all' ? TECH_CRITIQUE : TECH_CRITIQUE.filter((t) => t.verdict === verdictFilter)
	);

	// Active use case tab
	let activeCase = $state<'documentaire' | 'soc' | 'cr-mission'>('documentaire');
</script>

<svelte:head>
	<title>Projet souverain — architecture défense air-gap</title>
</svelte:head>

<article class="proj">
	<!-- ============== HÉROS ============== -->
	<header class="proj-hero">
		<span class="proj-hero-emoji">🛰️</span>
		<h1 class="proj-h1">Projet souverain — du concept au déploiement air-gap</h1>
		<p class="proj-hero-lead">
			On a parcouru 11 papiers et 11 technos. <strong>Temps de prendre du
			recul</strong>. Cette page fait deux choses : (1) un <strong>regard
			critique</strong> sur ce qu'on a vu, parce que toutes les technos ne
			sont pas pertinentes à toutes les phases ; (2) une <strong>architecture
			complète d'un projet jouet</strong> — le COAS (Centre Opérationnel
			d'Agents Souverains) — qui héberge 3 agents IA dans un contexte
			<strong>défense + cyber + air-gap</strong>. Implémentable en 3 sprints
			par une équipe de 2-3 personnes.
		</p>
		<div class="proj-hero-meta">
			<span class="proj-hero-tag">📚 Synthèse</span>
			<span class="proj-hero-tag">🏗️ Architecture</span>
			<span class="proj-hero-tag">🛡️ Air-gap</span>
			<span class="proj-hero-tag">🔐 Cyber</span>
		</div>
	</header>

	<!-- ============== TOC ============== -->
	<nav class="proj-toc" aria-label="Table des matières">
		<p class="proj-toc-label">📍 Parcours en 7 étapes</p>
		<ol class="proj-toc-list">
			<li><a href="#contexte">0. Contexte et contraintes</a></li>
			<li><a href="#critique">1. Regard critique sur les technos ⭐</a></li>
			<li><a href="#stack">2. Stack proposée (à approuver)</a></li>
			<li><a href="#architecture">3. Architecture air-gap</a></li>
			<li><a href="#cas-usage">4. 3 cas d'usage concrets ⭐</a></li>
			<li><a href="#roadmap">5. Roadmap d'implémentation</a></li>
			<li><a href="#risques">6. Risques + mitigations</a></li>
		</ol>
	</nav>

	<!-- ============== 0. CONTEXTE ============== -->
	<section id="contexte" class="proj-section">
		<h2 class="proj-h2">0️⃣ Contexte et contraintes</h2>

		<p class="proj-lead">
			Le projet vit dans un environnement où la majorité des arbitrages
			techniques sont déjà tranchés par <strong>la nature des données</strong>
			et <strong>le cadre réglementaire</strong>. Avant de débattre des
			technos, il faut savoir ce qu'on n'a PAS le droit de faire.
		</p>

		<div class="proj-constraints">
			<div class="proj-constraint">
				<div class="proj-constraint-icon">🛡️</div>
				<h3>Niveau de classification</h3>
				<p>
					Données jusqu'à <strong>SD (Secret Défense)</strong>. Au-delà,
					on sort du périmètre IA assistée. Cinq niveaux à gérer (NP/DR/CD/SD/TSD).
					Chaque doc, chaque user, chaque programme a un niveau.
				</p>
			</div>
			<div class="proj-constraint">
				<div class="proj-constraint-icon">🚫</div>
				<h3>Air-gap strict</h3>
				<p>
					<strong>Zéro</strong> connexion sortante depuis le SI sensible.
					Tout (modèles, images Docker, paquets pip/npm) doit être
					téléchargé sur un poste « passerelle » puis transféré par un
					sas physique (clé USB whitelistée, diode de données).
				</p>
			</div>
			<div class="proj-constraint">
				<div class="proj-constraint-icon">📋</div>
				<h3>Auditabilité ANSSI</h3>
				<p>
					Tout doit être <strong>signé, daté, conservé 5 ans</strong>. Qui
					a posé quelle question, qui a obtenu quelle réponse, sur quels
					documents, à quelle heure. Crypto à jour (Ed25519, BLAKE3).
				</p>
			</div>
			<div class="proj-constraint">
				<div class="proj-constraint-icon">⚙️</div>
				<h3>Hardware contraint</h3>
				<p>
					En lab : <strong>RTX 5000 Ada 32 Go</strong> (sur VM Unsloth
					Studio) et <strong>GTX 1070 4 Go</strong> (laptop). En cible
					prod : 2-4× A100 40 Go ou H100 80 Go sur infra interne.
				</p>
			</div>
			<div class="proj-constraint">
				<div class="proj-constraint-icon">🔐</div>
				<h3>Cyber natif</h3>
				<p>
					mTLS partout, SBOM signés cosign, NetworkPolicy deny-all par
					défaut, secrets dans Vault, AppArmor + seccomp sur tous les pods.
					Pas optionnel : c'est le coût d'entrée.
				</p>
			</div>
			<div class="proj-constraint">
				<div class="proj-constraint-icon">👥</div>
				<h3>Équipe et budget</h3>
				<p>
					Petite équipe (2-3 ingénieurs). Pas de licence à 100 k€/an.
					Préférence stricte pour Apache 2.0, MIT, BSD. Tout commercial =
					justification + approbation RSSI.
				</p>
			</div>
		</div>
	</section>

	<!-- ============== 1. CRITIQUE ============== -->
	<section id="critique" class="proj-section">
		<h2 class="proj-h2">1️⃣ Regard critique sur les technos vues ⭐</h2>
		<p class="proj-lead">
			Pas toutes les technos qu'on a étudiées sont à mettre en V1. Voici un
			arbitrage explicite : <strong>garder</strong>, <strong>remplacer</strong>,
			<strong>avec prudence</strong>, ou <strong>écarter</strong> — avec la
			décision argumentée pour chacune.
		</p>

		<!-- Filter buttons -->
		<div class="proj-filters">
			<button
				type="button"
				class="proj-filter {verdictFilter === 'all' ? 'is-active' : ''}"
				onclick={() => (verdictFilter = 'all')}
			>
				Tout ({TECH_CRITIQUE.length})
			</button>
			{#each Object.entries(VERDICT_LABEL) as [v, meta] (v)}
				{@const count = TECH_CRITIQUE.filter((t) => t.verdict === v).length}
				<button
					type="button"
					class="proj-filter {verdictFilter === v ? 'is-active' : ''}"
					onclick={() => (verdictFilter = v as Verdict)}
					style="--filter-color: {meta.color}"
				>
					{meta.emoji} {meta.label} ({count})
				</button>
			{/each}
		</div>

		<div class="proj-tech-list">
			{#each filteredTech as t (t.tech)}
				{@const verdict = VERDICT_LABEL[t.verdict]}
				<div class="proj-tech" style="--verdict-color: {verdict.color}">
					<div class="proj-tech-head">
						<span class="proj-tech-emoji">{t.emoji}</span>
						<div class="proj-tech-name">
							<h3>{t.tech}</h3>
							<p>{t.role}</p>
						</div>
						<div class="proj-tech-verdict">
							<span class="proj-tech-verdict-emoji">{verdict.emoji}</span>
							{verdict.label}
						</div>
					</div>
					<div class="proj-tech-body">
						<div class="proj-tech-col proj-tech-col-pro">
							<div class="proj-tech-col-label">✅ Forces</div>
							<p>{t.strengths}</p>
						</div>
						<div class="proj-tech-col proj-tech-col-con">
							<div class="proj-tech-col-label">⚠️ Faiblesses dans NOTRE contexte</div>
							<p>{t.weaknesses}</p>
						</div>
					</div>
					<div class="proj-tech-decision">
						<strong>Décision :</strong> {t.decision}
					</div>
				</div>
			{/each}
		</div>

		<Callout variant="insight" title="🎯 Synthèse de l'arbitrage">
			<ul>
				<li>
					<strong>3 technos « garder »</strong> en V1 sans hésitation :
					vLLM, LangGraph, Unsloth. Ce sont les piliers.
				</li>
				<li>
					<strong>2 technos « remplacer »</strong> : Milvus → Qdrant
					(simplification ops air-gap), API LLM → vLLM (contrainte
					air-gap).
				</li>
				<li>
					<strong>4 technos « avec prudence »</strong> : MCP (immature),
					GraphRAG (coûteux), RAGAS (biais juge), LiteLLM (ROI faible
					initialement). Toutes sont à réintroduire en V2/V3 selon les
					besoins.
				</li>
				<li>
					<strong>0 techno « écartée »</strong> : on n'a rien étudié
					d'inutile, mais on n'utilise pas tout en V1. La discipline est
					là.
				</li>
			</ul>
		</Callout>

		<Callout variant="warning" title="❓ Points qu'on n'a pas (encore) couverts et qui manquent">
			<ul>
				<li>
					<strong>Reranker</strong> (BGE-reranker-large ou Cohere local).
					Sans lui, RAG à top-K=20 contient ~60 % de bruit. Indispensable
					en V2.
				</li>
				<li>
					<strong>Guardrails</strong> (NVIDIA NeMo Guardrails, LlamaGuard
					ou règles maison). Pour bloquer prompt injection, sortie hors
					classification, exfiltration. <strong>Obligatoire en défense</strong>.
				</li>
				<li>
					<strong>Évaluation humaine structurée</strong> (label studio,
					argilla). RAGAS ne suffit pas en V1, il faut au moins 100
					exemples annotés humainement.
				</li>
				<li>
					<strong>Tests d'attaque rouge</strong> (red team prompts) avant
					mise en prod. À automatiser dans la CI.
				</li>
				<li>
					<strong>Modèle de menace formel</strong> (STRIDE, LINDDUN) sur
					l'agent — pas vu mais critique avant audit ANSSI.
				</li>
			</ul>
		</Callout>
	</section>

	<!-- ============== 2. STACK PROPOSÉE ============== -->
	<section id="stack" class="proj-section">
		<h2 class="proj-h2">2️⃣ Stack proposée (V1, sujette à approbation)</h2>
		<p class="proj-lead">
			Voici la stack que je propose pour la V1, avec pour chaque couche le
			choix et l'alternative envisagée. Toute case « ❌ rejeté » a une
			justification cyber ou opérationnelle, pas un préjugé.
		</p>

		<div class="proj-stack">
			<div class="proj-stack-layer proj-stack-layer-7">
				<div class="proj-stack-layer-label">7. Présentation</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">SvelteKit + Tailwind</span>
					<span class="proj-stack-reject">❌ React/Next.js (lourd, sur-ingénierie pour notre besoin)</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-6">
				<div class="proj-stack-layer-label">6. API gateway</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">FastAPI + JWT + mTLS</span>
					<span class="proj-stack-reject">❌ Kong/Tyk (overkill pour 3 agents)</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-5">
				<div class="proj-stack-layer-label">5. Orchestration agents</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">LangGraph (StateGraph + checkpointer Postgres)</span>
					<span class="proj-stack-reject">⚠️ CrewAI (moins audit-friendly), DSPy (moins prod-ready)</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-4">
				<div class="proj-stack-layer-label">4. Tools (V1 : direct, V2 : MCP)</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">@tool LangGraph en V1 → MCP servers internes en V2</span>
					<span class="proj-stack-reject">❌ MCP en V1 : trop jeune pour audit</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-3">
				<div class="proj-stack-layer-label">3. Inference</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">vLLM (Mistral 7B fp16, Llama 70B AWQ 4-bit)</span>
					<span class="proj-stack-reject">❌ TensorRT-LLM (lock-in), Ollama (pas prod-grade)</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-2">
				<div class="proj-stack-layer-label">2. Mémoires</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">Qdrant (RAG) + PostgreSQL (state + audit) + Redis (cache)</span>
					<span class="proj-stack-reject">❌ Milvus (overkill), Chroma (pas prod-grade)</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-1">
				<div class="proj-stack-layer-label">1. Infra</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">K8s on-prem + Cilium (CNI) + Cert-Manager + Vault + Harbor</span>
					<span class="proj-stack-reject">❌ Docker Compose (pas HA), OpenShift (lourd)</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-obs">
				<div class="proj-stack-layer-label">📡 Observabilité (transverse)</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">Langfuse (traces LLM) + Loki/Promtail (logs) + Prometheus/Grafana (metrics)</span>
					<span class="proj-stack-reject">❌ Datadog/Splunk (SaaS), LangSmith (SaaS)</span>
				</div>
			</div>
			<div class="proj-stack-layer proj-stack-layer-sec">
				<div class="proj-stack-layer-label">🔐 Sécurité (transverse)</div>
				<div class="proj-stack-layer-content">
					<span class="proj-stack-pick">Cosign (signature images), Trivy (scan CVE), Falco (runtime), AppArmor</span>
					<span class="proj-stack-reject">❌ Tetragon (jeune), Aqua (commercial)</span>
				</div>
			</div>
		</div>

		<Callout variant="info" title="🎯 Critère commun derrière tous ces choix">
			<p>
				Trois critères ordonnés : (1) <strong>Open-source compatible
				air-gap</strong>, (2) <strong>Auditabilité</strong> (sources lisibles,
				comportement déterministe), (3) <strong>Coût opérationnel</strong>
				(qu'une équipe de 3 personnes peut maintenir). Aucun « cool factor »
				n'a guidé les choix.
			</p>
		</Callout>
	</section>

	<!-- ============== 3. ARCHITECTURE ============== -->
	<section id="architecture" class="proj-section">
		<h2 class="proj-h2">3️⃣ Architecture air-gap — vue d'ensemble</h2>
		<p class="proj-lead">
			Voici comment les pièces s'assemblent. Le diagramme montre <strong>3 zones
			de réseau distinctes</strong> séparées par des contrôles de flux
			stricts. Le point critique à comprendre : tout entre par le « sas »
			et rien n'en sort.
		</p>

		<!-- Diagram SVG -->
		<div class="proj-archi">
			<svg viewBox="0 0 1080 580" class="proj-archi-svg">
				<defs>
					<marker id="proj-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
					<marker id="proj-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
					</marker>
				</defs>

				<!-- Zone EXTÉRIEURE (rouge, internet) -->
				<rect x="20" y="30" width="180" height="520" rx="14" fill="#fee2e2" stroke="#dc2626" stroke-width="2" stroke-dasharray="8 4" />
				<text x="110" y="60" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#7f1d1d">EXTÉRIEUR</text>
				<text x="110" y="76" text-anchor="middle" font-family="monospace" font-size="9" fill="#7f1d1d">internet, registries</text>
				<text x="110" y="92" text-anchor="middle" font-family="monospace" font-size="9" fill="#7f1d1d">HuggingFace, GitHub</text>

				<rect x="40" y="120" width="140" height="50" rx="8" fill="#fff" stroke="#dc2626" />
				<text x="110" y="142" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">📦 HF Hub</text>
				<text x="110" y="158" text-anchor="middle" font-family="monospace" font-size="9" fill="#7f1d1d">modèles, datasets</text>

				<rect x="40" y="200" width="140" height="50" rx="8" fill="#fff" stroke="#dc2626" />
				<text x="110" y="222" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">📦 Docker registry</text>
				<text x="110" y="238" text-anchor="middle" font-family="monospace" font-size="9" fill="#7f1d1d">images publiques</text>

				<rect x="40" y="280" width="140" height="50" rx="8" fill="#fff" stroke="#dc2626" />
				<text x="110" y="302" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">📦 PyPI / npm</text>
				<text x="110" y="318" text-anchor="middle" font-family="monospace" font-size="9" fill="#7f1d1d">paquets logiciels</text>

				<!-- SAS -->
				<rect x="230" y="30" width="160" height="520" rx="14" fill="#fef3c7" stroke="#f59e0b" stroke-width="2" />
				<text x="310" y="60" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#92400e">SAS</text>
				<text x="310" y="76" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400e">zone d'échange</text>

				<rect x="250" y="120" width="120" height="50" rx="8" fill="#fff" stroke="#f59e0b" />
				<text x="310" y="142" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">💻 Poste relais</text>
				<text x="310" y="158" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400e">download internet</text>

				<rect x="250" y="200" width="120" height="50" rx="8" fill="#fff" stroke="#f59e0b" />
				<text x="310" y="220" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">🔒 Scanner</text>
				<text x="310" y="234" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400e">Trivy + ClamAV</text>
				<text x="310" y="246" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400e">+ cosign sign</text>

				<rect x="250" y="280" width="120" height="50" rx="8" fill="#fff" stroke="#f59e0b" />
				<text x="310" y="302" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">💾 USB whitelist</text>
				<text x="310" y="318" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400e">ou data diode</text>

				<!-- Zone CLASSIFIÉE -->
				<rect x="420" y="30" width="640" height="520" rx="14" fill="#dcfce7" stroke="#16a34a" stroke-width="3" />
				<text x="740" y="60" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#14532d">ZONE CLASSIFIÉE — air-gap</text>
				<text x="740" y="76" text-anchor="middle" font-family="monospace" font-size="9" fill="#14532d">K8s on-prem, deny-all by default</text>

				<!-- Harbor mirror -->
				<rect x="440" y="100" width="140" height="40" rx="6" fill="#fff" stroke="#16a34a" />
				<text x="510" y="118" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">🏭 Harbor mirror</text>
				<text x="510" y="132" text-anchor="middle" font-family="monospace" font-size="8" fill="#14532d">images signées cosign</text>

				<!-- Model registry -->
				<rect x="600" y="100" width="140" height="40" rx="6" fill="#fff" stroke="#16a34a" />
				<text x="670" y="118" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">📚 Model registry</text>
				<text x="670" y="132" text-anchor="middle" font-family="monospace" font-size="8" fill="#14532d">PVC + hash BLAKE3</text>

				<!-- Internal mirror -->
				<rect x="760" y="100" width="140" height="40" rx="6" fill="#fff" stroke="#16a34a" />
				<text x="830" y="118" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">🔧 PyPI mirror</text>
				<text x="830" y="132" text-anchor="middle" font-family="monospace" font-size="8" fill="#14532d">devpi / verdaccio</text>

				<!-- Inference layer -->
				<rect x="440" y="170" width="280" height="80" rx="8" fill="#fef3c7" stroke="#fb923c" stroke-width="2" />
				<text x="580" y="190" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#7c2d12">🚀 Inference (vLLM)</text>
				<text x="580" y="208" text-anchor="middle" font-family="monospace" font-size="9" fill="#7c2d12">Mistral 7B fp16 — 2 répliques</text>
				<text x="580" y="222" text-anchor="middle" font-family="monospace" font-size="9" fill="#7c2d12">Llama 70B AWQ — 1 réplique TP=4</text>
				<text x="580" y="236" text-anchor="middle" font-family="monospace" font-size="9" fill="#7c2d12">PagedAttention + prefix caching</text>

				<!-- Memory layer -->
				<rect x="740" y="170" width="300" height="80" rx="8" fill="#e0f2fe" stroke="#06b6d4" stroke-width="2" />
				<text x="890" y="190" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#075985">🧠 Mémoires</text>
				<text x="890" y="208" text-anchor="middle" font-family="monospace" font-size="9" fill="#075985">Qdrant (RAG) — 1M vecteurs BGE-m3</text>
				<text x="890" y="222" text-anchor="middle" font-family="monospace" font-size="9" fill="#075985">PostgreSQL (state agents + audit)</text>
				<text x="890" y="236" text-anchor="middle" font-family="monospace" font-size="9" fill="#075985">Redis (cache embeddings)</text>

				<!-- Agents layer -->
				<rect x="440" y="280" width="600" height="100" rx="8" fill="#ede9fe" stroke="#a855f7" stroke-width="2" />
				<text x="740" y="300" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#581c87">🦜 Agents LangGraph</text>
				<rect x="460" y="315" width="180" height="55" rx="6" fill="#fff" stroke="#a855f7" />
				<text x="550" y="332" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">📚 Doc défense</text>
				<text x="550" y="348" text-anchor="middle" font-family="monospace" font-size="8" fill="#581c87">RAG + clearance</text>
				<text x="550" y="362" text-anchor="middle" font-family="monospace" font-size="8" fill="#581c87">5 tools séquentiels</text>

				<rect x="650" y="315" width="180" height="55" rx="6" fill="#fff" stroke="#a855f7" />
				<text x="740" y="332" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">🛡️ Triage SOC</text>
				<text x="740" y="348" text-anchor="middle" font-family="monospace" font-size="8" fill="#581c87">SIEM + CTI + baseline</text>
				<text x="740" y="362" text-anchor="middle" font-family="monospace" font-size="8" fill="#581c87">classifie + escalade</text>

				<rect x="840" y="315" width="180" height="55" rx="6" fill="#fff" stroke="#a855f7" />
				<text x="930" y="332" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700">✍️ CR mission</text>
				<text x="930" y="348" text-anchor="middle" font-family="monospace" font-size="8" fill="#581c87">multi-agent supervisor</text>
				<text x="930" y="362" text-anchor="middle" font-family="monospace" font-size="8" fill="#581c87">structurer/writer/reviewer</text>

				<!-- Observability -->
				<rect x="440" y="400" width="600" height="60" rx="8" fill="#fef3c7" stroke="#eab308" stroke-width="2" />
				<text x="740" y="420" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#713f12">🔭 Observabilité air-gap</text>
				<text x="740" y="436" text-anchor="middle" font-family="monospace" font-size="9" fill="#713f12">Langfuse (traces LLM) — Prometheus/Grafana (métriques) — Loki (logs)</text>
				<text x="740" y="452" text-anchor="middle" font-family="monospace" font-size="9" fill="#713f12">Audit trail Ed25519 + RAGAS en CI (10 % du trafic)</text>

				<!-- API gateway / users -->
				<rect x="440" y="480" width="600" height="60" rx="8" fill="#fee2e2" stroke="#dc2626" stroke-width="2" />
				<text x="740" y="500" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#7f1d1d">🚪 API Gateway (FastAPI + JWT + mTLS) + WAF + Auth (LDAP/OIDC interne)</text>
				<text x="740" y="516" text-anchor="middle" font-family="monospace" font-size="9" fill="#7f1d1d">Vérifie habilitation user · injecte clearance dans state · rate-limit · log toutes les requêtes</text>
				<text x="740" y="532" text-anchor="middle" font-family="monospace" font-size="9" fill="#7f1d1d">👤 Users habilités — accès via VDI interne uniquement</text>

				<!-- Arrows -->
				<line x1="180" y1="145" x2="248" y2="145" stroke="#dc2626" stroke-width="2" marker-end="url(#proj-arrow-red)" />
				<line x1="180" y1="225" x2="248" y2="225" stroke="#dc2626" stroke-width="2" marker-end="url(#proj-arrow-red)" />
				<line x1="180" y1="305" x2="248" y2="305" stroke="#dc2626" stroke-width="2" marker-end="url(#proj-arrow-red)" />

				<line x1="370" y1="145" x2="438" y2="120" stroke="#16a34a" stroke-width="2" marker-end="url(#proj-arrow)" />
				<line x1="370" y1="225" x2="438" y2="120" stroke="#16a34a" stroke-width="2" marker-end="url(#proj-arrow)" />
				<line x1="370" y1="305" x2="758" y2="120" stroke="#16a34a" stroke-width="2" marker-end="url(#proj-arrow)" />
			</svg>
		</div>

		<Callout variant="warning" title="🔐 Le sas n'est pas une optionalité">
			<p>
				Beaucoup de tutos « comment air-gap » oublient le sas. C'est
				pourtant le <strong>seul point d'entrée légitime</strong> de la
				zone classifiée. Tout ce qui rentre :
			</p>
			<ol>
				<li>Est téléchargé sur un poste relais (zone DMZ-like).</li>
				<li>Passe au scanner (Trivy pour les images, ClamAV pour les fichiers, hash BLAKE3 vérifié contre la source amont).</li>
				<li>Est <strong>signé cosign avec une clé interne</strong> (pas la clé HF Hub !).</li>
				<li>Traverse physiquement (USB chiffrée whitelistée ou diode de données — flux unidirectionnel).</li>
				<li>Atterrit dans Harbor / Model registry de la zone classifiée.</li>
			</ol>
			<p>
				Dans la zone classifiée, <strong>aucun pod ne peut pull depuis
				registry.docker.io ou pypi.org</strong>. NetworkPolicy explicite.
				Si on a besoin d'un nouveau paquet, c'est une nouvelle traversée
				de sas — pas un <code>pip install</code> spontané.
			</p>
		</Callout>
	</section>

	<!-- ============== 4. CAS D'USAGE ============== -->
	<section id="cas-usage" class="proj-section">
		<h2 class="proj-h2">4️⃣ Trois cas d'usage concrets ⭐</h2>
		<p class="proj-lead">
			Trois agents qui partagent la même infra (vLLM, Qdrant, Langfuse, etc.)
			mais répondent à des besoins métiers différents. Bascule entre les
			onglets pour voir chaque cas en détail.
		</p>

		<!-- Use case tabs -->
		<div class="proj-cases-tabs">
			<button
				type="button"
				class="proj-case-tab {activeCase === 'documentaire' ? 'is-active' : ''}"
				onclick={() => (activeCase = 'documentaire')}
			>
				<span>📚</span>
				<div>
					<strong>Agent documentaire défense</strong>
					<small>RAG souverain + contrôle d'accès</small>
				</div>
			</button>
			<button
				type="button"
				class="proj-case-tab {activeCase === 'soc' ? 'is-active' : ''}"
				onclick={() => (activeCase = 'soc')}
			>
				<span>🛡️</span>
				<div>
					<strong>Agent triage SOC cyber</strong>
					<small>Qualification d'alertes SIEM automatique</small>
				</div>
			</button>
			<button
				type="button"
				class="proj-case-tab {activeCase === 'cr-mission' ? 'is-active' : ''}"
				onclick={() => (activeCase = 'cr-mission')}
			>
				<span>✍️</span>
				<div>
					<strong>Agent CR mission</strong>
					<small>Rédaction multi-agent format ANSSI</small>
				</div>
			</button>
		</div>

		<!-- ===================================================== -->
		<!-- CAS 1 : AGENT DOCUMENTAIRE -->
		<!-- ===================================================== -->
		{#if activeCase === 'documentaire'}
			<div class="proj-case">
				<h3 class="proj-h3">📚 Cas 1 — Agent documentaire défense</h3>
				<p class="proj-case-pitch">
					<strong>Problème métier :</strong> 50 officiers habilités CD/SD
					doivent interroger 50 000 documents internes (rapports
					d'expertise, RETEX, fiches programme) avec un contrôle d'accès
					strict par habilitation. Aujourd'hui : recherche full-text
					basique qui rate les paraphrases. Demain : un agent RAG qui
					comprend les questions et filtre par habilitation au niveau
					du store vectoriel.
				</p>

				<DifficultyTabs
					id="case1-explain"
					title="Comment ça fonctionne"
					tagline="Du POST de la question au résultat signé"
				>
					{#snippet intuitive()}
						<p>
							L'officier pose une question en langage naturel. L'agent
							va chercher les 5-10 documents les plus pertinents — mais
							SEULEMENT ceux que l'officier a le droit de lire. Puis
							il rédige une réponse en citant les sources. Tout est
							signé et tracé pour l'audit.
						</p>
					{/snippet}
					{#snippet friend()}
						<ol>
							<li>L'officier s'authentifie (Smartcard + OIDC interne).</li>
							<li>Sa requête passe à l'API gateway qui injecte son <code>user_clearance</code> dans le state LangGraph.</li>
							<li>L'agent embed la question (BGE-m3), interroge Qdrant <strong>avec un filtre payload <code>doc_classification ≤ user_clearance</code></strong>.</li>
							<li>Top-K=20 récupéré, reranker BGE-reranker garde top-5.</li>
							<li>Le LLM rédige la réponse en citant les chunks avec leur source.</li>
							<li>Sortie signée Ed25519 et persistée dans audit_log.</li>
						</ol>
					{/snippet}
					{#snippet practical()}
						<pre class="proj-code"><code>{`# agent_doc.py
from langgraph.graph import StateGraph, END
from langchain_core.tools import tool
from qdrant_client import QdrantClient

@tool
def search_docs(query: str, user_clearance: str) -> list[dict]:
    """Recherche RAG avec filtre habilitation."""
    embedding = bge_m3.encode(query)
    # ⚠️ POINT CRITIQUE : le filtre est appliqué AU NIVEAU du store,
    # pas du LLM. Aucun doc supérieur ne peut atteindre le LLM.
    results = qdrant.search(
        collection_name="docs_classified",
        query_vector=embedding,
        query_filter={
            "must": [
                {"key": "classification", "match": {"in": clearance_chain(user_clearance)}}
            ]
        },
        limit=20,
    )
    # Reranker pour précision
    reranked = bge_reranker.rerank(query, [r.payload for r in results], top_k=5)
    return reranked

def clearance_chain(level: str) -> list[str]:
    """NP < DR < CD < SD < TSD : un SD peut lire jusqu'à SD."""
    levels = ["NP", "DR", "CD", "SD", "TSD"]
    return levels[:levels.index(level) + 1]

# State + Graph
class State(TypedDict):
    messages: Annotated[list, operator.add]
    user_clearance: str
    sources: list
    answer: str
    signature: str

def retrieve(state):
    last_q = state["messages"][-1].content
    docs = search_docs.invoke({"query": last_q, "user_clearance": state["user_clearance"]})
    return {"sources": docs}

def generate(state):
    context = "\\n\\n".join(f"[{d['source']}] {d['text']}" for d in state["sources"])
    response = mistral.invoke([
        SystemMessage("Réponds en citant les sources [N]. Niveau classification : "
                      f"{state['user_clearance']}. Si tu ne sais pas, dis-le."),
        *state["messages"],
        SystemMessage(f"Contexte :\\n{context}"),
    ])
    sig = sign_response(response.content, state["user_clearance"], state["sources"])
    return {"answer": response.content, "signature": sig}

g = StateGraph(State)
g.add_node("retrieve", retrieve)
g.add_node("generate", generate)
g.set_entry_point("retrieve")
g.add_edge("retrieve", "generate")
g.add_edge("generate", END)
app = g.compile(checkpointer=PostgresSaver(...))`}</code></pre>
					{/snippet}
					{#snippet deep()}
						<p><strong>Points d'attention production :</strong></p>
						<ul>
							<li>
								<strong>Habilitation : filtre store, pas LLM</strong>. Si on
								filtre côté LLM (« ignore les docs SD »), un prompt injection
								peut contourner. Côté store : impossible.
							</li>
							<li>
								<strong>Prefix caching</strong> activé sur vLLM. Le system
								prompt « tu es l'agent défense » (≈ 500 tokens) est partagé
								entre toutes les requêtes → 30 % de latence en moins.
							</li>
							<li>
								<strong>Reranker</strong> obligatoire au-delà de top-K=10.
								BGE-reranker-large tient sur 4 Go VRAM (peut tourner sur la
								1070 du laptop dev).
							</li>
							<li>
								<strong>Signature Ed25519</strong> sur (réponse + hashs des sources + user_id + timestamp). Vérifiable a posteriori sans avoir besoin du LLM.
							</li>
							<li>
								<strong>Garde-fou hallucination</strong> : si la confiance
								moyenne des chunks reranked est &lt; 0,5, on répond « pas
								assez d'info dans le corpus » au lieu d'inventer.
							</li>
						</ul>
					{/snippet}
				</DifficultyTabs>

				<Callout variant="info" title="🎯 KPIs cibles V1">
					<ul>
						<li><strong>Latence p95</strong> : &lt; 4 s (Mistral 7B fp16 sur RTX 5000)</li>
						<li><strong>Faithfulness RAGAS</strong> : &gt; 0,85</li>
						<li><strong>0 fuite</strong> de doc supérieur à l'habilitation user (testé par red team prompts)</li>
						<li><strong>100 % audit trail</strong> signé Ed25519 sur 12 mois rolling</li>
					</ul>
				</Callout>
			</div>
		{/if}

		<!-- ===================================================== -->
		<!-- CAS 2 : TRIAGE SOC -->
		<!-- ===================================================== -->
		{#if activeCase === 'soc'}
			<div class="proj-case">
				<h3 class="proj-h3">🛡️ Cas 2 — Agent triage SOC cyber</h3>
				<p class="proj-case-pitch">
					<strong>Problème métier :</strong> Le SOC reçoit 2 000 alertes
					SIEM par jour, 95 % sont des faux positifs. Le L1 passe ses
					journées à enquêter manuellement. Cible : <strong>agent qui
					qualifie l'alerte (FP / vraie / à investiguer) et propose une
					action</strong> en s'appuyant sur la threat intel interne, le
					contexte de l'utilisateur, et la baseline comportementale du
					host.
				</p>

				<DifficultyTabs
					id="case2-explain"
					title="Comment ça fonctionne"
					tagline="De l'alerte SIEM à la décision tracée"
				>
					{#snippet intuitive()}
						<p>
							Une alerte arrive du SIEM (Splunk/Elastic interne).
							L'agent enquête comme le ferait un analyste L1 : il
							vérifie les IOC dans la threat intel, regarde l'historique
							du compte concerné, demande si c'est un comportement
							habituel pour ce host. Puis il classe : faux positif,
							vraie attaque, ou à investiguer. Et si c'est sérieux,
							il escalade vers le L2.
						</p>
					{/snippet}
					{#snippet friend()}
						<p>
							L'agent est un <strong>ReAct LangGraph</strong> avec 6
							tools séquentiels (cf. notre simulator
							<a href="/langgraph#sequential-tools">page LangGraph</a>) :
						</p>
						<ol>
							<li><code>get_alert_details(alert_id)</code> — récupère l'alerte complète depuis le SIEM.</li>
							<li><code>check_ioc_threat_intel(ioc)</code> — interroge la CTI interne (MISP self-host).</li>
							<li><code>get_user_context(user_id)</code> — qui est ce user, son service, son risk score.</li>
							<li><code>get_host_baseline(hostname, action)</code> — est-ce que cette action est normale pour ce host ?</li>
							<li><code>get_recent_alerts(user_id)</code> — y a-t-il d'autres alertes liées dans les 24 h ?</li>
							<li><code>create_l2_ticket(severity, summary)</code> — si vraie attaque ou ambigu, escalade.</li>
						</ol>
						<p>
							La décision finale (FP / TP / à investiguer) est
							<strong>elle-même un tool</strong> qui écrit en base avec
							signature, pour que le L2 puisse contester si besoin.
						</p>
					{/snippet}
					{#snippet practical()}
						<pre class="proj-code"><code>{`# agent_soc.py
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool

@tool
def check_ioc_threat_intel(ioc: str) -> dict:
    """Vérifie un IOC (IP, hash, domaine) dans la CTI interne MISP.
    Retourne first_seen, last_seen, tags, confidence."""
    return misp.search(ioc)

@tool
def get_host_baseline(hostname: str, action: str) -> dict:
    """Compare l'action observée à la baseline 30 jours du host.
    Retourne is_normal (bool), frequency (per_day), last_seen."""
    return baseline_db.query(hostname, action)

@tool
def create_l2_ticket(severity: str, summary: str, evidence: list) -> str:
    """Crée un ticket TheHive pour escalade L2.
    severity ∈ {low, medium, high, critical}."""
    return thehive.create(severity, summary, evidence)

# … 3 autres tools similaires …

SYSTEM = '''Tu es un analyste SOC L1 expérimenté.
Pour chaque alerte, tu DOIS :
1. Récupérer les détails complets.
2. Vérifier les IOC dans la CTI.
3. Comprendre le contexte user + host.
4. Comparer à la baseline.
5. Décider : faux_positif / vrai_positif / a_investiguer.
6. Si vrai_positif ou ambigu : créer un ticket L2 avec evidence claire.
Ta décision doit être justifiée et reproductible. Pas d\\'hallucination.'''

agent = create_react_agent(
    mistral_7b,
    tools=[get_alert_details, check_ioc_threat_intel, get_user_context,
           get_host_baseline, get_recent_alerts, create_l2_ticket],
    state_modifier=SYSTEM,
)

# Boucle : pour chaque alerte SIEM, on invoque l'agent
for alert in siem.poll_alerts():
    result = agent.invoke({
        "messages": [HumanMessage(f"Qualifie l'alerte {alert.id}")]
    }, config={"recursion_limit": 20, "callbacks": [langfuse_callback]})
    persist_decision(alert.id, result, sign=True)`}</code></pre>
					{/snippet}
					{#snippet deep()}
						<p><strong>Points d'attention production :</strong></p>
						<ul>
							<li>
								<strong>Pas d'autonomie totale en V1</strong>. L'agent ne
								doit pas avoir le droit de bloquer un user / déconnecter un
								host. Il propose, le L2 valide. Phase 2 quand on aura mesuré
								la fiabilité sur 6 mois.
							</li>
							<li>
								<strong>Guardrails NeMo</strong> en amont : si l'alerte
								mentionne du contenu sensible (mots-clés classification),
								l'agent passe en mode dégradé (refus, escalade humaine).
							</li>
							<li>
								<strong>Données d'entraînement</strong> : on peut fine-tuner
								un Mistral 7B sur les décisions historiques du SOC (« voici
								1000 alertes et leur résolution réelle ») pour gagner en
								précision. QLoRA via Unsloth, &lt; 24 h sur RTX 5000.
							</li>
							<li>
								<strong>Métriques</strong> : faux positifs / faux négatifs
								sur un dataset gold de 500 alertes annotées. Au-delà de
								5 % de FN, on bloque la mise en prod.
							</li>
							<li>
								<strong>Adversarial</strong> : un attaquant peut tenter de
								« endormir » l'agent avec des leurres. Test régulier en
								exercice (purple team).
							</li>
						</ul>
					{/snippet}
				</DifficultyTabs>

				<Callout variant="warning" title="⚠️ Le risque cyber spécifique de l'agent">
					<p>
						Un agent SOC est <strong>lui-même une cible</strong>. Si
						l'attaquant comprend ses prompts et ses tools, il peut crafter
						des alertes piège pour l'amener à <strong>fermer un vrai
						positif comme FP</strong>. Mitigations :
					</p>
					<ul>
						<li>Le LLM ne ferme JAMAIS un cas définitivement — il propose, le L2 confirme.</li>
						<li>Audit trail signé sur toutes les décisions, scellé toutes les heures dans un Merkle log.</li>
						<li>Détection d'anomalie sur les patterns de décision (si l'agent dit FP 100× d'affilée, alerte).</li>
						<li>Red team trimestrielle : injection de prompts adversariaux dans les alertes pour tester la robustesse.</li>
					</ul>
				</Callout>
			</div>
		{/if}

		<!-- ===================================================== -->
		<!-- CAS 3 : CR MISSION -->
		<!-- ===================================================== -->
		{#if activeCase === 'cr-mission'}
			<div class="proj-case">
				<h3 class="proj-h3">✍️ Cas 3 — Agent CR mission multi-agent</h3>
				<p class="proj-case-pitch">
					<strong>Problème métier :</strong> Les chefs de mission écrivent
					des comptes-rendus dans un format ANSSI strict. Ça leur prend
					3-4 h après chaque mission. Cible : <strong>agent multi-rôles
					qui prend des notes brutes et produit un CR conforme</strong>,
					avec validation qualité avant livraison.
				</p>

				<DifficultyTabs
					id="case3-explain"
					title="Comment ça fonctionne"
					tagline="Le pattern supervisor appliqué à un workflow rédactionnel défense"
				>
					{#snippet intuitive()}
						<p>
							Le chef de mission dicte ou tape ses notes brutes
							(« partis à 14h, RV avec X à Y, point bloquant Z,
							décision retenue W »). L'agent les transforme en CR
							ANSSI : structure stricte, classification, mention des
							éléments hors-périmètre. Plusieurs agents collaborent :
							l'un structure, l'autre rédige, le troisième vérifie.
						</p>
					{/snippet}
					{#snippet friend()}
						<p>
							C'est exactement le pattern <strong>multi-agent
							supervisor</strong> qu'on a vu dans la
							<a href="/langgraph#supervisor">page LangGraph</a>, adapté
							au métier défense :
						</p>
						<ol>
							<li><strong>structurer</strong> — extrait des notes brutes : date, lieu, participants, points d'attention, décisions. JSON typé.</li>
							<li><strong>writer</strong> — rédige le CR au format ANSSI à partir du JSON structuré.</li>
							<li><strong>reviewer</strong> — vérifie : conformité format, pas de fuite supérieur à la classification cible, chiffres cohérents.</li>
							<li><strong>classifier</strong> — propose le niveau de classification final basé sur le contenu (NP/DR/CD/SD).</li>
							<li><strong>supervisor</strong> — orchestre. Si reviewer rejette → renvoie au writer (boucle de correction).</li>
						</ol>
						<p>
							Sortie : un fichier Word + un PDF + un manifest signé
							avec hash, classification, signataires.
						</p>
					{/snippet}
					{#snippet practical()}
						<pre class="proj-code"><code>{`# agent_cr.py — pattern supervisor
from typing import Literal, TypedDict
from langgraph.graph import StateGraph, END

class CRState(TypedDict):
    notes_raw: str
    user_clearance: str
    structured: dict | None      # produit par structurer
    draft: str | None             # produit par writer
    review: dict | None           # produit par reviewer ({approved, issues})
    classification: str | None    # proposée par classifier
    iterations: int               # garde-fou anti-boucle
    next: str

# === Agents (4 + supervisor) ===
def structurer(state):
    extracted = mistral.with_structured_output(StructuredCR).invoke([
        SystemMessage("Extrais date, lieu, participants, décisions, risques."),
        HumanMessage(state["notes_raw"]),
    ])
    return {"structured": extracted.dict()}

def writer(state):
    template = load_template("anssi_cr_v2.txt")
    draft = mistral.invoke([
        SystemMessage(f"Rédige un CR au format {template}. "
                      f"Classification cible : {state['user_clearance']}."),
        HumanMessage(json.dumps(state["structured"])),
        # Si on est en correction : on inclut les remarques précédentes
        *([HumanMessage(f"Corrections demandées : {state['review']['issues']}")]
          if state.get("review") else []),
    ])
    return {"draft": draft.content, "iterations": state["iterations"] + 1}

def reviewer(state):
    review = mistral.with_structured_output(ReviewSchema).invoke([
        SystemMessage("Vérifie : (1) format ANSSI strict, (2) cohérence factuelle "
                      "avec les notes brutes, (3) AUCUNE fuite vers une classif > "
                      f"{state['user_clearance']}. Renvoie issues=[] si OK."),
        HumanMessage(f"Notes : {state['notes_raw']}\\n\\nCR : {state['draft']}"),
    ])
    return {"review": review.dict()}

def classifier(state):
    cls = mistral.with_structured_output(ClassifSchema).invoke([
        SystemMessage("Propose la classification finale du CR (NP/DR/CD/SD)."),
        HumanMessage(state["draft"]),
    ])
    return {"classification": cls.level}

def supervisor(state):
    # Logique d'orchestration
    if not state.get("structured"):
        return {"next": "structurer"}
    if not state.get("draft"):
        return {"next": "writer"}
    if not state.get("review"):
        return {"next": "reviewer"}
    if not state["review"]["approved"]:
        if state["iterations"] >= 3:
            return {"next": "END"}  # garde-fou : 3 tentatives max
        return {"next": "writer"}  # boucle de correction
    if not state.get("classification"):
        return {"next": "classifier"}
    return {"next": "END"}

# === Graphe ===
g = StateGraph(CRState)
for name, fn in [("supervisor", supervisor), ("structurer", structurer),
                 ("writer", writer), ("reviewer", reviewer), ("classifier", classifier)]:
    g.add_node(name, fn)
g.set_entry_point("supervisor")
g.add_conditional_edges("supervisor", lambda s: s["next"], {
    "structurer": "structurer", "writer": "writer",
    "reviewer": "reviewer", "classifier": "classifier", "END": END,
})
# Tous les agents retournent au supervisor
for n in ["structurer", "writer", "reviewer", "classifier"]:
    g.add_edge(n, "supervisor")
app = g.compile(checkpointer=PostgresSaver(...))`}</code></pre>
					{/snippet}
					{#snippet deep()}
						<p><strong>Points d'attention production :</strong></p>
						<ul>
							<li>
								<strong>Garde-fou itérations</strong> : max 3 boucles
								writer↔reviewer. Au-delà, on livre quand même avec un flag
								« revue humaine recommandée ». Évite les boucles infinies
								si le reviewer est trop strict.
							</li>
							<li>
								<strong>Validation humaine obligatoire</strong> en V1 :
								l'agent produit un draft, mais c'est l'officier qui valide
								et signe (qualification YubiKey). L'agent fait gagner du
								temps, pas de l'autorité.
							</li>
							<li>
								<strong>Templates ANSSI versionnés</strong> dans git
								interne. Si l'ANSSI change le format en 2027, on bump la
								version sans toucher au code.
							</li>
							<li>
								<strong>Évaluation</strong> : 30 CR historiques (anonymisés)
								comme dataset de validation. Métriques : conformité
								format (regex sur sections obligatoires), distance Levenshtein
								au CR humain de référence, fluidité (perplexité).
							</li>
							<li>
								<strong>Watermarking</strong> du draft (Unicode invisibles
								spécifiques par session) pour identifier les fuites
								éventuelles si un CR sort du système.
							</li>
						</ul>
					{/snippet}
				</DifficultyTabs>

				<Callout variant="info" title="💡 Cas d'usage qui leverage le pattern multi-agent vu en LangGraph">
					<p>
						Ce cas est l'application directe du pattern <a href="/langgraph#supervisor">multi-agent
						supervisor</a> qu'on a étudié — avec un twist défense :
						le reviewer ne vérifie pas que la qualité rédactionnelle,
						il vérifie aussi la <strong>non-fuite</strong> vers une
						classification supérieure. La boucle de correction peut
						être déclenchée 3 fois max, après quoi on remonte à un
						humain.
					</p>
				</Callout>
			</div>
		{/if}
	</section>

	<!-- ============== 5. ROADMAP ============== -->
	<section id="roadmap" class="proj-section">
		<h2 class="proj-h2">5️⃣ Roadmap d'implémentation — 3 sprints de 3 semaines</h2>
		<p class="proj-lead">
			Voici comment je découperais le projet pour une équipe de 2-3 personnes.
			Chaque sprint a un livrable démontrable et un critère de sortie clair.
		</p>

		<div class="proj-roadmap">
			<div class="proj-sprint">
				<div class="proj-sprint-head">
					<span class="proj-sprint-num">Sprint 1</span>
					<h3>Socle infra + Agent documentaire MVP</h3>
					<span class="proj-sprint-duration">3 semaines</span>
				</div>
				<ul class="proj-sprint-todo">
					<li>✅ K8s on-prem (3 nodes, MetalLB, Cilium) + Harbor + Vault</li>
					<li>✅ vLLM Mistral 7B fp16 derrière une API gateway FastAPI (mTLS, JWT)</li>
					<li>✅ Qdrant + ingestion BGE-m3 sur corpus test (1000 docs)</li>
					<li>✅ Agent doc minimal : retrieve → generate (LangGraph 2 nœuds)</li>
					<li>✅ Filtre habilitation côté Qdrant (filtre payload)</li>
					<li>✅ Langfuse + PostgreSQL + audit log signé Ed25519</li>
				</ul>
				<div class="proj-sprint-exit">
					🎯 <strong>Critère de sortie</strong> : démo sur 100 questions
					réelles, p95 latence &lt; 5 s, 0 fuite SD sur 50 tests adversariaux.
				</div>
			</div>

			<div class="proj-sprint">
				<div class="proj-sprint-head">
					<span class="proj-sprint-num">Sprint 2</span>
					<h3>Hardening + Agent SOC + Fine-tuning Mistral</h3>
					<span class="proj-sprint-duration">3 semaines</span>
				</div>
				<ul class="proj-sprint-todo">
					<li>✅ Reranker BGE-reranker en V2 du RAG (top-K=20 → top-5)</li>
					<li>✅ Guardrails NeMo (prompt injection, output filtering)</li>
					<li>✅ Agent SOC : 6 tools, intégration SIEM + MISP + TheHive</li>
					<li>✅ Fine-tune Mistral 7B QLoRA sur 1000 décisions SOC historiques (Unsloth)</li>
					<li>✅ RAGAS en CI sur dataset 100 questions annotées</li>
					<li>✅ Red team automatique : 50 prompts adversariaux dans la CI</li>
				</ul>
				<div class="proj-sprint-exit">
					🎯 <strong>Critère de sortie</strong> : précision agent SOC
					&gt; 90 % sur dataset gold de 200 alertes, faithfulness RAGAS
					&gt; 0,85, 0 fuite sur red team.
				</div>
			</div>

			<div class="proj-sprint">
				<div class="proj-sprint-head">
					<span class="proj-sprint-num">Sprint 3</span>
					<h3>Multi-agent + Llama 70B + audit pré-prod</h3>
					<span class="proj-sprint-duration">3 semaines</span>
				</div>
				<ul class="proj-sprint-todo">
					<li>✅ Llama 70B AWQ 4-bit sur 4× A100 (tensor parallel)</li>
					<li>✅ Agent CR mission : pattern supervisor 4 agents (structurer, writer, reviewer, classifier)</li>
					<li>✅ Validation humaine YubiKey sur les CR avant export</li>
					<li>✅ Watermarking invisible sur les drafts</li>
					<li>✅ Documentation ANSSI : modèle de menace STRIDE, plan de continuité</li>
					<li>✅ Pré-audit interne (RSSI) + plan de remédiation</li>
				</ul>
				<div class="proj-sprint-exit">
					🎯 <strong>Critère de sortie</strong> : pré-prod stable 2 semaines,
					3 cas d'usage opérationnels, documentation audit-ready, GO/NO-GO
					RSSI pour mise en service restreinte.
				</div>
			</div>
		</div>
	</section>

	<!-- ============== 6. RISQUES ============== -->
	<section id="risques" class="proj-section">
		<h2 class="proj-h2">6️⃣ Risques + mitigations</h2>
		<p class="proj-lead">
			Une vraie analyse de risques en projet défense ferait 80 pages
			(STRIDE, LINDDUN, AFNOR…). Voici les 6 risques majeurs qu'il faut
			absolument traiter dès le début.
		</p>

		<div class="proj-risks">
			<div class="proj-risk proj-risk-critical">
				<div class="proj-risk-head">
					<span class="proj-risk-sev">🔴 CRITIQUE</span>
					<h3>Fuite d'information classifiée supérieure</h3>
				</div>
				<p><strong>Scénario</strong> : un user CD parvient à extraire du contenu SD via prompt injection ou via inversion d'embedding.</p>
				<p><strong>Mitigation</strong> : filtre par habilitation au niveau du store (impossible à contourner par prompt), guardrails NeMo en sortie, eval adversariale en CI bloquante, audit log signé.</p>
			</div>

			<div class="proj-risk proj-risk-high">
				<div class="proj-risk-head">
					<span class="proj-risk-sev">🟠 ÉLEVÉ</span>
					<h3>Hallucination sur sujet sensible</h3>
				</div>
				<p><strong>Scénario</strong> : l'agent invente un chiffre / une date / un nom de personne dans un CR ou une réponse opérationnelle.</p>
				<p><strong>Mitigation</strong> : citations obligatoires des sources RAG, seuil de confiance minimum (sinon refus de répondre), validation humaine sur tout livrable (CR mission), benchmark RAGAS faithfulness ≥ 0,85.</p>
			</div>

			<div class="proj-risk proj-risk-high">
				<div class="proj-risk-head">
					<span class="proj-risk-sev">🟠 ÉLEVÉ</span>
					<h3>Compromission du modèle ou des poids</h3>
				</div>
				<p><strong>Scénario</strong> : un poid empoisonné (backdoor de Mistral sur HF Hub) ou un fine-tune malicieux installé sur le serveur.</p>
				<p><strong>Mitigation</strong> : hash BLAKE3 vérifié à chaque chargement, signature cosign des fine-tunes internes, scan régulier des poids (TrojDiff-like), pull depuis Harbor mirror uniquement.</p>
			</div>

			<div class="proj-risk proj-risk-medium">
				<div class="proj-risk-head">
					<span class="proj-risk-sev">🟡 MOYEN</span>
					<h3>Dette technique LangGraph / vLLM</h3>
				</div>
				<p><strong>Scénario</strong> : breaking change majeur d'une lib qui rend une mise à jour cyber/sécu douloureuse.</p>
				<p><strong>Mitigation</strong> : versions pinnées, fork interne git à minima, CI complète sur upgrade, vendoring des deps critiques, choix de techs Apache 2.0 (forkable).</p>
			</div>

			<div class="proj-risk proj-risk-medium">
				<div class="proj-risk-head">
					<span class="proj-risk-sev">🟡 MOYEN</span>
					<h3>Coût opérationnel sous-estimé</h3>
				</div>
				<p><strong>Scénario</strong> : la stack proposée demande en réalité 5 personnes à temps plein pour être maintenue, alors qu'on a 2-3.</p>
				<p><strong>Mitigation</strong> : automatisation maximum (GitOps Flux, monitoring as code), choix de stacks light (Qdrant vs Milvus), Ops review trimestrielle, ne pas tout faire en V1 (cf. arbitrage critique en section 1).</p>
			</div>

			<div class="proj-risk proj-risk-medium">
				<div class="proj-risk-head">
					<span class="proj-risk-sev">🟡 MOYEN</span>
					<h3>Adversarial à l'agent (prompt injection avancé)</h3>
				</div>
				<p><strong>Scénario</strong> : un attaquant exfiltre des données via une attaque de type ASCII smuggling ou via un doc piégé indexé dans le RAG.</p>
				<p><strong>Mitigation</strong> : sanitization des inputs (regex sur Unicode tagging), validation des outputs, segmentation des contextes RAG, audit log + alerting sur les patterns suspects.</p>
			</div>
		</div>

		<Callout variant="warning" title="🎓 Ce qu'il faut retenir avant d'avancer">
			<p>
				Le risque le plus important n'est <strong>pas</strong> technique. C'est
				<strong>de croire qu'on peut faire confiance à un LLM</strong>. Un
				LLM est un outil, pas un agent autonome. Tous les arbitrages
				architecturaux ci-dessus reviennent à ça : garder un humain dans
				la boucle pour les décisions critiques, et traiter le LLM comme
				on traiterait un junior ambitieux mais inexpérimenté.
			</p>
		</Callout>
	</section>

	<!-- ============== CTA ============== -->
	<section class="proj-section">
		<h2 class="proj-h2">🎬 Prochaine étape</h2>
		<p>
			Cette page est une proposition. Avant de coder une ligne, on valide
			ensemble :
		</p>
		<ol>
			<li>✅ La stack proposée (en V1) — confirme ou pivote.</li>
			<li>✅ Les 3 cas d'usage — confirme l'ordre de priorité (ou propose un 4ᵉ).</li>
			<li>✅ Le découpage en 3 sprints — réaliste vu ta dispo / équipe ?</li>
			<li>✅ Le scope V1 vs V2 (MCP, GraphRAG, LiteLLM en V2).</li>
		</ol>
		<p>
			Une fois calé, on attaque le Sprint 1. Idéalement on commence par
			l'agent documentaire — c'est le plus simple, et ça pose le socle
			infra (vLLM, Qdrant, Langfuse) qui sert aux deux autres cas.
		</p>
	</section>
</article>

<style>
	.proj {
		max-width: 1240px; margin: 0 auto; padding: 2rem 1rem 4rem;
		display: flex; flex-direction: column; gap: 2rem;
	}
	.proj :global(p) { max-width: 920px; }

	/* ===== HÉROS ===== */
	.proj-hero {
		text-align: center; padding: 2.5rem 1.5rem;
		background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e293b 100%);
		color: #fff; border-radius: 1.5rem;
	}
	.proj-hero-emoji { font-size: 4rem; display: block; }
	.proj-h1 {
		font-family: var(--font-display); font-size: 2.25rem; font-weight: 700;
		margin: 0.5rem 0; color: #fff;
	}
	.proj-hero-lead {
		font-size: 1rem; max-width: 760px; margin: 0.85rem auto 1.5rem;
		line-height: 1.65; color: #e2e8f0;
	}
	.proj-hero-lead strong { color: #fde68a; }
	.proj-hero-meta { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
	.proj-hero-tag {
		padding: 0.3rem 0.85rem; background: rgba(255,255,255,0.1);
		border: 1px solid rgba(255,255,255,0.2); border-radius: 999px;
		font-family: var(--font-mono); font-size: 0.78rem; color: #fef3c7;
	}

	/* ===== TOC ===== */
	.proj-toc {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem;
		padding: 1.25rem 1.5rem;
	}
	.proj-toc-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem;
	}
	.proj-toc-list {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0;
	}
	.proj-toc-list a {
		color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem;
	}
	.proj-toc-list a:hover { color: #6366f1; }

	/* ===== Section base ===== */
	.proj-section {
		display: flex; flex-direction: column; gap: 1rem;
		scroll-margin-top: 80px;
	}
	.proj-h2 {
		font-family: var(--font-display); font-size: 1.6rem; font-weight: 700;
		color: var(--color-ink-900); margin: 0;
	}
	.proj-h3 {
		font-family: var(--font-display); font-size: 1.2rem; font-weight: 700;
		color: var(--color-ink-900); margin: 1rem 0 0.5rem;
	}
	.proj-lead { font-size: 1rem; color: var(--color-ink-700); line-height: 1.65; }

	/* ===== Contraintes grid ===== */
	.proj-constraints {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
		gap: 0.85rem;
	}
	.proj-constraint {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
		padding: 1rem 1.2rem;
	}
	.proj-constraint-icon { font-size: 1.8rem; }
	.proj-constraint h3 {
		font-family: var(--font-display); font-size: 1rem; margin: 0.3rem 0 0.4rem;
		color: var(--color-ink-900);
	}
	.proj-constraint p {
		margin: 0; font-size: 0.88rem; line-height: 1.55; color: var(--color-ink-700);
	}

	/* ===== Filtres critique ===== */
	.proj-filters { display: flex; gap: 0.45rem; flex-wrap: wrap; }
	.proj-filter {
		padding: 0.45rem 0.95rem; background: #fff; border: 1px solid #e2e8f0;
		border-radius: 999px; font-family: var(--font-mono); font-size: 0.8rem;
		color: var(--color-ink-700); cursor: pointer; transition: all 0.15s;
	}
	.proj-filter:hover { border-color: var(--filter-color, #6366f1); }
	.proj-filter.is-active {
		background: var(--filter-color, #1e293b); color: #fff;
		border-color: var(--filter-color, #1e293b); font-weight: 600;
	}

	/* ===== Tech list ===== */
	.proj-tech-list { display: flex; flex-direction: column; gap: 0.75rem; }
	.proj-tech {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.85rem;
		border-left: 5px solid var(--verdict-color);
		padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.75rem;
	}
	.proj-tech-head {
		display: grid; grid-template-columns: auto 1fr auto;
		gap: 0.85rem; align-items: center;
	}
	.proj-tech-emoji { font-size: 1.75rem; }
	.proj-tech-name h3 {
		font-family: var(--font-display); font-size: 1.05rem; margin: 0;
		color: var(--color-ink-900);
	}
	.proj-tech-name p {
		font-size: 0.78rem; color: var(--color-ink-500); margin: 0;
		font-family: var(--font-mono);
	}
	.proj-tech-verdict {
		font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700;
		padding: 0.3rem 0.7rem; background: var(--verdict-color); color: #fff;
		border-radius: 999px;
	}
	.proj-tech-verdict-emoji { margin-right: 0.3rem; }
	.proj-tech-body {
		display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
	}
	@media (max-width: 720px) { .proj-tech-body { grid-template-columns: 1fr; } }
	.proj-tech-col {
		padding: 0.6rem 0.8rem; border-radius: 0.45rem;
	}
	.proj-tech-col-pro { background: #f0fdf4; border-left: 3px solid #22c55e; }
	.proj-tech-col-con { background: #fef3c7; border-left: 3px solid #f59e0b; }
	.proj-tech-col-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: var(--color-ink-700); margin-bottom: 0.25rem; font-weight: 600;
	}
	.proj-tech-col p {
		margin: 0; font-size: 0.85rem; line-height: 1.55; color: var(--color-ink-700);
	}
	.proj-tech-decision {
		padding: 0.55rem 0.85rem; background: #f8fafc;
		border-radius: 0.45rem; font-size: 0.85rem; color: var(--color-ink-700);
		line-height: 1.55;
	}

	/* ===== Stack layers ===== */
	.proj-stack {
		display: flex; flex-direction: column; gap: 0.4rem;
		background: #f8fafc; border-radius: 0.75rem; padding: 1rem;
	}
	.proj-stack-layer {
		display: grid; grid-template-columns: 220px 1fr; gap: 1rem;
		align-items: center; padding: 0.7rem 1rem;
		background: #fff; border-radius: 0.5rem; border-left: 4px solid;
	}
	.proj-stack-layer-7 { border-left-color: #ec4899; }
	.proj-stack-layer-6 { border-left-color: #f59e0b; }
	.proj-stack-layer-5 { border-left-color: #a855f7; }
	.proj-stack-layer-4 { border-left-color: #fb923c; }
	.proj-stack-layer-3 { border-left-color: #06b6d4; }
	.proj-stack-layer-2 { border-left-color: #22c55e; }
	.proj-stack-layer-1 { border-left-color: #6366f1; }
	.proj-stack-layer-obs { border-left-color: #eab308; background: #fffbeb; }
	.proj-stack-layer-sec { border-left-color: #dc2626; background: #fef2f2; }
	@media (max-width: 720px) { .proj-stack-layer { grid-template-columns: 1fr; gap: 0.3rem; } }
	.proj-stack-layer-label {
		font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700;
		color: var(--color-ink-900);
	}
	.proj-stack-layer-content {
		display: flex; flex-direction: column; gap: 0.2rem;
	}
	.proj-stack-pick {
		font-size: 0.88rem; color: var(--color-ink-900); font-weight: 500;
	}
	.proj-stack-reject {
		font-size: 0.78rem; color: var(--color-ink-500); font-style: italic;
		font-family: var(--font-mono);
	}

	/* ===== Archi SVG ===== */
	.proj-archi {
		background: #f8fafc; border-radius: 0.85rem; padding: 0.6rem;
		overflow-x: auto;
	}
	.proj-archi-svg {
		width: 100%; height: auto; min-width: 720px;
		max-height: 620px;
	}

	/* ===== Use cases tabs ===== */
	.proj-cases-tabs {
		display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;
	}
	@media (max-width: 800px) { .proj-cases-tabs { grid-template-columns: 1fr; } }
	.proj-case-tab {
		display: flex; align-items: center; gap: 0.7rem; text-align: left;
		padding: 0.85rem 1.05rem; background: #fff; border: 2px solid #e2e8f0;
		border-radius: 0.75rem; cursor: pointer; font: inherit;
		color: var(--color-ink-700); transition: all 0.15s;
	}
	.proj-case-tab:hover { border-color: #6366f1; }
	.proj-case-tab.is-active {
		background: #312e81; border-color: #312e81; color: #fff;
	}
	.proj-case-tab.is-active small { color: #fde68a; }
	.proj-case-tab > span { font-size: 1.65rem; }
	.proj-case-tab strong {
		font-family: var(--font-display); font-size: 0.9rem; display: block;
	}
	.proj-case-tab small {
		font-size: 0.72rem; color: var(--color-ink-500); display: block;
		margin-top: 0.15rem;
	}

	.proj-case {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.85rem;
		padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;
	}
	.proj-case-pitch {
		padding: 0.85rem 1.1rem; background: #ede9fe; border-left: 4px solid #6366f1;
		border-radius: 0.5rem; font-size: 0.92rem; line-height: 1.6;
		color: var(--color-ink-700);
	}
	.proj-code {
		background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem;
		border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.76rem;
		line-height: 1.6; margin: 0.5rem 0;
		white-space: pre-wrap; word-break: break-word; overflow-x: auto;
	}

	/* ===== Roadmap ===== */
	.proj-roadmap {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
		gap: 1rem;
	}
	.proj-sprint {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.85rem;
		padding: 1.2rem; display: flex; flex-direction: column; gap: 0.75rem;
		border-top: 4px solid #6366f1;
	}
	.proj-sprint-head {
		display: flex; flex-direction: column; gap: 0.2rem;
	}
	.proj-sprint-num {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: #6366f1; font-weight: 700;
	}
	.proj-sprint h3 {
		font-family: var(--font-display); font-size: 1.05rem; margin: 0;
		color: var(--color-ink-900);
	}
	.proj-sprint-duration {
		font-size: 0.78rem; color: var(--color-ink-500); font-family: var(--font-mono);
	}
	.proj-sprint-todo {
		list-style: none; padding: 0; margin: 0;
		display: flex; flex-direction: column; gap: 0.35rem;
	}
	.proj-sprint-todo li {
		font-size: 0.86rem; color: var(--color-ink-700); line-height: 1.5;
		padding-left: 0.25rem;
	}
	.proj-sprint-exit {
		padding: 0.7rem 0.85rem; background: #f0fdf4; border-left: 3px solid #22c55e;
		border-radius: 0.4rem; font-size: 0.82rem; line-height: 1.55;
		color: var(--color-ink-700);
	}

	/* ===== Risques ===== */
	.proj-risks {
		display: flex; flex-direction: column; gap: 0.7rem;
	}
	.proj-risk {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.7rem;
		padding: 1rem 1.2rem; border-left: 5px solid;
	}
	.proj-risk-critical { border-left-color: #dc2626; background: #fef2f2; }
	.proj-risk-high { border-left-color: #ea580c; background: #fff7ed; }
	.proj-risk-medium { border-left-color: #eab308; background: #fefce8; }
	.proj-risk-head {
		display: flex; gap: 0.85rem; align-items: center; margin-bottom: 0.55rem;
	}
	.proj-risk-sev {
		font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
		padding: 0.2rem 0.55rem; background: #fff; border-radius: 0.3rem;
		white-space: nowrap;
	}
	.proj-risk h3 {
		margin: 0; font-family: var(--font-display); font-size: 1rem;
		color: var(--color-ink-900);
	}
	.proj-risk p {
		margin: 0.25rem 0; font-size: 0.88rem; line-height: 1.55;
		color: var(--color-ink-700);
	}
</style>
