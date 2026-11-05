# Combat and hangar update

## Delivered

- Rebuilt kaiju elbow targets relative to its forward-offset shoulders, rather than
  the actor origin. Corrected idle, walking/running arm tracks, claw attacks, double
  claw, two-arm slam, breath and roar. Leg locomotion remains from the downloaded rig.
- Selectable live 3D equipment bay with persistent choice. Vanguard: plasma +15%;
  Bastion: speed -20%, incoming damage -22%, melee +20%, missiles +60%;
  Raptor: speed +20%, incoming damage +15%, blade +40%. Tradeoffs are deliberate.
- Three original equipment refits of one downloaded chassis, explicitly labeled.
  This does not meet the separate request for several independent movie-mech models.
- Dedicated left/right sweeping blade clips, dual blades for Raptor, tapered 3D
  weapon mesh and bounded continuous swept-surface trails.
- Hand-mounted plasma charge rings, larger plasma core, spatial projectile trails,
  arcing missiles and persistent missile smoke. Skill casts face the target.
- Sequential dorsal charge nodes, layered volumetric breath strands, hot knots,
  smoke and existing timed ground hazards. Combat callouts identify skill stages.
- Combat camera remains near the actors instead of climbing above rooftops.
  Foreground building facades, windows and roof units fade out and restore after
  occlusion; shared materials are isolated and damage remains active.
- Return from a battle rebuilds the selected preview; restart preserves selection.

## Verification

`npm test`, `npm run build`, and Playwright scripts in `scripts/`.
`release-v7-smoke.js` checks selection/persistence, visible equipment differences,
actual damage/protection differences, and full animation cycles plus transitions.
The anatomical regression uses the actor's forward axis: both wrists must remain
at least 0.25 world units ahead of their elbows for all sampled living combat clips.
`capture-beast-v7.js` supplies side views; `capture-skills-v7.js` captures actual
simulated casts for visual inspection. Captures are diagnostic views, not trailers.

## Still below a finished commercial game

One base mech and one enemy asset; no independent roster of film-quality models.
Refit attachments and much of the environment still use generated geometry.
No campaign, multi-enemy encounters, progression, saved campaign or authored audio.
Combat uses simplified range/sector hit tests instead of full body contact collision.
New effects improve skill readability; they do not constitute film-quality VFX.

Additional browser checks: `weapon-v7-smoke.js` verifies dual blades, side-specific
clips, real ribbon geometry, charge stages, layered breath and effect cleanup.
`camera-v7-smoke.js` checks camera height, foreground fade, restoration and damage
while a building is faded.

The final HUD pass also fixes HP percentage and all three skill cooldown bars:
values previously clamped to 0–1 were mistakenly rendered as 0–1 percent. The HUD
now displays the selected refit name and visibly disables skills during cooldown.
`weapon-v7-smoke.js` verifies HP=73 renders 73% and half cooldown renders 50%.
