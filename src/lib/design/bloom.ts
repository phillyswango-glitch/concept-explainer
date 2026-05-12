/**
 * bloom.ts — Les 6 niveaux de la taxonomie de Bloom (révisée, Anderson 2001).
 *
 * Chaque page de concept structure son contenu selon ces 6 étages, du plus
 * simple (Retenir) au plus complexe (Créer). Cette progression garantit que
 * l'apprenant monte en profondeur cognitive plutôt que de plonger d'emblée
 * dans le technique.
 *
 * Ces données sont consommées par <BloomSection> et par la table des
 * matières de chaque page de concept.
 */

export type BloomLevelId =
	| 'remember'
	| 'understand'
	| 'apply'
	| 'analyze'
	| 'evaluate'
	| 'create';

export interface BloomLevel {
	/** Identifiant machine — sert aussi d'ancre URL (#remember, #apply…). */
	id: BloomLevelId;
	/** Position dans la progression (1 à 6). */
	order: number;
	/** Titre affiché dans la section — formulé pour parler à l'apprenant. */
	title: string;
	/** Verbe pédagogique officiel de Bloom — ce que l'apprenant *fait*. */
	verb: string;
	/** Emoji — registre HuggingFace, repère visuel constant. */
	emoji: string;
	/** Rôle cognitif de cette étape — à quoi elle sert. */
	cognitiveRole: string;
	/** Classe de couleur Tailwind (sans le préfixe "bg-"). */
	colorToken: string;
}

export const BLOOM_LEVELS: BloomLevel[] = [
	{
		id: 'remember',
		order: 1,
		title: 'En une phrase',
		verb: 'Retenir',
		emoji: '🎴',
		cognitiveRole: 'Mémoriser la définition nue, activable à chaud.',
		colorToken: 'bloom-remember'
	},
	{
		id: 'understand',
		order: 2,
		title: 'Dans la vie réelle',
		verb: 'Comprendre',
		emoji: '🌍',
		cognitiveRole: 'Relier le concept abstrait à une analogie du quotidien.',
		colorToken: 'bloom-understand'
	},
	{
		id: 'apply',
		order: 3,
		title: 'Manipule-le toi-même',
		verb: 'Appliquer',
		emoji: '🎮',
		cognitiveRole: 'Agir sur un modèle interactif et voir les effets en direct.',
		colorToken: 'bloom-apply'
	},
	{
		id: 'analyze',
		order: 4,
		title: 'Pourquoi ce choix ?',
		verb: 'Analyser',
		emoji: '🔍',
		cognitiveRole: 'Décortiquer les décisions de design et les comparer aux alternatives.',
		colorToken: 'bloom-analyze'
	},
	{
		id: 'evaluate',
		order: 5,
		title: 'Limites & pièges',
		verb: 'Évaluer',
		emoji: '⚖️',
		cognitiveRole: 'Juger les bornes de validité, repérer les faiblesses.',
		colorToken: 'bloom-evaluate'
	},
	{
		id: 'create',
		order: 6,
		title: 'À toi de jouer',
		verb: 'Créer',
		emoji: '🏗️',
		cognitiveRole: 'Mini-défi qui force à synthétiser ce qui précède.',
		colorToken: 'bloom-create'
	}
];

/** Index par id — pratique pour accès O(1) dans les composants. */
export const BLOOM_BY_ID: Record<BloomLevelId, BloomLevel> = Object.fromEntries(
	BLOOM_LEVELS.map((l) => [l.id, l])
) as Record<BloomLevelId, BloomLevel>;
