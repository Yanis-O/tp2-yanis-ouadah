import express, { type ErrorRequestHandler } from "express";
import { roomsRouter } from "./routes/rooms.js";
import { bookingsRouter } from "./routes/bookings.js";

// Corps JSON illisible : 400 en JSON, sans renvoyer la pile d'appel au client.
const jsonErrors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "corps JSON invalide" });
    return;
  }
  next(error);
};

/**
 * Construit l'application Express (sans la demarrer).
 */
export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/rooms", roomsRouter);
  app.use("/bookings", bookingsRouter);
  app.use(jsonErrors);
  return app;
}
