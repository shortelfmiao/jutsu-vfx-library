import OBR from "@owlbear-rodeo/sdk";

const ID = "com.baba.jutsu-vfx-library";
const AUDIO_CH = `${ID}/audio`;

const incoming = new Map();

function base64ToBytes(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function cleanup(eventId) {
  const entry = incoming.get(eventId);
  if (entry?.timer) clearTimeout(entry.timer);
  incoming.delete(eventId);
}

async function tryPlay(eventId) {
  const entry = incoming.get(eventId);
  if (!entry || entry.received !== entry.total) return;

  try {
    const decoded = entry.parts.map((p) => base64ToBytes(p));
    const totalBytes = decoded.reduce((sum, p) => sum + p.length, 0);
    const merged = new Uint8Array(totalBytes);

    let offset = 0;
    for (const part of decoded) {
      merged.set(part, offset);
      offset += part.length;
    }

    const blob = new Blob([merged], { type: entry.mime || "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1;

    const revoke = () => URL.revokeObjectURL(url);
    audio.addEventListener("ended", revoke, { once: true });
    audio.addEventListener("error", revoke, { once: true });

    await audio.play();
  } catch (error) {
    console.error("Jutsu multiplayer audio failed:", error);
  } finally {
    cleanup(eventId);
  }
}

OBR.onReady(() => {
  OBR.broadcast.onMessage(AUDIO_CH, async (event) => {
    const data = event.data;
    if (!data?.eventId) return;

    if (data.type === "start") {
      cleanup(data.eventId);

      const entry = {
        total: Number(data.total) || 0,
        received: 0,
        parts: new Array(Number(data.total) || 0),
        mime: data.mime || "audio/mpeg",
        name: data.name || "jutsu-sfx",
        timer: null,
      };

      entry.timer = setTimeout(() => cleanup(data.eventId), 30000);
      incoming.set(data.eventId, entry);
      return;
    }

    if (data.type === "chunk") {
      let entry = incoming.get(data.eventId);

      // Be tolerant if a chunk arrives before the start packet.
      if (!entry) {
        entry = {
          total: Number(data.total) || 0,
          received: 0,
          parts: new Array(Number(data.total) || 0),
          mime: "audio/mpeg",
          name: "jutsu-sfx",
          timer: setTimeout(() => cleanup(data.eventId), 30000),
        };
        incoming.set(data.eventId, entry);
      }

      if (
        Number.isInteger(data.index) &&
        data.index >= 0 &&
        data.index < entry.total &&
        typeof data.data === "string" &&
        !entry.parts[data.index]
      ) {
        entry.parts[data.index] = data.data;
        entry.received += 1;
      }

      await tryPlay(data.eventId);
    }
  });
});
