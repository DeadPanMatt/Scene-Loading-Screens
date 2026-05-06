export const MODULE_ID = "scene-loading-screens";
export const FLAG_KEY = "loadingScreen";
export const SOCKET_NAME = `module.${MODULE_ID}`;

export function debug(...args) {
  try {
    if (game?.settings?.get(MODULE_ID, "debug")) {
      console.log(`${MODULE_ID} |`, ...args);
    }
  } catch (_) {
    // settings not registered yet — stay silent
  }
}
