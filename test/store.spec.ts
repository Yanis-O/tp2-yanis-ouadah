import { describe, it, expect } from "vitest";
import { rooms, findRoom, bookingsForRoom, nextBookingId } from "../src/store.js";

// On teste le vrai store (en lecture). Il sera remplace par la vraie base (INFRA-140) :
// ces tests decriront alors le contrat que la nouvelle implementation doit tenir.
describe("store", () => {
  it("expose le catalogue de salles", () => {
    expect(rooms.map((r) => r.id)).toEqual(["amphi", "salle-a", "salle-b", "labo"]);
  });

  it("retrouve une salle par son identifiant", () => {
    expect(findRoom("salle-a")).toEqual({
      id: "salle-a",
      name: "Salle A",
      capacity: 12,
      hourlyRate: 25
    });
  });

  it("ne retrouve pas une salle inconnue", () => {
    expect(findRoom("cave")).toBeUndefined();
  });

  it("ne renvoie que les reservations de la salle demandee", () => {
    const amphi = bookingsForRoom("amphi");
    expect(amphi.length).toBeGreaterThan(0);
    expect(amphi.every((b) => b.roomId === "amphi")).toBe(true);
    expect(bookingsForRoom("salle-inexistante")).toEqual([]);
  });

  it("genere des identifiants de reservation uniques et croissants", () => {
    const a = nextBookingId();
    const b = nextBookingId();
    expect(a).toMatch(/^bk-\d+$/);
    expect(Number(b.slice(3))).toBe(Number(a.slice(3)) + 1);
  });
});
