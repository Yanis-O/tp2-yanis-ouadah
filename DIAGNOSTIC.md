# DIAGNOSTIC — salles-api, « le repo malade »

Branche : `fix/repo-malade`. Chaque constat ci-dessous renvoie à une capture du dossier
[`captures/`](captures/) : la commande lancée et ce qu'elle a répondu, avant puis après.

## En une minute

Le dépôt est vert parce que ses filets ne regardent rien. Les tests qui échouent ne sont
pas lancés, le lint n'a aucune règle, le typage est coupé là où il trouverait l'erreur,
le pre-commit n'est pas installé et la CI ne lance pas les tests. Une fois ces filets
rebranchés, ils trouvent immédiatement **deux bugs en production** : un 409 sur toute
réservation bout à bout, et un prix de week-end renvoyé sous forme de chaîne (`"5020"`
au lieu de `70`). Côté agents, le `finder` n'a aucun outil, le `planner` est
injoignable, l'architecte qui « ne code jamais » a tous les droits, le reviewer corrige
ce qu'il relit, et `/ship` pousse sans checks ni relecture avec un `git add -A` qui
embarque `.env`.

| Mesure | Avant | Après |
|---|---|---|
| Tests exécutés / écrits | 5 / 18 (4 skip, 2 fichiers ignorés) | 72 / 73 (1 skip justifié) |
| Couverture des lignes `src/` | 21,4 % | 100 % (seuil 90 % bloquant) |
| Score de mutation (Stryker) | **4,57 %** | **97,78 %** (4 mutants équivalents) |
| Règles de lint actives | 0 | recommended JS + TS, `eqeqeq`, `no-debugger`, `ban-ts-comment` |
| `tsc` | `strict: false` + `@ts-nocheck` | `strict: true`, aucun `@ts-nocheck` |
| Pre-commit | jamais installé | `npm run check`, bloque (prouvé) |
| CI | lint seul | lint + types + tests et couverture, puis mutation |
| MCP déclarés / utilisables par la chaîne | 6 / 0 | 0 / 0 |

---

## 1. Les rules — `AGENTS.md` ne dit pas la vérité

| # | Symptôme (commande → réponse) | Cause | Réparation |
|---|---|---|---|
| R1 | `npm test` → `Missing script: "test"`, alors qu'AGENTS.md dit de le lancer **avant tout commit** ([01](captures/01-tests-config-before.png)) | `AGENTS.md` / `package.json` | script `test` ajouté, plus `check` |
| R2 | `npm run build` → `Missing script: "build"`. De toute façon `tsconfig.json` a `noEmit: true` et la prod tourne avec `tsx` : il n'y a jamais eu de `dist/` | `AGENTS.md` | ligne retirée, la doc dit « pas d'étape de build » |
| R3 | La règle 2 affirme que les erreurs passent en `Result` « depuis la refonte de mars ». `git log` montre que `validate.ts` et `routes/bookings.ts` datent du 22 janvier et n'ont jamais bougé : `throw new ValidationError` + `try/catch` dans la route. Le prompt du `dev` lui demande à la fois de suivre AGENTS.md et d'imiter le code voisin, deux consignes qui se contredisent | `AGENTS.md`, `src/lib/validate.ts`, `src/routes/bookings.ts` | règle rendue vraie : `src/lib/result.ts`, `validate.ts` renvoie des `Result`, plus de `try/catch` dans la route. AGENTS.md cite l'exemple de référence |
| R4 | La règle 3 (« ISO 8601 UTC ») n'est pas appliquée : l'API accepte `2026-12-01 09:00` (heure locale du serveur), `December 2, 2026` et le 30 février ([09](captures/09-api-before.png)) | `src/lib/validate.ts` | `requireDate` strict (voir B3) |
| R5 | Le README annonce « six subagents » alors qu'il y en avait 5, plus un `planner` en mode `primary` (voir A2) | `README.md` | corrigé |

## 2. Les subagents et les droits

`opencode agent list` et `opencode debug agent <nom>` donnent les règles **résolues** et
les outils **effectivement** actifs ([06](captures/06-agents-before.png),
[07](captures/07-secrets-rights-before.png)). OpenCode évalue les permissions dans
l'ordre : **c'est la dernière règle qui matche qui gagne**.

| # | Symptôme | Cause | Réparation |
|---|---|---|---|
| A1 | **`finder` n'a aucun outil.** `debug agent finder` renvoie `read/grep/glob: false`. C'est l'agent qui « répond sans avoir rien lu » : son prompt lui demande en plus une prose généreuse, donc il invente | `.opencode/agent/finder.md` : `"*": deny` placé **en dernier**, il écrase les `allow` qui le précèdent | `"*": deny` remis en tête. Le prompt revient à son rôle (lister des `file:line`, pas expliquer) pour respecter le tableau de l'architecte et le modèle bon marché |
| A2 | **`planner` est injoignable.** Il est en `mode: primary`, et le source d'OpenCode filtre la liste du tool `task` avec `F.mode!=="primary"`. L'étape 2 de la boucle de l'architecte ne peut donc jamais s'exécuter | `.opencode/agent/planner.md` | `mode: subagent` ([15](captures/15-agents-after.png)) |
| A3 | **L'architecte « Never writes code » a `edit: allow` et `bash "*": allow`**, `git push` compris. Le commit `865177b` (« unblock, trop de refus de permission ») a ouvert les droits. Le prompt pousse dans le même sens : « you also have full access — use whichever is faster » et la règle inversée « *If a question can be answered by a subagent, it can also be answered by you* ». Résultat : l'orchestrateur fait tout lui-même et la chaîne ne travaille pas | `.opencode/agent/architect.md` | droits d'origine restaurés (git en lecture, `npm run check`, `git add/commit/push` en `ask`), `edit: deny`. Règle remise à l'endroit (« must not be answered by you ») |
| A4 | **`tester` ne travaille jamais** : il est absent du tableau d'équipe de l'architecte, alors que la section *Non-negotiable* le cite | `architect.md` | ajouté à l'équipe et à l'étape *Verify* |
| A5 | **Le `reviewer` corrige ce qu'il relit** (`edit: allow` et la consigne « Fix what you find »). Il n'est donc plus indépendant, alors que le prompt de l'architecte et le sien en font la seule raison de son verdict | `.opencode/agent/reviewer.md` | `edit: deny`, consigne inversée. Il peut lancer lint, types et tests pour **prouver** un défaut |
| A6 | **`dev` peut déléguer (`task: allow`)** et son prompt lui dit d'envoyer des morceaux à d'autres `dev`, ce que l'architecte interdit (« Never send two dev agents at the same files »). Pas de format de retour non plus (« whatever shape ») | `.opencode/agent/dev.md` | `task: deny`, `git commit` en `deny`, contrat de retour Diff / Checks / Surprises |
| A7 | **`explorer` (rôle de lecture) a `edit: allow` partout, plus `curl*` et `webfetch` en `allow`**, et son prompt l'encourage à interroger « an internal service » | `.opencode/agent/explorer.md` | `edit` limité à `.opencode/plans/*-notes.md`, `curl` retiré |
| A8 | **Les agents lisent `.env`.** OpenCode met `*.env` en `ask` par défaut (agent `build`), mais le `read: allow` des agents de la chaîne vient après et l'écrase. `architect`, `explorer`, `dev` et `tester` pouvaient lire `.env` puis le `curl` vers l'extérieur ([07](captures/07-secrets-rights-before.png)) | les 7 fichiers d'agent | `read: { "*": allow, "*.env": deny, "*.env.*": deny, "*.env.example": allow }` partout |

## 3. Les commands et les skills

| # | Symptôme | Cause | Réparation |
|---|---|---|---|
| C1 | `/ship` fait, « sans poser de question », `git add -A` (qui embarque `.env`, les scratch, tout), un commit puis un `git push`, sans vérifier la branche (AGENTS.md interdit `main`). Il interdit aussi de relancer les checks en invoquant le hook post-écriture, qui **par conception ne bloque jamais** (INFRA-231), et interdit la relecture | `.opencode/command/ship.md` | refus sur `main` → `npm run check` → `reviewer` → `git add` fichier par fichier → commit (le pre-commit relance les checks) → accord avant `push` |
| C2 | Il n'y a pas de skills (`.opencode/skill/` absent). **Cette absence se défend** : aucune procédure du dépôt n'en demande un | — | rien à faire |

## 4. Les MCP

`opencode mcp list` + mesure de `tools/list` sur chaque serveur qui répond ([08](captures/08-mcp-before.png)) :

| Serveur | État | Utilité pour ce dépôt |
|---|---|---|
| `salles-db` | ✗ 403, URL `.lan` interne | **Il n'y a pas de base** : le store est en mémoire jusqu'à INFRA-140. Le header contient en plus `Bearer ${SALLES_MCP_TOKEN}`, mais OpenCode ne substitue que la syntaxe `{env:VAR}` (regex du loader : `/\{env:([^}]+)\}/`), donc la chaîne part littéralement |
| `github` | ✓ 26 outils, ~4 k tokens | Paquet npm **déprécié**, aucun jeton fourni. Outils d'écriture (`push_files`, `create_repository`…) |
| `notion` | ✓ 24 outils, **~19 k tokens** de schémas | Rien dans le dépôt ne parle de Notion |
| `slack` | ✗ `SLACK_BOT_TOKEN` manquant | Paquet déprécié |
| `sentry` | ✗ 403 | Le service n'a pas de SDK Sentry |
| `playwright` | ✓ 25 outils, ~5 k tokens | L'API n'a pas d'interface web ; le `tester` utilise `curl` |

En plus, **aucun agent de la chaîne ne peut appeler ces outils** : ils tombent sous le
`"*": deny` de chacun (évaluation des règles résolues). Ils ne servaient donc qu'à
l'agent `build` par défaut, et lui coûtaient environ 28 k tokens de schémas à chaque
requête, plus trois échecs de connexion à chaque démarrage.
→ `opencode.json` : `"mcp": {}` ([15](captures/15-agents-after.png)). Le jour où INFRA-140
livre la base, `salles-db` pourra revenir avec `{env:SALLES_MCP_TOKEN}`.

## 5. Les hooks

| # | Symptôme | Cause | Réparation |
|---|---|---|---|
| H1 | **Le pre-commit ne tourne jamais.** `git config core.hooksPath` est vide, `.git/hooks` est vide, et `npm ls husky` renvoie `(empty)` : husky n'est pas une dépendance et aucun script `prepare` ne l'installe. Un commit avec du code cassé passe ([04](captures/04-hooks-lint-before.png)) | `package.json`, `.husky/pre-commit` (ancien en-tête `. husky.sh` de husky v4–8) | `husky@9` en devDependency, `"prepare": "husky"`, hook réduit à `npm run check`. **Le même commit est maintenant refusé** ([14](captures/14-hooks-lint-after.png)) |
| H2 | Le hook post-écriture (plugin OpenCode) est bien chargé (`opencode debug config` → `plugin: [.opencode/plugin/checks.js]`), mais il lançait des checks qui ne vérifiaient rien (L1, T1, Y1). Le commentaire de `checks.sh` dit qu'il est branché par `experimental.hook.file_edited` dans `opencode.json`, ce qui est faux | `scripts/checks.sh` | commentaire corrigé, tests avec couverture ([13](captures/13-net-after.png)) |

## 6. Le lint et les types

| # | Symptôme | Cause | Réparation |
|---|---|---|---|
| L1 | `npm run lint` passe sur un fichier qui contient `debugger`, une variable inutilisée et un `==` ([04](captures/04-hooks-lint-before.png)) | `eslint.config.js` : parser branché, `rules: {}` | `@eslint/js` recommended + `typescript-eslint` recommended + `eqeqeq`, `no-debugger`, `ban-ts-comment` |
| Y1 | `tsc` passe, mais dès qu'on retire `// @ts-nocheck` de `price.ts` il répond `TS2322: Type 'string' is not assignable to type 'number'`. C'est le bug B2, masqué depuis février ([03](captures/03-types-before.png)) | `src/lib/price.ts` (`@ts-nocheck`), `tsconfig.json` (`strict: false`) | `@ts-nocheck` retiré (et interdit par le lint), `strict: true` |

## 7. Les tests

| # | Symptôme | Cause | Réparation |
|---|---|---|---|
| T1 | `npm run test:unit` lance **2 fichiers sur 4**. `bookings.test.ts` et `price.test.ts` ne tournent pas ; forcés, ils échouent tous les deux ([02](captures/02-tests-hidden-before.png)) | `vitest.config.ts` ne prend que `*.spec.ts`, **ce qui est voulu** (INFRA-205), mais les deux fichiers n'ont jamais été renommés | renommés en `*.spec.ts`. La convention est gardée, la config n'a pas été élargie |
| T2 | `it.skip("accepte deux créneaux bout à bout")` : ce test échouerait, et c'est précisément le bug B1 | `test/overlap.spec.ts` | réactivé |
| T3 | Deux tests `it.skip(... expect(true).toBe(true))` : des coquilles vides | `test/overlap.spec.ts` | remplacés par de vrais tests (créneau inclus, créneaux identiques) |
| T4 | `store.spec.ts` teste un **double** codé en dur (`findRoom` renvoie toujours Salle A) : il passe même si le vrai store est vide ou faux | `test/store.spec.ts` | teste le vrai `store.ts` en lecture, sans le modifier (INFRA-140 respecté) |
| T5 | Couverture **21 %** ; `validate.ts`, `price.ts`, les routes et `app.ts` à 0 %. Score de mutation **4,57 %** : 139 mutants sur 175 survivent sans qu'aucun test ne les touche ([05](captures/05-coverage-mutation-before.png)) | — | `validate.spec.ts`, `rooms.spec.ts`, `bookings.spec.ts` complété. Couverture 100 % lignes, mutation 97,78 % ([12](captures/12-coverage-mutation-after.png)). Seuils dans `vitest.config.ts` (90 %) et `stryker.config.json` (`break: 75`) |

Les 4 mutants qui survivent sont équivalents : Express traite `get("")` comme
`get("/")`, et `typeof value !== "number"` est redondant avec `Number.isInteger` (il
reste nécessaire au typage).

## 8. La CI et Git

| # | Symptôme | Cause | Réparation |
|---|---|---|---|
| G1 | La CI ne lance que le lint (sans règles). L'étape de tests a été commentée par `07a2c4d « fix ci »` avec `TODO remettre, ça bloquait les merges` : ça bloquait parce que les tests trouvaient les bugs. Pas de typecheck non plus | `.github/workflows/ci.yml` | job `check` (lint, types, tests et seuils de couverture) puis job `mutation` |
| G2 | `.env` est versionné et absent du `.gitignore`. Il contient un mot de passe de base de recette et un `SESSION_SECRET` (la clé Stripe, elle, est étiquetée factice) | `.env`, `.gitignore` | `git rm --cached .env`, `.env` ignoré, `.env.example` ajouté |

## 9. Les bugs trouvés par le filet une fois réparé

Reproduits sur l'API qui tourne (`npm start` + `curl`), avant ([09](captures/09-api-before.png)) et après ([16](captures/16-api-after.png)) :

| # | Requête | Avant | Après | Cause |
|---|---|---|---|---|
| B1 | salle-a 11:00–12:00 alors que bk-1001 finit à 11:00 | **409** `conflictsWith: bk-1001` | 201 | `overlaps` utilise `<=` alors que la doc dit `[début, fin[` → `<` |
| B2 | salle-a, samedi, 2 h | 201, `"price":"5020"` (une **chaîne**) | 201, `"price":70` | `WEEKEND_SURCHARGE = "20"` : concaténation au lieu d'addition, masquée par `@ts-nocheck` |
| B3 | `2026-02-30T09:00:00Z` | 201, stockée (Date.parse la décale au 2 mars) | 400 `date invalide` | `requireDate` ne vérifiait que `Date.parse` |
| B4 | `2026-12-01 09:00`, `December 2, 2026` | 201 (heure locale du serveur) | 400 | convention ISO 8601 UTC non appliquée |
| B5 | corps `{bad` | 400 en **HTML avec la pile d'appel** | 400 `{"error":"corps JSON invalide"}` | pas de gestionnaire d'erreur JSON |

B2 : le test de l'équipe (`price.test.ts`, février) attend 70 pour 2 h à 25 €. La
majoration est donc **forfaitaire, 20 €**, et non 20 %. C'est ce que fait le correctif.

---

## Ce qui ressemble à une erreur, mais est délibéré et correct (laissé tel quel)

- **`scripts/checks.sh` sort toujours en 0** : c'est INFRA-231, et le commentaire le dit.
  Le hook post-écriture avertit l'agent sans l'interrompre. Ce n'est pas un défaut ;
  le défaut était qu'**aucun autre** filet ne bloquait. C'est maintenant le rôle du
  pre-commit et de la CI.
- **`vitest.config.ts` ne prend que `*.spec.ts`** : c'est la convention INFRA-205. Ce
  sont les fichiers qui ont été renommés, la config n'a pas été élargie.
- **`it.skip` du test de l'export legacy** : la fixture n'a jamais été versée (INFRA-198)
  et le commentaire explique qu'il casserait au chargement. Il reste en skip.
- **`src/store.ts` non modifié** (INFRA-140). Le test le lit sans le toucher.
- **`src/lib/AGENTS.md` : « pas de JSDoc ici »** est une règle de chemin qui prime sur la
  règle 1 du AGENTS.md racine pour `src/lib/`. L'absence de JSDoc dans `price.ts` est
  donc conforme.
- **`tester` avec `bash "*": allow`** : son rôle est de piloter l'app avec `curl` ; ses
  `deny` (`git commit/push/checkout/reset`, `sudo`) et son `edit` limité à
  `.opencode/scratch/**` (ignoré par git) sont cohérents.
- **`dev` avec `bash "*": allow`** : il doit lancer les checks du projet ; les commandes
  destructrices sont en `ask`/`deny`.
- **`STRIPE_SECRET_KEY`** est étiquetée « jeu de données pédagogique, aucune valeur
  réelle » : ce n'est pas une fuite.
- **`finder`, `explorer` et `tester` sur le modèle « flash »** : c'est la discipline de
  coût annoncée par l'architecte.

## Ce que j'ai choisi de ne pas corriger, et pourquoi

- **Secrets dans l'historique Git.** `.env` est sorti de l'index, mais `ecd0790` le
  contient toujours. Réécrire l'historique (`git filter-repo`) est irréversible et casse
  les clones de toute l'équipe : la décision revient à l'équipe. La vraie réparation est
  de **faire tourner** le mot de passe de la base de recette et `SESSION_SECRET`.
- **`bash cat .env` reste possible pour `dev` et `tester`.** Le `deny` porte sur l'outil
  `read`. Filtrer le shell par motif est contournable ; la protection réelle, c'est de ne
  pas avoir de vrais secrets dans le répertoire de travail.
- **Modèles `opencode/deepseek-v4-*`** : OpenCode a répondu `Model not found` ici, mais
  cet environnement ne pouvait joindre ni `models.dev` ni `opencode.ai` (403 proxy). Je
  ne peux pas affirmer que le modèle n'existe pas, donc je n'y ai pas touché. À vérifier
  avec `opencode models` sur un poste connecté.
- **Agents intégrés `build` et `plan`** : ils gardent les droits par défaut d'OpenCode.
  Ce ne sont pas des agents du dépôt et `default_agent` reste `architect`.
- **Règle « un `export default` par module » de `src/lib/AGENTS.md`** : aucun module ne
  la respecte, mais elle sert des scripts de facturation qui ne sont pas dans ce dépôt.
  Impossible de vérifier qui les charge ; ajouter des `default` serait sans risque, mais
  je ne le ferais pas sans en parler à l'équipe facturation.
- **Majoration de week-end calculée sur `startsAt` seul** (un créneau vendredi 23 h →
  samedi 1 h n'est pas majoré) : c'est une règle métier, pas un bug démontré.
- **Protection de la branche `main` sur GitHub** : elle ne se règle pas depuis le dépôt.
  À activer dans les réglages, avec la CI `check` comme statut requis.
- **Endpoint `/rooms/:id/availability`** : non implémenté volontairement. C'est la tâche
  de l'exercice 1, à refaire faire par la chaîne réparée.
- **Dépendances ajoutées** (AGENTS.md : « pas sans en parler ») : `husky` (sans lui, le
  pre-commit ne peut pas exister), `@eslint/js` (déjà présent en transitif), et
  `@vitest/coverage-v8` + `@stryker-mutator/*` (les mesures). C'est ce paragraphe qui en
  parle.

## Exercice 1 — la chaîne sur la tâche « availability »

La tentative depuis mon environnement est dans [00](captures/00-ex1-attempt.png) :
`ProviderModelNotFoundError` sur `opencode/deepseek-v4-pro`, puis `Forbidden` vers
`opencode.ai` avec un modèle forcé. Aucun fournisseur de modèle n'était joignable, donc
**les captures de session OpenCode avant/après restent à prendre sur un poste avec un
modèle configuré**. Ce qu'on doit y voir, d'après les mesures ci-dessus :

- **Avant** (`git checkout ab57521`) : l'architecte fait tout lui-même (A3). Le `finder`
  répond sans avoir lu (A1). Le `planner` n'est jamais appelé (A2), le `tester` non plus
  (A4). Le hook affiche des checks verts qui ne vérifient rien (T1, L1). Les nouveaux
  tests `*.test.ts` qu'écrirait un agent ne seraient même pas lancés.
- **Après** (`fix/repo-malade`, session neuve) : `finder`/`explorer` → `planner` (plan
  dans `.opencode/plans/`) → `dev` → `npm run check` → `reviewer` (lecture seule) →
  `tester` sur l'API.

Captures à ajouter dans `captures/` : `ex1-avant-*.png` et `ex1-apres-*.png`.
