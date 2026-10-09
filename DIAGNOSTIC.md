# DIAGNOSTIC — salles-api, version Claude Code

Le TP refait entièrement sous **Claude Code 2.1.295** au lieu d'OpenCode.

| Branche | Contenu |
|---|---|
| `main` | le dépôt d'origine (chaîne OpenCode, non touchée) |
| `claude-code/avant` | la chaîne **migrée telle quelle** vers Claude Code : prompts identiques, tables de droits recopiées |
| `claude-code/apres` | la même chaîne **réparée**, avec le code, les tests, le lint, les hooks et la CI réparés |

Toutes les preuves sont des **sessions Claude Code réelles** (`claude -p`, sortie
`stream-json`) ou des commandes réellement lancées, rendues en captures dans
[`captures/`](captures/). `cc*` désigne les captures propres à Claude Code. `code-*`
désigne les captures du code, qui ne dépendent pas de l'outil d'agents : le code de
`claude-code/avant` est celui de `main`, celui de `claude-code/apres` est le code réparé.

## En une minute

Migrée telle quelle, la chaîne travaille mal sous Claude Code aussi. Sur la tâche de
l'exercice 1, l'architecte fait tout seul en 6 tours :
- **zéro délégation** ;
- **zéro relecture** ;
- un hook post-écriture **jamais déclenché** ;
- un « lint, types et tests passent » qui n'est vrai que parce que le filet est aveugle.

Réparée et relancée dans une session neuve, elle enchaîne `explorer` → `planner` →
`dev` ×3 → `npm run check` → `reviewer`. Le hook se déclenche 14 fois et le code livré
tient un score de mutation de 98 %.

| Exercice 1 (même tâche, même modèle) | AVANT | APRÈS |
|---|---|---|
| Agents réellement appelés | architect seul | explorer, planner, dev ×3, reviewer |
| Hook post-écriture déclenché | **0 fois** (écritures par heredoc Bash) | 14 fois, sortie visible par l'agent |
| Tests lancés / présents | 15 / 28 : 2 fichiers ignorés, **rouges** | 129 / 130, tous lancés |
| `npm run check` sur le résultat | n'existe pas ; le code ne passe pas le lint réparé (`as any`) | vert, couverture 100 % lignes |
| Score de mutation | — | 98,44 % |
| Durée / coût | 70 s / 0,29 $ | 667 s / 0,84 $ |

Captures : [cc00](captures/cc00-ex1-avant-session.png), [cc01](captures/cc01-ex1-avant-etat.png), [cc11](captures/cc11-ex1-apres-session.png), [cc12](captures/cc12-ex1-apres-etat.png).

---

## 0. La migration : ce qui se traduit, ce qui disparaît, ce qui apparaît

Correspondance OpenCode → Claude Code utilisée pour la branche `claude-code/avant` :

| OpenCode | Claude Code | Remarque |
|---|---|---|
| `AGENTS.md` | `AGENTS.md` | Lu nativement (v2.1.277 et plus), ainsi que `src/lib/AGENTS.md` à la demande |
| `.opencode/agent/*.md` | `.claude/agents/*.md` | Prompts identiques. `deepseek-v4-pro` → `sonnet`, `flash` → `haiku`. `temperature` n'existe pas |
| `default_agent: architect` | `"agent": "architect"` dans `.claude/settings.json` | |
| `mode: primary` | — | Pas d'équivalent : tout fichier de `.claude/agents/` est un subagent joignable |
| `permission:` par agent | `.claude/permissions.json` (tables recopiées) + hook PreToolUse `.claude/hooks/permissions.mjs` | Claude Code n'a pas de droits Bash par motif **par agent**. L'adaptateur applique les tables avec la sémantique d'OpenCode : défauts d'OpenCode, puis **dernière règle qui matche gagne**, une commande composée évaluée commande par commande |
| plugin `tool.execute.after` | hook `PostToolUse` `Edit\|Write\|MultiEdit` → `bash scripts/checks.sh` | |
| `.opencode/command/ship.md` | `.claude/commands/ship.md` | |
| `opencode.json` `mcp` | `.mcp.json` | |

Ce que la traduction change :

| Défaut d'OpenCode | Sous Claude Code | Preuve |
|---|---|---|
| `finder` : `"*": deny` en dernier, plus aucun outil | **Persiste** : l'adaptateur garde « dernière règle gagne ». Le `finder` se voit refuser Read, Grep et Bash, puis répond « not found » sans avoir rien lu | [cc02](captures/cc02-finder-avant.png) |
| `planner` en `mode: primary`, injoignable | **Disparaît** : la notion n'existe pas dans Claude Code | [cc11](captures/cc11-ex1-apres-session.png) (appelé) |
| `${SALLES_MCP_TOKEN}` non substitué | **Disparaît** : Claude Code comprend `${VAR}`. Il reste que la variable n'est pas définie (`Missing environment variables`) | [cc09](captures/cc09-mcp.png) |
| Coût en contexte des MCP | **Atténué** : 75 outils, 45 k tokens de schémas, mais chargés en différé (tool search) | [cc09](captures/cc09-mcp.png) |
| Hook post-écriture « l'agent voit le rouge » | **S'aggrave** : sous Claude Code, la sortie d'un hook qui sort en 0 va au journal de debug et n'est **pas montrée à l'agent** | [cc03](captures/cc03-hook-avant.png) |
| — | **Nouveau** : les fichiers écrits par heredoc dans Bash (`cat > f <<EOF`) ne passent pas par Edit/Write, donc **aucun** hook post-écriture | [cc01](captures/cc01-ex1-avant-etat.png) |
| — | **Nouveau** : les serveurs de `.mcp.json` restent `⏸ Pending approval` dans un dossier non approuvé ; `enableAllProjectMcpServers` y est ignoré | [cc09](captures/cc09-mcp.png) |

Deux défauts de **ma propre traduction** ont été trouvés en la faisant tourner, et
corrigés sur les deux branches (commits `chore(migration)`) :
- **Ligne composée :** l'adaptateur évaluait la ligne entière. `ls src; grep …`
  passait donc grâce à `ls*`, alors qu'OpenCode évalue chaque commande.
- **Redirections :** il coupait `2>&1` en deux commandes.

## 1. Les rules

`AGENTS.md` ment sur le dépôt, comme dans la version OpenCode :
- **Scripts :** `npm test` et `npm run build` n'existent pas ([code-01](captures/code-01-tests-config-before.png)).
- **Convention `Result` :** AGENTS.md la présente comme en vigueur depuis mars, alors
  que le code n'a jamais été migré.
- **Dates ISO UTC :** la règle n'est pas appliquée.

Sous Claude Code, l'architecte de la session AVANT le remarque lui-même dans son compte
rendu (« `npm test` n'existe pas »), mais ne corrige rien ([cc00](captures/cc00-ex1-avant-session.png)).

Constat supplémentaire en APRÈS : la chaîne bute sur la règle de chemin
`src/lib/AGENTS.md` (« pas de JSDoc »), qui contredit la règle 1 de la racine. Le
`reviewer` d'AVANT a même ajouté une JSDoc en invoquant la règle racine
([cc06](captures/cc06-reviewer-avant-edite.png)). La règle locale est **délibérée** et je
ne la change pas. J'ajoute seulement à AGENTS.md qu'un AGENTS.md de sous-dossier prime
sur la racine.

Réparation : AGENTS.md dit la vérité (`npm test`, `npm run check`, plus de `build`),
le code passe au `Result`, et les dates ISO UTC sont validées strictement.

## 2. Les subagents et les droits

Les droits effectifs, calculés par le hook à partir des tables, sont dans
[cc10](captures/cc10-droits-avant.png) (AVANT) et [cc10b](captures/cc10b-droits-apres.png) (APRÈS).

| # | Symptôme (session réelle) | Cause | Réparation |
|---|---|---|---|
| A1 | `finder` : tous ses outils sont refusés, il répond sans avoir lu ([cc02](captures/cc02-finder-avant.png)) | `"*": deny` placé en dernier dans la table | `"*"` en tête, rôle « localiser » seulement ; outils natifs `tools: Read, Glob, Grep` |
| A2 | L'architecte, censé ne jamais coder, **fait tout lui-même** : il lit avec `cat` et écrit par heredoc ; zéro délégation, zéro relecture ([cc00](captures/cc00-ex1-avant-session.png)) | `edit: allow`, `bash "*": allow` (commit `865177b`), et le prompt « use whichever is faster » avec la règle inversée | droits d'origine (git en lecture, `npm run check`, `git add/commit/push` en `ask`), règle remise à l'endroit, `tester` ajouté à l'équipe |
| A3 | Le `reviewer` **modifie le code qu'il relit**. Au run 1, il ajoute une JSDoc qui viole la règle de chemin de `src/lib/` ([cc06](captures/cc06-reviewer-avant-edite.png)). Au run 2, il ne peut lancer **aucun** check et rend `NOTHING FOUND` ([cc07](captures/cc07-reviewer-avant-aveugle.png)) | `edit: allow` + « Fix what you find » ; Bash limité à git | `edit: deny` (et `tools:` sans Edit), il peut lancer `npm run check`. Résultat : `BLOCKING` démontré sur le code d'AVANT, `npm run lint` en erreur sur `as any` ([cc13](captures/cc13-reviewer-apres.png)) |
| A4 | `dev` peut lancer d'autres `dev` (`Agent(dev)` = allow, [cc10](captures/cc10-droits-avant.png)) | `task: allow` et le prompt « split it and send the parts » | `task: deny`, pas d'`Agent` dans `tools:`, contrat de retour |
| A5 | `.env` lu et rendu : l'architecte donne le mot de passe de la base et `SESSION_SECRET` ; `cat .env` réussit pour `dev` ([cc05](captures/cc05-env-avant.png), valeurs masquées dans la capture) | `read: allow` après les défauts `*.env: ask` ; `bash "*": allow` | `read` : `*.env` deny dans les tables, **et** `Read(./.env)` en deny natif dans `settings.json`. Le refus du Read est prouvé ([cc15](captures/cc15-env-apres.png)) ; d'après la doc, la règle native couvre aussi `cat` dans Bash |
| A6 | `explorer` (rôle de lecture) peut éditer partout et faire `curl` | table | `edit` limité à `.opencode/plans/*-notes.md`, `curl` retiré |

## 3. La command `/ship`

AVANT ([cc08](captures/cc08-ship-avant.png)), sur `main`, avec un dépôt distant de
test, `/ship` a fait `git add -A`, un commit et un **push**, avec **0 check lancé** et
sans relecture. Ce qui est arrivé sur le dépôt distant :
- le code du commit ne passe pas le lint réparé ([cc13](captures/cc13-reviewer-apres.png)) ;
- `.env`, déjà versionné, part avec le reste.

Le modèle a de lui-même évité `main` en créant une branche. La commande, elle, ne le
demandait pas.

APRÈS ([cc14](captures/cc14-ship-apres.png)) : `/ship` s'arrête à l'étape 1 parce que la
branche est `main`. Sinon, il enchaîne `npm run check` → `reviewer` → `git add` fichier
par fichier → commit → demande d'accord avant le push.

Pas de skills : leur absence se défend.

## 4. Les MCP

Constat ([cc09](captures/cc09-mcp.png)) :
- **Déclarés :** 6 serveurs.
- **Répondent :** 3 dans la session (github, notion, playwright).
- **Échouent :** salles-db (`.lan` interne, et pas de base avant INFRA-140), slack (pas
  de jeton), sentry.
- **Appelés pendant l'exercice 1 : 0.** De toute façon, aucun agent de la chaîne n'y a
  droit : toutes les tables commencent par `"*": deny`.
- **Coût :** 75 outils, 45 k tokens de schémas. Notion seul pèse 31 k : rien dans le
  dépôt ne s'en sert.
- **Paquets :** github et slack sont dépréciés.

Réparation : `.mcp.json` supprimé, `enableAllProjectMcpServers` retiré.

## 5. Les hooks

| # | Symptôme | Cause | Réparation |
|---|---|---|---|
| H1 | Le pre-commit n'est jamais installé : un commit avec du code cassé passe ([code-04](captures/code-04-hooks-lint-before.png)) | pas de husky ni de `prepare` | `husky@9`, `prepare`, `npm run check`. Le même commit est refusé ([code-14](captures/code-14-hooks-lint-after.png)) |
| H2 | Le hook post-écriture tourne, mais **l'agent ne voit rien** ([cc03](captures/cc03-hook-avant.png)) | sortie 0 + stdout : Claude Code ne montre pas cette sortie à l'agent | `.claude/hooks/post-edit-checks.mjs` renvoie la sortie en `additionalContext`. L'agent voit `TS2322` mot pour mot ([cc04](captures/cc04-hook-apres.png)). Il ne bloque toujours pas (INFRA-231 respecté) |
| H3 | Les écritures par heredoc Bash échappent au hook (0 déclenchement dans l'exercice AVANT) | le matcher ne voit que `Edit\|Write` | consigne au `dev` : écrire avec Edit/Write ; + H4 |
| H4 | Rien n'empêche un `dev` de rendre la main au rouge | absence | **barrière `SubagentStop`** (`dev-done-gate.mjs`) : si `npm run check` est rouge, l'arrêt est refusé une fois, avec la sortie. Démontré : `dev` rend la main en disant le check rouge au lieu de se dire fini ([cc16](captures/cc16-gate-apres.png)) |

## 6. Le lint, les types, les tests, la CI

Ces briques ne dépendent pas de l'outil d'agents. Les constats et preuves sont
identiques à la version OpenCode :
- **Lint :** `rules: {}` ([code-04](captures/code-04-hooks-lint-before.png)).
- **Types :** `@ts-nocheck` et `strict: false` ([code-03](captures/code-03-types-before.png)).
- **Tests :** 2 fichiers `*.test.ts` jamais lancés et rouges, des `it.skip` qui cachent
  un bug, des tests vides, un test sur un double ([code-02](captures/code-02-tests-hidden-before.png)).
- **Couverture et mutation :** 21 % de couverture, 4,57 % de score de mutation
  ([code-05](captures/code-05-coverage-mutation-before.png)).
- **CI :** l'étape de tests est commentée.

Réparé de la même façon : lint recommandé, `strict`, fichiers renommés en `*.spec.ts`
(convention INFRA-205 gardée), 72 tests, couverture 100 %, mutation 97,8 %, CI
`check` + `mutation` ([code-11](captures/code-11-tests-after.png), [code-12](captures/code-12-coverage-mutation-after.png), [code-13](captures/code-13-net-after.png)).

Les bugs que le filet réparé attrape, reproduits avec `curl`
([code-09](captures/code-09-api-before.png) → [code-16](captures/code-16-api-after.png)) :

| Bug | Avant | Après |
|---|---|---|
| Réservations bout à bout | 409 | 201 |
| Prix de week-end | `"5020"` (une chaîne) | 70 |
| 30 février | accepté | 400 |
| Dates non UTC | acceptées | 400 |
| JSON invalide | pile d'appel renvoyée en HTML | 400 en JSON |

---

## Délibéré et correct, laissé tel quel

- `scripts/checks.sh` sort toujours en 0 (INFRA-231) : le hook post-écriture avertit, il
  ne bloque pas. Sous Claude Code, il ne bloque toujours pas ; la barrière est ailleurs
  (`SubagentStop`, pre-commit, CI).
- `vitest` ne prend que `*.spec.ts` (INFRA-205) : ce sont les fichiers qui ont été
  renommés.
- Le `it.skip` de l'export legacy reste en skip (fixture absente, INFRA-198).
- `src/store.ts` n'est pas modifié (INFRA-140).
- `src/lib/AGENTS.md` (« pas de JSDoc », `export default`) est une règle de chemin
  voulue.
- `tester` et `dev` gardent `bash "*": allow` : leur rôle l'exige.
- La clé Stripe est étiquetée factice.

## Ce que je n'ai pas corrigé, et pourquoi

- **Secrets dans l'historique Git** (`ecd0790`) : réécrire l'historique est
  irréversible et revient à l'équipe. Il faut faire tourner le mot de passe de recette
  et `SESSION_SECRET`.
- **`curl -d @.env` reste permis à `dev` et `tester`.** La règle native de Claude Code
  couvre `cat`, `head` et les redirections, pas un programme qui lit le fichier
  lui-même. Seul le sandbox de Claude Code ferme vraiment ce trou.
- **Friction des droits étroits.** `explorer`, `planner`, `reviewer` et `architect` se
  voient refuser des tuyaux comme `| head`, `| tail`, `| sort`, et repassent par Read.
  C'est visible dans [cc11](captures/cc11-ex1-apres-session.png). C'est le prix de
  « tout ce qui n'est pas listé est refusé » ; on pourrait autoriser ces commandes en
  lecture seule, ce que je n'ai pas fait.
- **`tester` non appelé dans la session APRÈS finale.** Il l'avait été dans un premier
  passage APRÈS (avec une version antérieure de l'adaptateur), et `dev` a lui-même testé
  la route avec `curl`. L'architecte décide ; je n'ai pas forcé.
- **Le chemin `.opencode/plans/`** est conservé : les prompts le citent, et le renommer
  ne change rien au fonctionnement.
- **Modèles :** `deepseek-v4-*` n'existe pas sous Claude Code. Je les ai remplacés par
  `sonnet` (fort) et `haiku` (rapide), dans la même logique de coût.
- **Variabilité des modèles :** le `reviewer` d'AVANT a modifié le code au run 1, pas au
  run 2. Les deux sessions sont gardées ([cc06](captures/cc06-reviewer-avant-edite.png),
  [cc07](captures/cc07-reviewer-avant-aveugle.png)). Le défaut, c'est qu'il en a le
  droit et la consigne.
- **Dépendances ajoutées** (husky, @eslint/js, @vitest/coverage-v8, Stryker) : c'est ce
  paragraphe qui en parle.
- **Endpoint `availability`** : pas mergé. C'est la tâche de l'exercice 1, produite par
  la chaîne et laissée dans l'arbre de travail de la session, comme le sujet le prévoit.

## Reproduire

```bash
git checkout claude-code/avant && npm install
claude          # l'agent principal est architect (réglage "agent")
# coller la tâche de l'exercice 1, puis recommencer depuis une session neuve :
git checkout claude-code/apres && npm install && claude
```
