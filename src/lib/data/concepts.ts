/**
 * concepts.ts — Métadonnées des concepts couverts par l'application.
 *
 * Phase 1 : les 3 "pages léchées" — Transformer, RAG, ReAct.
 * Phase 2 (plus tard) : les 8 autres papiers du corpus.
 *
 * Cette source unique alimente :
 *   - la page d'accueil (cartes cliquables),
 *   - l'en-tête de chaque page de concept,
 *   - la carte de navigation entre concepts.
 */

export type ConceptLayer = 'architecture' | 'capability' | 'agentic' | 'training';

export interface Concept {
	/** Slug URL et identifiant — ex: "transformer" → /transformer */
	slug: string;
	/** Titre affiché. */
	title: string;
	/** Sous-titre / phrase d'accroche. */
	tagline: string;
	/** Emoji associé — repère visuel constant. */
	emoji: string;
	/** Couche pédagogique (architecture, capacité, agentique). */
	layer: ConceptLayer;
	/** Papier source : titre + auteurs principaux. */
	paper: {
		title: string;
		authors: string;
		year: number;
		arxivId: string;
	};
	/** Phase dans le plan — 1 = golden page, 2 = à décliner plus tard. */
	phase: 1 | 2;
	/** Slugs des concepts prérequis (pour la carte de dépendances). */
	prerequisites: string[];
}

export const CONCEPTS: Concept[] = [
	{
		slug: 'transformer',
		title: 'Le Transformer',
		tagline: "L'architecture qui a tout changé — l'attention comme seule primitive.",
		emoji: '🧠',
		layer: 'architecture',
		paper: {
			title: 'Attention Is All You Need',
			authors: 'Vaswani et al.',
			year: 2017,
			arxivId: '1706.03762'
		},
		phase: 1,
		prerequisites: []
	},
	{
		slug: 'react',
		title: 'ReAct — Reasoning + Acting',
		tagline: 'Quand le modèle alterne pensée et action pour résoudre des tâches complexes.',
		emoji: '🔄',
		layer: 'agentic',
		paper: {
			title: 'ReAct: Synergizing Reasoning and Acting in Language Models',
			authors: 'Yao et al.',
			year: 2022,
			arxivId: '2210.03629'
		},
		phase: 1,
		prerequisites: ['transformer']
	},
	{
		slug: 'unsloth',
		title: 'Unsloth — Fine-tuner sans se ruiner',
		tagline: 'Lab pratique : entraîne ton premier LLM sur ton propre dataset, en 4 bits, sur un GPU modeste.',
		emoji: '🦥',
		layer: 'training',
		paper: {
			title: 'Unsloth — Open-source toolkit for efficient LLM fine-tuning',
			authors: 'Han & Han',
			year: 2024,
			arxivId: 'unsloth.ai/docs'
		},
		phase: 1,
		prerequisites: ['transformer']
	},
	{
		slug: 'langgraph',
		title: 'LangGraph — Orchestrer des agents stateful',
		tagline: 'Construis des agents qui raisonnent en boucle, appellent des outils, gardent une mémoire — avec un simulateur interactif.',
		emoji: '🦜',
		layer: 'agentic',
		paper: {
			title: 'LangGraph — Stateful agent orchestration framework',
			authors: 'LangChain team',
			year: 2024,
			arxivId: 'langchain-ai.github.io/langgraph'
		},
		phase: 1,
		prerequisites: ['transformer', 'react']
	},
	{
		slug: 'mcp',
		title: 'MCP — Model Context Protocol',
		tagline: "L'USB-C des LLMs. Un protocole standardisé pour brancher tout outil à tout agent.",
		emoji: '🔌',
		layer: 'agentic',
		paper: {
			title: 'Model Context Protocol — Anthropic',
			authors: 'Anthropic',
			year: 2024,
			arxivId: 'modelcontextprotocol.io'
		},
		phase: 1,
		prerequisites: ['langgraph']
	},
	{
		slug: 'rag',
		title: 'RAG avec Milvus',
		tagline: 'Donner au LLM une bibliothèque qu\'il peut consulter. Architecture complète + intégration LangGraph défense.',
		emoji: '📚',
		layer: 'agentic',
		paper: {
			title: 'Retrieval-Augmented Generation — Lewis et al. + Milvus 2.x',
			authors: 'Lewis 2020 / milvus.io',
			year: 2020,
			arxivId: '2005.11401'
		},
		phase: 1,
		prerequisites: ['transformer', 'langgraph']
	},
	{
		slug: 'litellm',
		title: 'LiteLLM — Une seule interface, 100+ LLMs',
		tagline: 'Bascule entre OpenAI / Anthropic / Mistral / Ollama sans changer ton code. + proxy gateway, fallbacks, cost tracking.',
		emoji: '⚡',
		layer: 'agentic',
		paper: {
			title: 'LiteLLM — Open-source unified LLM gateway',
			authors: 'BerriAI',
			year: 2024,
			arxivId: 'litellm.ai'
		},
		phase: 1,
		prerequisites: ['transformer']
	},
	{
		slug: 'observability',
		title: 'Observability — Langfuse & LangSmith',
		tagline: 'Tracer, évaluer, déboguer tes agents LLM en production. Comparaison + intégration LangGraph + setup self-hosted souverain.',
		emoji: '📊',
		layer: 'agentic',
		paper: {
			title: 'Langfuse (open-source) & LangSmith (LangChain)',
			authors: 'langfuse.com / smith.langchain.com',
			year: 2024,
			arxivId: 'langfuse.com'
		},
		phase: 1,
		prerequisites: ['langgraph']
	},
	{
		slug: 'ragas',
		title: 'RAGAS — Évaluer un RAG rigoureusement',
		tagline: '5 métriques automatisées (faithfulness, relevancy, context precision/recall) avec simulateur interactif.',
		emoji: '📐',
		layer: 'agentic',
		paper: {
			title: 'RAGAS: Automated Evaluation of Retrieval Augmented Generation',
			authors: 'Es et al.',
			year: 2024,
			arxivId: '2309.15217'
		},
		phase: 1,
		prerequisites: ['langgraph']
	},
	{
		slug: 'vllm',
		title: 'vLLM — Serveur d\'inférence haute performance',
		tagline: 'PagedAttention + continuous batching pour servir 24× plus de requêtes par GPU. Avec simulateur de batching.',
		emoji: '🚀',
		layer: 'training',
		paper: {
			title: 'Efficient Memory Management for LLM Serving with PagedAttention',
			authors: 'Kwon et al.',
			year: 2023,
			arxivId: '2309.06180'
		},
		phase: 1,
		prerequisites: ['transformer']
	},
	{
		slug: 'graphrag',
		title: 'GraphRAG — RAG par graphes pour le sensemaking global',
		tagline: 'Quand vector RAG échoue sur "quels sont les thèmes principaux ?". Microsoft Research 2024, knowledge graphs + communautés hiérarchiques.',
		emoji: '🕸️',
		layer: 'agentic',
		paper: {
			title: 'From Local to Global: A GraphRAG Approach to Query-Focused Summarization',
			authors: 'Edge et al. (Microsoft)',
			year: 2024,
			arxivId: '2404.16130'
		},
		phase: 1,
		prerequisites: ['rag']
	}
];

/** Accès rapide par slug. */
export const CONCEPT_BY_SLUG: Record<string, Concept> = Object.fromEntries(
	CONCEPTS.map((c) => [c.slug, c])
);
