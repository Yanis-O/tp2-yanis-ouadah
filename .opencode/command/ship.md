---
description: Livre le travail en cours (checks, relecture, commit sur une branche, push apres accord)
agent: architect
---

Prepare la livraison du travail en cours. Arrete-toi au premier point rouge et dis
pourquoi, sortie de la commande a l'appui.

1. `git branch --show-current` : si c'est `main`, arrete-toi. On ne commite pas dans
   `main` (AGENTS.md).
2. `npm run check` : lint, types, tests et seuils de couverture. Le hook post-ecriture ne
   bloque jamais (INFRA-231, voulu) : il ne prouve donc rien. Si `check` est rouge,
   arrete-toi.
3. Envoie `reviewer` sur `git diff`. Verdict `BLOCKING` : arrete-toi et rapporte-le.
4. `git status` : liste les fichiers a livrer. Ajoute-les **par nom** (`git add <fichiers>`),
   jamais `git add -A` : pas de `.env`, pas de scratch, pas de fichier que tu n'as pas
   identifie.
5. `git commit -m "<type>: <resume en une ligne>"` — le hook pre-commit relance les checks.
6. Montre le commit (`git log -1 --stat`) et demande l'accord avant `git push`.
