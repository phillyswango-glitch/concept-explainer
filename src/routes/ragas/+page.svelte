<!--
	/ragas — Lab d'évaluation RAG avec simulateur interactif des métriques.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';

	// ============================================================
	// Simulateur de métriques RAGAS — 4 scénarios pédagogiques
	// ============================================================
	interface Metric {
		key: string;
		name: string;
		emoji: string;
		score: number;
		max: number;
		reasoning: string;
	}

	interface Scenario {
		id: string;
		title: string;
		emoji: string;
		question: string;
		ground_truth: string;
		retrieved_contexts: string[];
		generated_answer: string;
		metrics: Metric[];
		verdict: 'good' | 'hallucination' | 'off-topic' | 'bad-retrieval';
		verdictText: string;
	}

	const SCENARIOS: Scenario[] = [
		{
			id: 'good',
			title: 'Tout est correct',
			emoji: '✅',
			question: 'Quels EPI sont nécessaires pour manipuler de l\'acide chlorhydrique ?',
			ground_truth: 'Lunettes EN166, gants nitrile ≥ 0,4 mm, blouse manches longues, sorbonne pour > 100 mL.',
			retrieved_contexts: [
				'L\'acide chlorhydrique (CAS 7647-01-0, GHS05/GHS07) est corrosif. EPI obligatoires : lunettes EN166, gants nitrile ≥ 0,4 mm.',
				'Pour tout volume > 100 mL d\'acide fort, manipulation sous sorbonne obligatoire.',
				'Blouse manches longues + tablier PVC recommandés pour les acides concentrés.'
			],
			generated_answer: 'Pour manipuler l\'acide chlorhydrique en sécurité, il faut : lunettes de sécurité EN166, gants nitrile épais (≥ 0,4 mm), blouse manches longues, et travailler sous sorbonne dès que le volume dépasse 100 mL.',
			metrics: [
				{ key: 'faithfulness', name: 'Faithfulness', emoji: '🎯', score: 1.0, max: 1.0, reasoning: 'Toutes les infos de la réponse sont présentes dans les contextes. Aucune invention.' },
				{ key: 'answer_relevancy', name: 'Answer Relevancy', emoji: '💬', score: 0.95, max: 1.0, reasoning: 'La réponse traite directement la question (EPI pour HCl). Reformulation parfaite.' },
				{ key: 'context_precision', name: 'Context Precision', emoji: '🎚️', score: 1.0, max: 1.0, reasoning: 'Les 3 contextes récupérés sont tous pertinents. Aucun bruit.' },
				{ key: 'context_recall', name: 'Context Recall', emoji: '📥', score: 1.0, max: 1.0, reasoning: 'Les 4 EPI du ground truth sont couverts par les contextes (lunettes, gants, blouse, sorbonne).' },
				{ key: 'answer_correctness', name: 'Answer Correctness', emoji: '✓', score: 0.97, max: 1.0, reasoning: 'La réponse correspond au ground truth en contenu et en formulation. Légère variation acceptable.' }
			],
			verdict: 'good',
			verdictText: 'Pipeline RAG sain : récupération précise, réponse fidèle et pertinente. C\'est le résultat qu\'on veut.'
		},
		{
			id: 'hallucination',
			title: 'Hallucination du LLM',
			emoji: '🌫️',
			question: 'Quels EPI sont nécessaires pour manipuler de l\'acide chlorhydrique ?',
			ground_truth: 'Lunettes EN166, gants nitrile ≥ 0,4 mm, blouse manches longues, sorbonne pour > 100 mL.',
			retrieved_contexts: [
				'L\'acide chlorhydrique (CAS 7647-01-0, GHS05/GHS07) est corrosif. EPI obligatoires : lunettes EN166, gants nitrile ≥ 0,4 mm.',
				'Pour tout volume > 100 mL d\'acide fort, manipulation sous sorbonne obligatoire.',
				'Blouse manches longues + tablier PVC recommandés pour les acides concentrés.'
			],
			generated_answer: 'Pour manipuler l\'acide chlorhydrique : lunettes de sécurité, gants nitrile, blouse, masque FFP3 et appareil respiratoire à adduction d\'air pour toute manipulation. Toujours en présence d\'un secouriste certifié SST niveau 2.',
			metrics: [
				{ key: 'faithfulness', name: 'Faithfulness', emoji: '🎯', score: 0.45, max: 1.0, reasoning: 'PROBLÈME : "masque FFP3", "appareil respiratoire à adduction d\'air", "secouriste SST niveau 2" ne sont PAS dans les contextes. Le LLM invente.' },
				{ key: 'answer_relevancy', name: 'Answer Relevancy', emoji: '💬', score: 0.85, max: 1.0, reasoning: 'La réponse répond à la question (EPI pour HCl), même si elle ajoute des éléments incorrects.' },
				{ key: 'context_precision', name: 'Context Precision', emoji: '🎚️', score: 1.0, max: 1.0, reasoning: 'Les contextes récupérés sont bons. Le problème vient du LLM, pas du RAG.' },
				{ key: 'context_recall', name: 'Context Recall', emoji: '📥', score: 1.0, max: 1.0, reasoning: 'Les contextes contiennent toutes les infos du ground truth.' },
				{ key: 'answer_correctness', name: 'Answer Correctness', emoji: '✓', score: 0.55, max: 1.0, reasoning: 'La réponse contient des EPI corrects MAIS aussi des éléments hallucinés non justifiés. Dangereux en pratique métier.' }
			],
			verdict: 'hallucination',
			verdictText: 'Le RAG a fait son travail mais le LLM hallucine. Faithfulness ↓ alerte ce problème — typique d\'un LLM trop "créatif" (température trop haute) ou d\'un fine-tuning insuffisant sur le refus d\'inventer.'
		},
		{
			id: 'off-topic',
			title: 'Réponse hors-sujet',
			emoji: '🎯',
			question: 'Quels EPI sont nécessaires pour manipuler de l\'acide chlorhydrique ?',
			ground_truth: 'Lunettes EN166, gants nitrile ≥ 0,4 mm, blouse manches longues, sorbonne pour > 100 mL.',
			retrieved_contexts: [
				'L\'acide chlorhydrique (CAS 7647-01-0, GHS05/GHS07) est corrosif. EPI obligatoires : lunettes EN166, gants nitrile ≥ 0,4 mm.',
				'Pour tout volume > 100 mL d\'acide fort, manipulation sous sorbonne obligatoire.'
			],
			generated_answer: 'L\'acide chlorhydrique est un acide fort (CAS 7647-01-0) classé corrosif (GHS05) et nocif (GHS07). Sa formule est HCl. Il est utilisé dans de nombreux procédés industriels comme le décapage des métaux et la fabrication de produits chimiques.',
			metrics: [
				{ key: 'faithfulness', name: 'Faithfulness', emoji: '🎯', score: 0.85, max: 1.0, reasoning: 'Les infos sur HCl (CAS, classement) viennent bien des contextes. Pas d\'invention significative.' },
				{ key: 'answer_relevancy', name: 'Answer Relevancy', emoji: '💬', score: 0.30, max: 1.0, reasoning: 'PROBLÈME : la question portait sur les EPI. La réponse parle des propriétés et usages de HCl. Hors-sujet.' },
				{ key: 'context_precision', name: 'Context Precision', emoji: '🎚️', score: 1.0, max: 1.0, reasoning: 'Contextes pertinents (parlent des EPI).' },
				{ key: 'context_recall', name: 'Context Recall', emoji: '📥', score: 0.7, max: 1.0, reasoning: 'Le ground truth mentionne "blouse" qui n\'apparaît pas dans les 2 contextes ici.' },
				{ key: 'answer_correctness', name: 'Answer Correctness', emoji: '✓', score: 0.20, max: 1.0, reasoning: 'La réponse est factuellement correcte mais ne répond pas du tout à la question. Score très bas.' }
			],
			verdict: 'off-topic',
			verdictText: 'Cas typique où le LLM "remplit" avec des infos vraies mais ne répond pas. Answer Relevancy ↓ détecte exactement ce problème.'
		},
		{
			id: 'bad-retrieval',
			title: 'Mauvaise récupération RAG',
			emoji: '📦',
			question: 'Quels EPI sont nécessaires pour manipuler de l\'acide chlorhydrique ?',
			ground_truth: 'Lunettes EN166, gants nitrile ≥ 0,4 mm, blouse manches longues, sorbonne pour > 100 mL.',
			retrieved_contexts: [
				'Le règlement REACH impose la déclaration des substances chimiques produites en quantités > 1 tonne/an.',
				'Les acides forts ont un pKa < 0 et se dissocient totalement en solution aqueuse.',
				'L\'eau distillée est utilisée pour rincer les surfaces après manipulation chimique.'
			],
			generated_answer: 'Je n\'ai pas trouvé d\'information précise sur les EPI nécessaires pour l\'acide chlorhydrique dans la documentation à ma disposition. Je recommande de consulter la fiche de données de sécurité (FDS) du produit ou un responsable HSE.',
			metrics: [
				{ key: 'faithfulness', name: 'Faithfulness', emoji: '🎯', score: 0.95, max: 1.0, reasoning: 'Le LLM a bien refusé d\'inventer. Bon comportement face au manque de contexte pertinent.' },
				{ key: 'answer_relevancy', name: 'Answer Relevancy', emoji: '💬', score: 0.50, max: 1.0, reasoning: 'La réponse adresse partiellement la question (admet ne pas savoir) mais n\'apporte pas de valeur.' },
				{ key: 'context_precision', name: 'Context Precision', emoji: '🎚️', score: 0.10, max: 1.0, reasoning: 'PROBLÈME : 0 des 3 contextes ne traite des EPI. RAG complètement à côté du sujet.' },
				{ key: 'context_recall', name: 'Context Recall', emoji: '📥', score: 0.0, max: 1.0, reasoning: 'PROBLÈME : aucun des EPI du ground truth (lunettes, gants, blouse, sorbonne) n\'est dans les contextes.' },
				{ key: 'answer_correctness', name: 'Answer Correctness', emoji: '✓', score: 0.15, max: 1.0, reasoning: 'La réponse n\'apporte pas l\'information attendue.' }
			],
			verdict: 'bad-retrieval',
			verdictText: 'Le RAG a échoué — embeddings mal alignés ou index inadéquat. Context Precision et Recall ↓ pointent ici. Le LLM a heureusement refusé d\'inventer (faithfulness élevé).'
		}
	];

	let scenarioId = $state<string>('good');
	const scenario = $derived(SCENARIOS.find((s) => s.id === scenarioId)!);

	function scoreColor(score: number): string {
		if (score >= 0.85) return '#16a34a';
		if (score >= 0.6) return '#facc15';
		if (score >= 0.4) return '#fb923c';
		return '#dc2626';
	}

	function scoreBg(score: number): string {
		if (score >= 0.85) return '#f0fdf4';
		if (score >= 0.6) return '#fefce8';
		if (score >= 0.4) return '#fff7ed';
		return '#fef2f2';
	}
</script>

<svelte:head><title>RAGAS — Évaluation rigoureuse de RAG</title></svelte:head>

<article class="ragas">
	<!-- HÉROS -->
	<header class="ragas-hero">
		<span class="ragas-hero-emoji">📐</span>
		<h1 class="ragas-h1">RAGAS — Évaluer un RAG rigoureusement</h1>
		<p class="ragas-hero-lead">
			Tu as un agent RAG en prod. Mais comment tu sais qu'il est <em>bon</em> ? Comment
			tu détectes une régression après un changement de prompt ? RAGAS
			(Es et al. 2024) est <strong>la référence open-source</strong> pour
			évaluer un RAG automatiquement, avec 5 métriques précises calculées
			par LLM-as-judge. Page interactive : tu peux <strong>jouer
			avec les scénarios pour voir comment chaque métrique réagit</strong>.
		</p>
		<div class="ragas-hero-actions">
			<a href="#simulator" class="ragas-cta">🎮 Aller au simulateur</a>
		</div>
	</header>

	<!-- TOC -->
	<nav class="ragas-toc">
		<p class="ragas-toc-label">📍 Parcours</p>
		<ol class="ragas-toc-list">
			<li><a href="#prereq">0. Avant de commencer</a></li>
			<li><a href="#pourquoi">1. Pourquoi évaluer un RAG ?</a></li>
			<li><a href="#metriques">2. Les 5 métriques de RAGAS</a></li>
			<li><a href="#simulator">3. Simulateur interactif ⭐</a></li>
			<li><a href="#code">4. Code — évaluer ton agent défense</a></li>
			<li><a href="#integration">5. Intégration Langfuse</a></li>
			<li><a href="#glossaire">6. Glossaire</a></li>
		</ol>
	</nav>

	<!-- 0. PRÉREQUIS -->
	<section id="prereq" class="ragas-section">
		<h2 class="ragas-h2">0️⃣ Avant de commencer</h2>
		<div class="ragas-prereq-grid">
			<details class="ragas-prereq">
				<summary>🤖 LLM-as-judge</summary>
				<div>
					<p>
						Pattern d'évaluation où un autre LLM (souvent GPT-4 ou
						Claude) note la qualité d'une réponse. RAGAS utilise ce
						pattern pour 4 de ses 5 métriques. Le « juge » reçoit un
						prompt structuré et renvoie un score 0-1.
					</p>
				</div>
			</details>
			<details class="ragas-prereq">
				<summary>📚 Ground truth</summary>
				<div>
					<p>
						La réponse <strong>idéale</strong> pour une question donnée,
						fournie par un humain expert. Sert de référence pour les
						métriques basées sur la comparaison (Context Recall,
						Answer Correctness).
					</p>
				</div>
			</details>
			<details class="ragas-prereq">
				<summary>🗂️ Dataset d'évaluation</summary>
				<div>
					<p>
						Collection structurée d'examens. Chaque ligne :
						<code>(question, ground_truth, retrieved_contexts, generated_answer)</code>.
						Tu génères les 2 derniers en faisant tourner ton agent
						sur les 2 premiers, puis RAGAS calcule les métriques.
					</p>
				</div>
			</details>
			<details class="ragas-prereq">
				<summary>🔍 RAG (rappel)</summary>
				<div>
					<p>
						Retrieval-Augmented Generation : pipeline où un LLM répond
						à partir de documents <strong>récupérés</strong> en amont
						(par embedding + similarité vectorielle), au lieu de
						s'appuyer uniquement sur sa mémoire. Voir page
						<a href="/rag" style="color:#16a34a">RAG avec Milvus</a>.
					</p>
				</div>
			</details>
		</div>
	</section>

	<!-- 1. POURQUOI -->
	<section id="pourquoi" class="ragas-section">
		<h2 class="ragas-h2">1️⃣ Pourquoi évaluer un RAG ?</h2>
		<p>
			Un RAG a <strong>2 sources de bug</strong> indépendantes : la
			récupération (RAG) ou la génération (LLM). Sans diagnostic chiffré,
			tu ne sais pas <em>laquelle</em> est en cause quand un user te dit
			« la réponse est mauvaise ». RAGAS te donne 5 métriques qui
			isolent chaque problème.
		</p>
		<div class="ragas-bug-grid">
			<div class="ragas-bug">
				<div class="ragas-bug-emoji">🌫️</div>
				<strong>Hallucination</strong>
				<p>Le LLM invente une info absente du contexte. → <em>Faithfulness</em> détecte.</p>
			</div>
			<div class="ragas-bug">
				<div class="ragas-bug-emoji">🎯</div>
				<strong>Hors sujet</strong>
				<p>La réponse n'adresse pas la question. → <em>Answer Relevancy</em> détecte.</p>
			</div>
			<div class="ragas-bug">
				<div class="ragas-bug-emoji">📦</div>
				<strong>Mauvais contextes récupérés</strong>
				<p>Le RAG ramène les mauvais documents. → <em>Context Precision/Recall</em> détectent.</p>
			</div>
			<div class="ragas-bug">
				<div class="ragas-bug-emoji">📉</div>
				<strong>Régression silencieuse</strong>
				<p>Tu changes un prompt → 30 % des réponses se dégradent sans alerte. → <em>Answer Correctness</em> sur dataset détecte.</p>
			</div>
		</div>
	</section>

	<!-- 2. MÉTRIQUES -->
	<section id="metriques" class="ragas-section">
		<h2 class="ragas-h2">2️⃣ Les 5 métriques RAGAS</h2>
		<table class="ragas-metrics-table">
			<thead>
				<tr><th>Métrique</th><th>Mesure</th><th>Calcul</th><th>Cible</th></tr>
			</thead>
			<tbody>
				<tr>
					<td>🎯 <strong>Faithfulness</strong></td>
					<td>La réponse est-elle ancrée dans le contexte ?</td>
					<td>LLM extrait les claims de la réponse. Pour chacune, vérifie si elle est supportée par le contexte. Score = ratio.</td>
					<td>≥ 0.85</td>
				</tr>
				<tr>
					<td>💬 <strong>Answer Relevancy</strong></td>
					<td>La réponse adresse-t-elle la question ?</td>
					<td>LLM génère N questions à partir de la réponse. Calcule la similarité cosinus avec la question originale.</td>
					<td>≥ 0.85</td>
				</tr>
				<tr>
					<td>🎚️ <strong>Context Precision</strong></td>
					<td>Les contextes récupérés sont-ils pertinents et bien classés ?</td>
					<td>Pour chaque contexte, le LLM juge sa pertinence. Score pondéré par position (top docs comptent plus).</td>
					<td>≥ 0.7</td>
				</tr>
				<tr>
					<td>📥 <strong>Context Recall</strong></td>
					<td>Avons-nous récupéré tous les contextes nécessaires ?</td>
					<td>LLM décompose le ground truth en claims. Pour chacune, vérifie si elle est couverte par les contextes.</td>
					<td>≥ 0.7</td>
				</tr>
				<tr>
					<td>✓ <strong>Answer Correctness</strong></td>
					<td>La réponse est-elle factuellement correcte ?</td>
					<td>Combinaison : factual correctness (LLM judge vs ground truth) + similarité sémantique.</td>
					<td>≥ 0.7</td>
				</tr>
			</tbody>
		</table>

		<Callout variant="info" title="💡 Comment interpréter">
			<p>
				Les 4 premières métriques sont <strong>indépendantes</strong>
				(elles isolent chacune un type de problème). La 5ème
				(Answer Correctness) est une <strong>vue d'ensemble</strong>
				qui agrège factualité et similarité. Pour diagnostiquer, regarde
				les 4 premières. Pour mesurer la qualité globale et détecter les
				régressions, regarde la 5ème.
			</p>
		</Callout>
	</section>

	<!-- 3. SIMULATEUR -->
	<section id="simulator" class="ragas-section">
		<h2 class="ragas-h2">3️⃣ Simulateur interactif ⭐</h2>
		<p>
			4 scénarios pré-calculés sur la même question (EPI pour HCl).
			Chaque scénario montre comment les 5 métriques se comportent face à
			un type de défaillance. <strong>Choisis un scénario et observe les
			scores se déplacer.</strong>
		</p>

		<div class="ragas-sim">
			<!-- Sélecteur de scénario -->
			<div class="ragas-sim-tabs">
				{#each SCENARIOS as s (s.id)}
					<button
						type="button"
						class="ragas-sim-tab {scenarioId === s.id ? 'is-active' : ''}"
						onclick={() => (scenarioId = s.id)}
					>
						<span>{s.emoji}</span>
						{s.title}
					</button>
				{/each}
			</div>

			<!-- Question et ground truth -->
			<div class="ragas-sim-row">
				<div class="ragas-sim-card">
					<div class="ragas-sim-label">❓ Question</div>
					<div class="ragas-sim-content">{scenario.question}</div>
				</div>
				<div class="ragas-sim-card">
					<div class="ragas-sim-label">✓ Ground truth</div>
					<div class="ragas-sim-content">{scenario.ground_truth}</div>
				</div>
			</div>

			<!-- Contextes récupérés -->
			<div class="ragas-sim-card">
				<div class="ragas-sim-label">📚 Contextes récupérés ({scenario.retrieved_contexts.length})</div>
				<div class="ragas-sim-contexts">
					{#each scenario.retrieved_contexts as ctx, i (i)}
						<div class="ragas-sim-context">
							<span class="ragas-sim-context-rank">#{i + 1}</span>
							<span>{ctx}</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Réponse générée -->
			<div class="ragas-sim-card ragas-sim-card-answer">
				<div class="ragas-sim-label">🤖 Réponse générée par l'agent</div>
				<div class="ragas-sim-content">{scenario.generated_answer}</div>
			</div>

			<!-- Métriques -->
			<div class="ragas-sim-metrics">
				{#each scenario.metrics as metric (metric.key)}
					<div
						class="ragas-sim-metric"
						style="--score-color: {scoreColor(metric.score)}; --score-bg: {scoreBg(metric.score)};"
					>
						<div class="ragas-sim-metric-head">
							<span class="ragas-sim-metric-emoji">{metric.emoji}</span>
							<div>
								<div class="ragas-sim-metric-name">{metric.name}</div>
								<div class="ragas-sim-metric-score">{metric.score.toFixed(2)} / {metric.max.toFixed(2)}</div>
							</div>
						</div>
						<div class="ragas-sim-metric-bar">
							<div class="ragas-sim-metric-fill" style="width: {metric.score * 100}%;"></div>
						</div>
						<div class="ragas-sim-metric-reasoning">{metric.reasoning}</div>
					</div>
				{/each}
			</div>

			<!-- Verdict -->
			<div class="ragas-sim-verdict ragas-sim-verdict-{scenario.verdict}">
				<span class="ragas-sim-verdict-emoji">{scenario.emoji}</span>
				<div>
					<div class="ragas-sim-verdict-title">Verdict — {scenario.title}</div>
					<div>{scenario.verdictText}</div>
				</div>
			</div>
		</div>

		<Callout variant="insight" title="🔍 Ce que tu apprends en jouant les 4 scénarios">
			<ol>
				<li><strong>Tout va bien</strong> : 5 scores ≥ 0.95. Référence.</li>
				<li><strong>Hallucination</strong> : Faithfulness chute à 0.45. Les autres restent OK. → Diagnostic immédiat : c'est le LLM, pas le RAG.</li>
				<li><strong>Hors-sujet</strong> : Answer Relevancy chute à 0.30. Faithfulness reste haute (le LLM utilise les contextes mais ne répond pas à la bonne question).</li>
				<li><strong>Mauvaise récupération</strong> : Context Precision et Recall chutent à ~0. Le LLM s'en sort en refusant. Diagnostic : c'est le RAG, pas le LLM.</li>
			</ol>
		</Callout>
	</section>

	<!-- 4. CODE -->
	<section id="code" class="ragas-section">
		<h2 class="ragas-h2">4️⃣ Code — évaluer ton agent défense</h2>
		<pre class="ragas-code"><code>{`# pip install ragas datasets

from ragas import evaluate
from ragas.metrics import (
    faithfulness, answer_relevancy,
    context_precision, context_recall, answer_correctness
)
from datasets import Dataset

# 1. Construis un dataset à partir de tes traces de prod
data = {
    "question": [
        "Quels EPI pour manipuler HCl ?",
        "Calendrier du programme Persée ?",
        "Comment stocker les acides forts ?",
    ],
    "ground_truth": [
        "Lunettes EN166, gants nitrile, blouse, sorbonne >100mL",
        "Information classifiée SD, pas accessible avec habilitation CD",
        "Armoire ventilée, séparé des bases, signalétique GHS",
    ],
    "contexts": [
        ["L'acide chlorhydrique...", "EPI obligatoires...", "Sorbonne pour..."],
        ["Programme Persée classé SD...", "Habilitation requise..."],
        ["Stockage des acides...", "Compatibilité chimique..."],
    ],
    "answer": [
        "Pour HCl : lunettes EN166, gants nitrile...",  # ← sortie de TON agent
        "Le programme Persée est classé SD. Ton habilitation CD ne...",
        "Stocke les acides dans une armoire ventilée, séparés des bases...",
    ],
}
dataset = Dataset.from_dict(data)

# 2. Lance l'évaluation
results = evaluate(
    dataset,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
        answer_correctness,
    ],
    llm=judge_llm,           # le LLM-as-judge (GPT-4o, Claude, ou ton Mistral local)
    embeddings=embedder,     # pour answer_relevancy
)

# 3. Inspecte les résultats
print(results)
# → {'faithfulness': 0.92, 'answer_relevancy': 0.88, ...}

df = results.to_pandas()
# → DataFrame avec un score par ligne (par question)
# Tu peux trier par score décroissant pour identifier les pires cas`}</code></pre>
	</section>

	<!-- 5. INTÉGRATION LANGFUSE -->
	<section id="integration" class="ragas-section">
		<h2 class="ragas-h2">5️⃣ Intégration Langfuse — éval auto sur prod</h2>
		<p>
			Le vrai pouvoir : <strong>évaluer en continu</strong> tes traces de
			prod, pas juste un dataset offline. Langfuse + RAGAS = chaque trace
			reçoit ses 5 scores RAGAS automatiquement, et tu peux alerter sur
			une chute.
		</p>
		<pre class="ragas-code"><code>{`from langfuse import Langfuse
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy

langfuse = Langfuse(host="https://langfuse.intranet")

# Récupère les traces récentes (par exemple les 1000 dernières)
traces = langfuse.fetch_traces(limit=1000, tags=["env:prod"])

# Convertis en dataset RAGAS
data = {
    "question": [t.input["query"] for t in traces],
    "contexts": [t.metadata["retrieved_contexts"] for t in traces],
    "answer": [t.output for t in traces],
    # Pas de ground_truth → on n'utilise que faithfulness et relevancy
}

results = evaluate(
    Dataset.from_dict(data),
    metrics=[faithfulness, answer_relevancy],
    llm=judge_llm,
)

# Push les scores vers Langfuse, attachés à chaque trace
df = results.to_pandas()
for trace, row in zip(traces, df.itertuples()):
    langfuse.score(
        trace_id=trace.id,
        name="ragas_faithfulness",
        value=row.faithfulness,
    )
    langfuse.score(
        trace_id=trace.id,
        name="ragas_answer_relevancy",
        value=row.answer_relevancy,
    )

# Maintenant : alerte si moyenne < seuil sur les dernières 100 traces
# → Cron job hebdomadaire dans ton K8s air-gap`}</code></pre>

		<Callout variant="insight" title="🎯 Pour ton projet souverain">
			<p>
				Tu peux utiliser Mistral 7B fine-tuné comme <strong>juge local</strong>
				pour les métriques RAGAS — pas besoin d'envoyer tes traces à
				GPT-4. Compromis qualité : un peu moins précis qu'un GPT-4 juge,
				mais 100 % air-gap.
			</p>
			<p>
				Pour les métriques sensibles (faithfulness sur du contenu CD/SD),
				utilise un Mistral plus gros (24B / Mixtral 8x7B) en juge — il
				tournera quotidiennement, pas en temps réel.
			</p>
		</Callout>
	</section>

	<!-- 6. GLOSSAIRE -->
	<section id="glossaire" class="ragas-section">
		<h2 class="ragas-h2">6️⃣ Glossaire</h2>
		<dl class="ragas-glossary">
			<div class="ragas-gl-row"><dt>Answer Correctness</dt><dd>Métrique RAGAS combinant factual correctness (vs ground truth) et similarité sémantique.</dd></div>
			<div class="ragas-gl-row"><dt>Answer Relevancy</dt><dd>Métrique RAGAS qui mesure si la réponse adresse la question. Calcul : LLM génère N questions à partir de la réponse, similarité cosinus avec la question originale.</dd></div>
			<div class="ragas-gl-row"><dt>Claim extraction</dt><dd>Étape où le LLM-judge décompose une réponse en affirmations atomiques (claims) pour les vérifier individuellement.</dd></div>
			<div class="ragas-gl-row"><dt>Context Precision</dt><dd>Métrique : parmi les contextes récupérés, lesquels sont pertinents — et bien classés ? Pondération par position.</dd></div>
			<div class="ragas-gl-row"><dt>Context Recall</dt><dd>Métrique : avons-nous récupéré tous les contextes nécessaires pour répondre selon le ground truth ?</dd></div>
			<div class="ragas-gl-row"><dt>Faithfulness</dt><dd>Métrique : la réponse est-elle ancrée dans le contexte (pas d'invention) ?</dd></div>
			<div class="ragas-gl-row"><dt>Ground truth</dt><dd>Réponse de référence fournie par un humain expert. Sert de baseline pour Context Recall et Answer Correctness.</dd></div>
			<div class="ragas-gl-row"><dt>Judge LLM</dt><dd>LLM utilisé par RAGAS pour évaluer (extraire claims, juger pertinence, etc.). Typiquement GPT-4o, Claude, ou un Mistral local pour souverain.</dd></div>
			<div class="ragas-gl-row"><dt>RAGAS</dt><dd>Retrieval-Augmented Generation Assessment. Framework Python open-source d'évaluation de RAG, sorti en 2023 (Es et al., arXiv 2309.15217).</dd></div>
		</dl>
	</section>
</article>

<style>
	.ragas { max-width: 1240px; margin: 0 auto; padding: 2rem 1rem 4rem; display: flex; flex-direction: column; gap: 2rem; }
	.ragas :global(p) { max-width: 880px; }
	.ragas-hero {
		text-align: center; padding: 2rem 1.5rem;
		background: linear-gradient(135deg, #fffbeb 0%, #fff 100%);
		border-radius: 1.5rem; border: 1px solid #facc15;
	}
	.ragas-hero-emoji { font-size: 4rem; display: block; }
	.ragas-h1 {
		font-family: var(--font-display); font-size: 2.25rem; font-weight: 700;
		color: var(--color-ink-900); margin: 0.5rem 0 0;
	}
	.ragas-hero-lead { font-size: 1rem; color: var(--color-ink-700); max-width: 640px; margin: 0.85rem auto 1.5rem; line-height: 1.6; }
	.ragas-hero-actions { display: flex; gap: 0.75rem; justify-content: center; }
	.ragas-cta {
		padding: 0.7rem 1.5rem; border-radius: 999px;
		background: #facc15; color: var(--color-ink-900); font-weight: 600;
		text-decoration: none;
	}
	.ragas-toc {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem 1.5rem;
	}
	.ragas-toc-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.1em; color: var(--color-ink-500); margin: 0 0 0.5rem;
	}
	.ragas-toc-list {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.4rem 1rem; list-style: none; padding: 0; margin: 0;
	}
	.ragas-toc-list a { color: var(--color-ink-700); text-decoration: none; font-size: 0.9rem; }
	.ragas-toc-list a:hover { color: #facc15; }

	.ragas-section { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 80px; }
	.ragas-h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-ink-900); margin: 0; }

	.ragas-prereq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem; }
	.ragas-prereq { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
	.ragas-prereq summary { cursor: pointer; padding: 0.85rem 1rem; font-family: var(--font-display); font-weight: 600; color: var(--color-ink-900); list-style: none; }
	.ragas-prereq summary::-webkit-details-marker { display: none; }
	.ragas-prereq summary::after { content: '▶'; float: right; color: var(--color-ink-500); font-size: 0.7rem; transition: transform 0.15s; }
	.ragas-prereq[open] summary::after { transform: rotate(90deg); }
	.ragas-prereq[open] summary { background: #fffbeb; border-bottom: 1px solid #e2e8f0; }
	.ragas-prereq > div { padding: 0.85rem 1rem; font-size: 0.9rem; color: var(--color-ink-700); line-height: 1.6; }

	.ragas-bug-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.6rem; }
	.ragas-bug { padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
	.ragas-bug-emoji { font-size: 1.75rem; }
	.ragas-bug strong { display: block; margin: 0.25rem 0; font-family: var(--font-display); color: var(--color-ink-900); }
	.ragas-bug p { font-size: 0.88rem; color: var(--color-ink-700); margin: 0; line-height: 1.55; }

	.ragas-metrics-table {
		width: 100%; border-collapse: collapse; font-size: 0.88rem;
		background: #fff; border-radius: 0.5rem; overflow: hidden; border: 1px solid #e2e8f0;
	}
	.ragas-metrics-table thead { background: #fffbeb; }
	.ragas-metrics-table th {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: var(--color-ink-700); text-align: left; padding: 0.55rem 0.7rem;
	}
	.ragas-metrics-table td {
		padding: 0.55rem 0.7rem; border-bottom: 1px solid #f1f5f9;
		color: var(--color-ink-700); vertical-align: top;
	}

	/* ===== Simulator ===== */
	.ragas-sim {
		background: #f8fafc; border: 1px solid #e2e8f0;
		border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem;
	}
	.ragas-sim-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.ragas-sim-tab {
		padding: 0.55rem 1rem; background: #fff; border: 2px solid #e2e8f0;
		border-radius: 999px; font-size: 0.9rem; cursor: pointer;
		display: flex; align-items: center; gap: 0.4rem;
	}
	.ragas-sim-tab:hover { border-color: #facc15; }
	.ragas-sim-tab.is-active { background: #facc15; border-color: #facc15; color: var(--color-ink-900); font-weight: 600; }

	.ragas-sim-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
	@media (max-width: 600px) { .ragas-sim-row { grid-template-columns: 1fr; } }
	.ragas-sim-card {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.6rem; padding: 0.85rem;
	}
	.ragas-sim-card-answer { background: #fefce8; border-color: #facc15; }
	.ragas-sim-label {
		font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
		color: var(--color-ink-500); letter-spacing: 0.05em; margin-bottom: 0.4rem;
	}
	.ragas-sim-content { font-size: 0.9rem; color: var(--color-ink-900); line-height: 1.55; }

	.ragas-sim-contexts { display: flex; flex-direction: column; gap: 0.4rem; }
	.ragas-sim-context {
		display: flex; gap: 0.5rem; padding: 0.5rem 0.7rem;
		background: #f8fafc; border-radius: 0.4rem;
		font-size: 0.85rem; color: var(--color-ink-700); line-height: 1.5;
	}
	.ragas-sim-context-rank {
		font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-ink-500);
		flex-shrink: 0;
	}

	.ragas-sim-metrics {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.6rem;
	}
	.ragas-sim-metric {
		background: var(--score-bg); border: 1px solid var(--score-color);
		border-radius: 0.6rem; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.4rem;
	}
	.ragas-sim-metric-head { display: flex; gap: 0.6rem; align-items: center; }
	.ragas-sim-metric-emoji { font-size: 1.4rem; }
	.ragas-sim-metric-name { font-family: var(--font-display); font-weight: 600; font-size: 0.9rem; color: var(--color-ink-900); }
	.ragas-sim-metric-score { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; color: var(--score-color); }
	.ragas-sim-metric-bar { height: 8px; background: rgba(0,0,0,0.08); border-radius: 999px; overflow: hidden; }
	.ragas-sim-metric-fill { height: 100%; background: var(--score-color); transition: width 0.4s; }
	.ragas-sim-metric-reasoning { font-size: 0.82rem; color: var(--color-ink-700); line-height: 1.5; }

	.ragas-sim-verdict {
		display: flex; gap: 0.85rem; padding: 1rem 1.25rem;
		border-radius: 0.6rem; font-size: 0.92rem; line-height: 1.6;
	}
	.ragas-sim-verdict-good { background: #f0fdf4; border: 1px solid #16a34a; color: #14532d; }
	.ragas-sim-verdict-hallucination { background: #fef2f2; border: 1px solid #dc2626; color: #7f1d1d; }
	.ragas-sim-verdict-off-topic { background: #fff7ed; border: 1px solid #fb923c; color: #7c2d12; }
	.ragas-sim-verdict-bad-retrieval { background: #faf5ff; border: 1px solid #a855f7; color: #581c87; }
	.ragas-sim-verdict-emoji { font-size: 1.75rem; flex-shrink: 0; }
	.ragas-sim-verdict-title { font-family: var(--font-display); font-weight: 700; margin-bottom: 0.25rem; }

	.ragas-code {
		background: #1a1a1a; color: #e2e8f0; padding: 0.85rem 1rem;
		border-radius: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem;
		line-height: 1.6; margin: 0.5rem 0;
		white-space: pre-wrap; word-break: break-word;
	}
	.ragas-glossary { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.ragas-gl-row {
		background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem;
		padding: 0.65rem 1rem; display: grid; grid-template-columns: 200px 1fr; gap: 1rem;
	}
	.ragas-gl-row dt { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: #facc15; }
	.ragas-gl-row dd { font-size: 0.88rem; color: var(--color-ink-700); line-height: 1.55; margin: 0; }
	@media (max-width: 600px) { .ragas-gl-row { grid-template-columns: 1fr; gap: 0.25rem; } }
</style>
