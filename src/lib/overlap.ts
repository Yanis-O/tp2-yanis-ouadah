/**
 * Deux creneaux se chevauchent-ils ?
 *
 * Les bornes sont des dates ISO 8601. Un creneau est [debut, fin[ : deux creneaux
 * bout a bout (la fin de l'un est le debut de l'autre) ne se chevauchent pas.
 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = Date.parse(aStart);
  const a2 = Date.parse(aEnd);
  const b1 = Date.parse(bStart);
  const b2 = Date.parse(bEnd);
  return a1 < b2 && b1 < a2;
}
