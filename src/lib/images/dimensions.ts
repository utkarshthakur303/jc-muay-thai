/**
 * Reading an uploaded image's format and true pixel size out of its own
 * bytes.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────
 * Two jobs, and it is one piece of code because they are the same
 * question asked twice.
 *
 * 1. VALIDATION. `file.type` is whatever the browser felt like sending,
 *    and the filename extension is whatever the file was called. Neither
 *    is evidence. A `.jpeg` that is really an HTML document is a stored
 *    XSS waiting for somebody to open it directly from the bucket. The
 *    only honest test is whether the bytes parse as the format they
 *    claim — and a parser that can find the dimensions has, by then,
 *    proved the format far past its magic number.
 *
 * 2. DIMENSIONS. next/image needs the intrinsic size to reserve the
 *    right box before the picture arrives. Guess it and the home page
 *    reflows as each photograph lands.
 *
 * ── EXIF ORIENTATION, WHICH IS THE PART THAT WOULD HAVE BITTEN ──────
 * A photograph taken on a phone held upright is very often stored
 * LANDSCAPE with an EXIF tag saying "rotate me". Browsers honour that
 * tag by default (`image-orientation: from-image`), so the picture
 * displays 3024×4032 while its SOF header says 4032×3024.
 *
 * Record the header's numbers and every portrait phone photo the gym
 * uploads gets a landscape box reserved for it: the wrong aspect ratio
 * on the public page and a layout shift as the browser corrects it.
 * So orientations 5–8 — the four that involve a quarter turn — are
 * transposed here, and what this module returns is the size as it will
 * actually be seen.
 * ────────────────────────────────────────────────────────────────────
 *
 * Pure and dependency-free: it takes bytes and returns a fact. That is
 * what makes it testable without a browser, a network or a database, and
 * `dimensions.test.ts` exercises it against real encoded files.
 */

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ImageFormat = (typeof ACCEPTED_TYPES)[number];

/** What the file turned out to be, as opposed to what it claimed. */
export type ImageFacts = {
  readonly format: ImageFormat;
  /** Width as displayed, EXIF rotation already applied. */
  readonly width: number;
  /** Height as displayed, EXIF rotation already applied. */
  readonly height: number;
  /** File extension to store it under, derived from the format, not the name. */
  readonly extension: "jpg" | "png" | "webp";
};

const EXTENSIONS: Record<ImageFormat, ImageFacts["extension"]> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * The one entry point. Returns null for anything it cannot parse, which
 * includes every file that is not one of the three formats above — a
 * refusal, not a guess.
 */
export function readImageFacts(bytes: Uint8Array): ImageFacts | null {
  const raw =
    readPng(bytes) ?? readWebp(bytes) ?? readJpeg(bytes) ?? null;
  if (!raw) return null;

  // A zero or absurd dimension means the parse landed somewhere that
  // happened to look like a header. The database has the same bounds.
  if (
    !Number.isInteger(raw.width) ||
    !Number.isInteger(raw.height) ||
    raw.width < 1 ||
    raw.height < 1 ||
    raw.width > 20000 ||
    raw.height > 20000
  ) {
    return null;
  }

  return { ...raw, extension: EXTENSIONS[raw.format] };
}

type RawFacts = { format: ImageFormat; width: number; height: number };

// ── PNG ──────────────────────────────────────────────────────────────
//
// The easy one. Eight-byte signature, then IHDR is always the first
// chunk, and width and height are the first two fields inside it —
// big-endian, at fixed offsets 16 and 20.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPng(bytes: Uint8Array): RawFacts | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  return {
    format: "image/png",
    width: beUint32(bytes, 16),
    height: beUint32(bytes, 20),
  };
}

// ── WebP ─────────────────────────────────────────────────────────────
//
// A RIFF container with three different payloads, and all three are in
// the wild: VP8 (lossy), VP8L (lossless) and VP8X (extended — the one
// that carries animation and alpha). Each stores its size differently
// and none of them stores it where the others do.

function readWebp(bytes: Uint8Array): RawFacts | null {
  // Enough to reach the chunk name and no further. Each payload below
  // then states its OWN minimum, because they differ by nine bytes and a
  // single shared floor is wrong for two of the three: too low and a
  // truncated file yields a fabricated size that passes the bounds check
  // (every field is stored minus one, so zeroes read as a valid 1x1);
  // too high and a legitimate small VP8L is refused.
  if (bytes.length < 16) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }

  const chunk = ascii(bytes, 12, 4);

  // VP8X: 4 bytes of flags, then canvas width-1 and height-1 as 24-bit
  // little-endian.
  if (chunk === "VP8X") {
    if (bytes.length < 30) return null;
    return {
      format: "image/webp",
      width: leUint24(bytes, 24) + 1,
      height: leUint24(bytes, 27) + 1,
    };
  }

  // VP8L: a 0x2f signature byte, then width-1 and height-1 packed as two
  // 14-bit fields across the next four bytes, little-endian.
  if (chunk === "VP8L") {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const packed =
      (bytes[21] ?? 0) |
      ((bytes[22] ?? 0) << 8) |
      ((bytes[23] ?? 0) << 16) |
      ((bytes[24] ?? 0) << 24);
    return {
      format: "image/webp",
      width: (packed & 0x3fff) + 1,
      // `>>>` rather than `>>`: the top bit of `packed` is set for any
      // image tall enough to reach it, and an arithmetic shift would
      // sign-extend that into a negative height.
      height: ((packed >>> 14) & 0x3fff) + 1,
    };
  }

  // VP8: a 3-byte frame tag, the 3-byte sync code 9d 01 2a, then width
  // and height as 16-bit little-endian with the top two bits used for a
  // scaling hint that is not part of the size.
  if (chunk === "VP8 ") {
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    return {
      format: "image/webp",
      width: leUint16(bytes, 26) & 0x3fff,
      height: leUint16(bytes, 28) & 0x3fff,
    };
  }

  return null;
}

// ── JPEG ─────────────────────────────────────────────────────────────
//
// The awkward one, and the one the gym will actually upload. A JPEG is a
// stream of marker segments and the size lives in a Start Of Frame
// marker that can be preceded by any number of other segments — comments,
// colour profiles, and the EXIF block that decides which way up it goes.
//
// So this walks the segments properly rather than looking at a fixed
// offset. Along the way it keeps the EXIF orientation, because by the
// time the SOF is reached it is too late to go back for it: EXIF is APP1,
// which always comes first.

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readJpeg(bytes: Uint8Array): RawFacts | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  let orientation = 1;

  while (offset + 3 < bytes.length) {
    // Segments are padded with 0xff fill bytes; skip them rather than
    // treating one as a marker with a nonsense length.
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1] ?? 0;

    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    // Standalone markers: no length field, nothing to skip past.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    // Start of Scan — the entropy-coded data begins and there are no
    // more headers worth walking. If the size has not been found by
    // here, it is not going to be.
    if (marker === 0xda) return null;

    const length = beUint16(bytes, offset + 2);
    // A segment length includes its own two bytes, so anything under 2
    // is malformed and would make this loop stand still or go backwards.
    if (length < 2 || offset + 2 + length > bytes.length) return null;

    const payload = offset + 4;

    if (marker === 0xe1) {
      const found = readExifOrientation(bytes, payload, length - 2);
      if (found !== null) orientation = found;
    }

    if (SOF_MARKERS.has(marker)) {
      // precision(1) height(2) width(2)
      const height = beUint16(bytes, payload + 1);
      const width = beUint16(bytes, payload + 3);
      // 5 through 8 are the quarter turns. 1–4 leave the axes alone.
      const turned = orientation >= 5 && orientation <= 8;
      return {
        format: "image/jpeg",
        width: turned ? height : width,
        height: turned ? width : height,
      };
    }

    offset += 2 + length;
  }

  return null;
}

/**
 * Orientation out of an APP1 EXIF block, or null if there isn't one.
 *
 * EXIF is a TIFF file embedded in a JPEG, and TIFF chose to let each file
 * declare its own byte order — "II" for little-endian, "MM" for big.
 * Everything below therefore reads through a variable, which is why this
 * is not four lines.
 */
function readExifOrientation(
  bytes: Uint8Array,
  start: number,
  length: number,
): number | null {
  if (length < 14) return null;
  if (ascii(bytes, start, 4) !== "Exif") return null;

  // "Exif\0\0", then the TIFF header the offsets below are relative to.
  const tiff = start + 6;
  const order = ascii(bytes, tiff, 2);
  const little = order === "II";
  if (!little && order !== "MM") return null;

  const u16 = (at: number) => (little ? leUint16(bytes, at) : beUint16(bytes, at));
  const u32 = (at: number) => (little ? leUint32(bytes, at) : beUint32(bytes, at));

  if (u16(tiff + 2) !== 0x002a) return null;

  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > bytes.length) return null;

  const entries = u16(ifd);
  // 12 bytes an entry. A count large enough to run past the buffer is a
  // corrupt or hostile file, not a photograph.
  if (entries > 512 || ifd + 2 + entries * 12 > bytes.length) return null;

  for (let i = 0; i < entries; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) !== 0x0112) continue;
    // A SHORT value sits in the first two bytes of the 4-byte value
    // field, at both byte orders, because the field is padded on the
    // right in II and the value is left-aligned in MM.
    const value = u16(entry + 8);
    return value >= 1 && value <= 8 ? value : null;
  }

  return null;
}

// ── Byte readers ─────────────────────────────────────────────────────
//
// `?? 0` on every access: a truncated file must produce a wrong number
// that the bounds check rejects, never `undefined` leaking into
// arithmetic as NaN and passing `width > 0`.

function beUint16(b: Uint8Array, at: number): number {
  return ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
}

function leUint16(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
}

function leUint24(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);
}

function beUint32(b: Uint8Array, at: number): number {
  return (
    ((b[at] ?? 0) << 24 |
      (b[at + 1] ?? 0) << 16 |
      (b[at + 2] ?? 0) << 8 |
      (b[at + 3] ?? 0)) >>> 0
  );
}

function leUint32(b: Uint8Array, at: number): number {
  return (
    ((b[at + 3] ?? 0) << 24 |
      (b[at + 2] ?? 0) << 16 |
      (b[at + 1] ?? 0) << 8 |
      (b[at] ?? 0)) >>> 0
  );
}

function ascii(b: Uint8Array, at: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(b[at + i] ?? 0);
  return out;
}
