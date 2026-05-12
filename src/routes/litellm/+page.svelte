<!--
	/litellm — Lab d'apprentissage LiteLLM.
	Cas d'usage central : intégration LiteLLM + LangGraph pour basculer entre
	providers cloud (OpenAI/Anthropic en dev) et Ollama local (en prod sovrain).
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';

	// Mini-démo interactive : switcher de provider et voir la config
	type Provider = 'openai' | 'anthropic' | 'mistral' | 'ollama' | 'azure';

	const PROVIDERS: Record<Provider, {
		emoji: string; label: string; model: string; config: string;
	}> = {
		openai: {
			emoji: '🟢',
			label: 'OpenAI',
			model: 'gpt-4o',
			config: `model="openai/gpt-4o"\napi_key=os.environ["OPENAI_API_KEY"]`
		},
		anthropic: {
			emoji: '🟣',
			label: 'Anthropic',
			model: 'claude-3-5-sonnet',
			config: `model="anthropic/claude-3-5-sonnet-20241022"\napi_key=os.environ["ANTHROPIC_API_KEY"]`
		},
		mistral: {
			emoji: '🇫🇷',
			label: 'Mistral (cloud)',
			model: 'mistral-large',
			config: `model="mistral/mistral-large-latest"\napi_key=os.environ["MISTRAL_API_KEY"]`
		},
		ollama: {
			emoji: '🦥',
			label: 'Ollama (local)',
			model: 'mistral-defense:latest',
			config: `model="ollama/mistral-defense:latest"\napi_base="http://localhost:11434"`
		},
		azure: {
			emoji: '☁️',
			label: 'Azure',
			model: 'gpt-4o-deployment',
			config: `model="azure/gpt-4o-deployment"\napi_base=os.environ["AZURE_API_BASE"]\napi_key=os.environ["AZURE_API_KEY"]`
		}
	};

	let selectedProvider = $state<Provider>('ollama');
	const provider = $derived(PROVIDERS[selectedProvider]);
</script>

<svelte:head><title>LiteLLM — 100+ LLMs, une seule interface</title></svelte:head>

<article class="lll">
	<!-- HÉROS -->
	<header class="lll-hero">
		<span class="lll-hero-emoji">⚡</span>
		<h1 class="lll-h1">LiteLLM — 100+ LLMs, une seule interface</h1>
		<p class="lll-hero-lead">
			Open-source. Drop-in replacement OpenAI. Tu codes une fois, tu
			bascules entre <strong>OpenAI / Anthropic / Mistral / Ollama / Azure /
				Bedrock / Vertex</strong> en changeant juste le nom du modèle. Avec
			le <strong>Proxy Gateway</strong>, tu obtiens en plus : fallbacks,
			cost tracking, rate limiting, observability — sans réécrire ton code.
		</p>
		<div class="lll-hero-actions">
			<a href="#demo" class="lll-cta lll-cta-primary">🎮 Voir le switch provider</a>
			<a href="#integration" class="lll-cta lll-cta-secondary">⚡ Intégration LangGraph</a>
		</div>
	</header>

	<!-- TOC -->
	<nav class="lll-toc">
		<p class="lll-toc-label">📍 Parcours</p>
		<ol class="lll-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#pourquoi">1. Pourquoi LiteLLM</a></li>
			<li><a href="#modes">2. Les 3 modes (SDK / Router / Proxy)</a></li>
			<li><a href="#sdk">3. Le SDK Python en 5 minutes</a></li>
			<li><a href="#demo">4. Démo switch provider ⭐</a></li>
			<li><a href="#router">5. Router — fallbacks et load balancing</a></li>
			<li><a href="#proxy">6. Proxy Server — la gateway</a></li>
			<li><a href="#integration">7. Intégration LangGraph souverain ⚡</a></li>
			<li><a href="#cost">8. Cost tracking & observability</a></li>
			<li><a href="#glossaire">9. Glossaire</a></li>
		</ol>
	</nav>

	<!-- ============== 0. PRÉREQUIS ============== -->
	<section id="prereq" class="lll-section">
		<h2 class="lll-h2">0️⃣ Avant de commencer</h2>
		<div class="lll-prereq-grid">
			<details class="lll-prereq">
				<summary>🔑 OpenAI API spec</summary>
				<div>
					<p>
						Le format de référence pour parler à un LLM :
						<code>POST /v1/chat/completions</code> avec <code>messages</code>
						et <code>model</code>. LiteLLM <strong>traduit</strong> ce format
						vers tous les autres providers — chacun avec ses propres
						quirks (Anthropic veut <code>system</code> séparé, Bedrock veut
						AWS auth, etc.).
					</p>
				</div>
			</details>
			<details class="lll-prereq">
				<summary>🌉 Drop-in replacement</summary>
				<div>
					<p>
						LiteLLM est conçu comme remplacement direct de
						<code>openai.OpenAI()</code> : même API, mêmes méthodes
						(<code>chat.completions.create</code>), mêmes objets retournés.
						Tu peux migrer un projet existant en changeant
						<code>from openai import</code> en
						<code>from litellm import</code>.
					</p>
				</div>
			</details>
			<details class="lll-prereq">
				<summary>🖥️ Ollama</summary>
				<div>
					<p>
						Runtime local (Go) qui sert des LLM en GGUF via une API HTTP
						compatible OpenAI sur le port 11434. C'est ton runtime de
						production souverain (Mistral fine-tuné). LiteLLM s'y connecte
						via <code>model="ollama/&lt;model_name&gt;"</code> et
						<code>api_base="http://localhost:11434"</code>.
					</p>
				</div>
			</details>
			<details class="lll-prereq">
				<summary>🚪 Gateway / Proxy</summary>
				<div>
					<p>
						Un Proxy LLM = serveur HTTP qui expose une API OpenAI standard
						et route les requêtes vers les vrais providers en backend. Avantages :
						auth centralisée, logs centralisés, rate limiting, fallbacks
						transparents pour le code client. C'est le mode de déploiement
						entreprise.
					</p>
				</div>
			</details>
			<details class="lll-prereq">
				<summary>🔁 Fallback / Retry</summary>
				<div>
					<p>
						Si un provider échoue (rate limit, 5xx, timeout), LiteLLM
						bascule automatiquement sur un provider de secours. Logique
						configurable : par modèle, par groupe, avec backoff
						exponentiel. Critique pour la résilience d'un agent en
						production.
					</p>
				</div>
			</details>
		</div>
	</section>

	<!-- ============== 1. POURQUOI ============== -->
	<section id="pourquoi" class="lll-section">
		<h2 class="lll-h2">1️⃣ Pourquoi LiteLLM</h2>

		<div class="lll-problem">
			<div class="lll-problem-before">
				<h4>❌ Sans LiteLLM</h4>
				<p>
					Ton code dépend du SDK <code>openai</code>. Tu veux tester
					Claude → ré-écris avec <code>anthropic</code>. Tu veux Mistral
					local via Ollama → encore une autre lib. Tu veux fallback OpenAI
					→ Anthropic en cas de panne ? Tu écris la logique toi-même. Tu
					veux compter les coûts par utilisateur ? Pareil.
				</p>
				<p>
					Multiplie par <strong>10 LLMs</strong> et <strong>5 features
						transversales</strong>… cauchemar.
				</p>
			</div>
			<div class="lll-problem-arrow">→</div>
			<div class="lll-problem-after">
				<h4>✅ Avec LiteLLM</h4>
				<p>
					Une seule interface, <code>completion(model="...", messages=[...])</code>.
					Le provider change avec un seul argument. Les fallbacks, le
					retry, la cost calculation, les callbacks d'observability —
					tout est intégré.
				</p>
				<p>
					Tu mets le <strong>Proxy</strong> en plus : tu obtiens un OpenAI
					compatible local pour ton infra, avec auth, logs centralisés et
					rate limiting.
				</p>
			</div>
		</div>

		<Callout variant="insight" title="🎯 Pour ton projet souverain">
			<p>
				Imagine ce scénario typique dans ton projet défense :
			</p>
			<ul>
				<li><strong>Dev local</strong> : tu testes ton agent LangGraph avec Claude (pour iter rapidement avec un modèle puissant).</li>
				<li><strong>Pre-prod</strong> : tu bascules sur Mistral cloud pour mesurer coûts/perf.</li>
				<li><strong>Prod air-gap</strong> : tu pointes sur Ollama local servant Mistral 7B fine-tuné.</li>
			</ul>
			<p>
				Sans LiteLLM, c'est 3 versions du code. Avec LiteLLM, c'est
				<strong>3 fichiers de config</strong>.
			</p>
		</Callout>
	</section>

	<!-- ============== 2. LES 3 MODES ============== -->
	<section id="modes" class="lll-section">
		<h2 class="lll-h2">2️⃣ Les 3 modes d'utilisation</h2>

		<div class="lll-modes">
			<div class="lll-mode">
				<div class="lll-mode-emoji">🐍</div>
				<h3>1. Python SDK</h3>
				<p>
					<code>pip install litellm</code> + import. Tu utilises
					<code>litellm.completion()</code> dans ton code. Drop-in
					replacement OpenAI. Le plus simple à démarrer.
				</p>
				<p class="lll-mode-when"><strong>Quand</strong> : prototypage, app simple, début.</p>
			</div>
			<div class="lll-mode">
				<div class="lll-mode-emoji">🔀</div>
				<h3>2. Router (lib Python)</h3>
				<p>
					Une couche au-dessus du SDK qui ajoute fallbacks,
					load-balancing entre déploiements, retry intelligent. Tu écris
					une <code>model_list</code> avec plusieurs modèles, le Router
					choisit lequel utiliser à chaque appel.
				</p>
				<p class="lll-mode-when"><strong>Quand</strong> : tu veux résilience sans déployer un service séparé.</p>
			</div>
			<div class="lll-mode">
				<div class="lll-mode-emoji">🚪</div>
				<h3>3. Proxy Server (gateway HTTP)</h3>
				<p>
					Un service qu'on déploie (Docker, K8s) et qui expose une API
					OpenAI compatible. Tes apps n'utilisent QUE l'OpenAI SDK
					classique pointé vers ton Proxy. Auth, logs, rate limiting,
					virtual keys par utilisateur.
				</p>
				<p class="lll-mode-when"><strong>Quand</strong> : déploiement entreprise multi-équipes, plusieurs apps.</p>
			</div>
		</div>
	</section>

	<!-- ============== 3. SDK ============== -->
	<section id="sdk" class="lll-section">
		<h2 class="lll-h2">3️⃣ Le SDK Python en 5 minutes</h2>
		<p>Voici tout ce qu'il faut savoir pour démarrer.</p>

		<h3 class="lll-h3">Installation</h3>
		<pre class="lll-code"><code>{`pip install litellm`}</code></pre>

		<h3 class="lll-h3">Appel basique (compatible OpenAI)</h3>
		<pre class="lll-code"><code>{`import os
from litellm import completion

os.environ["OPENAI_API_KEY"] = "sk-..."

response = completion(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Bonjour, qu'est-ce qu'un LLM ?"}]
)
print(response.choices[0].message.content)
# Format OpenAI standard. Pas de surprise.`}</code></pre>

		<h3 class="lll-h3">Bascule vers Anthropic — change UNE ligne</h3>
		<pre class="lll-code"><code>{`os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

response = completion(
    model="anthropic/claude-3-5-sonnet-20241022",  # ← seule ligne qui change
    messages=[{"role": "user", "content": "Bonjour, qu'est-ce qu'un LLM ?"}]
)
# Même API en sortie : response.choices[0].message.content`}</code></pre>

		<h3 class="lll-h3">Bascule vers Ollama local (souverain)</h3>
		<pre class="lll-code"><code>{`response = completion(
    model="ollama/mistral-defense:latest",
    messages=[{"role": "user", "content": "Bonjour"}],
    api_base="http://localhost:11434"  # ton serveur Ollama on-premise
)`}</code></pre>

		<h3 class="lll-h3">Streaming</h3>
		<pre class="lll-code"><code>{`for chunk in completion(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Écris un poème"}],
    stream=True
):
    print(chunk.choices[0].delta.content or "", end="")`}</code></pre>

		<h3 class="lll-h3">Gestion d'exceptions standardisée</h3>
		<pre class="lll-code"><code>{`import litellm

try:
    response = litellm.completion(
        model="anthropic/claude-3-haiku-20240307",
        messages=[{"role": "user", "content": "Hey"}]
    )
except litellm.AuthenticationError as e:
    print(f"Bad API key : {e}")
except litellm.RateLimitError as e:
    print(f"Rate limited : {e}")
except litellm.APIError as e:
    print(f"Provider down : {e}")

# LiteLLM normalise les exceptions de tous les providers en classes communes`}</code></pre>
	</section>

	<!-- ============== 4. DÉMO ============== -->
	<section id="demo" class="lll-section">
		<h2 class="lll-h2">4️⃣ Démo — switch provider en un clic ⭐</h2>
		<p>
			Choisis un provider. Vois la <strong>config exacte</strong> à utiliser
			et la requête HTTP générée par LiteLLM en backend. Le code applicatif
			Python ne change pas.
		</p>

		<div class="lll-demo">
			<div class="lll-demo-providers">
				{#each Object.entries(PROVIDERS) as [id, p] (id)}
					<button
						type="button"
						class="lll-demo-provider {selectedProvider === id ? 'is-active' : ''}"
						onclick={() => (selectedProvider = id as Provider)}
					>
						<span class="lll-demo-emoji">{p.emoji}</span>
						<span>{p.label}</span>
					</button>
				{/each}
			</div>

			<div class="lll-demo-grid">
				<div class="lll-demo-block">
					<div class="lll-demo-label">📝 Code Python (UNCHANGED)</div>
					<pre class="lll-demo-code"><code>{`from litellm import completion

response = completion(
    ${provider.config.split('\n').join('\n    ')},
    messages=[
        {"role": "user", "content": "Hello"}
    ]
)
print(response.choices[0].message.content)`}</code></pre>
				</div>
				<div class="lll-demo-block">
					<div class="lll-demo-label">🚀 Sortie : modèle utilisé</div>
					<div class="lll-demo-result">
						<div class="lll-demo-result-row">
							<span class="lll-demo-result-key">Provider</span>
							<span class="lll-demo-result-val">{provider.label}</span>
						</div>
						<div class="lll-demo-result-row">
							<span class="lll-demo-result-key">Modèle</span>
							<span class="lll-demo-result-val lll-demo-result-mono">{provider.model}</span>
						</div>
						<div class="lll-demo-result-row">
							<span class="lll-demo-result-key">Format response</span>
							<span class="lll-demo-result-val">OpenAI-compatible (toujours)</span>
						</div>
						{#if selectedProvider === 'ollama'}
							<div class="lll-demo-callout">
								🔐 <strong>Air-gap compatible</strong> : aucune requête sortante, le LLM tourne sur localhost.
							</div>
						{:else if selectedProvider === 'azure'}
							<div class="lll-demo-callout">
								☁️ Sur ton tenant Azure dédié, dans la région que tu as choisie.
							</div>
						{:else}
							<div class="lll-demo-callout">
								🌐 Appel sortant vers l'API du provider. Vérifie ta politique data avant en prod.
							</div>
						{/if}
					</div>
				</div>
			</div>

			<p class="lll-demo-note">
				👆 Bascule entre les 5 providers — <strong>seules les 2-3 lignes
					de config dans <code>completion()</code> changent</strong>. Le
				reste du code Python (formatage des messages, parsing de la
				réponse, gestion d'erreur, fallbacks) est identique.
			</p>
		</div>
	</section>

	<!-- ============== 5. ROUTER ============== -->
	<section id="router" class="lll-section">
		<h2 class="lll-h2">5️⃣ Router — fallbacks et load balancing</h2>
		<p>
			Au-dessus du SDK, le Router ajoute la <strong>résilience</strong>.
			Tu déclares plusieurs déploiements pour le même nom logique. Si un
			tombe, le Router bascule automatiquement.
		</p>

		<pre class="lll-code"><code>{`from litellm import Router

# 3 déploiements pour le nom logique "production-llm"
router = Router(model_list=[
    {
        "model_name": "production-llm",
        "litellm_params": {
            "model": "ollama/mistral-defense:latest",
            "api_base": "http://ollama-1.intranet:11434"
        }
    },
    {
        "model_name": "production-llm",
        "litellm_params": {
            "model": "ollama/mistral-defense:latest",
            "api_base": "http://ollama-2.intranet:11434"
        }
    },
    # Fallback ultime : un Mistral cloud (uniquement non-classifié)
    {
        "model_name": "production-llm",
        "litellm_params": {
            "model": "mistral/mistral-large-latest",
            "api_key": os.environ["MISTRAL_API_KEY"]
        }
    },
])

# Le Router load-balance entre les déploiements et bascule en cas de panne
response = router.completion(
    model="production-llm",
    messages=[{"role": "user", "content": "Bonjour"}]
)`}</code></pre>

		<Callout variant="warning" title="🔐 Attention en défense">
			<p>
				Le 3ᵉ fallback (Mistral cloud) <strong>ne doit jamais</strong> être
				utilisé pour des requêtes contenant de la donnée classifiée. Tu
				configures ça via une logique applicative en amont du Router (ex :
				le routeur du graphe LangGraph route les requêtes sensibles vers
				un Router qui n'a QUE Ollama, et les autres requêtes vers un
				Router qui a tout).
			</p>
		</Callout>
	</section>

	<!-- ============== 6. PROXY ============== -->
	<section id="proxy" class="lll-section">
		<h2 class="lll-h2">6️⃣ Proxy Server — la gateway centralisée</h2>
		<p>
			Le Proxy est <strong>un service à part</strong> que tu déploies. Tes
			applications utilisent le SDK OpenAI normal, pointé vers ton Proxy.
			Le Proxy fait tout le routing, l'auth, les logs.
		</p>

		<div class="lll-proxy-archi">
			<svg viewBox="0 0 720 240">
				<defs>
					<marker id="lll-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
				</defs>
				<!-- Apps -->
				<rect x="20" y="20" width="140" height="40" rx="8" fill="#1e293b" stroke="#a855f7" stroke-width="2" />
				<text x="90" y="44" text-anchor="middle" fill="#a855f7" font-family="monospace" font-size="12" font-weight="700">Agent LangGraph</text>
				<rect x="20" y="80" width="140" height="40" rx="8" fill="#1e293b" stroke="#a855f7" stroke-width="2" />
				<text x="90" y="104" text-anchor="middle" fill="#a855f7" font-family="monospace" font-size="12" font-weight="700">App ChatBot</text>
				<rect x="20" y="140" width="140" height="40" rx="8" fill="#1e293b" stroke="#a855f7" stroke-width="2" />
				<text x="90" y="164" text-anchor="middle" fill="#a855f7" font-family="monospace" font-size="12" font-weight="700">Notebook data</text>

				<!-- Arrows to proxy -->
				<line x1="160" y1="40" x2="270" y2="100" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#lll-arr)" />
				<line x1="160" y1="100" x2="270" y2="120" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#lll-arr)" />
				<line x1="160" y1="160" x2="270" y2="140" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#lll-arr)" />
				<text x="200" y="125" font-family="monospace" font-size="10" fill="#fb923c" font-style="italic">OpenAI SDK</text>

				<!-- Proxy -->
				<rect x="270" y="80" width="180" height="80" rx="10" fill="#1e293b" stroke="#fb923c" stroke-width="3" />
				<text x="360" y="105" text-anchor="middle" fill="#fb923c" font-family="monospace" font-size="14" font-weight="700">LiteLLM Proxy</text>
				<text x="360" y="125" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="10">port 4000</text>
				<text x="360" y="145" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="10">auth · logs · cost · rate limit</text>

				<!-- Arrows to providers -->
				<line x1="450" y1="100" x2="560" y2="40" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#lll-arr)" />
				<line x1="450" y1="120" x2="560" y2="100" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#lll-arr)" />
				<line x1="450" y1="140" x2="560" y2="160" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#lll-arr)" />

				<!-- Providers -->
				<rect x="560" y="20" width="140" height="40" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="2" />
				<text x="630" y="44" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="12">🦥 Ollama local</text>
				<rect x="560" y="80" width="140" height="40" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="2" />
				<text x="630" y="104" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="12">🇫🇷 Mistral cloud</text>
				<rect x="560" y="140" width="140" height="40" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="2" />
				<text x="630" y="164" text-anchor="middle" fill="#06b6d4" font-family="monospace" font-size="12">☁️ Azure OpenAI</text>

				<text x="200" y="220" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="11">Tes apps internes</text>
				<text x="360" y="220" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="11">Une seule gateway</text>
				<text x="630" y="220" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="11">N providers backend</text>
			</svg>
		</div>

		<h3 class="lll-h3">Configuration du Proxy</h3>
		<pre class="lll-code"><code>{`# config.yaml
model_list:
  - model_name: production-llm
    litellm_params:
      model: ollama/mistral-defense:latest
      api_base: http://ollama:11434

  - model_name: production-llm     # même nom logique
    litellm_params:
      model: ollama/mistral-defense:latest
      api_base: http://ollama-replica:11434

  - model_name: dev-claude
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  fallbacks:
    - production-llm: ["dev-claude"]   # si Ollama down → claude
  cache: true
  set_verbose: true
  success_callback: ["langfuse"]       # observability

router_settings:
  routing_strategy: "simple-shuffle"   # load balance entre les 2 ollama

general_settings:
  master_key: sk-master-...           # auth admin
  database_url: "postgresql://..."    # virtual keys, budgets`}</code></pre>

		<h3 class="lll-h3">Lancer le Proxy</h3>
		<pre class="lll-code"><code>{`# En CLI
litellm --config config.yaml --port 4000

# Ou en Docker
docker run -p 4000:4000 \\
  -v $(pwd)/config.yaml:/app/config.yaml \\
  -e OPENAI_API_KEY=$OPENAI_API_KEY \\
  ghcr.io/berriai/litellm:main-stable \\
  --config /app/config.yaml`}</code></pre>

		<h3 class="lll-h3">Utiliser le Proxy depuis n'importe quelle app</h3>
		<pre class="lll-code"><code>{`# Tes apps utilisent juste l'OpenAI SDK standard
import openai

client = openai.OpenAI(
    api_key="sk-virtual-key-xyz",     # virtual key généré côté Proxy
    base_url="http://litellm-proxy.intranet:4000"
)

response = client.chat.completions.create(
    model="production-llm",            # nom logique géré par le Proxy
    messages=[{"role": "user", "content": "Bonjour"}]
)
# Le Proxy choisit le backend, route, log, mesure le coût.
# L'app n'a aucune idée de quel modèle a vraiment répondu.`}</code></pre>
	</section>

	<!-- ============== 7. INTÉGRATION LANGGRAPH ============== -->
	<section id="integration" class="lll-section">
		<h2 class="lll-h2">7️⃣ Intégration LangGraph souverain ⚡</h2>
		<p class="lll-lead">
			Voici l'intégration concrète pour ton agent défense : LangGraph
			parle à LiteLLM (qui parle à Ollama en prod, Claude en dev). Tu as
			ainsi le code <strong>identique</strong> en dev et en prod, seul un
			fichier de config change.
		</p>

		<h3 class="lll-h3">Approche 1 — LiteLLM SDK directement (simple)</h3>
		<pre class="lll-code"><code>{`# agent.py
from langchain_community.chat_models import ChatLiteLLM
from langgraph.prebuilt import create_react_agent

# En dev local
llm = ChatLiteLLM(
    model="anthropic/claude-3-5-sonnet-20241022",
    api_key=os.environ["ANTHROPIC_API_KEY"]
)

# En prod air-gap, juste cette ligne change :
# llm = ChatLiteLLM(
#     model="ollama/mistral-defense:latest",
#     api_base="http://localhost:11434"
# )

agent = create_react_agent(llm, tools=[check_classification, retrieve_rag])
result = await agent.ainvoke({"messages": [HumanMessage("Bonjour")]})`}</code></pre>

		<h3 class="lll-h3">Approche 2 — LiteLLM Proxy (recommandé pour prod)</h3>
		<pre class="lll-code"><code>{`# Côté Proxy : un seul service que ton infra contrôle
# config.yaml — déjà vu plus haut, 3 backends derrière un nom logique

# Côté agent : utilise le client OpenAI standard
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

llm = ChatOpenAI(
    model="production-llm",                          # nom géré par le Proxy
    api_key="sk-team-defense-xyz",                  # virtual key per team
    base_url="http://litellm-proxy.intranet:4000"   # ton Proxy interne
)

# Le code agent ne sait RIEN du backend réel.
# Demain tu changes Mistral 7B → Mistral 22B → personne ne touche au code agent.
agent = create_react_agent(llm, tools=[...])`}</code></pre>

		<Callout variant="insight" title="🎯 Bénéfices concrets pour ton projet souverain">
			<ul>
				<li><strong>Code identique dev / prod</strong> : aucune divergence, pas de "ça marchait en dev".</li>
				<li><strong>Audit centralisé</strong> : chaque appel LLM passe par le Proxy → log unique avec qui (virtual key), quoi (prompt + réponse), quand, combien (cost calculé).</li>
				<li><strong>Rate limiting par équipe</strong> : la virtual key de l'équipe Recherche a un budget de 1k requêtes/jour, celle de la prod en a 100k.</li>
				<li><strong>Bascule de modèle invisible</strong> : tu améliores Mistral 7B → 22B sans toucher au code agent.</li>
				<li><strong>Fallback automatique</strong> : si Ollama-1 tombe, requête routée vers Ollama-2 sans erreur côté agent.</li>
				<li><strong>Cohérence avec MCP</strong> : LiteLLM gère les LLMs, MCP gère les tools/data. Ensemble = stack agentique propre et modulaire.</li>
			</ul>
		</Callout>
	</section>

	<!-- ============== 8. COST & OBSERVABILITY ============== -->
	<section id="cost" class="lll-section">
		<h2 class="lll-h2">8️⃣ Cost tracking & observability</h2>

		<h3 class="lll-h3">Cost calculation automatique</h3>
		<pre class="lll-code"><code>{`from litellm import completion

response = completion(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Bonjour"}]
)

# LiteLLM calcule automatiquement le coût (basé sur sa table de prix interne)
print(f"Cost: $\${response._hidden_params['response_cost']:.6f}")
# → Cost: $0.000045 (input + output tokens × prix)

# Avec un callback pour logger / agréger
def track_cost(kwargs, completion_response, start_time, end_time):
    cost = kwargs.get("response_cost", 0)
    user = kwargs.get("user", "unknown")
    db.insert("cost_log", user=user, cost=cost, model=kwargs.get("model"))

litellm.success_callback = [track_cost]`}</code></pre>

		<h3 class="lll-h3">Intégration observability</h3>
		<pre class="lll-code"><code>{`# LiteLLM s'intègre nativement avec :
litellm.success_callback = [
    "langfuse",      # tracing LLM open-source
    "mlflow",        # tracking + experiment
    "helicone",      # observability commercial
    "langsmith",     # LangChain official
]

# Une seule ligne — chaque appel est tracé automatiquement.
# Pour Langfuse en self-hosted (souverain) :
os.environ["LANGFUSE_HOST"] = "http://langfuse.intranet:3000"
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-..."`}</code></pre>

		<Callout variant="info" title="📊 Pour ton projet souverain">
			<p>
				En prod, tu déploies <strong>Langfuse</strong> (open-source,
				self-hostable, Apache 2.0) sur ton K8s air-gap. LiteLLM Proxy y
				envoie chaque appel automatiquement. Tu obtiens :
			</p>
			<ul>
				<li>Trace complète de chaque conversation (prompts + réponses + tokens + latence + cost).</li>
				<li>Dashboards par équipe / par utilisateur / par modèle.</li>
				<li>Alerting sur dépassement de budget.</li>
				<li>Tout reste dans ton intranet — aucune donnée ne sort.</li>
			</ul>
		</Callout>
	</section>

	<!-- ============== 9. GLOSSAIRE ============== -->
	<section id="glossaire" class="lll-section">
		<h2 class="lll-h2">9️⃣ Glossaire</h2>
		<dl class="lll-glossary">
			<div class="lll-gl-row"><dt>Callback</dt><dd>Fonction Python appelée par LiteLLM à chaque succès/échec d'une requête. Utilisée pour logging, cost tracking, observability.</dd></div>
			<div class="lll-gl-row"><dt>completion()</dt><dd>La fonction de base de LiteLLM, équivalente à <code>openai.chat.completions.create()</code>. Compatible avec tous les providers.</dd></div>
			<div class="lll-gl-row"><dt>config.yaml</dt><dd>Fichier de configuration du Proxy. Définit la <code>model_list</code>, les fallbacks, le routing.</dd></div>
			<div class="lll-gl-row"><dt>Drop-in replacement</dt><dd>LiteLLM peut remplacer le SDK <code>openai</code> en changeant juste l'import. Pas de réécriture nécessaire.</dd></div>
			<div class="lll-gl-row"><dt>Fallback</dt><dd>Bascule automatique vers un provider de secours en cas d'échec.</dd></div>
			<div class="lll-gl-row"><dt>Gateway / Proxy</dt><dd>Service HTTP qui expose une API OpenAI standard et route vers les vrais providers en backend.</dd></div>
			<div class="lll-gl-row"><dt>Langfuse</dt><dd>Plateforme open-source d'observability LLM, self-hostable. Compatible LiteLLM.</dd></div>
			<div class="lll-gl-row"><dt>LiteLLM SDK</dt><dd>La lib Python <code>litellm</code> à importer dans ton code. Le mode le plus simple.</dd></div>
			<div class="lll-gl-row"><dt>master_key</dt><dd>Clé admin du Proxy qui permet de générer les virtual keys.</dd></div>
			<div class="lll-gl-row"><dt>model_list</dt><dd>Liste des modèles déclarés dans config.yaml. Mappe nom logique → backend.</dd></div>
			<div class="lll-gl-row"><dt>Ollama</dt><dd>Runtime local open-source pour faire tourner des LLM en GGUF. Compatible OpenAI sur port 11434.</dd></div>
			<div class="lll-gl-row"><dt>OpenAI-compatible</dt><dd>Format d'API standardisé : <code>POST /v1/chat/completions</code> avec messages. Réutilisé par tous les providers via LiteLLM.</dd></div>
			<div class="lll-gl-row"><dt>Provider</dt><dd>Service LLM (OpenAI, Anthropic, Mistral, Bedrock, Azure, Vertex, Ollama…). LiteLLM en supporte 100+.</dd></div>
			<div class="lll-gl-row"><dt>Rate limit</dt><dd>Limite de requêtes par minute/jour. LiteLLM la gère par virtual key, par équipe, par modèle.</dd></div>
			<div class="lll-gl-row"><dt>Router</dt><dd>Couche au-dessus du SDK qui ajoute load-balancing et fallbacks entre déploiements.</dd></div>
			<div class="lll-gl-row"><dt>routing_strategy</dt><dd>Comment le Router choisit un backend : <code>simple-shuffle</code>, <code>least-busy</code>, <code>latency-based</code>, <code>usage-based</code>.</dd></div>
			<div class="lll-gl-row"><dt>Streaming</dt><dd>Recevoir les tokens du LLM au fur et à mesure (<code>stream=True</code>). LiteLLM le supporte uniformément sur tous les providers.</dd></div>
			<div class="lll-gl-row"><dt>success_callback</dt><dd>Fonction(s) appelée(s) à chaque succès. <code>litellm.success_callback = ["langfuse"]</code>.</dd></div>
			<div class="lll-gl-row"><dt>Virtual key</dt><dd>Clé d'API émise par le Proxy LiteLLM, avec budget et permissions associés. Une par utilisateur ou équipe.</dd></div>
		</dl>
	</section>
</article>

<style>
	.lll {
		max-width: 1240px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		display: flex; flex-direction: column; gap: 2rem;
	}
	.lll :global(p), .lll :global(.lll-lead) { max-width: 880px; }

	.lll-hero {
		text-align: center; padding: 2rem 1.5rem;
		background: linear-gradient(135deg, #fef9c3 0%, #fff 100%);
		border-radius: 1.5rem; border: 1px solid #facc15;
	}
	.lll-hero-emoji { font-size: 4rem; display: block; }
	.lll-h1 {
		font-family: var(--font-display); font-size: 2.25rem; font-weight: 700;
		color: var(--color-ink-900); margin: 0.5rem 0 0;
	}
	.lll-hero-lead {
		font-size: 1rem; color: var(--color-ink-700); max-width: 660px;
		margin: 0.85rem auto 1.5rem; line-height: 1.6;
	}
	.lll-hero-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
	.lll-cta { padding: 0.7rem 1.5rem; border-radius: 999px; text-decoration: none; font-weight: 500; }
	.lll-cta-primary { background: #facc15; color: #1e293b; }
	.lll-cta-secondary { background: #fff; color: var(--color-ink-900); border: 2px solid #facc15; }

	.lll-toc {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem 1.5rem;
	}
	.lll-toc-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem;
	}
	.lll-toc-list {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0;
	}
	.lll-toc-list a { color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem; }
	.lll-toc-list a:hover { color: #ca8a04; }

	.lll-section { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 80px; }
	.lll-h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-ink-900); margin: 0; }
	.lll-h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; color: var(--color-ink-900); margin: 1rem 0 0.5rem; }
	.lll-lead { font-size: 1rem; color: var(--color-ink-700); line-height: 1.6; margin: 0; }

	.lll-prereq-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem;
	}
	.lll-prereq { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
	.lll-prereq summary {
		cursor: pointer; padding: 0.85rem 1rem; font-family: var(--font-display);
		font-weight: 600; font-size: 0.95rem; color: var(--color-ink-900); list-style: none;
	}
	.lll-prereq summary::-webkit-details-marker { display: none; }
	.lll-prereq summary::after {
		content: '▶'; float: right; color: var(--color-ink-500); font-size: 0.7rem;
		transition: transform 0.15s;
	}
	.lll-prereq[open] summary::after { transform: rotate(90deg); }
	.lll-prereq[open] summary { background: #fef9c3; border-bottom: 1px solid #e2e8f0; }
	.lll-prereq > div { padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; }

	.lll-problem {
		display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem;
	}
	@media (max-width: 720px) { .lll-problem { grid-template-columns: 1fr; } }
	.lll-problem-before, .lll-problem-after {
		padding: 1rem 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
	}
	.lll-problem-before { border-left: 4px solid #dc2626; }
	.lll-problem-after { border-left: 4px solid #16a34a; background: #f0fdf4; }
	.lll-problem h4 { font-family: var(--font-display); margin: 0 0 0.5rem; color: var(--color-ink-900); }
	.lll-problem p { font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; margin: 0 0 0.5rem; }
	.lll-problem-arrow {
		display: flex; align-items: center; justify-content: center;
		font-size: 2.5rem; color: #facc15; font-weight: 700;
	}

	.lll-modes {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem;
	}
	.lll-mode {
		padding: 1rem 1.25rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
	}
	.lll-mode-emoji { font-size: 2rem; }
	.lll-mode h3 { font-family: var(--font-display); font-size: 1.1rem; margin: 0.25rem 0 0.5rem; color: var(--color-ink-900); }
	.lll-mode p { font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; margin: 0 0 0.5rem; }
	.lll-mode-when { font-size: 0.82rem !important; color: var(--color-ink-500) !important; font-style: italic; }

	.lll-code {
		background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem;
		border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem;
		line-height: 1.6; margin: 0.5rem 0;
		white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
	}

	/* Demo */
	.lll-demo {
		display: flex; flex-direction: column; gap: 1rem;
		background: #0f172a; border-radius: 1rem; padding: 1.25rem;
	}
	.lll-demo-providers { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.lll-demo-provider {
		display: flex; align-items: center; gap: 0.5rem;
		padding: 0.6rem 1rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 999px; color: #cbd5e1; font-size: 0.9rem; cursor: pointer;
	}
	.lll-demo-provider.is-active {
		background: #facc15; border-color: #facc15; color: #1e293b; font-weight: 600;
	}
	.lll-demo-emoji { font-size: 1.2rem; }
	.lll-demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
	@media (max-width: 720px) { .lll-demo-grid { grid-template-columns: 1fr; } }
	.lll-demo-block {
		display: flex; flex-direction: column; gap: 0.4rem;
		background: #1e293b; border: 1px solid #334155; border-radius: 0.6rem; padding: 0.75rem;
	}
	.lll-demo-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: #94a3b8; padding: 0.15rem 0.5rem; background: #0f172a; border-radius: 0.3rem;
		display: inline-block; align-self: flex-start;
	}
	.lll-demo-code {
		margin: 0; padding: 0.7rem 0.85rem; background: #0f172a; border: 1px solid #334155;
		border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.72rem;
		line-height: 1.6; color: #cbd5e1;
		white-space: pre-wrap; word-break: break-word;
	}
	.lll-demo-result {
		display: flex; flex-direction: column; gap: 0.4rem;
		background: #0f172a; padding: 0.7rem 0.85rem; border-radius: 0.4rem; border: 1px solid #334155;
	}
	.lll-demo-result-row {
		display: flex; justify-content: space-between; gap: 0.5rem;
		padding: 0.25rem 0; border-bottom: 1px solid #1e293b;
	}
	.lll-demo-result-key {
		font-family: var(--font-mono); font-size: 0.72rem; color: #94a3b8;
		text-transform: uppercase; letter-spacing: 0.05em;
	}
	.lll-demo-result-val { color: #e2e8f0; font-size: 0.85rem; }
	.lll-demo-result-mono { font-family: var(--font-mono); font-size: 0.78rem; }
	.lll-demo-callout {
		margin-top: 0.4rem; padding: 0.6rem 0.7rem; background: #1e1810;
		border-left: 3px solid #facc15; border-radius: 0.4rem;
		font-size: 0.82rem; color: #fef3c7; line-height: 1.5;
	}
	.lll-demo-note { color: #cbd5e1 !important; font-size: 0.88rem; line-height: 1.55; margin: 0; }

	.lll-proxy-archi {
		background: #0f172a; border-radius: 0.75rem; padding: 0.75rem;
	}
	.lll-proxy-archi svg { width: 100%; height: auto; max-height: 280px; }

	.lll-glossary { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.lll-gl-row {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem;
		padding: 0.65rem 1rem; display: grid; grid-template-columns: 200px 1fr; gap: 1rem;
	}
	.lll-gl-row dt { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: #ca8a04; }
	.lll-gl-row dd { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	.lll-gl-row dd code {
		background: #fef9c3; padding: 0.1rem 0.35rem; border-radius: 0.25rem;
		font-family: var(--font-mono); font-size: 0.85em;
	}
	@media (max-width: 600px) {
		.lll-gl-row { grid-template-columns: 1fr; gap: 0.25rem; }
	}
</style>
