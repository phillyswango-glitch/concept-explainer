<!--
	RolesExplainer.svelte
	=====================
	Explique les 3 rôles d'une conversation avec un LLM : system, user, assistant.

	Pourquoi après le tour du Transformer ? Parce que ces rôles ne sont PAS
	une propriété de l'architecture — ils sont une convention de formatage
	ajoutée lors du fine-tuning (ChatML, OpenAI format, etc.). Un Transformer
	brut ne connaît que des tokens. La distinction system/user/assistant est
	un contrat de mise en forme apporté par la phase d'alignement.

	On illustre avec une métaphore théâtrale : system = didascalies,
	user = public, assistant = acteur.
-->
<script lang="ts">
	type PersonaId = 'polite' | 'pirate' | 'expert';

	interface Persona {
		id: PersonaId;
		emoji: string;
		label: string;
		system: string;
		reply: string;
	}

	const PERSONAS: Persona[] = [
		{
			id: 'polite',
			emoji: '🎩',
			label: 'Assistant poli',
			system: 'Tu es un assistant poli et courtois. Réponds toujours en français soutenu.',
			reply: 'Bonjour ! Ravi de faire votre connaissance. En quoi puis-je vous être utile ?'
		},
		{
			id: 'pirate',
			emoji: '🏴‍☠️',
			label: 'Pirate des mers',
			system: 'Tu es un vieux pirate. Parle en argot marin, emploie « matelot » et « arrr ».',
			reply: 'Arrr, salut matelot ! Hisse la grand-voile, on va voguer ensemble !'
		},
		{
			id: 'expert',
			emoji: '🔬',
			label: 'Scientifique rigoureux',
			system: 'Tu es un chercheur méthodique. Réponds avec nuance et cite tes incertitudes.',
			reply: "Bonjour. Notons que la salutation appropriée dépend du contexte — à quelle heure de la journée sommes-nous ?"
		}
	];

	let personaId = $state<PersonaId>('polite');
	const persona = $derived(PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]);

	let userMessage = $state('Bonjour !');

	let showDeep = $state(false);
</script>

<section class="roles">
	<header class="roles-header">
		<h2 class="roles-h2">🎭 Les 3 rôles d'une conversation</h2>
		<p class="roles-lead">
			Quand tu discutes avec ChatGPT, Claude ou un Llama fine-tuné, il y a
			<strong>toujours 3 voix</strong> dans la conversation — même si tu n'en
			vois souvent qu'une.
		</p>
	</header>

	<div class="roles-analogy">
		<span class="roles-analogy-emoji">💡</span>
		<div>
			<p>
				Imagine une <strong>pièce de théâtre</strong> :
			</p>
			<ul>
				<li>
					<strong class="roles-tag roles-tag-system">🎬 System</strong> = les
					didascalies du metteur en scène. Elles configurent le personnage en
					coulisses — tu ne les entends pas, mais elles déterminent tout.
				</li>
				<li>
					<strong class="roles-tag roles-tag-user">👤 User</strong> = toi, dans
					le public, qui t'adresses à l'acteur.
				</li>
				<li>
					<strong class="roles-tag roles-tag-assistant">🤖 Assistant</strong> = l'acteur
					sur scène, qui te répond selon son personnage (imposé par les
					didascalies).
				</li>
			</ul>
		</div>
	</div>

	<!-- Sélecteur de persona -->
	<div class="roles-persona-selector">
		<span class="roles-persona-label">Change les didascalies du metteur en scène :</span>
		<div class="roles-persona-chips">
			{#each PERSONAS as p (p.id)}
				<button
					type="button"
					class="roles-persona-chip {personaId === p.id ? 'is-active' : ''}"
					onclick={() => (personaId = p.id)}
				>
					<span aria-hidden="true">{p.emoji}</span>
					{p.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Conversation visualisée avec les 3 bulles colorées -->
	<div class="roles-convo">
		<div class="roles-bubble roles-bubble-system">
			<div class="roles-bubble-head">
				<span class="roles-tag roles-tag-system">🎬 System</span>
				<span class="roles-bubble-hint">(en coulisses)</span>
			</div>
			<div class="roles-bubble-body">{persona.system}</div>
		</div>

		<div class="roles-bubble roles-bubble-user">
			<div class="roles-bubble-head">
				<span class="roles-tag roles-tag-user">👤 User</span>
				<span class="roles-bubble-hint">(toi)</span>
			</div>
			<input
				type="text"
				bind:value={userMessage}
				class="roles-user-input"
				placeholder="Tape un message…"
			/>
		</div>

		<div class="roles-bubble roles-bubble-assistant">
			<div class="roles-bubble-head">
				<span class="roles-tag roles-tag-assistant">🤖 Assistant</span>
				<span class="roles-bubble-hint">(réponse générée selon le persona)</span>
			</div>
			<div class="roles-bubble-body roles-bubble-reply">{persona.reply}</div>
		</div>
	</div>

	<p class="roles-caption">
		👆 Change de persona en haut — le <strong>system</strong> change, le
		<strong>user</strong> reste pareil, l'<strong>assistant</strong> répond tout
		autrement. Ce sont les didascalies qui pilotent le ton.
	</p>

	<!-- Deep-dive technique -->
	<details class="roles-deep" bind:open={showDeep}>
		<summary>🔍 Pour aller plus loin — ce que voit vraiment le modèle</summary>
		<div class="roles-deep-body">
			<p>
				<strong>Un Transformer brut ne connaît pas ces rôles.</strong> Il ne
				connaît que des <strong>tokens</strong>. Les rôles sont introduits par
				un format de texte injecté avant chaque échange. Le format le plus
				répandu aujourd'hui s'appelle <strong>ChatML</strong> (utilisé par
				GPT, Llama, Mistral, Claude…) :
			</p>
			<pre class="roles-code"><code>&lt;|im_start|&gt;system
{persona.system}&lt;|im_end|&gt;
&lt;|im_start|&gt;user
{userMessage}&lt;|im_end|&gt;
&lt;|im_start|&gt;assistant
{persona.reply}&lt;|im_end|&gt;</code></pre>
			<p>
				Les balises <code>&lt;|im_start|&gt;</code>,
				<code>&lt;|im_end|&gt;</code> sont des tokens spéciaux du vocabulaire
				du modèle. À l'entraînement, on a appris au modèle que « ce qui suit
				<code>system</code> » est une instruction de comportement, et « ce qui
				suit <code>assistant</code> » est ce qu'il doit produire.
			</p>
			<p class="roles-deep-note">
				💡 Dans le cadre de ton projet souverain d'agent documentaire, le
				<strong>system prompt</strong> portera des consignes critiques :
				habilitation de l'utilisateur, niveau de classification maximum
				autorisé, règles de refus, format attendu. C'est une ligne de défense
				en soi — toute la logique de guardrail s'y appuie.
			</p>
		</div>
	</details>
</section>

<style>
	.roles {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 2rem;
		background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
		border: 1px solid #e2e8f0;
		border-radius: 1.5rem;
	}
	.roles-header {
		text-align: center;
	}
	.roles-h2 {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-ink-900);
		margin: 0 0 0.5rem;
	}
	.roles-lead {
		color: var(--color-ink-700);
		font-size: 1rem;
		line-height: 1.55;
		margin: 0;
	}
	.roles-analogy {
		display: flex;
		gap: 1rem;
		background: var(--color-hf-cream);
		border-left: 4px solid var(--color-hf-amber);
		border-radius: 0.75rem;
		padding: 1.1rem 1.25rem;
	}
	.roles-analogy-emoji {
		font-size: 1.75rem;
		flex-shrink: 0;
	}
	.roles-analogy p {
		margin: 0 0 0.6rem;
		font-size: 0.95rem;
		color: var(--color-ink-900);
		line-height: 1.55;
	}
	.roles-analogy ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.roles-analogy li {
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.55;
	}

	.roles-tag {
		display: inline-block;
		padding: 0.15rem 0.55rem;
		border-radius: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 600;
		margin-right: 0.4rem;
	}
	.roles-tag-system {
		background: #dbeafe;
		color: #1e40af;
	}
	.roles-tag-user {
		background: #dcfce7;
		color: #166534;
	}
	.roles-tag-assistant {
		background: var(--color-hf-cream);
		color: #92400e;
	}

	/* Sélecteur de persona */
	.roles-persona-selector {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}
	.roles-persona-label {
		font-size: 0.85rem;
		color: var(--color-ink-700);
	}
	.roles-persona-chips {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}
	.roles-persona-chip {
		padding: 0.5rem 1rem;
		background: #fff;
		border: 2px solid #e2e8f0;
		border-radius: 999px;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		cursor: pointer;
		transition: all 0.15s;
	}
	.roles-persona-chip:hover {
		border-color: var(--color-hf-amber);
	}
	.roles-persona-chip.is-active {
		background: var(--color-hf-yellow);
		border-color: var(--color-hf-amber);
		color: var(--color-ink-900);
		font-weight: 600;
	}

	/* Bulles de conversation */
	.roles-convo {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.roles-bubble {
		padding: 1rem 1.2rem;
		border-radius: 1rem;
		border-left: 4px solid;
	}
	.roles-bubble-system {
		background: #eff6ff;
		border-left-color: #3b82f6;
	}
	.roles-bubble-user {
		background: #f0fdf4;
		border-left-color: #22c55e;
		margin-left: 0;
	}
	.roles-bubble-assistant {
		background: #fffbeb;
		border-left-color: #f59e0b;
	}
	.roles-bubble-head {
		display: flex;
		align-items: center;
		margin-bottom: 0.4rem;
	}
	.roles-bubble-hint {
		font-size: 0.75rem;
		color: var(--color-ink-500);
		font-style: italic;
	}
	.roles-bubble-body {
		color: var(--color-ink-900);
		font-size: 0.95rem;
		line-height: 1.55;
	}
	.roles-bubble-reply {
		font-style: italic;
	}
	.roles-user-input {
		width: 100%;
		font-size: 0.95rem;
		padding: 0.5rem 0.8rem;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
	}
	.roles-user-input:focus {
		outline: none;
		border-color: #22c55e;
	}

	.roles-caption {
		color: var(--color-ink-700);
		font-size: 0.9rem;
		line-height: 1.55;
		margin: 0;
		text-align: center;
	}

	/* Deep-dive */
	.roles-deep {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		overflow: hidden;
	}
	.roles-deep summary {
		cursor: pointer;
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		font-weight: 500;
		list-style: none;
	}
	.roles-deep summary::-webkit-details-marker {
		display: none;
	}
	.roles-deep summary::before {
		content: '▶';
		display: inline-block;
		margin-right: 0.5rem;
		color: var(--color-ink-500);
		transition: transform 0.15s;
	}
	.roles-deep[open] summary::before {
		transform: rotate(90deg);
	}
	.roles-deep[open] summary {
		border-bottom: 1px solid #e2e8f0;
	}
	.roles-deep-body {
		padding: 1rem;
		font-size: 0.9rem;
		color: var(--color-ink-700);
		line-height: 1.6;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.roles-code {
		background: #1a1a1a;
		color: #e2e8f0;
		padding: 1rem;
		border-radius: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		line-height: 1.6;
		overflow-x: auto;
		margin: 0;
	}
	.roles-deep-note {
		background: var(--color-hf-cream);
		border-left: 3px solid var(--color-hf-amber);
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		margin: 0;
	}
</style>
