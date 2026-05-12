<!--
	/langgraph — Lab d'apprentissage LangGraph.

	Pédagogie : 4 niveaux (intuitif/pédagogue/pratique/profond) sur les
	concepts clés, simulateur interactif au cœur, exemples concrets,
	cas d'usage défense aligné avec le projet souverain.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';
	import DefenseAgentSimulator from '$lib/components/concepts/DefenseAgentSimulator.svelte';
	import DifficultyTabs from '$lib/components/DifficultyTabs.svelte';
	import LangGraphSimulator from '$lib/components/concepts/LangGraphSimulator.svelte';
	import SequentialToolsSimulator from '$lib/components/concepts/SequentialToolsSimulator.svelte';
	import SupervisorSimulator from '$lib/components/concepts/SupervisorSimulator.svelte';
</script>

<svelte:head>
	<title>LangGraph — Orchestrer des agents stateful</title>
</svelte:head>

<article class="lg">
	<!-- ============== HÉROS ============== -->
	<header class="lg-hero">
		<span class="lg-hero-emoji" aria-hidden="true">🦜</span>
		<h1 class="lg-h1">LangGraph — Orchestrer des agents stateful</h1>
		<p class="lg-hero-lead">
			Tu vas apprendre à construire des <strong>agents qui raisonnent en
				boucle</strong>, appellent des outils, gardent une mémoire — avec
			un graphe de nœuds que tu pilotes. Au cœur de la page, un
			<strong>simulateur interactif</strong> où tu peux faire tourner pas-à-pas
			le pattern ReAct sur deux scénarios concrets.
		</p>
		<div class="lg-hero-actions">
			<a href="#simulator" class="lg-cta lg-cta-primary">🎮 Aller au simulateur</a>
			<a href="#concepts" class="lg-cta lg-cta-secondary">📚 Concepts d'abord</a>
		</div>
	</header>

	<!-- ============== TOC ============== -->
	<nav class="lg-toc" aria-label="Table des matières">
		<p class="lg-toc-label">📍 Parcours en 10 étapes</p>
		<ol class="lg-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#pourquoi">1. Pourquoi LangGraph ?</a></li>
			<li><a href="#concepts">2. Les 4 concepts clés</a></li>
			<li><a href="#simulator">3. Simulateur ReAct (avec vue technique) ⭐</a></li>
			<li><a href="#code">4. Le code, ligne par ligne</a></li>
			<li><a href="#patterns">5. Patterns courants</a></li>
			<li><a href="#defense">6. Cas d'usage — agent défense (interactif) ⭐</a></li>
			<li><a href="#sequential-tools">7. Appels de tools séquentiels ⭐</a></li>
			<li><a href="#supervisor">8. Multi-Agent Supervisor ⭐</a></li>
			<li><a href="#further">9. Pour aller plus loin</a></li>
			<li><a href="#glossaire">10. Glossaire</a></li>
		</ol>
	</nav>

	<!-- ============== 0. PRÉREQUIS ============== -->
	<section id="prereq" class="lg-section">
		<h2 class="lg-h2">0️⃣ Avant de commencer</h2>
		<p class="lg-lead">Cinq notions à avoir en tête avant de plonger.</p>

		<div class="lg-prereq-grid">
			<details class="lg-prereq">
				<summary>🤖 Qu'est-ce qu'un agent (au sens LLM) ?</summary>
				<div class="lg-prereq-body">
					<p>
						Un <strong>agent</strong> = un LLM dans une boucle. Au lieu de juste
						répondre une fois, il <strong>raisonne, décide d'appeler un outil,
							observe le résultat, raisonne encore</strong>, jusqu'à pouvoir
						répondre. C'est le pattern « ReAct » du papier 2210.03629 de ton
						corpus.
					</p>
					<p>
						Un agent simple a 3 ingrédients : (1) un LLM, (2) un ensemble
						d'outils (recherche web, calculatrice, base de données…), (3) une
						boucle de contrôle. LangGraph fournit la troisième.
					</p>
				</div>
			</details>

			<details class="lg-prereq">
				<summary>🔧 Qu'est-ce qu'un outil (tool) ?</summary>
				<div class="lg-prereq-body">
					<p>
						Un <strong>outil</strong> = une fonction Python que le LLM peut
						demander d'exécuter. Par exemple :
						<code>search_pubchem(query: str) → str</code>. Le LLM ne l'exécute
						pas lui-même — il <strong>demande</strong> son exécution dans sa
						sortie (un <em>tool_call</em>), et un autre composant l'exécute
						pour de vrai.
					</p>
					<p>
						Le LLM connaît la signature et la description de l'outil. Il
						décide, à chaque étape, si l'outil doit être appelé.
					</p>
				</div>
			</details>

			<details class="lg-prereq">
				<summary>⚙️ Qu'est-ce qu'une state machine ?</summary>
				<div class="lg-prereq-body">
					<p>
						Un <strong>graphe d'états et de transitions</strong>. Chaque nœud
						est un état où il se passe quelque chose. Chaque arête est une
						transition possible. À tout moment, on est sur un nœud (l'état
						actif), et on suit l'arête vers le suivant.
					</p>
					<p>
						LangGraph utilise un graphe orienté qui peut avoir des cycles
						(retour en arrière), c'est ce qui permet la boucle d'un agent.
					</p>
				</div>
			</details>

			<details class="lg-prereq">
				<summary>🦜 LangChain — la maison-mère</summary>
				<div class="lg-prereq-body">
					<p>
						<strong>LangChain</strong> est le framework Python le plus utilisé
						pour construire des apps LLM (prompts, chains, retrievers,
						agents…). Il existe depuis 2022.
					</p>
					<p>
						<strong>LangGraph</strong> est une librairie de l'équipe
						LangChain, sortie en 2024. Elle remplace les agents
						« classiques » de LangChain par un modèle plus puissant : un
						graphe explicite, plus contrôlable, plus prévisible. Aujourd'hui
						la voie recommandée pour tout agent non-trivial.
					</p>
				</div>
			</details>

			<details class="lg-prereq">
				<summary>🧠 Pré-requis Python</summary>
				<div class="lg-prereq-body">
					<p>
						Tu dois savoir lire :
					</p>
					<ul>
						<li>Une <strong>fonction</strong> qui prend des arguments et renvoie quelque chose.</li>
						<li>Un <strong>dictionnaire</strong> Python : <code>{`{"messages": [...]}`}</code>.</li>
						<li>Un <strong>type</strong> : <code>TypedDict</code> en particulier.</li>
						<li>Un <strong>décorateur</strong> : <code>@tool</code>.</li>
					</ul>
					<p>
						Pas besoin de plus. On va lire plus de code qu'on en écrit.
					</p>
				</div>
			</details>
		</div>
	</section>

	<!-- ============== 1. POURQUOI ============== -->
	<section id="pourquoi" class="lg-section">
		<h2 class="lg-h2">1️⃣ Pourquoi LangGraph ?</h2>
		<p class="lg-lead">
			Avant LangGraph, on construisait des agents avec des boucles
			Python ad-hoc ou des « AgentExecutor » LangChain — boîtes noires
			peu contrôlables. LangGraph apporte 5 choses essentielles.
		</p>

		<div class="lg-why-grid">
			<div class="lg-why-card">
				<div class="lg-why-emoji">🎯</div>
				<strong>Contrôle explicite</strong>
				<p>Tu écris le graphe toi-même. Tu sais exactement quels chemins le LLM peut prendre. Plus de surprise.</p>
			</div>
			<div class="lg-why-card">
				<div class="lg-why-emoji">💾</div>
				<strong>État partagé typé</strong>
				<p>Une seule structure (TypedDict) traverse tout le graphe. Plus de variables qui se perdent dans les fonctions.</p>
			</div>
			<div class="lg-why-card">
				<div class="lg-why-emoji">🔁</div>
				<strong>Cycles natifs</strong>
				<p>Le graphe peut avoir des boucles. C'est ce qui permet « réfléchir → agir → re-réfléchir ».</p>
			</div>
			<div class="lg-why-card">
				<div class="lg-why-emoji">⏸️</div>
				<strong>Checkpointing</strong>
				<p>L'état peut être sauvegardé/repris à n'importe quel moment. Pratique pour debugger ou reprendre après crash.</p>
			</div>
			<div class="lg-why-card">
				<div class="lg-why-emoji">👥</div>
				<strong>Multi-agent</strong>
				<p>Plusieurs LLM avec des rôles différents qui collaborent dans le même graphe. Patterns supervisor, hiérarchique…</p>
			</div>
			<div class="lg-why-card">
				<div class="lg-why-emoji">🔍</div>
				<strong>Observabilité</strong>
				<p>Chaque transition est tracée. Idéal pour audit (essentiel en défense) et debugging.</p>
			</div>
		</div>
	</section>

	<!-- ============== 2. CONCEPTS ============== -->
	<section id="concepts" class="lg-section">
		<h2 class="lg-h2">2️⃣ Les 4 concepts clés</h2>
		<p class="lg-lead">
			Tout LangGraph se résume à 4 briques. Maîtrise-les et tu peux
			construire n'importe quel agent.
		</p>

		<!-- State -->
		<DifficultyTabs
			id="c-state"
			title="① State — la mémoire partagée"
			tagline="L'unique structure de données qui traverse le graphe"
		>
			{#snippet intuitive()}
				<p>
					Imagine un <strong>cahier de bord</strong> qui passe de main en
					main entre les nœuds du graphe. Chaque nœud peut y lire et y
					ajouter des choses. C'est <strong>la mémoire commune</strong> de
					tout l'agent.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Bon, posons-le clairement. Le <strong>State</strong> est un objet
					Python (concrètement un <code>TypedDict</code>) qui contient
					tout ce que ton agent a besoin de savoir à un instant donné.
					Typiquement la liste des messages échangés, mais ça peut être
					n'importe quoi : un compteur, un score, des résultats
					intermédiaires.
				</p>
				<p>
					Voici la déclaration la plus courante (l'agent ReAct standard) :
				</p>
				<pre class="lg-code"><code>{`from typing import TypedDict, Annotated, Sequence
import operator

class AgentState(TypedDict):
    messages: Annotated[Sequence, operator.add]`}</code></pre>
				<p>
					<strong>Décortication ligne par ligne :</strong>
				</p>
				<ul>
					<li><code>TypedDict</code> : un dict Python avec des champs typés. <code>state["messages"]</code> contient une liste.</li>
					<li><code>Annotated[Sequence, operator.add]</code> : c'est la magie LangGraph. <code>operator.add</code> est un <strong>reducer</strong>. Quand un nœud renvoie <code>{`{"messages": [new_msg]}`}</code>, LangGraph utilise <code>operator.add</code> pour les <em>additionner</em> à l'existant — donc concatener les listes au lieu de remplacer. Sans ça, chaque nœud écraserait l'historique.</li>
				</ul>
				<p>
					Pour des champs simples (un compteur, un flag), pas besoin
					d'Annotated — la valeur est juste remplacée à chaque update.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>Ce que tu fais en pratique :</p>
				<ol>
					<li>Tu déclares un <code>AgentState</code> au début de ton fichier.</li>
					<li>Tu utilises <code>Annotated</code> + reducer pour les listes (messages, logs).</li>
					<li>Tu passes ce type au constructeur : <code>StateGraph(AgentState)</code>.</li>
					<li>Chaque nœud reçoit l'état en argument et renvoie un dict d'updates.</li>
				</ol>
				<pre class="lg-code"><code>{`def my_node(state: AgentState):
    last = state["messages"][-1]
    response = llm.invoke([last])
    return {"messages": [response]}  # juste l'ajout, pas tout le state`}</code></pre>
			{/snippet}
			{#snippet deep()}
				<p>
					Sous le capot, LangGraph compile le graphe en un automate dont
					chaque transition applique une <strong>fonction de fusion</strong>
					sur l'état. Pour un champ <code>Annotated[T, reducer]</code>, la
					fusion est <code>state[k] = reducer(state[k], update[k])</code>.
				</p>
				<p>
					Plusieurs reducers utiles :
				</p>
				<ul>
					<li><code>operator.add</code> — pour des listes (concat).</li>
					<li><code>lambda a, b: {`{**a, **b}`}</code> — pour des dicts (merge).</li>
					<li>Custom — pour de la logique métier (max, dedup, …).</li>
				</ul>
				<p>
					Ces reducers sont <strong>déterministes</strong>, ce qui rend le
					checkpointing simple : il suffit de sérialiser l'état complet à
					chaque step.
				</p>
			{/snippet}
		</DifficultyTabs>

		<!-- Nodes -->
		<DifficultyTabs
			id="c-nodes"
			title="② Nodes — les unités de calcul"
			tagline="Des fonctions Python qui prennent l'état et renvoient des updates"
		>
			{#snippet intuitive()}
				<p>
					Un <strong>nœud</strong> = une fonction qui fait UN truc (penser,
					exécuter un outil, formater une réponse…). Le graphe te dit
					dans quel ordre on les appelle.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Concrètement, un nœud est <strong>une fonction Python toute
						bête</strong>. Elle prend l'état complet en argument, elle fait
					ce qu'elle a à faire, et elle renvoie un dictionnaire avec
					seulement <strong>les changements à apporter à l'état</strong>.
				</p>
				<pre class="lg-code"><code>{`def agent(state: AgentState):
    """Le nœud qui appelle le LLM."""
    response = llm_with_tools.invoke(state["messages"])
    # Renvoie SEULEMENT les changements
    return {"messages": [response]}

def action(state: AgentState):
    """Le nœud qui exécute les outils demandés par l'agent."""
    last = state["messages"][-1]
    tool_results = []
    for call in last.tool_calls:
        result = tools_by_name[call.name].invoke(call.args)
        tool_results.append(result)
    return {"messages": tool_results}`}</code></pre>
				<p>
					Tu enregistres chaque nœud dans le graphe avec
					<code>graph.add_node("nom", function)</code>. Le « nom » est la
					string utilisée dans les arêtes pour le référencer.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>Patterns courants pour les nœuds :</p>
				<ul>
					<li><strong>Nœud LLM</strong> : appelle un modèle, renvoie sa réponse.</li>
					<li><strong>Nœud outil</strong> : exécute un ou plusieurs outils.</li>
					<li><strong>Nœud transformation</strong> : reformate, filtre, valide.</li>
					<li><strong>Nœud humain</strong> : pause le graphe et attend input humain.</li>
				</ul>
				<p>
					Règle d'or : <strong>chaque nœud fait UNE chose</strong>. Si tu te
					retrouves avec un nœud qui fait à la fois LLM + outils + format,
					sépare-le. Le debug devient trivial.
				</p>
			{/snippet}
			{#snippet deep()}
				<p>
					Les nœuds peuvent être <strong>asynchrones</strong>
					(<code>async def</code>) — utile pour des appels parallèles à
					plusieurs LLMs ou outils. LangGraph les exécute en concurrence.
				</p>
				<p>
					Ils peuvent aussi <strong>renvoyer plusieurs updates</strong> via
					des « commands » spéciaux (<code>Command(goto=...)</code>) pour
					changer dynamiquement la prochaine destination — un
					super-pouvoir pour les workflows multi-agent.
				</p>
			{/snippet}
		</DifficultyTabs>

		<!-- Edges -->
		<DifficultyTabs
			id="c-edges"
			title="③ Edges — les transitions"
			tagline="Les flèches qui disent quel nœud vient après quel autre"
		>
			{#snippet intuitive()}
				<p>
					Une <strong>arête</strong> = « après le nœud A, va au nœud B ».
					Comme les flèches sur un schéma. Simple ou conditionnelle.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Il y a <strong>deux types</strong> d'arêtes en LangGraph, et
					comprendre la différence est crucial.
				</p>
				<h4>Arêtes simples — déterministes</h4>
				<p>
					Tu écris : « après le nœud action, va toujours vers le nœud
					agent ». Pas de choix, pas de logique.
				</p>
				<pre class="lg-code"><code>{`graph.add_edge("action", "agent")`}</code></pre>
				<h4>Arêtes conditionnelles — avec router</h4>
				<p>
					Tu écris : « après le nœud agent, va vers `action` ou vers
					`__end__` selon le résultat ». Tu fournis une fonction qui examine
					l'état et renvoie le nom du nœud suivant.
				</p>
				<pre class="lg-code"><code>{`def should_continue(state: AgentState) -> str:
    """Décide où aller après le nœud agent."""
    last = state["messages"][-1]
    if last.tool_calls:
        return "continue"  # → action
    return "end"           # → __end__

graph.add_conditional_edges(
    "agent",                 # depuis ce nœud
    should_continue,         # cette fonction décide
    {                        # mapping nom-décision → nom-nœud
        "continue": "action",
        "end": END,
    },
)`}</code></pre>
				<p>
					C'est cette construction qui crée les <strong>cycles</strong>
					(boucles agent ↔ action) et les <strong>branchements</strong>
					(routing vers différents experts dans un graphe multi-agent).
				</p>
			{/snippet}
			{#snippet practical()}
				<p>Les 3 commandes essentielles :</p>
				<ul>
					<li><code>graph.set_entry_point("agent")</code> — par où on commence (équivalent à une arête depuis __start__).</li>
					<li><code>graph.add_edge("action", "agent")</code> — arête simple.</li>
					<li><code>graph.add_conditional_edges(...)</code> — arête conditionnelle avec router.</li>
				</ul>
			{/snippet}
			{#snippet deep()}
				<p>
					Une fonction de routage peut renvoyer une <strong>liste</strong> de
					destinations — le graphe fan-out vers plusieurs nœuds en parallèle.
					Utile pour des explorations multi-pistes.
				</p>
				<p>
					Le routeur est lui-même une fonction Python — donc tu peux
					utiliser un LLM dedans pour des décisions complexes (« le
					supervisor LLM choisit le sous-agent »).
				</p>
			{/snippet}
		</DifficultyTabs>

		<!-- Compilation -->
		<DifficultyTabs
			id="c-compile"
			title="④ Compilation et exécution"
			tagline="Du graphe-description au graphe-exécutable"
		>
			{#snippet intuitive()}
				<p>
					Une fois le graphe décrit (nœuds + arêtes), tu le
					<strong>compiles</strong> en un objet exécutable. Puis tu l'invoques
					avec un état initial — il se débrouille pour traverser tous les
					nœuds dans le bon ordre.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Compiler = transformer la description abstraite en moteur
					concret. Pourquoi cette étape ? Parce que LangGraph fait des
					vérifications (chaque nœud cité existe, les arêtes sont
					cohérentes, pas de cycle non-intentionnel) et optimise.
				</p>
				<pre class="lg-code"><code>{`# Compilation
app = graph.compile()

# Invocation : on passe l'état initial
result = app.invoke({
    "messages": [HumanMessage(content="Quelle est la formule de la caféine ?")]
})

# result est l'état final, après que le graphe a fini de tourner
print(result["messages"][-1].content)`}</code></pre>
				<p>
					Tu peux aussi faire de la <strong>streaming invocation</strong>
					avec <code>app.stream(...)</code> — ça te donne chaque étape au
					fur et à mesure (utile pour afficher en direct ce que fait
					l'agent).
				</p>
			{/snippet}
			{#snippet practical()}
				<p>Les 3 façons d'exécuter le graphe :</p>
				<ul>
					<li><code>app.invoke(input)</code> → un seul résultat final.</li>
					<li><code>app.stream(input)</code> → un itérateur qui yield chaque update intermédiaire.</li>
					<li><code>app.astream(input)</code> → version asynchrone.</li>
				</ul>
				<p>
					Pour le checkpointing (sauvegarder l'état), passe un
					<code>checkpointer</code> à <code>compile()</code>.
				</p>
			{/snippet}
			{#snippet deep()}
				<p>
					Sous le capot, LangGraph utilise une variante de
					<strong>Pregel</strong> (l'algorithme Google de calcul sur graphes).
					Chaque pas est appelé un <em>superstep</em> ; les nœuds en
					attente sont tous exécutés ; ensuite les transitions sont calculées
					selon le router. Cela permet la concurrence naturelle.
				</p>
			{/snippet}
		</DifficultyTabs>
	</section>

	<!-- ============== 3. SIMULATEUR ============== -->
	<section id="simulator" class="lg-section">
		<h2 class="lg-h2">3️⃣ Simulateur interactif — le pattern ReAct ⭐</h2>
		<p class="lg-lead">
			Maintenant tu vas voir tout ça <strong>en mouvement</strong>. Choisis
			un scénario, clique « Suivant » pour avancer pas-à-pas, ou « Auto »
			pour laisser tourner. Observe le graphe, l'arête active, et l'état
			qui se construit en parallèle.
		</p>

		<div class="lg-sim-wrapper not-prose">
			<LangGraphSimulator />
		</div>

		<Callout variant="insight" title="🎯 Ce qu'il faut observer">
			<ul>
				<li><strong>L'état grossit à chaque étape</strong> — chaque nœud ajoute des messages, jamais ne les remplace.</li>
				<li><strong>Le graphe est cyclique</strong> — la flèche bleue retourne d'action vers agent. C'est la boucle qui définit un agent.</li>
				<li><strong>Les arêtes conditionnelles décident dynamiquement</strong> — agent → action OU agent → end selon ce que renvoie le LLM.</li>
				<li><strong>Le scénario défense montre le vrai usage métier</strong> — le LLM appelle un outil de classification AVANT de répondre, pour respecter l'habilitation.</li>
			</ul>
		</Callout>
	</section>

	<!-- ============== 4. CODE COMPLET ============== -->
	<section id="code" class="lg-section">
		<h2 class="lg-h2">4️⃣ Le code, ligne par ligne</h2>
		<p class="lg-lead">
			Voici l'agent ReAct minimal complet. Chaque section est commentée.
			Si tu comprends ce code, tu sais déjà 80 % de LangGraph.
		</p>

		<div class="lg-code-block">
			<div class="lg-code-head">📄 react_agent.py — agent ReAct minimal</div>
			<pre class="lg-code"><code>{`# 1. IMPORTS
from typing import TypedDict, Annotated, Sequence
import operator
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI  # ou ChatOllama, ChatAnthropic, etc.
from langgraph.graph import StateGraph, END

# 2. DÉFINIR L'ÉTAT
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]

# 3. DÉFINIR LES OUTILS (le LLM les verra)
@tool
def search_pubchem(query: str) -> str:
    """Cherche un composé chimique sur PubChem et renvoie sa formule."""
    # En vrai : appel API PubChem. Ici simulation.
    db = {"caffeine": "C8H10N4O2 (194.19 g/mol)"}
    return db.get(query.lower(), f"Aucun résultat pour {query}.")

tools = [search_pubchem]

# 4. INSTANCIER LE LLM AVEC LES OUTILS
llm = ChatOpenAI(model="gpt-4o-mini")
llm_with_tools = llm.bind_tools(tools)

# 5. LE NŒUD AGENT — appelle le LLM
def agent_node(state: AgentState):
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

# 6. LE NŒUD ACTION — exécute les outils demandés
def action_node(state: AgentState):
    last = state["messages"][-1]
    tools_by_name = {t.name: t for t in tools}
    results = []
    for call in last.tool_calls:
        result = tools_by_name[call["name"]].invoke(call["args"])
        results.append({"role": "tool", "content": result, "tool_call_id": call["id"]})
    return {"messages": results}

# 7. LE ROUTER — décide où aller après agent
def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if last.tool_calls:
        return "continue"   # vers le nœud action
    return "end"            # vers __end__

# 8. CONSTRUIRE LE GRAPHE
graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.add_node("action", action_node)

graph.set_entry_point("agent")

graph.add_conditional_edges(
    "agent",
    should_continue,
    {"continue": "action", "end": END},
)
graph.add_edge("action", "agent")

# 9. COMPILER
app = graph.compile()

# 10. UTILISER
if __name__ == "__main__":
    result = app.invoke({
        "messages": [HumanMessage(content="Formule moléculaire de la caféine ?")]
    })
    print(result["messages"][-1].content)`}</code></pre>
		</div>

		<Callout variant="info" title="🔑 Les 5 endroits où tu vas adapter pour TON cas">
			<ol>
				<li><strong>Section 3</strong> — tes outils (recherche dans ta DB, calculs métier, appel à un microservice…).</li>
				<li><strong>Section 4</strong> — ton LLM. <code>ChatOllama(model="mistral-pedago")</code> pour ton modèle fine-tuné local.</li>
				<li><strong>Section 5</strong> — le system prompt injecté avant chaque appel (format, persona, règles métier).</li>
				<li><strong>Section 7</strong> — la logique de routage (peut être plus complexe : 3 destinations, plus de conditions…).</li>
				<li><strong>Section 10</strong> — comment tu sers cet agent (CLI, API REST, intégration UI…).</li>
			</ol>
		</Callout>
	</section>

	<!-- ============== 5. PATTERNS ============== -->
	<section id="patterns" class="lg-section">
		<h2 class="lg-h2">5️⃣ Patterns courants</h2>
		<p class="lg-lead">Au-delà du ReAct minimal, voici les architectures les plus utiles.</p>

		<div class="lg-patterns">
			<article class="lg-pattern">
				<h3>🔗 Chain — pipeline simple</h3>
				<p>
					A → B → C → end. Pas de boucle, pas de condition. Utile pour
					des pipelines déterministes (résumé → traduction → reformatage).
				</p>
				<pre class="lg-code"><code>{`graph.add_edge(START, "summarize")
graph.add_edge("summarize", "translate")
graph.add_edge("translate", "format")
graph.add_edge("format", END)`}</code></pre>
			</article>

			<article class="lg-pattern">
				<h3>🌿 Branching — routing par cas</h3>
				<p>
					Selon le type de question, on dirige vers un nœud spécialisé.
					Exemple : agent qui détecte si la requête est juridique,
					technique ou commerciale, puis route vers l'expert approprié.
				</p>
				<pre class="lg-code"><code>{`def classify(state):
    intent = llm.invoke(["Classify:", state["query"]]).content
    return intent  # "legal" | "tech" | "sales"

graph.add_conditional_edges("classifier", classify, {
    "legal":  "legal_expert",
    "tech":   "tech_expert",
    "sales":  "sales_expert",
})`}</code></pre>
			</article>

			<article class="lg-pattern">
				<h3>🔁 Cycle — la boucle agentique</h3>
				<p>
					Le ReAct standard. Agent ↔ Action jusqu'à pouvoir répondre.
					Limite le nombre d'itérations pour éviter les boucles
					infinies via un compteur dans le state.
				</p>
				<pre class="lg-code"><code>{`class AgentState(TypedDict):
    messages: Annotated[Sequence, operator.add]
    iterations: int

def should_continue(state):
    if state["iterations"] >= 10:
        return "end"  # garde-fou
    if state["messages"][-1].tool_calls:
        return "continue"
    return "end"`}</code></pre>
			</article>

			<article class="lg-pattern">
				<h3>👥 Supervisor — multi-agent</h3>
				<p>
					Un nœud « supervisor » LLM qui décide à chaque tour quel
					sous-agent invoquer. Chaque sous-agent est lui-même un mini-graphe.
					Pattern utile quand tu as plusieurs personas (chercheur,
					rédacteur, vérificateur).
				</p>
				<pre class="lg-code"><code>{`def supervisor(state):
    """Le LLM-superviseur choisit le prochain sous-agent."""
    decision = llm.invoke([
        "Choose next agent: researcher | writer | reviewer | END",
        state["messages"][-1],
    ]).content
    return decision

graph.add_conditional_edges("supervisor", supervisor, {
    "researcher": "researcher_agent",
    "writer":     "writer_agent",
    "reviewer":   "reviewer_agent",
    "END":        END,
})
graph.add_edge("researcher_agent", "supervisor")
graph.add_edge("writer_agent",     "supervisor")
graph.add_edge("reviewer_agent",   "supervisor")`}</code></pre>
			</article>
		</div>
	</section>

	<!-- ============== 6. CAS D'USAGE DÉFENSE ============== -->
	<section id="defense" class="lg-section">
		<h2 class="lg-h2">6️⃣ Cas d'usage approfondi — agent documentaire défense</h2>
		<p class="lg-lead">
			Construisons l'architecture LangGraph pour ton projet souverain :
			un agent qui répond à des questions sur des documents classifiés,
			en respectant strictement l'habilitation de l'utilisateur.
		</p>

		<p>
			Voici l'architecture <strong>interactive</strong> de l'agent défense.
			Choisis un scénario (question générale ou programme classifié), bascule
			entre la vue Messages et la vue Technique pour voir les requêtes HTTP,
			le code Python qui s'exécute, et l'audit trail.
		</p>

		<div class="lg-sim-wrapper not-prose">
			<DefenseAgentSimulator />
		</div>

		<div class="lg-defense-flow">
			<h4>📋 Le flux des 5 nœuds métier</h4>
			<ol>
				<li><strong>classifier</strong> — mini-LLM Mistral 7B fine-tuné qui catégorise en <code>rag_query</code> / <code>program_query</code> / <code>malicious</code>.</li>
				<li><strong>retrieve_rag</strong> — recherche vectorielle Qdrant avec filtre par habilitation. La sécurité par classification est appliquée <em>au niveau du store</em>, pas du LLM.</li>
				<li><strong>check_clearance</strong> — appel mTLS au microservice de classification interne pour récupérer le niveau d'un programme nommé.</li>
				<li><strong>refuse</strong> — produit un refus structuré et bienveillant. Tracé.</li>
				<li><strong>generate_answer</strong> — LLM principal qui formule la réponse à partir du contexte RAG, avec format imposé (tag classification, source citée).</li>
			</ol>
		</div>

		<Callout variant="warning" title="🔐 Le rôle critique du state pour l'audit">
			<p>
				Le <code>AgentState</code> de cet agent contient bien plus que les
				messages : <code>user_clearance</code>, <code>session_id</code>,
				<code>intent</code>, <code>last_classification</code>,
				<code>audit_trail</code> (liste des décisions). Toutes ces infos
				sont sérialisées et signées Ed25519 à la fin du graphe — c'est ce
				qui rend l'agent auditable ANSSI sur 5 ans.
			</p>
			<p>
				Bascule sur la vue <strong>🔧 Technique</strong> du simulateur
				pour voir le code exact qui produit l'audit log.
			</p>
		</Callout>
	</section>

	<!-- ============== 7. SEQUENTIAL TOOL CALLS ============== -->
	<section id="sequential-tools" class="lg-section">
		<h2 class="lg-h2">7️⃣ Appels de tools séquentiels — la cuisine interne d'un agent</h2>
		<p class="lg-lead">
			Le simulateur ReAct de la section 3 montre <em>une</em> boucle
			LLM → tool → LLM → END. C'est l'os. Mais 90 % des questions réelles
			demandent <strong>plusieurs tools enchaînés</strong>, où la sortie
			de l'un alimente l'argument du suivant. C'est ça, le cerveau
			opérationnel d'un agent en production.
		</p>

		<DifficultyTabs
			id="seq-concept"
			title="Tools séquentiels — pourquoi c'est le pattern dominant"
			tagline="Quand l'agent doit composer des informations issues de plusieurs sources"
		>
			{#snippet intuitive()}
				<p>
					Pose-toi cette question à un humain : <em>« Est-ce que le commandant
					Martin a accès au calendrier du programme Persée ? »</em>.
				</p>
				<p>
					Pour répondre, tu ne peux PAS appeler un seul service. Tu dois :
				</p>
				<ol>
					<li>Trouver Martin dans l'annuaire (qui est-il exactement ?)</li>
					<li>Aller chercher son habilitation (CD ? SD ?)</li>
					<li>Aller chercher la classification de Persée (SD ?)</li>
					<li>Vérifier qu'il a besoin d'en connaître (il est sur le projet ?)</li>
					<li>Et SEULEMENT SI tout est validé, fetch le calendrier</li>
				</ol>
				<p>
					Un agent fait pareil. Il appelle <strong>plusieurs outils dans
					un ordre logique</strong>, et chaque outil utilise les
					informations obtenues précédemment.
				</p>
			{/snippet}

			{#snippet friend()}
				<p>
					Concrètement, ce qui se passe à chaque tour de la boucle ReAct :
				</p>
				<ol>
					<li>
						Le LLM reçoit l'historique <code>messages</code> + un
						« scratchpad » (les tool_calls et tool_responses
						précédents).
					</li>
					<li>
						Il <strong>raisonne</strong> (« j'ai besoin de X, donc
						j'appelle le tool Y avec les paramètres Z »).
					</li>
					<li>
						Il émet un <code>tool_call</code> structuré (JSON :
						<code>{`{name, args}`}</code>).
					</li>
					<li>
						Le runtime exécute la fonction Python correspondante.
					</li>
					<li>
						La réponse JSON est ajoutée à l'historique comme un
						<code>ToolMessage</code>.
					</li>
					<li>
						<strong>Retour au LLM</strong>, qui voit maintenant
						l'historique enrichi et peut décider du prochain tool — en
						<strong>réutilisant les valeurs</strong> obtenues.
					</li>
				</ol>
				<p>
					Le mécanisme de <strong>data binding</strong> est implicite :
					le LLM voit le JSON de la réponse précédente et copie les
					champs pertinents dans les args du prochain tool_call. C'est lui
					qui fait le câblage. Tu ne l'écris pas — tu le décris dans le
					prompt et les descriptions de tools.
				</p>
				<h4>Pourquoi pas tout faire en parallèle ?</h4>
				<p>
					Certains tools <strong>peuvent</strong> être parallélisés
					(LangGraph supporte <code>parallel_tool_calls</code>). Mais
					quand <strong>l'argument du tool B dépend de la sortie du
					tool A</strong>, on ne peut PAS paralléliser : on est forcé
					au séquentiel. C'est le cas ici (employee_id vient de
					search_employee).
				</p>
			{/snippet}

			{#snippet practical()}
				<p>Le pattern type avec LangGraph + <code>bind_tools</code> :</p>
				<pre class="lg-code"><code>{`from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

# 1. On déclare les tools avec une signature TYPÉE et une docstring claire.
#    Le LLM lit les docstrings pour savoir QUAND appeler le tool.
@tool
def search_employee(last_name: str, rank: str, service: str) -> dict:
    """Recherche un employé dans l'annuaire interne par nom + grade + service.
    Retourne id, nom complet, service, branch."""
    return employee_db.search(last_name, rank, service)

@tool
def get_clearance_level(employee_id: str) -> dict:
    """Retourne le niveau d'habilitation d'un employé (NP/DR/CD/SD/TSD)
    et sa date de validité. Nécessite l'employee_id obtenu via search_employee."""
    return clearance_service.get(employee_id)

@tool
def get_program_classification(program_name: str) -> dict:
    """Retourne le niveau de classification d'un programme et son service propriétaire."""
    return program_db.get_classification(program_name)

@tool
def check_need_to_know(employee_id: str, program_name: str) -> dict:
    """Vérifie si l'employé a un besoin d'en connaître sur ce programme."""
    return access_control.check(employee_id, program_name)

@tool
def fetch_delivery_schedule(program_name: str) -> dict:
    """Récupère le calendrier de livraison (gates PDR/CDR/TRR/…). Sensible — n'appeler
    QUE si check_need_to_know retourne authorized=true."""
    return program_db.get_schedule(program_name)

# 2. On crée l'agent ReAct avec tous les tools.
#    LangGraph gère TOUTE la boucle pour nous : LLM → tool → LLM → tool → …
tools = [
    search_employee, get_clearance_level, get_program_classification,
    check_need_to_know, fetch_delivery_schedule,
]
agent = create_react_agent(llm, tools)

# 3. On invoque. L'agent va enchaîner les tools dans le bon ordre tout seul.
result = agent.invoke({
    "messages": [HumanMessage("Cdt Martin (DGA) a-t-il accès au calendrier de Persée ?")]
})
# → 5 tool_calls dans result['messages'], puis une réponse finale.`}</code></pre>
				<p>
					<strong>Point clé</strong> : tu ne précises JAMAIS « appelle
					d'abord search_employee, puis get_clearance ». L'agent
					déduit l'ordre depuis les docstrings et son raisonnement.
					C'est ça la différence avec un workflow câblé.
				</p>
			{/snippet}

			{#snippet deep()}
				<p>
					<strong>Détails d'implémentation critiques :</strong>
				</p>
				<ul>
					<li>
						<strong>Schéma JSON Schema pour les args</strong> — les tools
						sont sérialisés en JSON Schema pour le LLM
						(<code>response_format</code> côté OpenAI / <code>tools</code>
						côté Anthropic). Le typage Python (<code>: str</code>,
						<code>: dict</code>) devient les contraintes du schéma.
					</li>
					<li>
						<strong>Tool calling vs structured output</strong> — pour les
						modèles qui supportent les deux, préférer le tool calling
						pour les actions, et le structured output pour les
						classifications. Tool calling permet plusieurs appels en
						séquence ; structured output produit UNE valeur typée et
						termine.
					</li>
					<li>
						<strong>Parallélisation</strong> —
						<code>parallel_tool_calls=True</code> (OpenAI) permet au LLM
						d'émettre plusieurs tool_calls dans le même tour quand ils
						sont indépendants. Exemple : appeler simultanément
						<code>get_clearance_level(EMP-7821)</code> et
						<code>get_program_classification("Persée")</code> — aucun
						des deux ne dépend de l'autre. Gain : 1 tour LLM au lieu de
						2.
					</li>
					<li>
						<strong>Gestion d'erreur intermédiaire</strong> — si un
						tool retourne une erreur (HTTP 500, timeout), elle est
						injectée comme <code>ToolMessage</code> avec un flag
						d'erreur. Le LLM peut alors retry, contourner, ou
						abandonner. À garder en tête : un agent doit aussi savoir
						<strong>quand renoncer</strong>.
					</li>
					<li>
						<strong>Boucle infinie</strong> — limiter
						<code>recursion_limit</code> (défaut 25 dans LangGraph)
						pour éviter qu'un LLM mal calibré ne boucle. Au-delà, le
						graphe lève <code>GraphRecursionError</code>.
					</li>
					<li>
						<strong>Observabilité</strong> — chaque tool_call et
						chaque tool_response devrait être tracé (Langfuse,
						LangSmith, OpenTelemetry). Sur 50 tours en prod, c'est ta
						SEULE chance de comprendre pourquoi l'agent a divergé.
					</li>
					<li>
						<strong>Sécurité défense</strong> — interdire à l'agent
						d'appeler certains tools s'il n'a pas validé l'accès.
						Concrètement : dans <code>fetch_delivery_schedule</code>,
						revérifier l'authorization en bypass-proof (le LLM peut
						mentir, pas le code).
					</li>
				</ul>
			{/snippet}
		</DifficultyTabs>

		<!-- Simulateur séquentiel -->
		<h3 class="lg-h3-section" style="margin-top:1rem">🎮 Simulateur — 5 tools enchaînés, data binding visible</h3>
		<p>
			Choisis un scénario, clique <strong>▶ Auto</strong> et regarde la
			pipeline s'allumer tool par tool. À chaque <code>tool_call</code>,
			repère les <strong>arguments encadrés en orange</strong> — ce sont les
			valeurs <em>bindées</em> à la ledger (la mémoire d'état de l'agent).
			Bascule entre les deux scénarios pour voir un <strong>court-circuit
			au milieu de la chaîne</strong> quand l'habilitation est insuffisante.
		</p>

		<div class="lg-sim-wrapper not-prose">
			<SequentialToolsSimulator />
		</div>

		<Callout variant="insight" title="🎯 Ce que ce simulateur t'apprend">
			<ul>
				<li><strong>Data binding implicite</strong> — l'output d'un tool devient l'input du suivant (employee_id, par exemple). Le LLM fait ce câblage tout seul à partir des descriptions.</li>
				<li><strong>Ledger / scratchpad</strong> — c'est la « mémoire à court terme » de l'agent pendant la résolution d'UNE requête. En LangGraph c'est l'état (<code>messages</code> + champs custom).</li>
				<li><strong>Court-circuit intelligent</strong> — un bon agent sait qu'inutile d'aller chercher la donnée sensible si l'autorisation a échoué en amont. Économie + sûreté.</li>
				<li><strong>Ordre dynamique</strong> — pas câblé en dur. Si demain tu ajoutes un tool <code>check_export_control</code>, le LLM apprend où l'insérer juste depuis sa docstring.</li>
			</ul>
		</Callout>

		<Callout variant="warning" title="🛡️ Anti-pattern à éviter — confier le contrôle d'accès au LLM seul">
			<p>
				En défense, ne JAMAIS confier la décision finale d'autorisation au
				LLM uniquement. Pattern correct :
			</p>
			<ol>
				<li>L'agent orchestre les appels de contrôle (clearance, classification, need-to-know).</li>
				<li>Mais le <strong>tool sensible</strong> (<code>fetch_delivery_schedule</code>) doit RE-VÉRIFIER l'autorisation côté microservice avec le contexte appelant signé (mTLS + JWT).</li>
				<li>Le LLM ne fait que la coordination. Le service applique la règle.</li>
			</ol>
			<p>
				Sinon, un prompt malicieux peut « convaincre » le LLM de sauter une
				étape. Le LLM est dans le périmètre de menace.
			</p>
		</Callout>

		<h3 class="lg-h3-section" style="margin-top:1.25rem">⚡ Variante — tools en parallèle quand c'est possible</h3>
		<p>
			Dans le scénario A, les tools #2 (<code>get_clearance_level</code>) et
			#3 (<code>get_program_classification</code>) sont
			<strong>indépendants</strong> — aucun n'a besoin de la sortie de
			l'autre. Un agent malin les paralléliserait :
		</p>
		<pre class="lg-code"><code>{`# Tour 1 : LLM émet 1 seul tool_call
search_employee(last_name="Martin", rank="Cdt", service="DGA")
# → EMP-7821

# Tour 2 : LLM émet 2 tool_calls en MÊME temps
[
  get_clearance_level(employee_id="EMP-7821"),     # indép.
  get_program_classification(program_name="Persée"),# indép.
]
# → SD, SD  (les 2 appels exécutés en parallèle côté runtime)

# Tour 3 : LLM émet 1 tool_call (besoin des 2 précédents)
check_need_to_know(employee_id="EMP-7821", program_name="Persée")
# → authorized=true

# Tour 4 : 1 tool_call final
fetch_delivery_schedule(program_name="Persée")
# → {phases: [...]}

# Tour 5 : réponse finale`}</code></pre>
		<p>
			On passe de 5 tours à 4 tours, soit ~20 % de latence en moins. Sur
			des agents qui font 10-20 appels par requête, c'est massif.
			Activé par <code>parallel_tool_calls=True</code> (OpenAI/Anthropic
			récents).
		</p>
	</section>

	<!-- ============== 8. MULTI-AGENT SUPERVISOR ============== -->
	<section id="supervisor" class="lg-section">
		<h2 class="lg-h2">8️⃣ Pattern avancé — Multi-Agent Supervisor</h2>
		<p class="lg-lead">
			Quand un seul agent ne suffit plus — quand tu as plusieurs métiers,
			plusieurs spécialités, plusieurs étapes de qualité — tu passes au
			pattern <strong>multi-agent supervisor</strong>. Un LLM-orchestrateur
			coordonne plusieurs sous-agents experts. C'est le pattern dominant en
			production sur les workflows complexes.
		</p>

		<DifficultyTabs
			id="sup-concept"
			title="Le concept"
			tagline="Un chef d'orchestre LLM qui choisit son musicien à chaque tour"
		>
			{#snippet intuitive()}
				<p>
					Imagine une équipe : un <strong>chef de projet</strong>, un
					<strong>chercheur</strong>, un <strong>rédacteur</strong>, un
					<strong>relecteur</strong>. À chaque étape d'une tâche, le chef
					regarde où on en est et dit « OK, maintenant le chercheur prend
					le relais. Quand il a fini, ce sera au rédacteur. Puis au
					relecteur. Et si tout est bon, on livre. »
				</p>
				<p>
					Le <strong>supervisor</strong>, c'est ce chef de projet : un LLM
					qui ne fait pas le boulot final, mais qui <strong>route</strong>
					vers le bon spécialiste à chaque étape.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Décortiquons le pattern. Tu as un graphe LangGraph qui ressemble
					à ça :
				</p>
				<pre class="lg-code"><code>{`              ┌──────────────┐
              │  supervisor  │ ← LLM orchestrateur
              └──────┬───────┘
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
  ┌──────────┐  ┌─────────┐  ┌──────────┐
  │researcher│  │ writer  │  │ reviewer │
  └────┬─────┘  └────┬────┘  └────┬─────┘
       └────────────┴────────────┘
                    ↑
            (retour vers supervisor
             à chaque sortie)`}</code></pre>
				<h4>La mécanique en détail</h4>
				<ol>
					<li>
						<strong>L'utilisateur pose sa question</strong>. Elle entre dans
						le graphe et arrive au nœud <code>supervisor</code>.
					</li>
					<li>
						<strong>Le supervisor LLM</strong> regarde l'historique des
						messages et décide : « Quel agent doit prendre le relais
						maintenant ? ». Il renvoie un nom (ex. <code>"researcher"</code>)
						via <strong>structured output</strong> ou <strong>tool
							calling</strong>.
					</li>
					<li>
						<strong>L'arête conditionnelle</strong> route vers ce sous-agent.
					</li>
					<li>
						<strong>Le sous-agent</strong> fait son boulot (peut lui-même
						appeler des outils, faire un mini-ReAct interne) et ajoute
						son résultat aux messages.
					</li>
					<li>
						<strong>Une arête simple ramène vers le supervisor</strong>. Il
						refait le même choix avec le contexte enrichi.
					</li>
					<li>
						<strong>À un moment, le supervisor décide de finir</strong> :
						il renvoie <code>"END"</code>. Le graphe sort.
					</li>
				</ol>
				<p>
					<strong>L'élégance</strong> : c'est le LLM qui décide
					dynamiquement de l'enchaînement. Pas une logique câblée. Si tu
					ajoutes un nouveau sous-agent, le supervisor l'apprend en lui
					ajoutant juste un nom dans la liste de choix possibles.
				</p>
				<h4>Exemple concret — équipe de rédaction</h4>
				<p>Question utilisateur : « Écris-moi un article sur les LLM ».</p>
				<ol>
					<li>supervisor → <strong>researcher</strong> (« va chercher des sources fiables »)</li>
					<li>researcher fait 3 appels à un moteur de recherche, résume → ajoute aux messages</li>
					<li>supervisor → <strong>writer</strong> (« écris l'article à partir des sources »)</li>
					<li>writer rédige un draft → ajoute aux messages</li>
					<li>supervisor → <strong>reviewer</strong> (« vérifie qualité et factualité »)</li>
					<li>reviewer trouve 2 erreurs → ajoute des commentaires</li>
					<li>supervisor → <strong>writer</strong> (« corrige les erreurs »)</li>
					<li>writer corrige → ajoute aux messages</li>
					<li>supervisor → <strong>reviewer</strong> (« re-vérifie »)</li>
					<li>reviewer valide → ajoute « OK »</li>
					<li>supervisor → <strong>END</strong></li>
				</ol>
				<p>
					Le supervisor a fait 5 décisions de routage, sans qu'on lui
					écrive UNE règle métier en dur. C'est lui qui déduit qu'après
					reviewer-trouvant-des-erreurs, il faut renvoyer chez writer.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>Implémentation type :</p>
				<pre class="lg-code"><code>{`from typing import TypedDict, Annotated, Sequence, Literal
import operator
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, END

class TeamState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    next: str  # le sous-agent à appeler ensuite, défini par le supervisor

# === Sous-agents (chacun est un nœud) ===
def researcher(state):
    # Mini-ReAct interne avec outils de search
    response = research_agent.invoke(state)
    return {"messages": [HumanMessage(content=response, name="researcher")]}

def writer(state):
    response = writer_llm.invoke([
        SystemMessage("Tu rédiges un article clair et structuré."),
        *state["messages"]
    ])
    return {"messages": [HumanMessage(content=response.content, name="writer")]}

def reviewer(state):
    response = reviewer_llm.invoke([
        SystemMessage("Tu vérifies factualité et qualité."),
        *state["messages"]
    ])
    return {"messages": [HumanMessage(content=response.content, name="reviewer")]}

# === Supervisor : LLM avec structured output ===
class Route(TypedDict):
    next: Literal["researcher", "writer", "reviewer", "END"]

supervisor_prompt = """Tu coordonnes une équipe : researcher, writer, reviewer.
À chaque tour, regarde où on en est et choisis le prochain agent.
Renvoie END quand l'article est validé."""

def supervisor(state):
    response = supervisor_llm.with_structured_output(Route).invoke([
        SystemMessage(supervisor_prompt),
        *state["messages"]
    ])
    return {"next": response["next"]}

# === Construction du graphe ===
graph = StateGraph(TeamState)
graph.add_node("supervisor", supervisor)
graph.add_node("researcher", researcher)
graph.add_node("writer", writer)
graph.add_node("reviewer", reviewer)

graph.set_entry_point("supervisor")

graph.add_conditional_edges(
    "supervisor",
    lambda state: state["next"],
    {
        "researcher": "researcher",
        "writer": "writer",
        "reviewer": "reviewer",
        "END": END,
    },
)
# Tous les sous-agents retournent au supervisor
graph.add_edge("researcher", "supervisor")
graph.add_edge("writer", "supervisor")
graph.add_edge("reviewer", "supervisor")

app = graph.compile()`}</code></pre>
			{/snippet}
			{#snippet deep()}
				<p>
					<strong>Décisions techniques importantes :</strong>
				</p>
				<ul>
					<li>
						<strong>Structured output vs tool calling</strong> pour le
						supervisor. Préférer <code>with_structured_output</code> avec un
						<code>Literal</code> typé — ça force le LLM à répondre par un des
						noms valides, plus robuste qu'un free-text à parser.
					</li>
					<li>
						<strong>Limiter les itérations</strong>. Sans garde-fou, le
						supervisor peut boucler (researcher → writer → researcher → …).
						Ajoute un compteur dans le state ; au-delà de N, force END.
					</li>
					<li>
						<strong>Visibilité des messages entre agents</strong>. Par
						défaut, chaque sous-agent voit TOUS les messages précédents.
						Pour gros workflows, tu peux <strong>filtrer le contexte</strong>
						(ne montrer au reviewer que la question + le draft, pas
						l'historique de recherche).
					</li>
					<li>
						<strong>Memory / persistence</strong>. Avec un
						<code>checkpointer</code>, tu peux pauser le graphe au milieu
						(human-in-the-loop : le reviewer humain valide avant que le writer
						corrige).
					</li>
					<li>
						<strong>Variantes hiérarchiques</strong>. Un supervisor peut être
						lui-même un sous-agent d'un super-supervisor. Patterns
						multi-niveaux pour très grosses équipes.
					</li>
				</ul>
				<p>
					<strong>Pour aller plus loin</strong> : LangGraph fournit
					<code>create_supervisor()</code> dans
					<code>langgraph_supervisor</code> qui génère le boilerplate
					automatiquement. Utile pour démarrer.
				</p>
			{/snippet}
		</DifficultyTabs>

		<!-- Simulateur interactif (remplace le diagramme statique) -->
		<h3 class="lg-h3-section" style="margin-top:1rem">🎮 Simulateur — équipe rédactionnelle en action</h3>
		<p>
			Voici le scénario complet en simulation pas-à-pas. Tu vois le supervisor
			décider à chaque tour quel agent appeler, l'agent travailler, retourner
			au supervisor, et ainsi de suite jusqu'à <code>END</code>. Bascule sur
			la vue <strong>🔧 Technique</strong> pour voir la requête HTTP avec
			structured output qui force le LLM à choisir parmi les 4 valeurs
			valides.
		</p>

		<div class="lg-sim-wrapper not-prose">
			<SupervisorSimulator />
		</div>

		<!-- Diagramme statique conservé pour référence -->
		<details class="lg-sup-static-toggle">
			<summary>📐 Voir aussi le diagramme statique de l'architecture</summary>
			<div class="lg-sup-demo">
			<h3 class="lg-sup-title">🧭 Architecture statique — survole pour les détails</h3>
			<p>Survole un nœud pour voir son rôle, ses outils, et le system prompt utilisé.</p>
			<svg viewBox="0 0 600 380" class="lg-sup-svg">
				<defs>
					<marker id="sup-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
				</defs>

				<!-- Supervisor au centre haut -->
				<g class="lg-sup-node lg-sup-node-supervisor">
					<rect x="240" y="40" width="140" height="50" rx="10" fill="#a855f7" stroke="#a855f7" stroke-width="2" />
					<text x="310" y="65" text-anchor="middle" font-family="monospace" font-size="14" fill="#fff" font-weight="700">supervisor</text>
					<text x="310" y="82" text-anchor="middle" font-family="monospace" font-size="9" fill="#fef3c7">LLM orchestrateur</text>
					<title>SUPERVISOR
LLM qui choisit le prochain agent à chaque tour.
System prompt : "Tu coordonnes une équipe : researcher, writer, reviewer. Choisis le prochain. END quand l'article est validé."
Output structuré : Literal["researcher", "writer", "reviewer", "END"]</title>
				</g>

				<!-- Researcher gauche -->
				<g class="lg-sup-node">
					<rect x="50" y="200" width="130" height="60" rx="10" fill="#1e293b" stroke="#06b6d4" stroke-width="2" />
					<text x="115" y="222" text-anchor="middle" font-family="monospace" font-size="13" fill="#06b6d4" font-weight="600">researcher</text>
					<text x="115" y="240" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">+ search tools</text>
					<text x="115" y="252" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">mini-ReAct interne</text>
					<title>RESEARCHER
Mini-agent ReAct qui cherche des sources fiables.
Outils : web_search, scholar_search, summarize_doc.
Sortie : un résumé sourcé qui sera ajouté aux messages.</title>
				</g>

				<!-- Writer centre -->
				<g class="lg-sup-node">
					<rect x="245" y="200" width="130" height="60" rx="10" fill="#1e293b" stroke="#fb923c" stroke-width="2" />
					<text x="310" y="222" text-anchor="middle" font-family="monospace" font-size="13" fill="#fb923c" font-weight="600">writer</text>
					<text x="310" y="240" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">LLM rédaction</text>
					<text x="310" y="252" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">format imposé</text>
					<title>WRITER
LLM spécialisé rédaction.
System prompt : "Tu rédiges des articles structurés et clairs."
Pas d'outils — juste du texte.
Lit les messages, écrit le draft.</title>
				</g>

				<!-- Reviewer droite -->
				<g class="lg-sup-node">
					<rect x="440" y="200" width="130" height="60" rx="10" fill="#1e293b" stroke="#22c55e" stroke-width="2" />
					<text x="505" y="222" text-anchor="middle" font-family="monospace" font-size="13" fill="#22c55e" font-weight="600">reviewer</text>
					<text x="505" y="240" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">LLM critique</text>
					<text x="505" y="252" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b8">+ fact_check tool</text>
					<title>REVIEWER
LLM critique avec accès à un outil de fact-check.
System prompt : "Tu vérifies factualité, structure, ton. Liste les corrections à faire."
Si tout est OK, dit "validated". Sinon, écrit la liste de corrections — qui forcera writer à reprendre.</title>
				</g>

				<!-- END -->
				<g class="lg-sup-node">
					<rect x="270" y="320" width="80" height="36" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="2" />
					<text x="310" y="343" text-anchor="middle" font-family="monospace" font-size="13" fill="#f59e0b" font-weight="600">__end__</text>
					<title>END
Sortie du graphe. Le résultat est l'article validé, dans le dernier message du writer.</title>
				</g>

				<!-- Edges supervisor → 3 agents -->
				<path d="M 270 95 Q 180 150 130 200" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#sup-arrow)" />
				<line x1="310" y1="95" x2="310" y2="200" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#sup-arrow)" />
				<path d="M 350 95 Q 440 150 490 200" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#sup-arrow)" />
				<text x="190" y="155" font-family="monospace" font-size="10" fill="#94a3b8" font-style="italic">researcher</text>
				<text x="320" y="150" font-family="monospace" font-size="10" fill="#94a3b8" font-style="italic">writer</text>
				<text x="430" y="155" font-family="monospace" font-size="10" fill="#94a3b8" font-style="italic">reviewer</text>

				<!-- Edge supervisor → END -->
				<path d="M 310 95 Q 220 200 270 330" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#sup-arrow)" opacity="0.7" />
				<text x="225" y="280" font-family="monospace" font-size="10" fill="#f59e0b" font-style="italic">END</text>

				<!-- Retours vers supervisor -->
				<path d="M 115 200 Q 115 130 240 70" fill="none" stroke="#06b6d4" stroke-width="1.5" marker-end="url(#sup-arrow)" />
				<line x1="310" y1="200" x2="310" y2="93" stroke="#fb923c" stroke-width="1.5" marker-end="url(#sup-arrow)" opacity="0.5" />
				<path d="M 505 200 Q 505 130 380 70" fill="none" stroke="#22c55e" stroke-width="1.5" marker-end="url(#sup-arrow)" />
			</svg>
			<p class="lg-sup-tip">
				💡 <strong>Astuce</strong> : survole un nœud (sur desktop) pour voir
				son system prompt et ses outils. Les flèches en pointillés sont des
				décisions du supervisor (arêtes conditionnelles). Les flèches
				pleines sont les retours obligatoires vers le supervisor.
			</p>
			</div>
		</details>

		<Callout variant="insight" title="🎯 Quand utiliser ce pattern ?">
			<ul>
				<li>Tu as plusieurs <strong>spécialités</strong> distinctes (recherche, rédaction, vérification, traduction…).</li>
				<li>Le <strong>nombre d'étapes</strong> n'est pas fixe — ça dépend de la complexité de la requête.</li>
				<li>Tu veux qu'un LLM <strong>arbitre dynamiquement</strong> au lieu d'écrire des règles métier en dur.</li>
				<li>Tu as besoin d'<strong>itérer</strong> (writer → reviewer → writer → reviewer…).</li>
			</ul>
			<p>
				⚠️ <strong>Quand NE PAS l'utiliser</strong> : si le pipeline est
				déterministe et toujours dans le même ordre, un simple chain (A → B →
				C) suffit. Le supervisor coûte un appel LLM supplémentaire à chaque
				tour — significatif si tu fais 10 tours.
			</p>
		</Callout>
	</section>

	<!-- ============== 7. POUR ALLER PLUS LOIN ============== -->
	<section id="further" class="lg-section">
		<h2 class="lg-h2">9️⃣ Pour aller plus loin</h2>
		<div class="lg-further-grid">
			<div class="lg-further-card">
				<div class="lg-further-emoji">💾</div>
				<h3>Checkpointing & persistence</h3>
				<p>
					Sauvegarder l'état à chaque step (Postgres, SQLite, Redis…). Permet
					de reprendre une conversation, débugger une session, faire de la
					human-in-the-loop.
				</p>
			</div>
			<div class="lg-further-card">
				<div class="lg-further-emoji">⏸️</div>
				<h3>Human-in-the-loop</h3>
				<p>
					Pause le graphe sur des nœuds critiques (validation humaine avant
					exécution d'une action sensible). Critique pour défense.
				</p>
			</div>
			<div class="lg-further-card">
				<div class="lg-further-emoji">🌊</div>
				<h3>Streaming</h3>
				<p>
					Streamer les tokens du LLM en direct via <code>app.astream_events</code>.
					UX bien meilleure pour les agents qui prennent du temps.
				</p>
			</div>
			<div class="lg-further-card">
				<div class="lg-further-emoji">🛠️</div>
				<h3>LangGraph Studio</h3>
				<p>
					L'app desktop de LangChain pour visualiser et débugger les graphes
					en direct (la capture d'écran qui a inspiré le simulateur ci-dessus).
				</p>
			</div>
			<div class="lg-further-card">
				<div class="lg-further-emoji">📊</div>
				<h3>LangSmith</h3>
				<p>
					Traçage et observabilité de tes graphes en production. Critique
					pour debugger les comportements imprévus.
				</p>
			</div>
			<div class="lg-further-card">
				<div class="lg-further-emoji">🔌</div>
				<h3>Tool calling avancé</h3>
				<p>
					Outils async, outils avec validation Pydantic, fallback sur erreur,
					retry avec backoff. Tout est documenté côté LangChain.
				</p>
			</div>
		</div>
	</section>

	<!-- ============== 8. GLOSSAIRE ============== -->
	<section id="glossaire" class="lg-section">
		<h2 class="lg-h2">🔟 Glossaire</h2>
		<dl class="lg-glossary">
			<div class="lg-gl-row"><dt>Agent</dt><dd>LLM dans une boucle, qui peut appeler des outils et raisonner en plusieurs étapes avant de répondre.</dd></div>
			<div class="lg-gl-row"><dt>Checkpointer</dt><dd>Composant qui sauvegarde l'état du graphe à chaque step (mémoire persistante).</dd></div>
			<div class="lg-gl-row"><dt>Cycle</dt><dd>Boucle dans le graphe (agent ↔ action). Permet de raisonner en plusieurs tours.</dd></div>
			<div class="lg-gl-row"><dt>Edge / Arête</dt><dd>Transition entre deux nœuds. Simple ou conditionnelle.</dd></div>
			<div class="lg-gl-row"><dt>END</dt><dd>Nœud spécial qui marque la fin du graphe. Constante exportée par <code>langgraph.graph</code>.</dd></div>
			<div class="lg-gl-row"><dt>Human-in-the-loop</dt><dd>Pattern où le graphe se met en pause pour attendre une validation/correction humaine.</dd></div>
			<div class="lg-gl-row"><dt>LangChain</dt><dd>Framework parent. Fournit les abstractions LLM, tools, retrievers utilisées par LangGraph.</dd></div>
			<div class="lg-gl-row"><dt>LangSmith</dt><dd>Plateforme d'observabilité de LangChain. Trace toutes les exécutions, indispensable en prod.</dd></div>
			<div class="lg-gl-row"><dt>Node / Nœud</dt><dd>Une fonction qui prend l'état et renvoie des updates.</dd></div>
			<div class="lg-gl-row"><dt>Pregel</dt><dd>Algo de calcul sur graphes (Google) qui inspire le moteur d'exécution LangGraph.</dd></div>
			<div class="lg-gl-row"><dt>Reducer</dt><dd>Fonction de fusion appliquée à un champ d'état quand un nœud renvoie une update (typiquement <code>operator.add</code> pour les listes).</dd></div>
			<div class="lg-gl-row"><dt>Router</dt><dd>Fonction utilisée par une arête conditionnelle pour décider du prochain nœud.</dd></div>
			<div class="lg-gl-row"><dt>StateGraph</dt><dd>La classe principale. Conteneur du graphe qu'on construit puis qu'on compile.</dd></div>
			<div class="lg-gl-row"><dt>START</dt><dd>Nœud spécial d'entrée. Équivalent à <code>set_entry_point</code>.</dd></div>
			<div class="lg-gl-row"><dt>Streaming</dt><dd>Mode d'exécution qui yield les updates au fur et à mesure (avec <code>app.stream</code>).</dd></div>
			<div class="lg-gl-row"><dt>Supervisor</dt><dd>Pattern multi-agent où un LLM-orchestrateur choisit le prochain sous-agent à invoquer.</dd></div>
			<div class="lg-gl-row"><dt>Tool / Outil</dt><dd>Fonction Python que le LLM peut demander d'exécuter via un tool_call dans sa sortie.</dd></div>
			<div class="lg-gl-row"><dt>Tool call</dt><dd>Demande structurée du LLM pour invoquer un outil (nom + arguments).</dd></div>
			<div class="lg-gl-row"><dt>TypedDict</dt><dd>Type Python pour décrire la structure d'un dict avec champs typés. Base du <code>AgentState</code>.</dd></div>
		</dl>
	</section>
</article>

<style>
	.lg {
		max-width: 1240px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	/* Les sections de prose pure restent à largeur lecture confortable */
	.lg-section :global(p),
	.lg-section :global(.lg-lead) {
		max-width: 880px;
	}
	/* Mais les simulateurs/diagrammes utilisent toute la largeur */
	.lg-sim-wrapper {
		max-width: none;
	}

	.lg-hero {
		text-align: center;
		padding: 2rem 1.5rem;
		background: linear-gradient(135deg, #faf5ff 0%, #fff 100%);
		border-radius: 1.5rem;
		border: 1px solid #d8b4fe;
	}
	.lg-hero-emoji {
		font-size: 4rem;
		display: block;
	}
	.lg-h1 {
		font-family: var(--font-display);
		font-size: 2.25rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0.5rem 0 0;
	}
	.lg-hero-lead {
		font-size: 1rem;
		color: var(--color-ink-700);
		max-width: 620px;
		margin: 0.85rem auto 1.5rem;
		line-height: 1.6;
	}
	.lg-hero-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.lg-cta {
		padding: 0.7rem 1.5rem;
		border-radius: 999px;
		text-decoration: none;
		font-weight: 500;
		transition: all 0.15s;
	}
	.lg-cta-primary {
		background: #a855f7;
		color: white;
	}
	.lg-cta-primary:hover {
		background: #9333ea;
	}
	.lg-cta-secondary {
		background: #fff;
		color: var(--color-ink-900);
		border: 2px solid #a855f7;
	}
	.lg-cta-secondary:hover {
		background: #faf5ff;
	}

	.lg-toc {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.25rem 1.5rem;
	}
	.lg-toc-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-ink-500);
		margin: 0 0 0.5rem;
	}
	.lg-toc-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.4rem 1rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.lg-toc-list a {
		color: var(--color-ink-700);
		text-decoration: none;
		font-size: 0.9rem;
	}
	.lg-toc-list a:hover {
		color: #a855f7;
	}

	.lg-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		scroll-margin-top: 80px;
	}
	.lg-h2 {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.lg-lead {
		font-size: 1rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		margin: 0;
	}

	/* ===== Prereq grid ===== */
	.lg-prereq-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.6rem;
	}
	.lg-prereq {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		overflow: hidden;
	}
	.lg-prereq summary {
		cursor: pointer;
		padding: 0.85rem 1rem;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--color-ink-900);
		list-style: none;
	}
	.lg-prereq summary::-webkit-details-marker {
		display: none;
	}
	.lg-prereq summary::after {
		content: '▶';
		float: right;
		color: var(--color-ink-500);
		font-size: 0.7rem;
		transition: transform 0.15s;
	}
	.lg-prereq[open] summary::after {
		transform: rotate(90deg);
	}
	.lg-prereq[open] summary {
		border-bottom: 1px solid #e2e8f0;
		background: #fffdf5;
	}
	.lg-prereq-body {
		padding: 0.85rem 1rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
	}
	.lg-prereq-body p {
		margin: 0 0 0.5rem;
	}
	.lg-prereq-body p:last-child {
		margin-bottom: 0;
	}
	.lg-prereq-body ul {
		margin: 0.4rem 0;
		padding-left: 1.25rem;
	}

	/* ===== Why grid ===== */
	.lg-why-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.6rem;
	}
	.lg-why-card {
		padding: 1rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
	}
	.lg-why-emoji {
		font-size: 1.75rem;
	}
	.lg-why-card strong {
		display: block;
		margin: 0.25rem 0;
		font-family: var(--font-display);
		font-size: 1rem;
		color: var(--color-ink-900);
	}
	.lg-why-card p {
		font-size: 0.85rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0;
	}

	/* ===== Code blocks ===== */
	.lg-code {
		background: #1a1a1a;
		color: #e2e8f0;
		padding: 0.85rem 1rem;
		border-radius: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		line-height: 1.6;
		overflow-x: auto;
		margin: 0.5rem 0;
	}
	.lg-code-block {
		background: #1a1a1a;
		border-radius: 0.75rem;
		overflow: hidden;
	}
	.lg-code-head {
		padding: 0.55rem 0.9rem;
		background: #2a2a2a;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: #cbd5e1;
		border-bottom: 1px solid #404040;
	}
	.lg-code-block .lg-code {
		margin: 0;
		border-radius: 0;
	}

	/* ===== Simulator wrapper ===== */
	.lg-sim-wrapper {
		margin: 1rem 0;
	}

	/* ===== Patterns ===== */
	.lg-patterns {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.lg-pattern {
		padding: 1rem 1.25rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
	}
	.lg-pattern h3 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0 0 0.4rem;
	}
	.lg-pattern p {
		font-size: 0.92rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		margin: 0 0 0.5rem;
	}

	/* ===== Defense ===== */
	.lg-defense {
		padding: 1.5rem;
		background: linear-gradient(180deg, #eff6ff 0%, #fff 100%);
		border: 1px solid #1e40af;
		border-left: 6px solid #1e40af;
		border-radius: 1rem;
	}
	.lg-defense-title {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0 0 1rem;
	}
	.lg-defense-graph {
		background: #0f172a;
		border-radius: 0.75rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.lg-defense-graph svg {
		width: 100%;
		height: auto;
		max-height: 400px;
	}
	.lg-defense-flow {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
		padding: 1rem;
	}
	.lg-defense-flow h4 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.6rem;
		color: var(--color-ink-900);
	}
	.lg-defense-flow ol {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
	}
	.lg-defense-flow li {
		margin: 0.4rem 0;
	}

	/* ===== Further ===== */
	.lg-further-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.6rem;
	}
	.lg-further-card {
		padding: 1rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
	}
	.lg-further-emoji {
		font-size: 1.75rem;
	}
	.lg-further-card h3 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0.25rem 0 0.4rem;
	}
	.lg-further-card p {
		font-size: 0.85rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0;
	}

	/* ===== Glossary ===== */
	.lg-glossary {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
	}
	.lg-gl-row {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		padding: 0.65rem 1rem;
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: 1rem;
	}
	.lg-gl-row dt {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
		color: #a855f7;
	}
	.lg-gl-row dd {
		font-size: 0.88rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0;
	}
	.lg-gl-row dd code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}
	@media (max-width: 600px) {
		.lg-gl-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}

	/* ===== Supervisor diagram ===== */
	.lg-sup-demo {
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 1rem;
		padding: 1.25rem;
		margin: 1rem 0;
	}
	.lg-sup-title {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		color: #e2e8f0;
		margin: 0 0 0.4rem;
	}
	.lg-sup-demo p {
		color: #cbd5e1;
		font-size: 0.88rem;
		margin: 0 0 0.75rem;
	}
	.lg-sup-svg {
		width: 100%;
		height: auto;
		max-height: 400px;
		background: #1e293b;
		border-radius: 0.5rem;
		padding: 0.5rem;
	}
	.lg-sup-node {
		cursor: help;
		transition: transform 0.15s;
	}
	.lg-sup-node:hover {
		transform: translateY(-2px);
	}
	.lg-sup-node:hover rect {
		stroke-width: 3;
		filter: drop-shadow(0 0 8px currentColor);
	}
	.lg-sup-tip {
		font-size: 0.83rem !important;
		color: #94a3b8 !important;
		font-style: italic;
		margin-top: 0.6rem !important;
	}
	.lg-sup-tip strong {
		color: var(--color-hf-yellow);
	}

	.lg-h3-section {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 1rem 0 0.4rem;
	}
	.lg-sup-static-toggle {
		margin-top: 1rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
		padding: 0;
	}
	.lg-sup-static-toggle summary {
		cursor: pointer;
		padding: 0.6rem 1rem;
		font-size: 0.88rem;
		color: var(--color-ink-700);
	}
	.lg-sup-static-toggle[open] summary {
		border-bottom: 1px solid #e2e8f0;
	}
	.lg-sup-static-toggle .lg-sup-demo {
		margin: 1rem;
	}

	/* Defense flow box (updated styling) */
	.lg-defense-flow {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
		padding: 1rem 1.25rem;
		margin-top: 0.75rem;
	}
	.lg-defense-flow h4 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--color-ink-900);
	}
	.lg-defense-flow ol {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
	}
	.lg-defense-flow li {
		margin: 0.4rem 0;
	}
</style>
