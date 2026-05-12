<!--
	/unsloth/atelier — Atelier pratique d'entraînement.
	Cible : RTX 5000 + Unsloth Studio + Mistral 7B.

	Aligné sur le projet souverain défense :
	  - Mistral (origine France, Apache 2.0, pas de restriction militaire)
	  - 7B (qualité production, tient en VRAM avec QLoRA)
	  - Export GGUF pour déploiement local Ollama
-->
<script lang="ts">
	import Callout from '$lib/components/Callout.svelte';

	let copiedId = $state<string | null>(null);
	function copy(text: string, id: string) {
		navigator.clipboard?.writeText(text);
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2000);
	}

	// ============================================================
	// Méta-prompt pour générer le dataset avec Claude
	// ============================================================
	const METAPROMPT = `Tu vas m'aider à générer un dataset d'instruction tuning en français pour fine-tuner Mistral 7B.

CONTEXTE
Je construis un assistant pédagogique qui explique des concepts d'IA en termes simples, avec des analogies du quotidien et un ton bienveillant et structuré.

TÂCHE
Génère 80 paires (instruction, réponse) au format JSONL strict (un objet JSON par ligne, pas de virgule, pas de tableau englobant).

CHAQUE OBJET A EXACTEMENT 3 CLÉS :
- "instruction" : une question ou une demande d'explication d'un concept d'IA
- "input" : "" (vide pour ce dataset)
- "output" : la réponse pédagogique idéale, ~3 à 6 phrases, avec une analogie du quotidien

CONCEPTS À COUVRIR (varier !)
Transformer, attention, embedding, tokenization, fine-tuning, LoRA, QLoRA, quantization,
RAG, prompt engineering, hallucination, température, top-p, top-k, KV cache, GPU vs CPU,
modèle de fondation, alignement, RLHF, DPO, instruction tuning, mixture of experts,
multimodal, context window, perplexité, gradient descent, backpropagation, overfitting,
dataset, epoch, batch size, learning rate, optimizer Adam, RMSNorm, RoPE, SwiGLU,
chat template, system prompt, system / user / assistant.

VARIATIONS DEMANDÉES
- Reformule certaines instructions ("Explique X", "C'est quoi X ?", "Comment marche X ?")
- Varie la longueur des réponses (de 2 phrases à 6)
- Varie le style (parfois enthousiaste, parfois calme, toujours bienveillant)
- Mélange concepts simples (ex: tokenization) et avancés (ex: QLoRA)

RÈGLES
- Français correct, sans anglicismes inutiles
- TOUJOURS inclure UNE analogie du quotidien dans la réponse
- Pas d'emojis dans les réponses
- Pas de "Bien sûr !" / "Voici…" — réponse directe
- Échappe les guillemets internes en JSON (\\")

FORMAT DE SORTIE
Réponds UNIQUEMENT avec le JSONL, rien d'autre. Pas de markdown, pas de commentaires.
Format ligne :
{"instruction": "...", "input": "", "output": "..."}
80 lignes au total.`;

	// ============================================================
	// Code cells
	// ============================================================
	const CMD_CHECK = `# Dans le terminal de ta VM
nvidia-smi
# → tu dois voir ta RTX 5000 et la VRAM disponible

nvcc --version
# → tu dois voir CUDA 12.x`;

	const CMD_DOCKER = `# Lancer Unsloth Studio (pré-installé) — adapte le port si nécessaire
docker run --gpus all -it \\
  -p 8888:8888 \\
  -v $(pwd):/workspace \\
  --name unsloth-studio \\
  unsloth/unsloth:latest

# Note : le tag exact dépend de ton accès Studio. Si tu as un autre tag fourni
# par ton équipe (ex: unsloth/studio:cuda12), utilise-le.

# Une fois lancé, ouvre dans ton navigateur :
#   http://localhost:8888  (ou l'URL de ta VM si distante)
# Token affiché dans la console du conteneur.`;

	const CELL_INSTALL = `# Cellule 1 — Si Unsloth n'est pas pré-installé dans ton image
# (skip si tu utilises l'image officielle qui l'a déjà)

%%capture
!pip install --upgrade --no-cache-dir "unsloth[cu121] @ git+https://github.com/unslothai/unsloth.git"`;

	const CELL_LOAD = `# Cellule 2 — Charger Mistral 7B Instruct v0.3 en 4 bits (NF4)
from unsloth import FastLanguageModel
import torch

max_seq_length = 4096   # On peut se permettre 4k avec la RTX 5000
dtype = None            # auto-détection : bf16 sur Ampere/Ada/Lovelace
load_in_4bit = True     # NF4 quantization → ~4 Go VRAM pour les poids

# Mistral 7B Instruct v0.3 — Apache 2.0, origine France, pas de restriction militaire
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/mistral-7b-instruct-v0.3-bnb-4bit",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
    # token = "hf_...",  # nécessaire pour les modèles gated, pas pour Mistral
)

# Vérifier la VRAM utilisée
gpu_stats = torch.cuda.get_device_properties(0)
print(f"GPU : {gpu_stats.name}")
print(f"VRAM totale : {gpu_stats.total_memory / 1024**3:.1f} Go")
print(f"VRAM utilisée : {torch.cuda.memory_allocated() / 1024**3:.1f} Go")`;

	const CELL_LORA = `# Cellule 3 — Attacher les LoRA
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,                              # rang LoRA — sweet spot
    target_modules = [
        "q_proj", "k_proj", "v_proj", "o_proj",      # attention
        "gate_proj", "up_proj", "down_proj",          # FFN
    ],
    lora_alpha = 16,                     # convention Unsloth : alpha = r
    lora_dropout = 0,                    # 0 toujours avec Unsloth
    bias = "none",
    use_gradient_checkpointing = "unsloth",  # mode optimisé Unsloth
    random_state = 42,
    use_rslora = False,                  # rank-stabilized LoRA — laisse False
    loftq_config = None,
)

# Vérifie combien de paramètres on entraîne
model.print_trainable_parameters()
# → quelque chose comme : trainable params: 41,943,040 (0.55%) of 7,591,030,784`;

	const CELL_DATA = `# Cellule 4 — Charger et formater le dataset
from datasets import load_dataset
from unsloth.chat_templates import get_chat_template

# Le fichier mon-dataset.jsonl doit être dans le workspace monté (/workspace ou ./)
dataset = load_dataset("json", data_files="mon-dataset.jsonl", split="train")

# Récupère le chat template officiel Mistral
tokenizer = get_chat_template(
    tokenizer,
    chat_template = "mistral",
)

def formatting_prompts_func(examples):
    instructions = examples["instruction"]
    inputs = examples["input"]
    outputs = examples["output"]
    texts = []
    for inst, inp, out in zip(instructions, inputs, outputs):
        user_content = inst + (("\\n" + inp) if inp else "")
        msgs = [
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": out},
        ]
        text = tokenizer.apply_chat_template(
            msgs, tokenize=False, add_generation_prompt=False
        )
        texts.append(text)
    return {"text": texts}

dataset = dataset.map(formatting_prompts_func, batched=True)

# 🛑 ARRÊT OBLIGATOIRE : vérifie visuellement le format
print("====== EXEMPLE FORMATÉ ======")
print(dataset[0]["text"])
print("=============================")
# Tu dois voir des balises [INST]...[/INST] et un EOT à la fin.
# Si non → re-vérifie ton JSONL, le format n'est pas pris.`;

	const CELL_TRAIN = `# Cellule 5 — Configurer et lancer le training
from trl import SFTTrainer
from transformers import TrainingArguments
from unsloth import is_bfloat16_supported

trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 4,
    packing = False,                     # True si exemples très courts
    args = TrainingArguments(
        per_device_train_batch_size = 4,           # RTX 5000 a la VRAM pour ça
        gradient_accumulation_steps = 4,           # batch effectif = 4*4 = 16
        warmup_steps = 10,
        num_train_epochs = 2,                      # 2 passes sur le dataset
        # max_steps = 60,                          # alternative à num_train_epochs
        learning_rate = 2e-4,
        fp16 = not is_bfloat16_supported(),
        bf16 = is_bfloat16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "cosine",              # atterrissage doux
        seed = 42,
        output_dir = "outputs",
        report_to = "none",
        save_strategy = "epoch",                   # checkpoint à chaque epoch
    ),
)

# Stats VRAM avant le training
gpu_stats = torch.cuda.get_device_properties(0)
start_mem = torch.cuda.max_memory_reserved() / 1024**3
print(f"VRAM réservée avant training : {start_mem:.2f} Go")

# 🚀 GO
trainer_stats = trainer.train()

# Stats post-training
end_mem = torch.cuda.max_memory_reserved() / 1024**3
print(f"VRAM max pendant training : {end_mem:.2f} Go")
print(f"Temps total : {trainer_stats.metrics['train_runtime'] / 60:.1f} min")`;

	const CELL_INFER = `# Cellule 6 — Tester ton modèle fraîchement entraîné
FastLanguageModel.for_inference(model)  # 2x plus rapide en inférence

def chat(user_msg: str, max_new_tokens: int = 256, temperature: float = 0.7):
    """Helper pour tester rapidement le modèle."""
    messages = [{"role": "user", "content": user_msg}]
    inputs = tokenizer.apply_chat_template(
        messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
    ).to("cuda")
    outputs = model.generate(
        input_ids = inputs,
        max_new_tokens = max_new_tokens,
        temperature = temperature,
        top_p = 0.9,
        do_sample = True,
    )
    response = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
    return response.split("[/INST]")[-1].strip()

# Tests à faire (varie ces questions)
print("--- Q1 : du dataset ---")
print(chat("C'est quoi LoRA ?"))

print("\\n--- Q2 : nouveau mais proche ---")
print(chat("C'est quoi un adapter en fine-tuning ?"))

print("\\n--- Q3 : hors sujet ---")
print(chat("Recette de tarte aux pommes ?"))
# Le modèle doit pouvoir répondre normalement (pas casser le comportement de base)`;

	const CELL_SAVE = `# Cellule 7 — Exporter en GGUF pour Ollama / llama.cpp
# Choix de quantization à l'export :
#   q8_0    → 8-bit, qualité quasi-parfaite, 8 Go pour Mistral 7B
#   q5_k_m  → équilibre, ~5.5 Go, recommandé
#   q4_k_m  → le plus utilisé, ~4.5 Go, bon compromis qualité/poids

# Sauve d'abord les LoRA seuls (utile si tu veux les pousser sur HF Hub)
model.save_pretrained("mistral-7b-pedago-lora")
tokenizer.save_pretrained("mistral-7b-pedago-lora")

# Puis exporte en GGUF mergé (pour Ollama)
model.save_pretrained_gguf(
    "mistral-7b-pedago-gguf",
    tokenizer,
    quantization_method = "q4_k_m",
)
print("✅ Export terminé. Le fichier .gguf est dans le dossier mistral-7b-pedago-gguf/")`;

	const OLLAMA_MODELFILE = `FROM ./mistral-7b-pedago-gguf/unsloth.Q4_K_M.gguf

# Template Mistral Instruct v0.3
TEMPLATE """[INST] {{ .Prompt }} [/INST] """

PARAMETER stop "[INST]"
PARAMETER stop "[/INST]"
PARAMETER stop "</s>"
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1

# Système optionnel
SYSTEM """Tu es un assistant pédagogique en IA, en français,
qui explique avec des analogies du quotidien."""`;

	const OLLAMA_RUN = `# Sur ta machine locale (où Ollama est installé)
# Récupère d'abord le dossier mistral-7b-pedago-gguf depuis ta VM
# (scp, rsync, ou téléchargement via le file browser de Studio)

# Crée le modèle Ollama
ollama create mistral-pedago -f Modelfile

# Lance-le
ollama run mistral-pedago "C'est quoi le fine-tuning ?"

# Ou démarre le serveur API (port 11434) puis curl :
# curl http://localhost:11434/api/generate -d '{"model":"mistral-pedago","prompt":"..."}'`;
</script>

<svelte:head>
	<title>Atelier — Entraîner Mistral 7B sur ta RTX 5000</title>
</svelte:head>

<article class="atl">
	<!-- ====================== HÉROS ====================== -->
	<header class="atl-hero">
		<span class="atl-hero-emoji">🛠️</span>
		<h1 class="atl-h1">Atelier — Mistral 7B sur RTX 5000</h1>
		<p class="atl-hero-lead">
			Tu vas fine-tuner Mistral 7B Instruct v0.3 sur ton propre dataset,
			via Unsloth Studio, en moins d'une heure, sur ta machine. Aligné
			avec ton projet souverain : Mistral (Apache 2.0, origine France),
			QLoRA pour tenir confortablement en VRAM, export GGUF pour Ollama
			local.
		</p>
		<a href="/unsloth" class="atl-back">← Revenir au lab</a>
	</header>

	<Callout variant="insight" title="✅ Avec ta config, tout devient confortable">
		<p>
			La RTX 5000 a 32 Go de VRAM (variante Ada). Mistral 7B en QLoRA
			occupe ~6-8 Go pendant le training. Tu as <strong>3-4× la marge
				nécessaire</strong> — tu peux monter en batch size, en
			max_seq_length, ou même tester un 13B plus tard. C'est confortable.
		</p>
	</Callout>

	<!-- ====================== TOC ====================== -->
	<nav class="atl-toc">
		<p class="atl-toc-label">📍 Le parcours en 9 étapes</p>
		<ol class="atl-toc-list">
			<li><a href="#step0">0. Vérifier ta VM (5 min)</a></li>
			<li><a href="#step1">1. Lancer Unsloth Studio (5 min)</a></li>
			<li><a href="#step2">2. Choisir Mistral 7B et comprendre pourquoi (3 min)</a></li>
			<li><a href="#step3">3. Générer le dataset avec Claude (10 min)</a></li>
			<li class="atl-toc-divider">↓ Choisis ton chemin pour les étapes 4–7 ↓</li>
			<li><a href="#path-a-ui">🎨 Path A — Avec l'UI Studio (no-code, ~25 min)</a></li>
			<li class="atl-toc-divider">— OU —</li>
			<li><a href="#step4">🐍 Path B — 4. Notebook : charger le modèle (5 min)</a></li>
			<li><a href="#step5">🐍 Path B — 5. Notebook : LoRA + dataset (5 min)</a></li>
			<li><a href="#step6">🐍 Path B — 6. Lancer le training (15-25 min)</a></li>
			<li><a href="#step7">🐍 Path B — 7. Tester le modèle (5 min)</a></li>
			<li class="atl-toc-divider">↓ Commun aux deux paths ↓</li>
			<li><a href="#step8">8. Export GGUF + Ollama local (10 min)</a></li>
		</ol>
		<p class="atl-toc-total">⏱️ <strong>~60–80 minutes</strong> au total.</p>
	</nav>

	<!-- ====================== STEP 0 ====================== -->
	<section id="step0" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 0</span>
			<h2>🔧 Vérifier ta VM</h2>
		</header>
		<p>
			Avant tout, on s'assure que ta machine virtuelle voit bien la GPU et
			que CUDA est installé.
		</p>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Terminal — checks de base</span>
				<button type="button" class="atl-copy" onclick={() => copy(CMD_CHECK, 'check')}>
					{copiedId === 'check' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CMD_CHECK}</code></pre>
		</div>

		<div class="atl-explain">
			<p><strong>Ce que tu dois voir :</strong></p>
			<ul>
				<li>
					<code>nvidia-smi</code> affiche un tableau avec ta carte
					(« NVIDIA RTX 5000 Ada » ou similaire), la VRAM totale (~32 Go),
					et la version du driver (≥ 525).
				</li>
				<li>
					<code>nvcc --version</code> affiche la version de CUDA
					(typiquement « release 12.1 » ou plus récent).
				</li>
			</ul>
			<p><strong>Si ça ne marche pas :</strong></p>
			<ul>
				<li>
					<code>nvidia-smi: command not found</code> → les drivers NVIDIA
					ne sont pas installés. Sur Ubuntu :
					<code>sudo apt install nvidia-driver-535</code> puis reboot.
				</li>
				<li>
					<code>nvcc: command not found</code> mais <code>nvidia-smi</code>
					marche → CUDA Toolkit pas installé. Sur la VM cloud, c'est
					généralement déjà là. Sinon, suis la doc NVIDIA.
				</li>
			</ul>
		</div>
	</section>

	<!-- ====================== STEP 1 ====================== -->
	<section id="step1" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 1</span>
			<h2>🐳 Lancer Unsloth Studio</h2>
		</header>
		<p>
			Unsloth Studio = environnement Jupyter Lab avec Python, CUDA, Unsloth
			et toutes les libs déjà installées. Tu lances un conteneur Docker, et
			tu accèdes à Jupyter dans ton navigateur. Pas d'install manuelle, pas
			de version qui rentre en conflit.
		</p>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Terminal — lancer le conteneur</span>
				<button type="button" class="atl-copy" onclick={() => copy(CMD_DOCKER, 'docker')}>
					{copiedId === 'docker' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CMD_DOCKER}</code></pre>
		</div>

		<div class="atl-explain">
			<p><strong>Décortication des flags Docker :</strong></p>
			<ul>
				<li><code>--gpus all</code> : donne accès aux GPUs au conteneur (sans ça, pas de CUDA dedans).</li>
				<li><code>-it</code> : mode interactif, tu vois la sortie en direct.</li>
				<li><code>-p 8888:8888</code> : Jupyter Lab écoute sur 8888 dans le conteneur ; on l'expose sur 8888 de la VM.</li>
				<li><code>-v $(pwd):/workspace</code> : monte ton dossier courant dans <code>/workspace</code>. Tes fichiers persistent même si tu redémarres le conteneur.</li>
				<li><code>--name unsloth-studio</code> : nomme le conteneur pour pouvoir le retrouver.</li>
			</ul>
			<p>
				La première fois, l'image se télécharge (~10-15 Go). Ensuite c'est
				instantané. Au démarrage, Jupyter Lab affiche un token dans la
				console — copie l'URL <code>http://...?token=...</code> et ouvre-la
				dans ton navigateur.
			</p>
		</div>

		<Callout variant="note" title="📌 VM distante (pas en local)">
			<p>
				Si ta VM est dans le cloud (AWS, GCP, Azure, Lambda, RunPod), tu
				dois soit ouvrir le port 8888 vers ton IP, soit faire un tunnel SSH :
			</p>
			<pre class="atl-pre" style="margin-top:0.5rem"><code>ssh -L 8888:localhost:8888 user@ma-vm</code></pre>
			<p style="margin-top:0.5rem">
				Tu accèdes ensuite à <code>http://localhost:8888</code> sur ta
				machine — le tunnel transmet à la VM.
			</p>
		</Callout>
	</section>

	<!-- ====================== STEP 2 ====================== -->
	<section id="step2" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 2</span>
			<h2>🇫🇷 Choisir Mistral 7B et comprendre pourquoi</h2>
		</header>
		<p>
			Pour ce premier fine-tuning, on prend
			<strong>Mistral 7B Instruct v0.3</strong>. Trois raisons.
		</p>
		<div class="atl-grid-3">
			<div class="atl-pillar">
				<div class="atl-pillar-emoji">⚖️</div>
				<strong>Licence Apache 2.0</strong>
				<p>Aucune restriction d'usage — défense, militaire, commercial. Llama est interdit pour usage défense par l'AUP de Meta.</p>
			</div>
			<div class="atl-pillar">
				<div class="atl-pillar-emoji">🇫🇷</div>
				<strong>Origine française</strong>
				<p>Cohérent avec ton projet souverain. Mistral AI est basé à Paris.</p>
			</div>
			<div class="atl-pillar">
				<div class="atl-pillar-emoji">🎯</div>
				<strong>Excellent en français</strong>
				<p>Mistral a été entraîné avec une grosse part de français. Llama 3 est meilleur en anglais.</p>
			</div>
		</div>

		<Callout variant="info" title="💡 Pourquoi pas Mistral 7B v0.1 ou v0.2 ?">
			<p>
				v0.3 est la dernière version (mai 2024). Elle inclut un
				<strong>vocabulaire étendu</strong> (32 768 → 32 768 + tokens
				spéciaux) et meilleure compréhension. On part sur la plus
				récente.
			</p>
		</Callout>
	</section>

	<!-- ====================== STEP 3 ====================== -->
	<section id="step3" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 3</span>
			<h2>📝 Générer le dataset avec Claude</h2>
		</header>
		<p>
			On va créer 80 paires (instruction, réponse) en français sur les
			concepts d'IA. Ça représente <strong>l'esprit pédagogique</strong>
			que ton modèle devra adopter.
		</p>

		<div class="atl-substeps">
			<div class="atl-substep"><strong>3.1</strong> Ouvre <a href="https://claude.ai" target="_blank" rel="noopener">claude.ai</a> dans un onglet.</div>
			<div class="atl-substep"><strong>3.2</strong> Colle le méta-prompt ci-dessous.</div>
			<div class="atl-substep"><strong>3.3</strong> Récupère la sortie. Vérifie qu'elle est bien en JSONL (une ligne par exemple).</div>
			<div class="atl-substep"><strong>3.4</strong> Sauve dans <code>mon-dataset.jsonl</code> dans ton workspace (le dossier monté dans le conteneur via <code>-v $(pwd):/workspace</code>).</div>
		</div>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>🎯 Méta-prompt à coller dans Claude</span>
				<button type="button" class="atl-copy" onclick={() => copy(METAPROMPT, 'meta')}>
					{copiedId === 'meta' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{METAPROMPT}</code></pre>
		</div>

		<Callout variant="warning" title="⚠️ Vérification rapide du JSONL">
			<p>Dans le terminal de Studio (Jupyter ou shell) :</p>
			<pre class="atl-pre" style="margin-top:0.5rem"><code>{`# Compter les lignes
wc -l mon-dataset.jsonl
# Doit afficher 80

# Valider que chaque ligne est du JSON
python -c "import json; [json.loads(l) for l in open('mon-dataset.jsonl')]; print('OK')"
# Doit afficher OK`}</code></pre>
			<p>
				Si la validation échoue, regarde les premières lignes pour repérer
				le problème (souvent un guillemet mal échappé).
			</p>
		</Callout>
	</section>

	<!-- ====================== BIFURCATION — UI vs CODE ====================== -->
	<section id="bifurcation" class="atl-step atl-bifur">
		<header class="atl-step-head">
			<h2>🛤️ Choisis ton chemin pour les étapes 4 à 7</h2>
		</header>
		<p>
			Les étapes <strong>charger le modèle, configurer LoRA, formater le
				dataset, entraîner, tester</strong> peuvent se faire de deux
			manières dans Unsloth Studio. Tu peux choisir, ou faire les deux pour
			comparer.
		</p>

		<div class="atl-paths">
			<a href="#path-a-ui" class="atl-path atl-path-ui">
				<div class="atl-path-emoji">🎨</div>
				<div class="atl-path-title">Path A — UI no-code</div>
				<div class="atl-path-sub">Recommandé pour démarrer.<br />Tu cliques, tu remplis, ça tourne.</div>
				<ul class="atl-path-pros">
					<li>✅ Zéro Python</li>
					<li>✅ Visualisation directe</li>
					<li>✅ Itération rapide</li>
				</ul>
				<ul class="atl-path-cons">
					<li>⚠️ Moins de contrôle fin</li>
					<li>⚠️ Pas reproductible en git</li>
				</ul>
			</a>
			<a href="#step4" class="atl-path atl-path-code">
				<div class="atl-path-emoji">🐍</div>
				<div class="atl-path-title">Path B — Notebook code</div>
				<div class="atl-path-sub">Pour creuser, automatiser, versionner.<br />Tu copies-colles des cellules Python.</div>
				<ul class="atl-path-pros">
					<li>✅ Contrôle total</li>
					<li>✅ Versionnable / reproductible</li>
					<li>✅ Tu apprends ce qui se passe</li>
				</ul>
				<ul class="atl-path-cons">
					<li>⚠️ Un peu de Python</li>
					<li>⚠️ Plus verbeux</li>
				</ul>
			</a>
		</div>

		<Callout variant="insight" title="🎓 Recommandation pour un débutant">
			<p>
				<strong>Fais Path A en premier.</strong> Tu vas voir tout de suite
				si Mistral 7B + ton dataset = un modèle qui marche. Une fois que
				c'est bon, refais en Path B sur un autre cas — tu comprendras
				exactement ce qui se passe sous le capot, et tu pourras
				industrialiser dans un script ou un pipeline CI.
			</p>
		</Callout>
	</section>

	<!-- ====================== PATH A — UI STUDIO ====================== -->
	<section id="path-a-ui" class="atl-step atl-pathA">
		<header class="atl-step-head">
			<span class="atl-step-num">Path A — UI</span>
			<h2>🎨 Avec l'interface Unsloth Studio</h2>
		</header>
		<p>
			Si ton Studio expose une UI graphique, tu n'as pas une ligne de
			Python à écrire. Tu navigues à travers 6 écrans, et tu obtiens un
			modèle entraîné prêt à exporter. Le flux conceptuel est universel —
			si l'UI exacte de ta version diffère, mappe les concepts ci-dessous
			aux écrans réels.
		</p>

		<Callout variant="note" title="📌 Note d'honnêteté">
			<p>
				L'UI Unsloth Studio évolue rapidement. Je décris le
				<strong>flux conceptuel</strong> typique qu'on retrouve dans
				toutes les UIs de fine-tuning (Studio, Axolotl Web, AnyScale,
				Together AI). Les libellés exacts des boutons peuvent différer
				dans ta version. Si quelque chose ne correspond pas, prends le
				concept (« je dois maintenant choisir le modèle ») et trouve son
				équivalent dans ton interface.
			</p>
		</Callout>

		<!-- ============== Écran 1 ============== -->
		<div class="atl-screen">
			<div class="atl-screen-num">A.1</div>
			<div class="atl-screen-body">
				<h3>📦 Choisir le modèle de base</h3>
				<p>
					Dans le panneau « New Training » (ou « New Project »), tu vois
					une liste ou une recherche de modèles. Tape <strong>mistral</strong>
					pour filtrer.
				</p>
				<div class="atl-screen-action">
					<strong>Configuration à choisir :</strong>
					<ul>
						<li><strong>Modèle</strong> : <code>unsloth/mistral-7b-instruct-v0.3-bnb-4bit</code></li>
						<li><strong>Variant</strong> : <strong>4-bit</strong> (déjà quantisé, plus rapide à charger)</li>
						<li><strong>Max sequence length</strong> : 4096</li>
					</ul>
				</div>
				<div class="atl-screen-tip">
					💡 L'UI affiche les métadonnées (taille, licence Apache 2.0, langue
					principale). Vérifie que tu as bien sélectionné Mistral 7B v0.3 et
					non v0.1.
				</div>
			</div>
		</div>

		<!-- ============== Écran 2 ============== -->
		<div class="atl-screen">
			<div class="atl-screen-num">A.2</div>
			<div class="atl-screen-body">
				<h3>📁 Uploader ton dataset</h3>
				<p>
					Une zone de drag-and-drop. Dépose ton fichier
					<code>mon-dataset.jsonl</code>. L'UI parse et affiche un
					<strong>aperçu</strong> (5 à 10 premières paires).
				</p>
				<div class="atl-screen-action">
					<strong>Vérifications visuelles à faire ABSOLUMENT :</strong>
					<ul>
						<li>Les 3 colonnes <code>instruction</code> / <code>input</code> / <code>output</code> sont reconnues.</li>
						<li>L'aperçu montre un exemple complet (pas tronqué).</li>
						<li>Si l'UI propose un choix de format, sélectionne <strong>Alpaca</strong>.</li>
						<li>Si l'UI propose un chat template, choisis <strong>Mistral</strong>.</li>
					</ul>
				</div>
				<div class="atl-screen-tip">
					💡 La plupart des UIs incluent un bouton « Preview formatted ». Clique-le —
					tu dois voir les balises <code>[INST]...[/INST]</code> dans la prévisualisation. Si tu vois autre chose, le chat template
					n'est pas le bon.
				</div>
			</div>
		</div>

		<!-- ============== Écran 3 ============== -->
		<div class="atl-screen">
			<div class="atl-screen-num">A.3</div>
			<div class="atl-screen-body">
				<h3>🎓 Choisir la méthode</h3>
				<p>
					Un menu radio ou liste déroulante. Choisis
					<strong>SFT</strong> (Supervised Fine-Tuning).
				</p>
				<div class="atl-screen-action">
					<strong>Quand choisir autre chose :</strong>
					<ul>
						<li><strong>DPO</strong> : si ton dataset a des paires (préférée, rejetée).</li>
						<li><strong>ORPO</strong> : si tu veux SFT et alignement préférentiel d'un coup.</li>
						<li><strong>KTO</strong> : si tu as des feedbacks unitaires « bon / mauvais ».</li>
						<li><strong>Continued Pretraining</strong> : si ton dataset est du texte brut sans format Q-R.</li>
					</ul>
					<p>Pour ton cas (dataset Alpaca de Q-R), <strong>SFT</strong> est la bonne réponse.</p>
				</div>
			</div>
		</div>

		<!-- ============== Écran 4 ============== -->
		<div class="atl-screen">
			<div class="atl-screen-num">A.4</div>
			<div class="atl-screen-body">
				<h3>🎚️ Hyperparamètres</h3>
				<p>
					Un formulaire. Les valeurs par défaut sont déjà bonnes, mais
					voici exactement ce que tu veux :
				</p>
				<table class="atl-screen-table">
					<thead><tr><th>Champ</th><th>Valeur</th><th>Pourquoi</th></tr></thead>
					<tbody>
						<tr><td>Learning rate</td><td><code>2e-4</code></td><td>Standard QLoRA. Rare de devoir changer.</td></tr>
						<tr><td>Epochs</td><td><code>2</code></td><td>~80 ex × 2 passes = bon démarrage.</td></tr>
						<tr><td>Per device batch size</td><td><code>4</code></td><td>Confortable pour la RTX 5000.</td></tr>
						<tr><td>Gradient accumulation</td><td><code>4</code></td><td>Batch effectif = 4 × 4 = 16.</td></tr>
						<tr><td>Warmup ratio</td><td><code>0.05</code></td><td>5 % en warmup, évite les explosions.</td></tr>
						<tr><td>LR scheduler</td><td><code>cosine</code></td><td>Atterrissage doux.</td></tr>
						<tr><td>Optimizer</td><td><code>adamw_8bit</code></td><td>Économise la VRAM.</td></tr>
						<tr><td>Weight decay</td><td><code>0.01</code></td><td>Régularisation classique.</td></tr>
						<tr><td>LoRA rank (r)</td><td><code>16</code></td><td>Sweet spot.</td></tr>
						<tr><td>LoRA alpha</td><td><code>16</code></td><td>Convention Unsloth = r.</td></tr>
						<tr><td>LoRA dropout</td><td><code>0</code></td><td>Toujours 0 avec Unsloth.</td></tr>
						<tr><td>Target modules</td><td>tout coché</td><td>q,k,v,o,gate,up,down — meilleurs résultats.</td></tr>
						<tr><td>Seed</td><td><code>42</code></td><td>Reproductibilité.</td></tr>
					</tbody>
				</table>
				<div class="atl-screen-tip">
					💡 Si l'UI a un mode <strong>Avancé</strong>, active-le — c'est
					là que vivent <code>target_modules</code>,
					<code>gradient_checkpointing</code>, et autres options. Sinon, les
					valeurs par défaut Unsloth sont déjà bonnes.
				</div>
			</div>
		</div>

		<!-- ============== Écran 5 ============== -->
		<div class="atl-screen">
			<div class="atl-screen-num">A.5</div>
			<div class="atl-screen-body">
				<h3>🚀 Lancer le training</h3>
				<p>
					Bouton « Start training » / « Launch ». L'UI passe en mode
					monitoring. Tu vois <strong>en temps réel</strong> :
				</p>
				<ul>
					<li><strong>Une courbe de loss</strong> qui descend (ou pas) — l'indicateur principal.</li>
					<li><strong>Une barre de progression</strong> avec ETA.</li>
					<li><strong>VRAM utilisée</strong> (doit rester stable autour de 6-8 Go).</li>
					<li><strong>Logs textuels</strong> avec step, loss, learning rate.</li>
				</ul>
				<div class="atl-screen-tip">
					💡 Compte ~15-20 minutes sur Mistral 7B + RTX 5000 + 80 exemples.
					Pendant que ça tourne, tu peux ouvrir un terminal en parallèle et
					vérifier <code>nvidia-smi</code> — tu verras la GPU à fond.
				</div>
				<div class="atl-screen-action">
					<strong>Ce que tu surveilles :</strong>
					<ul>
						<li>📉 <strong>Loss qui descend</strong> joliment vers 0,5–1,5 → bon signe</li>
						<li>↔️ <strong>Loss plate à 2+</strong> → problème de dataset, arrête et vérifie</li>
						<li>📈 <strong>Loss qui remonte</strong> → overfitting, réduis epochs</li>
						<li>💥 <strong>Loss = NaN</strong> → divise LR par 2 et relance</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- ============== Écran 6 ============== -->
		<div class="atl-screen">
			<div class="atl-screen-num">A.6</div>
			<div class="atl-screen-body">
				<h3>🧪 Tester et exporter</h3>
				<p>
					Une fois le training terminé, l'UI t'ouvre :
				</p>
				<ul>
					<li>
						<strong>Un panneau « Try it » / « Playground »</strong> avec une
						zone de chat. Tape une question, vois la réponse. Compare avec
						les attentes de ton dataset.
					</li>
					<li>
						<strong>Un bouton « Export »</strong> avec choix de format :
						<ul>
							<li><strong>LoRA adapter only</strong> (~100 Mo) — léger, mais nécessite le base à côté.</li>
							<li><strong>Merged HF</strong> (~14 Go) — pour servir avec vLLM, TGI.</li>
							<li><strong>GGUF</strong> (~4,5 Go en q4_k_m) — pour Ollama, llama.cpp local.</li>
						</ul>
					</li>
				</ul>
				<div class="atl-screen-action">
					<strong>Pour notre cas (Ollama local) :</strong>
					<ul>
						<li>Choisis <strong>GGUF</strong>.</li>
						<li>Quantization : <strong>q4_k_m</strong> (recommandé) ou <strong>q5_k_m</strong> si tu as la VRAM.</li>
						<li>Lance la conversion (~5 min).</li>
						<li>Télécharge le <code>.gguf</code> via le file browser de Studio.</li>
					</ul>
				</div>
				<div class="atl-screen-tip">
					💡 Une fois le <code>.gguf</code> téléchargé, tu sautes directement à
					<a href="#step8">l'étape 8 (Ollama)</a> ci-dessous — c'est commun aux
					deux paths.
				</div>
			</div>
		</div>

		<Callout variant="insight" title="✅ Si tu es venu(e) jusque là par l'UI">
			<p>
				Tu as un modèle Mistral 7B fine-tuné, exporté en GGUF, sans
				avoir écrit une ligne de code. Bravo. Direction l'étape 8
				ci-dessous pour le faire tourner dans Ollama.
			</p>
			<p>
				👉 Quand tu te sens à l'aise, refais le même exercice via Path B
				(notebook code) — tu verras EXACTEMENT ce qui se passe sous
				chaque clic, et tu pourras industrialiser ton workflow.
			</p>
		</Callout>
	</section>

	<!-- ====================== PATH B HEADER ====================== -->
	<section class="atl-pathB-intro">
		<header class="atl-step-head">
			<span class="atl-step-num">Path B — Code</span>
			<h2 class="atl-pathB-title">🐍 Avec le notebook (cellules Python)</h2>
		</header>
		<p>
			Si tu préfères voir et contrôler chaque ligne, voici le même flux en
			notebook. Tu vas créer un fichier <code>.ipynb</code> dans Jupyter Lab et
			y coller les cellules ci-dessous une par une.
		</p>
	</section>

	<!-- ====================== STEP 4 ====================== -->
	<section id="step4" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 4</span>
			<h2>📦 Notebook — charger Mistral 7B</h2>
		</header>
		<p>
			Dans Jupyter Lab, crée un nouveau notebook (<em>File → New → Notebook → Python 3</em>).
			Première cellule, optionnelle si Unsloth est déjà dans ton image.
		</p>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Cellule 1 — Installer Unsloth (si nécessaire)</span>
				<button type="button" class="atl-copy" onclick={() => copy(CELL_INSTALL, 'inst')}>
					{copiedId === 'inst' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CELL_INSTALL}</code></pre>
		</div>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Cellule 2 — Charger Mistral 7B en NF4</span>
				<button type="button" class="atl-copy" onclick={() => copy(CELL_LOAD, 'load')}>
					{copiedId === 'load' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CELL_LOAD}</code></pre>
		</div>

		<div class="atl-explain">
			<p><strong>Ce qui se passe :</strong></p>
			<ul>
				<li>
					Le modèle (~5 Go pré-quantisé) est téléchargé depuis HuggingFace
					la première fois (compte sur 1-2 minutes en VM cloud avec bonne
					connexion).
				</li>
				<li>
					Il est chargé en NF4 directement — pas de pic à 14 Go en
					mémoire.
				</li>
				<li>
					<code>max_seq_length=4096</code> : tu peux te permettre 4k tokens
					avec ta VRAM. Si tes exemples sont courts (cas pédagogique),
					tu peux descendre à 2048 pour gagner en vitesse.
				</li>
				<li>
					Sortie attendue : VRAM utilisée ~4-5 Go. Marge énorme.
				</li>
			</ul>
		</div>
	</section>

	<!-- ====================== STEP 5 ====================== -->
	<section id="step5" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 5</span>
			<h2>🔧 Notebook — LoRA + format dataset</h2>
		</header>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Cellule 3 — Configuration LoRA</span>
				<button type="button" class="atl-copy" onclick={() => copy(CELL_LORA, 'lora')}>
					{copiedId === 'lora' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CELL_LORA}</code></pre>
		</div>

		<div class="atl-explain">
			<p>
				La sortie de <code>print_trainable_parameters()</code> est très
				instructive : tu vas entraîner ~42 millions de paramètres sur
				7,6 milliards, soit <strong>0,55 %</strong>. Voilà le ratio LoRA :
				tu n'apprends que la fraction qui change, le reste reste figé.
			</p>
		</div>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Cellule 4 — Charger et formater le dataset</span>
				<button type="button" class="atl-copy" onclick={() => copy(CELL_DATA, 'data')}>
					{copiedId === 'data' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CELL_DATA}</code></pre>
		</div>

		<Callout variant="insight" title="🎯 Le moment crucial — vérifie le format !">
			<p>
				Le <code>print(dataset[0]["text"])</code> à la fin de la cellule 4
				est <strong>obligatoire</strong>. Tu DOIS regarder visuellement à
				quoi ressemble un exemple formaté. Tu dois voir :
			</p>
			<ul>
				<li><code>[INST]</code> en début de chaque tour user</li>
				<li><code>[/INST]</code> avant la réponse assistant</li>
				<li>Les balises <code>&lt;s&gt;</code> et <code>&lt;/s&gt;</code> de Mistral</li>
				<li>Tes textes complets, pas tronqués</li>
			</ul>
			<p>
				Si ce n'est pas le cas, RIEN ne sert de lancer le training. Reviens
				vérifier ton dataset ou le chat template.
			</p>
		</Callout>
	</section>

	<!-- ====================== STEP 6 ====================== -->
	<section id="step6" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 6</span>
			<h2>🚀 Lancer le training</h2>
		</header>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Cellule 5 — Configuration et lancement</span>
				<button type="button" class="atl-copy" onclick={() => copy(CELL_TRAIN, 'train')}>
					{copiedId === 'train' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CELL_TRAIN}</code></pre>
		</div>

		<div class="atl-explain">
			<p>
				Tu vas voir Unsloth afficher quelque chose comme ça à chaque step :
			</p>
			<pre class="atl-pre atl-pre-output"><code>{`Step  1 | loss 2.412 | lr 2.0e-5  | gpu_mem 6.8 GB
Step  5 | loss 1.943 | lr 1.0e-4  | gpu_mem 6.8 GB
Step 10 | loss 1.534 | lr 2.0e-4  | gpu_mem 6.8 GB
Step 20 | loss 1.187 | lr 1.95e-4 | gpu_mem 6.8 GB
Step 40 | loss 0.892 | lr 1.40e-4 | gpu_mem 6.8 GB
Step 60 | loss 0.731 | lr 0.50e-4 | gpu_mem 6.8 GB
✅ Training completed in 18m 24s`}</code></pre>
			<p>
				Avec un dataset de 80 exemples × 2 epochs, à batch effectif 16, tu
				as ~10 steps par epoch — donc ~20 steps au total. Avec warmup et
				cooldown, ~25-30 steps. Compte ~10-15 min sur RTX 5000.
			</p>
		</div>

		<Callout variant="insight" title="📊 Ce que tu surveilles">
			<ul>
				<li><strong>loss</strong> : doit descendre vers 0,5-1,5 en fin. Si elle reste à 2+, problème de dataset.</li>
				<li><strong>gpu_mem</strong> : doit rester stable. Si elle grimpe lentement, fuite mémoire (rare avec Unsloth).</li>
				<li><strong>lr</strong> : suit le scheduler cosine — descente progressive vers 0.</li>
			</ul>
		</Callout>

		<Callout variant="warning" title="⚠️ Si ça plante avec OOM (Out Of Memory)">
			<p>
				Très peu probable sur RTX 5000 32 Go pour Mistral 7B en QLoRA, mais
				si ça arrive :
			</p>
			<ul>
				<li>Réduis <code>per_device_train_batch_size</code> à 2 ou 1.</li>
				<li>Réduis <code>max_seq_length</code> à 2048.</li>
				<li>Compense par <code>gradient_accumulation_steps</code> plus grand.</li>
			</ul>
		</Callout>
	</section>

	<!-- ====================== STEP 7 ====================== -->
	<section id="step7" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 7</span>
			<h2>🧪 Tester ton modèle</h2>
		</header>
		<p>
			Le moment de vérité. On teste sur 3 types de questions pour bien
			calibrer ce qu'on a obtenu.
		</p>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Cellule 6 — Helper d'inférence + tests</span>
				<button type="button" class="atl-copy" onclick={() => copy(CELL_INFER, 'infer')}>
					{copiedId === 'infer' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CELL_INFER}</code></pre>
		</div>

		<div class="atl-explain">
			<p><strong>Ce que tu attends :</strong></p>
			<ul>
				<li>
					<strong>Q1 (du dataset)</strong> : la réponse doit ressembler à
					ce que tu as fourni dans le dataset (style, ton, structure).
					C'est de la mémorisation partielle, normal.
				</li>
				<li>
					<strong>Q2 (proche mais nouveau)</strong> : test de
					généralisation. Si tu n'as pas mis « adapter » dans le dataset,
					mais des concepts proches, le modèle doit produire une réponse
					avec le même style. C'est <strong>la vraie victoire</strong>.
				</li>
				<li>
					<strong>Q3 (hors-sujet)</strong> : le modèle doit pouvoir
					répondre normalement sur autre chose. S'il refuse / déraille /
					met une analogie absurde sur une recette de tarte, c'est de
					l'overfitting. Réduire le nombre d'epochs ou de steps.
				</li>
			</ul>
		</div>
	</section>

	<!-- ====================== STEP 8 ====================== -->
	<section id="step8" class="atl-step">
		<header class="atl-step-head">
			<span class="atl-step-num">Étape 8</span>
			<h2>💾 Export GGUF + Ollama local</h2>
		</header>
		<p>
			Maintenant on exporte le modèle pour le faire tourner sur ta machine
			locale (qui n'a pas besoin de Python ou Unsloth — juste Ollama).
		</p>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Cellule 7 — Export GGUF</span>
				<button type="button" class="atl-copy" onclick={() => copy(CELL_SAVE, 'save')}>
					{copiedId === 'save' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{CELL_SAVE}</code></pre>
		</div>

		<div class="atl-explain">
			<p>
				Cette cellule prend ~5 minutes : Unsloth merge le LoRA dans le
				modèle de base en bf16, puis convertit en GGUF avec llama.cpp en
				interne, puis quantise en q4_k_m. Tu obtiens un fichier <code>.gguf</code> de
				~4,5 Go.
			</p>
			<p>
				Récupère ce fichier sur ta machine locale (scp, rsync, ou le file
				browser de Jupyter Lab pour télécharger).
			</p>
		</div>

		<h3 class="atl-h3">Sur ta machine locale, avec Ollama</h3>
		<div class="atl-substeps">
			<div class="atl-substep"><strong>8.1</strong> Installe Ollama si pas fait : <a href="https://ollama.com" target="_blank" rel="noopener">ollama.com</a></div>
			<div class="atl-substep"><strong>8.2</strong> Place le <code>.gguf</code> dans un dossier, à côté d'un fichier <code>Modelfile</code> :</div>
		</div>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Modelfile</span>
				<button type="button" class="atl-copy" onclick={() => copy(OLLAMA_MODELFILE, 'mf')}>
					{copiedId === 'mf' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{OLLAMA_MODELFILE}</code></pre>
		</div>

		<div class="atl-codeblock">
			<div class="atl-codeblock-head">
				<span>Commandes Ollama</span>
				<button type="button" class="atl-copy" onclick={() => copy(OLLAMA_RUN, 'run')}>
					{copiedId === 'run' ? '✓ Copié' : '📋 Copier'}
				</button>
			</div>
			<pre class="atl-pre"><code>{OLLAMA_RUN}</code></pre>
		</div>

		<Callout variant="insight" title="🎉 C'est bouclé">
			<p>
				Tu viens de fine-tuner Mistral 7B, l'exporter en GGUF, et le faire
				tourner localement dans Ollama. Tu peux maintenant l'interroger
				sans Internet, sur ta machine. C'est exactement le pattern de ton
				projet souverain défense — à part qu'on n'a pas (encore) ajouté
				le RAG, les guardrails et l'air-gap.
			</p>
		</Callout>
	</section>

	<!-- ====================== TROUBLESHOOTING ====================== -->
	<section id="trouble" class="atl-step atl-trouble">
		<header class="atl-step-head">
			<h2>🆘 Troubleshooting — les pannes courantes</h2>
		</header>
		<div class="atl-trouble-list">
			<details class="atl-tr-item">
				<summary><strong>OOM (CUDA out of memory)</strong> au chargement</summary>
				<div class="atl-tr-body">
					<p>Cause typique : un autre processus utilise la VRAM.</p>
					<ul>
						<li><code>nvidia-smi</code> pour voir les processus actifs.</li>
						<li>Tue le notebook précédent (Kernel → Restart).</li>
						<li>Ou redémarre le conteneur Docker.</li>
					</ul>
				</div>
			</details>
			<details class="atl-tr-item">
				<summary><strong>OOM</strong> au milieu du training</summary>
				<div class="atl-tr-body">
					<p>Tu as un long exemple qui crève la VRAM.</p>
					<ul>
						<li>Réduis <code>max_seq_length</code> (4096 → 2048).</li>
						<li>Réduis <code>per_device_train_batch_size</code> (4 → 2).</li>
						<li>Vérifie qu'aucun exemple n'est anormalement long dans le dataset.</li>
					</ul>
				</div>
			</details>
			<details class="atl-tr-item">
				<summary><strong>Loss qui ne descend pas</strong> (reste à 2+)</summary>
				<div class="atl-tr-body">
					<p>Quasi-toujours un problème de dataset/format.</p>
					<ul>
						<li>Re-vérifie la sortie de <code>print(dataset[0]["text"])</code>.</li>
						<li>Confirme que le chat template est <code>"mistral"</code> (pas <code>"llama-3"</code>).</li>
						<li>Vérifie que tes exemples sont effectivement intéressants (pas du bruit, pas des répétitions).</li>
					</ul>
				</div>
			</details>
			<details class="atl-tr-item">
				<summary><strong>Loss explose en NaN</strong></summary>
				<div class="atl-tr-body">
					<p>Gradient instable.</p>
					<ul>
						<li>Divise <code>learning_rate</code> par 2 (2e-4 → 1e-4).</li>
						<li>Force <code>bf16=True</code> si ta carte le supporte (Ada le fait).</li>
						<li>Augmente <code>warmup_steps</code> (5 → 20).</li>
					</ul>
				</div>
			</details>
			<details class="atl-tr-item">
				<summary><strong>Le modèle inventé du charabia</strong> à l'inférence</summary>
				<div class="atl-tr-body">
					<p>Souvent un mauvais format de chat template.</p>
					<ul>
						<li>Confirme que c'est bien le model issu de <code>get_peft_model</code> que tu interroges, pas le base.</li>
						<li>Confirme <code>FastLanguageModel.for_inference(model)</code> appelé avant.</li>
						<li>Vérifie que <code>apply_chat_template</code> est utilisé pour formater l'input.</li>
					</ul>
				</div>
			</details>
			<details class="atl-tr-item">
				<summary><strong>Export GGUF échoue</strong></summary>
				<div class="atl-tr-body">
					<p>llama.cpp est utilisé en interne — il peut manquer.</p>
					<ul>
						<li><code>!apt install -y cmake build-essential</code> si requis.</li>
						<li>Pour les modèles très récents, mets à jour Unsloth : <code>!pip install -U unsloth</code>.</li>
					</ul>
				</div>
			</details>
		</div>
	</section>

	<!-- ====================== TRANSFERT ====================== -->
	<section id="transfert" class="atl-step atl-transfer">
		<header class="atl-step-head">
			<h2>🎯 Transférer ce savoir à tes vrais cas</h2>
		</header>
		<p>
			Tu viens de faire le tour complet. Pour <strong>n'importe quel
				autre cas</strong> (agent documentaire défense, juridique,
			médical…), seuls 2 trucs changent.
		</p>
		<div class="atl-transfer-grid">
			<div class="atl-transfer-card">
				<h3>1️⃣ Le dataset</h3>
				<p>
					Tu génères un dataset adapté à ton cas. Pour ton projet
					défense : 200-500 paires d'exemples métier (Q-R sur des
					procédures fictives, des classifications, des refus de
					divulgation), avec <strong>répartition par niveau de
						classification</strong> dans le dataset (NP, DR, CD…).
				</p>
			</div>
			<div class="atl-transfer-card">
				<h3>2️⃣ Le system prompt côté inférence</h3>
				<p>
					Ce que le fine-tuning enseigne, c'est le STYLE. Les règles
					métier (« ne jamais citer un doc &gt; CD ») sont à mettre
					dans le system prompt à l'inférence + dans le code applicatif
					(guardrails). Le pipeline d'entraînement reste le même.
				</p>
			</div>
		</div>

		<Callout variant="note" title="📈 Pour aller plus loin">
			<ul>
				<li><strong>Méthode</strong> : SFT → DPO ou ORPO pour aligner.</li>
				<li><strong>Multi-LoRA</strong> : plusieurs adapters branchés sur le même Mistral, switchables selon le contexte.</li>
				<li><strong>Évaluation</strong> : créer un eval set séparé, mesurer la performance par catégorie.</li>
				<li><strong>Sur la GTX 1070</strong> : tu peux faire tourner ton .gguf en q4_k_m via Ollama (≈ 4,5 Go, juste sur la limite VRAM mais Ollama peut décharger sur CPU si besoin).</li>
			</ul>
		</Callout>
	</section>

	<footer class="atl-footer">
		<a href="/unsloth" class="atl-back-big">📚 Retour au lab d'apprentissage</a>
	</footer>
</article>

<style>
	.atl {
		max-width: 880px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	.atl-hero {
		text-align: center;
		padding: 2rem 1.5rem;
		background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%);
		border-radius: 1.5rem;
		border: 1px solid #86efac;
	}
	.atl-hero-emoji {
		font-size: 4rem;
		display: block;
		margin-bottom: 0.5rem;
	}
	.atl-h1 {
		font-family: var(--font-display);
		font-size: 2.25rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.atl-hero-lead {
		font-size: 1rem;
		color: var(--color-ink-700);
		max-width: 600px;
		margin: 0.75rem auto 1.5rem;
		line-height: 1.55;
	}
	.atl-back,
	.atl-back-big {
		display: inline-block;
		padding: 0.4rem 1rem;
		color: var(--color-ink-700);
		font-size: 0.85rem;
		text-decoration: none;
		border-radius: 999px;
		background: #fff;
		border: 1px solid #e2e8f0;
	}
	.atl-back:hover,
	.atl-back-big:hover {
		border-color: var(--color-hf-amber);
	}
	.atl-back-big {
		padding: 0.7rem 1.5rem;
		font-size: 0.95rem;
	}
	.atl-footer {
		text-align: center;
	}

	.atl-toc {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.25rem 1.5rem;
	}
	.atl-toc-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-ink-500);
		margin: 0 0 0.75rem;
	}
	.atl-toc-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.atl-toc-list a {
		color: var(--color-ink-700);
		text-decoration: none;
		font-size: 0.9rem;
	}
	.atl-toc-list a:hover {
		color: var(--color-hf-amber);
	}
	.atl-toc-total {
		margin: 1rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid #f1f5f9;
		font-size: 0.85rem;
		color: var(--color-ink-700);
	}

	.atl-step {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		scroll-margin-top: 80px;
	}
	.atl-step-head {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.atl-step-num {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-hf-amber);
		font-weight: 600;
	}
	.atl-step h2 {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.atl-h3 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0.75rem 0 0.25rem;
	}
	.atl-step p {
		font-size: 0.95rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		margin: 0;
	}

	.atl-substeps {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.atl-substep {
		padding: 0.5rem 0.85rem;
		background: #f8fafc;
		border-radius: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
	}
	.atl-substep strong {
		color: var(--color-hf-amber);
		margin-right: 0.5rem;
	}

	.atl-codeblock {
		background: #1a1a1a;
		border-radius: 0.6rem;
		overflow: hidden;
	}
	.atl-codeblock-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.85rem;
		background: #2a2a2a;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: #cbd5e1;
		border-bottom: 1px solid #404040;
	}
	.atl-copy {
		background: rgba(255, 157, 0, 0.15);
		color: var(--color-hf-yellow);
		border: 1px solid rgba(255, 157, 0, 0.3);
		border-radius: 0.3rem;
		padding: 0.2rem 0.6rem;
		font-size: 0.7rem;
		cursor: pointer;
		font-family: var(--font-mono);
	}
	.atl-copy:hover {
		background: rgba(255, 157, 0, 0.25);
	}
	.atl-pre {
		margin: 0;
		padding: 1rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		line-height: 1.55;
		color: #e2e8f0;
		overflow-x: auto;
		white-space: pre;
	}
	.atl-pre-output {
		background: #0a0a0a;
	}

	.atl-explain {
		background: #f8fafc;
		border-left: 3px solid var(--color-hf-amber);
		border-radius: 0.4rem;
		padding: 0.85rem 1rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
	}
	.atl-explain p {
		margin: 0 0 0.5rem;
	}
	.atl-explain ul {
		margin: 0.4rem 0 0;
		padding-left: 1.25rem;
	}
	.atl-explain li {
		margin: 0.25rem 0;
		font-size: 0.88rem;
	}

	.atl-grid-3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.6rem;
	}
	.atl-pillar {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem;
		text-align: center;
	}
	.atl-pillar-emoji {
		font-size: 2rem;
	}
	.atl-pillar strong {
		display: block;
		margin: 0.25rem 0;
		color: var(--color-ink-900);
	}
	.atl-pillar p {
		font-size: 0.85rem !important;
		color: var(--color-ink-500) !important;
		margin: 0 !important;
	}

	.atl-trouble {
		background: linear-gradient(180deg, #fef2f2 0%, #fff 100%);
		border-color: #fecaca;
	}
	.atl-trouble-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.atl-tr-item {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.6rem;
		overflow: hidden;
	}
	.atl-tr-item summary {
		cursor: pointer;
		padding: 0.7rem 1rem;
		font-size: 0.92rem;
		color: var(--color-ink-900);
	}
	.atl-tr-body {
		padding: 0 1rem 1rem;
		font-size: 0.88rem;
		color: var(--color-ink-700);
		line-height: 1.55;
	}
	.atl-tr-body p {
		margin: 0 0 0.4rem !important;
	}
	.atl-tr-body ul {
		padding-left: 1.25rem;
		margin: 0;
	}
	.atl-tr-body code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}

	.atl-transfer {
		background: linear-gradient(180deg, var(--color-hf-cream) 0%, #fff 100%);
		border-color: var(--color-hf-amber);
	}
	.atl-transfer-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	@media (max-width: 600px) {
		.atl-transfer-grid {
			grid-template-columns: 1fr;
		}
	}
	.atl-transfer-card {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.atl-transfer-card h3 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--color-ink-900);
	}
	.atl-transfer-card p {
		font-size: 0.88rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0;
	}

	/* ====== Bifurcation UI vs Code ====== */
	.atl-bifur {
		background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
	}
	.atl-paths {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	@media (max-width: 600px) {
		.atl-paths {
			grid-template-columns: 1fr;
		}
	}
	.atl-path {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1.25rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 1rem;
		text-decoration: none;
		color: var(--color-ink-900);
		transition: all 0.2s;
	}
	.atl-path:hover {
		transform: translateY(-2px);
		border-color: var(--color-hf-amber);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
	}
	.atl-path-ui {
		background: linear-gradient(180deg, #faf5ff 0%, #fff 100%);
	}
	.atl-path-ui:hover {
		border-color: #a855f7;
	}
	.atl-path-code {
		background: linear-gradient(180deg, #f0f9ff 0%, #fff 100%);
	}
	.atl-path-code:hover {
		border-color: #3b82f6;
	}
	.atl-path-emoji {
		font-size: 2.5rem;
	}
	.atl-path-title {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
	}
	.atl-path-sub {
		font-size: 0.85rem;
		color: var(--color-ink-700);
		line-height: 1.5;
	}
	.atl-path-pros,
	.atl-path-cons {
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-ink-700);
	}
	.atl-path-pros li,
	.atl-path-cons li {
		padding: 0.15rem 0;
	}

	/* ====== Path A — UI ====== */
	.atl-pathA {
		background: linear-gradient(180deg, #faf5ff 0%, #fff 100%);
		border-color: #d8b4fe;
		border-left: 6px solid #a855f7;
	}
	.atl-screen {
		display: grid;
		grid-template-columns: 60px 1fr;
		gap: 1rem;
		padding: 1rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
	}
	.atl-screen-num {
		font-family: var(--font-mono);
		font-size: 1rem;
		font-weight: 700;
		background: #a855f7;
		color: white;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.atl-screen-body h3 {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-ink-900);
		margin: 0 0 0.4rem;
	}
	.atl-screen-body p {
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin: 0 0 0.5rem !important;
	}
	.atl-screen-action {
		background: #f8fafc;
		border-left: 3px solid #a855f7;
		border-radius: 0.4rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin: 0.5rem 0;
	}
	.atl-screen-action strong {
		color: var(--color-ink-900);
	}
	.atl-screen-action ul {
		margin: 0.35rem 0 0;
		padding-left: 1.2rem;
	}
	.atl-screen-action li {
		margin: 0.2rem 0;
		color: var(--color-ink-700);
		line-height: 1.5;
	}
	.atl-screen-action code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}
	.atl-screen-tip {
		background: #fef3c7;
		border-left: 3px solid #f59e0b;
		border-radius: 0.4rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.83rem;
		color: var(--color-ink-700);
		line-height: 1.55;
		margin-top: 0.5rem;
	}
	.atl-screen-tip code {
		background: #fff;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}
	.atl-screen-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		margin: 0.5rem 0;
	}
	.atl-screen-table thead {
		background: #faf5ff;
	}
	.atl-screen-table th {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-ink-500);
		text-align: left;
		padding: 0.4rem 0.5rem;
	}
	.atl-screen-table td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid #f1f5f9;
		color: var(--color-ink-700);
		vertical-align: top;
	}
	.atl-screen-table td code {
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.95em;
	}

	/* ====== Path B header ====== */
	.atl-pathB-intro {
		padding: 1rem 1.5rem;
		background: linear-gradient(180deg, #f0f9ff 0%, #fff 100%);
		border: 1px solid #bfdbfe;
		border-left: 6px solid #3b82f6;
		border-radius: 0.75rem;
	}
	.atl-pathB-title {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0;
	}
	.atl-pathB-intro p {
		font-size: 0.95rem;
		color: var(--color-ink-700);
		margin: 0.5rem 0 0;
	}

	/* TOC dividers */
	.atl-toc-divider {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-hf-amber);
		text-align: center;
		padding: 0.3rem 0;
		font-weight: 600;
		list-style: none;
	}
</style>
