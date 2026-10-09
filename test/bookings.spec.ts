import { describe, it, expect } from "vitest";
import { call, post } from "./http.js";

describe("POST /bookings", () => {
  it("cree une reservation et renvoie son prix en nombre", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "moi",
      people: 12,
      startsAt: "2026-11-04T09:00:00Z",
      endsAt: "2026-11-04T11:00:00Z"
    });
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({
      roomId: "salle-a",
      who: "moi",
      people: 12,
      startsAt: "2026-11-04T09:00:00Z",
      endsAt: "2026-11-04T11:00:00Z",
      price: 50
    });
    expect(res.body.booking.id).toMatch(/^bk-\d+$/);
  });

  it("facture la majoration de week-end en nombre", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "moi",
      people: 2,
      startsAt: "2026-11-07T09:00:00Z",
      endsAt: "2026-11-07T11:00:00Z"
    });
    expect(res.status).toBe(201);
    expect(res.body.booking.price).toBe(70);
  });

  it("refuse une salle inconnue", async () => {
    const res = await post({
      roomId: "cave",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res).toEqual({ status: 400, body: { error: "salle inconnue : cave" } });
  });

  it("refuse un depassement de capacite", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 7,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res).toEqual({ status: 400, body: { error: "capacite depassee : 7 > 6" } });
  });

  it("refuse une date invalide", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "la semaine prochaine",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("startsAt");
  });

  it("refuse le 30 fevrier", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2027-02-30T09:00:00Z",
      endsAt: "2027-02-30T10:00:00Z"
    });
    expect(res).toEqual({ status: 400, body: { error: "date invalide : startsAt" } });
  });

  it.each([
    ["roomId", { who: "moi", people: 2 }],
    ["who", { roomId: "salle-b", people: 2 }],
    ["people", { roomId: "salle-b", who: "moi" }],
    ["endsAt", { roomId: "salle-b", who: "moi", people: 2, endsAt: undefined }]
  ])("refuse un champ manquant : %s", async (field, partial) => {
    const res = await post({
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z",
      ...partial
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(field);
  });

  it("refuse un creneau qui finit avant de commencer", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T11:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res).toEqual({
      status: 400,
      body: { error: "endsAt doit etre posterieur a startsAt" }
    });
  });

  it("refuse un creneau de duree nulle", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T10:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("refuse un creneau qui chevauche une reservation existante", async () => {
    // bk-1001 : salle-a, 2026-10-05 09:00-11:00
    const res = await post({
      roomId: "salle-a",
      who: "moi",
      people: 2,
      startsAt: "2026-10-05T10:00:00Z",
      endsAt: "2026-10-05T12:00:00Z"
    });
    expect(res).toEqual({
      status: 409,
      body: { error: "creneau deja reserve", conflictsWith: "bk-1001" }
    });
  });

  it("accepte une reservation qui commence quand la precedente finit", async () => {
    const first = await post({
      roomId: "labo",
      who: "equipe-1",
      people: 4,
      startsAt: "2026-11-03T09:00:00Z",
      endsAt: "2026-11-03T10:00:00Z"
    });
    expect(first.status).toBe(201);

    const second = await post({
      roomId: "labo",
      who: "equipe-2",
      people: 4,
      startsAt: "2026-11-03T10:00:00Z",
      endsAt: "2026-11-03T11:00:00Z"
    });
    expect(second.status).toBe(201);
  });

  it("repond 400 en JSON, sans pile d'appel, sur un corps illisible", async () => {
    const res = await call("/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{pas du json"
    });
    expect(res).toEqual({ status: 400, body: { error: "corps JSON invalide" } });
  });
});

describe("GET /bookings", () => {
  it("liste toutes les reservations", async () => {
    const res = await call("/bookings");
    expect(res.status).toBe(200);
    const ids = res.body.bookings.map((b: { id: string }) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["bk-1001", "bk-1002"]));
  });

  it("filtre par salle", async () => {
    const res = await call("/bookings?roomId=amphi");
    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBeGreaterThan(0);
    expect(res.body.bookings.every((b: { roomId: string }) => b.roomId === "amphi")).toBe(true);
  });
});

describe("DELETE /bookings/:id", () => {
  it("annule une reservation existante, qui disparait du listing", async () => {
    const created = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-05T09:00:00Z",
      endsAt: "2026-11-05T10:00:00Z"
    });
    const id = created.body.booking.id;
    expect(await call(`/bookings/${id}`, { method: "DELETE" })).toEqual({
      status: 200,
      body: { cancelled: id }
    });
    const after = await call("/bookings?roomId=salle-b");
    expect(after.body.bookings.map((b: { id: string }) => b.id)).not.toContain(id);
  });

  it("renvoie 404 pour une reservation inconnue", async () => {
    expect(await call("/bookings/bk-0", { method: "DELETE" })).toEqual({
      status: 404,
      body: { error: "reservation inconnue" }
    });
  });
});

describe("erreurs du parseur autres que le JSON illisible", () => {
  it("les laisse a Express : 413 pour un corps trop gros", async () => {
    expect(await postTooLarge()).toBe(413);
  });
});

async function postTooLarge() {
  const { createApp } = await import("../src/app.js");
  const server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ big: "x".repeat(200_000) })
    });
    return res.status;
  } finally {
    server.close();
  }
}
