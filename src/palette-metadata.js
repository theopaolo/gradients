// Reads the palette a Color Catchers export carries with it.
//
// Those files embed an XMP packet holding one `cc:palette` element whose text
// is a JSON array of hex colors — in a PNG `iTXt` chunk, a JPEG `APP1` segment
// or a WebP `XMP ` chunk depending on the export. The three containers put the
// packet in three different places, but the packet itself is identical, so this
// scans the bytes for the element rather than walking each container: the only
// thing a proper parse would buy is rejecting a file where the string happens to
// live outside a metadata block, and the payload still has to survive JSON and
// hex validation after that.
//
// Format reference: paletcam/docs/palette-image-metadata.md.

import { isHex, normalizeHex, expandHex } from "./color.js";

const OPEN_TAG = "<cc:palette>";
const CLOSE_TAG = "</cc:palette>";

// The packet is ASCII, so the tags survive byte-for-byte and can be matched
// without decoding a file that may be tens of megabytes of image data.
const asciiBytes = (text) =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

function indexOfBytes(haystack, needle, from = 0) {
  const last = haystack.length - needle.length;
  outer: for (let i = from; i <= last; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// XMP text is XML, so the JSON arrives with its markup characters escaped. Only
// the three the producer escapes are undone; `&amp;` goes last so a literal
// "&lt;" in the source cannot be turned into a "<".
function unescapeXmlText(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Pulls the hex colors out of an image's XMP packet, in palette order.
 *
 * Returns null when the file carries no packet, and rejects nothing beyond
 * that: a packet whose payload is not a JSON array of hex strings is treated as
 * absent rather than as an error, because a caller can do nothing useful with
 * the difference. Colors come back in this app's hex form — six digits,
 * lowercase, hashed — so they can go straight into a color entry.
 *
 * @param {Blob} file
 * @returns {Promise<string[] | null>}
 */
export async function readPaletteFromImage(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  const start = indexOfBytes(bytes, asciiBytes(OPEN_TAG));
  if (start < 0) return null;

  const textStart = start + OPEN_TAG.length;
  const end = indexOfBytes(bytes, asciiBytes(CLOSE_TAG), textStart);
  if (end < 0) return null;

  let payload;
  try {
    payload = JSON.parse(
      unescapeXmlText(new TextDecoder().decode(bytes.subarray(textStart, end))),
    );
  } catch {
    return null;
  }

  if (!Array.isArray(payload)) return null;

  const colors = payload
    .filter(isHex)
    .map((hex) => expandHex(normalizeHex(hex)).toLowerCase());

  return colors.length ? colors : null;
}
