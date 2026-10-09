import { createApp } from "../src/app.js";

/** Lance l'app sur un port libre, envoie une requete, renvoie statut + corps JSON. */
export async function call(path: string, init?: RequestInit) {
  const server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, init);
    // Corps JSON non type : chaque test assert sur la forme qu'il attend.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await res.json();
    return { status: res.status, body };
  } finally {
    server.close();
  }
}

/** POST /bookings avec un corps JSON. */
export const post = (payload: unknown) =>
  call("/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
