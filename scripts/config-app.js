import { MODULE_ID, FLAG_KEY } from "./constants.js";
import { Overlay } from "./overlay.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const FACTORY_DEFAULTS = {
  image: "",
  video: "",
  audio: "",
  text: "",
  fontSize: 36,
  fontColor: "#ffffff",
  textPosition: "middle-center",
  textAlign: "center",
  textVerticalAlign: "middle",
  mediaFit: "contain",
  loop: true,
  duration: null,
  fadeIn: 500,
  fadeOut: 500
};

function getDefaults() {
  const custom = game.settings.get(MODULE_ID, "customDefaults") ?? {};
  return foundry.utils.mergeObject(FACTORY_DEFAULTS, custom, { inplace: false });
}

const FIT_OPTIONS = [
  { value: "contain", labelKey: "SLS.FitContain" },
  { value: "cover", labelKey: "SLS.FitCover" },
  { value: "fill", labelKey: "SLS.FitStretch" },
  { value: "none", labelKey: "SLS.FitOriginal" }
];

const POSITION_OPTIONS = [
  "top-left", "top-mid-left", "top-center", "top-mid-right", "top-right",
  "upper-left", "upper-mid-left", "upper-center", "upper-mid-right", "upper-right",
  "middle-left", "middle-mid-left", "middle-center", "middle-mid-right", "middle-right",
  "lower-left", "lower-mid-left", "lower-center", "lower-mid-right", "lower-right",
  "bottom-left", "bottom-mid-left", "bottom-center", "bottom-mid-right", "bottom-right"
];

export class LoadingScreenConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.scene = options.scene ?? null;
    this.presetId = options.presetId ?? null;
    this.presetName = options.presetName ?? "";
    this._loadedData = null;
  }

  get isPresetMode() {
    return !this.scene;
  }

  static DEFAULT_OPTIONS = {
    id: "scene-loading-screens-config",
    tag: "form",
    classes: ["sls-config"],
    window: {
      title: "SLS.ConfigTitle",
      icon: "fas fa-photo-film",
      resizable: true
    },
    position: { width: 550, height: 820 },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
    pickFile: this._onPickFile,
    preview: this._onPreview,
    loadPreset: this._onLoadPreset,
    resetDefaults: this._onResetDefaults,
    saveDefaults: this._onSaveDefaults,
    formatText: this._onFormatText,
    setAlign: this._onSetAlign,
    setVerticalAlign: this._onSetVerticalAlign,
    applyTextStyle: this._onApplyTextStyle,
    clearTextStyle: this._onClearTextStyle
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/config.hbs`
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/footer.hbs`
    }
  };

  get title() {
    const base = game.i18n.localize("SLS.ConfigTitle");
    if (this.isPresetMode) {
      const label = game.i18n.localize("SLS.Preset");
      return `${base} — ${label}: ${this.presetName}`;
    }
    return this.scene ? `${base}: ${this.scene.name}` : base;
  }

  async _prepareContext(_options) {
    let existing;
    if (this._loadedData) {
      existing = this._loadedData;
      this._loadedData = null;
    } else if (this.isPresetMode && this.presetId) {
      const presets = game.settings.get(MODULE_ID, "presets") ?? [];
      const preset = presets.find(p => p.id === this.presetId);
      existing = preset ?? {};
    } else if (this.scene) {
      existing = this.scene.getFlag(MODULE_ID, FLAG_KEY) ?? {};
    } else {
      existing = {};
    }

    const data = foundry.utils.mergeObject(getDefaults(), existing, { inplace: false });
    data.textAlign ??= FACTORY_DEFAULTS.textAlign;
    data.textVerticalAlign ??= FACTORY_DEFAULTS.textVerticalAlign;

    data.textAlignLeft = data.textAlign === "left";
    data.textAlignCenter = data.textAlign === "center";
    data.textAlignRight = data.textAlign === "right";

    data.textVerticalAlignTop = data.textVerticalAlign === "top";
    data.textVerticalAlignMiddle = data.textVerticalAlign === "middle";
    data.textVerticalAlignBottom = data.textVerticalAlign === "bottom";
    const presets = game.settings.get(MODULE_ID, "presets") ?? [];

    return {
      data,
      isPresetMode: this.isPresetMode,
      presetName: this.presetName,
      presets: presets.map(p => ({ id: p.id, name: p.name })),
      hasPresets: presets.length > 0,
      fitOptions: FIT_OPTIONS.map(o => ({
        value: o.value,
        label: game.i18n.localize(o.labelKey),
        selected: o.value === data.mediaFit
      })),
      positionOptions: POSITION_OPTIONS.map(p => ({
        value: p,
        selected: p === data.textPosition
      })),
      buttons: [
        { type: "submit", icon: "fa-solid fa-save", label: "SLS.Save" }
      ]
    };
  }

  _applyEditorAlignment() {
    const editor = this.element.querySelector(".sls-rich-editor");
    if (!editor) return;
    const align = this.element.querySelector('input[name="textAlign"]')?.value || "center";
    const valign = this.element.querySelector('input[name="textVerticalAlign"]')?.value || "middle";
    const valignMap = { top: "flex-start", middle: "center", bottom: "flex-end" };
    editor.style.textAlign = align;
    editor.style.display = "flex";
    editor.style.flexDirection = "column";
    editor.style.justifyContent = valignMap[valign] ?? "center";
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const editor = this.element.querySelector(".sls-rich-editor");
    const hidden = this.element.querySelector('input[name="text"]');
    const toolbar = this.element.querySelector(".sls-rich-toolbar");

    if (!editor || !hidden) return;

    this._applyEditorAlignment();

    const sync = () => {
      hidden.value = editor.innerHTML.trim();
    };

    const updateToolbarState = () => {
      if (!toolbar) return;

      const states = {
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline")
      };

      for (const [format, active] of Object.entries(states)) {
        const button = toolbar.querySelector(`[data-format="${format}"]`);
        button?.classList.toggle("active", active);
        button?.setAttribute("aria-pressed", String(active));
      }
    };

    editor.addEventListener("input", () => {
      sync();
      updateToolbarState();
    });

    editor.addEventListener("keyup", updateToolbarState);
    editor.addEventListener("mouseup", updateToolbarState);
    editor.addEventListener("focus", updateToolbarState);

    this._savedRange = null;
    const saveSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        this._savedRange = range.cloneRange();
      }
    };
    editor.addEventListener("keyup", saveSelection);
    editor.addEventListener("mouseup", saveSelection);
    editor.addEventListener("blur", saveSelection);

    this.element.querySelectorAll('[data-action="applyTextStyle"], [data-action="clearTextStyle"]').forEach(btn => {
      btn.addEventListener("mousedown", e => e.preventDefault());
    });
    editor.addEventListener("paste", (event) => {
      event.preventDefault();

      const text = event.clipboardData?.getData("text/plain") ?? "";
      document.execCommand("insertText", false, text);

      sync();
      updateToolbarState();
    });

  const positionCells = this.element.querySelectorAll(".sls-position-cell");

    let preview = document.querySelector(".sls-position-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.classList.add("sls-position-preview");
      document.body.appendChild(preview);
    }

    positionCells.forEach(cell => {
      const position = cell.dataset.position;
      if (!position) return;

      cell.addEventListener("mouseenter", () => {
        preview.className = `sls-position-preview sls-position-${position}`;
        preview.classList.add("visible");
      });

      cell.addEventListener("mouseleave", () => {
        preview.classList.remove("visible");
      });
    });

    sync();
    updateToolbarState();
  }

  static _extractFormData(formData) {
    const raw = foundry.utils.expandObject(formData.object);

    return {
      image: (raw.image ?? "").trim(),
      video: (raw.video ?? "").trim(),
      audio: (raw.audio ?? "").trim(),
      text: raw.text ?? "",
      fontSize: Number(raw.fontSize) || FACTORY_DEFAULTS.fontSize,
      fontColor: raw.fontColor || FACTORY_DEFAULTS.fontColor,
      textPosition: raw.textPosition || FACTORY_DEFAULTS.textPosition,
      textAlign: raw.textAlign || FACTORY_DEFAULTS.textAlign,
      textVerticalAlign: raw.textVerticalAlign || FACTORY_DEFAULTS.textVerticalAlign,
      mediaFit: raw.mediaFit || FACTORY_DEFAULTS.mediaFit,
      loop: !!raw.loop,
      duration: raw.duration === "" || raw.duration == null ? null : Number(raw.duration),
      fadeIn: Math.max(0, Number(raw.fadeIn) || 0),
      fadeOut: Math.max(0, Number(raw.fadeOut) || 0)
    };
  }

  static async _onSubmit(_event, form, formData) {
    const data = LoadingScreenConfigApp._extractFormData(formData);

    if (this.isPresetMode) {
      const presets = game.settings.get(MODULE_ID, "presets") ?? [];
      const raw = foundry.utils.expandObject(formData.object);
      const presetName = (raw.presetName ?? "").trim() || this.presetName || "Unnamed Preset";
      this.presetName = presetName;
      if (this.presetId) {
        const idx = presets.findIndex(p => p.id === this.presetId);
        if (idx >= 0) presets[idx] = { ...data, id: this.presetId, name: presetName };
      } else {
        const id = foundry.utils.randomID();
        presets.push({ ...data, id, name: presetName });
        this.presetId = id;
      }

      await game.settings.set(MODULE_ID, "presets", presets);
      Hooks.callAll(`${MODULE_ID}.presetSaved`);
      ui.notifications.info(game.i18n.format("SLS.PresetSaved", { name: presetName }));
      return;
    }

    const app = form.closest(".application")?.app ?? this;
    const scene = this.scene ?? app?.scene;
    if (!scene) {
      ui.notifications.error("No scene found for Scene Loading Screens config.");
      return;
    }

    await scene.setFlag(MODULE_ID, FLAG_KEY, data);
    ui.notifications.info(game.i18n.format("SLS.Saved", { name: scene.name }));
  }

  static async _onPickFile(_event, target) {
    const which = target.dataset.target;
    if (!which) return;
    const input = this.element.querySelector(`[name="${which}"]`);
    const typeMap = { image: "image", video: "video", audio: "audio" };
    const FilePickerCls =
      foundry.applications.apps.FilePicker?.implementation ?? FilePicker;

    new FilePickerCls({
      type: typeMap[which] ?? "any",
      current: input?.value || "",
      callback: (path) => {
        if (input) {
          input.value = path;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }).render(true);
  }

  static async _onPreview(_event, target) {
    const form = target.closest("form");
    if (!form) return;
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const data = LoadingScreenConfigApp._extractFormData(formData);
    Overlay.show(data);
  }

  static async _onLoadPreset(_event, _target) {
    const select = this.element.querySelector(".sls-preset-select");
    const presetId = select?.value;
    if (!presetId) return;
    const presets = game.settings.get(MODULE_ID, "presets") ?? [];
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    const { id, name, ...presetData } = preset;
    this._loadedData = presetData;
    this.render(true);
    ui.notifications.info(game.i18n.format("SLS.PresetLoaded", { name: preset.name }));
  }

  static async _onResetDefaults() {
    this._loadedData = { ...getDefaults() };
    this.render(true);
    ui.notifications.info(game.i18n.localize("SLS.ResetDone"));
  }

  static async _onSaveDefaults(_event, target) {
    const form = target.closest("form");
    if (!form) return;
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const data = LoadingScreenConfigApp._extractFormData(formData);
    await game.settings.set(MODULE_ID, "customDefaults", data);
    ui.notifications.info(game.i18n.localize("SLS.DefaultsSaved"));
  }

  static async _onFormatText(_event, target) {
    
    const button = target.closest("[data-format]");
    const format = button?.dataset.format;
    if (!format) return;
    const allowed = new Set(["bold", "italic", "underline"]);
    if (!allowed.has(format)) return;
    const editor = this.element.querySelector(".sls-rich-editor");
    const hidden = this.element.querySelector('input[name="text"]');
    if (!editor || !hidden) return;
    editor.focus();
    document.execCommand(format, false, null);
    hidden.value = editor.innerHTML.trim();
    const active = document.queryCommandState(format);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  static _onSetAlign(_event, target) {
    const align = target.dataset.align;
    if (!align) return;
    const input = this.element.querySelector('[name="textAlign"]');
    if (!input) return;
    input.value = align;
    input.dispatchEvent(new Event("change", { bubbles: true }));
      this.element.querySelectorAll("[data-align]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.align === align);
  });
    this._applyEditorAlignment();
}

  static _onSetVerticalAlign(_event, target) {
    const align = target.dataset.valign;
    if (!align) return;
    const input = this.element.querySelector('[name="textVerticalAlign"]');
    if (!input) return;
    input.value = align;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    this.element.querySelectorAll("[data-valign]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.valign === align);
  });
    this._applyEditorAlignment();
}

  static _onApplyTextStyle(_event, _target) {
    const editor = this.element.querySelector(".sls-rich-editor");
    const hidden = this.element.querySelector('input[name="text"]');
    if (!editor) return;

    const fontSize = Number(this.element.querySelector('input[name="fontSize"]')?.value) || FACTORY_DEFAULTS.fontSize;
    const fontColor = this.element.querySelector('input[name="fontColor"]')?.value || FACTORY_DEFAULTS.fontColor;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

    editor.focus();

    try {
      const fragment = range.extractContents();
      const span = document.createElement("span");
      span.style.fontSize = `${fontSize}px`;
      span.style.color = fontColor;
      span.appendChild(fragment);

      range.deleteContents();
      range.insertNode(span);

      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      newRange.collapse(false);

      sel.removeAllRanges();
      sel.addRange(newRange);

      this._savedRange = newRange.cloneRange();
  } catch (e) {
    console.warn("[SLS] Could not apply text style:", e);
    return;
  }

  if (hidden) hidden.value = editor.innerHTML.trim();
}
  static _onClearTextStyle(_event, _target) {
    const editor = this.element.querySelector(".sls-rich-editor");
    const hidden = this.element.querySelector('input[name="text"]');
    if (!editor) return;

    const sel = window.getSelection();
    let range = null;
    if (sel && sel.rangeCount > 0) {
      const live = sel.getRangeAt(0);
      if (editor.contains(live.commonAncestorContainer) && !live.collapsed) {
        range = live;
      }
    }
    if (!range && this._savedRange && !this._savedRange.collapsed) {
      sel.removeAllRanges();
      sel.addRange(this._savedRange);
      range = sel.getRangeAt(0);
    }
    if (!range || range.collapsed) return;
    editor.focus();

    editor.querySelectorAll("span[style]").forEach(span => {
      if (!sel.containsNode(span, true)) return;
      span.style.removeProperty("font-size");
      span.style.removeProperty("color");
      if (!span.getAttribute("style")) {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      }
    });

    if (hidden) hidden.value = editor.innerHTML.trim();
  }
}
