import { MODULE_ID } from "./constants.js";

export class Overlay {
  static element = null;
  static timeoutId = null;
  static fadeTimeoutId = null;
  static progressEl = null;
  static progressFillEl = null;
  static _trackingAttached = false;

  static show(config) {
    if (!config) return;
    Overlay.hide({ immediate: true });

    const fadeIn = Math.max(0, Number(config.fadeIn) || 0);
    const fadeOut = Math.max(0, Number(config.fadeOut) || 0);

    const el = document.createElement("div");
    el.id = "sls-overlay";
    el.dataset.fadeOut = String(fadeOut);

    el.classList.add(
      `sls-position-${config.textPosition || "middle-center"}`,
      `sls-fit-${config.mediaFit || "contain"}`
    );

    el.style.opacity = fadeIn > 0 ? "0" : "1";
    el.style.transition = fadeIn > 0 ? `opacity ${fadeIn}ms ease` : "";

    if (config.image) {
      const img = document.createElement("img");
      img.classList.add("sls-image");
      img.src = config.image;
      el.appendChild(img);
    }

    const rawVol = Number(config.volume);
    const volume = Number.isFinite(rawVol) ? Math.min(1, Math.max(0, rawVol)) : 1;

    if (config.video) {
      const video = document.createElement("video");
      video.classList.add("sls-video");
      video.src = config.video;
      video.autoplay = true;
      video.loop = !!config.loop;
      video.muted = !!config.audio;
      video.volume = volume;
      video.playsInline = true;
      el.appendChild(video);
      video.play().catch(err => console.warn(`${MODULE_ID} | video autoplay blocked`, err));
    }

    if (config.audio) {
      const audio = document.createElement("audio");
      audio.classList.add("sls-audio");
      audio.src = config.audio;
      audio.loop = !!config.loop;
      audio.volume = volume;
      el.appendChild(audio);
      audio.play().catch(err => console.warn(`${MODULE_ID} | audio autoplay blocked`, err));
    }

if (config.text) {
  const text = document.createElement("div");
  text.classList.add("sls-text");
  text.style.fontSize = `${Number(config.fontSize) || 36}px`;
  text.style.color = config.fontColor || "#ffffff";
  text.style.textAlign = config.textAlign || "center";
  text.style.display = "flex";
  text.style.flexDirection = "column";

  const verticalMap = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end"
  };

  text.style.justifyContent = verticalMap[config.textVerticalAlign] || "center";
  text.innerHTML = Overlay.sanitizeRichText(config.text);
  
  el.appendChild(text);
  
}

    if (config.showProgressBar) {
      const wrap = document.createElement("div");
      wrap.classList.add("sls-progress-wrap");

      const header = document.createElement("div");
      header.classList.add("sls-progress-header");

      const spinner = document.createElement("i");
      spinner.classList.add("sls-spinner", "fa-solid", "fa-spinner");
      header.appendChild(spinner);

      const labelText = (config.progressLabel ?? "").toString().trim();
      if (labelText) {
        const label = document.createElement("span");
        label.classList.add("sls-progress-label");
        label.textContent = labelText;
        header.appendChild(label);
      }

      const bar = document.createElement("div");
      bar.classList.add("sls-progress");
      const fill = document.createElement("div");
      fill.classList.add("sls-progress-fill");
      fill.style.width = "0%";
      bar.appendChild(fill);

      wrap.appendChild(header);
      wrap.appendChild(bar);
      el.appendChild(wrap);

      Overlay.progressEl = bar;
      Overlay.progressFillEl = fill;
      Overlay.attachProgressTracking();
    }

    if (game.user.isGM) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.classList.add("sls-close");
      btn.title = game.i18n.localize("SLS.CloseTooltip");
      btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      btn.addEventListener("click", () => {
        game.modules.get(MODULE_ID)?.api?.stop();
      });
      el.appendChild(btn);
    }

    document.body.appendChild(el);
    Overlay.element = el;

    if (fadeIn > 0) {
      requestAnimationFrame(() => {
        el.style.opacity = "1";
      });
    }

    const duration = Number(config.duration);
    if (duration > 0) {
      Overlay.timeoutId = setTimeout(() => {
        if (game.user.isGM) {
          game.modules.get(MODULE_ID)?.api?.stop();
        } else {
          Overlay.hide({ fadeOut });
        }
      }, duration * 1000);
    }
  }

  static hide(options = {}) {
    const immediate = options.immediate === true;
    const fadeOut = Math.max(0, Number(options.fadeOut) || 0);

    if (Overlay.timeoutId) {
      clearTimeout(Overlay.timeoutId);
      Overlay.timeoutId = null;
    }

    if (Overlay.fadeTimeoutId) {
      clearTimeout(Overlay.fadeTimeoutId);
      Overlay.fadeTimeoutId = null;
    }

    const el = Overlay.element;
    if (!el) return;

    const remove = () => {
      el.querySelectorAll("video, audio").forEach(m => {
        try {
          m.pause();
          m.removeAttribute("src");
          m.load();
        } catch (_) {
          // Ignore cleanup errors
        }
      });

      el.remove();

      if (Overlay.element === el) {
        Overlay.element = null;
      }
      Overlay.progressEl = null;
      Overlay.progressFillEl = null;
    };

    if (immediate || fadeOut <= 0) {
      remove();
      return;
    }

    el.style.transition = `opacity ${fadeOut}ms ease`;
    el.style.opacity = "0";
    el.style.pointerEvents = "none";

    Overlay.fadeTimeoutId = setTimeout(remove, fadeOut);
  }
  static updateProgress(pct) {
    if (!Overlay.progressFillEl) return;
    const n = Number(pct);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(0, Math.min(100, n));
    Overlay.progressFillEl.style.width = `${clamped}%`;
  }

  static attachProgressTracking() {
    if (Overlay._trackingAttached) return;
    Overlay._trackingAttached = true;

    Hooks.on("canvasInit", () => {
      if (Overlay.progressFillEl) Overlay.updateProgress(0);
    });
    Hooks.on("canvasReady", () => {
      if (Overlay.progressFillEl) Overlay.updateProgress(100);
    });

    const SN = globalThis.SceneNavigation
      ?? foundry?.applications?.ui?.SceneNavigation
      ?? null;
    if (SN?.displayProgressBar && !SN._slsWrapped) {
      const orig = SN.displayProgressBar;
      SN.displayProgressBar = function (args) {
        try {
          if (Overlay.progressFillEl && Number.isFinite(args?.pct)) {
            Overlay.updateProgress(args.pct);
          }
        } catch (_) {
        }
        return orig.call(this, args);
      };
      SN._slsWrapped = true;
    }
  }

 static sanitizeRichText(html) {
    const template = document.createElement("template");
    template.innerHTML = html ?? "";

    const allowedTags = new Set([
      "B", "STRONG",
      "I", "EM",
      "U",
      "BR",
      "DIV",
      "P",
      "SPAN"
    ]);

    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) continue;

        if (child.nodeType !== Node.ELEMENT_NODE) {
          child.remove();
          continue;
        }

        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          continue;
        }

        const allowedStyleProps = new Set(["font-size", "color"]);
        for (const attr of [...child.attributes]) {
          if (attr.name === "style" && child.tagName === "SPAN") {
            const filtered = [];
            for (const prop of allowedStyleProps) {
              const val = child.style.getPropertyValue(prop);
              if (val) filtered.push(`${prop}: ${val}`);
            }
            if (filtered.length) {
              child.setAttribute("style", filtered.join("; "));
            } else {
              child.removeAttribute("style");
            }
          } else {
            child.removeAttribute(attr.name);
          }
        }

        walk(child);
      }
    };

    walk(template.content);
    return template.innerHTML;
  }
}

