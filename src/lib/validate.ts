/**
 * Validation des charges utiles entrantes. Chaque fonction renvoie un Result.
 */
import { ok, err, type Result } from "./result.js";

// ISO 8601 en UTC : 2026-11-02T09:00Z, 2026-11-02T09:00:00Z, 2026-11-02T09:00:00.000Z
const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?Z$/;

export function requireString(payload: Record<string, unknown>, field: string): Result<string> {
  const value = payload[field];
  if (typeof value !== "string" || value.trim() === "") {
    return err(`champ manquant ou vide : ${field}`);
  }
  return ok(value);
}

export function requireDate(payload: Record<string, unknown>, field: string): Result<string> {
  const str = requireString(payload, field);
  if (!str.ok) return str;
  const m = ISO_UTC.exec(str.value);
  if (!m) {
    return err(`date ISO 8601 UTC attendue (ex. 2026-11-02T09:00:00Z) : ${field}`);
  }
  // Date.parse accepte le 30 fevrier ou 24:00 et les reporte au jour suivant : on
  // rejette toute date dont le jour du mois relu differe de celui qui a ete ecrit.
  const time = Date.parse(str.value);
  if (Number.isNaN(time) || new Date(time).getUTCDate() !== Number(m[3])) {
    return err(`date invalide : ${field}`);
  }
  return ok(str.value);
}

export function requirePositiveInt(payload: Record<string, unknown>, field: string): Result<number> {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return err(`entier positif attendu : ${field}`);
  }
  return ok(value);
}
