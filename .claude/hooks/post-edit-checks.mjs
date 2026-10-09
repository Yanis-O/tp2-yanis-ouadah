#!/usr/bin/env node
// Checks post-ecriture (INFRA-231) : apres chaque Edit/Write d'un fichier .ts, on lance
// scripts/checks.sh et on renvoie sa sortie a l'agent via additionalContext.
// Claude Code n'affiche pas a l'agent la sortie standard d'un hook qui sort en 0 :
// sans ce JSON, l'agent ne voit jamais le rouge. On ne bloque jamais (sortie 0).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path ?? "";
if (!file.endsWith(".ts")) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
let out;
try {
  out = execFileSync("bash", ["scripts/checks.sh"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}
const tail = out.length > 6000 ? "...\n" + out.slice(-6000) : out;
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `--- checks post-ecriture ---\n${tail}` },
  })
);
