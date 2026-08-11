
import OBR, { buildImage, buildImageUpload, buildLine } from "@owlbear-rodeo/sdk";
import "./style.css";

const ID = "com.baba.jutsu-vfx-library";
const META = `${ID}/library`;
const AUDIO_CH = `${ID}/audio`;

const AUDIO_DB = "jutsu-vfx-audio-db-v1";
const AUDIO_STORE = "audio";
const AUDIO_LIBRARY_KEY = `${ID}/audio-library-v1`;
const AUDIO_CHUNK_BYTES = 9000;
const MAX_AUDIO_BYTES = 1200000; // ~1.2 MB; short MP3/OGG SFX recommended

let library = { characters: [] };
let selC = null;
let selK = null;
let selJ = null;
let editing = null;
let armed = false;
let previewIds = [];
let audioLibrary = [];

const uid = (p) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);

function openAudioDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AUDIO_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(AUDIO_STORE)) {
        req.result.createObjectStore(AUDIO_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveAudioBlob(id, blob) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAudioBlob(id) {
  if (!id) return null;
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(AUDIO_STORE, "readonly").objectStore(AUDIO_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function loadAudioLibrary() {
  try {
    const raw = localStorage.getItem(AUDIO_LIBRARY_KEY);
    audioLibrary = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(audioLibrary)) audioLibrary = [];
  } catch {
    audioLibrary = [];
  }
}

function saveAudioLibrary() {
  localStorage.setItem(AUDIO_LIBRARY_KEY, JSON.stringify(audioLibrary));
}

function migrateLibrary() {
  if (!library || !Array.isArray(library.characters)) library = { characters: [] };
  for (const c of library.characters) {
    if (!Array.isArray(c.categories)) c.categories = [];
    for (const k of c.categories) {
      if (!Array.isArray(k.jutsus)) k.jutsus = [];
    }
  }
}

async function load() {
  const m = await OBR.room.getMetadata();
  if (m[META]?.characters) library = m[META];
  migrateLibrary();
  if (!m[META]?.characters) await save();
}

async function save() {
  await OBR.room.setMetadata({ [META]: library });
}

const C = () => library.characters.find((x) => x.id === selC);
const K = () => C()?.categories.find((x) => x.id === selK);
const J = () => K()?.jutsus.find((x) => x.id === selJ);

function newJutsuData() {
  return {
    name: "New Technique",
    vfxUrl: "",
    vfxName: "",
    soundId: "",
    soundName: "",
    soundMime: "",
    mime: "video/webm",
    width: 500,
    height: 500,
    duration: 1000,
    scale: 1,
  };
}

function render() {
  const c = C(), k = K(), j = J();

  document.querySelector("#app").innerHTML = `
  <div class="app">
    <header>
      <div>
        <b>JUTSU VFX</b>
        <small>Multiplayer VFX + Audio · v1.7</small>
      </div>
      <button id="newC">＋ Character</button>
    </header>

    <div class="layout">
      <aside>
        ${library.characters.map((x) => `
          <button class="tree c ${x.id === selC ? "on" : ""}" data-c="${x.id}">
            ▾ <b>${esc(x.name)}</b>
          </button>

          ${x.id === selC ? x.categories.map((y) => `
            <button class="tree k ${y.id === selK ? "on" : ""}" data-k="${y.id}">
              ▾ ${esc(y.name)}
            </button>

            ${y.id === selK ? y.jutsus.map((z) => `
              <button class="tree j ${z.id === selJ ? "on" : ""}" data-j="${z.id}">
                ⚔ ${esc(z.name)}
              </button>
            `).join("") : ""}
          `).join("") : ""}
        `).join("")}
      </aside>

      <main>
        ${
          editing
            ? form()
            : j
              ? panel(j, c, k)
              : emptyPanel(c, k)
        }
      </main>
    </div>
  </div>`;

  bind();
}

function emptyPanel(c, k) {
  return `
    <div class="empty">
      <div>⚔</div>
      <h2>${esc(k?.name || c?.name || "Jutsu VFX Library")}</h2>
      <p>${k ? "Bu kategoriye teknik ekleyebilirsin." : c ? "Kategori seç veya yeni kategori oluştur." : "Karakter oluşturarak başla."}</p>
      <div class="buttons centerButtons">
        ${c ? `<button id="newK" class="primary">＋ New Category</button>` : ""}
        ${k ? `<button id="newJ" class="techniqueBtn">＋ Technique</button>` : ""}
      </div>
    </div>`;
}

function panel(j, c, k) {
  return `
    <section>
      <small>${esc(c.name)} › ${esc(k.name)}</small>
      <div class="panelTitle">
        <h1>${esc(j.name)}</h1>
        <button id="newJ" class="techniqueBtn">＋ Technique</button>
      </div>

      <div class="files">
        <b>Animation</b><span>${esc(j.vfxName || "Not selected")}</span>
        <b>Sound</b><span>${esc(j.soundName || "Not selected")}</span>
      </div>

      <div class="previewInfo">
        <span class="previewDot"></span>
        Cast'e bastıktan sonra mouse'u hareket ettir. Kırmızı nişangâh animasyonun geleceği noktayı gösterir.
      </div>

      ${(location.hostname === "localhost" || location.hostname === "127.0.0.1") ? `
      <div class="multiplayerWarning">
        Multiplayer ses için extension'ı public HTTPS adrese deploy etmelisin. localhost sadece senin bilgisayarında çalışır.
      </div>` : `
      <div class="multiplayerOk">● Multiplayer endpoint aktif</div>`}

      <div class="buttons">
        <button id="cast" class="primary">${armed ? "🖱️ CLICK PREVIEW POINT" : "⚡ CAST ON MAP"}</button>
        <button id="edit">Edit</button>
        <button id="del" class="danger">Delete</button>
      </div>

      <p class="meta">${j.width}×${j.height} · ${j.duration} ms · Asset VFX: ${j.vfxUrl ? "yes" : "no"}</p>
    </section>`;
}

function soundOptions(currentId = "") {
  const opts = [
    `<option value="">— Saved sound seç —</option>`,
    ...audioLibrary.map((a) =>
      `<option value="${esc(a.id)}" ${a.id === currentId ? "selected" : ""}>${esc(a.name)}</option>`
    ),
  ];
  return opts.join("");
}

function form() {
  const d = editing.data;
  const isJ = editing.type === "jutsu";

  return `
    <section class="form">
      <h2>${editing.existing ? "Edit" : "New"} ${editing.type === "jutsu" ? "Technique" : editing.type}</h2>

      <label>
        Name
        <input id="name" value="${esc(d.name)}">
      </label>

      ${isJ ? `
        <div class="asset">
          <b>Animation Asset</b>
          <div class="assetButtons">
            <button id="uploadVfx">＋ Upload New</button>
            <button id="existingVfx">📁 Choose Existing</button>
          </div>
          <span id="vfxLabel">${esc(d.vfxName || "No asset selected")}</span>
          <small>Yüklediğin animasyon Owlbear Assets içinde kalır; sonraki girişlerde "Choose Existing" ile tekrar kullanabilirsin.</small>
        </div>

        <div class="asset">
          <b>Sound Library</b>
          <div class="assetButtons">
            <button id="uploadSound">＋ Upload New Sound</button>
          </div>
          <select id="savedSound">${soundOptions(d.soundId || "")}</select>
          <span id="soundLabel">${esc(d.soundName || "No sound selected")}</span>
          <small>Sesler bu tarayıcıda kalıcı olarak saklanır ve listeden tekrar seçilebilir.</small>
        </div>

        <div class="grid">
          <label>Width<input id="w" type="number" value="${d.width || 500}"></label>
          <label>Height<input id="h" type="number" value="${d.height || 500}"></label>
        </div>

        <div class="grid">
          <label>Duration ms<input id="dur" type="number" value="${d.duration || 1000}"></label>
          <label>Scale<input id="scale" step=".1" type="number" value="${d.scale || 1}"></label>
        </div>

        <label>
          MIME
          <select id="mime">
            <option value="video/webm" ${d.mime === "video/webm" ? "selected" : ""}>video/webm</option>
            <option value="video/mp4" ${d.mime === "video/mp4" ? "selected" : ""}>video/mp4</option>
            <option value="image/gif" ${d.mime === "image/gif" ? "selected" : ""}>image/gif</option>
            <option value="image/png" ${d.mime === "image/png" ? "selected" : ""}>image/png</option>
          </select>
        </label>
      ` : ""}

      <div class="buttons">
        <button id="save" class="primary">Save</button>
        <button id="cancel">Cancel</button>
      </div>
    </section>`;
}

function bind() {
  document.querySelectorAll("[data-c]").forEach((b) => {
    b.onclick = async () => {
      await clearPreview();
      armed = false;
      selC = b.dataset.c;
      selK = null;
      selJ = null;
      editing = null;
      render();
    };
  });

  document.querySelectorAll("[data-k]").forEach((b) => {
    b.onclick = async () => {
      await clearPreview();
      armed = false;
      selK = b.dataset.k;
      selJ = null;
      editing = null;
      render();
    };
  });

  document.querySelectorAll("[data-j]").forEach((b) => {
    b.onclick = async () => {
      await clearPreview();
      armed = false;
      selJ = b.dataset.j;
      editing = null;
      render();
    };
  });

  document.querySelector("#newC")?.addEventListener("click", () => {
    editing = { type: "Character", data: { name: "New Character" } };
    render();
  });

  document.querySelector("#newK")?.addEventListener("click", () => {
    editing = { type: "Category", data: { name: "New Category" } };
    render();
  });

  document.querySelector("#newJ")?.addEventListener("click", () => {
    if (!K()) return;
    editing = { type: "jutsu", existing: false, data: newJutsuData() };
    render();
  });

  document.querySelector("#edit")?.addEventListener("click", () => {
    editing = { type: "jutsu", existing: true, data: structuredClone(J()) };
    render();
  });

  document.querySelector("#del")?.addEventListener("click", async () => {
    await clearPreview();
    armed = false;
    K().jutsus = K().jutsus.filter((x) => x.id !== selJ);
    selJ = null;
    await save();
    render();
  });

  document.querySelector("#cancel")?.addEventListener("click", () => {
    editing = null;
    render();
  });

  document.querySelector("#save")?.addEventListener("click", saveEdit);
  document.querySelector("#uploadVfx")?.addEventListener("click", uploadVfx);
  document.querySelector("#existingVfx")?.addEventListener("click", chooseExistingVfx);
  document.querySelector("#uploadSound")?.addEventListener("click", uploadSound);

  document.querySelector("#savedSound")?.addEventListener("change", (e) => {
    const id = e.target.value;
    const entry = audioLibrary.find((a) => a.id === id);
    if (!entry) {
      editing.data.soundId = "";
      editing.data.soundName = "";
      editing.data.soundMime = "";
      document.querySelector("#soundLabel").textContent = "No sound selected";
      return;
    }
    editing.data.soundId = entry.id;
    editing.data.soundName = entry.name;
    editing.data.soundMime = entry.mime;
    document.querySelector("#soundLabel").textContent = entry.name;
  });

  document.querySelector("#cast")?.addEventListener("click", async () => {
    const j = J();
    if (!j?.vfxUrl) {
      await OBR.notification.show("Önce bu tekniğe bir animasyon asset seç.");
      return;
    }

    armed = true;
    await OBR.tool.activateMode(`${ID}/tool`, `${ID}/mode`);
    render();
  });
}

async function uploadVfx() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".webm,.mp4,.mov,.gif,.png,image/*,video/*";

  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;

    try {
      const data = await f.arrayBuffer();
      const copy = new File([data], f.name, { type: f.type });
      await OBR.assets.uploadImages([buildImageUpload(copy).build()]);

      const found = await OBR.assets.downloadImages(false, f.name);
      if (!found?.length) {
        await OBR.notification.show("Upload tamamlandı. Asset picker'dan yüklediğin dosyayı seç.");
        return;
      }

      applyVfxAsset(found[0], f);
    } catch (e) {
      console.error(e);
      alert("Owlbear asset upload failed: " + e.message);
    }
  };

  input.click();
}

async function chooseExistingVfx() {
  try {
    const found = await OBR.assets.downloadImages(false);
    if (!found?.length) return;
    applyVfxAsset(found[0]);
  } catch (e) {
    console.error(e);
    alert("Asset picker failed: " + e.message);
  }
}

function applyVfxAsset(a, fallbackFile = null) {
  editing.data.vfxName = a.name || fallbackFile?.name || "Animation";
  editing.data.vfxUrl = a.image.url;
  editing.data.mime = a.image.mime || fallbackFile?.type || "video/webm";
  editing.data.width = a.image.width || editing.data.width || 512;
  editing.data.height = a.image.height || editing.data.height || 512;

  const label = document.querySelector("#vfxLabel");
  if (label) label.textContent = editing.data.vfxName;

  const mime = document.querySelector("#mime");
  if (mime && [...mime.options].some((o) => o.value === editing.data.mime)) {
    mime.value = editing.data.mime;
  }

  const w = document.querySelector("#w");
  const h = document.querySelector("#h");
  if (w) w.value = editing.data.width;
  if (h) h.value = editing.data.height;
}

async function uploadSound() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".mp3,.wav,.ogg,audio/*";

  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;

    const id = uid("snd");
    const data = await f.arrayBuffer();
    const blob = new Blob([data], { type: f.type || "audio/mpeg" });

    await saveAudioBlob(id, blob);

    const entry = {
      id,
      name: f.name,
      mime: f.type || "audio/mpeg",
    };

    audioLibrary.push(entry);
    saveAudioLibrary();

    editing.data.soundId = id;
    editing.data.soundName = entry.name;
    editing.data.soundMime = entry.mime;

    const select = document.querySelector("#savedSound");
    if (select) {
      select.innerHTML = soundOptions(id);
      select.value = id;
    }

    const label = document.querySelector("#soundLabel");
    if (label) label.textContent = entry.name;
  };

  input.click();
}

async function saveEdit() {
  const name = document.querySelector("#name").value.trim();
  if (!name) return;

  if (editing.type === "Character") {
    const c = { id: uid("char"), name, categories: [] };
    library.characters.push(c);
    selC = c.id;
  } else if (editing.type === "Category") {
    const k = { id: uid("cat"), name, jutsus: [] };
    C().categories.push(k);
    selK = k.id;
  } else {
    const d = editing.data;

    const out = {
      id: d.id || uid("jutsu"),
      name,
      vfxUrl: d.vfxUrl || "",
      vfxName: d.vfxName || "",
      soundId: d.soundId || "",
      soundName: d.soundName || "",
      soundMime: d.soundMime || "",
      // Backwards compatibility with older versions:
      soundDataB64: d.soundDataB64 || null,
      mime: d.mime || document.querySelector("#mime")?.value || "video/webm",
      width: Number(document.querySelector("#w").value) || 500,
      height: Number(document.querySelector("#h").value) || 500,
      duration: Number(document.querySelector("#dur").value) || 1000,
      scale: Number(document.querySelector("#scale").value) || 1,
    };

    const k = K();
    if (editing.existing) {
      k.jutsus[k.jutsus.findIndex((x) => x.id === out.id)] = out;
    } else {
      k.jutsus.push(out);
      selJ = out.id;
    }
  }

  editing = null;
  await save();
  render();
}

function legacyAudioBlob(j) {
  if (!j.soundDataB64) return null;
  const bytes = new Uint8Array(j.soundDataB64);
  return new Blob([bytes], { type: j.soundMime || "audio/mpeg" });
}

function bytesToBase64(bytes) {
  let binary = "";
  const BLOCK = 0x4000;
  for (let i = 0; i < bytes.length; i += BLOCK) {
    const slice = bytes.subarray(i, Math.min(i + BLOCK, bytes.length));
    let part = "";
    for (let k = 0; k < slice.length; k++) {
      part += String.fromCharCode(slice[k]);
    }
    binary += part;
  }
  return btoa(binary);
}

async function getJutsuAudioBlob(j) {
  if (j.soundId) {
    const blob = await getAudioBlob(j.soundId);
    if (blob) return blob;
  }
  return legacyAudioBlob(j);
}

async function broadcastSound(j) {
  const blob = await getJutsuAudioBlob(j);
  if (!blob) return;

  if (blob.size > MAX_AUDIO_BYTES) {
    await OBR.notification.show(
      `Ses dosyası multiplayer için çok büyük (${Math.round(blob.size / 1024)} KB). 1.2 MB altı kısa MP3/OGG kullan.`
    );
    return;
  }

  const buffer = new Uint8Array(await blob.arrayBuffer());
  const eventId = crypto.randomUUID();
  const total = Math.ceil(buffer.length / AUDIO_CHUNK_BYTES);

  await OBR.broadcast.sendMessage(
    AUDIO_CH,
    {
      type: "start",
      eventId,
      total,
      mime: blob.type || j.soundMime || "audio/mpeg",
      name: j.soundName || "jutsu-sfx",
    },
    { destination: "ALL" }
  );

  for (let index = 0; index < total; index++) {
    const start = index * AUDIO_CHUNK_BYTES;
    const chunk = buffer.subarray(start, Math.min(start + AUDIO_CHUNK_BYTES, buffer.length));

    await OBR.broadcast.sendMessage(
      AUDIO_CH,
      {
        type: "chunk",
        eventId,
        index,
        total,
        data: bytesToBase64(chunk),
      },
      { destination: "ALL" }
    );

    // Avoid hammering the room on larger SFX.
    if (index > 0 && index % 24 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }
}

async function playShared(j, pos) {
  if (!j.vfxUrl) {
    await OBR.notification.show("No animation asset selected.");
    return;
  }

  const item = buildImage(
    {
      width: j.width,
      height: j.height,
      url: j.vfxUrl,
      mime: j.mime,
    },
    {
      dpi: 72,
      // Keep the click-anchor correction from v1.5:
      offset: { x: j.width / 2, y: j.height * 0.45 },
    }
  )
    .name(j.name)
    .position(pos)
    .layer("ATTACHMENT")
    .disableHit(true)
    .disableAutoZIndex(true)
    .scale({ x: j.scale, y: j.scale })
    .build();

  // Shared Scene item: every connected player sees the same VFX.
  await OBR.scene.items.addItems([item]);

  // Sound is sent to every extension background iframe.
  await broadcastSound(j);

  setTimeout(() => {
    OBR.scene.items.deleteItems([item.id]).catch(() => {});
  }, Math.max(100, j.duration || 1000));
}

async function clearPreview() {
  if (!previewIds.length) return;
  const ids = [...previewIds];
  previewIds = [];
  try {
    await OBR.scene.local.deleteItems(ids);
  } catch {}
}

async function showPreview(pos) {
  if (!armed) return;

  const size = 34;
  if (!previewIds.length) {
    const h = buildLine()
      .startPosition({ x: pos.x - size, y: pos.y })
      .endPosition({ x: pos.x + size, y: pos.y })
      .strokeColor("#ff365f")
      .strokeOpacity(0.95)
      .strokeWidth(3)
      .layer("ATTACHMENT")
      .disableHit(true)
      .disableAutoZIndex(true)
      .build();

    const v = buildLine()
      .startPosition({ x: pos.x, y: pos.y - size })
      .endPosition({ x: pos.x, y: pos.y + size })
      .strokeColor("#ff365f")
      .strokeOpacity(0.95)
      .strokeWidth(3)
      .layer("ATTACHMENT")
      .disableHit(true)
      .disableAutoZIndex(true)
      .build();

    previewIds = [h.id, v.id];
    await OBR.scene.local.addItems([h, v]);
  } else {
    await OBR.scene.local.updateItems(previewIds, (items) => {
      const h = items.find((x) => x.id === previewIds[0]);
      const v = items.find((x) => x.id === previewIds[1]);

      if (h) {
        h.startPosition = { x: pos.x - size, y: pos.y };
        h.endPosition = { x: pos.x + size, y: pos.y };
      }
      if (v) {
        v.startPosition = { x: pos.x, y: pos.y - size };
        v.endPosition = { x: pos.x, y: pos.y + size };
      }
    }, true);
  }
}

OBR.onReady(async () => {
  loadAudioLibrary();
  await load();
  render();

  await OBR.tool.create({
    id: `${ID}/tool`,
    icons: [{ icon: "/icon.svg", label: "Jutsu VFX" }],
    defaultMode: `${ID}/mode`,
  });

  await OBR.tool.createMode({
    id: `${ID}/mode`,
    icons: [
      {
        icon: "/icon.svg",
        label: "Cast Jutsu",
        filter: { activeTools: [`${ID}/tool`] },
      },
    ],

    onToolMove: async (_, e) => {
      if (!armed) return;
      await showPreview(e.pointerPosition);
    },

    onToolClick: async (_, e) => {
      if (!armed) return false;

      const j = J();
      if (!j) return true;

      const position = {
        x: e.pointerPosition.x,
        y: e.pointerPosition.y,
      };

      armed = false;
      await clearPreview();
      render();

      await playShared(j, position);
      return true;
    },

    onDeactivate: async () => {
      armed = false;
      await clearPreview();
      render();
    },

    onKeyDown: async (_, e) => {
      if (e.key === "Escape") {
        armed = false;
        await clearPreview();
        render();
      }
    },
  });

});
