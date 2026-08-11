# Jutsu VFX Library v1.7 — Multiplayer

This build changes the VFX from a local scene item to a shared scene item.

## VFX
The caster uses `OBR.scene.items.addItems(...)`, so the animation is part of the real Owlbear Scene and all connected players see it. The caster deletes the shared item after the technique duration.

## Audio
The selected MP3/WAV/OGG remains stored in the caster's browser.
When cast:
1. The caster reads the local audio.
2. It is split into JSON-safe chunks smaller than Owlbear Broadcast's 16 KB limit.
3. The chunks are sent with `destination: "ALL"`.
4. `background.html` is loaded by Owlbear for every player.
5. `src/background.js` reconstructs the audio and plays it locally for that player.

The manifest requests Owlbear's `autoplay` permission.

For reliability use short compressed SFX (MP3/OGG). This build limits multiplayer audio to about 1.2 MB per sound.

## IMPORTANT: localhost is NOT multiplayer
`http://localhost:5173/manifest.json` only exists on your own computer.
Other players cannot load your background listener from your localhost.

For internet multiplayer, deploy the extension to a public HTTPS host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.) and add the public manifest URL to Owlbear.

Example:
`https://your-jutsu-vfx.vercel.app/manifest.json`

## Build
npm install
npm run build

The deployable static output is the `dist/` folder.

deploy trigger
