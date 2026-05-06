import { MODULE_ID, FLAG_KEY, SOCKET_NAME, debug } from "./constants.js";
import { LoadingScreenConfigApp } from "./config-app.js";
import { PresetsManagerApp } from "./presets-app.js";
import { Overlay } from "./overlay.js";

function getSceneConfig(scene) {
  return scene?.getFlag(MODULE_ID, FLAG_KEY) ?? null;
}

async function setSceneConfig(scene, data) {
  return scene.setFlag(MODULE_ID, FLAG_KEY, data);
}

async function clearSceneConfig(scene) {
  return scene.unsetFlag(MODULE_ID, FLAG_KEY);
}

function openConfigDialog(scene) {
  new LoadingScreenConfigApp({ scene }).render(true);
}

async function confirmRemove(scene) {
  const proceed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("SLS.RemoveTitle") },
    content: `<p>${game.i18n.format("SLS.RemoveConfirm", { name: scene.name })}</p>`,
    rejectClose: false,
    modal: true
  });
  if (proceed) await clearSceneConfig(scene);
}

async function play(sceneId) {
  if (!game.user.isGM) return;

  const scene = game.scenes.get(sceneId);
  if (!scene) return ui.notifications.warn(`Scene ${sceneId} not found.`);

  const config = getSceneConfig(scene);
  if (!config) return ui.notifications.warn(game.i18n.localize("SLS.NoConfig"));

  const payload = { action: "show", senderId: game.user.id, config };

  // Show overlay first
  game.socket.emit(SOCKET_NAME, payload);
  Overlay.show(config);

  // Give clients time to receive the socket message AND for the overlay
  // fade-in to fully cover the canvas before scene activation triggers
  // texture loading (which causes the visible flicker on slower clients).
  const fadeIn = Math.max(0, Number(config.fadeIn) || 0);
  const preActivateDelay = Math.max(1000, fadeIn + 250);
  await new Promise(resolve => setTimeout(resolve, preActivateDelay));

  // Then activate scene in background
  await scene.activate();
}

function stop() {
  if (!game.user.isGM) return;

  const fadeOut = Number(Overlay.element?.dataset.fadeOut) || 0;
  const payload = { action: "hide", senderId: game.user.id, fadeOut };

  game.socket.emit(SOCKET_NAME, payload);
  Overlay.hide({ fadeOut });
}

function handleSocket(payload) {
  if (!payload || typeof payload !== "object") return;
  const sender = game.users.get(payload.senderId);
  if (!sender?.isGM) return;

  switch (payload.action) {
  case "show":
    Overlay.show(payload.config);
    break;

  case "hide":
    Overlay.hide({ fadeOut: payload.fadeOut });
    break;

  default:
    console.warn(`${MODULE_ID} | unknown socket action`, payload.action);
}
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "debug", {
    name: "SLS.SettingsDebugName",
    hint: "SLS.SettingsDebugHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "customDefaults", {
    name: "SLS.SettingsDefaultsName",
    hint: "SLS.SettingsDefaultsHint",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, "presets", {
    name: "SLS.SettingsPresetsName",
    hint: "SLS.SettingsPresetsHint",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.registerMenu(MODULE_ID, "presetsMenu", {
    name: "SLS.SettingsPresetsName",
    label: "SLS.SettingsPresetsLabel",
    hint: "SLS.SettingsPresetsHint",
    icon: "fas fa-photo-film",
    type: PresetsManagerApp,
    restricted: true
  });
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET_NAME, handleSocket);
  Overlay.attachProgressTracking();

  const mod = game.modules.get(MODULE_ID);
  mod.api = {
    play,
    stop,
    openConfigDialog,
    getSceneConfig,
    setSceneConfig,
    clearSceneConfig
  };
  debug(`ready — API at game.modules.get('${MODULE_ID}').api`);
});

function extractSceneFromLi(li) {
  const el = li instanceof HTMLElement ? li : (li?.[0] ?? li);
  if (!el) {
    console.warn(`${MODULE_ID} | extractSceneFromLi: no element`, li);
    return null;
  }
  const id =
    el.dataset?.entryId ??
    el.dataset?.documentId ??
    el.getAttribute?.("data-entry-id") ??
    el.getAttribute?.("data-document-id") ??
    el.closest?.("[data-entry-id], [data-document-id]")?.dataset?.entryId ??
    el.closest?.("[data-entry-id], [data-document-id]")?.dataset?.documentId;
  const scene = game.scenes.get(id);
  debug(`extractSceneFromLi → id=${id}, scene=${scene?.name ?? "none"}`);
  return scene;
}

function buildContextOptions() {
  return [
    {
      name: "SLS.MenuCreate",
      icon: '<i class="fas fa-photo-film"></i>',
      condition: (li) => {
        if (!game.user.isGM) return false;
        const scene = extractSceneFromLi(li);
        return !!scene && !getSceneConfig(scene);
      },
      callback: (li) => {
        const scene = extractSceneFromLi(li);
        if (scene) openConfigDialog(scene);
      }
    },
    {
      name: "SLS.MenuEdit",
      icon: '<i class="fas fa-pen-to-square"></i>',
      condition: (li) => {
        if (!game.user.isGM) return false;
        const scene = extractSceneFromLi(li);
        return !!scene && !!getSceneConfig(scene);
      },
      callback: (li) => {
        const scene = extractSceneFromLi(li);
        if (scene) openConfigDialog(scene);
      }
    },
    {
      name: "SLS.MenuRemove",
      icon: '<i class="fas fa-trash"></i>',
      condition: (li) => {
        if (!game.user.isGM) return false;
        const scene = extractSceneFromLi(li);
        return !!scene && !!getSceneConfig(scene);
      },
      callback: (li) => {
        const scene = extractSceneFromLi(li);
        if (scene) confirmRemove(scene);
      }
    },
    {
      name: "SLS.MenuPlay",
      icon: '<i class="fas fa-play"></i>',
      condition: (li) => {
        if (!game.user.isGM) return false;
        const scene = extractSceneFromLi(li);
        return !!scene && !!getSceneConfig(scene);
      },
      callback: (li) => {
        const scene = extractSceneFromLi(li);
        if (scene) play(scene.id);
      }
    }
  ];
}

const CONTEXT_HOOK_NAMES = [
  "getSceneDirectoryEntryContext",
  "getSceneDirectoryFolderContext",
  "getSceneContextOptions",
  "getDocumentDirectoryEntryContext"
];

for (const hookName of CONTEXT_HOOK_NAMES) {
  Hooks.on(hookName, (...args) => {
    debug(`hook fired: ${hookName}`, args);
    const options = args.find(a => Array.isArray(a));
    if (!options) {
      debug(`${hookName} — no options array found in args`);
      return;
    }
    if (hookName.includes("Folder")) return;
    options.push(...buildContextOptions());
  });
}
