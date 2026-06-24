# ArcAIdia

> An immersive office-themed arcade by **ai&** — explore the office, beat three mini-games, earn coins, and win animated employee stickers from the claw machine.

Built for the **2026 Japan Hackathon**.

**Play it (GitHub Pages):** https://drbytebot.github.io/2026-japan-hackathon/
**Play it (Build.io):** https://arcadia-2026-japan-hackathon-556245b2.onbld.com/
**Repo:** https://github.com/drBYTEbot/2026-japan-hackathon

---

## What is it?

ArcAIdia is a single-page browser game set inside the **ai&** office. You walk around an isometric-ish top-down office hub as a little chibi character. Three glowing platforms in the office each launch a mini-game of increasing difficulty. Win a game to earn coins; lose and you get nothing and are kicked straight back to the office spawn point. Spend coins at the **claw machine** to unwrap animated 8-bit stickers of real ai& employees and build your collection.

Everything — graphics, audio, and game logic — is generated in code. There are **no external image or sound assets**: every character, monster, UI element, and SFX is drawn or synthesized at runtime on an HTML5 canvas.

### Core loop

1. **Office hub** — move with WASD/arrows, explore the office (reception, engineering bays, meeting room, lounge, plants, coffee machine, claw machine).
2. **Step on a platform** — a beam teleports you into the game it represents.
3. **Play the mini-game** — win → coins; lose → kicked out, no coins.
4. **Shop** — press the claw-machine button on the side of the screen, insert coins, win teammate stickers.

---

## The three mini-games

| # | Game | Style | Difficulty | Reward | Inspiration |
|---|------|-------|-----------|--------|-------------|
| 1 | **DESK JAM** | Sliding-block puzzle | Easy | **10 coins** | *Rush Hour*, re-skinned as an office of desks |
| 2 | **CROSSWALK** | Lane-crossing arcade | Medium | **30 coins** | *Crossy Road* — hop across roads dodging cars |
| 3 | **PIXEL BRAWL** | Turn-based JRPG | Hard | **50 coins** | *Final Fantasy I* — 8-bit party battle, 3 floors |

### DESK JAM (Easy · 10 coins)
A 6×6 sliding puzzle in the spirit of *Rush Hour*. The target car is an office worker on a wheeled cart trying to reach the EXIT; everything else is an L-shaped desk. Drag desks with the mouse along their axis to clear a path. Two hand-designed, **BFS-verified-solvable** puzzles (`MONDAY`, `DEADLINE`) are picked at random. 80-second time limit.

### CROSSWALK (Medium · 30 coins)
Hop your character row-by-row across an endless sequence of grass strips and traffic lanes. Cars spawn per-lane at varying speeds and directions; the camera slowly auto-scrolls upward once you pass row 4 — fall off the bottom and you're roadkill. Reach row 26 (the FINISH line) to win. Keyboard hop (arrows/WASD).

### PIXEL BRAWL (Hard · 50 coins)
A retro 8-bit turn-based battle in the style of *Final Fantasy I*.

- **Party select** — choose 3 teammates from a randomized roster of 9 ai& employees. Each employee has deterministic stats (HP, ATK, DEF, SPD, a signature SPECIAL, potions) derived from their name.
- **3 floors / bosses** — *Paper Jam* → *Meeting* → *The Deadline*. Each is a pixel-art monster (crumpled paper blob, calendar with teeth, clock demon).
- **Commands** — ATTACK, SPECIAL (limited uses), DEFEND (halves incoming damage), ITEM (coffee heals ~50–70 HP).
- **Initiative** — turn order sorted by SPD. Enemies can unleash a stronger CRUNCH attack on floors 2+.
- A partial heal between floors keeps the run going. Wipe on any floor → no coins.

---

## The Claw Machine shop

A side button shaped like a claw machine opens the shop overlay. The shop *is* a claw machine: an animated cabinet with floating capsule prizes, a claw that slides → drops → grabs → lifts → drops into the chute, and an **unwrapping reveal** with light rays and confetti.

- **Cost:** 20 coins per play.
- **Prizes:** animated character stickers of all **48 ai& employees** from the company directory (see list below).
- **Duplicates:** award 5 bonus coins instead.
- **Rarity:** some stickers sparkle (rare). New wins are highlighted; the collection grid (paginated) shows silhouettes for unowned stickers.

Every sticker is a deterministic, procedurally-drawn 8-bit chibi avatar — skin tone, hair style/color, shirt, optional hat/beanie/top-hat, glasses, bow — all seeded from the employee's name, so each person looks consistent and unique.

### Employee directory (prize pool)

Saria · Noa · Feifan · Noah · Hana · Sumer · Shimpei · Misaki · David · Rajendra · Richard · Shinon · Lamu · Atul Anand · Sakuarko · Amelia · Mike · Millan · Mao · Nao · Tetsuya · Mutsumi · Mario · Sophia · Matt · Alex · Masamichi · Kazunori · Samantha · Mustafa · Yushi · Yagiz · Takanori · Takeru · Yu · Uchida · Obama · Jun · Ryuei · Ayuki · Satoshi · Hirokazu · Hiroyuki · John · Shearin · Akimitsu · Steven · Matthew · Yuhei

---

## How to play

| Input | Action |
|-------|--------|
| **WASD / Arrows** | Move in the office; hop in CROSSWALK; navigate menus |
| **Space / Enter** | Interact (enter a platform, confirm a menu choice) |
| **Mouse** | Drag desks in DESK JAM; click all buttons/menus |
| **Side claw button** | Open the shop (office only) |

Coins and your sticker collection persist in `localStorage`, so progress survives refreshes. Use the HUD mute/SFX toggles (top-right) to control audio.

---

## Architecture

```
arcadia/
├── index.html              # Single page, loads js/main.js as ES module
├── favicon.svg             # ai& logo
├── css/style.css          # Layout, boot screen, pixel rendering
├── serve.js               # Zero-dependency static server (for local dev)
├── js/
│   ├── main.js            # App class: state machine, game loop, scaling, audio boot, title screen
│   ├── ui.js              # Input (keyboard+pointer), immediate-mode UI (button/panel/bar), ai& logo
│   ├── hud.js             # Persistent HUD: brand, animated coin counter, sound toggles, toasts
│   ├── util.js            # Math, RNG, palettes, localStorage save, pixel font + text, particles, screen shake
│   ├── audio.js           # WebAudio SFX (synth) + looping chiptune music per scene
│   ├── characters.js      # Employee roster + deterministic 8-bit avatar/sticker generator
│   ├── office.js          # Hub scene: office layout, furniture, 3 platforms, claw machine, spawn point
│   ├── rushhour.js        # Game 1 (Easy): sliding-desk puzzle + pure BFS solver (verified solvable)
│   ├── crossyroad.js      # Game 2 (Medium): hop-and-dodge lane crosser
│   ├── fighting.js       # Game 3 (Hard): turn-based JRPG, party select, 3 bosses
│   └── clawshop.js        # Claw machine shop + sticker collection grid + reveal animation
├── package.json
└── README.md
```

### Design principles

- **Zero assets.** All art is drawn to a 960×540 canvas with a custom 5×7 pixel font and primitive shapes; all audio is synthesized with the WebAudio API. The repo stays tiny and the game loads instantly.
- **Deterministic avatars.** `mulberry32(hashStr(name))` seeds each employee's appearance, so a given teammate always looks the same — across the roster picker, the battle party, and their sticker.
- **Verified puzzles.** The Rush Hour solver (`solve()` in `rushhour.js`) is a pure BFS over the sliding-block state space; both shipped puzzles are confirmed solvable by an automated test.
- **Immediate-mode UI.** Buttons/panels are drawn and hit-tested every frame in `ui.js` — no DOM widgets, no framework, everything renders inside the canvas for a cohesive look.
- **Scene state machine.** `main.js` owns `state ∈ {title, office, rush, crossy, fight, shop}`. Each scene implements `onEnter()`, `update(dt)`, `draw(ctx)`. `exitGame(outcome, reward)` and `openShop()/closeShop()` are the only transitions, guaranteeing the "win/lose → back to the single spawn point" contract.
- **Progressive difficulty & rewards.** 10 / 30 / 50 coins map to Easy / Medium / Hard; the claw machine costs 20, so one Hard win ≈ two-and-a-half pulls.

### Save schema (`localStorage` key `arcadia_save_v1`)

```jsonc
{
  "coins": 120,          // spendable currency
  "owned": ["Saria"],    // employee names unlocked as stickers
  "best": { "rush": 8 }  // best score per game (extensible)
}
```

---

## Run locally

No build step — it's plain ES modules served as static files.

```bash
# option A: the bundled zero-dep server
node serve.js
# → http://localhost:8080

# option B: any static server
python3 -m http.server 8080
# → http://localhost:8080
```

Then open the URL and click to start (the click unlocks browser audio).

### Headless test

```bash
npm install
node serve.js &        # in the background
node test_smoke.mjs    # headless Chromium: loads every scene, asserts no console/page errors
```

---

## Deploy

ArcAIdia is a static site — host the `arcadia/` directory anywhere.

### GitHub Pages (used for the live demo)

```bash
gh repo create 2026-japan-hackathon --public --source=. --push
gh api -X POST /repos/<USER>/2026-japan-hackathon/pages -f source[branch]=main -f source[path]=/
# → https://<USER>.github.io/2026-japan-hackathon/
```

### Build.io (also deployed)

The Build.io CLI (`bld`) deploys straight from a Git remote (Heroku-style). This app uses the Node.js buildpack with a zero-dependency static server (`serve.js`) declared in the `Procfile`:

```bash
bld login                                          # authenticate (browser OAuth)
bld apps:create arcadia-2026-japan-hackathon       # create the app (lowercase)
bld buildpacks:set heroku/nodejs -a arcadia-2026-japan-hackathon
GIT_URL=$(bld apps:info -a arcadia-2026-japan-hackathon -j | jq -r '.git_url')
git remote add bld "$GIT_URL"
git push bld main                                  # build + deploy
bld ps:scale web=1 -a arcadia-2026-japan-hackathon # (auto-scaled on push)
```

> The app name on Build.io must be lowercase, so it's `arcadia-2026-japan-hackathon` (the project itself is titled **2026 Japan Hackathon**). The live Build.io URL is shown above.

---

## Credits

Game design & implementation: 2026 Japan Hackathon team, for **ai&**.
Employee names used as sticker prizes are from the ai& company directory.
```
