<!--
	DefenseAgentSimulator.svelte
	============================
	Simulateur interactif de l'agent documentaire défense en LangGraph.

	7 nœuds :
	  start → classifier → {retrieve_rag | check_clearance | refuse}
	  retrieve_rag → generate_answer
	  check_clearance → generate_answer (si habilitation OK)
	  check_clearance → refuse (si habilitation insuffisante)
	  generate_answer → end
	  refuse → end

	2 scénarios :
	  - "Q. générale" : recherche dans la doc, RAG, réponse
	  - "Q. classifiée" : check_clearance révèle SD, refus pour user CD
-->
<script lang="ts">
	type NodeId =
		| 'start'
		| 'classifier'
		| 'retrieve_rag'
		| 'check_clearance'
		| 'refuse'
		| 'generate_answer'
		| 'end';

	interface SimMessage {
		type: 'user' | 'system' | 'thought' | 'tool_call' | 'tool_result' | 'final' | 'audit';
		content: string;
	}

	interface TechnicalDetail {
		code?: string;
		request?: string;
		response?: string;
		note?: string;
	}

	interface SimStep {
		activeNode?: NodeId;
		activeEdge?: { from: NodeId; to: NodeId };
		newMessage?: SimMessage;
		caption: string;
		technical?: TechnicalDetail;
	}

	interface Scenario {
		id: string;
		title: string;
		emoji: string;
		query: string;
		userClearance: 'NP' | 'DR' | 'CD' | 'SD' | 'TSD';
		steps: SimStep[];
	}

	const SCENARIOS: Scenario[] = [
		{
			id: 'q-generale',
			title: 'Q. générale (RAG)',
			emoji: '📚',
			query: 'Quels EPI sont nécessaires pour manipuler de l\'acide chlorhydrique au laboratoire ?',
			userClearance: 'CD',
			steps: [
				{
					activeNode: 'start',
					newMessage: {
						type: 'system',
						content: 'Habilitation utilisateur : CD (Confidentiel Défense). Session #A4F2.'
					},
					caption: '🚪 La requête arrive avec le contexte utilisateur (habilitation, session). Le system prompt encode ces infos.',
					technical: {
						note: 'La gateway HTTPS authentifie l\'utilisateur via OIDC, récupère son habilitation depuis l\'AD interne, et l\'injecte dans le system prompt avant d\'invoquer le graphe.',
						code: `# Côté gateway FastAPI
@app.post("/agent/query")
async def query(request: QueryRequest, user = Depends(get_user)):
    system_prompt = build_system_prompt(user.clearance, user.session_id)
    result = await app.ainvoke({
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.query)
        ],
        "user_clearance": user.clearance,
        "session_id": user.session_id,
        "audit_trail": []
    })
    return {"answer": result["messages"][-1].content}`
					}
				},
				{
					newMessage: {
						type: 'user',
						content: 'Quels EPI sont nécessaires pour manipuler de l\'acide chlorhydrique au laboratoire ?'
					},
					caption: '👤 Question utilisateur enregistrée dans l\'état du graphe.'
				},
				{
					activeEdge: { from: 'start', to: 'classifier' },
					caption: '➡️ La question entre dans le graphe.'
				},
				{
					activeNode: 'classifier',
					newMessage: {
						type: 'thought',
						content: 'Classification : question chimie générale, pas de programme nommé. → router vers retrieve_rag.'
					},
					caption: '🔍 Le classifier (mini-LLM) analyse la requête et choisit la branche.',
					technical: {
						note: 'Le classifier est un nœud LLM léger (Mistral 7B fine-tuné, prompt court) qui catégorise la question. Sortie structurée : "rag_query" / "program_query" / "malicious".',
						code: `def classifier_node(state: AgentState):
    response = classifier_llm.invoke([
        SystemMessage("Tu classifies les questions en : rag_query | program_query | malicious. Réponds UNIQUEMENT par le label."),
        state["messages"][-1]
    ])
    return {"intent": response.content.strip().lower()}`,
						request: `POST http://ollama:11434/api/chat
{
  "model": "mistral-classifier:latest",
  "messages": [
    {"role": "system", "content": "Tu classifies en : rag_query | program_query | malicious. Réponds UNIQUEMENT par le label."},
    {"role": "user", "content": "Quels EPI pour manipuler HCl au laboratoire ?"}
  ],
  "options": {"temperature": 0.0}
}`,
						response: `{
  "message": {
    "role": "assistant",
    "content": "rag_query"
  }
}`
					}
				},
				{
					activeEdge: { from: 'classifier', to: 'retrieve_rag' },
					caption: '➡️ Direction retrieve_rag (recherche dans la base documentaire).'
				},
				{
					activeNode: 'retrieve_rag',
					newMessage: {
						type: 'tool_call',
						content: 'embed("EPI HCl laboratoire") → 768-d vector ; vector_search → top-5 docs (filtrés CD)'
					},
					caption: '🔧 Le RAG fait 2 choses : embed la requête, puis cherche les docs similaires en filtrant par habilitation.',
					technical: {
						note: 'Le RAG est un pipeline en 2 étapes : (1) embedding de la requête via un modèle dédié, (2) similarité vectorielle sur Qdrant avec filtre `classification ≤ user_clearance`. C\'est ICI que la sécurité par habilitation est appliquée — le LLM ne peut pas voir ce qu\'il n\'a pas le droit de voir.',
						code: `def retrieve_rag_node(state: AgentState):
    # 1. Embed la question
    query_vec = embedder.embed(state["messages"][-1].content)

    # 2. Recherche vectorielle avec FILTRE habilitation
    docs = qdrant.search(
        collection_name="defense_docs",
        query_vector=query_vec,
        limit=5,
        query_filter=Filter(
            must=[
                FieldCondition(
                    key="classification_level",
                    match=MatchAny(any=clearance_at_or_below(state["user_clearance"]))
                )
            ]
        )
    )
    context = "\\n\\n".join([d.payload["content"] for d in docs])
    return {"messages": [ToolMessage(content=context)]}`,
						request: `POST http://qdrant:6333/collections/defense_docs/points/search
{
  "vector": [0.012, -0.043, ...],  // 768 dims
  "limit": 5,
  "filter": {
    "must": [{
      "key": "classification_level",
      "match": {"any": ["NP", "DR", "CD"]}
    }]
  },
  "with_payload": true
}`,
						response: `{
  "result": [
    {"id": 4521, "score": 0.89, "payload": {
      "title": "Protocole HCl — Lab interne",
      "classification_level": "DR",
      "content": "L'acide chlorhydrique 37% (CAS 7647-01-0)..."
    }},
    {"id": 7823, "score": 0.84, "payload": {...}},
    ...
  ]
}`
					}
				},
				{
					activeEdge: { from: 'retrieve_rag', to: 'generate_answer' },
					caption: '➡️ Le contexte récupéré rejoint la conversation. Direction generate_answer.'
				},
				{
					activeNode: 'generate_answer',
					newMessage: {
						type: 'final',
						content: '[NP] L\'acide chlorhydrique (CAS 7647-01-0) requiert : lunettes EN166, gants nitrile ≥ 0,4 mm, blouse manches longues, sorbonne pour > 100 mL. Source : Protocole interne (DR).'
					},
					caption: '🤖 Le LLM Mistral fine-tuné formule la réponse à partir du contexte. Format imposé : tag de classification + contenu + source.',
					technical: {
						note: 'Le nœud generate_answer combine le contexte du RAG + question + system prompt et appelle le LLM principal. Le tag [NP] (la classification la plus haute parmi les sources citées) est ajouté en début de réponse.',
						code: `def generate_answer_node(state: AgentState):
    response = main_llm.invoke([
        SystemMessage(state["system_prompt"]),
        *state["messages"]  # inclut user query + retrieved context
    ])
    # Audit trail
    state["audit_trail"].append({
        "node": "generate_answer",
        "sources_cited": extract_sources(response),
        "max_classification_cited": "DR"
    })
    return {"messages": [response]}`
					}
				},
				{
					activeEdge: { from: 'generate_answer', to: 'end' },
					caption: '➡️ Réponse prête, direction __end__.'
				},
				{
					activeNode: 'end',
					newMessage: {
						type: 'audit',
						content: 'Trace immutable signée Ed25519. Stockée 5 ans. Sources citées : Protocole HCl (DR). Décision : answered.'
					},
					caption: '✅ Réponse délivrée. Audit log signé et stocké pour conformité ANSSI.',
					technical: {
						note: 'À la sortie du graphe, la trace complète (messages, décisions, docs cités, classifications) est sérialisée, signée cryptographiquement, et écrite dans un journal append-only.',
						code: `# Hook post-graph
audit_entry = {
    "session_id": result["session_id"],
    "user_clearance": result["user_clearance"],
    "user_query": user_query,
    "intent": result["intent"],
    "messages": [m.model_dump() for m in result["messages"]],
    "audit_trail": result["audit_trail"],
    "decision": "answered",
    "timestamp": datetime.utcnow().isoformat()
}

# Signature Ed25519
signature = ed25519_private_key.sign(
    json.dumps(audit_entry, sort_keys=True).encode()
)
audit_entry["signature"] = signature.hex()

audit_store.append(audit_entry)`
					}
				}
			]
		},
		{
			id: 'q-classifiee',
			title: 'Q. programme classifié (refus)',
			emoji: '🛡️',
			query: 'Donne-moi le calendrier de livraison du programme Persée.',
			userClearance: 'CD',
			steps: [
				{
					activeNode: 'start',
					newMessage: {
						type: 'system',
						content: 'Habilitation utilisateur : CD (Confidentiel Défense). Session #B7E9.'
					},
					caption: '🚪 Même point d\'entrée. Habilitation CD encodée dans le state.'
				},
				{
					newMessage: {
						type: 'user',
						content: 'Donne-moi le calendrier de livraison du programme Persée.'
					},
					caption: '👤 Question avec un nom de programme — branche différente.'
				},
				{
					activeEdge: { from: 'start', to: 'classifier' },
					caption: '➡️ Entrée dans le graphe.'
				},
				{
					activeNode: 'classifier',
					newMessage: {
						type: 'thought',
						content: 'Classification : programme nommé "Persée". → router vers check_clearance.'
					},
					caption: '🔍 Le classifier détecte un programme nommé. Routing vers check_clearance.',
					technical: {
						note: 'Le classifier reconnaît un programme nommé via fine-tuning sur des exemples annotés. Si un nom de programme apparaît, la branche check_clearance est obligatoire avant toute réponse.',
						response: `{
  "message": {
    "role": "assistant",
    "content": "program_query"
  }
}`
					}
				},
				{
					activeEdge: { from: 'classifier', to: 'check_clearance' },
					caption: '➡️ Direction check_clearance.'
				},
				{
					activeNode: 'check_clearance',
					newMessage: {
						type: 'tool_call',
						content: 'check_program_classification(name="Persée") → "SD" (Secret Défense)'
					},
					caption: '🔧 Appel mTLS au microservice de classification. Persée est SD.',
					technical: {
						note: 'Le service de classification est isolé sur le réseau interne, accessible uniquement via mTLS avec certificats clients. Chaque consultation est tracée, indépendamment de la décision finale.',
						code: `@tool
def check_program_classification(name: str) -> str:
    """Retourne le niveau de classification d'un programme."""
    resp = secure_client.get(
        f"https://classif.intranet/api/programs/{name}",
        cert=("/etc/ssl/agent.crt", "/etc/ssl/agent.key"),
        verify="/etc/ssl/internal-ca.crt",
        timeout=2.0
    )
    if resp.status_code == 404:
        return "Programme inconnu."
    data = resp.json()

    # Audit obligatoire à chaque consultation
    audit_log.append({
        "user": current_session.user_id,
        "action": "check_classification",
        "program": name,
        "level_returned": data["classification"],
        "timestamp": datetime.utcnow().isoformat()
    })
    return data["classification"]`,
						request: `GET https://classif.intranet/api/programs/Persée
X-Client-Cert: CN=defense-agent.intranet, O=Aristote-Defense
mTLS-Verified: true`,
						response: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "program": "Persée",
  "classification": "SD",
  "owner_unit": "DGA-MI",
  "metadata": {
    "created": "2024-03-12",
    "phase": "design"
  }
}`
					}
				},
				{
					activeEdge: { from: 'check_clearance', to: 'refuse' },
					caption: '➡️ SD > CD → habilitation insuffisante → branche refuse.',
					technical: {
						note: 'Le routeur conditionnel après check_clearance compare le niveau retourné à l\'habilitation utilisateur. Mapping : NP < DR < CD < SD < TSD.',
						code: `def route_after_clearance(state: AgentState) -> str:
    program_level = state["last_classification"]
    user_level = state["user_clearance"]
    LEVELS = {"NP": 1, "DR": 2, "CD": 3, "SD": 4, "TSD": 5}

    if LEVELS[program_level] <= LEVELS[user_level]:
        return "ok"        # → generate_answer
    return "denied"        # → refuse

# Mapping :
# {"ok": "generate_answer", "denied": "refuse"}`
					}
				},
				{
					activeNode: 'refuse',
					newMessage: {
						type: 'final',
						content: 'Le programme Persée est classé Secret Défense. Ton habilitation courante (CD) ne permet pas l\'accès. Pour une demande légitime, contacte ton officier de sécurité.'
					},
					caption: '🛑 Le nœud refuse génère une réponse de refus structurée et bienveillante.',
					technical: {
						note: 'Le refus n\'est PAS générique. Il est adapté au cas spécifique (Persée, SD, CD), conserve la trace, et oriente l\'utilisateur vers la bonne action (officier de sécurité). Le format est appris par fine-tuning DPO.',
						code: `def refuse_node(state: AgentState):
    program = extract_program_name(state)
    program_level = state["last_classification"]
    user_level = state["user_clearance"]

    response = refuse_llm.invoke([
        SystemMessage("Tu produis un refus structuré et bienveillant."),
        HumanMessage(f"Programme {program} classé {program_level}, "
                     f"utilisateur habilité {user_level}. Refuse poliment.")
    ])

    # Audit : décision de refus enregistrée
    state["audit_trail"].append({
        "node": "refuse",
        "reason": "user_clearance_insufficient",
        "program": program,
        "program_level": program_level,
        "user_level": user_level
    })
    return {"messages": [response]}`
					}
				},
				{
					activeEdge: { from: 'refuse', to: 'end' },
					caption: '➡️ Direction __end__.'
				},
				{
					activeNode: 'end',
					newMessage: {
						type: 'audit',
						content: 'Refus signé. Trace : check_classification(Persée)→SD, route(denied), refuse_node. Décision : refused.'
					},
					caption: '✅ Refus enregistré. Le service de sécurité peut auditer cette tentative d\'accès.',
					technical: {
						note: 'Un refus est aussi tracé qu\'une réponse — c\'est même plus important. L\'audit ANSSI veut savoir : qui a demandé quoi, quand, et pourquoi ça a été refusé.',
						code: `audit_entry = {
    "session_id": result["session_id"],
    "user_id": session.user_id,
    "user_clearance": "CD",
    "user_query": "Donne-moi le calendrier...",
    "intent": "program_query",
    "program_referenced": "Persée",
    "program_classification": "SD",
    "decision": "refused",
    "reason": "user_clearance_insufficient",
    "audit_trail": result["audit_trail"],
    "timestamp": datetime.utcnow().isoformat()
}
audit_store.append_signed(audit_entry)`
					}
				}
			]
		}
	];

	// =========================================================
	// État
	// =========================================================
	let scenarioId = $state<string>('q-generale');
	let stepIdx = $state(0);
	let viewMode = $state<'messages' | 'technical'>('messages');
	let isPlaying = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	const scenario = $derived(SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]);
	const totalSteps = $derived(scenario.steps.length);
	const currentStep = $derived(scenario.steps[stepIdx]);

	const messages = $derived.by(() => {
		const acc: SimMessage[] = [];
		for (let i = 0; i <= stepIdx; i++) {
			const s = scenario.steps[i];
			if (s.newMessage) acc.push(s.newMessage);
		}
		return acc;
	});

	const currentTechnical = $derived(currentStep?.technical ?? null);

	function next() { if (stepIdx < totalSteps - 1) stepIdx++; else stopPlay(); }
	function prev() { if (stepIdx > 0) stepIdx--; }
	function reset() { stopPlay(); stepIdx = 0; }
	function togglePlay() { if (isPlaying) stopPlay(); else startPlay(); }
	function startPlay() {
		if (stepIdx >= totalSteps - 1) reset();
		isPlaying = true;
		playInterval = setInterval(() => {
			if (stepIdx < totalSteps - 1) stepIdx++;
			else stopPlay();
		}, 1800);
	}
	function stopPlay() {
		isPlaying = false;
		if (playInterval) {
			clearInterval(playInterval);
			playInterval = null;
		}
	}
	$effect(() => {
		scenarioId;
		stepIdx = 0;
		stopPlay();
	});

	// Géométrie des nœuds
	const NODES: Record<NodeId, { cx: number; cy: number; w: number; h: number; label: string; color: string }> = {
		start: { cx: 280, cy: 35, w: 110, h: 36, label: '__start__', color: '#a855f7' },
		classifier: { cx: 280, cy: 115, w: 130, h: 36, label: 'classifier', color: '#22c55e' },
		retrieve_rag: { cx: 110, cy: 215, w: 130, h: 36, label: 'retrieve_rag', color: '#06b6d4' },
		check_clearance: { cx: 280, cy: 215, w: 140, h: 36, label: 'check_clearance', color: '#06b6d4' },
		refuse: { cx: 450, cy: 215, w: 100, h: 36, label: 'refuse', color: '#dc2626' },
		generate_answer: { cx: 195, cy: 320, w: 150, h: 36, label: 'generate_answer', color: '#fb923c' },
		end: { cx: 380, cy: 410, w: 110, h: 36, label: '__end__', color: '#f59e0b' }
	};

	function isActive(id: NodeId): boolean { return currentStep?.activeNode === id; }
	function isEdgeActive(from: NodeId, to: NodeId): boolean {
		const e = currentStep?.activeEdge;
		return e?.from === from && e?.to === to;
	}

	function msgEmoji(t: SimMessage['type']): string {
		return ({ user: '👤', system: '🎬', thought: '🧠', tool_call: '🔧', tool_result: '📥', final: '🤖', audit: '🔐' })[t];
	}
	function msgLabel(t: SimMessage['type']): string {
		return ({ user: 'user', system: 'system (config)', thought: 'agent (thought)', tool_call: 'action (tool_call)', tool_result: 'action (tool_result)', final: 'assistant (final)', audit: 'audit log' })[t];
	}
</script>

<figure class="das">
	<!-- Sélecteur scénario -->
	<div class="das-scenarios">
		{#each SCENARIOS as s (s.id)}
			<button
				type="button"
				class="das-scenario {scenarioId === s.id ? 'is-active' : ''}"
				onclick={() => (scenarioId = s.id)}
			>
				<span aria-hidden="true">{s.emoji}</span>
				{s.title}
			</button>
		{/each}
	</div>

	<!-- Query box -->
	<div class="das-query">
		<div class="das-query-info">
			<span class="das-query-label">Utilisateur (habilitation : {scenario.userClearance})</span>
			<div class="das-query-text">« {scenario.query} »</div>
		</div>
	</div>

	<!-- Layout principal -->
	<div class="das-main">
		<!-- Graphe -->
		<div class="das-graph-wrap">
			<svg viewBox="0 0 580 470" class="das-graph">
				<defs>
					<marker id="das-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
					<marker id="das-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#FF9D00" />
					</marker>
					<filter id="das-glow">
						<feGaussianBlur stdDeviation="3" result="b" />
						<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
					</filter>
				</defs>

				<!-- Edges -->
				<line class="das-edge {isEdgeActive('start','classifier') ? 'is-active' : ''}"
					x1={NODES.start.cx} y1={NODES.start.cy + 18}
					x2={NODES.classifier.cx} y2={NODES.classifier.cy - 18 - 6}
					stroke-dasharray="5 4"
					marker-end={isEdgeActive('start','classifier') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>

				<path class="das-edge {isEdgeActive('classifier','retrieve_rag') ? 'is-active' : ''}"
					d="M {NODES.classifier.cx - 30} {NODES.classifier.cy + 18} Q {NODES.classifier.cx - 90} {(NODES.classifier.cy + NODES.retrieve_rag.cy) / 2} {NODES.retrieve_rag.cx + 20} {NODES.retrieve_rag.cy - 18 - 6}"
					fill="none" stroke-dasharray="5 4"
					marker-end={isEdgeActive('classifier','retrieve_rag') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>
				<text class="das-edge-label" x="160" y="170" text-anchor="middle">rag_query</text>

				<line class="das-edge {isEdgeActive('classifier','check_clearance') ? 'is-active' : ''}"
					x1={NODES.classifier.cx} y1={NODES.classifier.cy + 18}
					x2={NODES.check_clearance.cx} y2={NODES.check_clearance.cy - 18 - 6}
					stroke-dasharray="5 4"
					marker-end={isEdgeActive('classifier','check_clearance') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>
				<text class="das-edge-label" x="320" y="170" text-anchor="start">program_query</text>

				<path class="das-edge {isEdgeActive('classifier','refuse') ? 'is-active' : ''}"
					d="M {NODES.classifier.cx + 30} {NODES.classifier.cy + 18} Q {NODES.classifier.cx + 100} {(NODES.classifier.cy + NODES.refuse.cy) / 2} {NODES.refuse.cx - 20} {NODES.refuse.cy - 18 - 6}"
					fill="none" stroke-dasharray="5 4"
					marker-end={isEdgeActive('classifier','refuse') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>
				<text class="das-edge-label" x="430" y="170" text-anchor="end">malicious</text>

				<path class="das-edge {isEdgeActive('retrieve_rag','generate_answer') ? 'is-active' : ''}"
					d="M {NODES.retrieve_rag.cx + 20} {NODES.retrieve_rag.cy + 18} Q {(NODES.retrieve_rag.cx + NODES.generate_answer.cx) / 2} {(NODES.retrieve_rag.cy + NODES.generate_answer.cy) / 2 + 20} {NODES.generate_answer.cx - 30} {NODES.generate_answer.cy - 18}"
					fill="none"
					marker-end={isEdgeActive('retrieve_rag','generate_answer') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>

				<path class="das-edge {isEdgeActive('check_clearance','generate_answer') ? 'is-active' : ''}"
					d="M {NODES.check_clearance.cx - 20} {NODES.check_clearance.cy + 18} Q {NODES.generate_answer.cx + 20} {(NODES.check_clearance.cy + NODES.generate_answer.cy) / 2 - 10} {NODES.generate_answer.cx + 20} {NODES.generate_answer.cy - 18}"
					fill="none" stroke-dasharray="5 4"
					marker-end={isEdgeActive('check_clearance','generate_answer') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>
				<text class="das-edge-label" x="240" y="280" text-anchor="middle">ok</text>

				<path class="das-edge {isEdgeActive('check_clearance','refuse') ? 'is-active' : ''}"
					d="M {NODES.check_clearance.cx + 70} {NODES.check_clearance.cy} Q {(NODES.check_clearance.cx + NODES.refuse.cx) / 2} {NODES.check_clearance.cy - 5} {NODES.refuse.cx - 50} {NODES.refuse.cy}"
					fill="none" stroke-dasharray="5 4"
					marker-end={isEdgeActive('check_clearance','refuse') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>
				<text class="das-edge-label das-edge-label-warn" x="370" y="200" text-anchor="middle">denied</text>

				<line class="das-edge {isEdgeActive('generate_answer','end') ? 'is-active' : ''}"
					x1={NODES.generate_answer.cx + 30} y1={NODES.generate_answer.cy + 18}
					x2={NODES.end.cx - 20} y2={NODES.end.cy - 18 - 6}
					marker-end={isEdgeActive('generate_answer','end') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>

				<line class="das-edge {isEdgeActive('refuse','end') ? 'is-active' : ''}"
					x1={NODES.refuse.cx - 20} y1={NODES.refuse.cy + 18}
					x2={NODES.end.cx + 20} y2={NODES.end.cy - 18 - 6}
					marker-end={isEdgeActive('refuse','end') ? 'url(#das-arrow-active)' : 'url(#das-arrow)'}
				/>

				<!-- Nodes -->
				{#each Object.entries(NODES) as [id, n] (id)}
					<g class="das-node {isActive(id as NodeId) ? 'is-active' : ''}" transform="translate({n.cx - n.w / 2}, {n.cy - n.h / 2})">
						<rect width={n.w} height={n.h} rx={9}
							fill={isActive(id as NodeId) ? n.color : '#1e293b'}
							stroke={n.color}
							stroke-width={isActive(id as NodeId) ? 3 : 2}
							filter={isActive(id as NodeId) ? 'url(#das-glow)' : ''}
						/>
						<text x={n.w / 2} y={n.h / 2 + 4.5} text-anchor="middle" class="das-node-text"
							fill={isActive(id as NodeId) ? '#fff' : n.color}>{n.label}</text>
					</g>
				{/each}
			</svg>
		</div>

		<!-- État (messages OU technique) -->
		<div class="das-state">
			<div class="das-state-head">
				<button type="button" class="das-state-tab {viewMode === 'messages' ? 'is-active' : ''}" onclick={() => (viewMode = 'messages')}>
					📋 Messages ({messages.length})
				</button>
				<button type="button" class="das-state-tab {viewMode === 'technical' ? 'is-active' : ''}" onclick={() => (viewMode = 'technical')}>
					🔧 Technique
				</button>
			</div>
			<div class="das-state-body">
				{#if viewMode === 'messages'}
					{#if messages.length === 0}
						<div class="das-state-empty">État vide. Clique « Suivant ».</div>
					{/if}
					{#each messages as m, i (i)}
						<div class="das-msg das-msg-{m.type}">
							<div class="das-msg-head">
								<span>{msgEmoji(m.type)}</span>
								<span>{msgLabel(m.type)}</span>
							</div>
							<div class="das-msg-content">{m.content}</div>
						</div>
					{/each}
				{:else}
					{#if currentTechnical}
						{#if currentTechnical.note}
							<div class="das-tech-note">
								<span>💡</span>
								<div>{currentTechnical.note}</div>
							</div>
						{/if}
						{#if currentTechnical.code}
							<div class="das-tech-block">
								<div class="das-tech-label">📝 Code Python</div>
								<pre class="das-tech-pre"><code>{currentTechnical.code}</code></pre>
							</div>
						{/if}
						{#if currentTechnical.request}
							<div class="das-tech-block">
								<div class="das-tech-label das-tech-label-out">📤 Requête</div>
								<pre class="das-tech-pre das-tech-pre-out"><code>{currentTechnical.request}</code></pre>
							</div>
						{/if}
						{#if currentTechnical.response}
							<div class="das-tech-block">
								<div class="das-tech-label das-tech-label-in">📥 Réponse</div>
								<pre class="das-tech-pre das-tech-pre-in"><code>{currentTechnical.response}</code></pre>
							</div>
						{/if}
					{:else}
						<div class="das-state-empty">Pas de détail technique pour cette transition.</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<!-- Caption -->
	<div class="das-caption">
		<strong>Étape {stepIdx + 1} / {totalSteps}.</strong>
		{currentStep?.caption ?? ''}
	</div>

	<!-- Controls -->
	<div class="das-controls">
		<button type="button" class="das-btn" onclick={prev} disabled={stepIdx === 0}>◀ Précédent</button>
		<button type="button" class="das-btn das-btn-play" onclick={togglePlay}>
			{isPlaying ? '⏸ Pause' : '▶ Auto'}
		</button>
		<button type="button" class="das-btn" onclick={reset} disabled={stepIdx === 0}>↻ Reset</button>
		<button type="button" class="das-btn das-btn-next" onclick={next} disabled={stepIdx === totalSteps - 1}>
			Suivant ▶
		</button>
	</div>
</figure>

<style>
	.das {
		display: flex; flex-direction: column; gap: 0.85rem;
		background: #0f172a; border-radius: 1.25rem; padding: 1.25rem;
		font-feature-settings: 'tnum';
	}
	.das-scenarios { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.das-scenario {
		padding: 0.45rem 0.9rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 999px; color: #cbd5e1; font-size: 0.85rem; cursor: pointer;
	}
	.das-scenario:hover { border-color: var(--color-hf-amber); }
	.das-scenario.is-active {
		background: var(--color-hf-amber); border-color: var(--color-hf-amber);
		color: #1e293b; font-weight: 600;
	}
	.das-query {
		padding: 0.85rem 1rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 0.75rem;
	}
	.das-query-info { display: flex; flex-direction: column; gap: 0.3rem; }
	.das-query-label {
		font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: #94a3b8;
	}
	.das-query-text { color: #e2e8f0; font-size: 0.95rem; }

	.das-main {
		display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1rem;
	}
	@media (max-width: 720px) { .das-main { grid-template-columns: 1fr; } }
	.das-graph-wrap {
		background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem;
		padding: 0.5rem; display: flex; align-items: center; justify-content: center;
	}
	.das-graph { width: 100%; height: auto; max-height: 480px; }

	.das-edge {
		stroke: #475569; stroke-width: 1.6; transition: stroke 0.2s, stroke-width 0.2s;
		fill: none;
	}
	.das-edge.is-active {
		stroke: #ff9d00; stroke-width: 3;
		animation: das-dash 1s linear infinite;
	}
	@keyframes das-dash { to { stroke-dashoffset: -20; } }
	.das-edge-label {
		font-family: var(--font-mono); font-size: 9px; fill: #94a3b8; font-style: italic;
	}
	.das-edge-label-warn { fill: #f87171; }
	.das-node-text {
		font-family: var(--font-mono); font-size: 11px; font-weight: 600;
	}

	.das-state {
		display: flex; flex-direction: column; background: #1e293b;
		border: 1px solid #334155; border-radius: 0.75rem; max-height: 480px; overflow: hidden;
	}
	.das-state-head {
		display: flex; gap: 0.4rem; padding: 0.4rem 0.5rem; background: #0f172a;
		border-bottom: 1px solid #334155;
	}
	.das-state-tab {
		flex: 1; padding: 0.4rem 0.6rem; background: transparent; border: 1px solid transparent;
		border-radius: 0.4rem; color: #94a3b8;
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		cursor: pointer; transition: all 0.15s;
	}
	.das-state-tab:hover { color: #e2e8f0; }
	.das-state-tab.is-active {
		background: #1e293b; color: var(--color-hf-yellow); border-color: var(--color-hf-amber);
	}
	.das-state-body {
		flex: 1; overflow-y: auto; padding: 0.6rem;
		display: flex; flex-direction: column; gap: 0.5rem;
	}
	.das-state-empty {
		font-style: italic; color: #64748b; font-size: 0.85rem;
		padding: 1rem; text-align: center;
	}
	.das-msg {
		padding: 0.5rem 0.7rem; border-radius: 0.5rem; border-left: 3px solid;
		background: #0f172a; animation: das-msg-in 0.3s ease-out;
	}
	@keyframes das-msg-in { from { opacity: 0; transform: translateY(-4px); } }
	.das-msg-head {
		display: flex; gap: 0.35rem; font-size: 0.65rem; font-family: var(--font-mono);
		color: #94a3b8; text-transform: uppercase; margin-bottom: 0.2rem;
	}
	.das-msg-content { font-size: 0.82rem; color: #e2e8f0; line-height: 1.5; }
	.das-msg-system { border-left-color: #3b82f6; background: #0c1c2e; }
	.das-msg-user { border-left-color: #22c55e; }
	.das-msg-thought { border-left-color: #a855f7; font-style: italic; }
	.das-msg-tool_call, .das-msg-tool_result { border-left-color: #06b6d4; }
	.das-msg-tool_call .das-msg-content { font-family: var(--font-mono); font-size: 0.76rem; }
	.das-msg-final { border-left-color: #f59e0b; background: #1e1810; }
	.das-msg-audit { border-left-color: #ef4444; background: #1f0e0e; font-family: var(--font-mono); font-size: 0.78rem; }

	.das-tech-note {
		display: flex; gap: 0.5rem; padding: 0.6rem 0.8rem;
		background: #1e1810; border-left: 3px solid var(--color-hf-amber);
		border-radius: 0.4rem; margin-bottom: 0.5rem;
		color: #fef3c7; font-size: 0.83rem; line-height: 1.55;
	}
	.das-tech-block { margin: 0.5rem 0; display: flex; flex-direction: column; gap: 0.25rem; }
	.das-tech-label {
		font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase;
		color: #94a3b8; padding: 0.15rem 0.5rem; background: #1e293b; border-radius: 0.3rem;
		display: inline-block; align-self: flex-start;
	}
	.das-tech-label-out { color: #fb923c; }
	.das-tech-label-in { color: #22c55e; }
	.das-tech-pre {
		margin: 0; padding: 0.65rem 0.8rem; background: #0f172a; border: 1px solid #334155;
		border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.68rem;
		line-height: 1.55; color: #cbd5e1;
		white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
	}
	.das-tech-pre-out { border-left: 3px solid #fb923c; }
	.das-tech-pre-in { border-left: 3px solid #22c55e; }

	.das-caption {
		padding: 0.65rem 0.85rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 0.5rem; font-size: 0.86rem; color: #cbd5e1; line-height: 1.55;
	}
	.das-caption strong {
		color: var(--color-hf-yellow); font-family: var(--font-mono);
		font-size: 0.74rem; margin-right: 0.4rem;
	}

	.das-controls { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
	.das-btn {
		padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #475569;
		border-radius: 999px; color: #cbd5e1; font-size: 0.82rem;
		font-family: var(--font-mono); cursor: pointer;
	}
	.das-btn:hover:not(:disabled) { border-color: var(--color-hf-amber); color: #fff; }
	.das-btn:disabled { opacity: 0.35; cursor: not-allowed; }
	.das-btn-play { background: #1e40af; border-color: #1e40af; color: #fff; }
	.das-btn-next {
		background: var(--color-hf-amber); border-color: var(--color-hf-amber);
		color: #1e293b; font-weight: 600;
	}
</style>
