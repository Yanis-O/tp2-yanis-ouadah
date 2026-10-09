#!/usr/bin/env node
// Adaptateur de permissions, migration OpenCode -> Claude Code.
//
// Les tables de droits de chaque agent sont reprises telles quelles depuis
// .opencode/agent/*.md dans .claude/permissions.json. Ce hook PreToolUse les
// applique avec la semantique documentee d'OpenCode : on prend d'abord les
// defauts d'OpenCode, puis les regles de l'agent dans l'ordre, et la DERNIERE
// regle qui correspond gagne. allow = sans demander, ask = demande, deny = refus.
import { readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const agent = input.agent_type;
if (!agent) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const table = JSON.parse(readFileSync(path.join(root, ".claude/permissions.json"), "utf8"))[agent];
if (!table) process.exit(0);

// Outil Claude Code -> cle de permission OpenCode, et ce sur quoi porte le motif.
const tool = input.tool_name;
const ti = input.tool_input ?? {};
const rel = (p) => (p ? path.relative(root, path.resolve(root, p)).split(path.sep).join("/") : "*");
const MAP = {
  Read: ["read", () => rel(ti.file_path)],
  Edit: ["edit", () => rel(ti.file_path)],
  Write: ["edit", () => rel(ti.file_path)],
  MultiEdit: ["edit", () => rel(ti.file_path)],
  NotebookEdit: ["edit", () => rel(ti.notebook_path)],
  Glob: ["glob", () => ti.pattern ?? "*"],
  Grep: ["grep", () => ti.pattern ?? "*"],
  LS: ["list", () => rel(ti.path)],
  Bash: ["bash", () => ti.command ?? ""],
  Agent: ["task", () => ti.subagent_type ?? "*"],
  Task: ["task", () => ti.subagent_type ?? "*"],
  WebFetch: ["webfetch", () => ti.url ?? "*"],
  WebSearch: ["websearch", () => ti.query ?? "*"],
  TodoWrite: ["todowrite", () => "*"],
  TaskCreate: ["todowrite", () => "*"],
  TaskUpdate: ["todowrite", () => "*"],
  TaskList: ["todowrite", () => "*"],
  TaskGet: ["todowrite", () => "*"],
  AskUserQuestion: ["question", () => "*"],
  LSP: ["lsp", () => "*"],
  Skill: ["skill", () => ti.skill ?? "*"],
};
// ToolSearch ne fait que charger la definition d'un outil differe : pas une action.
if (tool === "ToolSearch") process.exit(0);
const [perm, subject] = MAP[tool] ? [MAP[tool][0], MAP[tool][1]()] : [tool, "*"];

// Defauts d'OpenCode (tels que `opencode agent list` les affiche en tete).
const rules = [
  { perm: "*", pattern: "*", action: "allow" },
  { perm: "read", pattern: "*.env", action: "ask" },
  { perm: "read", pattern: "*.env.*", action: "ask" },
  { perm: "read", pattern: "*.env.example", action: "allow" },
];
for (const [key, value] of Object.entries(table)) {
  if (typeof value === "string") rules.push({ perm: key, pattern: "*", action: value });
  else for (const [pattern, action] of Object.entries(value)) rules.push({ perm: key, pattern, action });
}

const wildcard = (pat, s) =>
  new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "s").test(s);

let decision = "allow";
let matched = "defaut";
for (const r of rules) {
  if ((r.perm === "*" || r.perm === perm) && wildcard(r.pattern, subject)) {
    decision = r.action;
    matched = `${r.perm}: ${JSON.stringify(r.pattern)} -> ${r.action}`;
  }
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: `[${agent}] ${tool}(${subject.slice(0, 80)}) : ${matched}`,
    },
  })
);
