/**
 * attention-sample.ts — Jeu de données d'exemple pour la visualisation d'attention.
 *
 * NOTE pédagogique : ces matrices ne sortent PAS d'un vrai modèle.
 * Elles sont *inspirées* de patterns réels observés dans les analyses
 * d'attention publiées (notamment BertViz, Vig 2019, et les travaux d'Elhage 2021
 * sur l'interprétabilité mécaniste). On les fabrique à la main pour qu'elles
 * racontent une histoire lisible à un débutant :
 *   - Une tête "syntaxique" : chaque mot regarde surtout son voisin gauche.
 *   - Une tête "sémantique" : les mots liés par le sens s'attirent
 *     (ex: "chat" et "dort", "tapis" et "rouge").
 *
 * C'est un choix didactique assumé : montrer le concept, pas la réalité
 * d'un modèle donné. On le dit clairement dans le texte de la page.
 */

export interface AttentionHead {
	/** Identifiant unique de la tête. */
	id: string;
	/** Nom humain — ce que cette tête "apprend" (simplification). */
	name: string;
	/** Emoji représentatif pour le sélecteur. */
	emoji: string;
	/** Rôle en une phrase, affiché à côté du sélecteur. */
	description: string;
	/** Matrice d'attention N×N. matrix[i][j] = attention du token i vers le token j.
	 *  Chaque ligne somme (approximativement) à 1.0. */
	matrix: number[][];
}

/** Phrase d'exemple — suffisamment courte pour rester lisible (8 tokens). */
export const SAMPLE_TOKENS = ['Le', 'chat', 'noir', 'dort', 'sur', 'le', 'tapis', 'rouge'];

/**
 * Deux têtes d'attention fabriquées pour illustrer le multi-head :
 * chaque tête "voit" un aspect différent du langage.
 */
export const SAMPLE_HEADS: AttentionHead[] = [
	{
		id: 'syntax',
		name: 'Tête « syntaxique »',
		emoji: '🔗',
		description: 'Chaque mot regarde surtout le mot qui le précède (voisinage).',
		matrix: [
			//  Le     chat   noir   dort   sur    le     tapis  rouge
			[0.7, 0.1, 0.05, 0.05, 0.03, 0.03, 0.02, 0.02], // Le
			[0.6, 0.3, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01], // chat
			[0.1, 0.7, 0.15, 0.02, 0.01, 0.01, 0.005, 0.005], // noir
			[0.05, 0.1, 0.7, 0.1, 0.02, 0.01, 0.01, 0.01], // dort
			[0.02, 0.05, 0.08, 0.7, 0.1, 0.02, 0.02, 0.01], // sur
			[0.02, 0.02, 0.05, 0.1, 0.7, 0.08, 0.02, 0.01], // le
			[0.01, 0.02, 0.02, 0.05, 0.1, 0.7, 0.08, 0.02], // tapis
			[0.01, 0.01, 0.02, 0.02, 0.05, 0.1, 0.7, 0.09] // rouge
		]
	},
	{
		id: 'semantic',
		name: 'Tête « sémantique »',
		emoji: '🧩',
		description: 'Les mots liés par le sens s\'attirent (chat ↔ dort, tapis ↔ rouge).',
		matrix: [
			//  Le     chat   noir   dort   sur    le     tapis  rouge
			[0.2, 0.3, 0.15, 0.1, 0.05, 0.1, 0.05, 0.05], // Le
			[0.05, 0.2, 0.35, 0.3, 0.03, 0.02, 0.03, 0.02], // chat → noir, dort
			[0.02, 0.55, 0.15, 0.2, 0.02, 0.02, 0.02, 0.02], // noir → chat
			[0.03, 0.5, 0.05, 0.1, 0.15, 0.05, 0.1, 0.02], // dort → chat, sur, tapis
			[0.02, 0.05, 0.02, 0.35, 0.1, 0.05, 0.35, 0.06], // sur → dort, tapis
			[0.05, 0.03, 0.02, 0.05, 0.15, 0.1, 0.55, 0.05], // le → tapis
			[0.03, 0.05, 0.02, 0.15, 0.1, 0.1, 0.15, 0.4], // tapis → rouge
			[0.02, 0.05, 0.05, 0.03, 0.02, 0.03, 0.65, 0.15] // rouge → tapis
		]
	}
];
