import { describe, it, expect } from "vitest";
import { requireString, requireDate, requirePositiveInt } from "../src/lib/validate.js";

describe("requireString", () => {
  it("renvoie la valeur d'un champ texte", () => {
    expect(requireString({ who: "moi" }, "who")).toEqual({ ok: true, value: "moi" });
  });

  it.each([undefined, "", "   ", 42, null])("refuse %j", (value) => {
    expect(requireString({ who: value }, "who")).toEqual({
      ok: false,
      error: "champ manquant ou vide : who"
    });
  });
});

describe("requireDate", () => {
  it.each(["2026-11-02T09:00:00Z", "2026-11-02T09:00Z", "2026-11-02T09:00:00.000Z"])(
    "accepte la date ISO 8601 UTC %s",
    (value) => {
      expect(requireDate({ at: value }, "at")).toEqual({ ok: true, value });
    }
  );

  it.each([
    "la semaine prochaine",
    "2026-11-02",
    "2026-11-02 09:00",
    "2026-11-02T09:00:00",
    "2026-11-02T09:00:00+02:00",
    "December 2, 2026 09:00",
    " 2026-11-02T09:00:00Z",
    "2026-11-02T09:00:00Zjunk"
  ])("refuse %j (pas de l'ISO 8601 UTC)", (value) => {
    expect(requireDate({ at: value }, "at")).toEqual({
      ok: false,
      error: "date ISO 8601 UTC attendue (ex. 2026-11-02T09:00:00Z) : at"
    });
  });

  it.each([
    "2026-02-30T09:00:00Z",
    "2026-13-01T09:00:00Z",
    "2026-04-31T09:00:00Z",
    "2026-11-02T24:00:00Z",
    "2026-11-02T25:00:00Z",
    "2026-11-02T09:60:00Z",
    "2026-11-02T09:00:60Z"
  ])("refuse la date impossible %s", (value) => {
    expect(requireDate({ at: value }, "at")).toEqual({ ok: false, error: "date invalide : at" });
  });

  it("refuse un champ absent avec le message du champ", () => {
    expect(requireDate({}, "at")).toEqual({ ok: false, error: "champ manquant ou vide : at" });
  });
});

describe("requirePositiveInt", () => {
  it("renvoie un entier positif", () => {
    expect(requirePositiveInt({ n: 1 }, "n")).toEqual({ ok: true, value: 1 });
  });

  it.each([0, -1, 1.5, "3", undefined, Number.NaN])("refuse %j", (value) => {
    expect(requirePositiveInt({ n: value }, "n")).toEqual({
      ok: false,
      error: "entier positif attendu : n"
    });
  });
});
