import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { readImageFacts } from "@/lib/images/dimensions";

/**
 * The image header parser.
 *
 * Two kinds of case, and both matter:
 *
 *   REAL FILES. The five photographs on the site, whose true dimensions
 *   were measured with `sips` and are asserted here. If the parser and
 *   the operating system ever disagree about how big a picture is, the
 *   parser is wrong.
 *
 *   SYNTHETIC BYTES. Formats and edge cases we have no sample of — an
 *   EXIF-rotated phone photo, the three WebP payloads, a truncated file,
 *   an HTML document wearing a .jpg extension. Built here rather than
 *   committed as fixtures so every byte is visible in the test.
 */

const bytesOf = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../../public/images/${name}`, import.meta.url)));

describe("readImageFacts — the photographs actually on the site", () => {
  // Measured with `sips -g pixelWidth -g pixelHeight`, not copied from
  // the code the parser is meant to be replacing.
  const known: [string, number, number][] = [
    ["gym-class.jpeg", 1440, 1080],
    ["gym-pads.jpeg", 499, 974],
    ["gloves.jpeg", 2560, 1706],
    ["shadow.jpeg", 2560, 1828],
    ["silhouette.jpeg", 2560, 1706],
    ["hero.jpeg", 2560, 1706],
    ["promo.jpeg", 1706, 2560],
    ["beginner.jpeg", 1531, 2560],
  ];

  for (const [name, width, height] of known) {
    it(`reads ${name} as ${width}x${height}`, () => {
      const facts = readImageFacts(bytesOf(name));
      assert.deepEqual(facts, {
        format: "image/jpeg",
        width,
        height,
        extension: "jpg",
      });
    });
  }
});

/**
 * A JPEG carrying an EXIF orientation, assembled by hand.
 *
 * This is the case that would have shipped broken: the header says
 * landscape, the tag says "quarter turn", and every browser shows it
 * portrait. Recording the header's numbers would reserve a landscape box
 * on the home page for a portrait photograph.
 */
function jpegWithOrientation(
  orientation: number,
  sofWidth: number,
  sofHeight: number,
): Uint8Array {
  const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
  const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];

  // A TIFF file, little-endian, with a single IFD entry: tag 0x0112.
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, // "II", 42
    ...le32(8),             // IFD0 starts 8 bytes in
    ...le16(1),             // one entry
    ...le16(0x0112),        // tag: Orientation
    ...le16(3),             // type: SHORT
    ...le32(1),             // count: 1
    ...le16(orientation),   // the value, left-aligned in a 4-byte field
    ...le16(0),             // its padding
    ...le32(0),             // no next IFD
  ];

  const app1 = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0"

  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, ...be16(app1.length + 2), ...app1,
    0xff, 0xc0, ...be16(17), 8, ...be16(sofHeight), ...be16(sofWidth),
    0, 0, 0, 0, 0, 0, 0, 0,
    0xff, 0xd9,
  ]);
}

describe("readImageFacts — EXIF orientation", () => {
  it("leaves the axes alone for the four upright orientations", () => {
    for (const orientation of [1, 2, 3, 4]) {
      const facts = readImageFacts(jpegWithOrientation(orientation, 4032, 3024));
      assert.equal(facts?.width, 4032, `orientation ${orientation}`);
      assert.equal(facts?.height, 3024, `orientation ${orientation}`);
    }
  });

  it("transposes the four quarter turns — the phone-photo case", () => {
    for (const orientation of [5, 6, 7, 8]) {
      const facts = readImageFacts(jpegWithOrientation(orientation, 4032, 3024));
      assert.equal(facts?.width, 3024, `orientation ${orientation}`);
      assert.equal(facts?.height, 4032, `orientation ${orientation}`);
    }
  });

  it("ignores an orientation outside the defined range", () => {
    const facts = readImageFacts(jpegWithOrientation(99, 4032, 3024));
    assert.equal(facts?.width, 4032);
  });
});

describe("readImageFacts — PNG and the three WebP payloads", () => {
  it("reads a PNG from its IHDR", () => {
    const be32 = (n: number) => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...be32(13), 0x49, 0x48, 0x44, 0x52, // length, "IHDR"
      ...be32(1200), ...be32(800),
    ]);
    assert.deepEqual(readImageFacts(png), {
      format: "image/png",
      width: 1200,
      height: 800,
      extension: "png",
    });
  });

  const riff = (chunk: string, body: number[]) =>
    new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, // "RIFF", size
      0x57, 0x45, 0x42, 0x50,             // "WEBP"
      ...[...chunk].map((c) => c.charCodeAt(0)),
      0, 0, 0, 0,                          // chunk size
      ...body,
    ]);

  it("reads VP8X, where the size is 24-bit and stored minus one", () => {
    const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
    const webp = riff("VP8X", [0, 0, 0, 0, ...le24(1919), ...le24(1079)]);
    assert.deepEqual(readImageFacts(webp), {
      format: "image/webp",
      width: 1920,
      height: 1080,
      extension: "webp",
    });
  });

  it("reads VP8L, where two 14-bit fields share four bytes", () => {
    const packed = (1920 - 1) | ((1080 - 1) << 14);
    const webp = riff("VP8L", [
      0x2f,
      packed & 0xff,
      (packed >>> 8) & 0xff,
      (packed >>> 16) & 0xff,
      (packed >>> 24) & 0xff,
      0, 0, 0, 0,
    ]);
    assert.deepEqual(readImageFacts(webp), {
      format: "image/webp",
      width: 1920,
      height: 1080,
      extension: "webp",
    });
  });

  it("reads VP8L at a height whose top bit is set", () => {
    // 16383 sets bit 27 of `packed`, and a signed right shift would
    // sign-extend it into a negative height.
    const packed = (16383 - 1) | ((16383 - 1) << 14);
    const webp = riff("VP8L", [
      0x2f,
      packed & 0xff,
      (packed >>> 8) & 0xff,
      (packed >>> 16) & 0xff,
      (packed >>> 24) & 0xff,
      0, 0, 0, 0,
    ]);
    assert.equal(readImageFacts(webp)?.height, 16383);
  });

  it("reads VP8, masking off the two scaling bits", () => {
    const webp = riff("VP8 ", [
      0, 0, 0,                // frame tag
      0x9d, 0x01, 0x2a,       // sync code
      0x80, 0x07,             // 1920, low 14 bits
      0x38, 0x04,             // 1080
    ]);
    assert.deepEqual(readImageFacts(webp), {
      format: "image/webp",
      width: 1920,
      height: 1080,
      extension: "webp",
    });
  });
});

describe("readImageFacts — what it refuses", () => {
  const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

  it("refuses an HTML document, whatever it is called", () => {
    // The stored-XSS case. `file.type` and the extension both lie; the
    // bytes cannot.
    assert.equal(readImageFacts(bytes("<html><script>alert(1)</script>")), null);
  });

  it("refuses SVG — it parses as text and can carry script", () => {
    assert.equal(readImageFacts(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  });

  it("refuses an empty file", () => {
    assert.equal(readImageFacts(new Uint8Array(0)), null);
  });

  it("refuses a JPEG that stops before its size", () => {
    assert.equal(readImageFacts(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), null);
  });

  it("refuses a JPEG whose segment length would loop forever", () => {
    // A length below 2 does not advance the walk. Without the guard this
    // spins until the process is killed.
    const evil = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0, 0, 0, 0]);
    assert.equal(readImageFacts(evil), null);
  });

  it("refuses a JPEG with no frame header before the scan", () => {
    const noSof = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0, 0,
      0xff, 0xda, 0x00, 0x04, 0, 0,
    ]);
    assert.equal(readImageFacts(noSof), null);
  });

  it("refuses a PNG claiming zero width", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    assert.equal(readImageFacts(png), null);
  });
});

describe("readImageFacts — WebP length floors", () => {
  const riff = (chunk: string, body: number[]) =>
    new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0,
      0x57, 0x45, 0x42, 0x50,
      ...[...chunk].map((c) => c.charCodeAt(0)),
      0, 0, 0, 0,
      ...body,
    ]);

  it("accepts a VP8L that is only 25 bytes long", () => {
    // The smallest legitimate VP8L. A shared 30-byte floor rejected this.
    const packed = 0 | (0 << 14); // 1x1
    const webp = riff("VP8L", [
      0x2f, packed & 0xff, 0, 0, 0,
    ]);
    assert.equal(webp.length, 25);
    assert.deepEqual(readImageFacts(webp), {
      format: "image/webp",
      width: 1,
      height: 1,
      extension: "webp",
    });
  });

  it("refuses a VP8X truncated mid-size rather than inventing one", () => {
    // Every WebP size field is stored minus one, so a run of zeroes off
    // the end of a short buffer reads as a perfectly valid 1x1 image.
    // Without the floor this returns a fact about a file it never read.
    const webp = riff("VP8X", [0, 0, 0, 0, 0, 0]);
    assert.equal(webp.length, 26);
    assert.equal(readImageFacts(webp), null);
  });
});
