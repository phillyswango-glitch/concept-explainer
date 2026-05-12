<!--
	SequentialToolsSimulator.svelte
	================================
	Simulateur d'appels de tools séquentiels avec data binding visible.

	Le scénario montre comment l'output d'un tool devient l'argument du tool
	suivant. Une "ledger" tracke les variables produites, et les bindings
	sont mis en évidence dans les args du tool call.

	2 scénarios défense :
	  A) Happy path — Cdt Martin (SD) demande Persée → 5 tools → réponse OK
	  B) Refusal mid-chain — Lt Durand (CD) demande Persée → chain stoppe à
	     l'étape 3 (classification > habilitation)
-->
<script lang="ts">
	type StepKind =
		| 'user_query'
		| 'llm_thought'
		| 'tool_call'
		| 'tool_response'
		| 'short_circuit'
		| 'final_answer';

	interface ToolCallData {
		name: string;
		args: Record<string, { value: string; binding?: string }>; // binding = nom de la variable de la ledger
	}

	interface ToolResponseData {
		json: Record<string, unknown>;
		ledgerUpdates: Array<{ key: string; value: string; from: string }>; // ce qu'on ajoute à la ledger
		status: 'success' | 'denied';
	}

	interface SimStep {
		kind: StepKind;
		toolSlot?: number; // 0..4, la position du tool dans la pipeline
		content?: string;
		toolCall?: ToolCallData;
		toolResponse?: ToolResponseData;
		caption: string;
	}

	interface ToolDef {
		slot: number;
		name: string;
		emoji: string;
		color: string;
		purpose: string;
	}

	interface Scenario {
		id: string;
		title: string;
		emoji: string;
		query: string;
		summary: string;
		tools: ToolDef[];
		steps: SimStep[];
	}

	// =================================================================
	// SCÉNARIO A — Chaîne complète, accès accordé
	// =================================================================
	const SCENARIO_A: Scenario = {
		id: 'martin-accepte',
		title: 'Cdt Martin (SD) → Persée',
		emoji: '✅',
		query: 'Le commandant Martin (DGA) a-t-il accès au calendrier du programme Persée ? Si oui, donne-moi les dates clés.',
		summary: '5 appels de tools en cascade, chaque sortie alimente le suivant. Accès accordé, planning livré.',
		tools: [
			{ slot: 0, name: 'search_employee', emoji: '🔍', color: '#06b6d4', purpose: 'Identifier l\'employé par nom + grade → retourne son ID + service.' },
			{ slot: 1, name: 'get_clearance_level', emoji: '🛡️', color: '#a855f7', purpose: 'À partir d\'un ID employé, retourne son niveau d\'habilitation (NP/DR/CD/SD/TSD).' },
			{ slot: 2, name: 'get_program_classification', emoji: '🏷️', color: '#f59e0b', purpose: 'Donne le niveau de classification d\'un programme (NP/DR/CD/SD/TSD).' },
			{ slot: 3, name: 'check_need_to_know', emoji: '✅', color: '#22c55e', purpose: 'Vérifie si l\'employé a un besoin d\'en connaître sur ce programme (service, mission).' },
			{ slot: 4, name: 'fetch_delivery_schedule', emoji: '📅', color: '#ec4899', purpose: 'Récupère le calendrier de livraison d\'un programme (date de gates).' }
		],
		steps: [
			// ====== Step 1 : user query ======
			{
				kind: 'user_query',
				content: 'Le commandant Martin (DGA) a-t-il accès au calendrier du programme Persée ? Si oui, donne-moi les dates clés.',
				caption: '👤 Le user pose une question qui demande de croiser PLUSIEURS sources : l\'employé, son habilitation, la classification du programme, le besoin d\'en connaître, puis la donnée finale. L\'agent va devoir enchaîner 5 tools.'
			},
			// ====== Step 2 : LLM thinks → search_employee ======
			{
				kind: 'llm_thought',
				toolSlot: 0,
				content: 'Je dois d\'abord identifier précisément l\'employé. « Cdt Martin » et « DGA » me suffisent pour interroger l\'annuaire.',
				caption: '🧠 L\'agent raisonne. Avant tout, il faut un identifiant employé canonique. Le nom + grade + service n\'est pas un identifiant — il faut l\'API annuaire.'
			},
			{
				kind: 'tool_call',
				toolSlot: 0,
				toolCall: {
					name: 'search_employee',
					args: {
						last_name: { value: '"Martin"' },
						rank: { value: '"Cdt"' },
						service: { value: '"DGA"' }
					}
				},
				caption: '🔧 Premier tool call. Aucun argument ne dépend d\'un tool précédent (c\'est le premier). Les valeurs viennent directement de la question utilisateur.'
			},
			{
				kind: 'tool_response',
				toolSlot: 0,
				toolResponse: {
					json: { id: 'EMP-7821', full_name: 'Cdt Antoine Martin', service: 'DGA', branch: 'Armement terrestre' },
					ledgerUpdates: [
						{ key: 'employee_id', value: 'EMP-7821', from: 'search_employee.id' },
						{ key: 'employee_service', value: 'DGA', from: 'search_employee.service' }
					],
					status: 'success'
				},
				caption: '📥 Réponse de l\'annuaire. L\'agent extrait l\'ID `EMP-7821` et le service `DGA`. Ces deux valeurs sont stockées dans la « ledger » — c\'est le pool de variables que les tools suivants peuvent réutiliser.'
			},
			// ====== Step 3 : get_clearance_level ======
			{
				kind: 'llm_thought',
				toolSlot: 1,
				content: 'J\'ai EMP-7821. Maintenant je dois connaître son habilitation pour comparer au niveau du programme.',
				caption: '🧠 L\'agent passe à l\'étape 2 : son habilitation. Il sait qu\'il doit fournir un employee_id, et il l\'a obtenu à l\'étape précédente.'
			},
			{
				kind: 'tool_call',
				toolSlot: 1,
				toolCall: {
					name: 'get_clearance_level',
					args: {
						employee_id: { value: '"EMP-7821"', binding: 'employee_id' }
					}
				},
				caption: '🔧 Deuxième tool call. ⚠️ L\'argument `employee_id` est BINDÉ à la ledger : sa valeur vient de la réponse du tool précédent. C\'est ça, l\'enchaînement séquentiel — l\'output d\'un tool devient l\'input du suivant.'
			},
			{
				kind: 'tool_response',
				toolSlot: 1,
				toolResponse: {
					json: { level: 'SD', valid_until: '2027-03-15', renewal_status: 'OK' },
					ledgerUpdates: [
						{ key: 'employee_clearance', value: 'SD', from: 'get_clearance_level.level' }
					],
					status: 'success'
				},
				caption: '📥 Niveau d\'habilitation : SD (Secret Défense). Stocké dans la ledger sous `employee_clearance`. L\'agent n\'a pas encore assez d\'info pour répondre — il faut savoir à quoi comparer ce SD.'
			},
			// ====== Step 4 : get_program_classification ======
			{
				kind: 'llm_thought',
				toolSlot: 2,
				content: 'OK, il a SD. Maintenant : quel est le niveau de classification du programme Persée ? Si Persée est CD ou DR, il a déjà accès. Si Persée est TSD, il n\'aura pas accès.',
				caption: '🧠 L\'agent fait du vrai raisonnement comparatif. Il anticipe les cas possibles. Cet appel n\'est pas paramétré par une sortie précédente — le nom du programme vient de la question initiale.'
			},
			{
				kind: 'tool_call',
				toolSlot: 2,
				toolCall: {
					name: 'get_program_classification',
					args: {
						program_name: { value: '"Persée"' }
					}
				},
				caption: '🔧 Troisième tool call. L\'argument vient encore de la question initiale, pas d\'un tool précédent — tous les bindings ne sont pas obligatoires.'
			},
			{
				kind: 'tool_response',
				toolSlot: 2,
				toolResponse: {
					json: { name: 'Persée', classification: 'SD', type: 'armement', owner: 'DGA' },
					ledgerUpdates: [
						{ key: 'program_classification', value: 'SD', from: 'get_program_classification.classification' },
						{ key: 'program_owner', value: 'DGA', from: 'get_program_classification.owner' }
					],
					status: 'success'
				},
				caption: '📥 Persée est SD. L\'agent compare : employee_clearance = SD, program_classification = SD → habilitation suffisante. MAIS l\'habilitation ne suffit pas en classifié — il faut aussi le « besoin d\'en connaître ».'
			},
			// ====== Step 5 : check_need_to_know ======
			{
				kind: 'llm_thought',
				toolSlot: 3,
				content: 'L\'habilitation matche. Il me reste à vérifier le besoin d\'en connaître — c\'est obligatoire en classifié. Heureusement, l\'employé et le programme appartiennent tous les deux à la DGA.',
				caption: '🧠 Étape métier : la règle « besoin d\'en connaître » est un classique de la défense. Avoir l\'habilitation ne suffit pas à accéder à un document — il faut aussi prouver qu\'on en a besoin pour sa mission.'
			},
			{
				kind: 'tool_call',
				toolSlot: 3,
				toolCall: {
					name: 'check_need_to_know',
					args: {
						employee_id: { value: '"EMP-7821"', binding: 'employee_id' },
						program_name: { value: '"Persée"' }
					}
				},
				caption: '🔧 Quatrième tool call. L\'`employee_id` est BINDÉ à la ledger (output du tool 1), `program_name` vient de la query. On combine sources.'
			},
			{
				kind: 'tool_response',
				toolSlot: 3,
				toolResponse: {
					json: { authorized: true, reason: 'Service DGA propriétaire du programme Persée', expires: '2026-12-31' },
					ledgerUpdates: [
						{ key: 'access_authorized', value: 'true', from: 'check_need_to_know.authorized' }
					],
					status: 'success'
				},
				caption: '📥 Accès autorisé ! La règle métier dit : DGA possède Persée → tout employé DGA a besoin d\'en connaître. L\'agent peut maintenant aller chercher la vraie donnée demandée.'
			},
			// ====== Step 6 : fetch_delivery_schedule ======
			{
				kind: 'llm_thought',
				toolSlot: 4,
				content: 'Tous les feux sont au vert : habilitation suffisante + besoin d\'en connaître validé. Je peux maintenant fetch la donnée demandée — le calendrier de Persée.',
				caption: '🧠 Le contrôle d\'accès est terminé. L\'agent ne va appeler le tool « sensible » (fetch_delivery_schedule) qu\'après avoir validé l\'autorisation. C\'est un pattern de SÉCURITÉ critique en défense.'
			},
			{
				kind: 'tool_call',
				toolSlot: 4,
				toolCall: {
					name: 'fetch_delivery_schedule',
					args: {
						program_name: { value: '"Persée"' }
					}
				},
				caption: '🔧 Cinquième et dernier tool call. C\'est celui qui ramène la donnée vraiment demandée — mais on n\'a pu y arriver que parce que les 4 précédents ont validé l\'accès.'
			},
			{
				kind: 'tool_response',
				toolSlot: 4,
				toolResponse: {
					json: {
						program: 'Persée',
						phases: [
							{ name: 'PDR', date: '2026-Q1' },
							{ name: 'CDR', date: '2026-Q3' },
							{ name: 'Prototype 1', date: '2027-Q2' },
							{ name: 'TRR', date: '2028-Q1' },
							{ name: 'Production série', date: '2028-Q4' }
						]
					},
					ledgerUpdates: [
						{ key: 'schedule', value: '[5 phases]', from: 'fetch_delivery_schedule.phases' }
					],
					status: 'success'
				},
				caption: '📥 Le calendrier est récupéré. L\'agent a maintenant TOUT ce qu\'il faut : identité validée + habilitation + besoin d\'en connaître + donnée. Il peut synthétiser la réponse finale.'
			},
			// ====== Step 7 : final answer ======
			{
				kind: 'final_answer',
				content: '« Oui Cdt Martin, votre habilitation SD et votre service DGA vous autorisent à accéder au calendrier du programme Persée. Voici les gates : PDR Q1 2026, CDR Q3 2026, Prototype #1 Q2 2027, TRR Q1 2028, Production série Q4 2028. Source : référentiel programmatique DGA. »',
				caption: '🤖 Réponse finale synthétisée. L\'agent a fait 5 appels de tools, dont 2 avec data binding (employee_id réutilisé). Sans cet enchaînement, l\'agent aurait soit halluciné, soit livré sans contrôle d\'accès.'
			}
		]
	};

	// =================================================================
	// SCÉNARIO B — Chain court-circuitée
	// =================================================================
	const SCENARIO_B: Scenario = {
		id: 'durand-refus',
		title: 'Lt Durand (CD) → Persée',
		emoji: '🛑',
		query: 'Le lieutenant Durand (Logistique) a-t-il accès au calendrier du programme Persée ?',
		summary: 'Chain court-circuitée à l\'étape 3 : habilitation CD < classification SD du programme → refus immédiat. On n\'appelle JAMAIS les tools 4 et 5.',
		tools: [
			{ slot: 0, name: 'search_employee', emoji: '🔍', color: '#06b6d4', purpose: 'Identifier l\'employé.' },
			{ slot: 1, name: 'get_clearance_level', emoji: '🛡️', color: '#a855f7', purpose: 'Habilitation du demandeur.' },
			{ slot: 2, name: 'get_program_classification', emoji: '🏷️', color: '#f59e0b', purpose: 'Classification du programme.' },
			{ slot: 3, name: 'check_need_to_know', emoji: '✅', color: '#22c55e', purpose: 'Besoin d\'en connaître (NON APPELÉ ici).' },
			{ slot: 4, name: 'fetch_delivery_schedule', emoji: '📅', color: '#ec4899', purpose: 'Donnée finale (NON APPELÉ ici).' }
		],
		steps: [
			{
				kind: 'user_query',
				content: 'Le lieutenant Durand (Logistique) a-t-il accès au calendrier du programme Persée ?',
				caption: '👤 Même question, autre profil. Lt Durand est en Logistique (pas DGA) et son habilitation est CD (pas SD).'
			},
			// search_employee
			{
				kind: 'llm_thought',
				toolSlot: 0,
				content: 'Pareil que tout à l\'heure : j\'identifie d\'abord.',
				caption: '🧠 L\'agent commence par identifier l\'employé.'
			},
			{
				kind: 'tool_call',
				toolSlot: 0,
				toolCall: {
					name: 'search_employee',
					args: {
						last_name: { value: '"Durand"' },
						rank: { value: '"Lt"' },
						service: { value: '"Logistique"' }
					}
				},
				caption: '🔧 Identique au scénario A, mais avec d\'autres valeurs.'
			},
			{
				kind: 'tool_response',
				toolSlot: 0,
				toolResponse: {
					json: { id: 'EMP-3421', full_name: 'Lt Sophie Durand', service: 'Logistique', branch: 'Approvisionnement' },
					ledgerUpdates: [
						{ key: 'employee_id', value: 'EMP-3421', from: 'search_employee.id' },
						{ key: 'employee_service', value: 'Logistique', from: 'search_employee.service' }
					],
					status: 'success'
				},
				caption: '📥 Lt Sophie Durand, EMP-3421, service Logistique. Ledger mise à jour.'
			},
			// get_clearance_level
			{
				kind: 'llm_thought',
				toolSlot: 1,
				content: 'Maintenant son habilitation.',
				caption: '🧠 Suite normale du flow : on vérifie l\'habilitation.'
			},
			{
				kind: 'tool_call',
				toolSlot: 1,
				toolCall: {
					name: 'get_clearance_level',
					args: {
						employee_id: { value: '"EMP-3421"', binding: 'employee_id' }
					}
				},
				caption: '🔧 Binding sur `employee_id` (ledger). Argument calculé dynamiquement à partir du tool précédent.'
			},
			{
				kind: 'tool_response',
				toolSlot: 1,
				toolResponse: {
					json: { level: 'CD', valid_until: '2026-09-30', renewal_status: 'OK' },
					ledgerUpdates: [
						{ key: 'employee_clearance', value: 'CD', from: 'get_clearance_level.level' }
					],
					status: 'success'
				},
				caption: '📥 Habilitation : CD (Confidentiel Défense). L\'agent ne sait pas encore si c\'est suffisant — il lui faut le niveau du programme.'
			},
			// get_program_classification
			{
				kind: 'llm_thought',
				toolSlot: 2,
				content: 'Et le niveau de Persée ?',
				caption: '🧠 L\'agent compare l\'habilitation à la classification du programme — c\'est le contrôle d\'accès fondamental.'
			},
			{
				kind: 'tool_call',
				toolSlot: 2,
				toolCall: {
					name: 'get_program_classification',
					args: {
						program_name: { value: '"Persée"' }
					}
				},
				caption: '🔧 Argument non-bindé — vient de la query initiale.'
			},
			{
				kind: 'tool_response',
				toolSlot: 2,
				toolResponse: {
					json: { name: 'Persée', classification: 'SD', type: 'armement', owner: 'DGA' },
					ledgerUpdates: [
						{ key: 'program_classification', value: 'SD', from: 'get_program_classification.classification' }
					],
					status: 'success'
				},
				caption: '📥 Persée est SD. Hiérarchie d\'habilitation : NP < DR < CD < SD < TSD. L\'employé a CD, le programme demande SD → habilitation INSUFFISANTE.'
			},
			// SHORT CIRCUIT
			{
				kind: 'short_circuit',
				content: 'CD < SD. Inutile d\'appeler check_need_to_know ou fetch_delivery_schedule — l\'accès est déjà refusé au niveau d\'habilitation. Je court-circuite la chaîne et je refuse poliment.',
				caption: '⛔ MOMENT CRITIQUE — court-circuit. L\'agent comprend qu\'inutile d\'appeler les tools 4 et 5 : la décision est déjà tranchée. Économie de 2 appels API ET sécurité (on ne « teaste » pas la donnée sensible).'
			},
			{
				kind: 'final_answer',
				content: '« Lt Durand, votre habilitation actuelle (CD) n\'autorise pas l\'accès au programme Persée, classifié SD. Une demande de relèvement d\'habilitation peut être déposée auprès de votre officier de sécurité si votre mission le justifie. »',
				caption: '🤖 Refus argumenté. Aucun bout du calendrier n\'est révélé — même indirectement. L\'agent a appelé 3 tools sur 5 (économie + sûreté). C\'est ça l\'intelligence d\'une chaîne séquentielle : savoir s\'arrêter.'
			}
		]
	};

	const SCENARIOS: Scenario[] = [SCENARIO_A, SCENARIO_B];

	// =================================================================
	// État
	// =================================================================
	let scenarioId = $state<string>(SCENARIO_A.id);
	let stepIdx = $state(0);
	let isPlaying = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	const scenario = $derived(SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]);
	const totalSteps = $derived(scenario.steps.length);
	const currentStep = $derived(scenario.steps[stepIdx]);

	// Ledger accumulée jusqu'à l'étape courante
	const ledger = $derived.by(() => {
		const acc: Array<{ key: string; value: string; from: string; addedAtStep: number }> = [];
		for (let i = 0; i <= stepIdx; i++) {
			const s = scenario.steps[i];
			if (s.toolResponse) {
				for (const upd of s.toolResponse.ledgerUpdates) {
					// si la clé existe déjà, on la remplace pour montrer la valeur la plus récente
					const existing = acc.findIndex((x) => x.key === upd.key);
					if (existing >= 0) {
						acc[existing] = { ...upd, addedAtStep: i };
					} else {
						acc.push({ ...upd, addedAtStep: i });
					}
				}
			}
		}
		return acc;
	});

	// Tools qui ont déjà tourné (au moins un tool_call ou tool_response)
	const toolStatusBySlot = $derived.by<Record<number, 'pending' | 'active' | 'done' | 'skipped'>>(() => {
		const status: Record<number, 'pending' | 'active' | 'done' | 'skipped'> = {
			0: 'pending', 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending'
		};
		for (let i = 0; i <= stepIdx; i++) {
			const s = scenario.steps[i];
			if (s.toolResponse && s.toolSlot !== undefined) {
				status[s.toolSlot] = 'done';
			}
		}
		// Active = le tool courant si on est dans une étape liée
		if (currentStep && currentStep.toolSlot !== undefined &&
			(currentStep.kind === 'llm_thought' || currentStep.kind === 'tool_call' || currentStep.kind === 'tool_response')) {
			if (status[currentStep.toolSlot] !== 'done') {
				status[currentStep.toolSlot] = 'active';
			}
		}
		// Si on a atteint un short_circuit, marquer les tools non encore done comme skipped
		const hasShortCircuit = scenario.steps.slice(0, stepIdx + 1).some((s) => s.kind === 'short_circuit');
		if (hasShortCircuit) {
			for (const k of [0, 1, 2, 3, 4]) {
				if (status[k] === 'pending') status[k] = 'skipped';
			}
		}
		return status;
	});

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
		if (playInterval) { clearInterval(playInterval); playInterval = null; }
	}
	$effect(() => {
		scenarioId; // reset on scenario change
		stepIdx = 0;
		stopPlay();
	});

	function jsonPreview(obj: unknown, max = 400): string {
		const s = JSON.stringify(obj, null, 2);
		return s.length > max ? s.slice(0, max) + '\n  ...' : s;
	}

	function stepKindLabel(k: StepKind): string {
		return ({
			user_query: '👤 Question utilisateur',
			llm_thought: '🧠 Raisonnement LLM',
			tool_call: '🔧 Tool call (output → API)',
			tool_response: '📥 Tool response',
			short_circuit: '⛔ Court-circuit',
			final_answer: '🤖 Réponse finale'
		})[k];
	}

	function stepKindColor(k: StepKind): string {
		return ({
			user_query: '#22c55e',
			llm_thought: '#a855f7',
			tool_call: '#fb923c',
			tool_response: '#06b6d4',
			short_circuit: '#dc2626',
			final_answer: '#f59e0b'
		})[k];
	}
</script>

<figure class="seq">
	<!-- Scenario tabs -->
	<div class="seq-tabs">
		{#each SCENARIOS as s (s.id)}
			<button
				type="button"
				class="seq-tab {scenarioId === s.id ? 'is-active' : ''}"
				onclick={() => (scenarioId = s.id)}
			>
				<span aria-hidden="true">{s.emoji}</span>
				<div class="seq-tab-body">
					<div class="seq-tab-title">{s.title}</div>
					<div class="seq-tab-sub">{s.summary}</div>
				</div>
			</button>
		{/each}
	</div>

	<!-- User query -->
	<div class="seq-query">
		<span class="seq-query-label">👤 Question utilisateur</span>
		<div class="seq-query-text">« {scenario.query} »</div>
	</div>

	<!-- Pipeline visualization -->
	<div class="seq-pipeline">
		<div class="seq-pipeline-label">Pipeline d'outils — l'agent enchaîne les appels de gauche à droite</div>
		<div class="seq-pipeline-flow">
			{#each scenario.tools as tool, i (tool.slot)}
				{@const status = toolStatusBySlot[tool.slot]}
				<div class="seq-tool seq-tool-{status}" style="--tool-color: {tool.color}">
					<div class="seq-tool-slot">#{tool.slot + 1}</div>
					<div class="seq-tool-emoji">{tool.emoji}</div>
					<div class="seq-tool-name">{tool.name}</div>
					<div class="seq-tool-status">
						{#if status === 'done'}✓ done{/if}
						{#if status === 'active'}● active{/if}
						{#if status === 'pending'}○ pending{/if}
						{#if status === 'skipped'}⤫ skipped{/if}
					</div>
				</div>
				{#if i < scenario.tools.length - 1}
					{@const nextStatus = toolStatusBySlot[scenario.tools[i + 1].slot]}
					<div class="seq-arrow seq-arrow-{status === 'done' && (nextStatus === 'active' || nextStatus === 'done') ? 'active' : status === 'skipped' || nextStatus === 'skipped' ? 'skipped' : 'pending'}">→</div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Main : current step + ledger -->
	<div class="seq-main">
		<!-- Current step detail -->
		<div class="seq-step">
			<div class="seq-step-head" style="--kind-color: {stepKindColor(currentStep.kind)}">
				{stepKindLabel(currentStep.kind)}
				{#if currentStep.toolSlot !== undefined}
					<span class="seq-step-tool">→ tool #{currentStep.toolSlot + 1} : <code>{scenario.tools.find((t) => t.slot === currentStep.toolSlot)?.name}</code></span>
				{/if}
			</div>
			<div class="seq-step-body">
				{#if currentStep.kind === 'user_query' || currentStep.kind === 'llm_thought' || currentStep.kind === 'short_circuit' || currentStep.kind === 'final_answer'}
					<div class="seq-text seq-text-{currentStep.kind}">{currentStep.content}</div>
				{/if}

				{#if currentStep.kind === 'tool_call' && currentStep.toolCall}
					<div class="seq-tool-call">
						<div class="seq-tool-call-name"><code>{currentStep.toolCall.name}(</code></div>
						<div class="seq-tool-call-args">
							{#each Object.entries(currentStep.toolCall.args) as [argName, arg] (argName)}
								<div class="seq-arg {arg.binding ? 'seq-arg-bound' : ''}">
									<span class="seq-arg-name">{argName}=</span>
									<span class="seq-arg-value">{arg.value}</span>
									{#if arg.binding}
										<span class="seq-arg-binding" title="Valeur récupérée de la ledger">
											⬅ ledger.<code>{arg.binding}</code>
										</span>
									{/if}
								</div>
							{/each}
						</div>
						<div class="seq-tool-call-name"><code>)</code></div>
					</div>
				{/if}

				{#if currentStep.kind === 'tool_response' && currentStep.toolResponse}
					<div class="seq-resp seq-resp-{currentStep.toolResponse.status}">
						<div class="seq-resp-label">Réponse JSON</div>
						<pre class="seq-resp-pre"><code>{jsonPreview(currentStep.toolResponse.json, 600)}</code></pre>
						{#if currentStep.toolResponse.ledgerUpdates.length > 0}
							<div class="seq-resp-updates">
								<div class="seq-resp-updates-label">→ Mises à jour de la ledger</div>
								{#each currentStep.toolResponse.ledgerUpdates as upd (upd.key)}
									<div class="seq-resp-update">
										<code>ledger.{upd.key}</code> ← <code>{upd.value}</code>
										<span class="seq-resp-update-from">(via <code>{upd.from}</code>)</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Ledger panel -->
		<aside class="seq-ledger">
			<div class="seq-ledger-head">
				📒 Ledger <span class="seq-ledger-count">({ledger.length} var.)</span>
			</div>
			<div class="seq-ledger-body">
				{#if ledger.length === 0}
					<div class="seq-ledger-empty">Aucune variable encore. La ledger se remplit à chaque tool_response.</div>
				{:else}
					{#each ledger as v (v.key)}
						<div class="seq-ledger-var" class:is-latest={v.addedAtStep === stepIdx}>
							<div class="seq-ledger-key"><code>{v.key}</code></div>
							<div class="seq-ledger-val"><code>{v.value}</code></div>
							<div class="seq-ledger-from">via <code>{v.from}</code></div>
						</div>
					{/each}
				{/if}
			</div>
			<div class="seq-ledger-foot">
				💡 La ledger est l'<strong>état partagé</strong> que les tools suivants peuvent référencer.
				En LangGraph c'est typiquement le <code>state.messages</code> + un champ
				<code>scratchpad</code>.
			</div>
		</aside>
	</div>

	<!-- Caption pédagogique -->
	<div class="seq-caption">
		<strong>Étape {stepIdx + 1} / {totalSteps}.</strong>
		{currentStep.caption}
	</div>

	<!-- Controls -->
	<div class="seq-controls">
		<button type="button" class="seq-btn" onclick={prev} disabled={stepIdx === 0}>◀ Précédent</button>
		<button type="button" class="seq-btn seq-btn-play" onclick={togglePlay}>
			{isPlaying ? '⏸ Pause' : '▶ Auto'}
		</button>
		<button type="button" class="seq-btn" onclick={reset} disabled={stepIdx === 0}>↻ Reset</button>
		<button type="button" class="seq-btn seq-btn-next" onclick={next} disabled={stepIdx === totalSteps - 1}>Suivant ▶</button>
	</div>
</figure>

<style>
	.seq {
		display: flex; flex-direction: column; gap: 0.85rem;
		background: #0f172a; border-radius: 1.25rem; padding: 1.25rem;
		color: #e2e8f0;
	}

	/* ===== Scenario tabs ===== */
	.seq-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
	@media (max-width: 640px) { .seq-tabs { grid-template-columns: 1fr; } }
	.seq-tab {
		display: flex; align-items: center; gap: 0.65rem; text-align: left;
		padding: 0.7rem 0.9rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 0.75rem; color: #cbd5e1; cursor: pointer; font: inherit;
	}
	.seq-tab:hover { border-color: #06b6d4; }
	.seq-tab.is-active { background: #1a3349; border-color: #06b6d4; color: #fff; }
	.seq-tab > span { font-size: 1.4rem; }
	.seq-tab-body { display: flex; flex-direction: column; gap: 0.15rem; }
	.seq-tab-title { font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; color: #e2e8f0; }
	.seq-tab-sub { font-size: 0.72rem; color: #94a3b8; line-height: 1.3; }

	/* ===== User query ===== */
	.seq-query {
		padding: 0.7rem 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.6rem;
	}
	.seq-query-label {
		font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: #94a3b8;
	}
	.seq-query-text { font-size: 0.92rem; color: #e2e8f0; margin-top: 0.25rem; line-height: 1.45; }

	/* ===== Pipeline visualization ===== */
	.seq-pipeline {
		padding: 0.85rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem;
	}
	.seq-pipeline-label {
		font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 0.55rem;
	}
	.seq-pipeline-flow {
		display: flex; align-items: stretch; gap: 0.2rem; overflow-x: auto; padding: 0.25rem 0;
	}
	.seq-tool {
		flex: 1 1 0; min-width: 90px; padding: 0.5rem 0.4rem; border-radius: 0.55rem;
		display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
		border: 1.5px solid #334155; background: #0f172a; transition: all 0.25s;
		position: relative;
	}
	.seq-tool-slot {
		position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
		background: #334155; color: #94a3b8; font-family: var(--font-mono); font-size: 0.6rem;
		padding: 0.05rem 0.4rem; border-radius: 999px;
	}
	.seq-tool-emoji { font-size: 1.4rem; opacity: 0.5; transition: opacity 0.3s; }
	.seq-tool-name {
		font-family: var(--font-mono); font-size: 0.66rem; color: #64748b;
		text-align: center; line-height: 1.2; transition: color 0.3s;
		word-break: break-word;
	}
	.seq-tool-status { font-family: var(--font-mono); font-size: 0.6rem; color: #64748b; }
	.seq-tool-pending { opacity: 0.5; }
	.seq-tool-active {
		border-color: var(--tool-color); background: rgba(255,255,255,0.04);
		box-shadow: 0 0 0 2px var(--tool-color), 0 0 20px -3px var(--tool-color);
		animation: seq-pulse 1.4s infinite;
	}
	.seq-tool-active .seq-tool-emoji { opacity: 1; }
	.seq-tool-active .seq-tool-name { color: var(--tool-color); font-weight: 700; }
	.seq-tool-active .seq-tool-status { color: var(--tool-color); }
	.seq-tool-done {
		border-color: var(--tool-color); background: rgba(34,197,94,0.06);
	}
	.seq-tool-done .seq-tool-emoji { opacity: 1; }
	.seq-tool-done .seq-tool-name { color: var(--tool-color); }
	.seq-tool-done .seq-tool-status { color: #22c55e; }
	.seq-tool-skipped {
		opacity: 0.32; border-style: dashed; border-color: #475569;
	}
	.seq-tool-skipped .seq-tool-name, .seq-tool-skipped .seq-tool-status { color: #475569; }

	@keyframes seq-pulse {
		0%, 100% { box-shadow: 0 0 0 2px var(--tool-color), 0 0 20px -3px var(--tool-color); }
		50% { box-shadow: 0 0 0 2px var(--tool-color), 0 0 30px -1px var(--tool-color); }
	}

	.seq-arrow {
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-mono); font-size: 1rem; font-weight: 700;
		min-width: 18px; padding: 0 0.1rem;
	}
	.seq-arrow-pending { color: #475569; }
	.seq-arrow-active { color: #f59e0b; animation: seq-arrow-blink 1s ease-in-out infinite; }
	.seq-arrow-skipped { color: #475569; opacity: 0.4; }
	@keyframes seq-arrow-blink { 50% { opacity: 0.4; } }

	/* ===== Main grid : step detail + ledger ===== */
	.seq-main { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 0.85rem; }
	@media (max-width: 780px) { .seq-main { grid-template-columns: 1fr; } }

	.seq-step {
		background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem;
		display: flex; flex-direction: column; overflow: hidden;
	}
	.seq-step-head {
		padding: 0.55rem 0.9rem; background: #0f172a;
		border-bottom: 1px solid #334155;
		font-family: var(--font-mono); font-size: 0.78rem; color: var(--kind-color);
		font-weight: 600;
		display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
	}
	.seq-step-tool { color: #94a3b8; font-weight: 400; font-size: 0.7rem; }
	.seq-step-tool code { color: #fef3c7; background: #1e293b; padding: 0.05rem 0.35rem; border-radius: 0.25rem; }
	.seq-step-body { padding: 0.9rem; flex: 1; overflow-y: auto; max-height: 380px; }

	.seq-text {
		font-size: 0.88rem; line-height: 1.55; color: #e2e8f0;
		padding: 0.7rem 0.9rem; border-radius: 0.5rem; border-left: 3px solid;
	}
	.seq-text-user_query { background: #14361f; border-left-color: #22c55e; }
	.seq-text-llm_thought { background: #2d1b4e; border-left-color: #a855f7; font-style: italic; }
	.seq-text-short_circuit { background: #401414; border-left-color: #dc2626; color: #fecaca; font-weight: 500; }
	.seq-text-final_answer { background: #2a1f08; border-left-color: #f59e0b; color: #fef3c7; }

	/* ===== Tool call display ===== */
	.seq-tool-call {
		background: #0f172a; border: 1px solid #fb923c; border-radius: 0.55rem;
		padding: 0.7rem 0.9rem; font-family: var(--font-mono); font-size: 0.82rem;
	}
	.seq-tool-call-name code { color: #fb923c; font-weight: 700; }
	.seq-tool-call-args {
		display: flex; flex-direction: column; gap: 0.3rem;
		margin: 0.25rem 0 0.25rem 1.5rem;
	}
	.seq-arg {
		display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;
		padding: 0.25rem 0.45rem; border-radius: 0.35rem; background: #1e293b;
		font-size: 0.78rem;
	}
	.seq-arg-bound {
		background: #2a1f08; border: 1px dashed #f59e0b;
		box-shadow: 0 0 8px -2px #f59e0b;
	}
	.seq-arg-name { color: #cbd5e1; font-weight: 600; }
	.seq-arg-value { color: #06b6d4; }
	.seq-arg-binding {
		display: inline-flex; gap: 0.25rem; align-items: center;
		font-size: 0.7rem; color: #f59e0b; padding: 0.05rem 0.45rem;
		background: #2a1f08; border: 1px solid #f59e0b; border-radius: 0.3rem;
	}
	.seq-arg-binding code { color: #fef3c7; background: transparent; padding: 0; }

	/* ===== Tool response display ===== */
	.seq-resp {
		background: #0f172a; border: 1px solid #06b6d4; border-radius: 0.55rem;
		padding: 0.7rem 0.9rem;
	}
	.seq-resp-denied { border-color: #dc2626; }
	.seq-resp-label {
		font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase;
		color: #06b6d4; margin-bottom: 0.4rem;
	}
	.seq-resp-pre {
		margin: 0; padding: 0.5rem 0.7rem; background: #020617;
		font-family: var(--font-mono); font-size: 0.72rem; color: #94a3b8;
		border-radius: 0.4rem; white-space: pre-wrap; word-break: break-word;
		max-height: 180px; overflow-y: auto;
	}
	.seq-resp-updates {
		margin-top: 0.55rem; padding-top: 0.55rem; border-top: 1px dashed #334155;
	}
	.seq-resp-updates-label {
		font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase;
		color: #f59e0b; margin-bottom: 0.3rem;
	}
	.seq-resp-update {
		font-family: var(--font-mono); font-size: 0.75rem; color: #fef3c7;
		padding: 0.2rem 0; display: flex; flex-wrap: wrap; gap: 0.3rem;
	}
	.seq-resp-update code {
		background: #1e293b; padding: 0.05rem 0.35rem; border-radius: 0.25rem;
		color: #fef3c7;
	}
	.seq-resp-update-from { color: #64748b; font-size: 0.7rem; }

	/* ===== Ledger panel ===== */
	.seq-ledger {
		background: #1a1f2e; border: 1px solid #334155; border-radius: 0.75rem;
		display: flex; flex-direction: column; overflow: hidden;
	}
	.seq-ledger-head {
		padding: 0.55rem 0.9rem; background: #0f172a;
		border-bottom: 1px solid #334155;
		font-family: var(--font-mono); font-size: 0.78rem; color: #f59e0b;
		font-weight: 600;
	}
	.seq-ledger-count { color: #94a3b8; font-weight: 400; font-size: 0.7rem; }
	.seq-ledger-body {
		padding: 0.6rem; flex: 1; overflow-y: auto; max-height: 320px;
		display: flex; flex-direction: column; gap: 0.4rem;
	}
	.seq-ledger-empty {
		font-style: italic; color: #64748b; padding: 0.85rem; text-align: center;
		font-size: 0.78rem; line-height: 1.5;
	}
	.seq-ledger-var {
		padding: 0.45rem 0.6rem; background: #0f172a; border: 1px solid #334155;
		border-radius: 0.4rem; font-family: var(--font-mono); font-size: 0.72rem;
		display: flex; flex-direction: column; gap: 0.15rem;
		transition: all 0.3s;
	}
	.seq-ledger-var.is-latest {
		border-color: #f59e0b; box-shadow: 0 0 12px -3px #f59e0b;
		animation: seq-ledger-flash 0.7s ease-out;
	}
	@keyframes seq-ledger-flash {
		from { background: #2a1f08; }
		to { background: #0f172a; }
	}
	.seq-ledger-key code { color: #f59e0b; }
	.seq-ledger-val code { color: #06b6d4; font-weight: 600; }
	.seq-ledger-from { color: #64748b; font-size: 0.66rem; }
	.seq-ledger-from code { color: #94a3b8; background: transparent; padding: 0; }
	.seq-ledger-foot {
		padding: 0.55rem 0.8rem; background: #0f172a; border-top: 1px solid #334155;
		font-size: 0.7rem; color: #cbd5e1; line-height: 1.5;
	}
	.seq-ledger-foot code {
		color: #fef3c7; background: #1e293b; padding: 0.05rem 0.3rem;
		border-radius: 0.25rem; font-size: 0.85em;
	}

	/* ===== Caption ===== */
	.seq-caption {
		padding: 0.7rem 0.9rem; background: #1e293b; border: 1px solid #334155;
		border-radius: 0.5rem; font-size: 0.86rem; color: #cbd5e1; line-height: 1.55;
	}
	.seq-caption strong {
		color: #fef3c7; font-family: var(--font-mono);
		font-size: 0.72rem; margin-right: 0.4rem;
	}

	/* ===== Controls ===== */
	.seq-controls { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
	.seq-btn {
		padding: 0.5rem 1rem; background: #1e293b; border: 1px solid #475569;
		border-radius: 999px; color: #cbd5e1; font-size: 0.82rem;
		font-family: var(--font-mono); cursor: pointer;
	}
	.seq-btn:disabled { opacity: 0.35; cursor: not-allowed; }
	.seq-btn-play { background: #a855f7; border-color: #a855f7; color: #fff; }
	.seq-btn-next {
		background: #f59e0b; border-color: #f59e0b; color: #0f172a; font-weight: 700;
	}
</style>
