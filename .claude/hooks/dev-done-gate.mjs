#!/usr/bin/env node
// Barriere de fin de `dev` : son prompt dit « Green or you are not done ». Quand le
// subagent dev veut s'arreter, on lance `npm run check` ; si c'est rouge, on refuse
// l'arret et on lui renvoie la sortie. Une seule relance (stop_hook_active) pour ne pas
// boucler : ensuite il rend la main et l'architecte voit l'echec dans son rapport.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.agent_type !== "dev" || input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const run = spawnSync("npm", ["run", "--silent", "check"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
if (run.status === 0) process.exit(0);
const out = `${run.stdout}${run.stderr}`;
process.stdout.write(
  JSON.stringify({
    decision: "block",
    reason: `npm run check est rouge : tu n'as pas fini.\n${out.slice(-4000)}`,
  })
);
