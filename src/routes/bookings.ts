import { Router, type Response } from "express";
import { bookings, findRoom, nextBookingId, bookingsForRoom } from "../store.js";
import { overlaps } from "../lib/overlap.js";
import { priceFor } from "../lib/price.js";
import { requireString, requireDate, requirePositiveInt } from "../lib/validate.js";

export const bookingsRouter = Router();

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}

bookingsRouter.get("/", (req, res) => {
  const roomId = req.query.roomId;
  if (typeof roomId === "string") {
    res.json({ bookings: bookingsForRoom(roomId) });
    return;
  }
  res.json({ bookings });
});

bookingsRouter.post("/", (req, res) => {
  const payload: Record<string, unknown> = req.body ?? {};
  const roomId = requireString(payload, "roomId");
  const who = requireString(payload, "who");
  const people = requirePositiveInt(payload, "people");
  const startsAt = requireDate(payload, "startsAt");
  const endsAt = requireDate(payload, "endsAt");

  if (!roomId.ok) return badRequest(res, roomId.error);
  if (!who.ok) return badRequest(res, who.error);
  if (!people.ok) return badRequest(res, people.error);
  if (!startsAt.ok) return badRequest(res, startsAt.error);
  if (!endsAt.ok) return badRequest(res, endsAt.error);

  if (Date.parse(endsAt.value) <= Date.parse(startsAt.value)) {
    return badRequest(res, "endsAt doit etre posterieur a startsAt");
  }

  const room = findRoom(roomId.value);
  if (!room) {
    return badRequest(res, `salle inconnue : ${roomId.value}`);
  }
  if (people.value > room.capacity) {
    return badRequest(res, `capacite depassee : ${people.value} > ${room.capacity}`);
  }

  const clash = bookingsForRoom(roomId.value).find((b) =>
    overlaps(startsAt.value, endsAt.value, b.startsAt, b.endsAt)
  );
  if (clash) {
    res.status(409).json({ error: "creneau deja reserve", conflictsWith: clash.id });
    return;
  }

  const booking = {
    id: nextBookingId(),
    roomId: roomId.value,
    who: who.value,
    people: people.value,
    startsAt: startsAt.value,
    endsAt: endsAt.value,
    price: priceFor(room, startsAt.value, endsAt.value)
  };
  bookings.push(booking);
  res.status(201).json({ booking });
});

bookingsRouter.delete("/:id", (req, res) => {
  const index = bookings.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "reservation inconnue" });
    return;
  }
  const [removed] = bookings.splice(index, 1);
  res.json({ cancelled: removed.id });
});
