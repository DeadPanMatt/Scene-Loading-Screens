import { MODULE_ID } from "./constants.js";
import { LoadingScreenConfigApp } from "./config-app.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PresetsManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "scene-loading-screens-presets",
    classes: ["sls-presets-manager"],
    window: {
      title: "SLS.PresetsTitle",
      icon: "fas fa-photo-film",
      resizable: true
    },
    position: { width: 420, height: "auto" },
    actions: {
      createPreset: PresetsManagerApp._onCreatePreset,
      editPreset: PresetsManagerApp._onEditPreset,
      deletePreset: PresetsManagerApp._onDeletePreset
    }
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/presets.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this._hookId = Hooks.on(`${MODULE_ID}.presetSaved`, () => this.render(true));
  }

  async close(options) {
    Hooks.off(`${MODULE_ID}.presetSaved`, this._hookId);
    return super.close(options);
  }

  async _prepareContext(_options) {
    const presets = game.settings.get(MODULE_ID, "presets") ?? [];
    return { presets, hasPresets: presets.length > 0 };
  }

  static async _onCreatePreset() {
    const name = await PresetsManagerApp._promptName();
    if (!name) return;
    new LoadingScreenConfigApp({
      presetId: null,
      presetName: name
    }).render(true);
  }

  static async _onEditPreset(_event, target) {
    const presetId = target.dataset.presetId;
    if (!presetId) return;
    const presets = game.settings.get(MODULE_ID, "presets") ?? [];
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    new LoadingScreenConfigApp({
      presetId: preset.id,
      presetName: preset.name
    }).render(true);
  }

  static async _onDeletePreset(_event, target) {
    const presetId = target.dataset.presetId;
    if (!presetId) return;
    const presets = game.settings.get(MODULE_ID, "presets") ?? [];
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("SLS.DeletePresetTitle") },
      content: `<p>${game.i18n.format("SLS.DeletePresetConfirm", { name: preset.name })}</p>`,
      rejectClose: false,
      modal: true
    });
    if (!proceed) return;

    const updated = presets.filter(p => p.id !== presetId);
    await game.settings.set(MODULE_ID, "presets", updated);
    Hooks.callAll(`${MODULE_ID}.presetSaved`);
  }

  static async _promptName(existing = "") {
    return foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("SLS.PresetNameTitle") },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("SLS.PresetName")}</label>
          <div class="form-fields">
            <input type="text" name="presetName" value="${existing}" autofocus required />
          </div>
        </div>`,
      ok: {
        label: game.i18n.localize("SLS.Confirm"),
        callback: (event, button) => {
          const input = button.form.elements.presetName;
          return input?.value?.trim() || null;
        }
      },
      rejectClose: false
    });
  }
}
