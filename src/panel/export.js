import { renderStill, maxExportSize } from "../export.js";
import { drawTextOverlay } from "../text-overlay.js";
import { FORMATS, SIZES, PRINT_DPI, FONTS } from "./controls.js";
import { pick } from "./dom.js";

// Format and size pickers plus the PNG download itself.

export function createExportControls({ panel, state, save }) {
  const formatSelect = pick(panel, ".config-format");
  const sizeSelect = pick(panel, ".config-size");
  const exportNote = pick(panel, ".config-export-note");
  const exportButton = pick(panel, ".config-export");
  const textCheckbox = pick(panel, ".config-export-text");

  FORMATS.forEach(({ id, label }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    formatSelect.appendChild(option);
  });

  SIZES.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = label;
    sizeSelect.appendChild(option);
  });

  // The short edge drives the size, so a portrait crop gains pixels instead of
  // losing them the way a longest-edge cap would.
  function exportSize() {
    const format = FORMATS.find((f) => f.id === state.format);
    const ratio = format.ratio ?? window.innerWidth / window.innerHeight;
    const short = state.size;

    const width = ratio >= 1 ? Math.round(short * ratio) : short;
    const height = ratio >= 1 ? short : Math.round(short / ratio);

    const limit = maxExportSize();
    const overflow = Math.max(width, height) / limit;
    if (overflow > 1) {
      return {
        width: Math.floor(width / overflow),
        height: Math.floor(height / overflow),
        clamped: true,
      };
    }

    return { width, height, clamped: false };
  }

  function renderNote() {
    const { width, height, clamped } = exportSize();
    const inches = (px) => (px / PRINT_DPI).toFixed(1);
    exportNote.textContent = clamped
      ? `${width} × ${height} px — clamped to this GPU's ${maxExportSize()} px limit`
      : `${width} × ${height} px · ${inches(width)} × ${inches(height)} in at ${PRINT_DPI} dpi`;
  }

  formatSelect.addEventListener("change", () => {
    state.format = formatSelect.value;
    renderNote();
    save();
  });

  sizeSelect.addEventListener("change", () => {
    state.size = Number(sizeSelect.value);
    renderNote();
    save();
  });

  textCheckbox.addEventListener("change", () => {
    state.exportText = textCheckbox.checked;
    save();
  });

  // Type is authored against the viewport in absolute pixels, so it has to be
  // rescaled for an output of a different size. The short edge is the axis the
  // size control is specified in, and scaling by it keeps the type at the same
  // visual weight whether the crop ends up portrait or landscape.
  function overlayScale(width, height) {
    const viewport = Math.min(window.innerWidth, window.innerHeight);
    return Math.min(width, height) / Math.max(viewport, 1);
  }

  async function composeExport(width, height) {
    const canvas = renderStill(width, height);
    if (!state.exportText) return canvas;

    // A face still swapping in would be measured and drawn as the fallback
    await document.fonts.ready;

    const font = FONTS.find((f) => f.id === state.text.font) ?? FONTS[0];
    return drawTextOverlay(canvas, {
      title: state.title,
      paragraph: state.paragraph,
      text: { ...state.text, font: font.stack },
      scale: overlayScale(width, height),
    });
  }

  exportButton.addEventListener("click", async () => {
    const { width, height } = exportSize();
    const label = exportButton.textContent;

    // Reading back a few hundred megabytes blocks the main thread, so the button
    // has to show its new state before the work starts rather than after
    exportButton.disabled = true;
    exportButton.textContent = "Rendering…";
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    try {
      const canvas = await composeExport(width, height);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gradient-${state.mode}-${width}x${height}.png`;
      link.click();

      // Revoking in the same tick can pull the blob out from under a download
      // that has not finished reading it — which is exactly the largest sizes,
      // where the file is hundreds of megabytes.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      // Almost always an out-of-memory refusal on the largest sizes
      exportNote.textContent = `Export failed: ${error.message}`;
    } finally {
      exportButton.disabled = false;
      exportButton.textContent = label;
    }
  });

  function sync() {
    formatSelect.value = state.format;
    sizeSelect.value = String(state.size);
    textCheckbox.checked = state.exportText;
    renderNote();
  }

  return { sync };
}
