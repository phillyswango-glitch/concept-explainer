<!--
	MCPSimulator.svelte — refonte intégrale.

	Vue à 4 couches (swim lanes) qui montrent comment les données traversent
	la stack quand un agent LangGraph appelle un outil via MCP :

	  ┌─ 👤 Utilisateur / App ───────────────┐
	  ├─ 🦜 LangGraph (state machine) ──────┤
	  ├─ 🔌 MCP (client ↔ serveur) ─────────┤
	  └─ ⚙️ Exécution (vrai backend) ──────┘

	À chaque step, UNE couche est "active" (lumineuse), les autres sont
	atténuées. On voit le data flow descendre et remonter à travers la stack.

	Scénario : "Calendrier de Persée ?" avec utilisateur habilité CD.
-->
<script lang="ts">
	type Lane = 'user' | 'langgraph' | 'mcp' | 'execution';

	interface SimStep {
		phase: 1 | 2 | 3 | 4;
		phaseTitle: string;
		activeLane: Lane;
		caption: string;
		user: { query: string; status: 'idle' | 'waiting' | 'done'; response?: string };
		langgraph: {
			activeNode: 'start' | 'agent' | 'action' | 'end';
			stateMessages: number;
			iterations: number;
			lastEvent: string;
		};
		mcp: {
			direction: 'idle' | 'sending' | 'receiving';
			frame?: string;
			actor: 'adapter' | 'client' | 'server' | 'idle';
		};
		execution: {
			active: boolean;
			code?: string;
			result?: string;
		};
	}

	const QUERY = 'Quel est le calendrier de livraison du programme Persée ?';
	const FINAL_RESPONSE =
		"Le programme Persée est classé Secret Défense. Ton habilitation courante (CD) ne permet pas l'accès. Adresse-toi à ton officier de sécurité.";

	const STEPS: SimStep[] = [
		// PHASE 1 : User → LangGraph
		{
			phase: 1,
			phaseTitle: 'Phase 1 — La requête entre dans le système',
			activeLane: 'user',
			caption: "L'utilisateur tape sa question dans l'application (web, CLI, API). Habilitation : CD.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'start', stateMessages: 0, iterations: 0, lastEvent: 'idle' },
			mcp: { direction: 'idle', actor: 'idle' },
			execution: { active: false }
		},
		{
			phase: 1,
			phaseTitle: 'Phase 1 — La requête entre dans le système',
			activeLane: 'langgraph',
			caption: "Le graphe LangGraph est invoqué avec un state initial : 1 message user + l'habilitation. Le pointeur d'exécution démarre au nœud `__start__`.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'start', stateMessages: 1, iterations: 0, lastEvent: 'graph.invoke()' },
			mcp: { direction: 'idle', actor: 'idle' },
			execution: { active: false }
		},
		{
			phase: 1,
			phaseTitle: 'Phase 1 — La requête entre dans le système',
			activeLane: 'langgraph',
			caption: "L'arête déterministe `start → agent` route le flux. Le nœud `agent` est activé.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'agent', stateMessages: 1, iterations: 0, lastEvent: 'edge: start → agent' },
			mcp: { direction: 'idle', actor: 'idle' },
			execution: { active: false }
		},

		// PHASE 2 : LangGraph décide d'appeler un outil
		{
			phase: 2,
			phaseTitle: 'Phase 2 — L\'agent décide d\'appeler un outil',
			activeLane: 'langgraph',
			caption: "Le LLM (Mistral fine-tuné) reçoit le contexte (système prompt avec l'habilitation + question user) et reconnaît le nom de programme \"Persée\". Sa sortie contient un `tool_call` vers `check_classification`.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: {
				activeNode: 'agent',
				stateMessages: 2,
				iterations: 1,
				lastEvent: 'LLM → AIMessage(tool_calls=[check_classification(Persée)])'
			},
			mcp: { direction: 'idle', actor: 'idle' },
			execution: { active: false }
		},
		{
			phase: 2,
			phaseTitle: 'Phase 2 — L\'agent décide d\'appeler un outil',
			activeLane: 'langgraph',
			caption: "L'arête conditionnelle `should_continue` examine le dernier message : tool_calls est non vide → retourne 'continue' → route vers le nœud `action`. C'est là qu'intervient l'adapter MCP.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'action', stateMessages: 2, iterations: 1, lastEvent: 'router: continue' },
			mcp: { direction: 'idle', actor: 'adapter' },
			execution: { active: false }
		},

		// PHASE 3 : MCP roundtrip
		{
			phase: 3,
			phaseTitle: 'Phase 3 — Aller-retour MCP',
			activeLane: 'mcp',
			caption: "Le `MultiServerMCPClient` (l'adapter LangChain) traduit le tool_call LangChain en frame JSON-RPC 2.0 et l'envoie au serveur MCP via stdio.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'action', stateMessages: 2, iterations: 1, lastEvent: 'awaiting MCP response...' },
			mcp: {
				direction: 'sending',
				actor: 'adapter',
				frame: `{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "check_classification",
    "arguments": { "program": "Persée" }
  }
}`
			},
			execution: { active: false }
		},
		{
			phase: 3,
			phaseTitle: 'Phase 3 — Aller-retour MCP',
			activeLane: 'mcp',
			caption: "Le serveur MCP (process séparé Python avec FastMCP) reçoit la frame, parse la méthode `tools/call` et identifie la fonction à exécuter.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'action', stateMessages: 2, iterations: 1, lastEvent: 'awaiting MCP response...' },
			mcp: {
				direction: 'receiving',
				actor: 'server',
				frame: `// Server reçoit la frame
// Method = tools/call
// Tool name = check_classification
// Args = { program: "Persée" }
// → Va invoquer la fonction Python check_classification("Persée")`
			},
			execution: { active: false }
		},
		{
			phase: 3,
			phaseTitle: 'Phase 3 — Aller-retour MCP',
			activeLane: 'execution',
			caption: "Le serveur MCP exécute la VRAIE fonction Python. Elle fait un appel mTLS au microservice interne de classification. C'est là que les choses RÉELLES se passent.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'action', stateMessages: 2, iterations: 1, lastEvent: 'awaiting MCP response...' },
			mcp: { direction: 'idle', actor: 'server' },
			execution: {
				active: true,
				code: `@mcp.tool()
def check_classification(program: str) -> str:
    """Retourne le niveau de classification d'un programme."""
    response = secure_client.get(
        f"https://classif.intranet/api/programs/{program}",
        cert=("/etc/ssl/agent.crt", "/etc/ssl/agent.key"),
        verify="/etc/ssl/internal-ca.crt"
    )
    return response.json()["classification"]
    # → retourne "SD"`,
				result: 'SD'
			}
		},
		{
			phase: 3,
			phaseTitle: 'Phase 3 — Aller-retour MCP',
			activeLane: 'mcp',
			caption: "Le serveur MCP emballe le résultat dans une frame JSON-RPC de réponse (avec le même `id` que la requête initiale, c'est ce qui permet à l'adapter de matcher).",
			user: { query: QUERY, status: 'waiting' },
			langgraph: { activeNode: 'action', stateMessages: 2, iterations: 1, lastEvent: 'awaiting MCP response...' },
			mcp: {
				direction: 'sending',
				actor: 'server',
				frame: `{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "content": [
      { "type": "text", "text": "SD" }
    ],
    "isError": false
  }
}`
			},
			execution: { active: false, code: '✓ Exécution terminée', result: 'SD' }
		},

		// PHASE 4 : MCP → LangGraph → User
		{
			phase: 4,
			phaseTitle: 'Phase 4 — La réponse remonte la stack',
			activeLane: 'langgraph',
			caption: "L'adapter reçoit la frame JSON-RPC, extrait le résultat, et le wrappe en `ToolMessage` LangChain. Ce nouveau message est ajouté au state via le reducer (operator.add sur `messages`).",
			user: { query: QUERY, status: 'waiting' },
			langgraph: {
				activeNode: 'action',
				stateMessages: 3,
				iterations: 1,
				lastEvent: 'state += ToolMessage(content="SD")'
			},
			mcp: { direction: 'receiving', actor: 'adapter' },
			execution: { active: false, code: '✓ Cycle MCP terminé', result: 'SD' }
		},
		{
			phase: 4,
			phaseTitle: 'Phase 4 — La réponse remonte la stack',
			activeLane: 'langgraph',
			caption: "L'arête `action → agent` ramène vers le LLM. Le LLM voit maintenant : question + tool_call + result. Il compare la classification (SD) à l'habilitation utilisateur (CD). CD < SD → refus.",
			user: { query: QUERY, status: 'waiting' },
			langgraph: {
				activeNode: 'agent',
				stateMessages: 4,
				iterations: 2,
				lastEvent: 'LLM → AIMessage(content="Refus, CD < SD...")'
			},
			mcp: { direction: 'idle', actor: 'idle' },
			execution: { active: false }
		},
		{
			phase: 4,
			phaseTitle: 'Phase 4 — La réponse remonte la stack',
			activeLane: 'user',
			caption: "Pas de nouveau tool_call → router 'end' → __end__. L'application récupère le dernier message du state et l'affiche à l'utilisateur. Trace complète envoyée à l'audit ANSSI en parallèle.",
			user: { query: QUERY, status: 'done', response: FINAL_RESPONSE },
			langgraph: { activeNode: 'end', stateMessages: 4, iterations: 2, lastEvent: 'graph done · audit log signed' },
			mcp: { direction: 'idle', actor: 'idle' },
			execution: { active: false }
		}
	];

	let stepIdx = $state(0);
	let isPlaying = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	const currentStep = $derived(STEPS[stepIdx]);

	function step() {
		if (stepIdx < STEPS.length - 1) stepIdx++;
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
		else {
			if (stepIdx >= STEPS.length - 1) reset();
			isPlaying = true;
			playInterval = setInterval(() => {
				if (stepIdx < STEPS.length - 1) stepIdx++;
				else stopPlay();
			}, 1800);
		}
	}
	function stopPlay() {
		isPlaying = false;
		if (playInterval) clearInterval(playInterval);
		playInterval = null;
	}

	function isActive(lane: Lane): boolean {
		return currentStep.activeLane === lane;
	}
</script>

<figure class="mcp2">
	<!-- Phase indicator -->
	<header class="mcp2-header">
		<div class="mcp2-phase">
			<span class="mcp2-phase-num">{currentStep.phase}/4</span>
			<strong>{currentStep.phaseTitle}</strong>
		</div>
		<div class="mcp2-caption">{currentStep.caption}</div>
	</header>

	<!-- 4 swim lanes -->
	<div class="mcp2-lanes">
		<!-- LANE 1 : USER -->
		<div class="mcp2-lane mcp2-lane-user {isActive('user') ? 'is-active' : 'is-idle'}">
			<div class="mcp2-lane-head">
				<span class="mcp2-lane-emoji">👤</span>
				<strong>USER / APPLICATION</strong>
				<span class="mcp2-lane-sub">Web/CLI/API · habilitation CD</span>
			</div>
			<div class="mcp2-lane-body">
				<div class="mcp2-user-query">
					<span class="mcp2-user-label">Question :</span>
					<span class="mcp2-user-text">« {currentStep.user.query} »</span>
				</div>
				<div class="mcp2-user-status">
					Status :
					{#if currentStep.user.status === 'waiting'}
						<span class="mcp2-status-wait">⏳ en attente de réponse…</span>
					{:else if currentStep.user.status === 'done'}
						<span class="mcp2-status-done">✓ terminé</span>
					{:else}
						<span>idle</span>
					{/if}
				</div>
				{#if currentStep.user.response}
					<div class="mcp2-user-response">
						<span class="mcp2-user-label">Réponse :</span>
						<span>{currentStep.user.response}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- LANE 2 : LANGGRAPH -->
		<div class="mcp2-lane mcp2-lane-lg {isActive('langgraph') ? 'is-active' : 'is-idle'}">
			<div class="mcp2-lane-head">
				<span class="mcp2-lane-emoji">🦜</span>
				<strong>LANGGRAPH</strong>
				<span class="mcp2-lane-sub">state machine Python · nœuds + arêtes conditionnelles</span>
			</div>
			<div class="mcp2-lane-body">
				<!-- Mini graphe -->
				<div class="mcp2-mini-graph">
					{#each ['start', 'agent', 'action', 'end'] as n (n)}
						<div class="mcp2-mini-node {currentStep.langgraph.activeNode === n ? 'is-active' : ''}">
							{n === 'start' ? '__start__' : n === 'end' ? '__end__' : n}
						</div>
						{#if n !== 'end'}
							<span class="mcp2-mini-arrow">→</span>
						{/if}
					{/each}
				</div>
				<!-- État résumé -->
				<div class="mcp2-lg-state">
					<div class="mcp2-state-row">
						<span class="mcp2-state-key">messages</span>
						<span class="mcp2-state-val">{currentStep.langgraph.stateMessages} item{currentStep.langgraph.stateMessages > 1 ? 's' : ''}</span>
					</div>
					<div class="mcp2-state-row">
						<span class="mcp2-state-key">iterations</span>
						<span class="mcp2-state-val">{currentStep.langgraph.iterations}</span>
					</div>
					<div class="mcp2-state-row">
						<span class="mcp2-state-key">user_clearance</span>
						<span class="mcp2-state-val">"CD"</span>
					</div>
				</div>
				<div class="mcp2-lg-event">📝 {currentStep.langgraph.lastEvent}</div>
			</div>
		</div>

		<!-- LANE 3 : MCP -->
		<div class="mcp2-lane mcp2-lane-mcp {isActive('mcp') ? 'is-active' : 'is-idle'}">
			<div class="mcp2-lane-head">
				<span class="mcp2-lane-emoji">🔌</span>
				<strong>MCP CLIENT ↔ SERVER</strong>
				<span class="mcp2-lane-sub">JSON-RPC 2.0 via stdio · process séparé</span>
			</div>
			<div class="mcp2-lane-body">
				<div class="mcp2-mcp-channel">
					<div class="mcp2-mcp-side mcp2-mcp-client {currentStep.mcp.actor === 'adapter' || currentStep.mcp.actor === 'client' ? 'is-active' : ''}">
						<div>MCP Client<br /><small>(langchain-mcp-adapter)</small></div>
					</div>
					<div class="mcp2-mcp-arrow mcp2-mcp-arrow-{currentStep.mcp.direction}">
						{#if currentStep.mcp.direction === 'sending'}→{:else if currentStep.mcp.direction === 'receiving'}←{:else}⇄{/if}
					</div>
					<div class="mcp2-mcp-side mcp2-mcp-server {currentStep.mcp.actor === 'server' ? 'is-active' : ''}">
						<div>MCP Server<br /><small>(FastMCP Python)</small></div>
					</div>
				</div>
				{#if currentStep.mcp.frame}
					<pre class="mcp2-frame">{currentStep.mcp.frame}</pre>
				{/if}
			</div>
		</div>

		<!-- LANE 4 : EXECUTION -->
		<div class="mcp2-lane mcp2-lane-exec {isActive('execution') ? 'is-active' : 'is-idle'}">
			<div class="mcp2-lane-head">
				<span class="mcp2-lane-emoji">⚙️</span>
				<strong>EXECUTION — vrai backend</strong>
				<span class="mcp2-lane-sub">code Python + appel mTLS au microservice classif</span>
			</div>
			<div class="mcp2-lane-body">
				{#if currentStep.execution.code}
					<pre class="mcp2-exec-code">{currentStep.execution.code}</pre>
				{:else}
					<div class="mcp2-exec-idle">Aucune exécution backend à cette étape.</div>
				{/if}
				{#if currentStep.execution.result}
					<div class="mcp2-exec-result">
						<span class="mcp2-exec-label">Résultat :</span>
						<span class="mcp2-exec-val">"{currentStep.execution.result}"</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Controls -->
	<div class="mcp2-controls">
		<div class="mcp2-progress">
			{#each STEPS as _, i (i)}
				<button
					type="button"
					class="mcp2-dot {stepIdx === i ? 'is-active' : ''} {stepIdx > i ? 'is-done' : ''}"
					onclick={() => (stepIdx = i)}
					aria-label="Step {i + 1}"
				></button>
			{/each}
		</div>
		<div class="mcp2-buttons">
			<button type="button" class="mcp2-btn" onclick={prev} disabled={stepIdx === 0}>◀ Précédent</button>
			<button type="button" class="mcp2-btn mcp2-btn-play" onclick={togglePlay}>
				{isPlaying ? '⏸ Pause' : '▶ Auto'}
			</button>
			<button type="button" class="mcp2-btn" onclick={reset}>↻ Reset</button>
			<button type="button" class="mcp2-btn mcp2-btn-next" onclick={step} disabled={stepIdx === STEPS.length - 1}>
				Suivant ▶
			</button>
			<span class="mcp2-step-num">{stepIdx + 1} / {STEPS.length}</span>
		</div>
	</div>
</figure>

<style>
	.mcp2 { background: #0f172a; border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; font-feature-settings: 'tnum'; }

	.mcp2-header { padding: 0.85rem 1rem; background: #1e293b; border-left: 4px solid #facc15; border-radius: 0.5rem; }
	.mcp2-phase { display: flex; gap: 0.6rem; align-items: center; margin-bottom: 0.35rem; }
	.mcp2-phase-num { background: #facc15; color: #0f172a; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 0.3rem; }
	.mcp2-phase strong { color: #facc15; font-family: var(--font-display); font-size: 0.95rem; }
	.mcp2-caption { font-size: 0.88rem; color: #cbd5e1; line-height: 1.55; }

	.mcp2-lanes { display: flex; flex-direction: column; gap: 0.5rem; }

	.mcp2-lane {
		background: #1e293b; border-radius: 0.7rem; padding: 0.85rem 1rem;
		border-left: 4px solid #334155;
		transition: all 0.4s ease;
		opacity: 0.45;
	}
	.mcp2-lane.is-active {
		opacity: 1;
		transform: scale(1.01);
		box-shadow: 0 0 0 2px currentColor;
	}
	.mcp2-lane-user.is-active { border-left-color: #22c55e; color: #22c55e; }
	.mcp2-lane-lg.is-active { border-left-color: #a855f7; color: #a855f7; }
	.mcp2-lane-mcp.is-active { border-left-color: #06b6d4; color: #06b6d4; }
	.mcp2-lane-exec.is-active { border-left-color: #fb923c; color: #fb923c; }

	.mcp2-lane-head { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.6rem; }
	.mcp2-lane-emoji { font-size: 1.3rem; }
	.mcp2-lane-head strong { font-family: var(--font-mono); font-size: 0.78rem; letter-spacing: 0.05em; }
	.mcp2-lane-sub { font-family: var(--font-mono); font-size: 0.7rem; color: #94a3b8; margin-left: auto; }

	.mcp2-lane-body { display: flex; flex-direction: column; gap: 0.5rem; }

	/* USER */
	.mcp2-user-query { padding: 0.55rem 0.75rem; background: #0f172a; border-radius: 0.4rem; font-size: 0.88rem; color: #e2e8f0; }
	.mcp2-user-label { font-family: var(--font-mono); font-size: 0.7rem; color: #94a3b8; margin-right: 0.4rem; }
	.mcp2-user-text { font-style: italic; }
	.mcp2-user-status { font-size: 0.83rem; color: #cbd5e1; }
	.mcp2-status-wait { color: #facc15; font-style: italic; }
	.mcp2-status-done { color: #22c55e; font-weight: 600; }
	.mcp2-user-response { padding: 0.55rem 0.75rem; background: #14321a; border-left: 3px solid #22c55e; border-radius: 0.4rem; font-size: 0.85rem; color: #cbd5e1; line-height: 1.5; }

	/* LANGGRAPH */
	.mcp2-mini-graph { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; padding: 0.45rem; background: #0f172a; border-radius: 0.4rem; }
	.mcp2-mini-node { padding: 0.3rem 0.65rem; background: #1e293b; border: 1.5px solid #475569; border-radius: 0.35rem; font-family: var(--font-mono); font-size: 0.75rem; color: #cbd5e1; }
	.mcp2-mini-node.is-active { background: #a855f7; border-color: #a855f7; color: #fff; font-weight: 700; box-shadow: 0 0 8px rgba(168, 85, 247, 0.6); }
	.mcp2-mini-arrow { color: #475569; font-size: 0.85rem; }
	.mcp2-lg-state { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.5rem 0.75rem; background: #0f172a; border-radius: 0.4rem; }
	.mcp2-state-row { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.78rem; }
	.mcp2-state-key { color: #94a3b8; }
	.mcp2-state-val { color: #facc15; }
	.mcp2-lg-event { font-family: var(--font-mono); font-size: 0.76rem; color: #cbd5e1; padding: 0.4rem 0.65rem; background: #1e1810; border-left: 2px solid #facc15; border-radius: 0.3rem; }

	/* MCP */
	.mcp2-mcp-channel { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.6rem; align-items: center; padding: 0.5rem; background: #0f172a; border-radius: 0.4rem; }
	.mcp2-mcp-side { padding: 0.55rem 0.7rem; background: #1e293b; border-radius: 0.4rem; text-align: center; font-family: var(--font-mono); font-size: 0.78rem; color: #cbd5e1; border: 1.5px solid #475569; transition: all 0.3s; }
	.mcp2-mcp-side small { font-size: 0.7rem; opacity: 0.7; }
	.mcp2-mcp-side.is-active { border-color: #06b6d4; box-shadow: 0 0 8px rgba(6, 182, 212, 0.5); color: #06b6d4; font-weight: 700; }
	.mcp2-mcp-arrow { font-size: 1.5rem; font-family: var(--font-mono); }
	.mcp2-mcp-arrow-sending { color: #fb923c; animation: mcp2-pulse-r 1s infinite; }
	.mcp2-mcp-arrow-receiving { color: #22c55e; animation: mcp2-pulse-l 1s infinite; }
	.mcp2-mcp-arrow-idle { color: #475569; }
	@keyframes mcp2-pulse-r { 0%, 100% { transform: translateX(0); opacity: 0.6; } 50% { transform: translateX(5px); opacity: 1; } }
	@keyframes mcp2-pulse-l { 0%, 100% { transform: translateX(0); opacity: 0.6; } 50% { transform: translateX(-5px); opacity: 1; } }
	.mcp2-frame { margin: 0; padding: 0.7rem 0.85rem; background: #0a0a0a; color: #06b6d4; border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.72rem; line-height: 1.55; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }

	/* EXECUTION */
	.mcp2-exec-code { margin: 0; padding: 0.7rem 0.85rem; background: #0a0a0a; color: #fb923c; border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.72rem; line-height: 1.55; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
	.mcp2-exec-idle { padding: 0.7rem; font-style: italic; color: #64748b; font-size: 0.85rem; text-align: center; }
	.mcp2-exec-result { padding: 0.5rem 0.75rem; background: #14321a; border-left: 3px solid #22c55e; border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.85rem; color: #4ade80; }
	.mcp2-exec-label { font-size: 0.7rem; color: #94a3b8; margin-right: 0.5rem; text-transform: uppercase; }
	.mcp2-exec-val { font-weight: 700; }

	/* Controls */
	.mcp2-controls { display: flex; flex-direction: column; gap: 0.6rem; }
	.mcp2-progress { display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap; }
	.mcp2-dot { width: 12px; height: 12px; border-radius: 50%; background: #334155; border: none; cursor: pointer; padding: 0; transition: all 0.2s; }
	.mcp2-dot:hover { background: #475569; }
	.mcp2-dot.is-done { background: #facc15; }
	.mcp2-dot.is-active { background: #06b6d4; transform: scale(1.4); }
	.mcp2-buttons { display: flex; gap: 0.4rem; justify-content: center; align-items: center; flex-wrap: wrap; }
	.mcp2-btn { padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #475569; border-radius: 999px; color: #cbd5e1; font-family: var(--font-mono); font-size: 0.8rem; cursor: pointer; }
	.mcp2-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.mcp2-btn-play { background: #06b6d4; border-color: #06b6d4; color: #0f172a; font-weight: 600; }
	.mcp2-btn-next { background: #facc15; border-color: #facc15; color: #0f172a; font-weight: 600; }
	.mcp2-step-num { font-family: var(--font-mono); font-size: 0.78rem; color: #94a3b8; margin-left: 0.5rem; }
</style>
