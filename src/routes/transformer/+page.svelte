<!--
	/transformer — Page du concept "Transformer"
	============================================
	Structure : 6 sections de Bloom, chacune remplie.
	Le cœur (étape 3 Appliquer) contient deux visualisations complémentaires :
	  1. TransformerPipeline : pipeline complet, prompt → token
	  2. AttentionViz : zoom sur une tête d'attention

	Ancrages : Vaswani et al. 2017 (arXiv:1706.03762) §3.1–3.5
	           Cho et al. 2024 (arXiv:2408.04619) §2
-->
<script lang="ts">
	import AttentionViz from '$lib/components/concepts/AttentionViz.svelte';
	import BloomSection from '$lib/components/BloomSection.svelte';
	import Callout from '$lib/components/Callout.svelte';
	import ConceptPage from '$lib/components/ConceptPage.svelte';
	import KVCacheExplainer from '$lib/components/concepts/KVCacheExplainer.svelte';
	import RolesExplainer from '$lib/components/concepts/RolesExplainer.svelte';
	import SamplingParamsPlayground from '$lib/components/concepts/SamplingParamsPlayground.svelte';
	import TransformerPipeline from '$lib/components/concepts/TransformerPipeline.svelte';
	import { CONCEPT_BY_SLUG } from '$lib/data/concepts';

	const concept = CONCEPT_BY_SLUG.transformer;
</script>

<ConceptPage {concept}>
	<!-- =========================================================
	     1. RETENIR
	     ========================================================= -->
	<BloomSection level="remember">
		<p class="lead !mb-0 text-xl leading-relaxed">
			Le <strong>Transformer</strong> est une architecture de réseau de neurones
			qui traite <strong>tous les tokens d'une séquence en parallèle</strong>
			grâce à un mécanisme d'<em>attention</em> : chaque token regarde tous les
			autres pour en pondérer l'importance, puis combine l'information
			contextuelle avant de passer à la couche suivante.
		</p>
	</BloomSection>

	<!-- =========================================================
	     2. COMPRENDRE — Analogie de la table ronde
	     ========================================================= -->
	<BloomSection level="understand">
		<p>
			Imagine une <strong>table ronde de conseil d'administration</strong>.
			Quand un membre prend la parole, il ne regarde pas juste son voisin : il
			regarde <strong>tout le monde</strong>. Et surtout, il
			<em>ne les écoute pas tous autant</em>. Sur une question finance, il
			écoute davantage le CFO que le directeur marketing.
		</p>
		<p>Le Transformer fait exactement ça, à chaque étage du modèle :</p>
		<ul>
			<li>
				👥 <strong>Chaque token</strong> = un membre de la table ronde (un
				vecteur de 768 dimensions pour GPT-2).
			</li>
			<li>
				👀 <strong>L'attention</strong> = combien chaque token « écoute »
				chacun des autres, sous forme de poids probabilistes.
			</li>
			<li>
				🧠 <strong>12 têtes en parallèle</strong> = 12 « lectures »
				simultanées de la même phrase, chacune spécialisée sur un aspect
				(syntaxe, sémantique, coréférence…).
			</li>
			<li>
				🔁 <strong>12 étages empilés</strong> = on refait la table ronde 12
				fois, chaque étage raffinant les représentations.
			</li>
		</ul>

		<Callout variant="insight" title="Avant le Transformer : le téléphone arabe">
			<p>
				Les modèles précédents (RNN, LSTM) fonctionnaient comme un téléphone
				arabe : chaque mot ne parlait qu'à son voisin, l'information devait
				voyager de proche en proche, se dégradant sur les phrases longues. Le
				Transformer brise ce goulot : <strong
					>tout le monde se parle, directement, en même temps</strong
				> — d'où la parallélisation massive sur GPU.
			</p>
		</Callout>
	</BloomSection>

	<!-- =========================================================
	     3. APPLIQUER — LE PIPELINE COMPLET + ZOOM ATTENTION
	     ========================================================= -->
	<BloomSection level="apply">
		<h3 class="text-ink-900 mt-0 mb-3 text-xl font-semibold">
			🔭 Vue d'ensemble — le pipeline complet
		</h3>
		<p>
			Voici tout le parcours d'un prompt, de sa saisie jusqu'au prochain
			token généré. <strong>Clique sur chaque étape pour la déplier</strong> —
			tu verras les formules, les dimensions, et des mini-visualisations.
			C'est la structure exacte d'un GPT-2 small (12 couches, 12 têtes,
			768 dimensions).
		</p>

		<div class="my-6 not-prose">
			<TransformerPipeline />
		</div>

		<Callout variant="note" title="Pourquoi décodeur-seul (GPT) plutôt qu'encodeur-décodeur (Vaswani) ?">
			<p>
				Vaswani et al. (2017) décrivent un Transformer <strong>encodeur-décodeur</strong>
				conçu pour la traduction (un bloc lit l'anglais, l'autre produit le
				français). Tous les LLM modernes (GPT, LLaMA, Mistral) utilisent la
				version <strong>décodeur-seul</strong>, plus simple : un seul stack
				de blocs, entraîné à prédire le token suivant. C'est cette version
				qu'on illustre ici, comme le fait le Transformer Explainer de
				Poloclub (arXiv:2408.04619).
			</p>
		</Callout>

		<!-- Pont narratif vers les paramètres de génération -->
		<h3 class="text-ink-900 mt-8 mb-3 text-xl font-semibold">
			🎛️ Et tous les autres paramètres qu'on voit dans les API ?
		</h3>
		<p>
			Dans le tour, on a vu la <strong>température</strong>. Mais quand tu
			regardes la doc de l'API OpenAI, Claude ou vLLM, tu vois aussi
			<em>top_k</em>, <em>top_p</em>, <em>min_p</em>,
			<em>repetition_penalty</em>… Tous ces paramètres agissent sur le même
			moment : le <strong>tirage du prochain token</strong>. Voici un
			playground pour les manipuler en direct et voir qui coupe qui.
		</p>

		<div class="my-6 not-prose">
			<SamplingParamsPlayground />
		</div>

		<!-- Pont narratif vers le KV cache -->
		<h3 class="text-ink-900 mt-8 mb-3 text-xl font-semibold">
			🧠 Et pourquoi la génération ralentit sur les longs prompts ?
		</h3>
		<p>
			Les paramètres précédents agissent à <em>chaque</em> token. Le KV cache,
			lui, est une optimisation d'<strong>architecture d'inférence</strong>
			qui explique pourquoi un modèle devient lent quand le contexte s'allonge
			— et pourquoi la mémoire de ton GPU est souvent le goulot d'étranglement.
		</p>

		<div class="my-6 not-prose">
			<KVCacheExplainer />
		</div>

		<!-- Pont narratif vers les rôles de conversation -->
		<h3 class="text-ink-900 mt-8 mb-3 text-xl font-semibold">
			🎭 Et quand tu chats avec un LLM, d'où viennent les rôles ?
		</h3>
		<p>
			Le tour ci-dessus montre comment le modèle prédit <em>le prochain
				token</em>. Mais quand tu utilises ChatGPT ou Claude, tu ne tapes pas
			juste un prompt brut — il y a <strong>trois rôles</strong> en jeu :
			<em>system</em>, <em>user</em>, <em>assistant</em>. Ces rôles ne sont pas
			une propriété du Transformer lui-même : ce sont des conventions de
			formatage ajoutées après l'architecture de base.
		</p>

		<div class="my-6 not-prose">
			<RolesExplainer />
		</div>

		<h3 class="text-ink-900 mt-8 mb-3 text-xl font-semibold">
			🔬 Zoom — les patterns d'attention
		</h3>
		<p>
			L'étape 4b du pipeline mérite un zoom dédié. Sur une même phrase,
			observe comment <strong>deux têtes différentes</strong> captent des
			relations différentes. Clique un token du haut, change de tête, compare.
		</p>

		<div class="my-6 not-prose">
			<AttentionViz />
		</div>

		<Callout variant="warning" title="Les chiffres sont stylisés">
			<p>
				Les matrices d'attention ici et dans l'embedding du pipeline sont
				<strong>fabriquées à la main</strong> pour rendre le concept lisible.
				Pour voir de vraies attentions en direct, tu peux aller sur
				<a
					href="https://poloclub.github.io/transformer-explainer/"
					target="_blank"
					rel="noopener noreferrer"
					class="text-hf-amber underline">le Transformer Explainer</a
				>, qui fait tourner un vrai GPT-2 dans le navigateur.
			</p>
		</Callout>
	</BloomSection>

	<!-- =========================================================
	     4. ANALYSER — Pourquoi ces choix ?
	     ========================================================= -->
	<BloomSection level="analyze">
		<p>
			Chaque décision de design a une raison — souvent un <em>trade-off</em>
			entre expressivité et coût. Cinq points qui valent le détour :
		</p>

		<h3 class="text-ink-900 mt-6 mb-2 text-lg font-semibold">
			1. Attention vs RNN — pourquoi on a quitté la séquentialité
		</h3>
		<p>
			Un RNN traite les mots <strong>un à un</strong> : <code>h_t = f(h_{'{'}t-1{'}'}, x_t)</code>.
			Impossible de paralléliser le temps. L'attention, elle, calcule
			<strong>toutes les relations en une multiplication matricielle</strong>
			<code>QKᵀ</code> — parfait pour GPU. Chaque token peut « voir » tous
			les autres sans perte de signal sur les longues distances.
		</p>

		<h3 class="text-ink-900 mt-6 mb-2 text-lg font-semibold">
			2. Pourquoi {12} têtes et non une seule ?
		</h3>
		<p>
			Vaswani observe (§3.2.2) qu'une tête unique apprend
			<em>une</em> seule manière de relier les tokens. Avec plusieurs têtes en
			parallèle, projetées dans des <strong>sous-espaces différents</strong>,
			chaque tête peut se spécialiser. En pratique : coréférence, dépendances
			syntaxiques, proximité positionnelle, etc. On concatène à la sortie →
			signal plus riche pour la suite. Le coût compute reste constant grâce au
			découpage des dimensions (12 × 64 = 768).
		</p>

		<h3 class="text-ink-900 mt-6 mb-2 text-lg font-semibold">
			3. Pourquoi le <code>/√dₖ</code> ? (§3.2.1)
		</h3>
		<p>
			Sans normalisation, les produits scalaires <code>Q·Kᵀ</code> grossissent
			avec <code>dₖ</code> (effet <em>concentration of measure</em>). Résultat
			: softmax sature, une seule entrée capte presque toute la probabilité,
			les gradients s'annulent ailleurs. Diviser par <code>√dₖ</code> maintient
			les logits dans une plage « douce ». C'est une ligne de code, elle sauve
			l'entraînement.
		</p>

		<h3 class="text-ink-900 mt-6 mb-2 text-lg font-semibold">
			4. Pourquoi les connexions résiduelles + LayerNorm ?
		</h3>
		<p>
			Sans résidus, un modèle à 12 couches ne s'entraînerait pas — les
			gradients se perdent en remontant. Les connexions <code>x + Sublayer(x)</code>
			(inspirées de ResNet, He et al. 2016) créent une « autoroute du
			gradient ». LayerNorm stabilise la variance des activations à chaque
			étage. Sans ces deux astuces, pas de modèle profond possible.
		</p>

		<h3 class="text-ink-900 mt-6 mb-2 text-lg font-semibold">
			5. Pourquoi le FFN concentre 2/3 des paramètres ?
		</h3>
		<p>
			Le FFN (§3.3) a une largeur interne <code>d_ff = 4 × d_model</code>. À
			768 → 3072 → 768, il contient <code>2 × 768 × 3072 ≈ 4.7M</code>
			paramètres <em>par couche</em>. Sur 12 couches, c'est <code>~56M</code>.
			L'attention, elle, n'a que <code>4 × 768² ≈ 2.4M</code> par couche
			(les 4 matrices <code>W^Q, W^K, W^V, W^O</code>). Conclusion : la
			<strong>mémoire factuelle</strong> du modèle vit surtout dans les FFN ;
			l'attention fait le routage.
		</p>
	</BloomSection>

	<!-- =========================================================
	     5. ÉVALUER — Limites & pièges
	     ========================================================= -->
	<BloomSection level="evaluate">
		<p>Le Transformer n'est pas une baguette magique. Cinq limites structurelles :</p>

		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<div class="rounded-xl border border-slate-200 bg-white p-5">
				<div class="mb-2 text-3xl" aria-hidden="true">💾</div>
				<h4 class="text-ink-900 font-semibold">Coût quadratique en mémoire</h4>
				<p class="text-ink-700 mt-1 text-sm">
					L'attention stocke une matrice <em>N×N</em> par tête — doubler le
					contexte quadruple la mémoire. Motif direct de
					<strong>FlashAttention</strong> (Dao 2022, prochain papier du
					corpus), qui réécrit le calcul par blocs sans jamais matérialiser
					la matrice complète.
				</p>
			</div>

			<div class="rounded-xl border border-slate-200 bg-white p-5">
				<div class="mb-2 text-3xl" aria-hidden="true">🔑</div>
				<h4 class="text-ink-900 font-semibold">Redondance des têtes K/V</h4>
				<p class="text-ink-700 mt-1 text-sm">
					Chaque tête a son propre <em>K</em> et <em>V</em> — coûteux à
					décoder. <strong>GQA</strong> (Ainslie 2023) partage K/V entre
					plusieurs têtes : presque la même qualité, mémoire divisée.
				</p>
			</div>

			<div class="rounded-xl border border-slate-200 bg-white p-5">
				<div class="mb-2 text-3xl" aria-hidden="true">📏</div>
				<h4 class="text-ink-900 font-semibold">Contexte borné</h4>
				<p class="text-ink-700 mt-1 text-sm">
					Au-delà de la longueur d'entraînement, la qualité chute
					(extrapolation positionnelle). <strong>RoPE</strong> et
					<strong>ALiBi</strong> atténuent sans éliminer. D'où les stratégies
					de RAG pour sortir de la mémoire « collée aux poids ».
				</p>
			</div>

			<div class="rounded-xl border border-slate-200 bg-white p-5">
				<div class="mb-2 text-3xl" aria-hidden="true">🌫️</div>
				<h4 class="text-ink-900 font-semibold">Pas de « vraie » compréhension</h4>
				<p class="text-ink-700 mt-1 text-sm">
					La sortie est <em>statistiquement plausible</em>, pas <em>vraie</em>
					. Les hallucinations sont structurelles — d'où les guardrails et
					le retrieval (RAG, prochain chapitre).
				</p>
			</div>

			<div class="rounded-xl border border-slate-200 bg-white p-5 md:col-span-2">
				<div class="mb-2 text-3xl" aria-hidden="true">⚡</div>
				<h4 class="text-ink-900 font-semibold">Coût énergétique énorme</h4>
				<p class="text-ink-700 mt-1 text-sm">
					Entraîner GPT-3 (175 B) = plusieurs GWh ; inférer à grande échelle
					= des centres de données entiers. Les papiers suivants (LLaMA,
					InstructGPT, FlashAttention) cherchent tous, à différents endroits
					de la pile, à <strong>faire plus avec moins</strong>.
				</p>
			</div>
		</div>
	</BloomSection>

	<!-- =========================================================
	     6. CRÉER — Mini-défi
	     ========================================================= -->
	<BloomSection level="create">
		<p>Trois scénarios pour tester ta compréhension :</p>

		<Callout variant="insight" title="🧪 Expérience 1 — Le /√dₖ qui disparaît">
			<p>
				On retire la division par <code>√dₖ</code> de la formule d'attention,
				avec <code>dₖ = 64</code>. Les produits scalaires <code>Q·Kᵀ</code>
				montent vers des valeurs de ~40.
			</p>
			<p class="mt-2"><strong>Question</strong> : que devient le softmax ?</p>
		</Callout>

		<details class="mt-3 rounded-xl border border-slate-200 bg-white p-4">
			<summary class="text-ink-900 cursor-pointer font-medium">
				💭 Déroule pour vérifier
			</summary>
			<div class="text-ink-700 mt-3 text-sm leading-relaxed">
				<p>
					Softmax devient <strong>hyper-piqué</strong> : ≈ 1.0 sur un seul
					token, ≈ 0 partout ailleurs. On perd l'aspect « moyenne pondérée »
					et les gradients s'annulent — <em>vanishing gradient</em>. Diviser
					par <code>√dₖ</code> ramène les logits dans une plage où softmax
					reste souple.
				</p>
			</div>
		</details>

		<Callout variant="insight" title="🧪 Expérience 2 — La température à 0.0">
			<p>
				Dans le pipeline ci-dessus, descends la température à 0.10. Que se
				passe-t-il pour la distribution ? Quelle est la conséquence pour la
				créativité du modèle ?
			</p>
		</Callout>

		<details class="mt-3 rounded-xl border border-slate-200 bg-white p-4">
			<summary class="text-ink-900 cursor-pointer font-medium">
				💭 Déroule pour vérifier
			</summary>
			<div class="text-ink-700 mt-3 text-sm leading-relaxed">
				<p>
					La distribution devient <strong>presque déterministe</strong> : le
					top-1 capte ~100 %, tout le reste passe à 0. Conséquence : le même
					prompt donnera toujours le même token → sortie <em>reproductible</em>
					mais <em>sans surprise</em>. Utile pour du code ou des
					résumés factuels ; fade pour de la rédaction créative.
				</p>
			</div>
		</details>

		<Callout variant="insight" title="🧪 Expérience 3 — Combien coûte doubler le contexte ?">
			<p>
				On passe <code>N</code> (longueur de séquence) de 1 024 à 2 048 tokens,
				toutes autres choses égales. De combien augmente la <strong
					>mémoire de l'attention</strong
				> ?
			</p>
		</Callout>

		<details class="mt-3 rounded-xl border border-slate-200 bg-white p-4">
			<summary class="text-ink-900 cursor-pointer font-medium">
				💭 Déroule pour vérifier
			</summary>
			<div class="text-ink-700 mt-3 text-sm leading-relaxed">
				<p>
					Mémoire d'attention ∝ <code>N²</code>. Doubler <code>N</code> →
					<strong>×4</strong>. On passe de ~1 M d'entrées par tête à ~4 M.
					Sur 12 têtes × 12 couches, c'est ~576 M d'entrées stockées
					simultanément. C'est exactement le mur qu'attaque FlashAttention :
					même calcul, mais sans jamais matérialiser cette matrice.
				</p>
			</div>
		</details>

		<Callout variant="note" title="Pour aller plus loin">
			<p>
				Dans la suite du corpus, on verra <strong>FlashAttention</strong>
				(optimisation I/O), <strong>GQA</strong> (réduction mémoire K/V),
				<strong>RAG</strong> (mémoire externe consultable), et la boucle
				<strong>ReAct</strong> (raisonnement + action). Chacun attaque l'une
				des limites vues à l'étape 5.
			</p>
		</Callout>
	</BloomSection>
</ConceptPage>
