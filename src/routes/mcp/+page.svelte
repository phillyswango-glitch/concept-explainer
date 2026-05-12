<!--
	/mcp — Lab Model Context Protocol.
	Cas d'usage central : intégration MCP × LangGraph pour l'agent défense.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';
	import MCPSimulator from '$lib/components/concepts/MCPSimulator.svelte';
</script>

<svelte:head><title>MCP — Model Context Protocol</title></svelte:head>

<article class="mcpp">
	<!-- HÉROS -->
	<header class="mcpp-hero">
		<span class="mcpp-hero-emoji">🔌</span>
		<h1 class="mcpp-h1">MCP — Model Context Protocol</h1>
		<p class="mcpp-hero-lead">
			L'<strong>« USB-C des LLMs »</strong>. Un protocole standardisé,
			ouvert, créé par Anthropic en novembre 2024 pour brancher
			<strong>n'importe quel outil ou source de données</strong> à
			<strong>n'importe quel agent</strong>. Cette page t'apprend le
			protocole sur le wire (JSON-RPC 2.0), avec une intégration concrète
			MCP × LangGraph sur le cas défense.
		</p>
		<div class="mcpp-hero-actions">
			<a href="#simulator" class="mcpp-cta mcpp-cta-primary">🎮 Voir le protocole en action</a>
			<a href="#integration" class="mcpp-cta mcpp-cta-secondary">⚡ L'intégration LangGraph</a>
		</div>
	</header>

	<!-- TOC -->
	<nav class="mcpp-toc">
		<p class="mcpp-toc-label">📍 Parcours</p>
		<ol class="mcpp-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#pourquoi">1. Pourquoi MCP existe</a></li>
			<li><a href="#vs-langgraph">1½. MCP vs LangGraph — où est la frontière ? ⭐</a></li>
			<li><a href="#archi">2. Architecture (Client/Server/Transport)</a></li>
			<li><a href="#primitives">3. Les 3 primitives (Tools, Resources, Prompts)</a></li>
			<li><a href="#protocole">4. Le protocole JSON-RPC 2.0</a></li>
			<li><a href="#simulator">5. Simulateur MCP × LangGraph ⭐</a></li>
			<li><a href="#integration">6. L'intégration concrète LangGraph + MCP</a></li>
			<li><a href="#serveur">7. Construire son serveur MCP</a></li>
			<li><a href="#glossaire">8. Glossaire</a></li>
		</ol>
	</nav>

	<!-- ============== 0. PRÉREQUIS ============== -->
	<section id="prereq" class="mcpp-section">
		<h2 class="mcpp-h2">0️⃣ Avant de commencer</h2>
		<div class="mcpp-prereq-grid">
			<details class="mcpp-prereq">
				<summary>📡 JSON-RPC 2.0</summary>
				<div>
					<p>
						Format ultra-simple pour appeler une fonction à distance via JSON.
						Chaque message a au minimum <code>"jsonrpc": "2.0"</code>, un
						<code>"method"</code> (nom de la fonction), et soit
						<code>"params"</code> (arguments) pour une requête, soit
						<code>"result"</code>/<code>"error"</code> pour une réponse.
					</p>
					<p>
						Différence clé : <strong>requête</strong> (avec <code>id</code>,
						attend une réponse) vs <strong>notification</strong> (sans
						<code>id</code>, fire-and-forget).
					</p>
				</div>
			</details>
			<details class="mcpp-prereq">
				<summary>🔁 Transports : stdio, SSE, Streamable HTTP</summary>
				<div>
					<p>
						Le canal sur lequel circulent les frames JSON-RPC. MCP supporte 3 transports :
					</p>
					<ul>
						<li><strong>stdio</strong> : le client lance le serveur comme sous-processus, communication via stdin/stdout. Le plus utilisé pour les serveurs locaux.</li>
						<li><strong>SSE</strong> (Server-Sent Events) : utilisé pour les serveurs distants pré-2025.</li>
						<li><strong>Streamable HTTP</strong> : transport moderne, succède à SSE. POST + streams.</li>
					</ul>
				</div>
			</details>
			<details class="mcpp-prereq">
				<summary>📝 JSON Schema</summary>
				<div>
					<p>
						Standard pour décrire la structure d'un objet JSON. MCP l'utilise
						pour décrire les arguments d'un tool : type, propriétés requises,
						descriptions. Le LLM peut ainsi générer des appels valides sans
						deviner.
					</p>
				</div>
			</details>
			<details class="mcpp-prereq">
				<summary>🎭 Capability negotiation</summary>
				<div>
					<p>
						À l'initialisation, client et serveur s'échangent leurs
						<strong>capabilities</strong> — la liste de ce qu'ils savent faire.
						Le serveur dit « j'offre des tools et des resources, mais pas de
						prompts ». Le client dit « je sais sampler côté LLM si tu en as
						besoin ». Chacun adapte ensuite ses requêtes au possible.
					</p>
				</div>
			</details>
		</div>
	</section>

	<!-- ============== 1. POURQUOI ============== -->
	<section id="pourquoi" class="mcpp-section">
		<h2 class="mcpp-h2">1️⃣ Pourquoi MCP existe — le problème N×M</h2>

		<div class="mcpp-problem">
			<div class="mcpp-problem-before">
				<h4>❌ Avant MCP : explosion combinatoire</h4>
				<p>
					Tu as <strong>N agents</strong> (Claude, ChatGPT, Cursor, ton
					agent custom…) qui veulent accéder à <strong>M outils</strong>
					(filesystem, GitHub, Postgres, Slack, ton API métier…).
				</p>
				<p>
					Sans standard, chaque combinaison demande <strong>une intégration
						sur mesure</strong>. <code>N × M</code> intégrations à écrire,
					maintenir, debugger, sécuriser. Insoutenable au-delà de quelques
					outils.
				</p>
			</div>

			<div class="mcpp-problem-arrow">→</div>

			<div class="mcpp-problem-after">
				<h4>✅ Avec MCP : N + M</h4>
				<p>
					Chaque agent parle <strong>MCP</strong>. Chaque outil parle
					<strong>MCP</strong>. Chacun n'écrit qu'<strong>une intégration</strong>
					(côté client, ou côté serveur).
				</p>
				<p>
					Tu écris ton serveur MCP <strong>une fois</strong> — et il
					marche avec Claude Desktop, Cursor, n'importe quel agent
					LangGraph, tout. Comme USB-C : un connecteur, mille usages.
				</p>
			</div>
		</div>

		<Callout variant="insight" title="🎯 La promesse en une phrase">
			<p>
				MCP fait pour les LLMs ce que <strong>OpenAPI</strong> a fait pour
				les API REST : un standard lisible, machine-friendly, qui rend
				les intégrations <strong>composables et portables</strong>.
			</p>
		</Callout>
	</section>

	<!-- ============== 1½. MCP vs LangGraph ============== -->
	<section id="vs-langgraph" class="mcpp-section">
		<h2 class="mcpp-h2">1️⃣ ½ MCP vs LangGraph — où est la frontière ?</h2>
		<p class="mcpp-lead">
			Si tu viens de la page LangGraph, tu te demandes peut-être :
			<em>« Mais attends, LangGraph aussi gère des outils. Pourquoi MCP ?
				C'est redondant ? »</em>. Excellente question. La réponse en une
			phrase : <strong>MCP et LangGraph résolvent deux problèmes
				orthogonaux</strong>. Voici pourquoi tu veux les deux.
		</p>

		<!-- L'analogie clé -->
		<div class="mcpp-analogy">
			<div class="mcpp-analogy-emoji">💡</div>
			<div>
				<h4>L'analogie qui clarifie tout</h4>
				<p>
					Imagine ton ordinateur. <strong>USB-C</strong> est le standard
					qui permet de brancher écran, disque dur, clavier — n'importe
					quel appareil. Mais USB-C ne décide pas <em>quoi faire</em>
					avec ces appareils : c'est le système d'exploitation (macOS,
					Linux) qui gère les workflows applicatifs.
				</p>
				<p>
					Pareil ici :
					<strong>MCP = USB-C</strong> (le standard de connexion entre
					LLM et outils/données) ;
					<strong>LangGraph = le système d'exploitation</strong> (qui
					orchestre les workflows agentiques). Tu as besoin des deux
					pour une stack complète.
				</p>
			</div>
		</div>

		<!-- Diagramme des couches -->
		<h3 class="mcpp-h3">Le schéma des couches — qui fait quoi</h3>
		<div class="mcpp-layers">
			<div class="mcpp-layer mcpp-layer-app">
				<div class="mcpp-layer-emoji">👤</div>
				<div class="mcpp-layer-body">
					<strong>Couche utilisateur</strong>
					<span>L'humain pose une question via une UI</span>
				</div>
			</div>
			<div class="mcpp-layer-arrow">↓</div>
			<div class="mcpp-layer mcpp-layer-graph">
				<div class="mcpp-layer-emoji">🦜</div>
				<div class="mcpp-layer-body">
					<strong>Couche orchestration — LangGraph</strong>
					<span>Décide : quel agent ? Quel ordre ? Boucler ou finir ? Avec quel state ? — c'est le cerveau du workflow.</span>
				</div>
			</div>
			<div class="mcpp-layer-arrow">↓</div>
			<div class="mcpp-layer mcpp-layer-llm">
				<div class="mcpp-layer-emoji">🧠</div>
				<div class="mcpp-layer-body">
					<strong>Couche LLM (Mistral / Claude / GPT)</strong>
					<span>Génère des tool_calls quand le contexte le justifie</span>
				</div>
			</div>
			<div class="mcpp-layer-arrow">↓</div>
			<div class="mcpp-layer mcpp-layer-protocol">
				<div class="mcpp-layer-emoji">🔌</div>
				<div class="mcpp-layer-body">
					<strong>Couche protocole — MCP</strong>
					<span>Standardise comment les tool_calls sont transmis aux outils. JSON-RPC sur stdio/HTTP. Indépendant du framework agent.</span>
				</div>
			</div>
			<div class="mcpp-layer-arrow">↓</div>
			<div class="mcpp-layer mcpp-layer-tools">
				<div class="mcpp-layer-emoji">⚙️</div>
				<div class="mcpp-layer-body">
					<strong>Couche outils — MCP servers + backends</strong>
					<span>Process séparés qui exposent les capacités (DB, FS, API métier). Chacun parle MCP en frontal, le langage qu'il veut en backend.</span>
				</div>
			</div>
		</div>

		<Callout variant="insight" title="🎯 La leçon">
			<p>
				LangGraph vit dans la <strong>couche cerveau</strong>. MCP vit dans
				la <strong>couche transport vers les outils</strong>. Ils sont
				<strong>verticalement complémentaires</strong>, jamais en
				concurrence.
			</p>
		</Callout>

		<!-- Tableau comparatif -->
		<h3 class="mcpp-h3">Tableau comparatif — point par point</h3>
		<table class="mcpp-vs-table">
			<thead>
				<tr><th>Critère</th><th>🦜 LangGraph</th><th>🔌 MCP</th></tr>
			</thead>
			<tbody>
				<tr>
					<td><strong>Nature</strong></td>
					<td>Framework Python (lib)</td>
					<td>Protocole de communication (spec)</td>
				</tr>
				<tr>
					<td><strong>Rôle principal</strong></td>
					<td>Orchestrer un workflow agentique multi-étapes (state, edges, cycles)</td>
					<td>Standardiser comment un agent accède à des outils/données externes</td>
				</tr>
				<tr>
					<td><strong>Niveau d'abstraction</strong></td>
					<td>Haut — flux logique de l'agent</td>
					<td>Bas — frames JSON-RPC sur stdio/HTTP</td>
				</tr>
				<tr>
					<td><strong>Couplage avec le LLM</strong></td>
					<td>Fort — connaît les messages, le state, les décisions</td>
					<td>Aucun — ne sait rien du LLM, il transporte juste des appels</td>
				</tr>
				<tr>
					<td><strong>Langage</strong></td>
					<td>Python (.NET et JS existent mais Python domine)</td>
					<td>Cross-language — serveurs en Python / Node / Go / Rust / etc.</td>
				</tr>
				<tr>
					<td><strong>Process</strong></td>
					<td>Tous les nœuds + tools dans un seul process Python</td>
					<td>Serveurs MCP en process séparés (stdio) ou distants (HTTP)</td>
				</tr>
				<tr>
					<td><strong>Réutilisabilité des outils</strong></td>
					<td>Spécifiques à ton app LangGraph</td>
					<td>Universellement consommables (Claude Desktop, Cursor, Cline, ton agent…)</td>
				</tr>
				<tr>
					<td><strong>Sécurité / isolation</strong></td>
					<td>Tout partage les droits du process</td>
					<td>Chaque serveur peut avoir ses propres droits (utilisateur dédié, sandbox)</td>
				</tr>
				<tr>
					<td><strong>Type d'outils possibles</strong></td>
					<td>Fonctions Python (forte coupling)</td>
					<td>Tools, Resources, Prompts (3 primitives standardisées)</td>
				</tr>
				<tr>
					<td><strong>Auteur</strong></td>
					<td>LangChain Inc. (2024)</td>
					<td>Anthropic (open standard, nov. 2024)</td>
				</tr>
			</tbody>
		</table>

		<!-- Cas concrets -->
		<h3 class="mcpp-h3">Cas concrets — qui tu utilises quand</h3>
		<div class="mcpp-cases">
			<div class="mcpp-case">
				<div class="mcpp-case-emoji">1️⃣</div>
				<h4>« Brancher un LLM à mon outil custom, point. »</h4>
				<p class="mcpp-case-q">Exemple : tu veux que Claude Desktop puisse interroger ta base CRM interne.</p>
				<p class="mcpp-case-a">
					→ <strong>MCP seul</strong> suffit. Tu écris un serveur MCP qui
					expose <code>search_crm()</code>, tu le déclares dans
					<code>claude_desktop_config.json</code>. Pas de LangGraph
					nécessaire — Claude Desktop EST déjà un agent (avec sa propre
					boucle de raisonnement).
				</p>
			</div>

			<div class="mcpp-case">
				<div class="mcpp-case-emoji">2️⃣</div>
				<h4>« Workflow multi-étapes avec branchements et boucles. »</h4>
				<p class="mcpp-case-q">Exemple : un assistant rédactionnel qui fait researcher → writer → reviewer → writer (correction) → reviewer.</p>
				<p class="mcpp-case-a">
					→ <strong>LangGraph seul</strong> peut suffire si les outils sont
					Python natifs et restent dans le même process. La logique
					d'orchestration est ce qui compte.
				</p>
			</div>

			<div class="mcpp-case mcpp-case-best">
				<div class="mcpp-case-emoji">3️⃣</div>
				<h4>« Stack production-grade modulaire. »</h4>
				<p class="mcpp-case-q">Exemple : ton agent défense — workflow complexe ET outils sensibles isolés.</p>
				<p class="mcpp-case-a">
					→ <strong>LangGraph + MCP</strong>. LangGraph orchestre la logique
					(classifier → branche RAG ou check_clearance → generate ou refuse).
					MCP isole chaque outil sensible dans son process avec ses propres
					permissions. Bonus : tu peux brancher Claude Desktop sur les
					mêmes serveurs MCP pour les opérateurs métier.
				</p>
				<p class="mcpp-case-best-badge">⭐ La combo la plus robuste</p>
			</div>
		</div>

		<!-- Mais alors LangGraph SANS MCP ? -->
		<Callout variant="info" title="❓ Mais LangGraph propose déjà des outils Python natifs. Pourquoi en plus MCP ?">
			<p>
				4 raisons concrètes pour ton projet souverain :
			</p>
			<ol>
				<li>
					<strong>Isolation de sécurité</strong>. Le serveur MCP
					<code>classifier_server.py</code> tourne avec un utilisateur dédié,
					ses propres permissions filesystem, son propre certificat mTLS.
					Les vulnérabilités y sont contenues. Avec un tool Python natif,
					une faille = compromission du process agent entier.
				</li>
				<li>
					<strong>Réutilisabilité cross-app</strong>. Le même
					<code>classifier_server.py</code> sert ton agent LangGraph (logique
					métier complexe) ET Claude Desktop (les opérateurs qui veulent
					juste interroger directement). Tu écris le code une fois.
				</li>
				<li>
					<strong>Mise à jour découplée</strong>. Tu améliores
					l'algo de classification ? Tu redéploies le serveur MCP, l'agent
					ne bouge pas. Inversement, tu mets à jour LangGraph, le serveur
					reste stable.
				</li>
				<li>
					<strong>Cross-language</strong>. Si demain tu veux que les
					opérateurs de la base classification (qui ont un legacy en .NET)
					écrivent leur propre serveur MCP, ils peuvent. Le SDK existe en
					C#. Le LangGraph reste en Python.
				</li>
			</ol>
		</Callout>

		<!-- Quand NE PAS faire MCP -->
		<Callout variant="warning" title="⚠️ Quand MCP est superflu (et où LangGraph seul gagne)">
			<ul>
				<li><strong>Outils 100% locaux et triviaux</strong> (calculatrice, manipulation de strings). Le coût d'infra MCP n'est pas justifié.</li>
				<li><strong>Prototype rapide / proof-of-concept</strong>. Reste sur des tools Python natifs LangChain le temps que la valeur soit démontrée.</li>
				<li><strong>Performance critique sub-milliseconde</strong>. La sérialisation JSON-RPC ajoute quelques ms ; si chaque ms compte, garde tout en process.</li>
				<li><strong>Pas de partage avec d'autres agents</strong>. Si tu sais que ton tool ne sera jamais utilisé ailleurs, MCP est over-engineered.</li>
			</ul>
		</Callout>

		<!-- Stack complète visualisée -->
		<h3 class="mcpp-h3">La stack complète pour ton projet souverain</h3>
		<div class="mcpp-stack">
			<svg viewBox="0 0 760 360" class="mcpp-stack-svg">
				<defs>
					<marker id="st-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
					</marker>
				</defs>

				<!-- User -->
				<g>
					<rect x="320" y="10" width="120" height="36" rx="8" fill="#1e293b" stroke="#22c55e" stroke-width="2" />
					<text x="380" y="33" text-anchor="middle" fill="#22c55e" font-family="monospace" font-size="13" font-weight="700">User</text>
				</g>
				<line x1="380" y1="46" x2="380" y2="68" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />

				<!-- LangGraph -->
				<g>
					<rect x="220" y="70" width="320" height="80" rx="10" fill="#1e293b" stroke="#a855f7" stroke-width="2" />
					<text x="380" y="95" text-anchor="middle" fill="#a855f7" font-family="monospace" font-size="14" font-weight="700">🦜 LangGraph — Orchestration</text>
					<text x="380" y="115" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="10">classifier → check_clearance → generate_answer</text>
					<text x="380" y="130" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="9">state, edges, cycles, audit_trail</text>
				</g>

				<!-- LiteLLM bridge -->
				<line x1="290" y1="150" x2="290" y2="172" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<g>
					<rect x="230" y="174" width="120" height="40" rx="8" fill="#1e293b" stroke="#facc15" stroke-width="2" />
					<text x="290" y="192" text-anchor="middle" fill="#facc15" font-family="monospace" font-size="11" font-weight="700">⚡ LiteLLM</text>
					<text x="290" y="206" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="9">routeur LLM</text>
				</g>
				<line x1="290" y1="214" x2="290" y2="236" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />

				<!-- MCP Client -->
				<line x1="470" y1="150" x2="470" y2="172" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<g>
					<rect x="410" y="174" width="120" height="40" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="2" />
					<text x="470" y="192" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="11" font-weight="700">🔌 MCP Client</text>
					<text x="470" y="206" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="9">JSON-RPC 2.0</text>
				</g>

				<!-- LLM (via LiteLLM) -->
				<g>
					<rect x="230" y="240" width="120" height="40" rx="8" fill="#1e293b" stroke="#fb923c" stroke-width="2" />
					<text x="290" y="258" text-anchor="middle" fill="#fb923c" font-family="monospace" font-size="11" font-weight="700">🦥 Mistral 7B</text>
					<text x="290" y="272" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="9">Ollama on-premise</text>
				</g>

				<!-- MCP Servers (via MCP) -->
				<line x1="470" y1="214" x2="370" y2="240" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<line x1="470" y1="214" x2="470" y2="240" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<line x1="470" y1="214" x2="570" y2="240" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<g>
					<rect x="320" y="244" width="100" height="36" rx="6" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
					<text x="370" y="266" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">classifier</text>
				</g>
				<g>
					<rect x="425" y="244" width="100" height="36" rx="6" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
					<text x="475" y="266" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">rag (Milvus)</text>
				</g>
				<g>
					<rect x="530" y="244" width="100" height="36" rx="6" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
					<text x="580" y="266" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="10">audit_log</text>
				</g>

				<!-- Backends -->
				<line x1="370" y1="280" x2="370" y2="302" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<line x1="475" y1="280" x2="475" y2="302" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<line x1="580" y1="280" x2="580" y2="302" stroke="#cbd5e1" stroke-width="1.5" marker-end="url(#st-arr)" />
				<g>
					<rect x="320" y="304" width="100" height="36" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1" />
					<text x="370" y="326" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="9">classif API</text>
				</g>
				<g>
					<rect x="425" y="304" width="100" height="36" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1" />
					<text x="475" y="326" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="9">Milvus DB</text>
				</g>
				<g>
					<rect x="530" y="304" width="100" height="36" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1" />
					<text x="580" y="326" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="9">Postgres audit</text>
				</g>

				<!-- Labels lattéraux -->
				<text x="40" y="100" fill="#a855f7" font-family="monospace" font-size="10" font-weight="700">Couche</text>
				<text x="40" y="115" fill="#a855f7" font-family="monospace" font-size="10" font-weight="700">orchestration</text>

				<text x="40" y="195" fill="#facc15" font-family="monospace" font-size="10" font-weight="700">Routage LLM</text>

				<text x="660" y="195" fill="#06b6d4" font-family="monospace" font-size="10" font-weight="700">Couche</text>
				<text x="660" y="210" fill="#06b6d4" font-family="monospace" font-size="10" font-weight="700">protocole</text>

				<text x="40" y="263" fill="#fb923c" font-family="monospace" font-size="10" font-weight="700">Génération</text>

				<text x="660" y="263" fill="#06b6d4" font-family="monospace" font-size="10" font-weight="700">Capacités</text>

				<text x="660" y="324" fill="#94a3b8" font-family="monospace" font-size="10" font-weight="700">Backends</text>
				<text x="660" y="338" fill="#94a3b8" font-family="monospace" font-size="10" font-weight="700">métier</text>
			</svg>
		</div>

		<Callout variant="insight" title="🧱 Lecture du schéma — chaque couche fait UN truc">
			<ul>
				<li><strong>LangGraph</strong> orchestre <em>« quand appeler quoi »</em>.</li>
				<li><strong>LiteLLM</strong> route les appels LLM <em>« quel modèle, quelle instance »</em>.</li>
				<li><strong>MCP Client</strong> traduit les tool_calls LangGraph en frames JSON-RPC.</li>
				<li><strong>MCP Servers</strong> exposent les capacités métier de manière isolée et standard.</li>
				<li><strong>Backends</strong> font le vrai travail (DB, API métier, etc.).</li>
			</ul>
			<p>
				Chaque couche est <strong>remplaçable indépendamment</strong>. Tu
				changes de framework agent ? Les serveurs MCP restent. Tu changes
				de LLM provider ? LiteLLM absorbe le choc. C'est de l'architecture
				découplée propre.
			</p>
		</Callout>
	</section>

	<!-- ============== 2. ARCHITECTURE ============== -->
	<section id="archi" class="mcpp-section">
		<h2 class="mcpp-h2">2️⃣ Architecture — 3 acteurs</h2>

		<div class="mcpp-archi">
			<svg viewBox="0 0 720 280" class="mcpp-archi-svg">
				<defs>
					<marker id="mc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
				</defs>

				<!-- Host -->
				<g>
					<rect x="20" y="80" width="200" height="120" rx="12" fill="#1e293b" stroke="#a855f7" stroke-width="2" />
					<text x="120" y="105" text-anchor="middle" font-family="monospace" font-size="13" fill="#a855f7" font-weight="700">Host</text>
					<text x="120" y="125" text-anchor="middle" font-family="monospace" font-size="10" fill="#94a3b8">(Claude Desktop, Cursor,</text>
					<text x="120" y="138" text-anchor="middle" font-family="monospace" font-size="10" fill="#94a3b8">ton agent LangGraph…)</text>
					<rect x="50" y="155" width="140" height="32" rx="6" fill="#0f172a" stroke="#a855f7" stroke-width="1" />
					<text x="120" y="175" text-anchor="middle" font-family="monospace" font-size="11" fill="#a855f7">MCP Client</text>
				</g>

				<!-- Arrow -->
				<line x1="220" y1="170" x2="280" y2="170" stroke="#fb923c" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mc-arrow)" />
				<text x="250" y="160" text-anchor="middle" font-family="monospace" font-size="9" fill="#fb923c">JSON-RPC</text>
				<line x1="280" y1="180" x2="220" y2="180" stroke="#22c55e" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mc-arrow)" />

				<!-- Server -->
				<g>
					<rect x="280" y="80" width="180" height="120" rx="12" fill="#1e293b" stroke="#06b6d4" stroke-width="2" />
					<text x="370" y="105" text-anchor="middle" font-family="monospace" font-size="13" fill="#06b6d4" font-weight="700">MCP Server</text>
					<text x="370" y="125" text-anchor="middle" font-family="monospace" font-size="10" fill="#94a3b8">(Python FastMCP,</text>
					<text x="370" y="138" text-anchor="middle" font-family="monospace" font-size="10" fill="#94a3b8">Node SDK…)</text>
					<rect x="295" y="155" width="150" height="32" rx="6" fill="#0f172a" stroke="#06b6d4" stroke-width="1" />
					<text x="370" y="175" text-anchor="middle" font-family="monospace" font-size="11" fill="#06b6d4">tools / resources / prompts</text>
				</g>

				<!-- Arrow to backend -->
				<line x1="460" y1="140" x2="540" y2="140" stroke="#94a3b8" stroke-width="2" marker-end="url(#mc-arrow)" />

				<!-- Backend -->
				<g>
					<rect x="540" y="80" width="160" height="120" rx="12" fill="#1e293b" stroke="#475569" stroke-width="2" />
					<text x="620" y="105" text-anchor="middle" font-family="monospace" font-size="13" fill="#cbd5e1" font-weight="700">Backend réel</text>
					<text x="620" y="125" text-anchor="middle" font-family="monospace" font-size="10" fill="#94a3b8">(DB, API métier,</text>
					<text x="620" y="138" text-anchor="middle" font-family="monospace" font-size="10" fill="#94a3b8">filesystem, microservice…)</text>
				</g>

				<!-- Labels -->
				<text x="120" y="240" text-anchor="middle" font-family="monospace" font-size="11" fill="#cbd5e1" font-weight="600">L'application</text>
				<text x="120" y="255" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">qui contient le LLM</text>

				<text x="370" y="240" text-anchor="middle" font-family="monospace" font-size="11" fill="#cbd5e1" font-weight="600">L'adaptateur MCP</text>
				<text x="370" y="255" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">qu'on écrit (ou existant)</text>

				<text x="620" y="240" text-anchor="middle" font-family="monospace" font-size="11" fill="#cbd5e1" font-weight="600">Le système réel</text>
				<text x="620" y="255" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">qu'on veut exposer</text>
			</svg>
		</div>

		<div class="mcpp-archi-grid">
			<div class="mcpp-archi-card">
				<div class="mcpp-archi-emoji">🦜</div>
				<h4>Host</h4>
				<p>L'application qui héberge le LLM (Claude Desktop, Cursor, ton agent LangGraph…). Elle embarque un <strong>MCP Client</strong>.</p>
			</div>
			<div class="mcpp-archi-card">
				<div class="mcpp-archi-emoji">🔌</div>
				<h4>MCP Server</h4>
				<p>Petit programme (Python, Node, Go…) qui expose des <strong>tools, resources, prompts</strong> en parlant JSON-RPC 2.0.</p>
			</div>
			<div class="mcpp-archi-card">
				<div class="mcpp-archi-emoji">⚙️</div>
				<h4>Backend réel</h4>
				<p>La base de données, le microservice, le système de fichiers — la logique métier qu'on veut rendre disponible au LLM.</p>
			</div>
		</div>
	</section>

	<!-- ============== 3. PRIMITIVES ============== -->
	<section id="primitives" class="mcpp-section">
		<h2 class="mcpp-h2">3️⃣ Les 3 primitives</h2>
		<p class="mcpp-lead">
			Un serveur MCP peut exposer 3 types de choses. La distinction est
			cruciale.
		</p>

		<div class="mcpp-primitives">
			<div class="mcpp-primitive">
				<div class="mcpp-primitive-emoji">🔧</div>
				<h3>Tools — actions</h3>
				<p>
					Des fonctions que le <strong>LLM décide d'appeler</strong> quand il
					juge que c'est nécessaire. Ils ont des effets de bord (écrire un
					fichier, requêter une API, modifier une DB).
				</p>
				<ul>
					<li><strong>Contrôle</strong> : modèle (le LLM choisit)</li>
					<li><strong>Exemples</strong> : <code>send_email</code>, <code>check_classification</code>, <code>git_commit</code></li>
					<li><strong>Méthodes</strong> : <code>tools/list</code>, <code>tools/call</code></li>
				</ul>
			</div>

			<div class="mcpp-primitive">
				<div class="mcpp-primitive-emoji">📚</div>
				<h3>Resources — données</h3>
				<p>
					Du contenu lisible (fichiers, lignes de DB, pages web…) que le
					<strong>client peut décider d'inclure</strong> dans le contexte du
					LLM. Sans effet de bord — c'est de la lecture.
				</p>
				<ul>
					<li><strong>Contrôle</strong> : application (le client choisit)</li>
					<li><strong>Exemples</strong> : <code>file:///docs/note.md</code>, <code>postgres://users/123</code></li>
					<li><strong>Méthodes</strong> : <code>resources/list</code>, <code>resources/read</code></li>
				</ul>
			</div>

			<div class="mcpp-primitive">
				<div class="mcpp-primitive-emoji">📝</div>
				<h3>Prompts — templates</h3>
				<p>
					Des modèles de prompts paramétrés que l'<strong>utilisateur peut
						invoquer explicitement</strong> (ex. via une commande slash
					dans Claude Desktop).
				</p>
				<ul>
					<li><strong>Contrôle</strong> : utilisateur (l'humain choisit)</li>
					<li><strong>Exemples</strong> : <code>/summarize_meeting</code>, <code>/code_review</code></li>
					<li><strong>Méthodes</strong> : <code>prompts/list</code>, <code>prompts/get</code></li>
				</ul>
			</div>
		</div>

		<Callout variant="info" title="💡 La règle mnémotechnique">
			<p>
				<strong>Tools</strong> = ce que le <em>modèle</em> peut faire.
				<strong>Resources</strong> = ce que le <em>client</em> peut lui
				donner. <strong>Prompts</strong> = ce que l'<em>utilisateur</em>
				peut invoquer. Trois acteurs, trois primitives.
			</p>
		</Callout>
	</section>

	<!-- ============== 4. PROTOCOLE ============== -->
	<section id="protocole" class="mcpp-section">
		<h2 class="mcpp-h2">4️⃣ Le protocole — JSON-RPC 2.0 sur stdio</h2>
		<p>
			Tous les échanges MCP sont des frames <strong>JSON-RPC 2.0</strong>
			(spec très légère, 2010). Voici les méthodes principales.
		</p>

		<table class="mcpp-methods-table">
			<thead>
				<tr><th>Méthode</th><th>Sens</th><th>Rôle</th></tr>
			</thead>
			<tbody>
				<tr><td><code>initialize</code></td><td>client → serveur</td><td>Premier handshake, échange des capabilities</td></tr>
				<tr><td><code>notifications/initialized</code></td><td>client → serveur</td><td>Confirme que l'init est bien reçu</td></tr>
				<tr><td><code>tools/list</code></td><td>client → serveur</td><td>Demande le catalogue des tools</td></tr>
				<tr><td><code>tools/call</code></td><td>client → serveur</td><td>Invoque un tool avec arguments</td></tr>
				<tr><td><code>resources/list</code></td><td>client → serveur</td><td>Demande les ressources disponibles</td></tr>
				<tr><td><code>resources/read</code></td><td>client → serveur</td><td>Lit le contenu d'une ressource</td></tr>
				<tr><td><code>prompts/list</code></td><td>client → serveur</td><td>Demande les templates disponibles</td></tr>
				<tr><td><code>prompts/get</code></td><td>client → serveur</td><td>Récupère un template paramétré</td></tr>
				<tr><td><code>notifications/progress</code></td><td>serveur → client</td><td>Mise à jour de progression (tool long)</td></tr>
				<tr><td><code>logging/setLevel</code></td><td>client → serveur</td><td>Configure la verbosité serveur</td></tr>
			</tbody>
		</table>

		<Callout variant="note" title="📌 Tout est typé">
			<p>
				Chaque tool/resource/prompt expose un <strong>JSON Schema</strong>
				pour ses arguments. Le client peut le présenter au LLM tel quel
				— c'est ce qui permet au modèle de générer des appels valides
				sans deviner.
			</p>
		</Callout>
	</section>

	<!-- ============== 5. SIMULATEUR ============== -->
	<section id="simulator" class="mcpp-section">
		<h2 class="mcpp-h2">5️⃣ Simulateur — MCP × LangGraph en direct ⭐</h2>
		<p>
			Voici le scénario complet : un agent LangGraph défense interroge
			via MCP un serveur de classification. <strong>11 étapes</strong>
			depuis le « tool_call » du LLM jusqu'au résultat final, avec les
			frames JSON-RPC réelles dans la vue technique.
		</p>

		<div class="mcpp-sim-wrapper not-prose">
			<MCPSimulator />
		</div>

		<Callout variant="insight" title="🎯 À observer dans la vue Technique">
			<ul>
				<li><strong>Étape 1</strong> : le payload <code>initialize</code> avec <code>protocolVersion: "2024-11-05"</code> et la négociation de capabilities.</li>
				<li><strong>Étape 2</strong> : la réponse serveur — il déclare <code>tools</code> mais pas <code>resources</code>, le client le sait pour la suite.</li>
				<li><strong>Étape 3</strong> : la <strong>notification</strong> (sans <code>id</code>) — fire-and-forget, distinguée d'une requête.</li>
				<li><strong>Étape 5</strong> : le JSON Schema complet du tool — <code>required: ["program"]</code>, type string, description… c'est ce que le LLM voit et utilise.</li>
				<li><strong>Étape 7</strong> : la traduction <code>tool_call</code> LangChain → <code>tools/call</code> JSON-RPC.</li>
				<li><strong>Étape 8</strong> : le code Python du serveur qui s'exécute pour de vrai (mTLS vers la base classifications).</li>
			</ul>
		</Callout>
	</section>

	<!-- ============== 6. INTÉGRATION ============== -->
	<section id="integration" class="mcpp-section">
		<h2 class="mcpp-h2">6️⃣ Intégration concrète — LangGraph + MCP pour ton agent défense</h2>
		<p class="mcpp-lead">
			Voici comment, dans ton vrai projet souverain, tu transformes des
			outils Python LangGraph natifs en outils MCP. Le bénéfice : tu peux
			<strong>partager ces serveurs</strong> entre plusieurs agents (LangGraph,
			Claude Desktop pour les opérateurs, Cursor pour les devs…) et tu
			isoles la logique sensible dans des processus séparés.
		</p>

		<h3 class="mcpp-h3">Avant (sans MCP) — outils Python directs</h3>
		<pre class="mcpp-code"><code>{`from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

@tool
def check_classification(program: str) -> str:
    """Vérifie le niveau de classification d'un programme."""
    # appel mTLS direct au microservice
    resp = secure_client.get(f"https://classif.intranet/api/programs/{program}", ...)
    return resp.json()["classification"]

@tool
def search_docs(query: str, max_classification: str) -> str:
    """RAG filtré par habilitation."""
    # ... qdrant search ...

# L'agent voit ces tools "en dur" dans le même process
tools = [check_classification, search_docs]
agent = create_react_agent(llm, tools)`}</code></pre>

		<p>
			<strong>Limites</strong> : ces tools vivent dans le même process
			que le LLM. Si tu veux les utiliser depuis Claude Desktop ou un
			autre agent, il faut tout réécrire.
		</p>

		<h3 class="mcpp-h3">Après (avec MCP) — serveurs séparés, agent universel</h3>
		<pre class="mcpp-code"><code>{`# === Côté serveur MCP — un fichier par domaine ===
# /srv/mcp/classifier_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("classifier")

@mcp.tool()
def check_classification(program: str) -> str:
    """Vérifie le niveau de classification d'un programme."""
    resp = secure_client.get(f"https://classif.intranet/api/programs/{program}", ...)
    return resp.json()["classification"]

if __name__ == "__main__":
    mcp.run(transport="stdio")  # le serveur écoute sur stdin/stdout`}</code></pre>

		<pre class="mcpp-code"><code>{`# /srv/mcp/rag_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("rag")

@mcp.tool()
def search_docs(query: str, max_classification: str) -> str:
    """RAG filtré par habilitation."""
    # ... qdrant search ...
    return results

if __name__ == "__main__":
    mcp.run(transport="stdio")`}</code></pre>

		<pre class="mcpp-code"><code>{`# === Côté agent LangGraph — utilise les serveurs MCP via adapter ===
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent
from langchain_ollama import ChatOllama

async def main():
    llm = ChatOllama(model="mistral-defense:latest")

    async with MultiServerMCPClient({
        "classifier": {
            "command": "python",
            "args": ["/srv/mcp/classifier_server.py"],
            "transport": "stdio",
        },
        "rag": {
            "command": "python",
            "args": ["/srv/mcp/rag_server.py"],
            "transport": "stdio",
        },
        # On peut aussi ajouter des serveurs MCP officiels :
        "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data/docs"],
            "transport": "stdio",
        }
    }) as client:
        # Récupère les tools de TOUS les serveurs en une seule liste
        tools = client.get_tools()

        # L'agent ne voit aucune différence avec les tools natifs
        agent = create_react_agent(llm, tools)

        result = await agent.ainvoke({
            "messages": [HumanMessage(content="Classification de Persée ?")]
        })
        print(result["messages"][-1].content)

asyncio.run(main())`}</code></pre>

		<Callout variant="insight" title="🎯 Bénéfices concrets pour ton projet">
			<ul>
				<li><strong>Réutilisabilité</strong> — le même <code>classifier_server.py</code> sert à ton agent LangGraph ET à Claude Desktop pour les opérateurs.</li>
				<li><strong>Isolation de sécurité</strong> — la logique mTLS vit dans un processus séparé, supervisé, redémarrable, avec ses propres permissions filesystem.</li>
				<li><strong>Audit centralisé</strong> — chaque serveur MCP est un point unique de logging des appels métier (1 process = 1 log clair).</li>
				<li><strong>Mise à l'échelle</strong> — tu peux aisément déployer un serveur MCP en SSE/HTTP pour qu'il serve plusieurs agents distants.</li>
				<li><strong>Composition</strong> — tu mélanges tes serveurs custom avec des serveurs MCP officiels (filesystem, github, postgres…) sans réécrire de code.</li>
			</ul>
		</Callout>

		<Callout variant="warning" title="🔐 Sécurité des serveurs MCP locaux">
			<p>
				En transport <code>stdio</code>, le serveur MCP tourne avec les
				droits de l'agent. Pour ton cas défense :
			</p>
			<ul>
				<li>Lance chaque serveur MCP avec un utilisateur dédié à privilèges minimaux.</li>
				<li>Ne stocke jamais de secrets en clair dans les arguments — passe par variables d'environnement.</li>
				<li>Audit chaque appel <code>tools/call</code> côté serveur (même endpoint que ton audit normal).</li>
				<li>Pour des serveurs distribués, utilise transport HTTP avec mTLS — pas SSE en clair.</li>
			</ul>
		</Callout>
	</section>

	<!-- ============== 7. CONSTRUIRE SON SERVEUR ============== -->
	<section id="serveur" class="mcpp-section">
		<h2 class="mcpp-h2">7️⃣ Construire ton premier serveur MCP — 15 minutes</h2>
		<p>
			Pour t'entraîner, voici le serveur le plus simple possible : un
			outil qui retourne l'heure courante. Tu peux le tester avec Claude
			Desktop directement.
		</p>

		<div class="mcpp-substeps">
			<div class="mcpp-substep"><strong>1.</strong> Installe le SDK : <code>pip install "mcp[cli]"</code></div>
			<div class="mcpp-substep"><strong>2.</strong> Crée <code>time_server.py</code> :</div>
		</div>

		<pre class="mcpp-code"><code>{`# time_server.py
from datetime import datetime
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("time-server")

@mcp.tool()
def current_time(timezone: str = "Europe/Paris") -> str:
    """Retourne l'heure courante dans la timezone indiquée."""
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo(timezone)).isoformat()

@mcp.resource("time://now")
def now_resource() -> str:
    """L'heure actuelle accessible comme resource."""
    return datetime.now().isoformat()

if __name__ == "__main__":
    mcp.run(transport="stdio")`}</code></pre>

		<div class="mcpp-substeps">
			<div class="mcpp-substep"><strong>3.</strong> Teste avec l'inspector officiel :</div>
		</div>
		<pre class="mcpp-code"><code>{`npx @modelcontextprotocol/inspector python time_server.py
# Ouvre une UI sur http://localhost:5173 pour explorer ton serveur`}</code></pre>

		<div class="mcpp-substeps">
			<div class="mcpp-substep"><strong>4.</strong> Branche-le sur Claude Desktop : édite <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (ou équivalent Windows) :</div>
		</div>
		<pre class="mcpp-code"><code>{`{
  "mcpServers": {
    "time": {
      "command": "python",
      "args": ["/absolute/path/to/time_server.py"]
    }
  }
}`}</code></pre>

		<p>
			Redémarre Claude Desktop. Ton tool <code>current_time</code> est
			maintenant disponible dans toutes les conversations Claude. Demande
			« Quelle heure est-il à Tokyo ? » → Claude appelle ton serveur.
		</p>

		<Callout variant="insight" title="🎓 Tu sais maintenant">
			<ul>
				<li>Pourquoi MCP existe (problème N×M)</li>
				<li>L'architecture (Host / Client / Server / Backend)</li>
				<li>Les 3 primitives (Tools / Resources / Prompts)</li>
				<li>Le protocole technique (JSON-RPC 2.0 sur stdio)</li>
				<li>Comment intégrer MCP dans LangGraph (langchain-mcp-adapters)</li>
				<li>Comment écrire ton propre serveur (FastMCP)</li>
			</ul>
			<p>
				Pour ton projet souverain : prochaine étape, externaliser
				<code>check_classification</code> et <code>search_docs</code> en
				serveurs MCP isolés, et brancher l'agent dessus via
				<code>MultiServerMCPClient</code>.
			</p>
		</Callout>
	</section>

	<!-- ============== 8. GLOSSAIRE ============== -->
	<section id="glossaire" class="mcpp-section">
		<h2 class="mcpp-h2">8️⃣ Glossaire</h2>
		<dl class="mcpp-glossary">
			<div class="mcpp-gl-row"><dt>Capabilities</dt><dd>Liste des fonctionnalités déclarées par chaque côté à l'initialisation.</dd></div>
			<div class="mcpp-gl-row"><dt>Client</dt><dd>Composant côté Host qui parle MCP. Peut gérer plusieurs connexions à plusieurs Servers.</dd></div>
			<div class="mcpp-gl-row"><dt>FastMCP</dt><dd>Le SDK Python de référence pour écrire un serveur MCP. Décorateurs <code>@tool</code>, <code>@resource</code>, <code>@prompt</code>.</dd></div>
			<div class="mcpp-gl-row"><dt>Host</dt><dd>L'application qui contient le LLM et le Client (Claude Desktop, Cursor, ton agent).</dd></div>
			<div class="mcpp-gl-row"><dt>JSON-RPC 2.0</dt><dd>Protocole RPC simple sur JSON. Format des messages MCP.</dd></div>
			<div class="mcpp-gl-row"><dt>JSON Schema</dt><dd>Standard pour décrire la structure des arguments d'un tool.</dd></div>
			<div class="mcpp-gl-row"><dt>langchain-mcp-adapters</dt><dd>Package Python qui fait le pont entre l'écosystème LangChain/LangGraph et MCP.</dd></div>
			<div class="mcpp-gl-row"><dt>MCP Inspector</dt><dd>UI officielle (<code>@modelcontextprotocol/inspector</code>) pour tester un serveur MCP en standalone.</dd></div>
			<div class="mcpp-gl-row"><dt>MultiServerMCPClient</dt><dd>Client LangChain qui se connecte à plusieurs serveurs MCP en parallèle et expose tous leurs tools comme une seule liste.</dd></div>
			<div class="mcpp-gl-row"><dt>Notification</dt><dd>Message JSON-RPC sans <code>id</code>. Fire-and-forget, pas de réponse attendue.</dd></div>
			<div class="mcpp-gl-row"><dt>Primitive</dt><dd>Type de chose qu'un serveur MCP peut exposer : tool, resource, prompt.</dd></div>
			<div class="mcpp-gl-row"><dt>Prompt (MCP)</dt><dd>Template de prompt paramétré, invoqué explicitement par l'utilisateur (commande slash).</dd></div>
			<div class="mcpp-gl-row"><dt>Resource (MCP)</dt><dd>Données lisibles que le client peut décider d'inclure dans le contexte LLM.</dd></div>
			<div class="mcpp-gl-row"><dt>SSE (Server-Sent Events)</dt><dd>Transport HTTP unidirectionnel pour MCP distant (déprécié au profit de Streamable HTTP).</dd></div>
			<div class="mcpp-gl-row"><dt>stdio</dt><dd>Transport le plus utilisé : le client lance le serveur en sous-processus, communication via stdin/stdout.</dd></div>
			<div class="mcpp-gl-row"><dt>Streamable HTTP</dt><dd>Transport HTTP moderne pour MCP, succède à SSE. POST + streams.</dd></div>
			<div class="mcpp-gl-row"><dt>Tool (MCP)</dt><dd>Fonction qu'un serveur expose et que le LLM peut décider d'appeler.</dd></div>
			<div class="mcpp-gl-row"><dt>Transport</dt><dd>Le canal sur lequel circulent les frames (stdio, SSE, Streamable HTTP).</dd></div>
		</dl>
	</section>
</article>

<style>
	.mcpp {
		max-width: 1240px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		display: flex; flex-direction: column; gap: 2rem;
	}
	.mcpp :global(p), .mcpp :global(.mcpp-lead) { max-width: 880px; }
	.mcpp-sim-wrapper { max-width: none; }

	.mcpp-hero {
		text-align: center; padding: 2rem 1.5rem;
		background: linear-gradient(135deg, #f0f9ff 0%, #fff 100%);
		border-radius: 1.5rem; border: 1px solid #93c5fd;
	}
	.mcpp-hero-emoji { font-size: 4rem; display: block; }
	.mcpp-h1 {
		font-family: var(--font-display); font-size: 2.25rem; font-weight: 700;
		color: var(--color-ink-900); margin: 0.5rem 0 0;
	}
	.mcpp-hero-lead {
		font-size: 1rem; color: var(--color-ink-700); max-width: 660px;
		margin: 0.85rem auto 1.5rem; line-height: 1.6;
	}
	.mcpp-hero-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.mcpp-cta {
		padding: 0.7rem 1.5rem; border-radius: 999px; text-decoration: none; font-weight: 500;
	}
	.mcpp-cta-primary { background: #06b6d4; color: white; }
	.mcpp-cta-secondary { background: #fff; color: var(--color-ink-900); border: 2px solid #06b6d4; }

	.mcpp-toc {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem 1.5rem;
	}
	.mcpp-toc-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem;
	}
	.mcpp-toc-list {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0;
	}
	.mcpp-toc-list a { color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem; }
	.mcpp-toc-list a:hover { color: #06b6d4; }

	.mcpp-section {
		display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 80px;
	}
	.mcpp-h2 {
		font-family: var(--font-display); font-size: 1.6rem; font-weight: 700;
		color: var(--color-ink-900); margin: 0;
	}
	.mcpp-h3 {
		font-family: var(--font-display); font-size: 1.15rem; font-weight: 600;
		color: var(--color-ink-900); margin: 1rem 0 0.5rem;
	}
	.mcpp-lead {
		font-size: 1rem; color: var(--color-ink-700); line-height: 1.6; margin: 0;
	}

	.mcpp-prereq-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem;
	}
	.mcpp-prereq {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden;
	}
	.mcpp-prereq summary {
		cursor: pointer; padding: 0.85rem 1rem; font-family: var(--font-display);
		font-weight: 600; font-size: 0.95rem; color: var(--color-ink-900);
		list-style: none;
	}
	.mcpp-prereq summary::-webkit-details-marker { display: none; }
	.mcpp-prereq summary::after {
		content: '▶'; float: right; color: var(--color-ink-500); font-size: 0.7rem;
		transition: transform 0.15s;
	}
	.mcpp-prereq[open] summary::after { transform: rotate(90deg); }
	.mcpp-prereq[open] summary { border-bottom: 1px solid #e2e8f0; background: #f0f9ff; }
	.mcpp-prereq > div {
		padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6;
	}
	.mcpp-prereq > div p { margin: 0 0 0.5rem; }
	.mcpp-prereq > div p:last-child { margin-bottom: 0; }
	.mcpp-prereq ul { margin: 0.4rem 0; padding-left: 1.25rem; }

	.mcpp-problem {
		display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: stretch;
	}
	@media (max-width: 720px) { .mcpp-problem { grid-template-columns: 1fr; } }
	.mcpp-problem-before, .mcpp-problem-after {
		padding: 1rem 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
	}
	.mcpp-problem-before { border-left: 4px solid #dc2626; }
	.mcpp-problem-after { border-left: 4px solid #22c55e; background: #f0fdf4; }
	.mcpp-problem h4 {
		font-family: var(--font-display); font-size: 1.05rem; margin: 0 0 0.5rem;
		color: var(--color-ink-900);
	}
	.mcpp-problem p { font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; margin: 0 0 0.5rem; }
	.mcpp-problem-arrow {
		display: flex; align-items: center; justify-content: center;
		font-size: 2.5rem; color: var(--color-hf-amber); font-weight: 700;
	}

	.mcpp-archi {
		background: #0f172a; border-radius: 0.75rem; padding: 0.75rem;
	}
	.mcpp-archi-svg { width: 100%; height: auto; max-height: 300px; }
	.mcpp-archi-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.6rem;
	}
	.mcpp-archi-card {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem;
	}
	.mcpp-archi-emoji { font-size: 1.75rem; }
	.mcpp-archi-card h4 {
		font-family: var(--font-display); font-size: 1rem; margin: 0.25rem 0 0.4rem;
		color: var(--color-ink-900);
	}
	.mcpp-archi-card p { font-size: 0.88rem; color: var(--color-ink-700); margin: 0; line-height: 1.55; }

	.mcpp-primitives {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem;
	}
	.mcpp-primitive {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.1rem;
	}
	.mcpp-primitive-emoji { font-size: 2rem; }
	.mcpp-primitive h3 {
		font-family: var(--font-display); font-size: 1.1rem; margin: 0.4rem 0 0.5rem;
		color: var(--color-ink-900);
	}
	.mcpp-primitive p { font-size: 0.92rem; color: var(--color-ink-700); line-height: 1.6; margin: 0 0 0.5rem; }
	.mcpp-primitive ul { margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: var(--color-ink-700); }
	.mcpp-primitive li { margin: 0.25rem 0; }

	.mcpp-methods-table {
		width: 100%; border-collapse: collapse; font-size: 0.88rem;
		background: #fff; border-radius: 0.5rem; overflow: hidden;
	}
	.mcpp-methods-table thead { background: #f0f9ff; }
	.mcpp-methods-table th {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.05em; color: var(--color-ink-700); text-align: left;
		padding: 0.5rem 0.7rem;
	}
	.mcpp-methods-table td {
		padding: 0.45rem 0.7rem; border-bottom: 1px solid #f1f5f9;
		color: var(--color-ink-700); vertical-align: top;
	}
	.mcpp-methods-table code {
		background: #e0f2fe; color: #0369a1; padding: 0.1rem 0.4rem;
		border-radius: 0.25rem; font-size: 0.8em;
	}

	.mcpp-code {
		background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem;
		border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem;
		line-height: 1.6; overflow-x: auto; margin: 0.5rem 0;
		white-space: pre-wrap; word-break: break-word;
	}

	.mcpp-substeps { display: flex; flex-direction: column; gap: 0.4rem; }
	.mcpp-substep {
		padding: 0.5rem 0.85rem; background: #f0f9ff; border-radius: 0.5rem;
		font-size: 0.9rem; color: var(--color-ink-700);
	}
	.mcpp-substep strong { color: #06b6d4; margin-right: 0.4rem; }

	.mcpp-glossary { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.mcpp-gl-row {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem;
		padding: 0.65rem 1rem; display: grid; grid-template-columns: 220px 1fr; gap: 1rem;
	}
	.mcpp-gl-row dt { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: #06b6d4; }
	.mcpp-gl-row dd { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	.mcpp-gl-row dd code {
		background: #e0f2fe; padding: 0.1rem 0.35rem; border-radius: 0.25rem;
		font-family: var(--font-mono); font-size: 0.85em;
	}
	@media (max-width: 600px) {
		.mcpp-gl-row { grid-template-columns: 1fr; gap: 0.25rem; }
	}

	/* ===== MCP vs LangGraph section ===== */
	.mcpp-analogy {
		display: flex; gap: 1rem; align-items: flex-start;
		padding: 1.25rem; background: var(--color-hf-cream);
		border-left: 4px solid var(--color-hf-amber); border-radius: 0.75rem;
	}
	.mcpp-analogy-emoji { font-size: 2rem; flex-shrink: 0; }
	.mcpp-analogy h4 {
		font-family: var(--font-display); font-size: 1.05rem; margin: 0 0 0.5rem;
		color: var(--color-ink-900);
	}
	.mcpp-analogy p {
		margin: 0 0 0.5rem; font-size: 0.92rem; color: var(--color-ink-700); line-height: 1.6;
	}
	.mcpp-analogy p:last-child { margin-bottom: 0; }

	.mcpp-layers {
		display: flex; flex-direction: column; align-items: stretch; gap: 0.4rem;
		max-width: 720px; margin: 0 auto;
	}
	.mcpp-layer {
		display: flex; gap: 0.85rem; align-items: center;
		padding: 0.85rem 1.1rem; background: #fff; border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
	}
	.mcpp-layer-app { border-left: 4px solid #22c55e; }
	.mcpp-layer-graph { border-left: 4px solid #a855f7; }
	.mcpp-layer-llm { border-left: 4px solid #fb923c; }
	.mcpp-layer-protocol { border-left: 4px solid #06b6d4; background: #f0f9ff; }
	.mcpp-layer-tools { border-left: 4px solid #475569; }
	.mcpp-layer-emoji { font-size: 1.6rem; flex-shrink: 0; }
	.mcpp-layer-body { display: flex; flex-direction: column; gap: 0.15rem; }
	.mcpp-layer-body strong {
		font-family: var(--font-display); font-size: 0.95rem; color: var(--color-ink-900);
	}
	.mcpp-layer-body span { font-size: 0.83rem; color: var(--color-ink-500); line-height: 1.5; }
	.mcpp-layer-arrow {
		text-align: center; font-size: 1.2rem; color: var(--color-ink-300);
		font-weight: 700;
	}

	.mcpp-vs-table {
		width: 100%; border-collapse: collapse; font-size: 0.88rem;
		background: #fff; border-radius: 0.5rem; overflow: hidden;
		border: 1px solid #e2e8f0;
	}
	.mcpp-vs-table thead { background: #f8fafc; }
	.mcpp-vs-table th {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: var(--color-ink-700); text-align: left; padding: 0.6rem 0.7rem;
		border-bottom: 2px solid #e2e8f0;
	}
	.mcpp-vs-table th:nth-child(2) { color: #a855f7; }
	.mcpp-vs-table th:nth-child(3) { color: #06b6d4; }
	.mcpp-vs-table td {
		padding: 0.55rem 0.7rem; border-bottom: 1px solid #f1f5f9;
		color: var(--color-ink-700); vertical-align: top;
	}
	.mcpp-vs-table td:first-child { width: 180px; }

	.mcpp-cases {
		display: flex; flex-direction: column; gap: 0.75rem;
	}
	.mcpp-case {
		padding: 1rem 1.25rem; background: #fff; border: 1px solid #e2e8f0;
		border-radius: 0.75rem; position: relative;
	}
	.mcpp-case-best {
		border: 2px solid var(--color-hf-amber);
		background: linear-gradient(180deg, #fff9e6 0%, #fff 100%);
	}
	.mcpp-case-emoji { font-size: 1.5rem; }
	.mcpp-case h4 {
		font-family: var(--font-display); font-size: 1.05rem; margin: 0.3rem 0 0.5rem;
		color: var(--color-ink-900);
	}
	.mcpp-case-q {
		font-style: italic; color: var(--color-ink-500); font-size: 0.88rem;
		margin: 0 0 0.4rem;
	}
	.mcpp-case-a {
		color: var(--color-ink-700); font-size: 0.92rem; line-height: 1.6; margin: 0;
	}
	.mcpp-case-best-badge {
		position: absolute; top: 0.6rem; right: 0.85rem;
		background: var(--color-hf-amber); color: #fff;
		font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
		padding: 0.2rem 0.5rem; border-radius: 999px;
	}

	.mcpp-stack {
		background: #0f172a; border-radius: 0.75rem; padding: 1rem;
	}
	.mcpp-stack-svg { width: 100%; height: auto; max-height: 380px; }
</style>
