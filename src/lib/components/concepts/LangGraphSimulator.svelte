<!--
	LangGraphSimulator.svelte — refonte centrée sur l'ÉTAT.
	========================================================
	Le simulateur met le State (TypedDict) au centre, pas les messages.
	À chaque étape on voit :
	  - Le graphe avec le nœud actif
	  - L'état COMPLET (tous les champs du TypedDict) après ce step
	  - Les diffs (vert = ajouts, bleu = modifications)
	  - Le code Python qui vient de s'exécuter
	  - Comment le reducer a fusionné l'update dans l'état
-->
<script lang="ts">
	type NodeId = 'start' | 'agent' | 'action' | 'end';

	interface Message {
		role: 'user' | 'assistant' | 'tool';
		content: string;
		toolCalls?: { name: string; args: Record<string, unknown> }[];
		toolCallId?: string;
	}

	interface AgentState {
		messages: Message[];
		iterations: number;
		user_clearance?: string;
		current_program?: string | null;
		classification_level?: string | null;
		decision_log: string[];
	}

	interface SimStep {
		activeNode?: NodeId;
		activeEdge?: { from: NodeId; to: NodeId; label?: string };
		state: AgentState;
		caption: string;
		code?: string;
		reducerInfo?: string;
	}

	interface Scenario {
		id: string;
		title: string;
		emoji: string;
		description: string;
		steps: SimStep[];
	}

	// =================== SCENARIOS ===================

	const SCENARIO_DEFENSE: Scenario = {
		id: 'defense',
		title: 'Défense — refus classifié',
		emoji: '🛡️',
		description:
			"Utilisateur habilité CD demande des infos sur le programme Persée (classé SD). L'agent doit appeler check_classification, voir que SD > CD, et refuser.",
		steps: [
			{
				activeNode: 'start',
				state: {
					messages: [{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' }],
					iterations: 0,
					user_clearance: 'CD',
					current_program: null,
					classification_level: null,
					decision_log: ['START — état initial']
				},
				caption:
					"🚪 État initial — l'utilisateur (habilité CD) pose sa question. Le state est créé avec son message + son habilitation.",
				code: `# L'application invoque le graphe
app.invoke({
    "messages": [HumanMessage("Quel est le calendrier...?")],
    "iterations": 0,
    "user_clearance": "CD",
    "decision_log": ["START — état initial"]
})`,
				reducerInfo: "Création initiale de l'état. Aucun reducer appliqué : c'est le point de départ."
			},
			{
				activeEdge: { from: 'start', to: 'agent' },
				state: {
					messages: [{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' }],
					iterations: 0,
					user_clearance: 'CD',
					current_program: null,
					classification_level: null,
					decision_log: ['START — état initial']
				},
				caption: "➡️ Transition vers le nœud `agent`. L'état n'est pas modifié par les arêtes — elles routent juste."
			},
			{
				activeNode: 'agent',
				state: {
					messages: [
						{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'check_classification', args: { program: 'Persée' } }]
						}
					],
					iterations: 1,
					user_clearance: 'CD',
					current_program: 'Persée',
					classification_level: null,
					decision_log: ['START — état initial', 'AGENT — tool_call: check_classification(Persée)']
				},
				caption:
					"🧠 Le LLM (Mistral fine-tuné) détecte un nom de programme. Sa sortie inclut un tool_call vers `check_classification`. L'agent extrait aussi le nom du programme et le stocke dans le state.",
				code: `def agent_node(state: AgentState) -> dict:
    response = llm_with_tools.invoke([
        SystemMessage(f"Habilitation user: {state['user_clearance']}"),
        *state['messages']
    ])
    # Parse le tool_call pour identifier le programme
    program = extract_program(response) if response.tool_calls else None

    # Retourne SEULEMENT les changements
    return {
        "messages": [response],
        "iterations": state["iterations"] + 1,
        "current_program": program,
        "decision_log": [f"AGENT — tool_call: check_classification({program})"]
    }`,
				reducerInfo:
					"Reducer appliqué : `messages` (operator.add) → ajout de l'AIMessage. `iterations` → remplacement par +1. `current_program` → remplacement par 'Persée'. `decision_log` (operator.add) → ajout d'une entrée."
			},
			{
				activeEdge: { from: 'agent', to: 'action', label: 'continue' },
				state: {
					messages: [
						{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'check_classification', args: { program: 'Persée' } }]
						}
					],
					iterations: 1,
					user_clearance: 'CD',
					current_program: 'Persée',
					classification_level: null,
					decision_log: ['START — état initial', 'AGENT — tool_call: check_classification(Persée)']
				},
				caption:
					"🔀 L'arête conditionnelle (router) examine le dernier message. tool_calls non vide → renvoie 'continue' → direction le nœud `action`."
			},
			{
				activeNode: 'action',
				state: {
					messages: [
						{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'check_classification', args: { program: 'Persée' } }]
						},
						{
							role: 'tool',
							content: 'SD',
							toolCallId: 'check_classification'
						}
					],
					iterations: 1,
					user_clearance: 'CD',
					current_program: 'Persée',
					classification_level: 'SD',
					decision_log: [
						'START — état initial',
						'AGENT — tool_call: check_classification(Persée)',
						'ACTION — check_classification → SD'
					]
				},
				caption:
					"🔧 Le nœud `action` exécute l'outil. Réponse : 'SD' (Secret Défense). L'agent stocke cette info dans `classification_level` du state pour usage ultérieur.",
				code: `def action_node(state: AgentState) -> dict:
    last = state["messages"][-1]
    results = []
    classification = None

    for call in last.tool_calls:
        if call["name"] == "check_classification":
            # Appel mTLS au microservice interne
            result = check_classification_tool(call["args"]["program"])
            classification = result  # ex: "SD"
            results.append(ToolMessage(
                content=result,
                tool_call_id=call["id"]
            ))

    return {
        "messages": results,
        "classification_level": classification,
        "decision_log": [f"ACTION — check_classification → {classification}"]
    }`,
				reducerInfo:
					"Reducer : `messages` += ToolMessage. `classification_level` ← 'SD' (était null, maintenant remplacé). `decision_log` += entrée."
			},
			{
				activeEdge: { from: 'action', to: 'agent' },
				state: {
					messages: [
						{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'check_classification', args: { program: 'Persée' } }]
						},
						{ role: 'tool', content: 'SD', toolCallId: 'check_classification' }
					],
					iterations: 1,
					user_clearance: 'CD',
					current_program: 'Persée',
					classification_level: 'SD',
					decision_log: [
						'START — état initial',
						'AGENT — tool_call: check_classification(Persée)',
						'ACTION — check_classification → SD'
					]
				},
				caption: "↩️ Retour vers `agent` avec le résultat de l'outil dans le contexte."
			},
			{
				activeNode: 'agent',
				state: {
					messages: [
						{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'check_classification', args: { program: 'Persée' } }]
						},
						{ role: 'tool', content: 'SD', toolCallId: 'check_classification' },
						{
							role: 'assistant',
							content:
								"Le programme Persée est classé Secret Défense. Ton habilitation (CD) ne permet pas l'accès. Adresse-toi à ton officier de sécurité."
						}
					],
					iterations: 2,
					user_clearance: 'CD',
					current_program: 'Persée',
					classification_level: 'SD',
					decision_log: [
						'START — état initial',
						'AGENT — tool_call: check_classification(Persée)',
						'ACTION — check_classification → SD',
						'AGENT — refus (CD < SD)'
					]
				},
				caption:
					"🧠 Le LLM compare classification_level='SD' avec user_clearance='CD'. Comme SD > CD, il génère un refus structuré. Aucun tool_call — le router va sortir.",
				code: `# Même fonction agent_node, mais cette fois
# le LLM a accès à classification_level dans le contexte
response = llm_with_tools.invoke([...])
# response = "Le programme Persée est classé Secret Défense..."
# response.tool_calls = [] → on va sortir`,
				reducerInfo:
					"`messages` += AIMessage de refus. `iterations` → 2 (était 1). `decision_log` += 'AGENT — refus (CD < SD)'."
			},
			{
				activeEdge: { from: 'agent', to: 'end', label: 'end' },
				state: {
					messages: [
						{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'check_classification', args: { program: 'Persée' } }]
						},
						{ role: 'tool', content: 'SD', toolCallId: 'check_classification' },
						{
							role: 'assistant',
							content:
								"Le programme Persée est classé Secret Défense. Ton habilitation (CD) ne permet pas l'accès. Adresse-toi à ton officier de sécurité."
						}
					],
					iterations: 2,
					user_clearance: 'CD',
					current_program: 'Persée',
					classification_level: 'SD',
					decision_log: [
						'START — état initial',
						'AGENT — tool_call: check_classification(Persée)',
						'ACTION — check_classification → SD',
						'AGENT — refus (CD < SD)'
					]
				},
				caption: "🔀 Le router voit tool_calls vide → renvoie 'end' → direction `__end__`."
			},
			{
				activeNode: 'end',
				state: {
					messages: [
						{ role: 'user', content: 'Quel est le calendrier du programme Persée ?' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'check_classification', args: { program: 'Persée' } }]
						},
						{ role: 'tool', content: 'SD', toolCallId: 'check_classification' },
						{
							role: 'assistant',
							content:
								"Le programme Persée est classé Secret Défense. Ton habilitation (CD) ne permet pas l'accès. Adresse-toi à ton officier de sécurité."
						}
					],
					iterations: 2,
					user_clearance: 'CD',
					current_program: 'Persée',
					classification_level: 'SD',
					decision_log: [
						'START — état initial',
						'AGENT — tool_call: check_classification(Persée)',
						'ACTION — check_classification → SD',
						'AGENT — refus (CD < SD)',
						'END — réponse finale'
					]
				},
				caption:
					"✅ Sortie du graphe. L'état final contient tout : la trace complète, l'audit, la classification du programme. Tout est signé puis envoyé à l'audit log ANSSI.",
				code: `result = app.invoke({...})
# result est le state final complet
audit_log.append({
    "trace": result,
    "decision": "refused",
    "reason": f"user={result['user_clearance']} < program={result['classification_level']}"
})
return result["messages"][-1].content`
			}
		]
	};

	const SCENARIO_MULTI: Scenario = {
		id: 'multi',
		title: 'Multi-itération — agent qui boucle',
		emoji: '🔄',
		description:
			"L'agent doit récupérer 2 infos différentes pour répondre. Il boucle 2 fois sur action avant de pouvoir conclure. Montre comment `iterations` grandit et comment messages s'accumule.",
		steps: [
			{
				activeNode: 'start',
				state: {
					messages: [
						{
							role: 'user',
							content: 'Quelle est la formule de la caféine ET celle de la théobromine ?'
						}
					],
					iterations: 0,
					decision_log: ['START']
				},
				caption: '🚪 Question complexe : 2 formules chimiques à récupérer.'
			},
			{
				activeEdge: { from: 'start', to: 'agent' },
				state: {
					messages: [
						{
							role: 'user',
							content: 'Quelle est la formule de la caféine ET celle de la théobromine ?'
						}
					],
					iterations: 0,
					decision_log: ['START']
				},
				caption: '➡️ Vers `agent`.'
			},
			{
				activeNode: 'agent',
				state: {
					messages: [
						{
							role: 'user',
							content: 'Quelle est la formule de la caféine ET celle de la théobromine ?'
						},
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }]
						}
					],
					iterations: 1,
					decision_log: ['START', 'AGENT — search caffeine']
				},
				caption: '🧠 1ère itération. Le LLM demande la formule de la caféine en premier.',
				reducerInfo: 'messages += AIMessage, iterations → 1, decision_log += entrée.'
			},
			{
				activeEdge: { from: 'agent', to: 'action', label: 'continue' },
				state: {
					messages: [
						{
							role: 'user',
							content: 'Quelle est la formule de la caféine ET celle de la théobromine ?'
						},
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }]
						}
					],
					iterations: 1,
					decision_log: ['START', 'AGENT — search caffeine']
				},
				caption: '🔀 tool_call détecté → continue.'
			},
			{
				activeNode: 'action',
				state: {
					messages: [
						{
							role: 'user',
							content: 'Quelle est la formule de la caféine ET celle de la théobromine ?'
						},
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }]
						},
						{ role: 'tool', content: 'C8H10N4O2', toolCallId: 'search_pubchem_1' }
					],
					iterations: 1,
					decision_log: ['START', 'AGENT — search caffeine', 'ACTION — caffeine → C8H10N4O2']
				},
				caption: "🔧 Recherche caféine → C8H10N4O2. L'info est ajoutée au state.",
				reducerInfo: "messages += ToolMessage, decision_log += entrée."
			},
			{
				activeEdge: { from: 'action', to: 'agent' },
				state: {
					messages: [
						{
							role: 'user',
							content: 'Quelle est la formule de la caféine ET celle de la théobromine ?'
						},
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }]
						},
						{ role: 'tool', content: 'C8H10N4O2', toolCallId: 'search_pubchem_1' }
					],
					iterations: 1,
					decision_log: ['START', 'AGENT — search caffeine', 'ACTION — caffeine → C8H10N4O2']
				},
				caption: '↩️ Retour à `agent` avec le 1er résultat.'
			},
			{
				activeNode: 'agent',
				state: {
					messages: [
						{
							role: 'user',
							content: 'Quelle est la formule de la caféine ET celle de la théobromine ?'
						},
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }]
						},
						{ role: 'tool', content: 'C8H10N4O2', toolCallId: 'search_pubchem_1' },
						{
							role: 'assistant',
							content: '',
							toolCalls: [{ name: 'search_pubchem', args: { query: 'theobromine' } }]
						}
					],
					iterations: 2,
					decision_log: [
						'START',
						'AGENT — search caffeine',
						'ACTION — caffeine → C8H10N4O2',
						'AGENT — search theobromine'
					]
				},
				caption:
					"🧠 2ème itération. Le LLM a la formule de caféine, lui faut maintenant la théobromine. Nouveau tool_call.",
				reducerInfo: "messages += AIMessage, iterations → 2 (clé : ça grandit à chaque cycle !), decision_log += entrée."
			},
			{
				activeEdge: { from: 'agent', to: 'action', label: 'continue' },
				state: {
					messages: [
						{ role: 'user', content: '...' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }] },
						{ role: 'tool', content: 'C8H10N4O2', toolCallId: 'search_pubchem_1' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'theobromine' } }] }
					],
					iterations: 2,
					decision_log: ['...', 'AGENT — search theobromine']
				},
				caption: '🔀 Encore continue.'
			},
			{
				activeNode: 'action',
				state: {
					messages: [
						{ role: 'user', content: '...' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }] },
						{ role: 'tool', content: 'C8H10N4O2', toolCallId: 'search_pubchem_1' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'theobromine' } }] },
						{ role: 'tool', content: 'C7H8N4O2', toolCallId: 'search_pubchem_2' }
					],
					iterations: 2,
					decision_log: [
						'START',
						'AGENT — search caffeine',
						'ACTION — caffeine → C8H10N4O2',
						'AGENT — search theobromine',
						'ACTION — theobromine → C7H8N4O2'
					]
				},
				caption: '🔧 Recherche théobromine → C7H8N4O2.',
				reducerInfo: 'messages += ToolMessage. decision_log += entrée.'
			},
			{
				activeEdge: { from: 'action', to: 'agent' },
				state: {
					messages: [
						{ role: 'user', content: '...' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }] },
						{ role: 'tool', content: 'C8H10N4O2', toolCallId: 'search_pubchem_1' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'theobromine' } }] },
						{ role: 'tool', content: 'C7H8N4O2', toolCallId: 'search_pubchem_2' }
					],
					iterations: 2,
					decision_log: ['...', 'ACTION — theobromine → C7H8N4O2']
				},
				caption: '↩️ Retour `agent` avec 2 résultats.'
			},
			{
				activeNode: 'agent',
				state: {
					messages: [
						{ role: 'user', content: '...' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'caffeine' } }] },
						{ role: 'tool', content: 'C8H10N4O2', toolCallId: 'search_pubchem_1' },
						{ role: 'assistant', content: '', toolCalls: [{ name: 'search_pubchem', args: { query: 'theobromine' } }] },
						{ role: 'tool', content: 'C7H8N4O2', toolCallId: 'search_pubchem_2' },
						{
							role: 'assistant',
							content: 'Caféine : C₈H₁₀N₄O₂ (194 g/mol). Théobromine : C₇H₈N₄O₂ (180 g/mol). Différence d\'un seul méthyle (CH₂).'
						}
					],
					iterations: 3,
					decision_log: [
						'START',
						'AGENT — search caffeine',
						'ACTION — caffeine → C8H10N4O2',
						'AGENT — search theobromine',
						'ACTION — theobromine → C7H8N4O2',
						'AGENT — réponse finale'
					]
				},
				caption:
					"🧠 3ème itération. Le LLM a tout ce qu'il faut → formule la réponse complète sans nouveau tool_call.",
				reducerInfo: 'messages += AIMessage final. iterations → 3. decision_log += entrée.'
			},
			{
				activeEdge: { from: 'agent', to: 'end', label: 'end' },
				state: {
					messages: [],
					iterations: 3,
					decision_log: []
				},
				caption: "🔀 Pas de tool_call → end. C'est cette boucle (agent ↔ action) répétée plusieurs fois qui caractérise un agent ReAct."
			},
			{
				activeNode: 'end',
				state: {
					messages: [],
					iterations: 3,
					decision_log: []
				},
				caption: '✅ Réponse finale livrée. 3 itérations, 2 tool_calls, 1 réponse synthèse.'
			}
		]
	};

	const SCENARIOS = [SCENARIO_DEFENSE, SCENARIO_MULTI];

	// =================== ÉTAT ===================
	let scenarioId = $state('defense');
	let stepIdx = $state(0);
	let isPlaying = $state(false);
	let viewMode = $state<'state' | 'code'>('state');
	let playInterval: ReturnType<typeof setInterval> | null = null;

	const scenario = $derived(SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]);
	const currentStep = $derived(scenario.steps[stepIdx]);
	const previousStep = $derived(stepIdx > 0 ? scenario.steps[stepIdx - 1] : null);

	function step() {
		if (stepIdx < scenario.steps.length - 1) stepIdx++;
		else stopPlay();
	}
	function prev() {
		if (stepIdx > 0) stepIdx--;
	}
	function reset() {
		stopPlay();
		stepIdx = 0;
	}
	function togglePlay() {
		if (isPlaying) stopPlay();
		else startPlay();
	}
	function startPlay() {
		if (stepIdx >= scenario.steps.length - 1) reset();
		isPlaying = true;
		playInterval = setInterval(() => {
			if (stepIdx < scenario.steps.length - 1) stepIdx++;
			else stopPlay();
		}, 1500);
	}
	function stopPlay() {
		isPlaying = false;
		if (playInterval) clearInterval(playInterval);
		playInterval = null;
	}
	$effect(() => {
		scenarioId;
		reset();
	});

	// =================== DIFF UTILS ===================
	function isNewMessage(idx: number): boolean {
		if (!previousStep) return idx === 0;
		return idx >= previousStep.state.messages.length;
	}
	function isFieldChanged(field: keyof AgentState): boolean {
		if (!previousStep) return true;
		const prev = previousStep.state[field];
		const curr = currentStep.state[field];
		if (Array.isArray(prev) && Array.isArray(curr)) return prev.length !== curr.length;
		return prev !== curr;
	}
	function newDecisionLogEntries(): number {
		if (!previousStep) return currentStep.state.decision_log.length;
		return currentStep.state.decision_log.length - previousStep.state.decision_log.length;
	}

	// =================== GRAPHE ===================
	const NODES: Record<NodeId, { cx: number; cy: number; label: string; color: string }> = {
		start: { cx: 80, cy: 90, label: '__start__', color: '#a855f7' },
		agent: { cx: 220, cy: 90, label: 'agent', color: '#06b6d4' },
		action: { cx: 220, cy: 200, label: 'action', color: '#fb923c' },
		end: { cx: 360, cy: 90, label: '__end__', color: '#facc15' }
	};

	function isNodeActive(id: NodeId): boolean {
		return currentStep?.activeNode === id;
	}
	function isEdgeActive(from: NodeId, to: NodeId): boolean {
		const e = currentStep?.activeEdge;
		return e?.from === from && e?.to === to;
	}

	function msgIcon(role: string): string {
		return ({ user: '👤', assistant: '🤖', tool: '🔧' }[role] ?? '?');
	}
	function msgPreview(m: Message): string {
		if (m.toolCalls && m.toolCalls.length > 0) {
			const c = m.toolCalls[0];
			return `→ ${c.name}(${Object.entries(c.args).map(([k, v]) => `${k}="${v}"`).join(', ')})`;
		}
		return m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content;
	}
</script>

<figure class="lg2">
	<!-- Sélecteur de scénario -->
	<div class="lg2-scenarios">
		{#each SCENARIOS as s (s.id)}
			<button
				type="button"
				class="lg2-scenario {scenarioId === s.id ? 'is-active' : ''}"
				onclick={() => (scenarioId = s.id)}
			>
				<span>{s.emoji}</span>
				<div class="lg2-scenario-body">
					<strong>{s.title}</strong>
					<span class="lg2-scenario-desc">{s.description}</span>
				</div>
			</button>
		{/each}
	</div>

	<!-- Layout principal : graphe à gauche, state à droite -->
	<div class="lg2-main">
		<!-- Colonne gauche : graphe + execution -->
		<div class="lg2-left">
			<!-- Graphe -->
			<div class="lg2-graph-panel">
				<div class="lg2-panel-head">🗺️ Graph topology</div>
				<svg viewBox="0 0 440 270" class="lg2-graph-svg">
					<defs>
						<marker id="lg2-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
							<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
						</marker>
						<marker id="lg2-arr-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
							<path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15" />
						</marker>
					</defs>

					<!-- Edges -->
					<line
						x1={NODES.start.cx + 30}
						y1={NODES.start.cy}
						x2={NODES.agent.cx - 30}
						y2={NODES.agent.cy}
						stroke={isEdgeActive('start', 'agent') ? '#facc15' : '#475569'}
						stroke-width={isEdgeActive('start', 'agent') ? 3 : 1.5}
						stroke-dasharray="4 3"
						marker-end={isEdgeActive('start', 'agent') ? 'url(#lg2-arr-active)' : 'url(#lg2-arr)'}
					/>

					<path
						d="M {NODES.agent.cx - 10} {NODES.agent.cy + 20} Q {NODES.agent.cx - 60} {(NODES.agent.cy + NODES.action.cy) / 2} {NODES.action.cx - 10} {NODES.action.cy - 20}"
						fill="none"
						stroke={isEdgeActive('agent', 'action') ? '#facc15' : '#475569'}
						stroke-width={isEdgeActive('agent', 'action') ? 3 : 1.5}
						stroke-dasharray="4 3"
						marker-end={isEdgeActive('agent', 'action') ? 'url(#lg2-arr-active)' : 'url(#lg2-arr)'}
					/>
					<text x="135" y="155" fill={isEdgeActive('agent', 'action') ? '#facc15' : '#94a3b8'} font-family="monospace" font-size="10" font-style="italic">continue</text>

					<path
						d="M {NODES.action.cx + 10} {NODES.action.cy - 20} Q {NODES.action.cx + 70} {(NODES.agent.cy + NODES.action.cy) / 2} {NODES.agent.cx + 10} {NODES.agent.cy + 20}"
						fill="none"
						stroke={isEdgeActive('action', 'agent') ? '#facc15' : '#06b6d4'}
						stroke-width={isEdgeActive('action', 'agent') ? 3 : 1.5}
						marker-end={isEdgeActive('action', 'agent') ? 'url(#lg2-arr-active)' : 'url(#lg2-arr)'}
					/>

					<line
						x1={NODES.agent.cx + 30}
						y1={NODES.agent.cy}
						x2={NODES.end.cx - 30}
						y2={NODES.end.cy}
						stroke={isEdgeActive('agent', 'end') ? '#facc15' : '#475569'}
						stroke-width={isEdgeActive('agent', 'end') ? 3 : 1.5}
						stroke-dasharray="4 3"
						marker-end={isEdgeActive('agent', 'end') ? 'url(#lg2-arr-active)' : 'url(#lg2-arr)'}
					/>
					<text x="290" y="80" fill={isEdgeActive('agent', 'end') ? '#facc15' : '#94a3b8'} font-family="monospace" font-size="10" font-style="italic">end</text>

					<!-- Nodes -->
					{#each Object.entries(NODES) as [id, n] (id)}
						<g class="lg2-node {isNodeActive(id as NodeId) ? 'is-active' : ''}">
							<rect
								x={n.cx - 32}
								y={n.cy - 20}
								width={64}
								height={40}
								rx={8}
								fill={isNodeActive(id as NodeId) ? n.color : '#1e293b'}
								stroke={n.color}
								stroke-width={isNodeActive(id as NodeId) ? 3 : 2}
							/>
							<text
								x={n.cx}
								y={n.cy + 4}
								text-anchor="middle"
								font-family="monospace"
								font-size="11"
								font-weight="700"
								fill={isNodeActive(id as NodeId) ? '#fff' : n.color}
							>
								{n.label}
							</text>
						</g>
					{/each}
				</svg>
			</div>

			<!-- Execution panel : code + reducer -->
			<div class="lg2-exec-panel">
				<div class="lg2-exec-tabs">
					<button type="button" class="lg2-exec-tab {viewMode === 'state' ? 'is-active' : ''}" onclick={() => (viewMode = 'state')}>
						🧠 Ce qui s'est passé
					</button>
					<button type="button" class="lg2-exec-tab {viewMode === 'code' ? 'is-active' : ''}" onclick={() => (viewMode = 'code')}>
						💻 Code Python
					</button>
				</div>
				<div class="lg2-exec-body">
					{#if viewMode === 'state'}
						<div class="lg2-caption">{currentStep.caption}</div>
						{#if currentStep.reducerInfo}
							<div class="lg2-reducer">
								<div class="lg2-reducer-label">📐 Reducer appliqué</div>
								<div class="lg2-reducer-text">{currentStep.reducerInfo}</div>
							</div>
						{/if}
					{:else}
						{#if currentStep.code}
							<pre class="lg2-code"><code>{currentStep.code}</code></pre>
						{:else}
							<div class="lg2-no-code">Pas de code à exécuter à cette étape (transition pure).</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<!-- Colonne droite : state structuré -->
		<div class="lg2-right">
			<div class="lg2-state-panel">
				<div class="lg2-panel-head">📦 État (TypedDict) — step {stepIdx + 1} / {scenario.steps.length}</div>
				<div class="lg2-state-body">
					<!-- iterations -->
					<div class="lg2-field {isFieldChanged('iterations') ? 'is-changed' : ''}">
						<span class="lg2-field-key">iterations</span>
						<span class="lg2-field-val lg2-field-val-num">{currentStep.state.iterations}</span>
						{#if isFieldChanged('iterations') && previousStep}
							<span class="lg2-field-was">was {previousStep.state.iterations}</span>
						{/if}
					</div>

					<!-- user_clearance -->
					{#if currentStep.state.user_clearance !== undefined}
						<div class="lg2-field {isFieldChanged('user_clearance') ? 'is-changed' : ''}">
							<span class="lg2-field-key">user_clearance</span>
							<span class="lg2-field-val lg2-field-val-str">"{currentStep.state.user_clearance}"</span>
						</div>
					{/if}

					<!-- current_program -->
					{#if currentStep.state.current_program !== undefined}
						<div class="lg2-field {isFieldChanged('current_program') ? 'is-changed' : ''}">
							<span class="lg2-field-key">current_program</span>
							<span class="lg2-field-val lg2-field-val-str">
								{currentStep.state.current_program === null ? 'null' : `"${currentStep.state.current_program}"`}
							</span>
						</div>
					{/if}

					<!-- classification_level -->
					{#if currentStep.state.classification_level !== undefined}
						<div class="lg2-field {isFieldChanged('classification_level') ? 'is-changed' : ''}">
							<span class="lg2-field-key">classification_level</span>
							<span class="lg2-field-val lg2-field-val-str">
								{currentStep.state.classification_level === null ? 'null' : `"${currentStep.state.classification_level}"`}
							</span>
						</div>
					{/if}

					<!-- decision_log -->
					<div class="lg2-field-list">
						<span class="lg2-field-key">decision_log: List[str] <span class="lg2-reducer-badge">operator.add</span></span>
						<ul class="lg2-list">
							{#each currentStep.state.decision_log as entry, i (i)}
								<li class="lg2-list-item {previousStep && i >= previousStep.state.decision_log.length ? 'is-new' : ''}">
									{entry}
									{#if previousStep && i >= previousStep.state.decision_log.length}
										<span class="lg2-new-tag">+ NEW</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>

					<!-- messages -->
					<div class="lg2-field-list">
						<span class="lg2-field-key">messages: List[BaseMessage] <span class="lg2-reducer-badge">operator.add</span></span>
						<div class="lg2-messages">
							{#each currentStep.state.messages as msg, i (i)}
								<div class="lg2-msg lg2-msg-{msg.role} {isNewMessage(i) ? 'is-new' : ''}">
									<span class="lg2-msg-icon">{msgIcon(msg.role)}</span>
									<div class="lg2-msg-body">
										<div class="lg2-msg-role">{msg.role}</div>
										<div class="lg2-msg-content">{msgPreview(msg)}</div>
									</div>
									{#if isNewMessage(i)}
										<span class="lg2-new-tag">+ NEW</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Contrôles -->
	<div class="lg2-controls">
		<button type="button" class="lg2-btn" onclick={prev} disabled={stepIdx === 0}>◀ Précédent</button>
		<button type="button" class="lg2-btn lg2-btn-play" onclick={togglePlay}>
			{isPlaying ? '⏸ Pause' : '▶ Auto'}
		</button>
		<button type="button" class="lg2-btn" onclick={reset}>↻ Reset</button>
		<button type="button" class="lg2-btn lg2-btn-next" onclick={step} disabled={stepIdx === scenario.steps.length - 1}>
			Suivant ▶
		</button>
	</div>
</figure>

<style>
	.lg2 {
		background: #0f172a;
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		font-feature-settings: 'tnum';
	}

	.lg2-scenarios { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
	@media (max-width: 720px) { .lg2-scenarios { grid-template-columns: 1fr; } }
	.lg2-scenario {
		display: flex; gap: 0.7rem; padding: 0.7rem 0.9rem;
		background: #1e293b; border: 2px solid #334155; border-radius: 0.6rem;
		color: #cbd5e1; cursor: pointer; text-align: left;
	}
	.lg2-scenario:hover { border-color: #06b6d4; }
	.lg2-scenario.is-active { background: #06b6d4; border-color: #06b6d4; color: #0f172a; }
	.lg2-scenario > span:first-child { font-size: 1.4rem; flex-shrink: 0; }
	.lg2-scenario-body { display: flex; flex-direction: column; gap: 0.15rem; }
	.lg2-scenario-body strong { font-family: var(--font-display); font-size: 0.95rem; }
	.lg2-scenario-desc { font-size: 0.78rem; opacity: 0.8; line-height: 1.4; }

	.lg2-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 0.85rem; }
	@media (max-width: 900px) { .lg2-main { grid-template-columns: 1fr; } }

	.lg2-left { display: flex; flex-direction: column; gap: 0.7rem; }

	.lg2-graph-panel, .lg2-exec-panel, .lg2-state-panel {
		background: #1e293b; border-radius: 0.7rem; overflow: hidden;
		display: flex; flex-direction: column;
	}
	.lg2-panel-head {
		padding: 0.5rem 0.85rem; background: #0f172a; color: #facc15;
		font-family: var(--font-mono); font-size: 0.72rem; text-transform: uppercase;
		letter-spacing: 0.05em; font-weight: 600;
	}
	.lg2-graph-svg { width: 100%; height: auto; max-height: 280px; padding: 0.5rem; }
	.lg2-node { transition: all 0.25s; }
	.lg2-node.is-active { filter: drop-shadow(0 0 8px currentColor); }

	.lg2-exec-tabs { display: flex; gap: 0.3rem; padding: 0.4rem; background: #0f172a; }
	.lg2-exec-tab {
		flex: 1; padding: 0.4rem 0.6rem; background: transparent; border: 1px solid transparent;
		border-radius: 0.35rem; color: #94a3b8; font-family: var(--font-mono);
		font-size: 0.72rem; text-transform: uppercase; cursor: pointer;
	}
	.lg2-exec-tab.is-active { background: #1e293b; color: #facc15; border-color: #facc15; }
	.lg2-exec-body { padding: 0.85rem; }
	.lg2-caption {
		font-size: 0.88rem; color: #e2e8f0; line-height: 1.55;
		padding: 0.7rem 0.85rem; background: #0f172a; border-left: 3px solid #06b6d4;
		border-radius: 0.4rem;
	}
	.lg2-reducer {
		margin-top: 0.6rem; padding: 0.7rem 0.85rem;
		background: #1e1810; border-left: 3px solid #facc15; border-radius: 0.4rem;
	}
	.lg2-reducer-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: #facc15; font-weight: 600; margin-bottom: 0.25rem;
	}
	.lg2-reducer-text { font-size: 0.82rem; color: #fef3c7; line-height: 1.55; }
	.lg2-code {
		margin: 0; padding: 0.75rem 0.9rem; background: #0a0a0a; color: #e2e8f0;
		border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.72rem;
		line-height: 1.55; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
	}
	.lg2-no-code { font-style: italic; color: #64748b; padding: 1rem; text-align: center; font-size: 0.86rem; }

	.lg2-state-body {
		padding: 0.85rem; display: flex; flex-direction: column; gap: 0.7rem;
		max-height: 580px; overflow-y: auto;
	}

	.lg2-field, .lg2-field-list {
		display: flex; flex-direction: column; gap: 0.25rem;
		padding: 0.55rem 0.75rem; background: #0f172a; border-radius: 0.4rem;
		border-left: 3px solid #334155;
	}
	.lg2-field { flex-direction: row; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.lg2-field.is-changed {
		background: #1e1810; border-left-color: #facc15;
		animation: lg2-flash 0.6s ease-out;
	}
	@keyframes lg2-flash {
		0% { background: #facc15; }
		100% { background: #1e1810; }
	}
	.lg2-field-key {
		font-family: var(--font-mono); font-size: 0.78rem; color: #94a3b8;
	}
	.lg2-field-val {
		font-family: var(--font-mono); font-size: 0.85rem; padding: 0.1rem 0.5rem;
		border-radius: 0.3rem;
	}
	.lg2-field-val-num { background: #1e1810; color: #facc15; font-weight: 700; }
	.lg2-field-val-str { background: #0c1c2e; color: #06b6d4; }
	.lg2-field-was {
		font-family: var(--font-mono); font-size: 0.7rem; color: #64748b; font-style: italic;
	}
	.lg2-reducer-badge {
		display: inline-block; font-family: var(--font-mono); font-size: 0.65rem;
		background: #1e1810; color: #facc15; padding: 0.1rem 0.4rem; border-radius: 0.25rem;
		margin-left: 0.4rem;
	}

	.lg2-list { margin: 0.3rem 0 0; padding-left: 1rem; }
	.lg2-list-item {
		font-family: var(--font-mono); font-size: 0.78rem; color: #cbd5e1;
		padding: 0.2rem 0.4rem; margin: 0.1rem 0; border-radius: 0.25rem;
		position: relative;
	}
	.lg2-list-item.is-new {
		background: #14321a; color: #4ade80;
		animation: lg2-pop 0.5s ease-out;
	}
	@keyframes lg2-pop {
		0% { transform: translateX(-6px); opacity: 0; }
		100% { transform: translateX(0); opacity: 1; }
	}
	.lg2-new-tag {
		display: inline-block; font-family: var(--font-mono); font-size: 0.62rem;
		background: #22c55e; color: #0a0a0a; padding: 0.05rem 0.4rem;
		border-radius: 0.2rem; margin-left: 0.4rem; font-weight: 700;
	}

	.lg2-messages { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.3rem; }
	.lg2-msg {
		display: flex; gap: 0.5rem; align-items: flex-start;
		padding: 0.45rem 0.65rem; background: #1e293b; border-radius: 0.4rem;
		border-left: 3px solid;
	}
	.lg2-msg.is-new {
		background: #14321a; animation: lg2-pop 0.5s ease-out;
	}
	.lg2-msg-user { border-left-color: #22c55e; }
	.lg2-msg-assistant { border-left-color: #a855f7; }
	.lg2-msg-tool { border-left-color: #06b6d4; }
	.lg2-msg-icon { font-size: 1rem; line-height: 1; }
	.lg2-msg-body { flex: 1; }
	.lg2-msg-role {
		font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase;
		color: #94a3b8;
	}
	.lg2-msg-content { font-size: 0.78rem; color: #e2e8f0; line-height: 1.45; word-break: break-word; }

	.lg2-controls { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
	.lg2-btn {
		padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #475569;
		border-radius: 999px; color: #cbd5e1; font-family: var(--font-mono);
		font-size: 0.82rem; cursor: pointer;
	}
	.lg2-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.lg2-btn-play { background: #06b6d4; border-color: #06b6d4; color: #0f172a; font-weight: 600; }
	.lg2-btn-next { background: #facc15; border-color: #facc15; color: #0f172a; font-weight: 600; }
</style>
