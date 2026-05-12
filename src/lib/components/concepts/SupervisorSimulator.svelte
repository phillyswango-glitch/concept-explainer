<!--
	SupervisorSimulator.svelte
	==========================
	Simulateur interactif du pattern Multi-Agent Supervisor.

	Scénario : équipe rédactionnelle qui produit un article sur les LLM.
	  start → supervisor → researcher → supervisor → writer → supervisor
	         → reviewer → supervisor → END

	Le supervisor est un LLM qui choisit dynamiquement le prochain agent
	via structured output (Literal["researcher", "writer", "reviewer", "END"]).
-->
<script lang="ts">
	type NodeId = 'start' | 'supervisor' | 'researcher' | 'writer' | 'reviewer' | 'end';

	interface SimMessage {
		type: 'user' | 'thought' | 'agent_output' | 'final';
		agent?: 'supervisor' | 'researcher' | 'writer' | 'reviewer';
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
		decision?: 'researcher' | 'writer' | 'reviewer' | 'END' | null;
		caption: string;
		technical?: TechnicalDetail;
	}

	interface Scenario {
		id: string;
		title: string;
		emoji: string;
		query: string;
		steps: SimStep[];
	}

	const SCENARIOS: Scenario[] = [
		{
			id: 'article-llm',
			title: 'Article sur les LLM',
			emoji: '✍️',
			query: 'Écris-moi un court article (200 mots) sur ce que sont les LLM, pour un public débutant.',
			steps: [
				{
					activeNode: 'start',
					newMessage: { type: 'user', content: 'Écris-moi un court article (200 mots) sur ce que sont les LLM, pour un public débutant.' },
					caption: '🚪 Le user pose sa demande. Aucun agent n\'a encore travaillé.',
					technical: {
						note: 'L\'application invoque le graphe avec le message initial. C\'est l\'unique input externe — la suite est entièrement orchestrée par le supervisor.',
						code: `result = app.invoke({
    "messages": [HumanMessage(content="Écris-moi un court article (200 mots) sur ce que sont les LLM...")],
    "next": ""  # sera défini par le supervisor
})`
					}
				},
				{
					activeEdge: { from: 'start', to: 'supervisor' },
					caption: '➡️ La requête arrive au supervisor — le LLM-orchestrateur prend la main.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Pas encore de recherche faite. Pas de draft. Je commence par envoyer le researcher chercher des sources fiables.'
					},
					decision: 'researcher',
					caption: '🧠 Le supervisor analyse l\'état. Aucun agent n\'a travaillé → il faut commencer par la recherche.',
					technical: {
						note: 'Le supervisor utilise structured output pour forcer une réponse parmi 4 valeurs valides. Ça évite que le LLM réponde du free-text qu\'on devrait parser.',
						code: `from typing import Literal
from typing_extensions import TypedDict

class Route(TypedDict):
    next: Literal["researcher", "writer", "reviewer", "END"]

def supervisor_node(state: TeamState):
    response = supervisor_llm.with_structured_output(Route).invoke([
        SystemMessage(supervisor_prompt),
        *state["messages"]
    ])
    return {"next": response["next"]}`,
						request: `POST /v1/chat/completions
{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "system", "content": "Tu coordonnes une équipe : researcher, writer, reviewer. À chaque tour, choisis le prochain agent. END quand l'article est validé."},
    {"role": "user", "content": "Écris-moi un court article (200 mots) sur les LLM..."}
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "Route",
      "schema": {
        "type": "object",
        "properties": {
          "next": {"type": "string", "enum": ["researcher", "writer", "reviewer", "END"]}
        },
        "required": ["next"]
      }
    }
  }
}`,
						response: `{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "{\\"next\\": \\"researcher\\"}"
    }
  }]
}`
					}
				},
				{
					activeEdge: { from: 'supervisor', to: 'researcher' },
					caption: '🔀 Décision routée : direction researcher.'
				},
				{
					activeNode: 'researcher',
					newMessage: {
						type: 'agent_output',
						agent: 'researcher',
						content: '📚 Sources trouvées : (1) Vaswani 2017 "Attention is all you need" - architecture Transformer fondatrice. (2) Brown 2020 "GPT-3" - émergence des capacités few-shot. (3) HuggingFace blog "What is a LLM" - explications grand public. → Résumé : un LLM est un réseau de neurones (Transformer) entraîné à prédire le token suivant sur des trillions de tokens, qui finit par savoir répondre, traduire, raisonner.'
					},
					caption: '🔬 Le researcher exécute son mini-ReAct interne (search → summarize) et ajoute son résumé sourcé aux messages.',
					technical: {
						note: 'Chaque sous-agent peut être lui-même un mini-graphe LangGraph (ReAct par exemple). Le researcher a accès à des outils de recherche, fait plusieurs appels, puis renvoie son résumé.',
						code: `# researcher est lui-même un agent ReAct avec des tools
researcher_tools = [web_search, scholar_search, summarize]
researcher_agent = create_react_agent(researcher_llm, researcher_tools)

def researcher_node(state):
    response = researcher_agent.invoke({"messages": state["messages"]})
    # On préfixe le nom de l'agent pour le supervisor
    output = HumanMessage(
        content=response["messages"][-1].content,
        name="researcher"
    )
    return {"messages": [output]}`
					}
				},
				{
					activeEdge: { from: 'researcher', to: 'supervisor' },
					caption: '↩️ Researcher a fini → retour automatique au supervisor (arête simple, déterministe).'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'J\'ai des sources solides. Maintenant le writer peut rédiger un draft.'
					},
					decision: 'writer',
					caption: '🧠 Le supervisor relit l\'historique enrichi. Recherche faite → write !',
					technical: {
						response: `{
  "message": {
    "content": "{\\"next\\": \\"writer\\"}"
  }
}`,
						note: 'Le supervisor voit maintenant 2 messages : la query initiale + le résumé du researcher. Il déduit qu\'on a assez de matière pour rédiger.'
					}
				},
				{
					activeEdge: { from: 'supervisor', to: 'writer' },
					caption: '🔀 Direction writer.'
				},
				{
					activeNode: 'writer',
					newMessage: {
						type: 'agent_output',
						agent: 'writer',
						content: '📝 [Draft] "Les LLM, ou Large Language Models, sont des réseaux de neurones très grands entraînés à prédire le mot suivant dans une phrase. Présentés en 2017 avec l\'architecture Transformer (Vaswani et al.), ils ont explosé en 2020 avec GPT-3 (175 milliards de paramètres). Leur secret ? À force de prédire le mot suivant sur des trillions d\'exemples (livres, web), ils finissent par sembler comprendre. Ils peuvent traduire, résumer, écrire du code, raisonner. Mais attention : ils ne savent pas s\'ils ont raison. Ils produisent du texte plausible, pas forcément vrai. D\'où l\'importance de les utiliser comme un assistant, pas comme une source de vérité." (203 mots)'
					},
					caption: '✍️ Le writer rédige un premier draft à partir des sources fournies par researcher.',
					technical: {
						code: `def writer_node(state):
    response = writer_llm.invoke([
        SystemMessage("Tu rédiges des articles structurés et pédagogiques. Ton clair, accessible, exemples concrets."),
        *state["messages"]  # tout l'historique : query + recherche
    ])
    return {"messages": [HumanMessage(content=response.content, name="writer")]}`,
						note: 'Le writer voit la query + ce que researcher a apporté. Il rédige librement à partir de ça. Pas d\'outil — juste un LLM dédié à la rédaction.'
					}
				},
				{
					activeEdge: { from: 'writer', to: 'supervisor' },
					caption: '↩️ Draft prêt → retour supervisor.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'J\'ai un draft. Avant de finir, faisons valider par le reviewer.'
					},
					decision: 'reviewer',
					caption: '🧠 Le supervisor ne livre jamais sans review. Étape qualité avant END.'
				},
				{
					activeEdge: { from: 'supervisor', to: 'reviewer' },
					caption: '🔀 Direction reviewer.'
				},
				{
					activeNode: 'reviewer',
					newMessage: {
						type: 'agent_output',
						agent: 'reviewer',
						content: '✅ Review : structure claire, ton accessible, longueur respectée (203 mots ≈ 200). Sources de Vaswani citée correctement. Mention « D\'où l\'importance de les utiliser comme un assistant, pas comme une source de vérité » très pédagogique. → Validé. RAS.'
					},
					caption: '🔍 Le reviewer vérifie : structure, factualité, longueur, ton. Cas idéal — tout est bon.',
					technical: {
						code: `def reviewer_node(state):
    response = reviewer_llm.invoke([
        SystemMessage("Tu vérifies factualité, structure, ton. Si tout est bon, dis 'Validé.'. Sinon, liste les corrections à faire."),
        *state["messages"]
    ])
    return {"messages": [HumanMessage(content=response.content, name="reviewer")]}`,
						note: 'Si le reviewer avait trouvé des erreurs, son output aurait été une liste de corrections. Le supervisor au tour suivant aurait alors routé vers writer pour corriger — créant une boucle correction/relecture.'
					}
				},
				{
					activeEdge: { from: 'reviewer', to: 'supervisor' },
					caption: '↩️ Validé → retour supervisor.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Reviewer dit "Validé". Article prêt. Je sors du graphe.'
					},
					decision: 'END',
					caption: '🧠 Tout est bon — le supervisor décide de terminer.',
					technical: {
						response: `{
  "message": {
    "content": "{\\"next\\": \\"END\\"}"
  }
}`,
						note: 'Si le reviewer avait listé des corrections, le supervisor aurait choisi "writer" à la place de "END". C\'est cette boucle dynamique qui fait la puissance du pattern.'
					}
				},
				{
					activeEdge: { from: 'supervisor', to: 'end' },
					caption: '➡️ Direction __end__.'
				},
				{
					activeNode: 'end',
					newMessage: {
						type: 'final',
						content: 'Article validé livré. Le client reçoit le draft du writer (étape 9). 5 décisions de routage prises par le supervisor, sans qu\'on ait écrit UNE règle métier en dur.'
					},
					caption: '✅ Article livré. Le supervisor a orchestré l\'équipe en 5 décisions dynamiques.'
				}
			]
		},
		// ============================================================================
		// SCÉNARIO 2 — Boucle de correction : reviewer rejette → writer corrige → revu
		// ============================================================================
		{
			id: 'correction-loop',
			title: 'Boucle de correction',
			emoji: '🔁',
			query: 'Écris un court paragraphe pour expliquer le KV cache d\'un Transformer à un dev junior.',
			steps: [
				{
					activeNode: 'start',
					newMessage: { type: 'user', content: 'Écris un court paragraphe pour expliquer le KV cache d\'un Transformer à un dev junior.' },
					caption: '🚪 Sujet technique. Le supervisor va devoir s\'assurer de la justesse — d\'où la boucle de correction.',
					technical: {
						note: 'Même graphe que le scénario A. La différence : le reviewer va trouver une erreur et déclencher une seconde itération writer → reviewer.'
					}
				},
				{
					activeEdge: { from: 'start', to: 'supervisor' },
					caption: '➡️ Direction supervisor.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Sujet technique précis. Pas besoin de longue recherche — un writer compétent peut directement rédiger.'
					},
					decision: 'writer',
					caption: '🧠 Première décision : le supervisor saute le researcher (le LLM a déjà les notions en interne) et envoie directement au writer.',
					technical: {
						note: 'Note importante : le supervisor n\'appelle PAS systématiquement tous les agents. Il choisit le plus court chemin pour la tâche.',
						code: `# Le supervisor LLM voit la query courte + son system prompt.
# Pour un sujet bien connu (KV cache), pas besoin de researcher.
# Il route direct vers writer.`
					}
				},
				{
					activeEdge: { from: 'supervisor', to: 'writer' },
					caption: '🔀 Direction writer.'
				},
				{
					activeNode: 'writer',
					newMessage: {
						type: 'agent_output',
						agent: 'writer',
						content: '📝 [Draft v1] "Le KV cache est une optimisation des Transformers. À chaque pas de génération, le modèle calcule les matrices Q, K et V pour TOUS les tokens. C\'est coûteux. Le KV cache stocke Q, K et V des tokens précédents pour éviter de les recalculer."'
					},
					caption: '✍️ Draft v1 produit. À première vue ça a l\'air correct — mais il y a une erreur technique subtile.',
					technical: {
						note: 'Le writer s\'est trompé : il dit qu\'on cache Q, K, V — alors qu\'on cache UNIQUEMENT K et V (d\'où le nom KV cache). Q est recalculé à chaque fois. Erreur subtile mais critique.',
						code: `def writer_node(state):
    response = writer_llm.invoke([
        SystemMessage("Tu rédiges des paragraphes techniques clairs."),
        *state["messages"]
    ])
    return {"messages": [HumanMessage(content=response.content, name="writer")]}`
					}
				},
				{
					activeEdge: { from: 'writer', to: 'supervisor' },
					caption: '↩️ Retour supervisor avec le draft.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Le draft est court mais sur un sujet technique précis. Validation par reviewer obligatoire.'
					},
					decision: 'reviewer',
					caption: '🧠 Décision systématique : validation qualité avant END.'
				},
				{
					activeEdge: { from: 'supervisor', to: 'reviewer' },
					caption: '🔀 Direction reviewer.'
				},
				{
					activeNode: 'reviewer',
					newMessage: {
						type: 'agent_output',
						agent: 'reviewer',
						content: '❌ Review : ERREUR TECHNIQUE. Le paragraphe dit qu\'on cache Q, K et V. Faux. Le « KV cache » cache uniquement K et V (d\'où son nom). Q est recalculé à chaque pas de génération car il dépend du token courant. Demande de correction avant publication.'
					},
					caption: '🔍 Le reviewer détecte l\'erreur subtile. C\'est ÇA la valeur du pattern : un agent dédié à la qualité, séparé du writer.',
					technical: {
						note: 'Le reviewer a un system prompt focalisé sur la factualité ET un LLM différent (potentiellement plus rigoureux ou avec un RAG sur des sources techniques). C\'est cette spécialisation qui détecte ce que le writer manque.',
						code: `def reviewer_node(state):
    response = reviewer_llm.invoke([
        SystemMessage("Vérifie factualité, structure, ton. "
                      "Si erreur, liste précisément les corrections."),
        *state["messages"]
    ])
    return {"messages": [HumanMessage(content=response.content, name="reviewer")]}`
					}
				},
				{
					activeEdge: { from: 'reviewer', to: 'supervisor' },
					caption: '↩️ Retour supervisor avec une demande de correction.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Le reviewer a trouvé une erreur précise. Je dois renvoyer au writer avec le feedback, pour qu\'il corrige.'
					},
					decision: 'writer',
					caption: '🧠 ⭐ DÉCISION CLÉ — le supervisor ne route PAS vers END (le défaut), il renvoie au writer. C\'est la BOUCLE DE CORRECTION qui rend ce pattern puissant.',
					technical: {
						note: 'Sans cette boucle, le reviewer ne servirait à rien : ses commentaires seraient livrés tels quels au user. Avec la boucle, le writer voit le commentaire dans state["messages"] et peut corriger.',
						response: `{
  "message": {
    "content": "{\\"next\\": \\"writer\\"}"
  }
}`
					}
				},
				{
					activeEdge: { from: 'supervisor', to: 'writer' },
					caption: '🔀 RE-direction writer — deuxième passage. Le writer voit maintenant : query + son v1 + le commentaire du reviewer.'
				},
				{
					activeNode: 'writer',
					newMessage: {
						type: 'agent_output',
						agent: 'writer',
						content: '📝 [Draft v2 — corrigé] "Le KV cache est une optimisation des Transformers en inférence. À chaque pas de génération, le modèle doit calculer l\'attention sur TOUS les tokens précédents. Sans cache, on recalculerait les matrices K et V à chaque fois. Le KV cache les stocke en VRAM pour ne plus les recalculer — seul Q (qui dépend du token courant) est recalculé. Économie : O(N²) → O(N) sur la durée."'
					},
					caption: '✍️ Draft v2. Le writer a intégré la correction. Il a même ajouté un détail de complexité pour montrer qu\'il a compris le pourquoi.',
					technical: {
						note: 'Le writer voit dans state["messages"] : (1) la query, (2) son v1, (3) le commentaire du reviewer. Le LLM utilise tout ça pour produire v2. Pas de logique custom — juste les messages dans l\'historique.'
					}
				},
				{
					activeEdge: { from: 'writer', to: 'supervisor' },
					caption: '↩️ Retour supervisor avec v2.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Draft v2 reçu. Je re-soumets au reviewer pour validation.'
					},
					decision: 'reviewer',
					caption: '🧠 Pas de raccourci — re-validation par le reviewer. Pattern « toujours valider après une correction ».'
				},
				{
					activeEdge: { from: 'supervisor', to: 'reviewer' },
					caption: '🔀 Direction reviewer (2ᵉ passage).'
				},
				{
					activeNode: 'reviewer',
					newMessage: {
						type: 'agent_output',
						agent: 'reviewer',
						content: '✅ Review v2 : correction acceptée. K et V correctement identifiés. La précision sur O(N²) → O(N) est un bonus pédagogique pertinent. → Validé.'
					},
					caption: '🔍 Le reviewer valide v2. C\'est ce qu\'on cherchait.'
				},
				{
					activeEdge: { from: 'reviewer', to: 'supervisor' },
					caption: '↩️ Retour supervisor — validé.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Validé. Article prêt à livrer.'
					},
					decision: 'END',
					caption: '🧠 Le supervisor route vers END. Total : 7 décisions de routage, dont UNE boucle de correction. C\'est ça la dynamique du pattern.',
					technical: {
						note: 'Si on imaginait une 2e correction nécessaire, le supervisor recommencerait writer → reviewer indéfiniment. D\'où l\'importance d\'un compteur d\'itérations dans l\'état (max 3 corrections par exemple) pour éviter les boucles infinies.'
					}
				},
				{
					activeEdge: { from: 'supervisor', to: 'end' },
					caption: '➡️ Direction __end__.'
				},
				{
					activeNode: 'end',
					newMessage: {
						type: 'final',
						content: 'Paragraphe livré (v2). 7 décisions du supervisor au total, dont 1 boucle de correction qui a évité de publier une information FAUSSE sur le KV cache. C\'est exactement ce que le pattern apporte vs un agent monolithique.'
					},
					caption: '✅ Livré. Le pattern reviewer + boucle de correction a évité une erreur technique majeure.'
				}
			]
		},
		// ============================================================================
		// SCÉNARIO 3 — Cas défense : agent multi-rôle pour une note de synthèse
		// ============================================================================
		{
			id: 'defense-synthesis',
			title: 'Note de synthèse défense',
			emoji: '🛡️',
			query: 'Synthèse interne CD : avancement du programme Persée + risques techniques identifiés Q1 2026.',
			steps: [
				{
					activeNode: 'start',
					newMessage: { type: 'user', content: 'Synthèse interne CD : avancement du programme Persée + risques techniques identifiés Q1 2026.' },
					caption: '🚪 Demande d\'un officier habilité CD. Niveau de classification attendu pour la sortie : CD (pas SD). Les agents devront filtrer.'
				},
				{
					activeEdge: { from: 'start', to: 'supervisor' },
					caption: '➡️ Direction supervisor.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Synthèse → besoin de DONNÉES factuelles à jour. Le researcher doit aller chercher dans le RAG documentaire interne.'
					},
					decision: 'researcher',
					caption: '🧠 Sujet factuel et chiffré → researcher en premier. Le supervisor connaît les forces de chaque sous-agent.',
					technical: {
						note: 'Dans ce scénario, le researcher est un sous-agent RAG qui interroge un Qdrant filtré par classification ≤ CD.',
						code: `# Le researcher est un sous-agent RAG avec filtre habilitation
researcher_tools = [
    rag_search_documents,  # filtre clearance ≤ state["user_clearance"]
    fetch_program_status,
    fetch_risk_register,
]`
					}
				},
				{
					activeEdge: { from: 'supervisor', to: 'researcher' },
					caption: '🔀 Direction researcher.'
				},
				{
					activeNode: 'researcher',
					newMessage: {
						type: 'agent_output',
						agent: 'researcher',
						content: '📚 Sources Q1 2026 (filtré CD): (1) Rapport d\'avancement n°12 — phase CDR passée le 14/02/2026, validation HR-Conformité OK. (2) Registre risques v2.3 — 4 risques actifs niveau CD : intégration logicielle système d\'arme, contraintes thermiques sur le sous-système optronique, retard fournisseur SAFRAN sur le module 7, durcissement EMC en attente. ⚠️ 2 risques additionnels niveau SD non remontés (hors périmètre habilitation).'
					},
					caption: '🔬 Le researcher remonte les données accessibles à CD. Il SIGNALE explicitement les éléments qu\'il a filtrés — c\'est la transparence d\'audit.',
					technical: {
						note: 'Le filtre RAG est appliqué AU NIVEAU du store vectoriel (Qdrant payload filter). Aucun document SD n\'arrive jamais au LLM. Le researcher peut juste savoir qu\'il y en a (via un comptage), pas leur contenu.',
						code: `def researcher_node(state):
    # On passe l'habilitation au sous-agent pour qu'il filtre
    response = researcher_agent.invoke({
        "messages": state["messages"],
        "user_clearance": state["user_clearance"],  # "CD" ici
    })
    return {"messages": [HumanMessage(content=response, name="researcher")]}`
					}
				},
				{
					activeEdge: { from: 'researcher', to: 'supervisor' },
					caption: '↩️ Retour supervisor.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Données récoltées. Le writer peut maintenant produire la note de synthèse au format standard ANSSI.'
					},
					decision: 'writer',
					caption: '🧠 Direction writer pour la mise en forme.'
				},
				{
					activeEdge: { from: 'supervisor', to: 'writer' },
					caption: '🔀 Direction writer.'
				},
				{
					activeNode: 'writer',
					newMessage: {
						type: 'agent_output',
						agent: 'writer',
						content: '📝 [Note CD — Persée Q1 2026] **Avancement** : phase CDR validée 14/02. Conforme HR. **Risques actifs (4) niveau CD** : (1) intégration logicielle système d\'arme — mitigation en cours, (2) thermique optronique — campagne d\'essais Q2, (3) retard SAFRAN module 7 — escalade fournisseur, (4) durcissement EMC — en attente. **Mention** : 2 risques niveau SD existent (hors périmètre, voir officier SD).'
					},
					caption: '✍️ Note structurée. Le writer respecte le format ANSSI : titre + classification + faits chiffrés + mention des éléments hors-périmètre.',
					technical: {
						note: 'Le writer a un system prompt avec le template de note de synthèse défense. Le format est strict : tag de classification, sections fixes, mention obligatoire des éléments filtrés.'
					}
				},
				{
					activeEdge: { from: 'writer', to: 'supervisor' },
					caption: '↩️ Note prête, retour supervisor.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Avant livraison d\'un document classifié, le reviewer doit valider : (1) pas de fuite de données SD, (2) format respecté, (3) chiffres cohérents avec les sources.'
					},
					decision: 'reviewer',
					caption: '🧠 Étape qualité OBLIGATOIRE en défense — surtout sur un doc classifié.'
				},
				{
					activeEdge: { from: 'supervisor', to: 'reviewer' },
					caption: '🔀 Direction reviewer.'
				},
				{
					activeNode: 'reviewer',
					newMessage: {
						type: 'agent_output',
						agent: 'reviewer',
						content: '✅ Review : (1) Aucune fuite — la note mentionne l\'existence de 2 risques SD sans en révéler le contenu : conforme. (2) Format ANSSI respecté. (3) Chiffres cohérents avec sources researcher. → Validé pour publication CD.'
					},
					caption: '🔍 Le reviewer joue ici un rôle critique : valider qu\'aucune info SD ne fuite par induction. C\'est la 3ᵉ ligne de défense après le filtre RAG et le system prompt.',
					technical: {
						note: 'Le reviewer en contexte défense vérifie aussi des contraintes EXTRA : non-fuite de données plus hautement classifiées, mention explicite des éléments filtrés, traçabilité.',
						code: `reviewer_prompt = """Tu vérifies une note classifiée niveau {clearance}.
Contrôles obligatoires :
1. Aucune info > {clearance} ne doit transparaître, même par déduction.
2. Format ANSSI respecté (titre, classif, sections).
3. Chiffres cohérents avec les sources.
Si OK, dis « Validé ». Sinon, liste les problèmes."""`
					}
				},
				{
					activeEdge: { from: 'reviewer', to: 'supervisor' },
					caption: '↩️ Validation reçue.'
				},
				{
					activeNode: 'supervisor',
					newMessage: {
						type: 'thought',
						agent: 'supervisor',
						content: 'Note validée, conforme à l\'habilitation. Livraison.'
					},
					decision: 'END',
					caption: '🧠 Décision END. Le pattern a permis : recherche filtrée + rédaction structurée + double validation qualité/sécurité.'
				},
				{
					activeEdge: { from: 'supervisor', to: 'end' },
					caption: '➡️ Direction __end__.'
				},
				{
					activeNode: 'end',
					newMessage: {
						type: 'final',
						content: 'Note CD livrée. 3 agents spécialisés, 5 décisions du supervisor, conformité ANSSI préservée. C\'est la valeur d\'un pattern multi-agent en contexte sensible : chaque agent a un rôle clair, le supervisor orchestre, et la double validation (writer puis reviewer) blinde le résultat.'
					},
					caption: '✅ Note livrée — conforme CD, format ANSSI, audit complet possible.'
				}
			]
		}
	];

	// =========================================================
	// État
	// =========================================================
	let scenarioId = $state<string>('article-llm');
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
			if (scenario.steps[i].newMessage) acc.push(scenario.steps[i].newMessage!);
		}
		return acc;
	});

	const lastDecision = $derived.by(() => {
		for (let i = stepIdx; i >= 0; i--) {
			if (scenario.steps[i].decision !== undefined) return scenario.steps[i].decision;
		}
		return null;
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

	// Géométrie
	const NODES: Record<NodeId, { cx: number; cy: number; w: number; h: number; label: string; color: string }> = {
		start: { cx: 320, cy: 35, w: 100, h: 36, label: '__start__', color: '#a855f7' },
		supervisor: { cx: 320, cy: 130, w: 130, h: 40, label: 'supervisor', color: '#a855f7' },
		researcher: { cx: 110, cy: 250, w: 130, h: 40, label: 'researcher', color: '#06b6d4' },
		writer: { cx: 320, cy: 250, w: 100, h: 40, label: 'writer', color: '#fb923c' },
		reviewer: { cx: 530, cy: 250, w: 120, h: 40, label: 'reviewer', color: '#22c55e' },
		end: { cx: 320, cy: 380, w: 100, h: 36, label: '__end__', color: '#f59e0b' }
	};

	function isActive(id: NodeId): boolean { return currentStep?.activeNode === id; }
	function isEdgeActive(from: NodeId, to: NodeId): boolean {
		const e = currentStep?.activeEdge;
		return e?.from === from && e?.to === to;
	}

	function msgEmoji(t: SimMessage['type']): string {
		return ({ user: '👤', thought: '🧠', agent_output: '📝', final: '🤖' })[t];
	}
	function msgLabel(m: SimMessage): string {
		if (m.type === 'user') return 'user';
		if (m.type === 'final') return 'output final';
		if (m.agent) {
			const labels = { supervisor: 'supervisor (thought)', researcher: 'researcher (output)', writer: 'writer (draft)', reviewer: 'reviewer (review)' };
			return labels[m.agent];
		}
		return m.type;
	}

	function decisionColor(d: typeof lastDecision): string {
		if (d === 'researcher') return '#06b6d4';
		if (d === 'writer') return '#fb923c';
		if (d === 'reviewer') return '#22c55e';
		if (d === 'END') return '#f59e0b';
		return '#94a3b8';
	}
</script>

<figure class="sps">
	<!-- Sélecteur de scénario -->
	<div class="sps-scenarios">
		{#each SCENARIOS as s (s.id)}
			<button type="button" class="sps-scenario {scenarioId === s.id ? 'is-active' : ''}" onclick={() => (scenarioId = s.id)}>
				<span aria-hidden="true">{s.emoji}</span>
				{s.title}
			</button>
		{/each}
	</div>

	<!-- Query -->
	<div class="sps-query">
		<span class="sps-query-label">Demande utilisateur</span>
		<div class="sps-query-text">« {scenario.query} »</div>
	</div>

	<!-- Layout principal -->
	<div class="sps-main">
		<!-- Graphe -->
		<div class="sps-graph-wrap">
			<svg viewBox="0 0 660 430" class="sps-graph">
				<defs>
					<marker id="sps-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
					</marker>
					<marker id="sps-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#FF9D00" />
					</marker>
					<filter id="sps-glow">
						<feGaussianBlur stdDeviation="3" result="b" />
						<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
					</filter>
				</defs>

				<!-- start → supervisor -->
				<line class="sps-edge {isEdgeActive('start','supervisor') ? 'is-active' : ''}"
					x1={NODES.start.cx} y1={NODES.start.cy + 18}
					x2={NODES.supervisor.cx} y2={NODES.supervisor.cy - 20 - 6}
					marker-end={isEdgeActive('start','supervisor') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />

				<!-- supervisor → researcher (curve left, conditional, dashed) -->
				<path class="sps-edge {isEdgeActive('supervisor','researcher') ? 'is-active' : ''}"
					d="M {NODES.supervisor.cx - 30} {NODES.supervisor.cy + 20}
					   Q {NODES.supervisor.cx - 100} {(NODES.supervisor.cy + NODES.researcher.cy) / 2}
					     {NODES.researcher.cx + 30} {NODES.researcher.cy - 20 - 6}"
					fill="none" stroke-dasharray="5 4"
					marker-end={isEdgeActive('supervisor','researcher') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />
				<text class="sps-edge-label {lastDecision === 'researcher' ? 'is-active' : ''}"
					x={NODES.supervisor.cx - 100} y={(NODES.supervisor.cy + NODES.researcher.cy) / 2 + 5} text-anchor="middle">"researcher"</text>

				<!-- supervisor → writer (down center, dashed) -->
				<line class="sps-edge {isEdgeActive('supervisor','writer') ? 'is-active' : ''}"
					x1={NODES.supervisor.cx} y1={NODES.supervisor.cy + 20}
					x2={NODES.writer.cx} y2={NODES.writer.cy - 20 - 6}
					stroke-dasharray="5 4"
					marker-end={isEdgeActive('supervisor','writer') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />
				<text class="sps-edge-label {lastDecision === 'writer' ? 'is-active' : ''}"
					x={NODES.supervisor.cx + 50} y={(NODES.supervisor.cy + NODES.writer.cy) / 2 + 5}>"writer"</text>

				<!-- supervisor → reviewer (curve right, dashed) -->
				<path class="sps-edge {isEdgeActive('supervisor','reviewer') ? 'is-active' : ''}"
					d="M {NODES.supervisor.cx + 30} {NODES.supervisor.cy + 20}
					   Q {NODES.supervisor.cx + 110} {(NODES.supervisor.cy + NODES.reviewer.cy) / 2}
					     {NODES.reviewer.cx - 30} {NODES.reviewer.cy - 20 - 6}"
					fill="none" stroke-dasharray="5 4"
					marker-end={isEdgeActive('supervisor','reviewer') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />
				<text class="sps-edge-label {lastDecision === 'reviewer' ? 'is-active' : ''}"
					x={NODES.supervisor.cx + 110} y={(NODES.supervisor.cy + NODES.reviewer.cy) / 2 + 5} text-anchor="middle">"reviewer"</text>

				<!-- supervisor → end (dashed) -->
				<path class="sps-edge {isEdgeActive('supervisor','end') ? 'is-active' : ''}"
					d="M {NODES.supervisor.cx + 60} {NODES.supervisor.cy} Q {NODES.supervisor.cx + 200} {(NODES.supervisor.cy + NODES.end.cy) / 2 - 30} {NODES.end.cx + 50} {NODES.end.cy}"
					fill="none" stroke-dasharray="5 4"
					marker-end={isEdgeActive('supervisor','end') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />
				<text class="sps-edge-label {lastDecision === 'END' ? 'is-active' : ''}"
					x="540" y="180" text-anchor="middle">"END"</text>

				<!-- Retours vers supervisor (solides, déterministes) -->
				<path class="sps-edge sps-edge-back {isEdgeActive('researcher','supervisor') ? 'is-active' : ''}"
					d="M {NODES.researcher.cx + 50} {NODES.researcher.cy - 20}
					   Q {(NODES.researcher.cx + NODES.supervisor.cx) / 2 - 20} {NODES.supervisor.cy + 60}
					     {NODES.supervisor.cx - 60} {NODES.supervisor.cy + 20}"
					fill="none"
					marker-end={isEdgeActive('researcher','supervisor') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />

				<line class="sps-edge sps-edge-back {isEdgeActive('writer','supervisor') ? 'is-active' : ''}"
					x1={NODES.writer.cx + 30} y1={NODES.writer.cy - 20}
					x2={NODES.supervisor.cx + 30} y2={NODES.supervisor.cy + 20}
					marker-end={isEdgeActive('writer','supervisor') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />

				<path class="sps-edge sps-edge-back {isEdgeActive('reviewer','supervisor') ? 'is-active' : ''}"
					d="M {NODES.reviewer.cx - 50} {NODES.reviewer.cy - 20}
					   Q {(NODES.reviewer.cx + NODES.supervisor.cx) / 2 + 20} {NODES.supervisor.cy + 60}
					     {NODES.supervisor.cx + 60} {NODES.supervisor.cy + 20}"
					fill="none"
					marker-end={isEdgeActive('reviewer','supervisor') ? 'url(#sps-arrow-active)' : 'url(#sps-arrow)'} />

				<!-- Nodes -->
				{#each Object.entries(NODES) as [id, n] (id)}
					<g class="sps-node {isActive(id as NodeId) ? 'is-active' : ''}" transform="translate({n.cx - n.w / 2}, {n.cy - n.h / 2})">
						<rect width={n.w} height={n.h} rx={9}
							fill={isActive(id as NodeId) ? n.color : '#1e293b'}
							stroke={n.color} stroke-width={isActive(id as NodeId) ? 3 : 2}
							filter={isActive(id as NodeId) ? 'url(#sps-glow)' : ''} />
						<text x={n.w / 2} y={n.h / 2 + 5} text-anchor="middle" class="sps-node-text"
							fill={isActive(id as NodeId) ? '#fff' : n.color}>{n.label}</text>
					</g>
				{/each}

				<!-- Decision badge -->
				{#if lastDecision && (currentStep?.activeNode === 'supervisor' || currentStep?.activeEdge?.from === 'supervisor')}
					<g transform="translate({NODES.supervisor.cx + 80}, {NODES.supervisor.cy - 30})">
						<rect width="100" height="22" rx="11" fill={decisionColor(lastDecision)} />
						<text x="50" y="15" text-anchor="middle" font-family="monospace" font-size="11" fill="#fff" font-weight="700">
							→ "{lastDecision}"
						</text>
					</g>
				{/if}
			</svg>
		</div>

		<!-- État -->
		<div class="sps-state">
			<div class="sps-state-head">
				<button type="button" class="sps-state-tab {viewMode === 'messages' ? 'is-active' : ''}" onclick={() => (viewMode = 'messages')}>
					📋 Messages ({messages.length})
				</button>
				<button type="button" class="sps-state-tab {viewMode === 'technical' ? 'is-active' : ''}" onclick={() => (viewMode = 'technical')}>
					🔧 Technique
				</button>
			</div>
			<div class="sps-state-body">
				{#if viewMode === 'messages'}
					{#if messages.length === 0}
						<div class="sps-state-empty">État vide. Clique « Suivant ».</div>
					{/if}
					{#each messages as m, i (i)}
						<div class="sps-msg sps-msg-{m.type} sps-msg-{m.agent ?? 'none'}">
							<div class="sps-msg-head">
								<span>{msgEmoji(m.type)}</span>
								<span>{msgLabel(m)}</span>
							</div>
							<div class="sps-msg-content">{m.content}</div>
						</div>
					{/each}
				{:else}
					{#if currentTechnical}
						{#if currentTechnical.note}
							<div class="sps-tech-note"><span>💡</span><div>{currentTechnical.note}</div></div>
						{/if}
						{#if currentTechnical.code}
							<div class="sps-tech-block">
								<div class="sps-tech-label">📝 Code Python</div>
								<pre class="sps-tech-pre"><code>{currentTechnical.code}</code></pre>
							</div>
						{/if}
						{#if currentTechnical.request}
							<div class="sps-tech-block">
								<div class="sps-tech-label sps-tech-label-out">📤 Requête</div>
								<pre class="sps-tech-pre sps-tech-pre-out"><code>{currentTechnical.request}</code></pre>
							</div>
						{/if}
						{#if currentTechnical.response}
							<div class="sps-tech-block">
								<div class="sps-tech-label sps-tech-label-in">📥 Réponse</div>
								<pre class="sps-tech-pre sps-tech-pre-in"><code>{currentTechnical.response}</code></pre>
							</div>
						{/if}
					{:else}
						<div class="sps-state-empty">Pas de détail technique pour cette étape.</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<!-- Caption -->
	<div class="sps-caption">
		<strong>Étape {stepIdx + 1} / {totalSteps}.</strong>
		{currentStep?.caption ?? ''}
	</div>

	<!-- Controls -->
	<div class="sps-controls">
		<button type="button" class="sps-btn" onclick={prev} disabled={stepIdx === 0}>◀ Précédent</button>
		<button type="button" class="sps-btn sps-btn-play" onclick={togglePlay}>
			{isPlaying ? '⏸ Pause' : '▶ Auto'}
		</button>
		<button type="button" class="sps-btn" onclick={reset} disabled={stepIdx === 0}>↻ Reset</button>
		<button type="button" class="sps-btn sps-btn-next" onclick={next} disabled={stepIdx === totalSteps - 1}>Suivant ▶</button>
	</div>
</figure>

<style>
	.sps {
		display: flex; flex-direction: column; gap: 0.85rem;
		background: #0f172a; border-radius: 1.25rem; padding: 1.25rem;
	}
	.sps-scenarios { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.sps-scenario {
		padding: 0.45rem 0.9rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 999px; color: #cbd5e1; font-size: 0.85rem; cursor: pointer;
	}
	.sps-scenario.is-active {
		background: #a855f7; border-color: #a855f7; color: #fff; font-weight: 600;
	}
	.sps-query {
		padding: 0.85rem 1rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 0.75rem;
	}
	.sps-query-label {
		font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: #94a3b8;
	}
	.sps-query-text { color: #e2e8f0; font-size: 0.95rem; margin-top: 0.3rem; }

	.sps-main { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 1rem; }
	@media (max-width: 720px) { .sps-main { grid-template-columns: 1fr; } }

	.sps-graph-wrap {
		background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem;
		padding: 0.5rem; display: flex; align-items: center; justify-content: center;
	}
	.sps-graph { width: 100%; height: auto; max-height: 460px; }
	.sps-edge {
		stroke: #475569; stroke-width: 1.6; fill: none;
		transition: stroke 0.2s, stroke-width 0.2s;
	}
	.sps-edge.is-active {
		stroke: #ff9d00; stroke-width: 3;
		animation: sps-dash 1s linear infinite;
	}
	.sps-edge-back { stroke: #06b6d4; }
	.sps-edge-back.is-active { stroke: #ff9d00; }
	@keyframes sps-dash { to { stroke-dashoffset: -20; } }
	.sps-edge-label {
		font-family: var(--font-mono); font-size: 10px; fill: #94a3b8; font-style: italic;
		transition: fill 0.2s;
	}
	.sps-edge-label.is-active { fill: #ff9d00; font-weight: 700; }
	.sps-node-text { font-family: var(--font-mono); font-size: 12px; font-weight: 600; }

	.sps-state {
		display: flex; flex-direction: column; background: #1e293b;
		border: 1px solid #334155; border-radius: 0.75rem;
		max-height: 460px; overflow: hidden;
	}
	.sps-state-head {
		display: flex; gap: 0.4rem; padding: 0.4rem 0.5rem;
		background: #0f172a; border-bottom: 1px solid #334155;
	}
	.sps-state-tab {
		flex: 1; padding: 0.4rem 0.6rem; background: transparent;
		border: 1px solid transparent; border-radius: 0.4rem; color: #94a3b8;
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		cursor: pointer;
	}
	.sps-state-tab.is-active {
		background: #1e293b; color: var(--color-hf-yellow); border-color: var(--color-hf-amber);
	}
	.sps-state-body {
		flex: 1; overflow-y: auto; padding: 0.6rem;
		display: flex; flex-direction: column; gap: 0.5rem;
	}
	.sps-state-empty { font-style: italic; color: #64748b; padding: 1rem; text-align: center; font-size: 0.85rem; }
	.sps-msg {
		padding: 0.55rem 0.7rem; border-radius: 0.5rem; border-left: 3px solid;
		background: #0f172a; animation: sps-msg-in 0.3s ease-out;
	}
	@keyframes sps-msg-in { from { opacity: 0; transform: translateY(-4px); } }
	.sps-msg-head {
		display: flex; gap: 0.35rem; font-size: 0.65rem; font-family: var(--font-mono);
		color: #94a3b8; text-transform: uppercase; margin-bottom: 0.25rem;
	}
	.sps-msg-content { font-size: 0.83rem; color: #e2e8f0; line-height: 1.5; }
	.sps-msg-user { border-left-color: #22c55e; }
	.sps-msg-supervisor { border-left-color: #a855f7; font-style: italic; background: #1a1130; }
	.sps-msg-researcher { border-left-color: #06b6d4; }
	.sps-msg-writer { border-left-color: #fb923c; }
	.sps-msg-reviewer { border-left-color: #22c55e; }
	.sps-msg-final { border-left-color: #f59e0b; background: #1e1810; }

	.sps-tech-note {
		display: flex; gap: 0.5rem; padding: 0.6rem 0.8rem;
		background: #1e1810; border-left: 3px solid var(--color-hf-amber);
		border-radius: 0.4rem; margin-bottom: 0.5rem;
		color: #fef3c7; font-size: 0.83rem; line-height: 1.55;
	}
	.sps-tech-block { margin: 0.5rem 0; display: flex; flex-direction: column; gap: 0.25rem; }
	.sps-tech-label {
		font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase;
		color: #94a3b8; padding: 0.15rem 0.5rem; background: #1e293b; border-radius: 0.3rem;
		display: inline-block; align-self: flex-start;
	}
	.sps-tech-label-out { color: #fb923c; }
	.sps-tech-label-in { color: #22c55e; }
	.sps-tech-pre {
		margin: 0; padding: 0.65rem 0.8rem; background: #0f172a; border: 1px solid #334155;
		border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.68rem;
		line-height: 1.55; color: #cbd5e1;
		white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
	}
	.sps-tech-pre-out { border-left: 3px solid #fb923c; }
	.sps-tech-pre-in { border-left: 3px solid #22c55e; }

	.sps-caption {
		padding: 0.65rem 0.85rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 0.5rem; font-size: 0.86rem; color: #cbd5e1; line-height: 1.55;
	}
	.sps-caption strong {
		color: var(--color-hf-yellow); font-family: var(--font-mono);
		font-size: 0.74rem; margin-right: 0.4rem;
	}
	.sps-controls { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
	.sps-btn {
		padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #475569;
		border-radius: 999px; color: #cbd5e1; font-size: 0.82rem;
		font-family: var(--font-mono); cursor: pointer;
	}
	.sps-btn:disabled { opacity: 0.35; cursor: not-allowed; }
	.sps-btn-play { background: #a855f7; border-color: #a855f7; color: #fff; }
	.sps-btn-next {
		background: var(--color-hf-amber); border-color: var(--color-hf-amber);
		color: #1e293b; font-weight: 600;
	}
</style>
