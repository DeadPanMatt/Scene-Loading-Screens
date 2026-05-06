# Changelog

All notable changes to **Scene Loading Screens** are documented in this file.

---

## 2026-05-06 - (v1.2.1)

### Added
- Optional per-scene loading **progress bar** that overlays the selected media. Toggle via the new "Show loading progress bar" checkbox in the Timing section of the scene config form.
- Accurate progress tracking driven by Foundry's own texture loader: `SceneNavigation.displayProgressBar` is wrapped (with fallback to `foundry.applications.ui.SceneNavigation` for v13+) so the bar reflects actual asset-loading percentage, anchored by `canvasInit` (0%) and `canvasReady` (100%).
- Per-scene **progress bar label** field (free text, e.g. "Loading…"). Leaving it blank hides the label but keeps the spinner.
- CSS **spinner** that rotates next to the label for as long as the loading screen is visible (animation runs purely from CSS; stops automatically when the overlay element is removed on close).
- This change log added to acuratly depict the chnges made before / during release and chnages made in the future
- Addition of images and videos to readme.md

### Changed
- Pre-activation delay extended from a fixed 250 ms to `max(1000ms, fadeIn + 250)` so the overlay is fully faded in (and the socket message has reached all clients) before `scene.activate()` triggers texture loading. Eliminates the brief canvas flicker some users saw on slower clients.


---

## 2026-05-04 - (v1.1.0)

### Added
- **Volume slider** (0–100%) in the scene config form, applied to both video and audio playback.
- Live percentage readout next to the slider, with click-and-hold to step the value up or down.
- `volume` persisted via the per-scene flag (and shared with the presets system), so it survives reloads and applies on both preview and real loading-screen playback.
- Font colour and Text position controls were rendering outside the `sls-inline-row` container because the wrapping `<div>` was closing too early; the form layout now correctly keeps them side by side.

---

## 2026-05-04 - (v1.0.0 - Initial release)

### Added

- Foundry VTT module **Scene Loading Screens** (id: `scene-loading-screens`).
- Per-scene loading screen configuration stored as a scene flag.
- Scene-directory **context menu** entries: Create / Edit / Remove / Play loading screen (GM-only).
- Full-screen DOM **overlay** rendered above the canvas, supporting:
  - Image
  - Video (with autoplay, optional loop, mute when separate audio is set)
  - Audio (independent track, plays alongside muted video)
  - Overlay text with bold / italic / underline rich-text editing
  - Configurable font size and colour
  - **5×5 position picker** for text anchoring with hover preview marker
  - Media fit modes: contain / cover / stretch / original
- **Fade in** and **fade out** timing controls (milliseconds).
- Optional auto-close **duration** in seconds; otherwise the GM closes the overlay manually via the close button.
- GM **Play** action that broadcasts the overlay to all clients via socket, then activates the scene.
- **Presets** system: save reusable loading-screen configurations and load them into the form (`PresetsManagerApp` accessible from module settings).
- **Custom defaults**: save the current form values as the baseline applied to every new loading-screen configuration.
- Localization scaffolding (`lang/en.json`) covering all form fields, hints, menu entries, and notifications.
