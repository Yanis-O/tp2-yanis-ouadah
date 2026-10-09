# salles-api

API interne de reservation de salles.

```bash
npm install
npm start          # http://localhost:3000
```

## Endpoints

| Methode | Route | Role |
|---|---|---|
| GET | `/health` | sonde de vie |
| GET | `/rooms` | catalogue des salles |
| GET | `/rooms/:id` | une salle et ses reservations |
| GET | `/bookings?roomId=` | les reservations |
| POST | `/bookings` | creer une reservation |
| DELETE | `/bookings/:id` | annuler une reservation |

Exemple :

```bash
curl -s localhost:3000/rooms | jq
curl -s -X POST localhost:3000/bookings \
  -H 'content-type: application/json' \
  -d '{"roomId":"salle-a","who":"moi","people":4,
       "startsAt":"2026-11-02T09:00:00Z","endsAt":"2026-11-02T11:00:00Z"}' | jq
```

## Outillage agent

Le depot embarque une chaine d'agents Claude Code (`.claude/`) : un agent principal
`architect` (reglage `agent` de `.claude/settings.json`) et six subagents specialises
(`.claude/agents/`). `/agents` les liste dans une session `claude`.

Migree depuis OpenCode : prompts et tables de droits repris a l'identique
(`.claude/permissions.json`, appliquees par le hook `.claude/hooks/permissions.mjs`).

## Etat du projet

L'equipe qui a monte ce service est partie. Le service tourne en production depuis
huit mois. La chaine d'agents a ete installee en juin et personne ne l'a revue depuis ;
elle a ete migree telle quelle vers Claude Code en octobre.
