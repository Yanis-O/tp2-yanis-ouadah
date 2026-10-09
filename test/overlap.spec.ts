import { describe, it, expect } from "vitest";
import { overlaps } from "../src/lib/overlap.js";

describe("overlaps", () => {
  it("detecte deux creneaux qui se recouvrent", () => {
    expect(
      overlaps(
        "2026-10-05T09:00:00Z",
        "2026-10-05T11:00:00Z",
        "2026-10-05T10:00:00Z",
        "2026-10-05T12:00:00Z"
      )
    ).toBe(true);
  });

  it("laisse passer deux creneaux eloignes", () => {
    expect(
      overlaps(
        "2026-10-05T09:00:00Z",
        "2026-10-05T10:00:00Z",
        "2026-10-05T15:00:00Z",
        "2026-10-05T16:00:00Z"
      )
    ).toBe(false);
  });

  it("accepte deux creneaux bout a bout, dans les deux sens", () => {
    expect(
      overlaps(
        "2026-10-05T09:00:00Z",
        "2026-10-05T10:00:00Z",
        "2026-10-05T10:00:00Z",
        "2026-10-05T11:00:00Z"
      )
    ).toBe(false);
    expect(
      overlaps(
        "2026-10-05T10:00:00Z",
        "2026-10-05T11:00:00Z",
        "2026-10-05T09:00:00Z",
        "2026-10-05T10:00:00Z"
      )
    ).toBe(false);
  });

  it("gere un creneau inclus dans un autre", () => {
    const outer = ["2026-10-05T09:00:00Z", "2026-10-05T12:00:00Z"] as const;
    const inner = ["2026-10-05T10:00:00Z", "2026-10-05T11:00:00Z"] as const;
    expect(overlaps(...outer, ...inner)).toBe(true);
    expect(overlaps(...inner, ...outer)).toBe(true);
  });

  it("gere les creneaux identiques", () => {
    expect(
      overlaps(
        "2026-10-05T09:00:00Z",
        "2026-10-05T10:00:00Z",
        "2026-10-05T09:00:00Z",
        "2026-10-05T10:00:00Z"
      )
    ).toBe(true);
  });

  it("detecte un recouvrement d'une seule minute", () => {
    expect(
      overlaps(
        "2026-10-05T09:00:00Z",
        "2026-10-05T10:01:00Z",
        "2026-10-05T10:00:00Z",
        "2026-10-05T11:00:00Z"
      )
    ).toBe(true);
  });

  // SKIP ASSUME : ce test rejoue l'export de reservations de l'ancien systeme, qui vit
  // dans test/fixtures/legacy-bookings.json. Cette fixture n'a jamais ete versee dans le
  // depot (INFRA-198) : reactiver le test sans elle le fait echouer au chargement, pas
  // sur une assertion. A remettre le jour ou la fixture arrive.
  it.skip("ne trouve aucun chevauchement dans l'export de l'ancien systeme", async () => {
    const { readFile } = await import("node:fs/promises");
    const legacy = JSON.parse(
      await readFile(new URL("./fixtures/legacy-bookings.json", import.meta.url), "utf8")
    );
    for (let i = 0; i < legacy.length - 1; i += 1) {
      const a = legacy[i];
      const b = legacy[i + 1];
      expect(overlaps(a.startsAt, a.endsAt, b.startsAt, b.endsAt)).toBe(false);
    }
  });
});
