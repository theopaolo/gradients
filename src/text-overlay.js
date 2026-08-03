// Redraws the page's title and paragraph onto an export canvas.
//
// The overlay is painted rather than captured: the text on screen is DOM, and
// the export is a WebGL readback, so there is no single surface holding both.
// Everything here mirrors the rules in styles.css — a flex-centred column of
// title lines at `--title-leading`, then the paragraph at line-height 1.2
// inside its 8px padding, the whole block centred in the viewport and wrapped
// at main's 92% width.

const PARAGRAPH_LEADING = 1.2;
const PARAGRAPH_PADDING = 8; // .p-container padding, CSS px
const CONTENT_WIDTH = 0.92; // main { max-width: 92vw }

// Breaks a line the way the browser would inside main's max-width. A single
// word longer than the line is left to overflow, exactly as CSS does.
function wrap(context, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);
  return lines;
}

// CSS centres the font's content area inside the line box — half-leading. The
// canvas baseline keywords do not, so the baseline is derived from the same
// metrics the browser uses.
function baselineIn(context, boxTop, lineHeight) {
  const metrics = context.measureText("Mg");
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;

  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) {
    return boxTop + lineHeight / 2; // no metrics: settle for the box centre
  }

  return boxTop + (lineHeight - (ascent + descent)) / 2 + ascent;
}

/**
 * Paints the copy onto an already-rendered gradient canvas.
 *
 * `scale` converts CSS pixels to export pixels. Callers pass the short-edge
 * ratio, which is the axis the export size control is specified in, so the
 * type keeps its visual weight whether the crop is portrait or landscape.
 */
export function drawTextOverlay(canvas, { title, paragraph, text, scale }) {
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const maxWidth = width * CONTENT_WIDTH;

  const titleFont = (size) => `${text.weight} ${size}px ${text.font}`;

  const titleSize = text.titleSize * scale;
  const titleLineHeight = titleSize * text.titleLeading;
  const paragraphSize = text.paragraphSize * scale;
  const paragraphLineHeight = paragraphSize * PARAGRAPH_LEADING;
  const padding = PARAGRAPH_PADDING * scale;

  context.font = titleFont(titleSize);
  const titleLines = title
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => wrap(context, line, maxWidth));

  context.font = titleFont(paragraphSize);
  const paragraphLines = wrap(context, paragraph, maxWidth);

  const titleHeight = titleLines.length * titleLineHeight;
  const paragraphHeight = paragraphLines.length
    ? paragraphLines.length * paragraphLineHeight + padding * 2
    : 0;

  // body centres main on both axes
  let y = (height - (titleHeight + paragraphHeight)) / 2;

  context.save();
  context.fillStyle = text.color;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  context.font = titleFont(titleSize);
  titleLines.forEach((line) => {
    context.fillText(line, width / 2, baselineIn(context, y, titleLineHeight));
    y += titleLineHeight;
  });

  if (paragraphLines.length) {
    y += padding;
    context.font = titleFont(paragraphSize);
    paragraphLines.forEach((line) => {
      context.fillText(
        line,
        width / 2,
        baselineIn(context, y, paragraphLineHeight),
      );
      y += paragraphLineHeight;
    });
  }

  context.restore();
  return canvas;
}
