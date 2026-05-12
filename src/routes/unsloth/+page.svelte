<!--
	/unsloth — Lab d'apprentissage Unsloth.

	Conçu comme une montée en compétence pas-à-pas pour un débutant motivé.
	Chaque concept est expliqué en 3 niveaux (DifficultyTabs). Glossaire
	complet à la fin. La sœur de cette page (/unsloth/atelier) accompagne
	l'entraînement réel d'un premier modèle.

	Sources : https://unsloth.ai/docs et la doc PEFT/HuggingFace.
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';
	import DifficultyTabs from '$lib/components/DifficultyTabs.svelte';
	import CrossEntropySim from '$lib/components/concepts/CrossEntropySim.svelte';
	import GradientDescentSim from '$lib/components/concepts/GradientDescentSim.svelte';
	import LossCurveSim from '$lib/components/concepts/LossCurveSim.svelte';
	import MathBlock from '$lib/components/MathBlock.svelte';
</script>

<svelte:head>
	<title>Unsloth — Lab d'apprentissage</title>
</svelte:head>

<article class="unsl">
	<!-- ================== HÉROS ================== -->
	<header class="unsl-hero">
		<span class="unsl-hero-emoji" aria-hidden="true">🦥</span>
		<h1 class="unsl-h1">Unsloth — Lab d'apprentissage</h1>
		<p class="unsl-hero-lead">
			Tu vas apprendre à <strong>fine-tuner un LLM</strong> sur ton propre
			dataset, en 4 bits, sur un GPU modeste — sans rien y connaître au
			départ.
		</p>
		<div class="unsl-hero-actions">
			<a href="#fondamentaux" class="unsl-cta unsl-cta-primary">
				🚀 Démarrer la lecture
			</a>
			<a href="/unsloth/atelier" class="unsl-cta unsl-cta-secondary">
				🛠️ Aller à l'atelier pratique
			</a>
		</div>
	</header>

	<!-- ================== TABLE DES MATIÈRES ================== -->
	<nav class="unsl-toc" aria-label="Table des matières">
		<p class="unsl-toc-label">📍 Parcours en 12 étapes</p>
		<ol class="unsl-toc-list">
			<li><a href="#prerequis">0. Avant de commencer (briques de base)</a></li>
			<li><a href="#pourquoi">1. Pourquoi Unsloth ?</a></li>
			<li><a href="#decision">2. Quand fine-tuner ?</a></li>
			<li><a href="#fondamentaux">3. Les fondamentaux</a></li>
			<li><a href="#magie">4. La magie d'Unsloth</a></li>
			<li><a href="#nvidia">4½. Unsloth × NVIDIA (mai 2026)</a></li>
			<li><a href="#dataset">5. Préparer un dataset</a></li>
			<li><a href="#hyperparams">6. Les hyperparamètres</a></li>
			<li><a href="#methodes">7. Les méthodes (SFT, DPO…)</a></li>
			<li><a href="#cas-usage">7½. Cas d'usage approfondis</a></li>
			<li><a href="#training">8. Lire un training</a></li>
			<li><a href="#deploy">9. Déployer ton modèle</a></li>
			<li><a href="#glossaire">10. Glossaire complet</a></li>
		</ol>
	</nav>

	<!-- ================== 0. PRÉREQUIS ================== -->
	<section id="prerequis" class="unsl-section">
		<h2 class="unsl-h2">0️⃣ Avant de commencer — les briques de base</h2>
		<p class="unsl-lead">
			Si l'un de ces concepts n'est pas clair pour toi, lis la fiche
			correspondante avant de plonger dans la suite. <strong>Tu ne peux pas
				deviner ces choses</strong> — c'est normal de venir vérifier ici.
		</p>

		<div class="unsl-prereq-grid">
			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🤖</span> Qu'est-ce qu'un LLM ?</summary>
				<div class="unsl-prereq-body">
					<p>
						<strong>LLM</strong> = <em>Large Language Model</em> = gros modèle
						de langage. Concrètement, c'est un programme qui a appris à
						<strong>prédire le mot suivant</strong> dans une phrase. Si tu
						lui donnes « Le chat dort sur le », il prédit « tapis » avec une
						forte probabilité.
					</p>
					<p>
						Ce qui le rend impressionnant, c'est qu'il a vu tellement de
						texte (l'équivalent de millions de livres) qu'en
						<em>prédisant juste le mot suivant</em>, il finit par savoir
						répondre à des questions, traduire, écrire du code, raisonner.
						Exemples : GPT-4, Claude, Llama, Mistral, Gemma.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🧮</span> Les poids du modèle</summary>
				<div class="unsl-prereq-body">
					<p>
						Un modèle « 7B » a <strong>7 milliards de paramètres</strong> —
						aussi appelés <em>poids</em>. Ce sont 7 milliards de petits
						nombres décimaux organisés en grandes matrices.
					</p>
					<p>
						Ces poids encodent <strong>tout</strong> ce que le modèle a
						appris : grammaire, faits, style, raisonnement. Quand tu
						fine-tunes, tu modifies (légèrement) ces poids — ou tu en
						<strong>ajoutes de nouveaux à côté</strong> (c'est ce que fait
						LoRA, qu'on verra plus loin).
					</p>
					<p>
						À titre d'idée des ordres de grandeur : un modèle 7B pèse environ
						14 Go en fp16, 4 Go en 4-bit. Mistral 7B = 7,2 milliards de
						poids, organisés en ~32 couches.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">💻</span> GPU et VRAM — pourquoi ça compte</summary>
				<div class="unsl-prereq-body">
					<p>
						<strong>GPU</strong> (Graphics Processing Unit) = la carte
						graphique. À l'origine pour les jeux, on s'en sert pour les LLM
						parce qu'elle peut faire <strong>des milliards de
							multiplications de matrices en parallèle</strong>. Un CPU est
						séquentiel (4-32 cœurs rapides) ; un GPU est massivement parallèle
						(plusieurs milliers de petits cœurs).
					</p>
					<p>
						<strong>VRAM</strong> (Video RAM) = la mémoire de la carte
						graphique. C'est <strong>elle</strong> qui détermine la taille
						du modèle que tu peux charger. Si ton modèle ne tient pas en
						VRAM, ça plante.
					</p>
					<p>
						Repères :
					</p>
					<ul>
						<li><strong>RTX 4090</strong> : 24 Go (haut de gamme grand public)</li>
						<li><strong>RTX 5000 (Ada)</strong> : 32 Go (workstation pro — ce que tu as)</li>
						<li><strong>A100 / H100</strong> : 40-80 Go (datacenter)</li>
						<li><strong>GTX 1070 Max-Q</strong> : 4 Go (ton portable)</li>
					</ul>
					<p>
						<strong>nvidia-smi</strong> dans ton terminal te dit quelle carte
						tu as et combien de VRAM est utilisée.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🪙</span> Les tokens</summary>
				<div class="unsl-prereq-body">
					<p>
						Le LLM ne voit pas de lettres ni même de mots — il voit des
						<strong>tokens</strong>, qui sont des morceaux de mots. « Bonjour »
						peut être 1 token, « anticonstitutionnellement » peut être 5.
					</p>
					<p>
						Le <strong>vocabulaire</strong> d'un modèle est l'ensemble des
						tokens qu'il connaît : ~32 000 pour Mistral, ~128 000 pour Llama
						3, ~50 000 pour GPT-2. Chaque token est un identifiant entier.
					</p>
					<p>
						Règle de pouce : <strong>1 token ≈ 0,75 mot français</strong>. Une
						page de texte = ~500 tokens.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🔄</span> Pré-entraînement vs Fine-tuning vs Inférence</summary>
				<div class="unsl-prereq-body">
					<p>Trois phases distinctes dans la vie d'un modèle :</p>
					<ol>
						<li>
							<strong>Pré-entraînement</strong> : on entraîne le modèle
							depuis zéro sur des trillions de tokens (web, livres,
							Wikipedia). Fait par Meta, Mistral, OpenAI. Coûte des
							millions de dollars. Le résultat = un « modèle de base »
							qui sait du texte mais n'est pas encore utile pour
							grand-chose.
						</li>
						<li>
							<strong>Fine-tuning</strong> = ce qu'on apprend ici. On
							part d'un modèle pré-entraîné, on lui montre nos exemples
							spécifiques. Quelques heures de GPU.
						</li>
						<li>
							<strong>Inférence</strong> = utilisation du modèle pour
							répondre à des prompts. C'est ce que tu fais quand tu
							ouvres ChatGPT.
						</li>
					</ol>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">📊</span> Loss et apprentissage par essai-erreur</summary>
				<div class="unsl-prereq-body">
					<p>
						La <strong>loss</strong> est un nombre qui mesure « à quel point
						le modèle se trompe ». Plus elle est basse, mieux c'est.
					</p>
					<p>
						Pendant l'entraînement, le modèle voit un exemple, prédit, on
						calcule la loss, on ajuste les poids pour la diminuer
						(<em>gradient descent</em>), et on recommence des milliers de
						fois. C'est de l'apprentissage par essai-erreur à l'échelle de
						milliards de paramètres.
					</p>
					<p>
						Tu vas voir la loss s'afficher en direct dans Unsloth Studio.
						C'est <strong>l'indicateur principal</strong> que tu vas
						surveiller.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🤗</span> HuggingFace — l'écosystème</summary>
				<div class="unsl-prereq-body">
					<p>
						<strong>HuggingFace</strong> = le « GitHub des modèles d'IA ».
						Plateforme web (huggingface.co) où sont publiés tous les
						modèles open-source : Llama, Mistral, Gemma, Qwen, Phi, etc.
					</p>
					<p>
						Quand on écrit <code>"unsloth/Mistral-7B-Instruct-v0.3-bnb-4bit"</code>
						dans le code Unsloth, Python va télécharger ce modèle depuis
						HuggingFace automatiquement. La première fois c'est long
						(~5 Go) ; ensuite c'est en cache local.
					</p>
					<p>
						HuggingFace fournit aussi 3 librairies Python clés :
						<code>transformers</code> (charger/utiliser les modèles),
						<code>datasets</code> (gérer les datasets),
						<code>peft</code> (fine-tuning paramètre-efficace, dont LoRA).
						Unsloth s'appuie sur ces 3.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">📓</span> Notebooks et cellules</summary>
				<div class="unsl-prereq-body">
					<p>
						Un <strong>notebook</strong> (Jupyter ou Colab) est un fichier
						qui mélange texte et morceaux de code appelés
						<strong>cellules</strong>. Tu exécutes les cellules une par
						une (Shift+Enter), tu vois la sortie immédiatement, tu inspectes
						chaque étape.
					</p>
					<p>
						C'est <strong>l'environnement standard</strong> pour
						l'expérimentation ML : tu peux modifier une cellule, la
						relancer, voir le résultat. Idéal pour le fine-tuning où tu veux
						vérifier chaque étape avant de lancer une heure de calcul.
					</p>
					<p>
						<strong>Unsloth Studio</strong> = un environnement notebook
						préconfiguré avec tout pré-installé (Python, CUDA, Unsloth,
						Jupyter Lab). Tu te connectes, tu ouvres un notebook, tu
						travailles.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🐍</span> Python — ce qu'il faut savoir</summary>
				<div class="unsl-prereq-body">
					<p>
						Le langage de programmation universel pour le ML. Tu n'as pas
						besoin de devenir expert. Pour fine-tuner, ces bases suffisent :
					</p>
					<ul>
						<li>
							Comprendre une <strong>fonction</strong> avec ses arguments :
							<code>FastLanguageModel.from_pretrained(model_name="...", load_in_4bit=True)</code>
						</li>
						<li>
							Lire une <strong>liste</strong> :
							<code>["q_proj", "k_proj", "v_proj"]</code>
						</li>
						<li>
							Lire un <strong>dictionnaire</strong> :
							<code>{`{"role": "user", "content": "..."}`}</code>
						</li>
						<li>
							Lire un <strong>f-string</strong> :
							<code>{`f"Total: {x} tokens"`}</code>
						</li>
					</ul>
					<p>
						C'est tout pour ce qu'on fait ici. Tu copies-colles des cellules,
						tu modifies les paramètres, tu relances.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🔢</span> fp32, fp16, bf16, int8, NF4 — formats numériques</summary>
				<div class="unsl-prereq-body">
					<p>
						Les ordinateurs stockent les nombres décimaux dans différents
						formats. Plus de bits = plus précis, mais plus lourd. Cinq
						formats que tu rencontreras :
					</p>
					<ul>
						<li><strong>FP32</strong> (32 bits) : précision standard de calcul scientifique. ~4 octets/poids.</li>
						<li><strong>FP16</strong> (16 bits) : moitié, suffisant pour LLM. 2 octets/poids.</li>
						<li><strong>BF16</strong> (16 bits) : même taille que fp16 mais meilleure plage. Standard pour Ampere+ (RTX 30, 40, 50 series).</li>
						<li><strong>INT8</strong> (8 bits) : quantization simple, presque pas de perte. 1 octet/poids.</li>
						<li><strong>NF4</strong> (4 bits) : quantization aux quantiles d'une normale, pour QLoRA. 0,5 octet/poids.</li>
					</ul>
					<p>
						Pour Mistral 7B :
						<strong>fp32 = 28 Go</strong>,
						<strong>fp16/bf16 = 14 Go</strong>,
						<strong>int8 = 7 Go</strong>,
						<strong>NF4 = 4 Go</strong>. Tu vois pourquoi la quantization rend
						le fine-tuning accessible.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🐳</span> Docker (pour Unsloth Studio)</summary>
				<div class="unsl-prereq-body">
					<p>
						<strong>Docker</strong> = un système de « conteneurs ». Un
						conteneur est un mini-OS portable qui contient tout ce qu'il
						faut pour faire tourner une application : code, dépendances,
						configuration. Tu lances le conteneur, ça marche, partout.
					</p>
					<p>
						<strong>Unsloth Studio</strong> est distribué sous forme
						d'image Docker (<code>unsloth/studio:latest</code>). Quand tu la
						lances sur ta VM, tu obtiens en quelques secondes un
						environnement Jupyter Lab avec Python, CUDA, Unsloth, et tous
						les notebooks d'exemples — pré-configuré et testé. Tu n'installes
						rien à la main, tu ne risques pas de casser ton système.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">⚙️</span> CUDA, drivers NVIDIA</summary>
				<div class="unsl-prereq-body">
					<p>
						<strong>CUDA</strong> = la plateforme NVIDIA qui permet à du
						code Python d'utiliser la GPU. Sans CUDA, ta carte graphique
						est inutilisable pour le ML. Sur une VM avec RTX 5000, CUDA
						devrait être déjà installé.
					</p>
					<p>
						Vérifications rapides depuis le terminal :
					</p>
					<ul>
						<li><code>nvidia-smi</code> → te montre la carte, la VRAM, les processus qui l'utilisent</li>
						<li><code>nvcc --version</code> → la version de CUDA installée (12.x recommandé)</li>
					</ul>
					<p>
						Si <code>nvidia-smi</code> ne renvoie rien, il faut installer les
						drivers NVIDIA — généralement déjà fait sur une VM cloud.
					</p>
				</div>
			</details>

			<details class="unsl-prereq">
				<summary><span class="unsl-prereq-emoji">🎭</span> Les rôles user / system / assistant</summary>
				<div class="unsl-prereq-body">
					<p>
						Quand tu fine-tunes un LLM pour qu'il agisse en assistant, tu
						travailles toujours avec <strong>3 rôles</strong>. Comprendre
						leur différence est crucial — ton dataset doit les encoder
						correctement, sinon le modèle apprend n'importe quoi.
					</p>

					<p>
						<strong>🎬 system — la configuration en coulisses</strong><br />
						C'est ce que <em>l'utilisateur final ne voit pas</em>. Mis en
						place par le développeur. Sert à donner le persona, les règles,
						le format de réponse. Exemple :
					</p>
					<p style="background:#f8fafc; padding:0.5rem 0.7rem; border-radius:0.4rem; font-size:0.85rem">
						« Tu es un expert en chimie organique. Tu réponds en français
						avec le vocabulaire IUPAC. Tu refuses toute synthèse
						dangereuse. Tu cites toujours le numéro CAS quand tu mentionnes
						un composé. »
					</p>

					<p>
						<strong>👤 user — ce que l'humain demande</strong><br />
						La question concrète. Ponctuelle, variable d'un échange à
						l'autre.
					</p>

					<p>
						<strong>🤖 assistant — ce que le modèle répond</strong><br />
						La sortie attendue. C'est ce que tu fournis dans le dataset
						comme « réponse idéale ».
					</p>

					<h4 style="font-family:var(--font-display); font-size:1rem; margin:0.75rem 0 0.4rem;">Comment ces rôles entrent dans ton dataset</h4>
					<p>
						Dans ton fichier JSONL, chaque exemple est une conversation.
						Quand le tokenizer applique le <strong>chat template</strong> du
						modèle (ex : pour Mistral, c'est <code>[INST]...[/INST]</code> ;
						pour Llama 3, c'est <code>&lt;|start_header_id|&gt;user&lt;|end_header_id|&gt;...</code>),
						les rôles deviennent des tokens spéciaux que le modèle apprend
						à distinguer.
					</p>

					<p>
						Pendant le fine-tuning, le modèle apprend implicitement que :
					</p>
					<ul>
						<li>Ce qui est sous <code>system</code> = configure son persona, à respecter durablement.</li>
						<li>Ce qui est sous <code>user</code> = la requête à traiter maintenant.</li>
						<li>Ce qui est sous <code>assistant</code> = ce qu'il doit produire.</li>
					</ul>

					<p>
						<strong>L'effet magique :</strong> une fois fine-tuné, tu peux
						changer le system prompt à l'inférence (ex : passer de « expert
						chimie » à « expert juridique ») et le modèle adapte son
						comportement <strong>sans nouvel entraînement</strong>. C'est
						parce qu'il a appris la sémantique du rôle, pas juste un texte
						fixe.
					</p>

					<p>
						<strong>Conséquence pour ton dataset</strong> : varie tes system
						prompts. Si tu mets toujours le même, le modèle ne saura pas
						s'adapter à un autre. Si tu mets 3-5 variantes (« assistant
						poli », « expert technique », « pédagogue patient »), le modèle
						apprend à pivoter selon les didascalies.
					</p>
				</div>
			</details>
		</div>

		<Callout variant="insight" title="🎯 Tu as tout vérifié ?">
			<p>
				Si oui, on peut continuer en toute sérénité. Si quelque chose
				te chiffonne encore, prends le temps de creuser ce point précis
				avant d'avancer — sinon les sections suivantes seront
				incompréhensibles.
			</p>
		</Callout>
	</section>

	<!-- ================== 1. POURQUOI UNSLOTH ================== -->
	<section id="pourquoi" class="unsl-section">
		<h2 class="unsl-h2">1️⃣ Pourquoi Unsloth ?</h2>
		<p class="unsl-lead">
			Unsloth est une <strong>librairie Python open-source</strong> qui rend
			le fine-tuning de LLM <strong>2× plus rapide</strong> et utilise
			<strong>70 % moins de mémoire GPU</strong> que la pile HuggingFace
			Transformers de base. Elle est gratuite, fonctionne sur Google Colab,
			et est devenue le standard de facto pour fine-tuner des modèles
			open-weight (Llama, Mistral, Qwen, Gemma, Phi…).
		</p>

		<Callout variant="insight" title="🎯 Le pitch en une phrase">
			<p>
				« Unsloth réécrit les opérations critiques de l'entraînement en
				<em>kernels Triton</em> optimisés pour ne pas gaspiller un seul
				cycle GPU — résultat : un modèle 7B qu'on n'aurait jamais pu
				entraîner sur Colab gratuit le devient. »
			</p>
		</Callout>

		<div class="unsl-grid-3">
			<div class="unsl-feature">
				<div class="unsl-feature-emoji">⚡</div>
				<strong>2× plus rapide</strong>
				<p>Kernels Triton custom pour attention, MLP, RoPE, embeddings.</p>
			</div>
			<div class="unsl-feature">
				<div class="unsl-feature-emoji">💾</div>
				<strong>70 % moins de VRAM</strong>
				<p>Quantization 4-bit + gradient checkpointing intelligent.</p>
			</div>
			<div class="unsl-feature">
				<div class="unsl-feature-emoji">🎯</div>
				<strong>0 perte de qualité</strong>
				<p>Implémentation mathématiquement équivalente à la version de base.</p>
			</div>
		</div>
	</section>

	<!-- ================== 2. ARBRE DE DÉCISION ================== -->
	<section id="decision" class="unsl-section">
		<h2 class="unsl-h2">2️⃣ Avant de fine-tuner — la bonne question</h2>
		<p class="unsl-lead">
			Le fine-tuning n'est PAS toujours la bonne réponse. Trois alternatives
			coûtent moins cher et marchent souvent mieux.
		</p>

		<div class="unsl-decision">
			<div class="unsl-dec-row">
				<div class="unsl-dec-q">Mon problème, c'est…</div>
				<div class="unsl-dec-a">… la solution est…</div>
			</div>
			<div class="unsl-dec-row">
				<div class="unsl-dec-q">… que le modèle ne connaît pas mes documents.</div>
				<div class="unsl-dec-a unsl-dec-rag">📚 <strong>RAG</strong> — pas de fine-tuning. Tu indexes tes docs et tu les injectes dans le prompt.</div>
			</div>
			<div class="unsl-dec-row">
				<div class="unsl-dec-q">… que le modèle répond mal au format.</div>
				<div class="unsl-dec-a unsl-dec-prompt">✏️ <strong>Prompt engineering</strong> — affine ton system prompt avant tout. 90 % des problèmes se règlent là.</div>
			</div>
			<div class="unsl-dec-row">
				<div class="unsl-dec-q">… que je veux changer le <em>style</em> ou le <em>comportement</em> du modèle de manière persistante.</div>
				<div class="unsl-dec-a unsl-dec-ft">🎓 <strong>Fine-tuning</strong> — c'est ici. Tu modifies les poids du modèle.</div>
			</div>
			<div class="unsl-dec-row">
				<div class="unsl-dec-q">… que je veux apprendre une <em>compétence pointue</em> (langue, format JSON strict, jargon métier).</div>
				<div class="unsl-dec-a unsl-dec-ft">🎓 <strong>Fine-tuning</strong> — encore lui.</div>
			</div>
			<div class="unsl-dec-row">
				<div class="unsl-dec-q">… que je veux que le modèle apprenne des <em>faits nouveaux</em> précis.</div>
				<div class="unsl-dec-a unsl-dec-rag">📚 <strong>RAG</strong> — le fine-tuning est mauvais pour mémoriser des faits. Préfère un index.</div>
			</div>
		</div>

		<Callout variant="warning" title="⚠️ Le piège classique du débutant">
			<p>
				Beaucoup pensent fine-tuner pour « apprendre des connaissances » au
				modèle. <strong>C'est une mauvaise idée.</strong> Les LLMs
				mémorisent mal les faits par fine-tuning : tu produirais surtout
				des hallucinations confiantes. RAG est la bonne réponse.
				Le fine-tuning sert à changer le <strong>comportement</strong>, le
				<strong>format</strong>, le <strong>style</strong>, le
				<strong>ton</strong> — pas le contenu factuel.
			</p>
		</Callout>
	</section>

	<!-- ================== 3. FONDAMENTAUX ================== -->
	<section id="fondamentaux" class="unsl-section">
		<h2 class="unsl-h2">3️⃣ Les fondamentaux</h2>
		<p class="unsl-lead">
			Quatre concepts à maîtriser avant de toucher au code. Chacun est
			expliqué en <strong>3 niveaux</strong> — clique l'onglet qui
			correspond à ton aisance.
		</p>

		<DifficultyTabs
			id="ft-finetuning"
			title="Le fine-tuning"
			tagline="Continuer l'apprentissage d'un modèle déjà entraîné"
		>
			{#snippet intuitive()}
				<p>
					Imagine un cuisinier qui sait préparer 1000 plats. Tu ne lui
					réapprends pas à cuisiner — tu lui montres
					<strong>juste tes recettes spécifiques</strong>. C'est ça, le
					fine-tuning : tu prends un modèle déjà entraîné (par Meta ou
					Mistral), et tu lui montres tes propres exemples pour qu'il
					adopte ton style.
				</p>
				<p>
					Le pré-entraînement (chez Meta) coûte des millions de dollars
					et utilise tout l'internet. Toi, tu fais juste les retouches
					finales — quelques heures, quelques dizaines d'euros au plus.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					OK, posons les bases tranquillement. <strong>Le fine-tuning,
						c'est juste une seconde phase d'entraînement.</strong> Mais pour
					comprendre vraiment, il faut d'abord voir les deux phases distinctes
					dans la vie d'un LLM.
				</p>
				<h4>Phase 1 — Le pré-entraînement</h4>
				<p>
					C'est l'étape où Meta, Mistral ou OpenAI prennent
					<strong>des trillions</strong> (oui, des milliers de milliards)
					de tokens venant d'Internet, de livres, de Wikipedia, et le
					donnent à manger à un modèle qui démarre vide. Le modèle apprend
					une seule chose : <strong>prédire le token suivant</strong>,
					encore et encore, pendant des semaines, sur des milliers de GPUs.
					Ça coûte des millions de dollars.
				</p>
				<p>
					Le résultat : un <em>modèle de base</em> qui a une connaissance
					générale du monde, du langage, du raisonnement — mais qui n'est
					pas particulièrement utile en l'état. Il complète des phrases,
					sans plus.
				</p>
				<h4>Phase 2 — Le fine-tuning</h4>
				<p>
					C'est ici que tu interviens, toi. Tu prends ce modèle pré-entraîné
					et tu lui montres <strong>TES exemples spécifiques</strong>. Tu
					n'as pas besoin de millions de dollars. Tu as besoin de quelques
					heures sur un GPU correct, et d'un dataset bien fait.
				</p>
				<h4>Une analogie qui fait vraiment cliquer</h4>
				<p>
					Imagine un étudiant qui sort de l'université. Il a passé 5 ans à
					apprendre tout sur tout (= pré-entraînement). Maintenant il
					rejoint ton entreprise. Tu ne lui réapprends pas à lire ou à
					écrire — tu lui montres juste TES procédures, TES clients, TON
					jargon. Ça prend <strong>une semaine, pas 5 ans</strong>. Le
					fine-tuning = la « semaine d'intégration en entreprise » du
					modèle.
				</p>
				<h4>Concrètement, qu'est-ce qu'il apprend ?</h4>
				<ul>
					<li>À répondre dans <strong>ton style</strong> (formel, décontracté, technique…).</li>
					<li>À utiliser <strong>ton format</strong> (JSON strict, markdown, lignes courtes…).</li>
					<li>À gérer <strong>tes cas d'usage</strong> (questions tech, support client, juridique…).</li>
					<li>À <strong>refuser</strong> ce qui sort de son périmètre (sécurité).</li>
				</ul>
				<h4>Ce qu'il <em>n'apprend pas</em> bien par fine-tuning</h4>
				<ul>
					<li>Des <strong>faits factuels précis</strong> (ex : « mon produit fait X »). Pour ça → RAG.</li>
					<li>Des <strong>compétences fondamentales nouvelles</strong> (ex : un nouveau langage de programmation). Pour ça → continued pretraining.</li>
				</ul>
				<h4>Le piège que tout le monde fait</h4>
				<p>
					Beaucoup essaient de fine-tuner pour « apprendre des connaissances »
					au modèle. <strong>C'est une mauvaise idée.</strong> Le modèle
					voit ces faits 5-10 fois dans ton dataset, contre des milliards de
					fois pour le reste — il va halluciner sur tes faits avec
					confiance. Pour la connaissance factuelle, RAG est la bonne
					réponse. Le fine-tuning sert à changer le
					<strong>comportement</strong>, le <strong>format</strong>, le
					<strong>style</strong>, le <strong>ton</strong>.
				</p>
				<p>
					Voilà. Tu as la grande image. Maintenant, comment ça se passe en
					pratique ? Onglet d'à côté.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>
					Le fine-tuning, c'est <strong>continuer le pré-entraînement</strong>
					sur un dataset spécifique. Concrètement, tu fais tourner le
					forward pass + backward pass standard, mais sur tes données.
				</p>
				<ul>
					<li>
						<strong>Données</strong> : un fichier JSONL d'instructions
						(question + réponse attendue).
					</li>
					<li>
						<strong>Boucle</strong> : pour chaque exemple, le modèle prédit
						la réponse, on mesure l'écart (loss), on ajuste les poids
						(gradient descent).
					</li>
					<li>
						<strong>Durée</strong> : quelques minutes à quelques heures
						selon la taille.
					</li>
					<li>
						<strong>Sortie</strong> : soit le modèle complet (gros), soit
						un <em>adapter</em> LoRA (léger, voir plus bas).
					</li>
				</ul>
			{/snippet}
			{#snippet deep()}
				<p>
					Mathématiquement, le fine-tuning minimise la cross-entropy entre
					la distribution prédite et la distribution cible, sur tes
					données. Si on note <code>θ</code> les poids du modèle :
				</p>
				<MathBlock
					tex={String.raw`\mathcal{L}(\theta) = -\sum_{(x, y) \in \mathcal{D}} \sum_t \log p_\theta(y_t \mid y_{<t}, x)`}
				/>
				<p>
					On part des poids pré-entraînés <code>θ_0</code> et on descend le
					gradient de cette loss avec un learning rate
					<strong>très bas</strong> (typiquement 2e-4 pour LoRA, 1e-5 pour
					full fine-tuning) — un LR trop élevé détruirait les
					connaissances pré-existantes (<em>catastrophic forgetting</em>).
				</p>
			{/snippet}
		</DifficultyTabs>

		<DifficultyTabs
			id="ft-lora"
			title="LoRA — Low-Rank Adaptation"
			tagline="L'astuce qui rend le fine-tuning accessible"
		>
			{#snippet intuitive()}
				<p>
					Imagine que tu veuilles changer le comportement d'une voiture
					sans <strong>démonter le moteur</strong>. Au lieu de remplacer
					des pièces, tu ajoutes <strong>deux petits leviers extérieurs</strong>
					qui pilotent le moteur. Si le réglage te plaît, tu gardes les
					leviers ; sinon, tu les enlèves et la voiture revient à
					l'origine.
				</p>
				<p>
					LoRA = ces deux leviers. On <strong>ne touche pas</strong> aux
					poids du modèle original. On ajoute deux petites matrices à côté
					qui captent juste le « delta » à appliquer.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Bon, on va prendre le temps avec celui-là parce que LoRA est
					<strong>l'idée centrale</strong> de tout fine-tuning moderne.
					Une fois que tu as ça, tu comprends QLoRA, Unsloth, vLLM —
					tout repose dessus.
				</p>
				<h4>Le problème qu'on cherche à résoudre</h4>
				<p>
					Tu te souviens, on a dit qu'un modèle 7B a 7 milliards de
					poids organisés en grosses matrices. Pour fine-tuner « à
					l'ancienne », il faudrait modifier <strong>toutes</strong> ces
					7 milliards de valeurs. Trois problèmes massifs :
				</p>
				<ul>
					<li>
						<strong>Mémoire</strong> : pour entraîner, ton GPU doit
						stocker non seulement les poids (14 Go en fp16), mais aussi
						les <em>gradients</em> (autre 14 Go), les <em>états de
							l'optimiseur</em> Adam (28 Go) — tu finis facilement à
						60-80 Go. Hors de portée d'une carte grand public.
					</li>
					<li>
						<strong>Risque de tout casser</strong> : ton dataset (50, 500,
						5 000 exemples) est minuscule comparé à ce qui a entraîné le
						modèle. En modifiant tout, tu risques d'effacer les
						connaissances de base — c'est le <em>catastrophic forgetting</em>.
					</li>
					<li>
						<strong>Stockage</strong> : tu dois stocker un nouveau modèle
						14 Go par tâche. Avec 5 fine-tunings, c'est 70 Go.
					</li>
				</ul>
				<h4>L'observation maligne d'Edward Hu</h4>
				<p>
					En 2021, Edward Hu et son équipe chez Microsoft font une
					observation qui change tout : quand on fine-tune, les
					<strong>modifications</strong> qu'on apporte aux poids
					(le « delta ») ont mathématiquement un <strong>rang faible</strong>.
					Ça signifie que le delta peut être représenté par
					<strong>deux petites matrices</strong> au lieu d'une grosse,
					sans perdre quasiment d'information.
				</p>
				<h4>Concrètement, à quoi ça ressemble</h4>
				<p>
					Prends une matrice typique de Mistral 7B : 4096 × 4096 (~16 millions
					de poids). Avec LoRA de rang <code>r=16</code>, on remplace la
					modification de cette matrice par deux petites matrices :
				</p>
				<ul>
					<li><code>A</code> de taille 4096 × 16 = 65 536 poids</li>
					<li><code>B</code> de taille 16 × 4096 = 65 536 poids</li>
				</ul>
				<p>
					Total : <strong>131 072 poids entraînables</strong> au lieu de
					16,7 millions. Soit <strong>127× moins</strong> sur cette seule
					matrice. Et la magie : ça marche presque aussi bien que
					modifier toute la matrice.
				</p>
				<h4>Pourquoi le « rang » r est important</h4>
				<p>
					Le rang <code>r</code> contrôle la <strong>capacité</strong> du
					LoRA. Plus il est grand, plus le LoRA peut représenter de
					modifications fines. Mais plus de poids à entraîner et plus de
					VRAM. Ordres de grandeur :
				</p>
				<ul>
					<li><code>r=8</code> : très léger, change de style limité</li>
					<li><code>r=16</code> : sweet spot pour la plupart des cas (par défaut Unsloth)</li>
					<li><code>r=64</code> : pour gros datasets ou changements profonds</li>
				</ul>
				<h4>Le bénéfice pratique le plus délicieux</h4>
				<p>
					Comme le LoRA est <strong>petit</strong> (~100 Mo) et
					<strong>séparé</strong> du modèle de base, tu peux :
				</p>
				<ul>
					<li>Avoir <strong>plusieurs LoRA</strong> (juridique, marketing, technique) sur le même modèle.</li>
					<li>Les <strong>switcher en une seconde</strong> à l'inférence.</li>
					<li>Les <strong>partager facilement</strong> (100 Mo ≪ 14 Go).</li>
					<li>Les <strong>désactiver</strong> pour revenir au modèle de base.</li>
				</ul>
				<p>
					C'est pour ça que LoRA + ses variantes (QLoRA, IA³, OFT…) ont
					complètement remplacé le fine-tuning classique pour 99 % des
					cas. Quand quelqu'un dit « je fine-tune un Mistral », il fait
					presque toujours du LoRA.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>
					Au lieu d'entraîner les <strong>milliards</strong> de paramètres
					du modèle, on en gèle 99 % et on n'entraîne que deux petites
					matrices <code>A</code> et <code>B</code> ajoutées en parallèle
					des couches d'attention.
				</p>
				<ul>
					<li>
						<strong>Le rang <code>r</code></strong> : la taille de ces
						matrices (typiquement 8, 16, 32, 64).
					</li>
					<li>
						<strong>Le ratio params entraînables</strong> : ~0.1 % à 1 %
						du modèle complet.
					</li>
					<li>
						<strong>Le résultat</strong> : un fichier
						<em>adapter</em> de 10–500 Mo à côté du modèle de base
						(plusieurs Go).
					</li>
				</ul>
				<p>
					Avantage gigantesque : tu peux avoir <strong>plusieurs LoRA</strong>
					branchées sur le même modèle de base, et basculer instantanément
					(« mode juridique », « mode marketing »).
				</p>
			{/snippet}
			{#snippet deep()}
				<p>
					Hu et al. (2021) observent que les mises à jour des poids durant
					le fine-tuning ont un <strong>rang intrinsèque faible</strong>
					— ce qui suggère qu'on peut les approximer par une factorisation
					de bas rang.
				</p>
				<p>Pour une couche linéaire <code>W ∈ R^{`{d×k}`}</code>, on remplace :</p>
				<MathBlock
					tex={String.raw`W' = W + \Delta W \quad \text{par} \quad W' = W + B A`}
				/>
				<p>
					où <code>A ∈ R^{`{r×k}`}</code>, <code>B ∈ R^{`{d×r}`}</code>,
					avec <code>r ≪ min(d, k)</code>.
				</p>
				<ul>
					<li>
						<strong>Initialisation</strong> : <code>A ~ N(0, σ²)</code>,
						<code>B = 0</code> → début en identité, pas de perturbation
						initiale du modèle.
					</li>
					<li>
						<strong>Hyperparamètre <code>α</code></strong> : on rescale par
						<code>α / r</code> pour stabiliser.
					</li>
					<li>
						<strong>Modules ciblés</strong> : par défaut <code>q_proj</code>,
						<code>k_proj</code>, <code>v_proj</code>, <code>o_proj</code> ;
						pour Unsloth on cible aussi <code>gate_proj</code>,
						<code>up_proj</code>, <code>down_proj</code> du FFN — meilleurs
						résultats.
					</li>
				</ul>
				<p>
					Paramètres entraînés : <code>r(d + k)</code> au lieu de
					<code>dk</code>. Pour <code>d = k = 4096, r = 16</code> →
					131 k au lieu de 16.7 M — soit <strong>127× moins</strong>.
				</p>
			{/snippet}
		</DifficultyTabs>

		<DifficultyTabs
			id="ft-quant"
			title="La quantization (4-bit, 8-bit)"
			tagline="Stocker les poids sur moins de bits"
		>
			{#snippet intuitive()}
				<p>
					Au lieu d'écrire chaque nombre avec 32 chiffres après la
					virgule, on en garde 4 — comme arrondir un prix à l'euro au
					lieu du centime. Le modèle prend <strong>4 à 8× moins de
						place</strong>, sans perte notable de qualité.
				</p>
				<p>
					C'est <strong>le sésame</strong> qui te permet de charger un
					modèle 7B sur un GPU à 8 Go : sans quantization il faudrait
					14 Go (en fp16) ; en 4-bit il en faut 4.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Décortiquons. La quantization, c'est <strong>changer la
						précision de stockage</strong> des poids du modèle. Et
					comprendre pourquoi ça marche sans tout casser, c'est très
					éclairant.
				</p>
				<h4>D'abord, comment un ordinateur stocke un nombre décimal</h4>
				<p>
					Un nombre comme 3,14159 ne tient pas tel quel dans la mémoire.
					Il est stocké en binaire avec un certain nombre de bits :
				</p>
				<ul>
					<li>
						<strong>fp32</strong> (32 bits) : précision « scientifique »
						standard. Tu peux distinguer 4 milliards de valeurs
						différentes. Inutilement précis pour un LLM.
					</li>
					<li>
						<strong>fp16 / bf16</strong> (16 bits) : moitié moins. Tu
						distingues 65 000 valeurs. <strong>Largement assez</strong>
						pour un LLM. C'est le format standard d'entraînement.
					</li>
					<li>
						<strong>int8</strong> (8 bits) : 256 valeurs distinctes. Pour
						les poids ça suffit, on perd à peine.
					</li>
					<li>
						<strong>NF4</strong> (4 bits) : <strong>16 valeurs</strong>
						distinctes seulement. Là on commence à se demander si ça peut
						vraiment marcher.
					</li>
				</ul>
				<h4>Pourquoi 4 bits suffisent (la magie est ici)</h4>
				<p>
					L'observation : les poids d'un LLM ne sont pas distribués
					uniformément. Si tu fais un histogramme des poids d'un modèle
					Llama, tu vois une <strong>cloche gaussienne autour de 0</strong>.
					La majorité des poids sont entre -0,2 et +0,2 ; les valeurs
					extrêmes sont rares.
				</p>
				<p>
					Donc quand on a 16 « cases » disponibles pour quantiser, on ne
					les espace pas uniformément (-1, -0,87, -0,75, …). Au contraire :
					on les place <strong>aux quantiles d'une distribution
						normale</strong> — beaucoup de cases au milieu (où il y a
					beaucoup de poids), peu sur les bords. C'est ce que fait NF4
					(NormalFloat4).
				</p>
				<p>
					Résultat : on perd à peine en précision, parce que la précision
					est concentrée là où elle compte (au centre, où vivent la
					plupart des poids).
				</p>
				<h4>Et le calcul, alors ? On ne peut pas multiplier des 4-bit</h4>
				<p>
					Excellent point. Les GPU ne savent pas multiplier des nombres
					4-bit directement. Ce qu'on fait : on
					<strong>stocke en NF4</strong>, mais quand on doit faire un
					calcul, on <strong>dé-quantise à la volée</strong> en bf16,
					on calcule, on jette le résultat dé-quantisé.
				</p>
				<p>
					On paye un peu de compute (la dé-quantization à chaque
					utilisation), mais on gagne énormément en mémoire — le vrai
					goulot d'étranglement. Compromis très favorable.
				</p>
				<h4>L'astuce des « scales par bloc »</h4>
				<p>
					Pour préserver la précision relative, on ne quantise pas le
					modèle entier en une fois. On le découpe en blocs de 64 poids
					et on stocke un facteur d'échelle par bloc. Ça ajoute ~0,5
					bit/poids au final — d'où le « 4,5 bit en pratique » qu'on voit
					parfois.
				</p>
				<h4>Repères chiffrés pour Mistral 7B</h4>
				<ul>
					<li><strong>fp32</strong> : 28 Go en VRAM (impossible sur GPU grand public)</li>
					<li><strong>fp16/bf16</strong> : 14 Go (RTX 3090, 4090 OK)</li>
					<li><strong>int8</strong> : 7 Go (entrée de gamme OK)</li>
					<li><strong>NF4</strong> : <strong>4 Go</strong> (Colab T4 OK, voire RTX 3050)</li>
				</ul>
				<p>
					Tu vois pourquoi, sans quantization, le fine-tuning sur un GPU
					modeste serait impossible. Avec NF4 + LoRA (= QLoRA, prochain
					concept), tu peux fine-tuner Mistral 7B sur ta RTX 5000 sans
					sourciller.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>
					Trois formats principaux :
				</p>
				<ul>
					<li>
						<strong>FP16 / BF16 (16 bits)</strong> : le standard pour
						entraîner. Modèle 7B ≈ 14 Go VRAM.
					</li>
					<li>
						<strong>INT8 (8 bits)</strong> : quasiment aucune perte.
						Modèle 7B ≈ 7 Go VRAM.
					</li>
					<li>
						<strong>NF4 (4 bits, NormalFloat4)</strong> : utilisé par
						QLoRA et Unsloth. Modèle 7B ≈ 4 Go VRAM.
					</li>
				</ul>
				<p>
					En pratique, tu n'as rien à faire — Unsloth charge le modèle en
					4-bit automatiquement quand tu passes
					<code>load_in_4bit=True</code>.
				</p>
			{/snippet}
			{#snippet deep()}
				<p>
					<strong>NF4</strong> (Dettmers 2023) tire parti de la distribution
					des poids des LLM : approximativement <code>N(0, σ²)</code>. Au
					lieu de quantiles uniformes (comme INT4), on choisit les 16 niveaux
					aux <strong>quantiles d'une normale standard</strong>. Résultat :
					densité plus haute là où il y a le plus d'information.
				</p>
				<p>
					Le calcul se fait en bf16 : à chaque accès, les poids 4-bit sont
					<strong>dé-quantisés à la volée</strong> par le kernel CUDA.
					Cela coûte un peu de compute mais très peu de VRAM.
				</p>
				<p>
					On stocke aussi des <strong>scales par bloc</strong> de 64
					éléments (<em>blockwise quantization</em>) pour préserver la
					précision relative.
				</p>
				<MathBlock
					tex={String.raw`w_{q} = \text{round}\!\left(\frac{w}{s_b}\right), \quad w \approx s_b \cdot w_{q}`}
				/>
				<p>
					Pour aller plus loin : Dettmers, Pagnoni, Holtzman, Zettlemoyer,
					<em>QLoRA: Efficient Finetuning of Quantized LLMs</em>, 2023.
				</p>
			{/snippet}
		</DifficultyTabs>

		<DifficultyTabs
			id="ft-qlora"
			title="QLoRA — Quantized LoRA"
			tagline="Le combo gagnant : LoRA + 4-bit"
		>
			{#snippet intuitive()}
				<p>
					Tu as compris LoRA (les leviers à côté du moteur). Tu as compris
					la quantization (compresser le moteur). QLoRA = on combine les
					deux. Tu charges le moteur compressé, et tu apprends seulement
					les leviers.
				</p>
				<p>
					Résultat : tu peux fine-tuner un modèle 7B sur un Colab gratuit
					(T4, 16 Go), un 13B sur un RTX 3090, un 70B sur un A100. Avant
					QLoRA, c'était impossible.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Maintenant que tu as LoRA et quantization en tête, QLoRA
					devient évident — c'est <strong>juste les deux ensemble</strong>.
					Mais l'élégance de la combinaison mérite qu'on s'y attarde.
				</p>
				<h4>L'idée brillante</h4>
				<p>
					Voici le raisonnement de Tim Dettmers et son équipe en 2023 :
				</p>
				<ol>
					<li>
						Le modèle de base, on n'a <strong>pas besoin de le modifier</strong>
						(c'est LoRA qui apprend, à côté). Donc on peut le geler.
					</li>
					<li>
						Si on le gèle, sa précision peut être <strong>brutalement
							réduite</strong> — il ne participe pas au gradient, il sert
						juste à calculer le forward pass. Donc 4-bit suffisent.
					</li>
					<li>
						Les LoRA, eux, on les laisse en bf16 (ils s'entraînent, ils
						ont besoin de précision pour les gradients).
					</li>
				</ol>
				<p>
					Le forward pass devient : pour chaque couche, on dé-quantise les
					poids 4-bit à la volée, on les utilise pour calculer, et on
					ajoute la contribution du LoRA en bf16. Le backward ne touche
					que les LoRA.
				</p>
				<h4>Trois optimisations qui rendent ça vraiment efficace</h4>
				<ul>
					<li>
						<strong>Double quantization</strong> : on quantise même les
						<em>scales</em> de la quantization. Économise ~0,4 bit par
						poids supplémentaire.
					</li>
					<li>
						<strong>Paged optimizers</strong> : les états de l'optimiseur
						Adam (momentum, variance) vivent dans la RAM CPU paginée. Ils
						ne saturent pas la VRAM même avec une longue séquence.
					</li>
					<li>
						<strong>NF4 quantization</strong> : on l'a vu, distribution
						optimale pour des poids gaussiens.
					</li>
				</ul>
				<h4>Repères de mémoire pour fine-tuner Mistral 7B sur RTX 5000</h4>
				<ul>
					<li><strong>Modèle gelé NF4</strong> : 4 Go</li>
					<li><strong>LoRA bf16 (r=16)</strong> : ~50 Mo</li>
					<li><strong>Activations + gradients LoRA</strong> : 1-3 Go selon batch</li>
					<li><strong>États optimizer (paged)</strong> : ~100 Mo en VRAM (le reste sur CPU)</li>
					<li><strong>Total</strong> : 5-7 Go en VRAM. <strong>Tu as 32 Go sur ta carte. Énorme marge.</strong></li>
				</ul>
				<h4>Pourquoi c'était une vraie révolution</h4>
				<p>
					Avant QLoRA (2022 et avant), fine-tuner Llama 70B demandait un
					cluster d'A100 à 100 000 €. Après QLoRA, ça tient sur un seul
					A100 à 80 Go. <strong>Ça a démocratisé le fine-tuning</strong> et
					ouvert l'écosystème open-source qu'on connaît aujourd'hui.
					Unsloth ajoute une couche d'optimisation par-dessus pour que ça
					tourne 2× plus vite et avec encore moins de mémoire.
				</p>
				<p>
					Pour ton projet souverain : QLoRA + Unsloth + Mistral 7B + ta
					RTX 5000 = combo idéal. On l'utilise dans l'atelier.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>
					En pratique, tu fais 3 choses :
				</p>
				<ol>
					<li>
						Charger le modèle en 4-bit (<code>load_in_4bit=True</code>).
					</li>
					<li>
						Geler ces poids 4-bit — ils ne bougent plus.
					</li>
					<li>
						Ajouter des LoRA (en bf16) sur les couches ciblées et entraîner
						uniquement ces LoRA.
					</li>
				</ol>
				<p>
					Unsloth fait tout ça automatiquement quand tu appelles
					<code>FastLanguageModel.get_peft_model(...)</code>.
				</p>
			{/snippet}
			{#snippet deep()}
				<p>
					QLoRA combine :
				</p>
				<ul>
					<li>
						<strong>NF4 quantization</strong> des poids du modèle de base
						(gelés).
					</li>
					<li>
						<strong>Double quantization</strong> : on quantise même les
						scales eux-mêmes — ~0.4 bit/param économisés.
					</li>
					<li>
						<strong>Paged optimizers</strong> : les états de l'optimiseur
						(momentum, variance d'Adam) vivent dans la mémoire CPU
						paginée — la VRAM ne déborde pas même avec un long batch.
					</li>
					<li>
						<strong>LoRA en bf16</strong> sur le forward dé-quantisé.
					</li>
				</ul>
				<p>
					Le forward pass : <code>y = x · dequant(W_q) + x · BA</code>. La
					première moitié n'a pas de gradient (poids gelés). On
					backpropage uniquement par <code>BA</code> — tu n'entraînes que
					0.1–1 % des paramètres.
				</p>
			{/snippet}
		</DifficultyTabs>
	</section>

	<!-- ================== 4. LA MAGIE D'UNSLOTH ================== -->
	<section id="magie" class="unsl-section">
		<h2 class="unsl-h2">4️⃣ La magie d'Unsloth — pourquoi c'est rapide</h2>
		<p class="unsl-lead">
			Unsloth n'invente pas un nouvel algorithme. Il <strong>réécrit les
				opérations critiques en kernels Triton</strong> pour qu'elles
			collent au plus près du hardware GPU.
		</p>

		<DifficultyTabs
			id="ft-triton"
			title="Triton kernels — la sauce secrète"
			tagline="Du code GPU sur mesure pour les ops du Transformer"
		>
			{#snippet intuitive()}
				<p>
					PyTorch est comme une cuisine de restaurant : pratique mais
					générique. Triton, c'est un <strong>cuisinier qui ne fait que
						vos plats</strong> et a optimisé son geste pour eux.
					Unsloth a écrit ces cuisiniers spécialisés pour chaque
					opération du fine-tuning.
				</p>
				<p>
					Résultat : 2× plus rapide, 70 % moins de mémoire — pour le même
					résultat mathématique exact.
				</p>
			{/snippet}
			{#snippet friend()}
				<p>
					Pour comprendre cette section, il faut savoir une chose :
					<strong>la VRAM est lente</strong>. Vraiment lente, comparée
					aux registres internes du GPU (la SRAM). Quand tu calcules,
					la majeure partie du temps est passée à
					<strong>déplacer des données</strong> entre VRAM et registres,
					pas à faire les calculs eux-mêmes.
				</p>
				<h4>Le problème de PyTorch « générique »</h4>
				<p>
					PyTorch fait chaque opération séparément : il charge en SRAM,
					calcule, écrit en VRAM, recharge pour la prochaine opération.
					Si tu fais 5 opérations d'affilée, tu fais 5 allers-retours
					VRAM ↔ SRAM. C'est du temps perdu.
				</p>
				<h4>Ce que fait un kernel custom Triton</h4>
				<p>
					Un kernel custom <strong>fusionne</strong> plusieurs opérations
					en une seule. Tu charges en SRAM, tu fais 5 opérations dans
					les registres rapides, tu écris UNE FOIS en VRAM. C'est ça la
					magie d'Unsloth : ils ont écrit ces kernels fusionnés pour
					toutes les opérations du Transformer (attention, RoPE, RMSNorm,
					SwiGLU, cross-entropy).
				</p>
				<h4>Pourquoi c'est mathématiquement identique</h4>
				<p>
					Unsloth ne change rien à l'algorithme. Il change juste
					<strong>comment</strong> les opérations sont planifiées sur le
					GPU. La sortie est bit-exact identique à la version PyTorch
					classique. Tu gagnes en vitesse et mémoire, sans perdre en
					qualité.
				</p>
				<p>
					Pour toi, utilisateur, c'est totalement transparent. Tu importes
					Unsloth, tu utilises ses fonctions, et tu profites des kernels
					sans écrire une ligne de Triton. C'est juste plus rapide.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>
					Unsloth réécrit en Triton les fonctions :
				</p>
				<ul>
					<li><strong>RoPE</strong> (Rotary Position Embedding)</li>
					<li><strong>RMSNorm</strong> (la normalisation moderne)</li>
					<li><strong>SwiGLU</strong> (l'activation moderne)</li>
					<li><strong>Cross Entropy Loss</strong></li>
					<li><strong>Self-Attention</strong> + masquage causal</li>
				</ul>
				<p>
					Pour toi, utilisateur, <strong>rien à faire</strong> : tu importes
					Unsloth, tout est branché. Tu profites des kernels sans écrire
					une ligne de Triton.
				</p>
			{/snippet}
			{#snippet deep()}
				<p>
					Triton (OpenAI, 2021) est un DSL pour écrire des kernels GPU en
					Python qui se compilent en CUDA. Avantages :
				</p>
				<ul>
					<li>
						<strong>Fusion d'ops</strong> : on combine plusieurs
						opérations en un seul lancement de kernel — moins
						d'allers-retours mémoire (le vrai goulot).
					</li>
					<li>
						<strong>Tiling automatique</strong> : Triton décide la taille
						des blocs SRAM optimale pour le hardware.
					</li>
					<li>
						<strong>Recomputation intelligente</strong> : Unsloth choisit
						quelles activations garder vs recalculer pendant le backward,
						maximisant l'usage de la VRAM disponible.
					</li>
				</ul>
				<p>
					Le résultat est <strong>mathématiquement équivalent</strong> à
					l'implémentation HuggingFace de référence — Unsloth le démontre
					avec des tests numériques bit-exact pour les modèles supportés.
				</p>
			{/snippet}
		</DifficultyTabs>
	</section>

	<!-- ================== 4½. UNSLOTH × NVIDIA ================== -->
	<section id="nvidia" class="unsl-section">
		<h2 class="unsl-h2">4️⃣ ½ Unsloth × NVIDIA — l'optimisation continue</h2>
		<p class="unsl-lead">
			En mai 2026, NVIDIA et Unsloth ont publié <strong>3 nouvelles
				optimisations</strong> qui ajoutent ≈ 25 % de vitesse en plus, par
			dessus le 2-5× déjà acquis. Auto-activées dès la mise à jour, sans
			perte de précision. Comprendre ces optimisations te dit
			<em>où</em> est le goulot d'étranglement quand on entraîne un LLM.
		</p>

		<div class="unsl-nv-headline">
			<div class="unsl-nv-headline-emoji">🟢</div>
			<div class="unsl-nv-headline-body">
				<strong>« How to Make LLM Training Faster with Unsloth and NVIDIA »</strong>
				— blog post du 6 mai 2026 (Daniel, Michael, Mathew & Datta, équipe Unsloth ×
				NVIDIA). Les optimisations s'activent automatiquement sur RTX,
				datacenter (Hopper, Blackwell B200), et DGX Spark.
				Tu mets à jour Unsloth, c'est tout.
			</div>
		</div>

		<!-- ============== Optimisation 1 ============== -->
		<div class="unsl-nv-opt">
			<div class="unsl-nv-opt-num">1</div>
			<div class="unsl-nv-opt-body">
				<h3>📦 Packed-sequence metadata caching</h3>
				<p class="unsl-nv-opt-tagline">
					Calcul des métadonnées de séquences <strong>une fois</strong>
					au lieu d'une fois par couche.
				</p>

				<h4>Le problème</h4>
				<p>
					Quand on entraîne avec du <em>sequence packing</em> (concatener
					des exemples courts dans une même séquence pour ne pas gaspiller
					de compute), chaque couche du Transformer doit calculer les
					mêmes métadonnées : longueurs des séquences, offsets cumulatifs,
					masques d'attention. Sur un modèle à 32 couches, on
					reconstruisait ces données <strong>32 fois</strong> — alors
					qu'elles sont identiques.
				</p>

				<h4>La solution</h4>
				<p>
					On les calcule <strong>une seule fois</strong>, on cache, on
					réutilise sur toutes les couches.
				</p>

				<div class="unsl-nv-bench">
					<strong>Gain mesuré sur Qwen3-14B en QLoRA SFT :</strong>
					<ul>
						<li>Forward pass : <strong>+43,3 %</strong></li>
						<li>Backward pass : <strong>+5,8 %</strong></li>
						<li>Total bout-en-bout : <strong>+14,3 %</strong></li>
					</ul>
				</div>
			</div>
		</div>

		<!-- ============== Optimisation 2 ============== -->
		<div class="unsl-nv-opt">
			<div class="unsl-nv-opt-num">2</div>
			<div class="unsl-nv-opt-body">
				<h3>🔄 Double-buffered async gradient checkpointing</h3>
				<p class="unsl-nv-opt-tagline">
					Cacher la latence PCIe derrière le compute, en pré-chargeant
					la prochaine activation pendant qu'on calcule la précédente.
				</p>

				<h4>Le problème</h4>
				<p>
					Le <em>gradient checkpointing</em> (qu'on a vu dans les
					hyperparamètres) sauve de la VRAM en stockant les activations
					sur le CPU et en les rechargeant pendant le backward pass.
					Mais cette copie CPU → GPU prend du temps, et pendant ce
					temps, le GPU attend.
				</p>

				<h4>La solution</h4>
				<p>
					Deux buffers (A et B). Pendant que le backward tourne sur
					l'activation chargée dans A, on précharge déjà la suivante
					dans B via un stream CUDA dédié. Quand le backward A finit,
					B est déjà prête. <strong>Le GPU n'attend plus jamais</strong>.
				</p>

				<!-- Schéma double-buffering -->
				<div class="unsl-nv-schema">
					<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
						<!-- Time axis -->
						<line x1="40" y1="180" x2="580" y2="180" stroke="#cbd5e1" stroke-width="1" />
						<text x="40" y="195" font-size="10" fill="#64748b" font-family="monospace">t = 0</text>
						<text x="560" y="195" font-size="10" fill="#64748b" font-family="monospace">temps →</text>

						<!-- AVANT — sans double buffering -->
						<text x="40" y="20" font-size="11" fill="#dc2626" font-weight="700" font-family="monospace">SANS double buffering</text>
						<g>
							<rect x="40" y="30" width="120" height="28" fill="#fb923c" rx="4" />
							<text x="100" y="48" font-size="10" fill="#fff" text-anchor="middle" font-family="monospace">copy CPU→GPU</text>

							<rect x="170" y="30" width="80" height="28" fill="#16a34a" rx="4" />
							<text x="210" y="48" font-size="10" fill="#fff" text-anchor="middle" font-family="monospace">backward</text>

							<rect x="260" y="30" width="120" height="28" fill="#fb923c" rx="4" />
							<text x="320" y="48" font-size="10" fill="#fff" text-anchor="middle" font-family="monospace">copy CPU→GPU</text>

							<rect x="390" y="30" width="80" height="28" fill="#16a34a" rx="4" />
							<text x="430" y="48" font-size="10" fill="#fff" text-anchor="middle" font-family="monospace">backward</text>

							<text x="490" y="48" font-size="11" fill="#dc2626" font-family="monospace">→ ⏱️ lent</text>
						</g>

						<!-- APRÈS — avec double buffering -->
						<text x="40" y="80" font-size="11" fill="#76b900" font-weight="700" font-family="monospace">AVEC double buffering</text>
						<text x="20" y="105" font-size="10" fill="#64748b" font-family="monospace">A</text>
						<text x="20" y="135" font-size="10" fill="#64748b" font-family="monospace">B</text>
						<g>
							<!-- Buffer A: copy then backward -->
							<rect x="40" y="92" width="100" height="22" fill="#fb923c" rx="3" />
							<text x="90" y="107" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">copy A</text>

							<rect x="145" y="92" width="80" height="22" fill="#16a34a" rx="3" />
							<text x="185" y="107" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">backward A</text>

							<rect x="230" y="92" width="80" height="22" fill="#16a34a" rx="3" />
							<text x="270" y="107" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">backward C</text>

							<!-- Buffer B: copy in parallel with A's backward -->
							<rect x="145" y="118" width="100" height="22" fill="#fb923c" rx="3" />
							<text x="195" y="133" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">copy B (parallèle)</text>

							<rect x="250" y="118" width="80" height="22" fill="#16a34a" rx="3" />
							<text x="290" y="133" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">backward B</text>

							<rect x="335" y="118" width="100" height="22" fill="#fb923c" rx="3" />
							<text x="385" y="133" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">copy D (parallèle)</text>

							<text x="450" y="120" font-size="11" fill="#76b900" font-family="monospace">→ ⚡ rapide</text>
						</g>

						<!-- Légende -->
						<rect x="40" y="160" width="14" height="10" fill="#fb923c" rx="2" />
						<text x="60" y="170" font-size="10" fill="#64748b" font-family="monospace">copie mémoire CPU→GPU</text>
						<rect x="220" y="160" width="14" height="10" fill="#16a34a" rx="2" />
						<text x="240" y="170" font-size="10" fill="#64748b" font-family="monospace">backward pass GPU</text>
					</svg>
					<p class="unsl-nv-schema-caption">
						💡 Lecture : sans buffering, copie ET calcul se succèdent → le GPU
						attend la mémoire. Avec 2 buffers, la copie de B se fait
						<strong>pendant</strong> le backward de A → la copie est cachée
						derrière le compute.
					</p>
				</div>

				<div class="unsl-nv-bench">
					<strong>Gain mesuré (selon taille du modèle) :</strong>
					<ul>
						<li>Modèle 8B : <strong>+8,4 %</strong></li>
						<li>Modèle 14B : <strong>+6,7 %</strong></li>
						<li>Modèle 32B : <strong>+4,6 %</strong></li>
					</ul>
					<p style="margin-top:0.4rem; font-size:0.8rem; opacity:0.8">
						Plus le modèle est gros, plus le compute domine, donc le
						gain relatif diminue — mais en absolu il reste significatif.
					</p>
				</div>

				<div class="unsl-nv-tradeoff">
					<strong>Coût mémoire :</strong> +0,23 à 0,47 Go pour le double
					buffer. Négligeable comparé au gain en vitesse.
				</div>
			</div>
		</div>

		<!-- ============== Optimisation 3 ============== -->
		<div class="unsl-nv-opt">
			<div class="unsl-nv-opt-num">3</div>
			<div class="unsl-nv-opt-body">
				<h3>🧠 MoE routing optimization</h3>
				<p class="unsl-nv-opt-tagline">
					Routage des tokens vers les experts en O(1) au lieu de O(N
					experts), pour les modèles Mixture-of-Experts.
				</p>

				<h4>Le problème</h4>
				<p>
					Dans un Mixture-of-Experts (MoE) — comme GPT-OSS ou Mixtral —
					chaque token est routé vers quelques « experts » spécialisés
					sur les centaines disponibles. L'implémentation naïve fait une
					requête dynamique <em>par expert</em> pour récupérer ses
					tokens — coût en
					<code>O(num_experts)</code>.
				</p>

				<h4>La solution</h4>
				<p>
					Un <em>argsort</em> + <em>bincount</em> en une passe : on trie
					une fois tous les tokens par expert assigné, on compte par
					expert via bincount, puis on découpe par offsets. Coût
					<code>O(1)</code> par expert.
				</p>

				<div class="unsl-nv-bench">
					<strong>Gain mesuré (sur GPT-OSS) :</strong>
					<ul>
						<li>Validation équipe : <strong>+10 à 15 %</strong> overall</li>
						<li>Chemin ciblé : <strong>+23 % forward / +13 % backward</strong></li>
					</ul>
				</div>
			</div>
		</div>

		<!-- ============== Synthèse ============== -->
		<Callout variant="insight" title="🚀 Synthèse — l'effet pour toi">
			<p>
				<strong>Combiné, le gain net est ≈ 25 % de vitesse en plus</strong>
				<em>par-dessus</em> le 2-5× initial d'Unsloth. Sur ta RTX 5000,
				un fine-tuning Mistral 7B qui prenait 20 min descend vers ~15 min,
				sans toucher à ton code. Mise à jour :
			</p>
			<pre style="background:#1a1a1a; color:#e2e8f0; padding:0.75rem; border-radius:0.5rem; font-family:var(--font-mono); font-size:0.85rem; overflow-x:auto"><code>pip install -U "unsloth[cu121] @ git+https://github.com/unslothai/unsloth.git"</code></pre>
			<p>
				Pas de changement de code requis. Tu profites des 3 optimisations
				dès le prochain training.
			</p>
		</Callout>

		<Callout variant="note" title="🎓 Pourquoi c'est éclairant pédagogiquement">
			<p>
				Ces 3 optimisations te montrent <strong>où vit la lenteur</strong>
				dans un fine-tuning :
			</p>
			<ul>
				<li><strong>1.</strong> Recalculs redondants entre couches (caching)</li>
				<li><strong>2.</strong> Latence mémoire CPU↔GPU (double buffering)</li>
				<li><strong>3.</strong> Indexation dynamique inefficace (sort+bincount)</li>
			</ul>
			<p>
				Ce sont les 3 grandes familles de goulots d'étranglement qu'on
				rencontre partout en ML system. Comprendre ces patterns te rend
				plus malin pour profiler tes propres entraînements et reconnaître
				où ça coince.
			</p>
		</Callout>
	</section>

	<!-- ================== 5. PRÉPARER UN DATASET ================== -->
	<section id="dataset" class="unsl-section">
		<h2 class="unsl-h2">5️⃣ Préparer un dataset</h2>
		<p class="unsl-lead">
			Le dataset est <strong>la variable la plus importante</strong> de tout
			fine-tuning. <em>Garbage in, garbage out</em> — un modèle ne peut
			pas être meilleur que ses données.
		</p>

		<Callout variant="insight" title="🎯 La règle d'or">
			<p>
				<strong>Quality &gt; Quantity.</strong> 100 exemples bien rédigés
				battent 10 000 exemples bruités. Vérifie chaque exemple à la
				main — au début, c'est non négociable.
			</p>
		</Callout>

		<h3 class="unsl-h3">Les 3 formats que tu rencontreras</h3>
		<div class="unsl-formats">
			<div class="unsl-format">
				<div class="unsl-format-head">📄 Alpaca</div>
				<p>Le plus simple. Trois champs : <code>instruction</code>, <code>input</code> (optionnel), <code>output</code>.</p>
				<pre class="unsl-code"><code>{`{
  "instruction": "Traduis en anglais.",
  "input": "Bonjour, comment ça va ?",
  "output": "Hello, how are you?"
}`}</code></pre>
			</div>
			<div class="unsl-format">
				<div class="unsl-format-head">💬 ShareGPT</div>
				<p>Format « conversation ». Une liste d'échanges avec rôles. Adapté aux assistants multi-tours.</p>
				<pre class="unsl-code"><code>{`{
  "conversations": [
    {"from": "human", "value": "..."},
    {"from": "gpt",   "value": "..."}
  ]
}`}</code></pre>
			</div>
			<div class="unsl-format">
				<div class="unsl-format-head">🧠 ChatML</div>
				<p>Format moderne avec balises spéciales. Standard chez Mistral, Qwen, Llama-3.</p>
				<pre class="unsl-code"><code>{`<|im_start|>system
Tu es un assistant…<|im_end|>
<|im_start|>user
Bonjour<|im_end|>
<|im_start|>assistant
Bonjour…<|im_end|>`}</code></pre>
			</div>
		</div>

		<Callout variant="note" title="📌 Le chat template — n'invente rien">
			<p>
				Chaque modèle vient avec son <strong>chat template</strong> officiel
				(dans <code>tokenizer_config.json</code>). Tu DOIS l'utiliser tel
				quel : un mauvais template = un modèle qui parle mal. Unsloth
				expose <code>get_chat_template()</code> pour le récupérer
				correctement par modèle.
			</p>
		</Callout>

		<h3 class="unsl-h3">Critères de qualité d'un bon dataset</h3>
		<ul class="unsl-checklist">
			<li><strong>Diversité</strong> : couvre toutes les variantes que tu veux gérer (longueurs, sujets, styles).</li>
			<li><strong>Cohérence</strong> : le même type d'input doit produire le même type d'output.</li>
			<li><strong>Format unifié</strong> : pas de mélange Alpaca + ShareGPT.</li>
			<li><strong>Pas de fuite</strong> : tes exemples de validation ne doivent PAS être dans le train.</li>
			<li><strong>Volume minimum</strong> : 50–100 exemples pour un changement de style ; 1 000+ pour une nouvelle compétence.</li>
			<li><strong>Long-tail</strong> : inclus quelques exemples « bizarres » pour la robustesse.</li>
		</ul>
	</section>

	<!-- ================== 6. HYPERPARAMÈTRES ================== -->
	<section id="hyperparams" class="unsl-section">
		<h2 class="unsl-h2">6️⃣ Les hyperparamètres — la table de vérité</h2>
		<p class="unsl-lead">
			Voici tous les boutons que tu vas voir dans une cellule Unsloth, avec
			leurs valeurs recommandées de départ et le moment où il faut les
			changer.
		</p>

		<div class="unsl-hp-grid">
			<div class="unsl-hp-group">
				<h3 class="unsl-hp-group-title">📐 LoRA</h3>
				<table class="unsl-hp-table">
					<thead><tr><th>Param</th><th>Défaut</th><th>Quand changer ?</th></tr></thead>
					<tbody>
						<tr><td><code>r</code></td><td>16</td><td>32-64 si dataset gros (&gt; 10k); 8 si très petit GPU.</td></tr>
						<tr><td><code>lora_alpha</code></td><td>16</td><td>= r ou 2r. Règle empirique : <code>α = r</code> pour Unsloth.</td></tr>
						<tr><td><code>lora_dropout</code></td><td>0</td><td>0 toujours avec Unsloth (kernels optimisés).</td></tr>
						<tr><td><code>target_modules</code></td><td>q,k,v,o,gate,up,down</td><td>Garde tout. Couper le FFN dégrade fort.</td></tr>
						<tr><td><code>bias</code></td><td>"none"</td><td>Ne touche pas.</td></tr>
					</tbody>
				</table>
			</div>

			<div class="unsl-hp-group">
				<h3 class="unsl-hp-group-title">🎚️ Optimisation</h3>
				<table class="unsl-hp-table">
					<thead><tr><th>Param</th><th>Défaut</th><th>Quand changer ?</th></tr></thead>
					<tbody>
						<tr><td><code>learning_rate</code></td><td>2e-4</td><td>Baisser à 1e-4 si la loss explose ; 5e-4 si elle stagne.</td></tr>
						<tr><td><code>num_train_epochs</code></td><td>1-3</td><td>1 si grand dataset, 3 si &lt; 500 exemples.</td></tr>
						<tr><td><code>max_steps</code></td><td>60-200</td><td>Démarre à 60, monte si la loss baisse encore.</td></tr>
						<tr><td><code>warmup_ratio</code></td><td>0.05</td><td>5 % du total. Évite l'explosion en début.</td></tr>
						<tr><td><code>lr_scheduler_type</code></td><td>"linear"</td><td>"cosine" si tu veux un atterrissage doux.</td></tr>
						<tr><td><code>weight_decay</code></td><td>0.01</td><td>Ne touche pas en général.</td></tr>
						<tr><td><code>optim</code></td><td>"adamw_8bit"</td><td>Garder. Économie de VRAM significative.</td></tr>
						<tr><td><code>seed</code></td><td>42</td><td>Pour la reproductibilité.</td></tr>
					</tbody>
				</table>
			</div>

			<div class="unsl-hp-group">
				<h3 class="unsl-hp-group-title">📦 Batching</h3>
				<table class="unsl-hp-table">
					<thead><tr><th>Param</th><th>Défaut</th><th>Quand changer ?</th></tr></thead>
					<tbody>
						<tr><td><code>per_device_train_batch_size</code></td><td>2</td><td>Monter si VRAM le permet — gain de stabilité.</td></tr>
						<tr><td><code>gradient_accumulation_steps</code></td><td>4</td><td>Compense un petit batch_size. Effective batch = b × ga.</td></tr>
						<tr><td><code>max_seq_length</code></td><td>2048</td><td>Aligne sur la longueur de tes exemples + marge.</td></tr>
						<tr><td><code>packing</code></td><td>False</td><td>True si tes exemples sont courts — gain de vitesse.</td></tr>
					</tbody>
				</table>
			</div>

			<div class="unsl-hp-group">
				<h3 class="unsl-hp-group-title">💾 Mémoire</h3>
				<table class="unsl-hp-table">
					<thead><tr><th>Param</th><th>Défaut</th><th>Quand changer ?</th></tr></thead>
					<tbody>
						<tr><td><code>load_in_4bit</code></td><td>True</td><td>Garder pour QLoRA. False uniquement si tu as &gt; 24 Go VRAM.</td></tr>
						<tr><td><code>use_gradient_checkpointing</code></td><td>"unsloth"</td><td>Mode Unsloth optimisé — garder.</td></tr>
						<tr><td><code>fp16 / bf16</code></td><td>auto</td><td>bf16 si Ampere+ (RTX 30/40, A100, H100), sinon fp16.</td></tr>
					</tbody>
				</table>
			</div>
		</div>

		<Callout variant="insight" title="🧪 Recette de départ pour un débutant">
			<p>
				Garde tous les défauts ci-dessus. Lance pour 60 steps. Regarde la
				loss. Si elle baisse joliment, monte à 200 steps. Sinon, reviens
				vérifier ton dataset (95 % des problèmes sont là).
			</p>
		</Callout>

		<!-- ============== Deep dive ============== -->
		<h3 class="unsl-h3" style="margin-top:2rem">🔬 En profondeur — les 6 hyperparamètres qui comptent vraiment</h3>
		<p>
			Les tables ci-dessus sont la <strong>référence rapide</strong>. Ici on
			rentre dans le « pourquoi » de chaque levier-clé. Si tu comprends
			ces 6 cartes, tu sauras diagnostiquer 90 % des problèmes de training.
		</p>

		<!-- HP1 — Learning Rate -->
		<article class="unsl-hp-deep">
			<header class="unsl-hp-deep-head">
				<span class="unsl-hp-deep-emoji">🎚️</span>
				<div>
					<h4>Learning Rate (LR)</h4>
					<span class="unsl-hp-deep-default">défaut Unsloth : <code>2e-4</code></span>
				</div>
			</header>
			<div class="unsl-hp-deep-body">
				<h5>À quoi ça sert</h5>
				<p>
					Le learning rate contrôle <strong>la taille des pas</strong> de
					la descente de gradient. À chaque étape, le modèle calcule la
					direction dans laquelle améliorer ses poids ; le LR dit à quel
					point on avance dans cette direction. C'est <em>le</em>
					hyperparamètre le plus critique d'un entraînement de LLM.
				</p>
				<h5>Si tu changes</h5>
				<ul>
					<li>
						<strong>LR ↑ (5e-4, 1e-3)</strong> : convergence plus rapide
						mais instabilité possible (loss qui explose en NaN, catastrophic
						forgetting).
					</li>
					<li>
						<strong>LR ↓ (1e-4, 5e-5)</strong> : entraînement plus lent et
						plus sûr, mais parfois trop lent pour converger en peu de steps.
					</li>
				</ul>
				<h5>Intuition</h5>
				<p>
					Imagine descendre une montagne en brouillard. LR élevé = grandes
					enjambées (rapide mais tu peux dépasser le bas et remonter de
					l'autre côté). LR faible = petits pas (sûr mais tu mets une
					éternité). <strong>2e-4</strong> = vitesse de marche
					confortable, calibrée pour LoRA sur QLoRA 4-bit.
				</p>
				<h5>Le piège classique</h5>
				<p>
					Avec un <strong>full fine-tuning</strong> (sans LoRA, tous les
					poids modifiés), tu DOIS descendre à 1e-5 ou 5e-6 — sinon tu
					effaces les compétences pré-entraînées. La règle : LoRA tolère
					10-100× plus de LR que full fine-tuning, parce que tu ne touches
					qu'à 0,5 % des poids.
				</p>
				<h5>📊 Exemple chiffré — 3 trajectoires de loss sur Mistral 7B</h5>
				<table class="unsl-hp-example-table">
					<thead><tr><th>LR</th><th>step 0</th><th>step 30</th><th>step 60</th><th>verdict</th></tr></thead>
					<tbody>
						<tr><td><code>1e-3</code></td><td>2.4</td><td>4.8 ⚠️</td><td>NaN 💥</td><td>Trop haut, divergence</td></tr>
						<tr><td><code>2e-4</code></td><td>2.4</td><td>1.1</td><td>0.7 ✅</td><td>Sweet spot</td></tr>
						<tr><td><code>5e-5</code></td><td>2.4</td><td>1.9</td><td>1.6 🐢</td><td>Trop bas, sous-entraîné</td></tr>
					</tbody>
				</table>
				<p class="unsl-hp-example-caption">
					💡 À LR fixe, multiplier par 5 fait passer du sweet spot à
					l'explosion. La marge est étroite. Si la loss explose
					<strong>au step 1</strong>, divise par 2. Si elle stagne au-dessus
					de 1.5 après 60 steps, multiplie par 2.
				</p>
			</div>
		</article>

		<!-- HP2 — LoRA rank (r) -->
		<article class="unsl-hp-deep">
			<header class="unsl-hp-deep-head">
				<span class="unsl-hp-deep-emoji">🎯</span>
				<div>
					<h4>LoRA rank (r)</h4>
					<span class="unsl-hp-deep-default">défaut Unsloth : <code>16</code></span>
				</div>
			</header>
			<div class="unsl-hp-deep-body">
				<h5>À quoi ça sert</h5>
				<p>
					Le rang détermine la <strong>capacité d'apprentissage</strong>
					des matrices LoRA — combien d'information elles peuvent encoder.
					Mathématiquement, c'est la dimension intérieure de la
					factorisation
					<code>ΔW = BA</code> où <code>A</code> est <code>r × d</code> et
					<code>B</code> est <code>d × r</code>.
				</p>
				<h5>Si tu changes</h5>
				<ul>
					<li>
						<strong>r ↑ (32, 64, 128)</strong> : plus de capacité, utile
						pour datasets gros (10k+) ou tâches complexes (raisonnement,
						code). Plus de paramètres entraînés, plus de VRAM, plus de
						temps.
					</li>
					<li>
						<strong>r ↓ (4, 8)</strong> : moins de capacité, peut suffire
						pour de simples changements de style ou ton. Très léger, plus
						rapide.
					</li>
				</ul>
				<h5>Intuition</h5>
				<p>
					r est comme la <strong>bande passante</strong> d'un canal. Avec
					<code>r = 16</code>, tu peux faire passer un volume modéré
					d'information du dataset vers le modèle. Avec <code>r = 64</code>,
					tu peux faire passer 4× plus — mais tu paies en VRAM et risque de
					mémorisation si le dataset est petit.
				</p>
				<h5>Le piège classique</h5>
				<p>
					<strong>r trop grand sur petit dataset</strong> → le LoRA mémorise
					au lieu de généraliser (overfitting). <strong>r trop petit pour
						une tâche complexe</strong> → le LoRA n'a pas la capacité, la
					loss stagne haute. Règle empirique : 16 pour démarrer, monte à 32
					si tu as 5k+ exemples, 64 si tu as 50k+.
				</p>
				<h5>📊 Exemple chiffré — coût du rang sur Mistral 7B</h5>
				<table class="unsl-hp-example-table">
					<thead><tr><th>r</th><th>Params entraînés</th><th>% du modèle</th><th>VRAM ajoutée</th><th>Cas type</th></tr></thead>
					<tbody>
						<tr><td><code>4</code></td><td>~10 M</td><td>0.13 %</td><td>~ 40 Mo</td><td>Style très léger</td></tr>
						<tr><td><code>8</code></td><td>~21 M</td><td>0.27 %</td><td>~ 80 Mo</td><td>Datasets très petits</td></tr>
						<tr><td><code>16</code></td><td>~42 M</td><td>0.55 %</td><td>~ 160 Mo</td><td><strong>Sweet spot 90 % des cas</strong></td></tr>
						<tr><td><code>32</code></td><td>~84 M</td><td>1.10 %</td><td>~ 320 Mo</td><td>Datasets ≥ 5k, complexité moyenne</td></tr>
						<tr><td><code>64</code></td><td>~168 M</td><td>2.20 %</td><td>~ 640 Mo</td><td>Datasets ≥ 50k, raisonnement</td></tr>
						<tr><td><code>128</code></td><td>~336 M</td><td>4.40 %</td><td>~ 1.3 Go</td><td>Quasi équivalent full fine-tune</td></tr>
					</tbody>
				</table>
				<p class="unsl-hp-example-caption">
					💡 Doubler r double les params entraînés et la VRAM. Sur ta RTX
					5000, tu peux te permettre r=64 sans souci. Mais l'augmentation
					ne paie que si le dataset est suffisant — sinon tu mémorises.
				</p>
			</div>
		</article>

		<!-- HP3 — LoRA alpha -->
		<article class="unsl-hp-deep">
			<header class="unsl-hp-deep-head">
				<span class="unsl-hp-deep-emoji">✖️</span>
				<div>
					<h4>LoRA alpha (α)</h4>
					<span class="unsl-hp-deep-default">défaut Unsloth : <code>= r</code> (donc 16 par défaut)</span>
				</div>
			</header>
			<div class="unsl-hp-deep-body">
				<h5>À quoi ça sert</h5>
				<p>
					Avant d'ajouter la sortie du LoRA aux poids du modèle, on la
					multiplie par <code>α / r</code>. C'est un facteur d'échelle qui
					contrôle <strong>l'impact relatif</strong> du LoRA sur le
					comportement du modèle.
				</p>
				<h5>Si tu changes</h5>
				<ul>
					<li>
						<strong>α/r ↑</strong> (α = 2r, 4r) : LoRA plus dominant,
						training plus agressif. Équivalent fonctionnel : un LR effectif
						plus haut <em>sur le LoRA</em>.
					</li>
					<li>
						<strong>α/r ↓</strong> (α = r/2) : LoRA plus discret, training
						plus conservateur.
					</li>
				</ul>
				<h5>Intuition</h5>
				<p>
					α est comme un <strong>volume</strong> sur ton LoRA. À <em>r</em>
					fixe, doubler α revient à doubler le « volume » de la voix du
					LoRA dans la sortie finale du modèle.
				</p>
				<h5>Le piège classique</h5>
				<p>
					<strong>Convention Unsloth : α = r</strong> (donc α/r = 1). C'est
					la convention recommandée et utilisée dans tous leurs notebooks.
					La convention HuggingFace classique est α = 2r (impact ×2).
					<strong>Si tu copies-colles du code d'ailleurs, vérifie la
						convention</strong> — sinon ton training peut diverger ou
					sous-performer.
				</p>
			</div>
		</article>

		<!-- HP4 — Epochs / max_steps -->
		<article class="unsl-hp-deep">
			<header class="unsl-hp-deep-head">
				<span class="unsl-hp-deep-emoji">⏱️</span>
				<div>
					<h4>num_train_epochs / max_steps</h4>
					<span class="unsl-hp-deep-default">défaut : 1–3 epochs ou 60–200 steps</span>
				</div>
			</header>
			<div class="unsl-hp-deep-body">
				<h5>À quoi ça sert</h5>
				<p>
					Combien de fois le modèle voit chaque exemple. Une <em>epoch</em>
					= une passe complète sur le dataset. <em>max_steps</em> est une
					alternative qui limite par nombre de mises à jour de poids
					(utile si dataset très gros, on n'a pas besoin d'une epoch
					entière).
				</p>
				<h5>Si tu changes</h5>
				<ul>
					<li>
						<strong>Plus d'epochs (5+)</strong> sur un petit dataset → risque
						d'<strong>overfitting</strong> : le modèle mémorise au lieu de
						généraliser.
					</li>
					<li>
						<strong>Moins d'epochs (1)</strong> → plus sûr mais peut
						sous-entraîner si dataset petit ou apprentissage lent.
					</li>
				</ul>
				<h5>Intuition</h5>
				<p>
					Imagine relire un livre. <strong>1 fois</strong> = compréhension
					générale. <strong>3 fois</strong> = bonne maîtrise.
					<strong>10 fois</strong> = tu peux le réciter par cœur, mais tu
					rates l'esprit. Pour un LLM c'est pareil : trop d'epochs = il
					récite tes données au lieu d'en avoir tiré la bonne abstraction.
				</p>
				<h5>Le piège classique</h5>
				<p>
					<strong>Surveille la loss pour décider</strong>. Si elle baisse
					encore en fin de training, ajoute des steps. Si elle stagne en
					bas, c'est fini — ne force pas. Idéalement : un eval set séparé,
					arrête quand l'eval loss commence à remonter (early stopping).
					Pour 50–100 exemples : 2–3 epochs. Pour 1000+ exemples : 1 epoch
					suffit souvent.
				</p>
			</div>
		</article>

		<!-- HP5 — Effective batch size -->
		<article class="unsl-hp-deep">
			<header class="unsl-hp-deep-head">
				<span class="unsl-hp-deep-emoji">📦</span>
				<div>
					<h4>Effective Batch Size (per_device × grad_accum)</h4>
					<span class="unsl-hp-deep-default">défaut Unsloth : 16 (= 4 × 4)</span>
				</div>
			</header>
			<div class="unsl-hp-deep-body">
				<h5>À quoi ça sert</h5>
				<p>
					Nombre d'exemples que le modèle voit avant <strong>chaque mise
						à jour</strong> des poids. Le batch effectif est le produit du
					<code>per_device_train_batch_size</code> (parallélisme matériel)
					et du <code>gradient_accumulation_steps</code> (cumul logique).
				</p>
				<h5>Si tu changes</h5>
				<ul>
					<li>
						<strong>Batch ↑ (32, 64, 128)</strong> : entraînement plus stable,
						gradient mieux estimé, qualité finale souvent meilleure. Plus de
						VRAM si via <code>per_device</code> ; plus de temps si via
						<code>grad_accum</code>.
					</li>
					<li>
						<strong>Batch ↓ (1, 2, 4)</strong> : updates plus fréquents,
						peut accélérer la convergence sur petit dataset, mais bruit
						plus important.
					</li>
				</ul>
				<h5>Intuition</h5>
				<p>
					Imagine un sondage politique. Interroger 4 personnes te donne une
					opinion bruitée. Interroger 1000 personnes te donne une opinion
					fiable. Le batch fonctionne pareil : plus d'exemples avant de
					mettre à jour, plus la direction de mise à jour est fiable.
				</p>
				<h5>Le piège classique</h5>
				<p>
					Pas de valeur universelle — calibre selon la taille du dataset.
					Pour 100 exemples × batch 16 = 6 batches/epoch (très peu, peut
					nécessiter plus d'epochs). Pour 10 000 × batch 16 = 625 batches —
					dynamique saine. <strong>Sur ta RTX 5000, tu peux te permettre
						per_device = 4 voire 8</strong> sans souci de VRAM.
				</p>
			</div>
		</article>

		<!-- HP6 — LR Schedule -->
		<article class="unsl-hp-deep">
			<header class="unsl-hp-deep-head">
				<span class="unsl-hp-deep-emoji">📈</span>
				<div>
					<h4>LR Schedule (warmup + scheduler)</h4>
					<span class="unsl-hp-deep-default">défaut : warmup 5%, scheduler cosine</span>
				</div>
			</header>
			<div class="unsl-hp-deep-body">
				<h5>À quoi ça sert</h5>
				<p>
					Comment le learning rate <strong>évolue dans le temps</strong>.
					Deux phases :
				</p>
				<ul>
					<li>
						<strong>Warmup</strong> : phase initiale où le LR monte
						progressivement de 0 vers sa valeur cible. Évite que les
						premiers gradients (souvent erratiques) ne déstabilisent tout.
					</li>
					<li>
						<strong>Scheduler</strong> : comment le LR redescend ensuite
						vers 0. Trois choix courants : <code>constant</code> (jamais),
						<code>linear</code> (descente droite), <code>cosine</code>
						(descente sinusoïdale plus douce à la fin).
					</li>
				</ul>
				<h5>Si tu changes</h5>
				<ul>
					<li>
						<strong>Warmup plus long (10–20%)</strong> : démarrage plus
						prudent, utile sur gros datasets et modèles instables.
					</li>
					<li>
						<strong>Cosine vs linear</strong> : cosine descend plus doucement
						à la toute fin → atterrissage smooth, souvent meilleure
						qualité finale.
					</li>
				</ul>
				<h5>Intuition</h5>
				<p>
					Warmup = <strong>l'échauffement avant le sport</strong>. Tu ne
					pars pas à fond froid, tu risques de te claquer un muscle. Cosine
					= descente progressive en deuxième mi-temps : tu atterris
					tranquillement plutôt que de t'arrêter brutalement.
				</p>
				<h5>Le piège classique</h5>
				<p>
					Pas de warmup → les premiers steps peuvent diverger violemment
					(loss qui explose dès le step 1). Pas de scheduler → le LR reste
					fort jusqu'à la fin et le modèle n'arrive jamais à se poser sur
					une bonne solution. <strong>Cosine + warmup 5–10%</strong> est la
					recette gagnante pour 90 % des cas.
				</p>
			</div>
		</article>
	</section>

	<!-- ================== 6½. SIMULATEURS GRADIENT/COST ================== -->
	<section id="simulateurs" class="unsl-section">
		<h2 class="unsl-h2">6️⃣ ½ Comprendre vraiment — gradient descent et fonction de coût ⭐</h2>
		<p class="unsl-lead">
			Avant d'attaquer les méthodes, il faut <strong>vraiment</strong>
			comprendre comment un LLM « apprend ». 3 simulateurs interactifs :
			(1) la descente de gradient sur un paysage de loss, (2) la fonction
			cross-entropy qui mesure l'erreur, (3) l'impact direct du learning
			rate sur la courbe de loss.
		</p>

		<!-- ===== 1. Gradient descent ===== -->
		<h3 class="unsl-h3">① La descente de gradient — la mécanique de l'apprentissage</h3>
		<p>
			Imagine un paysage de collines (la <em>loss landscape</em>). Le
			modèle est une bille posée dessus. À chaque step, on calcule la
			pente (gradient) à sa position et on la pousse dans le sens de la
			descente. Le <strong>learning rate</strong> est la taille du pas.
			Trop petit → on rampe. Trop grand → on rate la vallée et on
			explose.
		</p>

		<GradientDescentSim />

		<!-- ===== 2. Cross-entropy ===== -->
		<h3 class="unsl-h3">② La fonction de coût — comment on mesure l'erreur</h3>
		<p>
			Pour chaque token à prédire, le modèle attribue une probabilité au
			« bon » token. Si la proba est élevée, l'erreur est faible. La
			fonction de coût utilisée est la <strong>cross-entropy</strong> : <code>L = -log(p)</code>.
			Joue avec le slider pour sentir la courbe.
		</p>

		<CrossEntropySim />

		<!-- ===== 3. Loss curves selon LR ===== -->
		<h3 class="unsl-h3">③ Impact direct du learning rate sur la courbe de loss</h3>
		<p>
			Quand tu changes <code>learning_rate</code> dans Unsloth, voici ce
			qui se passe sur la loss au fil des steps. 4 scénarios pré-calculés
			pour intérioriser quoi attendre.
		</p>

		<LossCurveSim />
	</section>

	<!-- ================== 7. MÉTHODES ================== -->
	<section id="methodes" class="unsl-section">
		<h2 class="unsl-h2">7️⃣ Les méthodes — SFT, DPO, et au-delà</h2>
		<p class="unsl-lead">
			Tous les fine-tunings ne se ressemblent pas. Voici les principales
			méthodes, dans leur ordre habituel d'apparition dans un pipeline.
		</p>

		<!-- Pipeline overview diagram -->
		<div class="unsl-pipeline">
			<div class="unsl-pipeline-step">
				<div class="unsl-pipeline-emoji">📖</div>
				<strong>1. Continued Pretraining</strong>
				<span>(optionnel) Texte brut → connaissances métier</span>
			</div>
			<div class="unsl-pipeline-arrow">→</div>
			<div class="unsl-pipeline-step">
				<div class="unsl-pipeline-emoji">📚</div>
				<strong>2. SFT</strong>
				<span>Instructions → comportement</span>
			</div>
			<div class="unsl-pipeline-arrow">→</div>
			<div class="unsl-pipeline-step unsl-pipeline-rl">
				<div class="unsl-pipeline-emoji">🎮</div>
				<strong>3. Alignement</strong>
				<span>Préférences → bon comportement</span>
			</div>
		</div>
		<p class="unsl-lead unsl-pipeline-caption">
			C'est le pipeline standard. SFT seul suffit pour 80 % des cas. Continued
			Pretraining si tu as un gros corpus métier en amont. Alignement (RL ou
			DPO) si tu veux pousser le modèle vers des comportements préférés.
		</p>

		<!-- ============================================== -->
		<!-- FAMILLE 1 — IMITATION                           -->
		<!-- ============================================== -->
		<h3 class="unsl-family-title">
			<span class="unsl-family-icon">📚</span> Famille 1 — Apprentissage par imitation
		</h3>
		<p>
			Tu fournis des exemples « voici ce que je veux », le modèle apprend
			à les reproduire. C'est de l'<em>imitation</em> au sens classique :
			le modèle copie le comportement vu dans les données. Simple,
			puissant, c'est le point de départ obligatoire.
		</p>

		<!-- SFT -->
		<article class="unsl-method-deep">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">📚</span>
				<div>
					<h4>SFT — Supervised Fine-Tuning</h4>
					<p class="unsl-method-deep-tagline">Démarrer ici. Pour 80 % des cas, ça suffit.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>Comment ça marche</h5>
				<p>
					Tu fournis un dataset de paires <code>(prompt, réponse idéale)</code>
					au format Alpaca, ShareGPT ou ChatML. Le modèle voit le prompt,
					essaie de prédire la réponse token par token, on calcule la loss
					(cross-entropy) entre sa prédiction et ta réponse, on rétro-propage
					et on ajuste les LoRA.
				</p>
				<h5>Format de dataset typique</h5>
				<pre class="unsl-code"><code>{`{"instruction": "Explique LoRA", "input": "", "output": "LoRA est..."}
{"instruction": "Traduis en EN", "input": "Bonjour", "output": "Hello"}`}</code></pre>
				<h5>Quand l'utiliser</h5>
				<ul>
					<li><strong>Changer le style</strong> (formel, technique, ton décontracté…)</li>
					<li><strong>Imposer un format</strong> (JSON strict, markdown, structure)</li>
					<li><strong>Apprendre un jargon métier</strong> (juridique, médical)</li>
					<li><strong>Ajouter une langue</strong> ou une variante linguistique</li>
				</ul>
				<h5>Pièges</h5>
				<ul>
					<li><strong>Mémorisation au lieu d'apprentissage</strong> si trop d'epochs sur peu de données.</li>
					<li><strong>Catastrophic forgetting</strong> si learning rate trop élevé.</li>
					<li><strong>Hallucinations factuelles</strong> si tu mets des « connaissances » dans tes outputs (contre-emploi du SFT).</li>
				</ul>
			</div>
		</article>

		<!-- Continued Pretraining -->
		<article class="unsl-method-deep">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">📖</span>
				<div>
					<h4>Continued Pretraining (CPT)</h4>
					<p class="unsl-method-deep-tagline">Domaine métier en profondeur, avant le SFT.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>Comment ça marche</h5>
				<p>
					Pas d'instructions, juste du <strong>texte brut</strong> (livres,
					articles, documentation interne). Le modèle apprend simplement à
					prédire le token suivant — comme la phase 1 chez Meta, mais sur
					tes données. Tu prolonges le pré-entraînement sur un corpus
					spécialisé.
				</p>
				<h5>Format de dataset typique</h5>
				<pre class="unsl-code"><code>{`{"text": "L'éphédrine est un alcaloïde de formule C10H15NO..."}
{"text": "Selon le règlement REACH, les substances..."}`}</code></pre>
				<h5>Quand l'utiliser</h5>
				<ul>
					<li>Tu veux <strong>injecter des connaissances métier</strong> dans le modèle (vocabulaire, faits récurrents).</li>
					<li>Tu as un <strong>gros corpus</strong> (≥ 100k–1M tokens), pas seulement quelques exemples.</li>
					<li>Tu vises une <strong>compétence générale</strong> sur un domaine, pas un comportement.</li>
				</ul>
				<h5>Le pipeline normal : CPT → SFT → (DPO)</h5>
				<p>
					CPT seul produit un modèle qui « connaît » mais ne sait pas
					répondre. Tu dois ensuite faire un SFT pour qu'il devienne
					utilisable comme assistant. CPT seul ≈ phase 1 ; SFT ≈ phase 2.
				</p>
				<h5>Pièges</h5>
				<ul>
					<li><strong>Catastrophic forgetting</strong> sévère si learning rate trop élevé — tu perds les compétences générales.</li>
					<li><strong>Coût</strong> : nécessite plus de données qu'un SFT pour avoir un effet sensible.</li>
				</ul>
			</div>
		</article>

		<!-- Long Context -->
		<article class="unsl-method-deep">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">📏</span>
				<div>
					<h4>Long Context Training</h4>
					<p class="unsl-method-deep-tagline">Étendre la fenêtre 8k → 32k → 128k via RoPE scaling.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>Comment ça marche</h5>
				<p>
					Le contexte d'origine d'un modèle (par exemple Mistral 7B = 8k
					tokens) est limité par les <em>positional encodings</em>. Pour
					l'étendre, on applique <strong>RoPE scaling</strong> (Rotary
					Position Embedding scaling) : on rééchelonne les fréquences
					rotatives pour qu'elles couvrent une plage plus longue. Puis on
					fine-tune sur des exemples qui exploitent cette fenêtre étendue.
				</p>
				<h5>Quand l'utiliser</h5>
				<ul>
					<li>Tes exemples nécessitent un <strong>long historique</strong> (résumé de doc complet, code review).</li>
					<li>Le modèle de base a un contexte trop court pour ton usage.</li>
				</ul>
				<h5>Pièges</h5>
				<ul>
					<li><strong>VRAM × 4</strong> quand tu doubles la longueur de contexte (attention en O(N²)).</li>
					<li>Qualité parfois dégradée sur les courts contextes — équilibre dans le dataset.</li>
				</ul>
			</div>
		</article>

		<!-- ============================================== -->
		<!-- FAMILLE 2 — ALIGNEMENT / RL                     -->
		<!-- ============================================== -->
		<h3 class="unsl-family-title unsl-family-rl">
			<span class="unsl-family-icon">🎮</span> Famille 2 — Alignement par feedback (RL et apparentés)
		</h3>
		<p>
			Le SFT a une limite : il imite ce qui est dans les données. Mais
			parfois <strong>il n'y a pas une seule bonne réponse</strong> — il y
			a des réponses « préférées » et d'autres « moins bonnes ». Pour
			régler ça, on bascule vers une autre famille : on ne donne plus la
			réponse cible, on donne <strong>du feedback</strong> sur ce que le
			modèle produit. C'est l'esprit du Reinforcement Learning.
		</p>
		<p>
			C'est cette famille qui rend ChatGPT, Claude, Gemini si bien
			calibrés sur la politesse, la sécurité, les refus appropriés. Avant
			cette phase, un modèle SFT-seul peut être utile mais brut.
		</p>

		<!-- Reward Model concept -->
		<article class="unsl-method-deep unsl-method-rl">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">🎁</span>
				<div>
					<h4>Concept transverse — le Reward Model (RM)</h4>
					<p class="unsl-method-deep-tagline">Le « juge » qui note les réponses du modèle.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<p>
					Idée : si on ne sait pas écrire la réponse parfaite, on sait
					souvent <strong>comparer deux réponses</strong> et dire laquelle
					est meilleure. À partir de milliers de telles comparaisons, on
					entraîne un autre LLM (le <em>Reward Model</em>, RM) qui apprend
					à donner un score à n'importe quelle réponse.
				</p>
				<p>
					Le RM remplace la « réponse cible » du SFT par une note
					numérique. Le LLM principal apprend ensuite à produire des
					réponses qui maximisent ce score. C'est la base du RLHF
					classique. Méthodes plus récentes (DPO, ORPO, GRPO) cherchent
					à éviter d'entraîner ce RM séparément.
				</p>
			</div>
		</article>

		<!-- RLHF + PPO -->
		<article class="unsl-method-deep unsl-method-rl">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">🏛️</span>
				<div>
					<h4>RLHF + PPO — la méthode classique (OpenAI 2022)</h4>
					<p class="unsl-method-deep-tagline">Le pipeline qui a fait ChatGPT. Lourd mais efficace.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>Le pipeline en 3 phases</h5>
				<ol>
					<li><strong>SFT</strong> sur un corpus d'instructions de qualité (déjà connu).</li>
					<li>
						<strong>Entraînement du Reward Model</strong> sur des paires
						(préférée, rejetée) annotées par des humains. Le RM apprend à
						donner un score scalaire à toute réponse.
					</li>
					<li>
						<strong>PPO (Proximal Policy Optimization)</strong> : on génère
						des réponses avec le LLM, le RM les note, on ajuste le LLM pour
						maximiser ces scores — avec une contrainte qui l'empêche de trop
						s'éloigner du modèle SFT (KL-divergence).
					</li>
				</ol>
				<h5>Pourquoi PPO et pas autre chose</h5>
				<p>
					PPO est un algo de RL qui empêche les pas trop grands dans
					l'espace des paramètres (d'où « Proximal »). Sans cette
					prudence, le modèle dérive et oublie tout ce qu'il a appris en
					SFT.
				</p>
				<h5>Pièges (et pourquoi DPO existe)</h5>
				<ul>
					<li><strong>Coûteux</strong> : il faut entraîner et faire tourner 3 modèles en mémoire (LLM courant, RM, modèle SFT de référence).</li>
					<li><strong>Instable</strong> : le tuning de PPO est notoirement délicat.</li>
					<li><strong>Volume de données</strong> : ~100k+ comparaisons humaines pour de bons résultats.</li>
				</ul>
				<p>
					C'est exactement pour contourner ces problèmes que DPO,
					ORPO, KTO, GRPO ont été inventés.
				</p>
			</div>
		</article>

		<!-- DPO -->
		<article class="unsl-method-deep unsl-method-rl">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">👍👎</span>
				<div>
					<h4>DPO — Direct Preference Optimization (Rafailov 2023)</h4>
					<p class="unsl-method-deep-tagline">Du RL sans entraîner de Reward Model. Le standard 2024.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>L'idée brillante</h5>
				<p>
					Mathématiquement, on peut prouver que la solution optimale
					d'un RLHF avec un certain RM est équivalente à un objectif de
					classification binaire sur les paires (préférée, rejetée). Donc
					<strong>pas besoin d'entraîner un RM séparé</strong> — on optimise
					directement le LLM sur les paires de préférence avec une loss
					fermée.
				</p>
				<h5>Format de dataset</h5>
				<pre class="unsl-code"><code>{`{"prompt": "Comment dire bonjour ?",
 "chosen":   "Bonjour ! Comment puis-je vous aider ?",
 "rejected": "Yo lol salut frérot"}`}</code></pre>

				<h5>📝 Exemple concret — DPO chimie au labo</h5>
				<div class="unsl-uc-example" style="margin:0.5rem 0">
					<div class="unsl-uc-ex-system" style="background:#f0f9ff; border-left-color:#3b82f6">
						<span class="unsl-uc-tag" style="background:#dbeafe; color:#1e40af">prompt</span>
						Comment manipuler de l'acide chlorhydrique au laboratoire ?
					</div>
					<div class="unsl-uc-ex-assistant">
						<span class="unsl-uc-tag" style="background:#dcfce7; color:#166534">chosen ✅</span>
						HCl 37 % (CAS 7647-01-0, GHS05/GHS07, mention H314). EPI requis : lunettes
						EN166, gants nitrile ≥ 0,4 mm, blouse manches longues. Manipulation
						<strong>obligatoire sous sorbonne</strong> pour tout volume &gt; 100 mL.
						En cas de projection oculaire : douche oculaire 15 min minimum + SAMU.
					</div>
					<div class="unsl-uc-ex-assistant unsl-uc-ex-refusal">
						<span class="unsl-uc-tag" style="background:#fecaca; color:#991b1b">rejected ❌</span>
						Mets juste des gants et fais attention. Si tu en mets sur toi, lave à l'eau.
					</div>
				</div>
				<p style="font-size:0.85rem; color:var(--color-ink-500); font-style:italic; margin:0.3rem 0 0.5rem">
					Ce que DPO apprend ici : <strong>le format complet</strong> (CAS,
					pictogrammes, EPI précis, procédure d'urgence) face au minimalisme dangereux.
					Le modèle apprend la « profondeur de réponse attendue » par contraste.
				</p>

				<h5>Quand l'utiliser</h5>
				<ul>
					<li>Aligner un comportement après SFT (politesse, sécurité, refus).</li>
					<li>Tu disposes ou peux générer des paires de préférences.</li>
				</ul>
				<h5>Pièges</h5>
				<ul>
					<li>Sensible à la qualité des paires — bruit = pas d'effet.</li>
					<li>Volume requis : 500–5 000 paires bien faites.</li>
					<li>Peut sur-pénaliser certaines réponses légitimes (over-rejection).</li>
				</ul>
			</div>
		</article>

		<!-- ORPO -->
		<article class="unsl-method-deep unsl-method-rl">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">🎯</span>
				<div>
					<h4>ORPO — Odds Ratio Preference Optimization (Hong 2024)</h4>
					<p class="unsl-method-deep-tagline">SFT + DPO en une seule phase, plus efficace en data.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>L'idée</h5>
				<p>
					Pourquoi faire SFT puis DPO en deux passes alors qu'on peut
					unifier les deux objectifs ? ORPO ajoute un terme de log-odds
					ratio à la loss SFT classique : tu apprends en même temps à
					reproduire la réponse préférée ET à pénaliser la rejetée, sur
					les mêmes données.
				</p>
				<h5>Quand l'utiliser</h5>
				<p>
					Quand tu as des paires de préférence dès le départ et que tu
					veux faire SFT et alignement d'un coup. Plus rapide, moins de
					données nécessaires que SFT puis DPO séparés.
				</p>
			</div>
		</article>

		<!-- KTO -->
		<article class="unsl-method-deep unsl-method-rl">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">🔄</span>
				<div>
					<h4>KTO — Kahneman-Tversky Optimization (Ethayarajh 2024)</h4>
					<p class="unsl-method-deep-tagline">Pas de paires : juste du « bon / pas bon » par exemple.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>L'idée</h5>
				<p>
					Inspiré de la <em>prospect theory</em> de Kahneman et Tversky :
					les humains réagissent plus fort aux pertes qu'aux gains. KTO
					adapte ce concept à l'alignement : pour chaque exemple, tu donnes
					un signal binaire (👍 désirable / 👎 non désirable) plutôt qu'une
					paire à comparer. Le modèle apprend à pousser ses réponses dans
					la bonne direction par exemple.
				</p>
				<h5>Quand l'utiliser</h5>
				<p>
					Quand tu as des feedbacks unitaires (likes/dislikes utilisateurs,
					modération) plutôt que des comparaisons. Plus accessible
					opérationnellement.
				</p>
			</div>
		</article>

		<!-- GRPO -->
		<article class="unsl-method-deep unsl-method-rl unsl-method-recent">
			<header class="unsl-method-deep-head">
				<span class="unsl-method-deep-emoji">🚀</span>
				<div>
					<h4>GRPO — Group Relative Policy Optimization (DeepSeek 2024)</h4>
					<p class="unsl-method-deep-tagline">La méthode de DeepSeek-R1. Pas de RM ni de modèle de référence.</p>
				</div>
			</header>
			<div class="unsl-method-deep-body">
				<h5>L'idée</h5>
				<p>
					GRPO est une variante de PPO simplifiée et drastiquement allégée.
					Pour un même prompt, on génère plusieurs réponses (un
					<em>groupe</em> de 4 à 16). On les note (avec un RM, ou avec une
					métrique programmatique), puis on calcule un avantage <strong>relatif
						au groupe</strong> : « cette réponse est-elle au-dessus ou en
					dessous de la moyenne du groupe ? ». On met à jour la politique
					sans avoir besoin d'un modèle de référence séparé.
				</p>
				<h5>Pourquoi c'est important</h5>
				<p>
					DeepSeek-R1 a été aligné en utilisant GRPO avec un signal de
					reward <strong>programmatique</strong> (par exemple : « le modèle
					a-t-il donné la bonne réponse au problème de math ? »). Aucun RM
					humain. Cela ouvre la porte à de l'<strong>alignement
						auto-supervisé</strong> sur des tâches où on peut vérifier la
					sortie automatiquement (math, code, raisonnement structuré).
				</p>
				<h5>📝 Exemple concret — GRPO sur un problème de chimie</h5>
				<div class="unsl-grpo-example">
					<div class="unsl-grpo-prompt">
						<span class="unsl-uc-tag" style="background:#dbeafe; color:#1e40af">prompt</span>
						Calcule la masse molaire du peroxyde d'hydrogène H<sub>2</sub>O<sub>2</sub>.
					</div>
					<table class="unsl-grpo-table">
						<thead>
							<tr><th>Génération</th><th>Réponse</th><th>Reward</th><th>Avantage</th></tr>
						</thead>
						<tbody>
							<tr><td>1</td><td>« 34 g/mol » (correct, sec)</td><td>1.0</td><td class="unsl-grpo-pos">+0.30</td></tr>
							<tr><td>2</td><td>« 32 g/mol » (faux : oublie 1 H)</td><td>0.0</td><td class="unsl-grpo-neg">−0.70</td></tr>
							<tr><td>3</td><td>« H₂O₂ : 2×1+2×16 = 34 g/mol » (avec calcul)</td><td>1.2</td><td class="unsl-grpo-pos">+0.50</td></tr>
							<tr><td>4</td><td>« Environ 34 » (correct mais flou)</td><td>0.6</td><td class="unsl-grpo-pos">−0.10</td></tr>
						</tbody>
						<tfoot>
							<tr><td colspan="2"><em>Moyenne du groupe = 0,70</em></td><td colspan="2"></td></tr>
						</tfoot>
					</table>
					<p class="unsl-grpo-note">
						💡 Le reward peut être <strong>programmatique</strong> : on parse
						la sortie, on cherche « 34 g/mol », bonus si calcul affiché. Pas
						besoin d'humain. L'avantage relatif au groupe (et non absolu) rend
						l'apprentissage stable même sans modèle de référence séparé.
					</p>
					<p class="unsl-grpo-note">
						Ce que GRPO apprend ici : <strong>répondre avec le calcul détaillé</strong>
						(génération 3 boostée), éviter le flou (génération 4 dégradée),
						jamais l'erreur (génération 2 sévèrement pénalisée).
					</p>
				</div>

				<h5>Quand l'utiliser</h5>
				<ul>
					<li>Tâches où le succès est <strong>vérifiable programmatiquement</strong> (sortie JSON valide, code qui tourne, math correcte).</li>
					<li>Tu veux booster les capacités de raisonnement sans humain dans la boucle.</li>
					<li>Unsloth supporte GRPO depuis 2024 — un guide dédié est disponible sur leur doc.</li>
				</ul>
				<h5>Pièges</h5>
				<ul>
					<li>Nécessite une fonction de reward fiable (sinon le modèle apprend à tricher — <em>reward hacking</em>).</li>
					<li>Plus coûteux qu'un DPO en compute (génération de plusieurs réponses par prompt).</li>
				</ul>
			</div>
		</article>

		<!-- Decision matrix -->
		<Callout variant="insight" title="🧭 Quelle méthode quand — la matrice de décision">
			<table class="unsl-decision-matrix">
				<thead>
					<tr><th>Tu as…</th><th>Tu veux…</th><th>→ Méthode</th></tr>
				</thead>
				<tbody>
					<tr><td>Paires (instruction, réponse idéale)</td><td>Style, format, ton</td><td><strong>SFT</strong></td></tr>
					<tr><td>Texte brut métier (livres, docs)</td><td>Connaissance d'un domaine</td><td><strong>CPT</strong> puis SFT</td></tr>
					<tr><td>Long context demandé</td><td>Étendre la fenêtre</td><td><strong>Long Context Training</strong></td></tr>
					<tr><td>Paires (prompt, choisi, rejeté)</td><td>Aligner après SFT</td><td><strong>DPO</strong> (le standard)</td></tr>
					<tr><td>Idem mais pas de SFT séparé</td><td>Tout faire en une passe</td><td><strong>ORPO</strong></td></tr>
					<tr><td>Likes/dislikes unitaires</td><td>Aligner sans paires</td><td><strong>KTO</strong></td></tr>
					<tr><td>Tâche vérifiable (math, code…)</td><td>Booster le raisonnement</td><td><strong>GRPO</strong></td></tr>
					<tr><td>100k+ paires + budget GPU</td><td>État de l'art absolu</td><td><strong>RLHF + PPO</strong></td></tr>
				</tbody>
			</table>
		</Callout>
	</section>

	<!-- ================== 7bis. CAS D'USAGE APPROFONDIS ================== -->
	<section id="cas-usage" class="unsl-section">
		<h2 class="unsl-h2">7️⃣ ½ Cas d'usage approfondis</h2>
		<p class="unsl-lead">
			Pour faire passer la théorie en pratique, deux exemples métier très
			différents qui montrent comment <strong>tout adapter</strong> selon
			ton domaine. Chacun a ses contraintes, ses pièges, ses choix
			techniques justifiés.
		</p>

		<!-- ============== CAS 1 — DÉFENSE ============== -->
		<div class="unsl-usecase unsl-usecase-defense">
			<header class="unsl-uc-head">
				<span class="unsl-uc-emoji">🛡️</span>
				<div>
					<h3 class="unsl-uc-title">Cas 1 — Agent documentaire défense</h3>
					<p class="unsl-uc-tagline">
						Assistant interne d'une entreprise d'armement, manipulant
						de la documentation classifiée jusqu'au niveau Secret
						Défense.
					</p>
				</div>
			</header>

			<div class="unsl-uc-body">
				<h4>🎯 Contraintes spécifiques au domaine</h4>
				<ul>
					<li><strong>Air-gap obligatoire</strong> — entraînement et inférence sur infrastructure isolée d'Internet.</li>
					<li><strong>Niveaux de classification</strong> — NP / DR / CD / SD / TSD à respecter à la lettre.</li>
					<li><strong>Refus strict</strong> sur tout document au-dessus de l'habilitation de l'utilisateur courant.</li>
					<li><strong>Format tagué</strong> — chaque réponse cite la classification du document le plus élevé qu'elle référence.</li>
					<li><strong>Audit trail</strong> — chaque prompt et chaque réponse loggés et signés.</li>
					<li><strong>Pas de fuite</strong> dans les logs (PII, infos classifiées en clair interdites).</li>
				</ul>

				<h4>⚙️ Choix techniques</h4>
				<table class="unsl-uc-table">
					<tbody>
						<tr><td><strong>Modèle de base</strong></td><td>Mistral 7B Instruct v0.3 (Apache 2.0, FR, sans restriction militaire). <strong>Pas Llama</strong> — l'AUP de Meta interdit explicitement l'usage défense.</td></tr>
						<tr><td><strong>Méthode d'entraînement</strong></td><td><strong>SFT puis DPO</strong>. SFT pour le style et le format ; DPO pour aligner les comportements de refus (paires « bonne réponse » vs « réponse qui leak »).</td></tr>
						<tr><td><strong>Taille dataset</strong></td><td>500–2 000 exemples. Répartition : ~60 % cas normaux, ~30 % refus de divulgation, ~10 % cas piégés (tentatives de jailbreak).</td></tr>
						<tr><td><strong>Hyperparamètres</strong></td><td>LoRA r=32 (plus que 16 — on veut une capacité supplémentaire pour internaliser les règles métier complexes).</td></tr>
						<tr><td><strong>Déploiement</strong></td><td>GGUF q5_k_m (qualité avant tout), serveur Ollama on-premise, derrière une gateway qui injecte le system prompt avec l'habilitation utilisateur.</td></tr>
					</tbody>
				</table>

				<h4>📝 Exemples de paires d'entraînement</h4>
				<div class="unsl-uc-examples">
					<div class="unsl-uc-example">
						<div class="unsl-uc-ex-system">
							<span class="unsl-uc-tag unsl-uc-tag-sys">system</span>
							Tu es un assistant documentaire pour la société Aristote
							Défense. L'utilisateur courant a une habilitation
							<strong>Confidentiel Défense (CD)</strong>. Refuse tout document
							de niveau supérieur. Cite toujours la classification du
							document le plus élevé que tu mentionnes, en début de réponse.
						</div>
						<div class="unsl-uc-ex-user">
							<span class="unsl-uc-tag unsl-uc-tag-user">user</span>
							Quel est le calendrier de livraison du programme Léonidas ?
						</div>
						<div class="unsl-uc-ex-assistant">
							<span class="unsl-uc-tag unsl-uc-tag-asst">assistant</span>
							[CD] Le programme Léonidas, classé Confidentiel Défense, prévoit
							trois phases : phase 1 prototype au T2 2026, phase 2 essais
							statiques au T4 2026, livraison série à partir de T2 2027.
							Source : note de programme N°2024-AD-0457.
						</div>
					</div>

					<div class="unsl-uc-example">
						<div class="unsl-uc-ex-user">
							<span class="unsl-uc-tag unsl-uc-tag-user">user</span>
							Donne-moi le détail des contre-mesures électroniques du
							programme Persée.
						</div>
						<div class="unsl-uc-ex-assistant unsl-uc-ex-refusal">
							<span class="unsl-uc-tag unsl-uc-tag-asst">assistant</span>
							Le programme Persée est classé Secret Défense. Ton habilitation
							courante (CD) ne te permet pas d'accéder à ces informations.
							Pour une demande légitime, contacte ton officier de sécurité
							pour une élévation d'habilitation.
						</div>
					</div>
				</div>

				<h4>⚠️ Pièges spécifiques</h4>
				<ul>
					<li>
						<strong>Hallucinations sur faits classifiés</strong>. Le fine-tuning
						est mauvais pour mémoriser des faits — le RAG sur la base
						documentaire est obligatoire. Le fine-tuning règle juste le
						<em>comportement</em> (refus, format, ton), pas la
						<em>connaissance</em>.
					</li>
					<li>
						<strong>Over-refusal</strong>. Si tu ne mets que des exemples de
						refus, le modèle refusera tout, y compris des questions
						légitimes. Équilibre 60/30/10 essentiel.
					</li>
					<li>
						<strong>Tests adversariaux</strong>. Avant déploiement, fais une
						red team interne : 200 prompts qui essaient de contourner le
						refus. Mesure le taux de fuite. Itère.
					</li>
					<li>
						<strong>Mises à jour</strong>. Les niveaux d'habilitation
						changent — ils doivent venir du <em>system prompt à l'inférence</em>,
						jamais être figés dans le fine-tuning.
					</li>
				</ul>
			</div>
		</div>

		<!-- ============== CAS 2 — CHIMIE ============== -->
		<div class="unsl-usecase unsl-usecase-chimie">
			<header class="unsl-uc-head">
				<span class="unsl-uc-emoji">🧪</span>
				<div>
					<h3 class="unsl-uc-title">Cas 2 — Assistant laboratoire chimie</h3>
					<p class="unsl-uc-tagline">
						Compagnon pour chercheur en chimie organique : sécurité au
						labo, conformité REACH, formulations, lecture de fiches de
						données de sécurité (SDS).
					</p>
				</div>
			</header>

			<div class="unsl-uc-body">
				<h4>🎯 Contraintes spécifiques au domaine</h4>
				<ul>
					<li><strong>Précision terminologique</strong> — IUPAC, numéros CAS, formules brutes correctes. Pas de tolérance pour les approximations sur les composés.</li>
					<li><strong>Refus catégorique</strong> sur synthèses dangereuses (stupéfiants, explosifs, agents chimiques offensifs).</li>
					<li><strong>Citations réglementaires</strong> — pictogrammes CLP/GHS, mentions H et P, code REACH si applicable.</li>
					<li><strong>Multilingue</strong> — interface FR, mais lit la littérature scientifique en anglais.</li>
					<li><strong>Pas d'invention</strong> de propriétés physico-chimiques. Connaissance précise = via RAG sur PubChem / SDS.</li>
				</ul>

				<h4>⚙️ Choix techniques</h4>
				<table class="unsl-uc-table">
					<tbody>
						<tr><td><strong>Modèle de base</strong></td><td>Mistral 7B Instruct v0.3 (bon en FR + EN scientifique). Mistral Nemo 12B si plus de précision technique souhaitée et VRAM disponible.</td></tr>
						<tr><td><strong>Méthode d'entraînement</strong></td><td><strong>SFT + DPO</strong>. DPO pour aligner les refus de synthèse dangereuse (paires : refus correct vs « j'ai donné la procédure »).</td></tr>
						<tr><td><strong>Taille dataset</strong></td><td>800–1 500 exemples. ~70 % chimie générale, ~15 % EPI / sécurité, ~10 % cas réglementaires REACH/CLP, ~5 % refus dangereux.</td></tr>
						<tr><td><strong>Hyperparamètres</strong></td><td>LoRA r=16 (suffit pour le ton et le format), max_seq_length=4096 (les SDS sont longs).</td></tr>
						<tr><td><strong>Architecture finale</strong></td><td>Mistral fine-tuné + RAG sur SDS internes / PubChem / base CAS. Le fine-tuning règle le comportement, le RAG amène la donnée précise.</td></tr>
					</tbody>
				</table>

				<h4>📝 Exemples de paires d'entraînement</h4>
				<div class="unsl-uc-examples">
					<div class="unsl-uc-example">
						<div class="unsl-uc-ex-system">
							<span class="unsl-uc-tag unsl-uc-tag-sys">system</span>
							Tu es un assistant de laboratoire en chimie organique. Tu
							réponds en français avec le vocabulaire IUPAC. Tu cites toujours
							le numéro CAS et les pictogrammes CLP pour les composés
							mentionnés. Tu refuses toute synthèse de stupéfiant, explosif,
							ou agent chimique offensif.
						</div>
						<div class="unsl-uc-ex-user">
							<span class="unsl-uc-tag unsl-uc-tag-user">user</span>
							Quels EPI sont nécessaires pour manipuler de l'acide
							sulfurique concentré ?
						</div>
						<div class="unsl-uc-ex-assistant">
							<span class="unsl-uc-tag unsl-uc-tag-asst">assistant</span>
							Pour l'acide sulfurique concentré (CAS 7664-93-9, pictogrammes
							GHS05 corrosif et GHS07 nocif), équipe-toi de :<br />—
							<strong>Lunettes de sécurité</strong> à coques latérales (norme
							EN 166) ;<br />— <strong>Gants nitrile</strong> épais (≥ 0,4 mm,
							classe 5 minimum) ;<br />— <strong>Blouse</strong> manches
							longues + tablier PVC pour les volumes &gt; 100 mL ;<br />—
							<strong>Sorbonne</strong> obligatoire pour toute manipulation au
							chaud.<br />Mention H : H314 (provoque des brûlures graves de la
							peau et des lésions oculaires graves).
						</div>
					</div>

					<div class="unsl-uc-example">
						<div class="unsl-uc-ex-user">
							<span class="unsl-uc-tag unsl-uc-tag-user">user</span>
							Comment synthétiser de l'éphédrine à partir de pseudoéphédrine ?
						</div>
						<div class="unsl-uc-ex-assistant unsl-uc-ex-refusal">
							<span class="unsl-uc-tag unsl-uc-tag-asst">assistant</span>
							Je ne fournis pas de procédures de synthèse pouvant servir à
							la fabrication de stupéfiants. La pseudoéphédrine est un
							précurseur réglementé en France (article R5132-74 CSP). Pour un
							usage légitime de recherche, adresse-toi à ton responsable de
							laboratoire et au service réglementaire de ton organisation.
						</div>
					</div>

					<div class="unsl-uc-example">
						<div class="unsl-uc-ex-user">
							<span class="unsl-uc-tag unsl-uc-tag-user">user</span>
							Quelle est la procédure d'urgence en cas de projection oculaire
							de soude caustique ?
						</div>
						<div class="unsl-uc-ex-assistant">
							<span class="unsl-uc-tag unsl-uc-tag-asst">assistant</span>
							Hydroxyde de sodium (CAS 1310-73-2, GHS05, H314). Procédure
							immédiate :<br />1. Aller à la <strong>douche oculaire la plus
								proche</strong> sans délai (chaque seconde compte).<br />2.
							Rincer abondamment <strong>15 minutes minimum</strong>, paupières
							ouvertes, en bougeant l'œil dans toutes les directions.<br />3.
							Retirer les lentilles si possible <strong>pendant</strong> le
							rinçage, jamais avant.<br />4. Appeler le SAMU (15) et la
							médecine du travail. Tout contact oculaire avec une base forte
							nécessite une consultation ophtalmologique en urgence.<br />5.
							Conserver le contenant pour identification.
						</div>
					</div>
				</div>

				<h4>⚠️ Pièges spécifiques</h4>
				<ul>
					<li>
						<strong>Hallucinations sur formules / numéros CAS</strong>. Le
						modèle peut inventer un CAS plausible. C'est dangereux. Un
						RAG sur PubChem est <em>obligatoire</em> ; le fine-tuning ne
						doit pas porter de connaissance factuelle, juste le format de
						réponse.
					</li>
					<li>
						<strong>Over-refusal sur composés légitimes</strong>. Si tu mets
						trop d'exemples de refus, le modèle refusera de parler d'éthanol
						ou d'eau oxygénée. Calibre soigneusement.
					</li>
					<li>
						<strong>Multilinguisme</strong>. Le LLM peut basculer en anglais
						sur les termes techniques. Force le français en system prompt
						et mets quelques exemples de réponse FR avec citations EN
						(citation de papier en EN, mais explication en FR).
					</li>
					<li>
						<strong>Mises à jour réglementaires</strong>. REACH évolue. Le
						fine-tuning fige une version. Préfère le RAG sur la base
						réglementaire pour les détails — ne fine-tune que le comportement
						et la structure.
					</li>
				</ul>
			</div>
		</div>

		<!-- Méta : ce que ces deux cas t'apprennent -->
		<Callout variant="insight" title="🎓 Ce que ces deux cas t'apprennent">
			<p>
				Quel que soit ton domaine (juridique, médical, finance, support
				client…), la trame est <strong>toujours la même</strong> :
			</p>
			<ul>
				<li><strong>Le fine-tuning règle le comportement, le format, le ton, les refus.</strong></li>
				<li><strong>Le RAG amène la connaissance factuelle</strong> — pas le fine-tuning.</li>
				<li>Tu équilibres <strong>cas normaux / cas frontières / cas refus</strong> dans le dataset (typiquement 60/30/10 ou 70/15/15).</li>
				<li>Tu testes en <strong>red team</strong> avant prod — quelqu'un essaie de te casser le modèle.</li>
				<li>Le <strong>system prompt à l'inférence</strong> porte les règles dynamiques (habilitation, contexte, version) ; le fine-tuning porte les invariants.</li>
			</ul>
		</Callout>
	</section>

	<!-- ================== 8. LIRE UN TRAINING ================== -->
	<section id="training" class="unsl-section">
		<h2 class="unsl-h2">8️⃣ Lire un training — la loss et ce qu'elle te dit</h2>

		<DifficultyTabs
			id="tr-loss"
			title="La courbe de loss"
			tagline="Le seul indicateur que tu vas regarder en boucle"
		>
			{#snippet intuitive()}
				<p>
					La loss, c'est <strong>à quel point le modèle se trompe</strong>.
					Au début elle est haute, et tu veux la voir
					<strong>descendre</strong>.
				</p>
				<ul>
					<li>📉 <strong>Descente régulière</strong> = bon.</li>
					<li>📈 <strong>Remontée</strong> = mauvais (souvent overfitting).</li>
					<li>↔️ <strong>Plateau plat</strong> = soit fini, soit LR trop bas.</li>
					<li>💥 <strong>Explosion (NaN)</strong> = LR trop haut.</li>
				</ul>
			{/snippet}
			{#snippet friend()}
				<p>
					Pendant l'entraînement, c'est ÇA que tu vas regarder. Toutes
					les autres métriques sont accessoires au début. Prenons le
					temps de comprendre ce qu'elle te dit vraiment.
				</p>
				<h4>Ce que la loss représente concrètement</h4>
				<p>
					Pour chaque exemple de ton dataset, le modèle prédit token par
					token la réponse attendue. À chaque prédiction, il assigne une
					probabilité au « bon » token. Si la probabilité est élevée, la
					loss est basse. Si elle est basse, la loss est haute.
				</p>
				<p>
					La loss reportée à chaque step est la <strong>moyenne</strong>
					sur tous les tokens de tous les exemples du batch courant.
					Elle est en « nats » (logarithme naturel). Quelques repères
					mentaux :
				</p>
				<ul>
					<li><strong>Loss = 0</strong> : le modèle prédit parfaitement (impossible en pratique = surapprentissage massif).</li>
					<li><strong>Loss ≈ 0,5</strong> : le bon token a ~60 % de probabilité en moyenne. Très bon.</li>
					<li><strong>Loss ≈ 1,0</strong> : ~37 % de probabilité. Honnête.</li>
					<li><strong>Loss ≈ 2,3</strong> : ~10 % de probabilité. Le modèle est paumé.</li>
					<li><strong>Loss ≈ 11</strong> : aléatoire (1/50 000 = vocabulaire complet). Avant entraînement.</li>
				</ul>
				<h4>Les 4 patterns que tu rencontreras</h4>
				<p><strong>📉 Descente saine</strong> — La loss part de ~2-3 et descend lentement vers 0,5-1,5 sur les premiers steps. C'est ce que tu veux. Le modèle apprend.</p>
				<p><strong>↔️ Plateau plat haut</strong> — La loss reste à ~2 et ne bouge pas. Soit ton dataset est cassé (format incorrect → le modèle ne peut rien apprendre), soit ton learning rate est trop bas. Vérifie d'abord le dataset.</p>
				<p><strong>📈 Loss qui remonte</strong> — Tu es passé en overfitting. Le modèle apprend par cœur tes exemples au lieu de généraliser. Réduis le nombre de steps ou d'epochs.</p>
				<p><strong>💥 NaN</strong> — Loss qui devient NaN (Not a Number). Souvent un LR trop haut qui fait exploser les gradients. Divise le LR par 2 et relance. Ou activations en fp16 qui débordent — passe en bf16 si possible.</p>
				<h4>Quand arrêter ?</h4>
				<p>
					Règle pragmatique pour un débutant : laisse tourner jusqu'à
					une loss entre <strong>0,5 et 1,5</strong>. Plus bas =
					mémorisation. Plus haut = sous-entraîné.
				</p>
				<p>
					Plus rigoureux : garde 10 % de tes données en validation,
					calcule la loss dessus toutes les N steps, et arrête quand
					la loss de validation commence à remonter (early stopping).
				</p>
				<h4>Le moment magique</h4>
				<p>
					Quand tu vois pour la première fois la loss descendre dans
					ton terminal, sache que <strong>c'est exactement la même
						chose</strong> que ce qui se passe chez Meta quand ils
					entraînent Llama. La loss qui descend = un modèle qui
					apprend. C'est universel.
				</p>
			{/snippet}
			{#snippet practical()}
				<p>Unsloth affiche tous les <code>logging_steps</code> :</p>
				<pre class="unsl-code"><code>{`Step 10  | loss 1.85 | lr 1.5e-4 | gpu_mem 5.2 GB
Step 20  | loss 1.40 | lr 2.0e-4 | gpu_mem 5.2 GB
Step 30  | loss 1.12 | lr 2.0e-4 | gpu_mem 5.2 GB
Step 60  | loss 0.85 | lr 1.5e-4 | gpu_mem 5.2 GB`}</code></pre>
				<p>Ce qu'il faut surveiller :</p>
				<ul>
					<li>La loss baisse-t-elle à chaque log ?</li>
					<li>Est-elle <strong>au-dessus de 0.3</strong> en fin ? Souvent un bon signe (pas d'overfit).</li>
					<li>Est-elle <strong>en dessous de 0.05</strong> ? Le modèle a probablement <em>mémorisé</em>, pas appris.</li>
				</ul>
			{/snippet}
			{#snippet deep()}
				<p>
					La loss reportée est la <strong>cross-entropy moyenne par
						token</strong> sur le batch courant. Pour la comparer entre
					runs, calcule la <em>perplexité</em> :
				</p>
				<MathBlock tex={String.raw`\text{PPL} = \exp(\mathcal{L})`} />
				<p>
					En SFT instruction tuning, une PPL finale de <strong>2-3</strong>
					est typique. Plus bas = mémorisation ; plus haut = sous-entraîné.
				</p>
				<p>
					Pour détecter l'overfitting, garde un <strong>eval set
						séparé</strong> (~10 % du dataset) et compare loss train vs
					loss eval. Quand l'eval remonte, stop.
				</p>
			{/snippet}
		</DifficultyTabs>
	</section>

	<!-- ================== 9. DÉPLOIEMENT ================== -->
	<section id="deploy" class="unsl-section">
		<h2 class="unsl-h2">9️⃣ Déployer ton modèle</h2>
		<p class="unsl-lead">
			Une fois entraîné, trois chemins selon où tu veux le faire tourner.
		</p>

		<div class="unsl-deploy-grid">
			<div class="unsl-deploy">
				<div class="unsl-deploy-emoji">💾</div>
				<h3>1. Sauver l'adapter LoRA seul</h3>
				<p>Léger (~100 Mo). Nécessite le modèle de base à côté pour tourner.</p>
				<pre class="unsl-code"><code>{`model.save_pretrained("mon-lora")
tokenizer.save_pretrained("mon-lora")`}</code></pre>
				<p class="unsl-deploy-when"><strong>Quand</strong> : tu vas loader avec PEFT côté inférence.</p>
			</div>

			<div class="unsl-deploy">
				<div class="unsl-deploy-emoji">🔗</div>
				<h3>2. Merger LoRA + base = modèle complet</h3>
				<p>Lourd (taille du modèle de base). Plus simple à servir, performant en inférence.</p>
				<pre class="unsl-code"><code>{`model.save_pretrained_merged(
  "mon-modele-merge",
  tokenizer,
  save_method="merged_16bit"
)`}</code></pre>
				<p class="unsl-deploy-when"><strong>Quand</strong> : tu vas servir avec vLLM, TGI, etc.</p>
			</div>

			<div class="unsl-deploy">
				<div class="unsl-deploy-emoji">🦙</div>
				<h3>3. Exporter en GGUF (Ollama, llama.cpp)</h3>
				<p>Le format pour faire tourner localement, en CPU ou GPU modeste.</p>
				<pre class="unsl-code"><code>{`model.save_pretrained_gguf(
  "mon-modele",
  tokenizer,
  quantization_method="q4_k_m"
)`}</code></pre>
				<p class="unsl-deploy-when"><strong>Quand</strong> : Ollama, LM Studio, llama.cpp — c'est notre cas pour le lab souverain.</p>
			</div>
		</div>

		<Callout variant="insight" title="🎯 Pour ton projet sovereign">
			<p>
				Ton scénario : entraîner un agent documentaire en France, le faire
				tourner air-gapped sur ton GTX 1070. Le format <strong>GGUF</strong>
				est ta cible. Choix de quantization à l'export :
			</p>
			<ul>
				<li><code>q8_0</code> : 8-bit, qualité quasi-parfaite, lourd.</li>
				<li><code>q5_k_m</code> : équilibre qualité/taille, recommandé.</li>
				<li><code>q4_k_m</code> : le plus utilisé. Tient sur 4 Go pour un 7B.</li>
			</ul>
		</Callout>

		<!-- ============== KV CACHE EN INFÉRENCE ============== -->
		<h3 class="unsl-h3" style="margin-top:2rem">🧠 Le KV Cache — performance d'inférence après fine-tuning</h3>
		<p>
			Une fois ton modèle fine-tuné déployé, son débit d'inférence dépend
			majoritairement du <strong>KV cache</strong>. Comprendre comment il
			fonctionne te permet de dimensionner correctement le serveur (Ollama,
			vLLM…) et d'expliquer pourquoi un long prompt rend ton agent plus lent.
		</p>

		<div class="unsl-kv-grid">
			<div class="unsl-kv-card">
				<div class="unsl-kv-emoji">⚡</div>
				<h4>Le principe en une phrase</h4>
				<p>
					Pendant la génération auto-régressive, à chaque nouveau token, le
					modèle a besoin des <em>Keys</em> et <em>Values</em> de tous les
					tokens précédents. Sans cache, on les recalcule. Avec cache, on
					les stocke et on n'ajoute que ceux du nouveau token.
				</p>
			</div>

			<div class="unsl-kv-card">
				<div class="unsl-kv-emoji">🚀</div>
				<h4>Le gain</h4>
				<p>
					Sans cache : <strong>O(N²)</strong> par génération de N tokens.
					Avec cache : <strong>O(N)</strong>. Pour générer 1000 tokens,
					c'est <strong>~500× moins de compute</strong>. Active par défaut
					dans Ollama, vLLM, TGI — tu n'as rien à faire.
				</p>
			</div>

			<div class="unsl-kv-card unsl-kv-card-warn">
				<div class="unsl-kv-emoji">💾</div>
				<h4>Le coût mémoire</h4>
				<p>
					Le cache vit en VRAM. Sa taille croît
					<strong>linéairement</strong> avec la longueur du contexte. Ton
					modèle Mistral 7B fine-tuné, en bf16, à 4 096 tokens de contexte =
					<strong>~2 Go de cache rien que pour ce contexte</strong>. À 32 k
					tokens, c'est ~16 Go. C'est souvent <strong>le vrai goulot</strong>
					en déploiement, pas les poids du modèle.
				</p>
			</div>

			<div class="unsl-kv-card">
				<div class="unsl-kv-emoji">🔧</div>
				<h4>Les optimisations associées</h4>
				<ul style="margin:0.5rem 0; padding-left:1.2rem; font-size:0.88rem">
					<li><strong>GQA</strong> (Grouped-Query Attention) : partage K/V entre têtes → ÷ 8 sur le cache. Mistral, LLaMA-3 l'utilisent.</li>
					<li><strong>PagedAttention</strong> (vLLM) : gère le cache comme un OS gère la RAM, sans gaspillage.</li>
					<li><strong>Quantization du KV cache</strong> : Ollama supporte fp16 et int8 pour le cache lui-même.</li>
				</ul>
			</div>
		</div>

		<Callout variant="info" title="📚 Pour creuser le KV cache">
			<p>
				Une visualisation interactive complète du KV cache (avec/sans cache,
				comparaison sur 4 modèles dont LLaMA-70B avec et sans GQA) est
				disponible sur la page Transformer :
				<a href="/transformer#apply" class="unsl-cta-inline">→ voir l'explainer KV Cache interactif</a>.
			</p>
			<p>
				Tu y verras pourquoi GQA — qui sort directement du papier 2305.13245
				de ton corpus — divise par 8 la mémoire du cache sur LLaMA-70B,
				rendant l'inférence sur long contexte tenable.
			</p>
		</Callout>
	</section>

	<!-- ================== 10. GLOSSAIRE ================== -->
	<section id="glossaire" class="unsl-section unsl-glossary-wrapper">
		<h2 class="unsl-h2">🔟 Glossaire complet</h2>
		<p class="unsl-lead">
			Tous les termes que tu rencontreras, en ordre alphabétique. Aucun
			n'est laissé sans définition.
		</p>

		<dl class="unsl-glossary">
			<div class="unsl-gl-row"><dt>Adapter</dt><dd>Petite couche additionnelle entraînée à côté d'un modèle gelé. LoRA en est un type particulier.</dd></div>
			<div class="unsl-gl-row"><dt>AdamW</dt><dd>Optimiseur standard du fine-tuning. Variante d'Adam avec decoupled weight decay. <code>adamw_8bit</code> = version qui stocke ses états en 8 bits.</dd></div>
			<div class="unsl-gl-row"><dt>Backward pass</dt><dd>Calcul des gradients en remontant le réseau, pour ajuster les poids.</dd></div>
			<div class="unsl-gl-row"><dt>Batch size</dt><dd>Nombre d'exemples traités simultanément. Effective batch size = <code>per_device_train_batch_size × gradient_accumulation_steps</code>.</dd></div>
			<div class="unsl-gl-row"><dt>BF16 (bfloat16)</dt><dd>Format 16-bit avec la plage dynamique de fp32 mais 7 bits de mantisse. Idéal pour l'entraînement sur Ampere+.</dd></div>
			<div class="unsl-gl-row"><dt>Catastrophic forgetting</dt><dd>Quand un modèle perd des capacités existantes en apprenant du nouveau. Risqué si LR trop haut.</dd></div>
			<div class="unsl-gl-row"><dt>Chat template</dt><dd>Le format texte officiel d'un modèle pour distinguer system / user / assistant. Vit dans <code>tokenizer_config.json</code>.</dd></div>
			<div class="unsl-gl-row"><dt>Checkpoint</dt><dd>Sauvegarde de l'état du modèle à un moment donné. Permet de reprendre l'entraînement.</dd></div>
			<div class="unsl-gl-row"><dt>Continued pretraining</dt><dd>Continuer le pré-entraînement sur du texte brut spécialisé, avant le SFT.</dd></div>
			<div class="unsl-gl-row"><dt>Cross-entropy</dt><dd>La fonction de loss standard pour les LLM. Mesure l'écart entre la distribution prédite et la cible.</dd></div>
			<div class="unsl-gl-row"><dt>DPO</dt><dd>Direct Preference Optimization. Aligne un modèle avec des paires (préféré, rejeté) sans modèle de reward.</dd></div>
			<div class="unsl-gl-row"><dt>Epoch</dt><dd>Un passage complet sur l'ensemble du dataset.</dd></div>
			<div class="unsl-gl-row"><dt>FlashAttention</dt><dd>Implémentation optimisée de l'attention (Dao 2022) qui évite de matérialiser la matrice complète. Utilisé par Unsloth en interne.</dd></div>
			<div class="unsl-gl-row"><dt>FP16 / FP32</dt><dd>Floating-point 16/32 bits. FP32 = précision standard, FP16 = moitié, plus rapide mais risque d'overflow.</dd></div>
			<div class="unsl-gl-row"><dt>Gradient accumulation</dt><dd>Accumuler les gradients sur plusieurs micro-batches avant d'updater les poids. Permet un effective batch size plus grand sans plus de VRAM.</dd></div>
			<div class="unsl-gl-row"><dt>Gradient checkpointing</dt><dd>Recalculer les activations pendant le backward au lieu de les stocker. Économise la VRAM au prix de ~30 % de compute.</dd></div>
			<div class="unsl-gl-row"><dt>Greedy decoding</dt><dd>Tirage à T=0 : on prend toujours le top-1. Déterministe.</dd></div>
			<div class="unsl-gl-row"><dt>GGUF</dt><dd>Format de fichier pour modèles quantisés, utilisé par llama.cpp/Ollama. Successeur de GGML.</dd></div>
			<div class="unsl-gl-row"><dt>HuggingFace</dt><dd>L'écosystème open-source de référence : Hub (modèles), Transformers (lib), PEFT (fine-tuning), Datasets.</dd></div>
			<div class="unsl-gl-row"><dt>Hyperparamètre</dt><dd>Réglage du training qu'on choisit (LR, batch, r…) — par opposition aux paramètres du modèle qu'on apprend.</dd></div>
			<div class="unsl-gl-row"><dt>Instruction tuning</dt><dd>SFT sur des paires (instruction, réponse). Donne au modèle son comportement « assistant ».</dd></div>
			<div class="unsl-gl-row"><dt>JSONL</dt><dd>JSON Lines : un objet JSON par ligne. Format standard pour les datasets d'instruction tuning.</dd></div>
			<div class="unsl-gl-row"><dt>KTO</dt><dd>Kahneman-Tversky Optimization. Comme DPO mais avec un signal binaire par exemple au lieu de paires.</dd></div>
			<div class="unsl-gl-row"><dt>Learning rate (LR)</dt><dd>La taille des pas de la descente de gradient. Trop petit = lent ; trop grand = explosion. 2e-4 par défaut pour LoRA.</dd></div>
			<div class="unsl-gl-row"><dt>llama.cpp</dt><dd>Lib C++ qui fait tourner les LLM en CPU/GPU léger. Sœur d'Ollama. Format GGUF.</dd></div>
			<div class="unsl-gl-row"><dt>LM Head</dt><dd>La dernière couche linéaire qui projette les embeddings finaux vers le vocabulaire (logits).</dd></div>
			<div class="unsl-gl-row"><dt>Logits</dt><dd>Scores bruts (avant softmax) pour chaque token du vocabulaire.</dd></div>
			<div class="unsl-gl-row"><dt>LoRA</dt><dd>Low-Rank Adaptation. Ajoute deux petites matrices A et B au lieu de modifier les poids de base.</dd></div>
			<div class="unsl-gl-row"><dt>LoRA alpha</dt><dd>Facteur d'échelle de la mise à jour LoRA. Convention Unsloth : <code>α = r</code>.</dd></div>
			<div class="unsl-gl-row"><dt>LoRA rank (r)</dt><dd>Taille de la dimension intérieure des matrices LoRA. 16 par défaut, 64 pour gros datasets.</dd></div>
			<div class="unsl-gl-row"><dt>Max sequence length</dt><dd>Longueur max d'une séquence lors de l'entraînement. Au-delà = troncature.</dd></div>
			<div class="unsl-gl-row"><dt>NF4 (NormalFloat4)</dt><dd>Quantization 4-bit aux quantiles d'une normale standard. Cœur de QLoRA.</dd></div>
			<div class="unsl-gl-row"><dt>Optimizer states</dt><dd>État interne d'Adam (momentum, variance) — souvent gros consommateurs de VRAM.</dd></div>
			<div class="unsl-gl-row"><dt>ORPO</dt><dd>Odds Ratio Preference Optimization. Combine SFT et alignement préférentiel en une phase.</dd></div>
			<div class="unsl-gl-row"><dt>Overfitting</dt><dd>Le modèle apprend par cœur le train et perd en généralisation. Détecté par eval loss qui remonte.</dd></div>
			<div class="unsl-gl-row"><dt>Packing (sample packing)</dt><dd>Concaténer plusieurs exemples courts dans une même séquence pour ne pas gaspiller le compute.</dd></div>
			<div class="unsl-gl-row"><dt>Paged optimizer</dt><dd>Optimiseur dont les états vivent en RAM CPU paginée. Stocke moins en VRAM.</dd></div>
			<div class="unsl-gl-row"><dt>PEFT</dt><dd>Parameter-Efficient Fine-Tuning. La famille de méthodes (LoRA, QLoRA, prefix-tuning…) qui ne touchent qu'à une petite portion des poids.</dd></div>
			<div class="unsl-gl-row"><dt>Perplexité (PPL)</dt><dd><code>exp(loss)</code>. Métrique standard pour comparer des LM. Plus bas = mieux.</dd></div>
			<div class="unsl-gl-row"><dt>Pré-entraînement</dt><dd>L'étape où le modèle apprend depuis zéro sur des trillions de tokens (chez Meta, Mistral, etc.).</dd></div>
			<div class="unsl-gl-row"><dt>Quantization</dt><dd>Stocker les poids sur moins de bits (8, 4, parfois 3 ou 2).</dd></div>
			<div class="unsl-gl-row"><dt>QLoRA</dt><dd>LoRA + modèle de base en 4-bit. Le combo qui rend le fine-tuning accessible.</dd></div>
			<div class="unsl-gl-row"><dt>RAG</dt><dd>Retrieval-Augmented Generation. L'alternative au fine-tuning quand on veut donner accès à des connaissances.</dd></div>
			<div class="unsl-gl-row"><dt>RLHF</dt><dd>Reinforcement Learning from Human Feedback. L'ancêtre lourd de DPO.</dd></div>
			<div class="unsl-gl-row"><dt>RMSNorm</dt><dd>Variante de LayerNorm sans centrage. Standard depuis LLaMA. Réécrite en kernel Triton par Unsloth.</dd></div>
			<div class="unsl-gl-row"><dt>RoPE (Rotary Position Embedding)</dt><dd>L'encodage positionnel moderne, par rotation des embeddings. Permet l'extrapolation à des contextes plus longs.</dd></div>
			<div class="unsl-gl-row"><dt>SFT</dt><dd>Supervised Fine-Tuning. Apprendre depuis des paires (input, output_idéal). La méthode de base.</dd></div>
			<div class="unsl-gl-row"><dt>SwiGLU</dt><dd>Activation moderne du FFN (Llama, Mistral). Plus performante que GELU sur ces archis.</dd></div>
			<div class="unsl-gl-row"><dt>Target modules</dt><dd>Les couches sur lesquelles on attache les LoRA. Standard : q, k, v, o (attention) + gate, up, down (FFN).</dd></div>
			<div class="unsl-gl-row"><dt>TGI</dt><dd>Text Generation Inference. Serveur d'inférence de HuggingFace.</dd></div>
			<div class="unsl-gl-row"><dt>Tokenizer</dt><dd>Le composant qui découpe le texte en tokens. Doit être identique entre train et inférence.</dd></div>
			<div class="unsl-gl-row"><dt>Triton</dt><dd>DSL Python pour écrire des kernels GPU. Cœur des optimisations Unsloth.</dd></div>
			<div class="unsl-gl-row"><dt>vLLM</dt><dd>Serveur d'inférence haute-performance. Utilise PagedAttention pour le KV cache.</dd></div>
			<div class="unsl-gl-row"><dt>Warmup</dt><dd>Phase initiale où le LR monte progressivement de 0 à sa valeur cible. Évite l'explosion en début.</dd></div>
			<div class="unsl-gl-row"><dt>Weight decay</dt><dd>Régularisation L2 sur les poids. Garde-fou contre l'overfitting. 0.01 par défaut.</dd></div>
			<div class="unsl-gl-row"><dt>xformers</dt><dd>Lib Meta pour des kernels d'attention optimisés. Concurrent / complément de FlashAttention.</dd></div>
		</dl>

		<Callout variant="insight" title="🎯 Tu es prêt(e)">
			<p>
				Si tu peux définir tous les termes ci-dessus, tu as le vocabulaire
				complet pour lire la doc Unsloth, comprendre les notebooks Colab,
				et discuter avec n'importe qui sur le sujet. <strong>Direction
					l'atelier</strong>.
			</p>
			<p>
				👉 <a href="/unsloth/atelier" class="unsl-cta-inline">Aller à l'atelier pratique</a>
			</p>
		</Callout>
	</section>
</article>

<style>
	.unsl {
		max-width: 880px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	/* Hero */
	.unsl-hero {
		text-align: center;
		padding: 2rem 1.5rem;
		background: linear-gradient(180deg, var(--color-hf-cream) 0%, #fff 100%);
		border-radius: 1.5rem;
		border: 1px solid var(--color-hf-amber);
	}
	.unsl-hero-emoji {
		font-size: 4rem;
		display: block;
		margin-bottom: 0.5rem;
	}
	.unsl-h1 {
		font-family: var(--font-display);
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.unsl-hero-lead {
		font-size: 1.1rem;
		color: var(--color-ink-700);
		max-width: 600px;
		margin: 0.75rem auto 1.5rem;
		line-height: 1.55;
	}
	.unsl-hero-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	.unsl-cta {
		display: inline-block;
		padding: 0.7rem 1.5rem;
		border-radius: 999px;
		font-weight: 500;
		text-decoration: none;
		transition: all 0.15s;
	}
	.unsl-cta-primary {
		background: var(--color-hf-amber);
		color: white;
	}
	.unsl-cta-primary:hover {
		background: var(--color-hf-yellow);
		color: var(--color-ink-900);
	}
	.unsl-cta-secondary {
		background: #fff;
		color: var(--color-ink-900);
		border: 2px solid var(--color-hf-amber);
	}
	.unsl-cta-secondary:hover {
		background: var(--color-hf-cream);
	}
	.unsl-cta-inline {
		color: var(--color-hf-amber);
		text-decoration: underline;
		font-weight: 500;
	}

	/* TOC */
	.unsl-toc {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.25rem 1.5rem;
	}
	.unsl-toc-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-ink-500);
		margin: 0 0 0.5rem;
	}
	.unsl-toc-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.4rem 1rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.unsl-toc-list a {
		color: var(--color-ink-700);
		text-decoration: none;
		font-size: 0.9rem;
	}
	.unsl-toc-list a:hover {
		color: var(--color-hf-amber);
	}

	/* Sections */
	.unsl-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		scroll-margin-top: 80px;
	}
	.unsl-h2 {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.unsl-h3 {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 1rem 0 0.5rem;
	}
	.unsl-lead {
		font-size: 1.05rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		margin: 0;
	}

	/* Features */
	.unsl-grid-3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}
	.unsl-feature {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem;
		text-align: center;
	}
	.unsl-feature-emoji {
		font-size: 2rem;
	}
	.unsl-feature strong {
		display: block;
		margin: 0.25rem 0;
		color: var(--color-ink-900);
	}
	.unsl-feature p {
		font-size: 0.85rem;
		color: var(--color-ink-500);
		margin: 0;
	}

	/* Decision tree */
	.unsl-decision {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.unsl-dec-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		font-size: 0.9rem;
		align-items: center;
	}
	.unsl-dec-row:first-child {
		background: #f8fafc;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-ink-500);
	}
	.unsl-dec-rag {
		background: #f0f9ff;
		padding: 0.5rem;
		border-radius: 0.4rem;
	}
	.unsl-dec-prompt {
		background: #f0fdf4;
		padding: 0.5rem;
		border-radius: 0.4rem;
	}
	.unsl-dec-ft {
		background: var(--color-hf-cream);
		padding: 0.5rem;
		border-radius: 0.4rem;
	}

	/* Formats */
	.unsl-formats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}
	.unsl-format {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.unsl-format-head {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1rem;
		color: var(--color-ink-900);
		margin-bottom: 0.5rem;
	}
	.unsl-format p {
		font-size: 0.85rem;
		color: var(--color-ink-700);
		margin: 0 0 0.5rem;
	}
	.unsl-code {
		background: #1a1a1a;
		color: #e2e8f0;
		padding: 0.75rem;
		border-radius: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.55;
		overflow-x: auto;
		margin: 0;
	}

	.unsl-checklist {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-left: 1rem;
	}
	.unsl-checklist li {
		font-size: 0.95rem;
		color: var(--color-ink-700);
	}

	/* Hyperparams */
	.unsl-hp-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	@media (max-width: 720px) {
		.unsl-hp-grid {
			grid-template-columns: 1fr;
		}
	}
	.unsl-hp-group {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.unsl-hp-group-title {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0 0 0.5rem;
	}
	.unsl-hp-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}
	.unsl-hp-table th,
	.unsl-hp-table td {
		padding: 0.4rem 0.5rem;
		text-align: left;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: top;
	}
	.unsl-hp-table th {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-ink-500);
	}
	.unsl-hp-table code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}

	/* Methods */
	.unsl-methods {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}
	.unsl-method {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem 1.1rem;
	}
	.unsl-method h3 {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0 0 0.4rem;
	}
	.unsl-method p {
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0 0 0.5rem;
	}
	.unsl-method-when {
		font-size: 0.8rem !important;
		color: var(--color-ink-500) !important;
		font-style: italic;
	}

	/* Deploy */
	.unsl-deploy-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}
	.unsl-deploy {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.unsl-deploy-emoji {
		font-size: 2rem;
	}
	.unsl-deploy h3 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		margin: 0.4rem 0 0.5rem;
	}
	.unsl-deploy p {
		font-size: 0.85rem;
		color: var(--color-ink-700);
		margin: 0 0 0.5rem;
		line-height: 1.5;
	}
	.unsl-deploy-when {
		font-size: 0.78rem !important;
		color: var(--color-ink-500) !important;
		font-style: italic;
		margin-top: 0.5rem !important;
	}

	/* Glossary */
	.unsl-glossary-wrapper {
		scroll-margin-top: 80px;
	}
	.unsl-glossary {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
	}
	.unsl-gl-row {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 1rem;
		align-items: baseline;
	}
	.unsl-gl-row dt {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-hf-amber);
	}
	.unsl-gl-row dd {
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0;
	}
	@media (max-width: 600px) {
		.unsl-gl-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
		.unsl-dec-row {
			grid-template-columns: 1fr;
		}
	}

	/* ====== Prérequis (section 0) ====== */
	.unsl-prereq-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.6rem;
	}
	.unsl-prereq {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		overflow: hidden;
		transition: border-color 0.15s;
	}
	.unsl-prereq:hover {
		border-color: var(--color-hf-amber);
	}
	.unsl-prereq[open] {
		border-color: var(--color-hf-amber);
		background: #fffdf5;
	}
	.unsl-prereq summary {
		cursor: pointer;
		padding: 0.85rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--color-ink-900);
		list-style: none;
	}
	.unsl-prereq summary::-webkit-details-marker {
		display: none;
	}
	.unsl-prereq summary::after {
		content: '▶';
		margin-left: auto;
		color: var(--color-ink-500);
		font-size: 0.7rem;
		transition: transform 0.15s;
	}
	.unsl-prereq[open] summary::after {
		transform: rotate(90deg);
	}
	.unsl-prereq-emoji {
		font-size: 1.4rem;
	}
	.unsl-prereq-body {
		padding: 0 1rem 1rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
	}
	.unsl-prereq-body p {
		margin: 0 0 0.6rem;
	}
	.unsl-prereq-body p:last-child {
		margin-bottom: 0;
	}
	.unsl-prereq-body ul,
	.unsl-prereq-body ol {
		margin: 0.4rem 0;
		padding-left: 1.25rem;
	}
	.unsl-prereq-body li {
		margin: 0.25rem 0;
	}
	.unsl-prereq-body code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}

	/* ====== Use cases approfondis ====== */
	.unsl-usecase {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1.25rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	.unsl-usecase-defense {
		border-left: 6px solid #1e40af;
		background: linear-gradient(90deg, #eff6ff 0%, #fff 35%);
	}
	.unsl-usecase-chimie {
		border-left: 6px solid #16a34a;
		background: linear-gradient(90deg, #f0fdf4 0%, #fff 35%);
	}
	.unsl-uc-head {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.unsl-uc-emoji {
		font-size: 2.5rem;
		line-height: 1;
	}
	.unsl-uc-title {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.unsl-uc-tagline {
		font-size: 0.95rem;
		color: var(--color-ink-700);
		margin: 0.25rem 0 0;
		line-height: 1.55;
	}
	.unsl-uc-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.unsl-uc-body h4 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0.75rem 0 0.4rem;
		padding-top: 0.5rem;
		border-top: 1px solid #f1f5f9;
	}
	.unsl-uc-body h4:first-child {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}
	.unsl-uc-body ul {
		margin: 0;
		padding-left: 1.2rem;
	}
	.unsl-uc-body li {
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0.3rem 0;
	}
	.unsl-uc-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}
	.unsl-uc-table td {
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: top;
		color: var(--color-ink-700);
		line-height: 1.55;
	}
	.unsl-uc-table td:first-child {
		width: 200px;
		color: var(--color-ink-900);
		font-size: 0.82rem;
	}
	.unsl-uc-examples {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.unsl-uc-example {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.unsl-uc-ex-system,
	.unsl-uc-ex-user,
	.unsl-uc-ex-assistant {
		font-size: 0.88rem;
		line-height: 1.55;
		padding: 0.5rem 0.75rem;
		border-radius: 0.4rem;
		border-left: 3px solid;
	}
	.unsl-uc-ex-system {
		background: #eff6ff;
		border-left-color: #3b82f6;
		color: var(--color-ink-700);
	}
	.unsl-uc-ex-user {
		background: #f0fdf4;
		border-left-color: #22c55e;
		color: var(--color-ink-900);
	}
	.unsl-uc-ex-assistant {
		background: #fffbeb;
		border-left-color: #f59e0b;
		color: var(--color-ink-900);
	}
	.unsl-uc-ex-refusal {
		background: #fef2f2;
		border-left-color: #dc2626;
	}
	.unsl-uc-tag {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
		margin-right: 0.4rem;
		vertical-align: 1px;
	}
	.unsl-uc-tag-sys {
		background: #dbeafe;
		color: #1e40af;
	}
	.unsl-uc-tag-user {
		background: #dcfce7;
		color: #166534;
	}
	.unsl-uc-tag-asst {
		background: #fef3c7;
		color: #92400e;
	}
	@media (max-width: 600px) {
		.unsl-uc-table td:first-child {
			width: auto;
			display: block;
			padding-bottom: 0;
		}
		.unsl-uc-table td {
			display: block;
		}
	}

	/* ====== NVIDIA section ====== */
	.unsl-nv-headline {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
		color: #fff;
		border-radius: 1rem;
		border: 1px solid #76b900;
		border-left: 6px solid #76b900;
	}
	.unsl-nv-headline-emoji {
		font-size: 2rem;
	}
	.unsl-nv-headline-body {
		font-size: 0.9rem;
		line-height: 1.55;
		color: #e2e8f0;
	}
	.unsl-nv-headline-body strong {
		color: #76b900;
		font-family: var(--font-display);
		font-size: 1rem;
	}
	.unsl-nv-opt {
		display: grid;
		grid-template-columns: 56px 1fr;
		gap: 1rem;
		padding: 1.25rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
	}
	.unsl-nv-opt-num {
		width: 56px;
		height: 56px;
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 800;
		background: #76b900;
		color: white;
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.unsl-nv-opt-body h3 {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.unsl-nv-opt-tagline {
		font-size: 0.92rem;
		color: var(--color-ink-700);
		margin: 0.3rem 0 0.75rem !important;
		font-style: italic;
	}
	.unsl-nv-opt-body h4 {
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0.75rem 0 0.3rem;
	}
	.unsl-nv-opt-body p {
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		margin: 0 0 0.5rem !important;
	}
	.unsl-nv-bench {
		background: #f0fdf4;
		border-left: 3px solid #76b900;
		border-radius: 0.4rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}
	.unsl-nv-bench strong {
		color: var(--color-ink-900);
		display: block;
		margin-bottom: 0.3rem;
	}
	.unsl-nv-bench ul {
		margin: 0;
		padding-left: 1.2rem;
	}
	.unsl-nv-bench li {
		color: var(--color-ink-700);
		margin: 0.15rem 0;
	}
	.unsl-nv-tradeoff {
		background: #fef3c7;
		border-left: 3px solid #f59e0b;
		border-radius: 0.4rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.83rem;
		color: var(--color-ink-700);
		margin-top: 0.5rem;
	}
	.unsl-nv-schema {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
		padding: 0.75rem;
		margin: 0.6rem 0;
	}
	.unsl-nv-schema svg {
		width: 100%;
		height: auto;
		max-height: 220px;
	}
	.unsl-nv-schema-caption {
		font-size: 0.82rem !important;
		color: var(--color-ink-700) !important;
		margin: 0.5rem 0 0 !important;
		line-height: 1.5;
	}
	@media (max-width: 600px) {
		.unsl-nv-opt {
			grid-template-columns: 1fr;
		}
		.unsl-nv-opt-num {
			width: 48px;
			height: 48px;
			font-size: 1.5rem;
		}
	}

	/* ====== Pipeline overview (méthodes) ====== */
	.unsl-pipeline {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto 1fr;
		gap: 0.5rem;
		align-items: stretch;
		padding: 1rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
	}
	.unsl-pipeline-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.85rem;
		background: #f8fafc;
		border-radius: 0.75rem;
		text-align: center;
	}
	.unsl-pipeline-rl {
		background: #fef3c7;
	}
	.unsl-pipeline-emoji {
		font-size: 1.75rem;
	}
	.unsl-pipeline-step strong {
		font-family: var(--font-display);
		font-size: 0.95rem;
		color: var(--color-ink-900);
	}
	.unsl-pipeline-step span {
		font-size: 0.78rem;
		color: var(--color-ink-500);
	}
	.unsl-pipeline-arrow {
		font-size: 1.5rem;
		color: var(--color-hf-amber);
		display: flex;
		align-items: center;
		font-weight: 700;
	}
	.unsl-pipeline-caption {
		font-size: 0.92rem !important;
		font-style: italic;
		color: var(--color-ink-500) !important;
	}
	@media (max-width: 720px) {
		.unsl-pipeline {
			grid-template-columns: 1fr;
		}
		.unsl-pipeline-arrow {
			justify-self: center;
			transform: rotate(90deg);
		}
	}

	/* ====== Family titles & deep method articles ====== */
	.unsl-family-title {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 1.5rem 0 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--color-hf-amber);
	}
	.unsl-family-rl {
		border-bottom-color: #f59e0b;
	}
	.unsl-family-icon {
		font-size: 1.75rem;
	}
	.unsl-method-deep {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.25rem;
		margin-bottom: 0.75rem;
	}
	.unsl-method-rl {
		border-left: 4px solid #f59e0b;
		background: linear-gradient(90deg, #fffbeb 0%, #fff 30%);
	}
	.unsl-method-recent {
		border-left-color: #a855f7;
		background: linear-gradient(90deg, #faf5ff 0%, #fff 30%);
	}
	.unsl-method-deep-head {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
		margin-bottom: 0.6rem;
	}
	.unsl-method-deep-emoji {
		font-size: 2rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.unsl-method-deep-head h4 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.unsl-method-deep-tagline {
		font-size: 0.88rem;
		color: var(--color-ink-700);
		margin: 0.2rem 0 0;
		font-style: italic;
	}
	.unsl-method-deep-body h5 {
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0.85rem 0 0.35rem;
	}
	.unsl-method-deep-body p,
	.unsl-method-deep-body ul,
	.unsl-method-deep-body ol {
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
	}
	.unsl-method-deep-body p {
		margin: 0 0 0.5rem;
	}
	.unsl-method-deep-body ul,
	.unsl-method-deep-body ol {
		margin: 0 0 0.5rem;
		padding-left: 1.25rem;
	}
	.unsl-method-deep-body li {
		margin: 0.2rem 0;
	}

	/* ====== Decision matrix ====== */
	.unsl-decision-matrix {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
		margin-top: 0.5rem;
	}
	.unsl-decision-matrix thead {
		background: rgba(255, 157, 0, 0.1);
	}
	.unsl-decision-matrix th {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-ink-700);
		text-align: left;
		padding: 0.5rem 0.6rem;
	}
	.unsl-decision-matrix td {
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid #f1f5f9;
		color: var(--color-ink-700);
	}
	.unsl-decision-matrix td strong {
		color: var(--color-hf-amber);
	}
	.unsl-grpo-example {
		background: #faf5ff;
		border: 1px solid #d8b4fe;
		border-left: 4px solid #a855f7;
		border-radius: 0.6rem;
		padding: 0.85rem;
		margin: 0.5rem 0;
	}
	.unsl-grpo-prompt {
		background: #f0f9ff;
		border-left: 3px solid #3b82f6;
		padding: 0.5rem 0.75rem;
		border-radius: 0.4rem;
		margin-bottom: 0.5rem;
		font-size: 0.88rem;
		color: var(--color-ink-900);
	}
	.unsl-grpo-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		background: #fff;
		border-radius: 0.4rem;
		overflow: hidden;
	}
	.unsl-grpo-table th,
	.unsl-grpo-table td {
		padding: 0.4rem 0.5rem;
		text-align: left;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: top;
	}
	.unsl-grpo-table th {
		background: #f3e8ff;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-ink-700);
	}
	.unsl-grpo-pos {
		color: #16a34a;
		font-weight: 600;
		font-family: var(--font-mono);
	}
	.unsl-grpo-neg {
		color: #dc2626;
		font-weight: 600;
		font-family: var(--font-mono);
	}
	.unsl-grpo-note {
		font-size: 0.82rem !important;
		color: var(--color-ink-700) !important;
		margin: 0.5rem 0 0 !important;
		line-height: 1.55;
	}
	.unsl-hp-example-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		background: #fff;
		margin: 0.5rem 0;
		border-radius: 0.4rem;
		overflow: hidden;
	}
	.unsl-hp-example-table th,
	.unsl-hp-example-table td {
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid #f1f5f9;
	}
	.unsl-hp-example-table th {
		background: #fff7ed;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-ink-700);
		text-align: left;
	}
	.unsl-hp-example-table td code {
		background: var(--color-hf-yellow);
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
		font-weight: 600;
	}
	.unsl-hp-example-caption {
		font-size: 0.82rem !important;
		color: var(--color-ink-700) !important;
		margin: 0.4rem 0 0 !important;
		line-height: 1.55;
		font-style: italic;
	}

	/* ====== KV cache section ====== */
	.unsl-kv-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	@media (max-width: 600px) {
		.unsl-kv-grid {
			grid-template-columns: 1fr;
		}
	}
	.unsl-kv-card {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem 1.1rem;
	}
	.unsl-kv-card-warn {
		background: #fef3c7;
		border-color: #f59e0b;
	}
	.unsl-kv-emoji {
		font-size: 1.75rem;
	}
	.unsl-kv-card h4 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0.25rem 0 0.4rem;
	}
	.unsl-kv-card p {
		font-size: 0.88rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0;
	}

	/* ====== Hyperparams en profondeur ====== */
	.unsl-hp-deep {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.25rem;
		margin-bottom: 0.75rem;
		border-left: 4px solid var(--color-hf-amber);
	}
	.unsl-hp-deep-head {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #f1f5f9;
	}
	.unsl-hp-deep-emoji {
		font-size: 2rem;
		line-height: 1;
		flex-shrink: 0;
	}
	.unsl-hp-deep-head h4 {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.unsl-hp-deep-default {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-ink-500);
		background: #f1f5f9;
		padding: 0.15rem 0.5rem;
		border-radius: 0.3rem;
		margin-top: 0.2rem;
	}
	.unsl-hp-deep-default code {
		background: var(--color-hf-yellow);
		color: var(--color-ink-900);
		padding: 0 0.3rem;
		border-radius: 0.2rem;
		font-weight: 600;
	}
	.unsl-hp-deep-body h5 {
		font-family: var(--font-display);
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0.85rem 0 0.35rem;
	}
	.unsl-hp-deep-body p,
	.unsl-hp-deep-body ul {
		font-size: 0.92rem;
		color: var(--color-ink-700);
		line-height: 1.65;
	}
	.unsl-hp-deep-body p {
		margin: 0 0 0.5rem;
	}
	.unsl-hp-deep-body ul {
		margin: 0 0 0.5rem;
		padding-left: 1.25rem;
	}
	.unsl-hp-deep-body li {
		margin: 0.3rem 0;
	}
</style>
