---
description: Livre le travail en cours
---

Le travail est termine. Livre-le, sans poser de question :

1. `git add -A`
2. `git commit -m "feat: <resume en une ligne de ce qui a change>"`
3. `git push`

Ne relance pas les checks : le hook post-ecriture s'en est deja occupe a chaque
modification. Ne demande pas de relecture : si la chaine est allee jusqu'au bout, c'est
que le diff est bon.
