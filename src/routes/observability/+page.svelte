<!--
	/observability — Lab d'observability LLM : Langfuse & LangSmith.
	Cas d'usage central : agent LangGraph défense avec tracing self-hosted.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';
</script>

<svelte:head><title>Observability LLM — Langfuse & LangSmith</title></svelte:head>

<article class="obs">
	<!-- HÉROS -->
	<header class="obs-hero">
		<span class="obs-hero-emoji">📊</span>
		<h1 class="obs-h1">Observability LLM — Langfuse & LangSmith</h1>
		<p class="obs-hero-lead">
			Tu déploies un agent LangGraph en prod. Question :
			<em>« comment tu sais que ça marche encore demain ? »</em>. Réponse :
			tu <strong>traces, évalues, surveilles</strong>. Ce sont les rôles
			de Langfuse (open-source, self-host friendly) et LangSmith (l'offre
			intégrée de LangChain). Cette page compare les deux et te montre
			l'intégration concrète sur ton agent défense.
		</p>
		<div class="obs-hero-actions">
			<a href="#vs" class="obs-cta obs-cta-primary">⚖️ Comparaison directe</a>
			<a href="#integration" class="obs-cta obs-cta-secondary">⚡ Intégration LangGraph</a>
		</div>
	</header>

	<!-- TOC -->
	<nav class="obs-toc">
		<p class="obs-toc-label">📍 Parcours</p>
		<ol class="obs-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#pourquoi">1. Pourquoi observer un LLM en prod</a></li>
			<li><a href="#concepts">2. Les concepts communs (trace, span, eval)</a></li>
			<li><a href="#vs">3. Langfuse vs LangSmith — choisir ⭐</a></li>
			<li><a href="#langfuse">4. Langfuse en détail</a></li>
			<li><a href="#langsmith">5. LangSmith en détail</a></li>
			<li><a href="#integration">6. Intégration LangGraph (côté Langfuse + LangSmith) ⚡</a></li>
			<li><a href="#sovereign">7. Setup souverain — Langfuse self-hosted air-gap</a></li>
			<li><a href="#glossaire">8. Glossaire</a></li>
		</ol>
	</nav>

	<!-- ============== 0. PRÉREQUIS ============== -->
	<section id="prereq" class="obs-section">
		<h2 class="obs-h2">0️⃣ Avant de commencer</h2>
		<div class="obs-prereq-grid">
			<details class="obs-prereq">
				<summary>📡 Tracing distributed</summary>
				<div>
					<p>
						Concept emprunté à l'APM classique (Datadog, Honeycomb) :
						chaque opération laisse une trace structurée — qui a appelé
						quoi, avec quels arguments, combien de temps ça a pris, qu'est-ce
						qui en est sorti. Pour les LLMs, on trace : prompts envoyés,
						réponses reçues, tokens consommés, coût, tool calls.
					</p>
				</div>
			</details>
			<details class="obs-prereq">
				<summary>🌳 Trace, Span, Run</summary>
				<div>
					<p>
						<strong>Trace</strong> = une interaction utilisateur de bout en
						bout (= une session de conversation, une exécution d'agent).
						<strong>Span</strong> (Langfuse / OTel) ou <strong>Run</strong>
						(LangSmith) = une opération unitaire dans une trace (1 appel
						LLM, 1 tool call, 1 retrieval RAG). Une trace contient
						plusieurs spans imbriqués.
					</p>
				</div>
			</details>
			<details class="obs-prereq">
				<summary>📏 Score / Évaluation</summary>
				<div>
					<p>
						Une <strong>note</strong> (numérique, booléenne ou catégorielle)
						attachée à une trace ou un span. Sources possibles :
						<strong>LLM-as-judge</strong> (un autre LLM note la qualité),
						<strong>feedback utilisateur</strong> (👍/👎), annotation
						humaine, métrique programmatique (regex, longueur, schema
						JSON valide).
					</p>
				</div>
			</details>
			<details class="obs-prereq">
				<summary>🗂️ Dataset + Experiment</summary>
				<div>
					<p>
						<strong>Dataset</strong> = collection de paires (input, output
						attendu) pour évaluation systématique. <strong>Experiment</strong>
						= un run du dataset sur ta version courante de l'agent, qui
						produit des scores. Permet la non-régression : « la nouvelle
						version est-elle meilleure que l'ancienne sur 100 cas
						métier ? ».
					</p>
				</div>
			</details>
			<details class="obs-prereq">
				<summary>📝 Prompt management</summary>
				<div>
					<p>
						Versionner tes prompts (system, user templates) dans un système
						séparé du code. Bénéfices : non-tech peuvent les éditer, A/B
						testing prompts en prod, rollback rapide. Langfuse et
						LangSmith offrent un éditeur web + un client SDK qui
						récupère le prompt par nom + version.
					</p>
				</div>
			</details>
			<details class="obs-prereq">
				<summary>🔌 OpenTelemetry (OTel)</summary>
				<div>
					<p>
						Standard CNCF pour le tracing distribué. Langfuse l'implémente
						nativement — tu peux router tes traces LLM vers Langfuse
						<strong>en plus</strong> de ton stack APM existant. LangSmith
						a un format propriétaire mais plus aligné avec LangChain.
					</p>
				</div>
			</details>
		</div>
	</section>

	<!-- ============== 1. POURQUOI ============== -->
	<section id="pourquoi" class="obs-section">
		<h2 class="obs-h2">1️⃣ Pourquoi observer un LLM en prod</h2>

		<div class="obs-why-grid">
			<div class="obs-why-card">
				<div class="obs-why-emoji">🐛</div>
				<h4>Debugger l'inattendu</h4>
				<p>
					Un agent qui a 5 nœuds, 3 outils, 10 itérations possibles. Quand
					ça plante en prod, sans trace tu n'as RIEN. Tracing = tu vois
					exactement quel prompt a généré quel output, à quelle étape.
				</p>
			</div>
			<div class="obs-why-card">
				<div class="obs-why-emoji">📉</div>
				<h4>Détecter les régressions</h4>
				<p>
					Tu changes ton prompt → tes scores chutent de 20 % sur ton
					dataset d'éval. Tu le sais en 5 minutes au lieu de 2 semaines
					(retours utilisateurs furieux).
				</p>
			</div>
			<div class="obs-why-card">
				<div class="obs-why-emoji">💰</div>
				<h4>Maîtriser le coût</h4>
				<p>
					Un user qui consomme 1000× la moyenne ? Un nœud qui boucle 50 fois
					avant de s'arrêter ? Sans observation tu paies en silence.
				</p>
			</div>
			<div class="obs-why-card">
				<div class="obs-why-emoji">🔍</div>
				<h4>Audit de conformité</h4>
				<p>
					Pour ton projet défense : ANSSI/CNIL veulent savoir <em>« qui a
					demandé quoi à l'agent, qui a refusé, pourquoi »</em>. Le
					tracing produit cette trace immutable.
				</p>
			</div>
			<div class="obs-why-card">
				<div class="obs-why-emoji">⚡</div>
				<h4>Optimiser la latence</h4>
				<p>
					Visualisation timeline → tu vois que 80 % du temps est dans
					retrieve_rag. Tu sais où optimiser.
				</p>
			</div>
			<div class="obs-why-card">
				<div class="obs-why-emoji">🎓</div>
				<h4>Itérer rigoureusement</h4>
				<p>
					Datasets + experiments = tu peux dire avec confiance « la
					version 2 est 12 % meilleure que la 1 sur 200 cas-test ». Sans
					ça, c'est du <em>vibe-driven development</em>.
				</p>
			</div>
		</div>
	</section>

	<!-- ============== 2. CONCEPTS ============== -->
	<section id="concepts" class="obs-section">
		<h2 class="obs-h2">2️⃣ Les concepts communs</h2>
		<p>
			Langfuse et LangSmith partagent le même modèle mental, avec des noms
			parfois différents.
		</p>

		<div class="obs-concept-diagram">
			<svg viewBox="0 0 720 280" class="obs-concept-svg">
				<defs>
					<marker id="oc-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
				</defs>

				<!-- Trace -->
				<rect x="20" y="20" width="680" height="60" rx="10" fill="#1e293b" stroke="#a855f7" stroke-width="2" />
				<text x="40" y="42" fill="#a855f7" font-family="monospace" font-size="13" font-weight="700">📦 Trace</text>
				<text x="40" y="62" fill="#cbd5e1" font-family="monospace" font-size="10">une interaction utilisateur complète (= une exécution d'agent, une session de chat)</text>

				<!-- Spans -->
				<rect x="40" y="100" width="200" height="50" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
				<text x="60" y="120" fill="#06b6d4" font-family="monospace" font-size="11" font-weight="700">🔧 Span / Run</text>
				<text x="60" y="138" fill="#cbd5e1" font-family="monospace" font-size="9">retrieve_rag(query)</text>

				<rect x="260" y="100" width="200" height="50" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
				<text x="280" y="120" fill="#06b6d4" font-family="monospace" font-size="11" font-weight="700">🔧 Span / Run</text>
				<text x="280" y="138" fill="#cbd5e1" font-family="monospace" font-size="9">llm_call (Mistral)</text>

				<rect x="480" y="100" width="200" height="50" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="1.5" />
				<text x="500" y="120" fill="#06b6d4" font-family="monospace" font-size="11" font-weight="700">🔧 Span / Run</text>
				<text x="500" y="138" fill="#cbd5e1" font-family="monospace" font-size="9">tool: check_classification</text>

				<!-- Scores et metadata -->
				<rect x="40" y="170" width="200" height="40" rx="6" fill="#1e293b" stroke="#fb923c" stroke-width="1.5" />
				<text x="60" y="186" fill="#fb923c" font-family="monospace" font-size="10" font-weight="700">📏 Score</text>
				<text x="60" y="200" fill="#cbd5e1" font-family="monospace" font-size="9">faithfulness: 0.95</text>

				<rect x="260" y="170" width="200" height="40" rx="6" fill="#1e293b" stroke="#22c55e" stroke-width="1.5" />
				<text x="280" y="186" fill="#22c55e" font-family="monospace" font-size="10" font-weight="700">💰 Cost</text>
				<text x="280" y="200" fill="#cbd5e1" font-family="monospace" font-size="9">$0.0032 · 450 tokens</text>

				<rect x="480" y="170" width="200" height="40" rx="6" fill="#1e293b" stroke="#facc15" stroke-width="1.5" />
				<text x="500" y="186" fill="#facc15" font-family="monospace" font-size="10" font-weight="700">⏱️ Latency</text>
				<text x="500" y="200" fill="#cbd5e1" font-family="monospace" font-size="9">1.2 s</text>

				<!-- Metadata -->
				<rect x="40" y="225" width="640" height="40" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
				<text x="60" y="244" fill="#cbd5e1" font-family="monospace" font-size="10" font-weight="700">📋 Metadata</text>
				<text x="60" y="258" fill="#94a3b8" font-family="monospace" font-size="9">session_id, user_id, user_clearance: CD, environment: prod, version: v1.2.3</text>
			</svg>
		</div>

		<table class="obs-concept-table">
			<thead><tr><th>Concept</th><th>Langfuse</th><th>LangSmith</th><th>Description</th></tr></thead>
			<tbody>
				<tr><td>Interaction complète</td><td><code>Trace</code></td><td><code>Trace</code> (top-level Run)</td><td>Une exécution end-to-end de ton agent</td></tr>
				<tr><td>Opération unitaire</td><td><code>Span</code> / <code>Generation</code></td><td><code>Run</code></td><td>Un appel LLM, tool, retrieval, etc.</td></tr>
				<tr><td>Imbrication</td><td>spans nested</td><td>parent_run_id</td><td>Spans peuvent en contenir d'autres</td></tr>
				<tr><td>Espace de travail</td><td><code>Project</code></td><td><code>Project</code></td><td>Isolation : prod, staging, équipe</td></tr>
				<tr><td>Note attachée</td><td><code>Score</code></td><td><code>Feedback</code></td><td>Numérique / bool / catégoriel</td></tr>
				<tr><td>Données d'éval</td><td><code>Dataset</code></td><td><code>Dataset</code></td><td>(input, output_attendu) pour bench</td></tr>
				<tr><td>Run d'éval</td><td><code>Experiment</code></td><td><code>Experiment</code></td><td>Le dataset passé sur ta version courante</td></tr>
				<tr><td>Versioning prompt</td><td><code>Prompt</code></td><td><code>Prompt Hub</code></td><td>Templates versionnés stockés serveur</td></tr>
			</tbody>
		</table>
	</section>

	<!-- ============== 3. VS ============== -->
	<section id="vs" class="obs-section">
		<h2 class="obs-h2">3️⃣ Langfuse vs LangSmith — choisir ⭐</h2>

		<div class="obs-vs-grid">
			<div class="obs-vs-card obs-vs-langfuse">
				<div class="obs-vs-header">
					<span class="obs-vs-emoji">🟢</span>
					<div>
						<h3>Langfuse</h3>
						<span class="obs-vs-tag">Open-source · MIT/Apache 2.0</span>
					</div>
				</div>
				<ul class="obs-vs-pros">
					<li>✅ <strong>Self-host trivial</strong> — Docker compose en 5 min, K8s helm chart</li>
					<li>✅ <strong>Air-gap natif</strong> — toutes les données restent chez toi, aucune télémétrie sortante</li>
					<li>✅ <strong>Gratuit illimité</strong> sur self-host (cloud payant pour le hosted)</li>
					<li>✅ <strong>OpenTelemetry</strong> natif — composable avec ton APM existant</li>
					<li>✅ <strong>Framework-agnostique</strong> par design — Python, JS, OpenAI direct, LangChain, LiteLLM, n'importe quoi</li>
					<li>✅ <strong>Communauté GitHub</strong> active, Apache 2.0</li>
				</ul>
				<ul class="obs-vs-cons">
					<li>⚠️ Stack de dépendances : Postgres + ClickHouse + Redis + S3-compatible</li>
					<li>⚠️ Maintenance interne si self-host (backup, scaling, mise à jour)</li>
				</ul>
			</div>

			<div class="obs-vs-card obs-vs-langsmith">
				<div class="obs-vs-header">
					<span class="obs-vs-emoji">🟣</span>
					<div>
						<h3>LangSmith</h3>
						<span class="obs-vs-tag">Propriétaire · LangChain Inc.</span>
					</div>
				</div>
				<ul class="obs-vs-pros">
					<li>✅ <strong>Intégration LangChain/LangGraph zéro-effort</strong> — activé via 2 env vars</li>
					<li>✅ <strong>Free tier</strong> généreux (5 000 traces/mois)</li>
					<li>✅ <strong>SaaS managé</strong> — aucune infra à gérer</li>
					<li>✅ <strong>Studio UI</strong> intégrée pour designer/tester des graphes</li>
					<li>✅ <strong>Conformité</strong> SOC 2, HIPAA, GDPR (cloud hosted)</li>
				</ul>
				<ul class="obs-vs-cons">
					<li>❌ <strong>Cloud par défaut</strong> — tes données vont sur smith.langchain.com</li>
					<li>⚠️ <strong>Self-host enterprise uniquement</strong> (payant, contrat)</li>
					<li>❌ <strong>Air-gap</strong> = enterprise tier seulement, démarches commerciales</li>
					<li>⚠️ <strong>Lock-in</strong> à l'écosystème LangChain plus marqué</li>
				</ul>
			</div>
		</div>

		<Callout variant="insight" title="🎯 Pour ton projet souverain défense — réponse claire">
			<p>
				<strong>Langfuse self-hosted</strong>, sans hésitation. Trois
				raisons :
			</p>
			<ol>
				<li><strong>Air-gap</strong> : aucune donnée ne sort de ton intranet. Indispensable pour les traces qui contiennent des prompts/réponses sensibles.</li>
				<li><strong>Coût</strong> : zéro licence, déploiement K8s sur ton cluster existant.</li>
				<li><strong>Contrôle total</strong> : tu maîtrises la rétention, le chiffrement, l'audit. Aucune dépendance à un tiers commercial.</li>
			</ol>
			<p>
				LangSmith reste utile en <strong>dev local</strong> avec son free
				tier — itération rapide pendant que tu construis. Mais en prod
				souverain, c'est Langfuse.
			</p>
		</Callout>

		<table class="obs-vs-table">
			<thead>
				<tr><th>Critère</th><th>Langfuse</th><th>LangSmith</th></tr>
			</thead>
			<tbody>
				<tr><td>Licence</td><td class="obs-vs-good">MIT (cœur) + Apache 2.0</td><td>Propriétaire</td></tr>
				<tr><td>Self-host gratuit</td><td class="obs-vs-good">✅ Sans limite</td><td class="obs-vs-bad">❌ Enterprise payant uniquement</td></tr>
				<tr><td>Air-gap deployment</td><td class="obs-vs-good">✅ Trivial</td><td class="obs-vs-mid">⚠️ Enterprise contrat</td></tr>
				<tr><td>Free tier cloud</td><td>50k traces/mois (cloud hosted)</td><td>5k traces/mois (Personal)</td></tr>
				<tr><td>Tracing</td><td>OpenTelemetry natif</td><td>Format propriétaire LangChain</td></tr>
				<tr><td>Évaluations</td><td>LLM-as-judge intégré + custom</td><td>LLM-as-judge intégré + custom</td></tr>
				<tr><td>Prompt management</td><td>✅ Versioning + Playground</td><td>✅ Prompt Hub + Playground</td></tr>
				<tr><td>Datasets / Experiments</td><td>✅</td><td>✅</td></tr>
				<tr><td>Annotation Queue</td><td>✅</td><td>✅</td></tr>
				<tr><td>SDK</td><td>Python + JS officiels, OTel</td><td>Python + JS officiels</td></tr>
				<tr><td>Intégration LangChain</td><td>Callback handler</td><td class="obs-vs-good">Native zero-config</td></tr>
				<tr><td>Intégration LiteLLM</td><td class="obs-vs-good">Native (callback)</td><td>Via OpenInference</td></tr>
				<tr><td>Communauté GitHub</td><td>20k+ étoiles</td><td>Repo client uniquement</td></tr>
			</tbody>
		</table>
	</section>

	<!-- ============== 4. LANGFUSE ============== -->
	<section id="langfuse" class="obs-section">
		<h2 class="obs-h2">4️⃣ Langfuse en détail</h2>

		<h3 class="obs-h3">Architecture (self-hosted)</h3>
		<div class="obs-archi-grid">
			<div class="obs-archi-comp">
				<div class="obs-archi-emoji">🎨</div>
				<strong>Web UI (Next.js)</strong>
				<p>Interface de visualisation traces, dashboards, prompt editor</p>
			</div>
			<div class="obs-archi-comp">
				<div class="obs-archi-emoji">🔌</div>
				<strong>API server (Node)</strong>
				<p>Ingestion endpoints, authentification, prompts API</p>
			</div>
			<div class="obs-archi-comp">
				<div class="obs-archi-emoji">🐘</div>
				<strong>Postgres</strong>
				<p>Métadonnées : projets, users, prompts versionnés</p>
			</div>
			<div class="obs-archi-comp">
				<div class="obs-archi-emoji">⚡</div>
				<strong>ClickHouse</strong>
				<p>Stockage colonnaire des traces (haute volumétrie, requêtes analytics rapides)</p>
			</div>
			<div class="obs-archi-comp">
				<div class="obs-archi-emoji">🚀</div>
				<strong>Redis</strong>
				<p>Cache + queue d'ingestion (workers async)</p>
			</div>
			<div class="obs-archi-comp">
				<div class="obs-archi-emoji">📦</div>
				<strong>S3 / MinIO</strong>
				<p>Stockage des blobs (gros payloads, multimedia)</p>
			</div>
		</div>

		<h3 class="obs-h3">Code — tracing automatique avec décorateur</h3>
		<pre class="obs-code"><code>{`from langfuse import Langfuse, observe
from openai import OpenAI

# Init Langfuse une fois — pointe vers ton serveur self-hosted
langfuse = Langfuse(
    public_key="pk-lf-...",
    secret_key="sk-lf-...",
    host="https://langfuse.intranet"  # ton serveur on-premise
)

client = OpenAI()

@observe()
def answer_question(question: str) -> str:
    """Le décorateur crée automatiquement une trace + capture inputs/outputs."""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": question}]
    )
    return response.choices[0].message.content

answer_question("Qu'est-ce que la caféine ?")
# → Trace visible immédiatement dans l'UI Langfuse`}</code></pre>

		<h3 class="obs-h3">Code — wrapper OpenAI (instrumenté automatiquement)</h3>
		<pre class="obs-code"><code>{`from langfuse.openai import openai  # ← remplace l'import standard

client = openai.OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Bonjour"}]
)
# Trace automatique : prompt, response, tokens, cost, latence — tout capturé.
# Aucune autre ligne de code à ajouter.`}</code></pre>

		<h3 class="obs-h3">Code — score (LLM-as-judge programmatique)</h3>
		<pre class="obs-code"><code>{`# Après la génération, on évalue
langfuse.score(
    trace_id=trace.id,
    name="faithfulness",
    value=0.92,      # numérique 0-1
    comment="Bien sourcé, cite 3 docs CD"
)

langfuse.score(
    trace_id=trace.id,
    name="user_thumbs",
    value="up",     # catégoriel
)

# LLM-as-judge automatisé via l'UI : tu définis un prompt évaluateur
# qui tourne sur toutes tes traces de prod et leur attribue un score.`}</code></pre>

		<h3 class="obs-h3">Code — prompt management</h3>
		<pre class="obs-code"><code>{`# Récupérer un prompt versionné depuis Langfuse
prompt = langfuse.get_prompt(
    "agent-defense-system",
    version=3,                     # ou "production" (label)
    type="text",                   # ou "chat"
)

# Compile avec des variables runtime
compiled = prompt.compile(
    user_clearance="CD",
    session_id=session.id
)

# Utilise le prompt
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": compiled},
        {"role": "user", "content": question}
    ]
)`}</code></pre>
	</section>

	<!-- ============== 5. LANGSMITH ============== -->
	<section id="langsmith" class="obs-section">
		<h2 class="obs-h2">5️⃣ LangSmith en détail</h2>

		<h3 class="obs-h3">Tracing zero-config pour LangChain/LangGraph</h3>
		<pre class="obs-code"><code>{`# Tu actives le tracing avec 2 variables d'environnement
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=ls__...
export LANGSMITH_PROJECT="agent-defense-prod"

# Tu n'ajoutes RIEN à ton code LangGraph existant
from langgraph.prebuilt import create_react_agent
agent = create_react_agent(llm, tools)
result = agent.invoke({"messages": [HumanMessage("...")]})
# → Trace automatique sur smith.langchain.com`}</code></pre>

		<h3 class="obs-h3">Tracing pour code non-LangChain</h3>
		<pre class="obs-code"><code>{`from langsmith import wrappers, traceable
import openai

# Wrap un client OpenAI
client = wrappers.wrap_openai(openai.Client())

# Décorateur pour tes propres fonctions
@traceable
def my_pipeline(query: str) -> str:
    docs = retrieve_docs(query)        # nested run
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": f"{docs}\\n{query}"}]
    )
    return response.choices[0].message.content`}</code></pre>

		<h3 class="obs-h3">Code — Évaluation</h3>
		<pre class="obs-code"><code>{`from langsmith.evaluation import evaluate

# Définis un evaluator (LLM-as-judge ou custom)
def faithfulness_evaluator(run, example):
    # run.outputs contient ce que ton agent a produit
    # example.outputs contient la réponse attendue
    return {"score": custom_compare(run.outputs, example.outputs)}

# Lance l'éval sur un dataset
results = evaluate(
    lambda inputs: my_agent.invoke(inputs),
    data="defense-eval-set",            # nom du dataset dans LangSmith
    evaluators=[faithfulness_evaluator],
    experiment_prefix="v1.2.3-",
)
# → Résultats agrégés dans l'UI LangSmith`}</code></pre>

		<h3 class="obs-h3">Prompt Hub</h3>
		<pre class="obs-code"><code>{`from langchain import hub

# Récupère un prompt depuis le Hub (versionné)
prompt = hub.pull("my-team/agent-defense-system:v3")

# Le prompt est un ChatPromptTemplate utilisable directement
chain = prompt | llm
response = chain.invoke({"user_clearance": "CD", "question": "..."})`}</code></pre>
	</section>

	<!-- ============== 6. INTÉGRATION ============== -->
	<section id="integration" class="obs-section">
		<h2 class="obs-h2">6️⃣ Intégration LangGraph — concret</h2>

		<h3 class="obs-h3">Côté Langfuse — callback handler</h3>
		<pre class="obs-code"><code>{`from langfuse.callback import CallbackHandler
from langgraph.prebuilt import create_react_agent
from langchain_ollama import ChatOllama

llm = ChatOllama(model="mistral-defense:latest")
agent = create_react_agent(llm, tools=[check_classification, retrieve_rag])

# Le handler intercepte tous les events LangChain/LangGraph et les envoie à Langfuse
handler = CallbackHandler(
    public_key="pk-lf-...",
    secret_key="sk-lf-...",
    host="https://langfuse.intranet"
)

result = agent.invoke(
    {"messages": [HumanMessage("Classification de Persée ?")]},
    config={
        "callbacks": [handler],
        "metadata": {                      # ← métadonnées clés pour audit
            "session_id": session.id,
            "user_id": session.user_id,
            "user_clearance": "CD",
            "environment": "prod",
            "agent_version": "v1.2.3"
        }
    }
)

# Trace complète visible dans Langfuse :
#   - chaque appel LLM (input, output, tokens, cost)
#   - chaque tool call (check_classification → SD)
#   - le routing (continue vs end)
#   - latence par étape, total
#   - toute la metadata (audit)`}</code></pre>

		<h3 class="obs-h3">Côté LangSmith — encore plus simple</h3>
		<pre class="obs-code"><code>{`# 2 env vars, et c'est tout
import os
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_API_KEY"] = "ls__..."
os.environ["LANGSMITH_PROJECT"] = "agent-defense-prod"

# Aucun changement de code
from langgraph.prebuilt import create_react_agent
agent = create_react_agent(llm, tools)

# Invocation classique avec metadata
result = agent.invoke(
    {"messages": [HumanMessage("...")]},
    config={"metadata": {"user_clearance": "CD", "session_id": session.id}}
)
# → Trace dans LangSmith automatiquement`}</code></pre>

		<Callout variant="insight" title="🎯 Quel choix concret pour TON projet">
			<p>
				<strong>Stratégie recommandée pour le projet défense souverain</strong> :
			</p>
			<ol>
				<li><strong>En dev local</strong> : LangSmith free tier — itère rapidement, vois tes traces sans rien gérer.</li>
				<li><strong>En staging air-gap</strong> : Langfuse self-hosted sur ton K8s interne. Tu maîtrises tout.</li>
				<li><strong>En prod air-gap</strong> : idem Langfuse self-hosted, avec rétention longue (5 ans audit ANSSI).</li>
			</ol>
			<p>
				Bénéfice du callback handler : tu peux <strong>activer/désactiver</strong>
				Langfuse via une variable d'environnement, sans toucher au code.
				Idem pour LangSmith via les env vars.
			</p>
		</Callout>

		<!-- ===== Code production-grade complet ===== -->
		<h3 class="obs-h3">Code complet — pipeline audit end-to-end (Langfuse + LangGraph)</h3>
		<p>
			Voici un exemple <strong>production-grade</strong> qui couvre tout
			ce dont tu as besoin pour ton agent défense : tracing automatique,
			metadata structurée, scoring programmatique post-réponse, et écriture
			d'un audit log signé. C'est le pattern réel à déployer.
		</p>

		<pre class="obs-code"><code>{`# agent_with_observability.py
import os
import json
from datetime import datetime
from langfuse import Langfuse
from langfuse.callback import CallbackHandler
from langgraph.prebuilt import create_react_agent
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage

# === 1. Init Langfuse — pointe sur ton serveur interne ===
langfuse = Langfuse(
    public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
    secret_key=os.environ["LANGFUSE_SECRET_KEY"],
    host=os.environ.get("LANGFUSE_HOST", "https://langfuse.intranet"),
)

# === 2. Le LLM (Mistral local via Ollama) ===
llm = ChatOllama(
    model="mistral-defense:latest",
    base_url=os.environ.get("OLLAMA_HOST", "http://ollama.intranet:11434"),
    temperature=0.3,
)

# === 3. L'agent LangGraph avec ses tools métier ===
agent = create_react_agent(
    llm,
    tools=[check_classification, retrieve_rag, refuse_with_reason],
    state_modifier="Tu es un assistant documentaire défense. ..."
)

# === 4. Helper d'invocation traçée ===
def run_agent(query: str, session: SessionContext) -> dict:
    """Exécute l'agent avec tracing complet et audit signé."""

    # 4a. Configure le callback handler avec metadata structurée
    handler = CallbackHandler(
        trace_name="defense-agent-query",        # nom lisible dans l'UI
        user_id=session.user_id,                  # link au profil utilisateur
        session_id=session.id,                    # group toutes les queries d'une session
        tags=[
            f"clearance:{session.user_clearance}",
            f"env:{os.environ.get('ENV', 'dev')}",
            f"version:{os.environ.get('AGENT_VERSION', 'v1.0')}",
            "domain:defense"
        ],
        metadata={
            # Tout ce qui est utile pour l'audit posteriori
            "user_clearance": session.user_clearance,
            "user_unit": session.user_unit,
            "session_started": session.started_at.isoformat(),
            "client_ip": session.client_ip,
            "agent_version": os.environ.get("AGENT_VERSION"),
            "llm_model": "mistral-defense",
        }
    )

    # 4b. Invoque l'agent — le handler trace TOUT automatiquement
    result = agent.invoke(
        {"messages": [HumanMessage(content=query)]},
        config={"callbacks": [handler]}
    )

    trace_id = handler.trace.id
    final_answer = result["messages"][-1].content
    decision = result.get("decision", "answered")  # answered / refused

    # 4c. Score programmatique post-génération
    # → Faithfulness : le modèle a-t-il cité une source ?
    has_source = "[" in final_answer and any(c in final_answer for c in ["NP", "DR", "CD", "SD"])
    langfuse.score(
        trace_id=trace_id,
        name="cite_source",
        value=1.0 if has_source else 0.0,
        comment="Source citée avec niveau classification" if has_source else "Aucune source citée"
    )

    # → Format compliance : la réponse respecte-t-elle le format imposé ?
    langfuse.score(
        trace_id=trace_id,
        name="format_compliance",
        value=check_format(final_answer)
    )

    # 4d. Écrit l'audit log signé Ed25519 (séparé du tracing Langfuse)
    audit_entry = {
        "trace_id": trace_id,
        "session_id": session.id,
        "user_id": session.user_id,
        "user_clearance": session.user_clearance,
        "query": query,
        "answer": final_answer,
        "decision": decision,
        "timestamp": datetime.utcnow().isoformat(),
        "agent_version": os.environ.get("AGENT_VERSION")
    }
    audit_entry["signature"] = sign_ed25519(audit_entry, AUDIT_PRIVATE_KEY)
    audit_store.append_immutable(audit_entry)

    return {
        "answer": final_answer,
        "decision": decision,
        "trace_url": f"https://langfuse.intranet/trace/{trace_id}",
        "audit_id": audit_entry["signature"][:16]
    }`}</code></pre>

		<h3 class="obs-h3">Ce que tu vois dans l'UI Langfuse</h3>
		<div class="obs-trace-mock">
			<div class="obs-trace-row obs-trace-row-trace">
				<div class="obs-trace-bar" style="width: 100%; background: linear-gradient(90deg, #a855f7, #06b6d4);"></div>
				<div class="obs-trace-meta">
					<strong>📦 trace · defense-agent-query</strong>
					<span>1,847 ms · 2,310 tokens · $0.0042</span>
				</div>
			</div>
			<div class="obs-trace-row obs-trace-row-span" style="margin-left: 1rem">
				<div class="obs-trace-bar" style="width: 8%; margin-left: 2%; background: #22c55e;"></div>
				<div class="obs-trace-meta">
					<strong>🔧 classifier_node</strong>
					<span>147 ms · 95 tokens (in) / 12 tokens (out)</span>
				</div>
			</div>
			<div class="obs-trace-row obs-trace-row-span" style="margin-left: 1rem">
				<div class="obs-trace-bar" style="width: 12%; margin-left: 12%; background: #06b6d4;"></div>
				<div class="obs-trace-meta">
					<strong>🔧 check_classification</strong>
					<span>211 ms · tool_call to MCP server</span>
				</div>
			</div>
			<div class="obs-trace-row obs-trace-row-span" style="margin-left: 1rem">
				<div class="obs-trace-bar" style="width: 28%; margin-left: 26%; background: #fb923c;"></div>
				<div class="obs-trace-meta">
					<strong>🧠 generate_answer (Mistral)</strong>
					<span>523 ms · 1,840 tokens (in) / 156 tokens (out) · $0.0028</span>
				</div>
			</div>
			<div class="obs-trace-row obs-trace-row-span" style="margin-left: 1rem">
				<div class="obs-trace-bar" style="width: 40%; margin-left: 56%; background: #facc15;"></div>
				<div class="obs-trace-meta">
					<strong>📥 retrieve_rag (Milvus)</strong>
					<span>752 ms · 5 docs récupérés (filtre CD)</span>
				</div>
			</div>
			<div class="obs-trace-scores">
				<span class="obs-trace-score obs-trace-score-good">cite_source: 1.0 ✅</span>
				<span class="obs-trace-score obs-trace-score-good">format_compliance: 1.0 ✅</span>
				<span class="obs-trace-score obs-trace-score-mid">faithfulness (LLM-judge): 0.92 ⚡</span>
				<span class="obs-trace-score">user_feedback: pending 👤</span>
			</div>
		</div>

		<Callout variant="insight" title="🔍 Comment exploiter cette trace concrètement">
			<ul>
				<li>
					<strong>Diagnostic latence</strong> : tu vois immédiatement que
					<code>retrieve_rag</code> prend 40 % du temps. Cible d'optimisation.
				</li>
				<li>
					<strong>Audit a posteriori</strong> : la metadata
					(<code>user_clearance: CD</code>, <code>tags: [domain:defense]</code>)
					te permet de filtrer toutes les requêtes d'un utilisateur, ou
					toutes les requêtes refusées, en une recherche.
				</li>
				<li>
					<strong>Detection régression</strong> : si demain le score
					<code>cite_source</code> moyen passe de 0.95 à 0.62, alerte
					automatique. Quelque chose dans ton prompt ou ton modèle a
					changé.
				</li>
				<li>
					<strong>Lien avec audit signé</strong> : la trace Langfuse contient
					l'<code>audit_id</code> dans sa metadata, et l'entry d'audit
					contient la <code>trace_url</code>. Bidirectionnel et vérifiable.
				</li>
			</ul>
		</Callout>
	</section>

	<!-- ============== 7. SOUVERAIN ============== -->
	<section id="sovereign" class="obs-section">
		<h2 class="obs-h2">7️⃣ Setup souverain — Langfuse self-hosted air-gap</h2>
		<p class="obs-lead">
			Voici la procédure complète pour déployer Langfuse sur ton infra
			interne, complètement air-gappée. Compatible avec le projet défense.
		</p>

		<h3 class="obs-h3">Phase 1 — Prérequis</h3>
		<ul class="obs-list">
			<li>Cluster Kubernetes interne (k3s, OpenShift, Rancher…)</li>
			<li>Postgres 14+ disponible (peut être managé ou helm-deployé)</li>
			<li>ClickHouse 24+ (volume non-trivial : prévoir 100 Go par 1M traces)</li>
			<li>Redis 7+</li>
			<li>S3-compatible (MinIO en air-gap, sur ton cluster)</li>
			<li>Ingress + TLS interne (mTLS recommandé)</li>
		</ul>

		<h3 class="obs-h3">Phase 2 — Déploiement Helm</h3>
		<pre class="obs-code"><code>{`# values.yaml — configuration minimale
langfuse:
  ingress:
    enabled: true
    hosts:
      - host: langfuse.intranet
        paths:
          - path: /
  postgresql:
    deploy: false
    auth:
      host: postgres.intranet
      database: langfuse
      username: lf
      existingSecret: langfuse-db-credentials
  clickhouse:
    deploy: false
    host: clickhouse.intranet
  redis:
    deploy: false
    host: redis.intranet
  s3:
    bucket: langfuse-data
    endpoint: https://minio.intranet
    region: ""
    accessKeyId: env:S3_ACCESS_KEY
    secretAccessKey: env:S3_SECRET_KEY
  encryptionKey: # 32-byte hex pour chiffrer les traces sensibles

# Installation
helm repo add langfuse https://langfuse.github.io/langfuse-k8s
helm install langfuse langfuse/langfuse -f values.yaml -n langfuse --create-namespace`}</code></pre>

		<h3 class="obs-h3">Phase 3 — Sécurité air-gap</h3>
		<ul class="obs-list">
			<li><strong>NetworkPolicy</strong> Kubernetes : aucun egress hors namespace, ingress uniquement depuis tes apps autorisées.</li>
			<li><strong>Chiffrement</strong> au repos sur Postgres + ClickHouse (LUKS ou natif).</li>
			<li><strong>mTLS interne</strong> entre tes agents et Langfuse (cert-manager).</li>
			<li><strong>Rétention</strong> configurée à 5 ans (ANSSI) — purge automatique au-delà.</li>
			<li><strong>Audit</strong> : actives les access logs Postgres/ClickHouse, log centralisé sur ELK interne.</li>
			<li><strong>Backup</strong> Postgres + ClickHouse + S3 dans une zone de stockage différente, rotation 90 jours.</li>
		</ul>

		<h3 class="obs-h3">Phase 4 — Workflow équipe</h3>
		<ol class="obs-list">
			<li>Crée un projet par environnement (<code>defense-dev</code>, <code>defense-prod</code>) dans l'UI.</li>
			<li>Génère des paires de clés API par projet.</li>
			<li>Configure tes agents avec le callback handler pointé sur <code>https://langfuse.intranet</code>.</li>
			<li>Crée un dataset <code>defense-eval-v1</code> avec 100-500 cas-test métier.</li>
			<li>Configure un experiment hebdomadaire qui re-évalue tes prompts sur ce dataset.</li>
			<li>Active des LLM-as-judge automatiques pour scorer toutes les traces de prod (faithfulness, refus correctement appliqué, format respecté).</li>
		</ol>

		<Callout variant="warning" title="🔐 Attention au prompt management en environnement classifié">
			<p>
				Les prompts versionnés dans Langfuse <strong>peuvent contenir
					des informations sensibles</strong> (ex : noms de programmes,
				règles de classification). Traite-les comme du code source —
				accès via RBAC strict, audit des modifications, validation
				avant push en prod.
			</p>
		</Callout>
	</section>

	<!-- ============== 8. GLOSSAIRE ============== -->
	<section id="glossaire" class="obs-section">
		<h2 class="obs-h2">8️⃣ Glossaire</h2>
		<dl class="obs-glossary">
			<div class="obs-gl-row"><dt>Annotation Queue</dt><dd>File d'attente d'examens humains pour scorer des traces (ex : un human-in-the-loop pour les refus douteux).</dd></div>
			<div class="obs-gl-row"><dt>Callback handler</dt><dd>Composant LangChain qui intercepte tous les events (run start, run end, llm call) et les transmet à Langfuse/LangSmith.</dd></div>
			<div class="obs-gl-row"><dt>ClickHouse</dt><dd>Base de données colonnaire OLAP, utilisée par Langfuse pour stocker les traces à grande échelle.</dd></div>
			<div class="obs-gl-row"><dt>Dataset</dt><dd>Collection de paires (input, output_attendu) pour évaluation systématique de l'agent.</dd></div>
			<div class="obs-gl-row"><dt>Evaluator</dt><dd>Fonction (Python ou LLM-as-judge) qui prend une trace et produit un score.</dd></div>
			<div class="obs-gl-row"><dt>Experiment</dt><dd>Run d'un dataset complet sur ta version courante de l'agent + agrégation des scores.</dd></div>
			<div class="obs-gl-row"><dt>Generation (Langfuse)</dt><dd>Type particulier de span : un appel LLM avec ses input/output messages, tokens, cost.</dd></div>
			<div class="obs-gl-row"><dt>Langfuse</dt><dd>Plateforme open-source d'observability LLM. Self-hostable, MIT/Apache 2.0.</dd></div>
			<div class="obs-gl-row"><dt>LangSmith</dt><dd>Plateforme propriétaire de LangChain Inc. Cloud + enterprise self-host.</dd></div>
			<div class="obs-gl-row"><dt>LLM-as-judge</dt><dd>Pattern d'évaluation où un autre LLM note la qualité d'une réponse selon un prompt-évaluateur.</dd></div>
			<div class="obs-gl-row"><dt>OpenTelemetry (OTel)</dt><dd>Standard CNCF de tracing distribué. Langfuse l'implémente nativement.</dd></div>
			<div class="obs-gl-row"><dt>Project</dt><dd>Espace de travail isolant par environnement (dev, staging, prod) ou équipe.</dd></div>
			<div class="obs-gl-row"><dt>Prompt Hub (LangSmith)</dt><dd>Système de versioning des prompts hosted par LangSmith. Équivalent : Langfuse Prompts.</dd></div>
			<div class="obs-gl-row"><dt>Run (LangSmith)</dt><dd>Une opération unitaire dans une trace. Équivalent du Span/Generation Langfuse.</dd></div>
			<div class="obs-gl-row"><dt>Score / Feedback</dt><dd>Note (numérique, bool, catégorielle) attachée à une trace ou un span.</dd></div>
			<div class="obs-gl-row"><dt>Self-hosted</dt><dd>Déploiement sur ton propre infra (vs cloud du vendeur). Langfuse : trivial. LangSmith : enterprise tier.</dd></div>
			<div class="obs-gl-row"><dt>Span</dt><dd>(Langfuse, OTel) Une opération unitaire dans une trace. Peut contenir des spans enfants.</dd></div>
			<div class="obs-gl-row"><dt>Trace</dt><dd>Une interaction utilisateur de bout en bout. Contient potentiellement plusieurs spans/runs imbriqués.</dd></div>
			<div class="obs-gl-row"><dt>Wrapper OpenAI</dt><dd>Mécanisme (Langfuse + LangSmith) où l'on remplace l'import <code>openai</code> par leur version instrumentée. Aucun autre changement de code.</dd></div>
		</dl>
	</section>
</article>

<style>
	.obs {
		max-width: 1240px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		display: flex; flex-direction: column; gap: 2rem;
	}
	.obs :global(p), .obs :global(.obs-lead) { max-width: 880px; }

	.obs-hero {
		text-align: center; padding: 2rem 1.5rem;
		background: linear-gradient(135deg, #f0fdf4 0%, #fff 100%);
		border-radius: 1.5rem; border: 1px solid #86efac;
	}
	.obs-hero-emoji { font-size: 4rem; display: block; }
	.obs-h1 {
		font-family: var(--font-display); font-size: 2.25rem; font-weight: 700;
		color: var(--color-ink-900); margin: 0.5rem 0 0;
	}
	.obs-hero-lead {
		font-size: 1rem; color: var(--color-ink-700); max-width: 660px;
		margin: 0.85rem auto 1.5rem; line-height: 1.6;
	}
	.obs-hero-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.obs-cta { padding: 0.7rem 1.5rem; border-radius: 999px; text-decoration: none; font-weight: 500; }
	.obs-cta-primary { background: #16a34a; color: white; }
	.obs-cta-secondary { background: #fff; color: var(--color-ink-900); border: 2px solid #16a34a; }

	.obs-toc {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem 1.5rem;
	}
	.obs-toc-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem;
	}
	.obs-toc-list {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0;
	}
	.obs-toc-list a { color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem; }
	.obs-toc-list a:hover { color: #16a34a; }

	.obs-section { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 80px; }
	.obs-h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-ink-900); margin: 0; }
	.obs-h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; color: var(--color-ink-900); margin: 1rem 0 0.5rem; }
	.obs-lead { font-size: 1rem; color: var(--color-ink-700); line-height: 1.6; margin: 0; }

	.obs-prereq-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem;
	}
	.obs-prereq { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
	.obs-prereq summary {
		cursor: pointer; padding: 0.85rem 1rem;
		font-family: var(--font-display); font-weight: 600; font-size: 0.95rem;
		color: var(--color-ink-900); list-style: none;
	}
	.obs-prereq summary::-webkit-details-marker { display: none; }
	.obs-prereq summary::after {
		content: '▶'; float: right; color: var(--color-ink-500); font-size: 0.7rem; transition: transform 0.15s;
	}
	.obs-prereq[open] summary::after { transform: rotate(90deg); }
	.obs-prereq[open] summary { background: #f0fdf4; border-bottom: 1px solid #e2e8f0; }
	.obs-prereq > div { padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; }

	.obs-why-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.6rem;
	}
	.obs-why-card {
		padding: 1rem 1.1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
	}
	.obs-why-emoji { font-size: 1.75rem; }
	.obs-why-card h4 { font-family: var(--font-display); font-size: 1rem; margin: 0.3rem 0 0.4rem; color: var(--color-ink-900); }
	.obs-why-card p { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }

	.obs-concept-diagram {
		background: #0f172a; border-radius: 0.75rem; padding: 1rem;
	}
	.obs-concept-svg { width: 100%; height: auto; max-height: 320px; }
	.obs-concept-table, .obs-vs-table {
		width: 100%; border-collapse: collapse; font-size: 0.85rem;
		background: #fff; border-radius: 0.5rem; overflow: hidden; border: 1px solid #e2e8f0;
	}
	.obs-concept-table thead, .obs-vs-table thead { background: #f0fdf4; }
	.obs-concept-table th, .obs-vs-table th {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: var(--color-ink-700); text-align: left; padding: 0.5rem 0.7rem;
	}
	.obs-concept-table td, .obs-vs-table td {
		padding: 0.5rem 0.7rem; border-bottom: 1px solid #f1f5f9;
		color: var(--color-ink-700); vertical-align: top;
	}
	.obs-vs-good { color: #15803d; font-weight: 500; }
	.obs-vs-bad { color: #dc2626; }
	.obs-vs-mid { color: #f59e0b; }

	.obs-vs-grid {
		display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;
	}
	@media (max-width: 720px) { .obs-vs-grid { grid-template-columns: 1fr; } }
	.obs-vs-card {
		padding: 1.25rem; background: #fff; border: 1px solid #e2e8f0;
		border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem;
	}
	.obs-vs-langfuse { border-left: 4px solid #16a34a; background: linear-gradient(180deg, #f0fdf4 0%, #fff 30%); }
	.obs-vs-langsmith { border-left: 4px solid #a855f7; background: linear-gradient(180deg, #faf5ff 0%, #fff 30%); }
	.obs-vs-header { display: flex; gap: 0.85rem; align-items: center; }
	.obs-vs-emoji { font-size: 2rem; }
	.obs-vs-card h3 { font-family: var(--font-display); font-size: 1.2rem; margin: 0; color: var(--color-ink-900); }
	.obs-vs-tag { font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-ink-500); }
	.obs-vs-pros, .obs-vs-cons {
		list-style: none; padding: 0; margin: 0;
		font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.6;
	}
	.obs-vs-pros li, .obs-vs-cons li { margin: 0.3rem 0; }

	.obs-archi-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.6rem;
	}
	.obs-archi-comp {
		padding: 0.85rem 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.6rem;
	}
	.obs-archi-emoji { font-size: 1.5rem; }
	.obs-archi-comp strong {
		display: block; margin: 0.25rem 0; font-family: var(--font-display); color: var(--color-ink-900);
	}
	.obs-archi-comp p { font-size: 0.83rem; color: var(--color-ink-700); margin: 0; line-height: 1.5; }

	.obs-code {
		background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem;
		border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem;
		line-height: 1.6; margin: 0.5rem 0;
		white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
	}

	.obs-list { font-size: 0.92rem; color: var(--color-ink-700); line-height: 1.7; }
	.obs-list li { margin: 0.3rem 0; }

	.obs-glossary { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.obs-gl-row {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem;
		padding: 0.65rem 1rem; display: grid; grid-template-columns: 220px 1fr; gap: 1rem;
	}
	.obs-gl-row dt { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: #16a34a; }
	.obs-gl-row dd { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	.obs-gl-row dd code { background: #f0fdf4; padding: 0.1rem 0.35rem; border-radius: 0.25rem; font-family: var(--font-mono); font-size: 0.85em; }
	@media (max-width: 600px) {
		.obs-gl-row { grid-template-columns: 1fr; gap: 0.25rem; }
	}

	/* ===== Trace mock viz ===== */
	.obs-trace-mock {
		background: #0f172a; border-radius: 0.75rem; padding: 1rem;
		display: flex; flex-direction: column; gap: 0.4rem;
	}
	.obs-trace-row { display: flex; flex-direction: column; gap: 0.2rem; }
	.obs-trace-bar { height: 14px; border-radius: 4px; min-width: 16px; }
	.obs-trace-meta {
		display: flex; justify-content: space-between; gap: 1rem;
		font-family: var(--font-mono); font-size: 0.78rem;
	}
	.obs-trace-meta strong { color: #e2e8f0; }
	.obs-trace-meta span { color: #94a3b8; }
	.obs-trace-scores {
		display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem;
		padding-top: 0.6rem; border-top: 1px solid #334155;
	}
	.obs-trace-score {
		padding: 0.25rem 0.65rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 999px; font-family: var(--font-mono); font-size: 0.72rem;
		color: #cbd5e1;
	}
	.obs-trace-score-good { border-color: #16a34a; color: #4ade80; }
	.obs-trace-score-mid { border-color: #f59e0b; color: #fbbf24; }
</style>
