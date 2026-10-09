import { describe, it, expect } from "vitest";
import { priceFor, hoursBetween, isWeekend } from "../src/lib/price.js";

const salleA = { id: "salle-a", name: "Salle A", capacity: 12, hourlyRate: 25 };

describe("priceFor", () => {
  it("facture les heures au tarif de la salle", () => {
    expect(priceFor(salleA, "2026-10-05T09:00:00Z", "2026-10-05T11:00:00Z")).toBe(50);
  });

  it("ajoute la majoration de week-end", () => {
    // samedi 10 octobre 2026
    expect(priceFor(salleA, "2026-10-10T09:00:00Z", "2026-10-10T11:00:00Z")).toBe(70);
  });

  it("majore aussi le dimanche, et renvoie toujours un nombre", () => {
    // dimanche 11 octobre 2026
    const price = priceFor(salleA, "2026-10-11T09:00:00Z", "2026-10-11T10:30:00Z");
    expect(price).toBe(57.5);
    expect(typeof price).toBe("number");
  });

  it("compte les heures entre deux bornes", () => {
    expect(hoursBetween("2026-10-05T09:00:00Z", "2026-10-05T12:30:00Z")).toBe(3.5);
  });

  it("reconnait le week-end", () => {
    expect(isWeekend("2026-10-10T09:00:00Z")).toBe(true);
    expect(isWeekend("2026-10-11T23:59:00Z")).toBe(true);
    expect(isWeekend("2026-10-05T09:00:00Z")).toBe(false);
    expect(isWeekend("2026-10-09T23:59:00Z")).toBe(false);
  });
});
