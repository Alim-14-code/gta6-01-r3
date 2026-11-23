# Port Aurora — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Alim-14-code/gta6-01-r3/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Alim-14-code/gta6-01-r3/reward.svg)](https://make.fun/bounty/gta6-01)

**Port Aurora** is a complete open-world crime game in the spirit of GTA 6, built
for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). It runs
entirely offline in a desktop browser from static files — no build step, no
network request, no assets downloaded from anywhere. Every street, character,
vehicle, name and story in it is original.

You play **Jace Marlowe**, a getaway driver in the sun-soaked coastal city of
Port Aurora, working off a debt to the fixer **Mara Voss** — one job at a time.

## What is in the game

- **A living city**: five districts (Downtown, Old Town, the Harbor, the Marina,
  the Suburbs), a beach, parks and plazas, day traffic and pedestrians.
- **On foot and by car**: walk, run, steal any parked or moving car, drive with
  arcade handling, handbrake slides and crashes.
- **Wanted level and police**: 5 stars, police cruisers that chase, ram and try
  to bust you; lay low to cool off.
- **Missions and a story**: 6 story jobs from Mara Voss — getaways, deliveries,
  a car theft, losing a tail, an exchange, and a final bank job — with timers,
  cash rewards and a story ending.
- **Combat**: a pistol (mouse aim, click to shoot), police who shoot back,
  health, and busted / wasted consequences.
- **HUD with a minimap**: wanted stars, health, cash, mission objective, live
  minimap with police and waypoint, speedometer while driving.
- **Start and save**: title screen, pause menu, and progress saved in the
  browser (cash and missions completed).

## Play it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive |
| Shift | Run on foot |
| Space | Handbrake (in car) |
| E | Enter / steal car, exit car, interact |
| Mouse + click | Aim and shoot (on foot) |
| R | Reload |
| H | Horn |
| P / Esc | Pause |
| M | Mute |

## Files

- `game/` — the playable game (static files, ES modules, no libraries)
- `game/src/` — one module per system: city, traffic, police, pedestrians,
  missions, combat, HUD, audio, save, rendering
- `screenshots/` — 4 real renders of the game
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json` (Node 22+, standard library only)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `shots.json` — the staged screenshot scenes (`?shot=…&seed=…`)

## License

MIT — see [LICENSE](LICENSE).
