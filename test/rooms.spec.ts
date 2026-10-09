import { describe, it, expect } from "vitest";
import { call } from "./http.js";

describe("GET /health", () => {
  it("repond ok", async () => {
    expect(await call("/health")).toEqual({ status: 200, body: { ok: true } });
  });
});

describe("GET /rooms", () => {
  it("liste le catalogue", async () => {
    const res = await call("/rooms");
    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(4);
  });

  it("renvoie une salle et ses reservations", async () => {
    const res = await call("/rooms/amphi");
    expect(res.status).toBe(200);
    expect(res.body.room.id).toBe("amphi");
    expect(res.body.bookings.map((b: { id: string }) => b.id)).toContain("bk-1002");
  });

  it("renvoie 404 pour une salle inconnue", async () => {
    expect(await call("/rooms/cave")).toEqual({ status: 404, body: { error: "salle inconnue" } });
  });
});
