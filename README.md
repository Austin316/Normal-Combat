# Normal Combat

A Mortal Kombat–style browser fighting game starring normal, everyday neighbors.
Story, characters and rules live in [`docs/STORY.md`](docs/STORY.md).

## Status
**Engine prototype.** Fighters are placeholder boxes; the moves, stats, rounds and finishers are real.
Pixel-art sprites get swapped in later.

## Play
Open `index.html` in a browser, or use the GitHub Pages link.

| Action | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | ← / → |
| Jump | W | ↑ |
| Crouch | S | ↓ |
| Punch (crouch = Uppercut) | F | K |
| Kick (crouch = Sweep, in air = Air Kick) | G | L |
| Block | H | ; |
| Special 1 / 2 / 3 | R / T / Y | I / O / P |
| Taunt | Q | U |

- **Character select:** P1 uses A/D, P2 uses ←/→, **C** switches Player 2 between CPU and human, **Enter** starts.
- **Finishers:** after the deciding KO, the screen shows **FINAL NOTICE!** Press Special 1 for **VIOLATION!** or Special 2 for **NEIGHBORLY!**
- **Esc** pauses. **`** (backtick) shows hitboxes.

## Files
- `js/characters.js` — fighter data (stats, moves, quotes, finishers). Tune the game here.
- `js/game.js` — the engine.
