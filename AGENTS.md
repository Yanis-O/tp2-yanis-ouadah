# salles-api — conventions du depot

Service interne de reservation de salles. Express + TypeScript, stockage en memoire pour
l'instant (la vraie base arrive avec INFRA-140).

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les dependances et le hook pre-commit (husky) |
| `npm start` | demarre l'API sur le port 3000 (via `tsx`, pas d'etape de build) |
| `npm test` | lance la suite de tests (`test/**/*.spec.ts`) |
| `npm run lint` | ESLint, regles recommandees JS + TypeScript |
| `npm run typecheck` | `tsc --noEmit` en mode `strict` |
| `npm run check` | lint + types + tests avec seuils de couverture — **c'est ce que lancent le pre-commit et la CI** |
| `npm run test:mutation` | mutation testing (Stryker) sur `src/lib` et `src/routes`, seuil 75 % |

Les tests s'appellent `*.spec.ts` (INFRA-205) : un fichier `*.test.ts` n'est pas lance.

## Conventions

Un `AGENTS.md` de sous-dossier precise ou remplace ces conventions pour son dossier :
il prime sur celui-ci (ex. `src/lib/` : pas de JSDoc, un `export default` par module).

1. **Toute fonction exportee porte une JSDoc** d'une ligne minimum, qui dit ce qu'elle
   fait et pas comment.
2. **Les erreurs remontent en `Result`, jamais en `throw`.** Une fonction qui peut
   echouer renvoie `{ ok: true, value }` ou `{ ok: false, error }` — type et helpers
   `ok()` / `err()` dans `src/lib/result.ts`. Exemple de reference : `src/lib/validate.ts`
   et la route `POST /bookings`. Pas de `try/catch` dans les routes.
3. Les dates circulent en **ISO 8601 UTC**, toujours en `string`, jamais en `Date`.
   `requireDate` refuse tout le reste (pas de fuseau, pas de `2026-02-30`).
4. Un module par responsabilite dans `src/lib/`. Pas de fichier `utils.ts`.
5. Les imports relatifs portent l'extension `.js` (ESM).

## Ce qu'il ne faut pas faire

- Ne pas ajouter de dependance sans en parler.
- Ne pas commiter dans `main` directement.
- Ne pas toucher a `src/store.ts` : il disparait avec INFRA-140.
- Ne pas desactiver un check pour passer : pas de `// @ts-nocheck`, pas de `it.skip` sans
  commentaire qui dit pourquoi et ce qu'il faut pour le reactiver, pas d'etape de CI
  commentee.
- Ne jamais lire ni commiter `.env` (ignore par git, interdit en lecture aux agents) :
  `.env.example` documente les variables.
