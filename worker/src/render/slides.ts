import sharp from "sharp";

/**
 * Still frames for the recap, rendered with sharp. Frames are produced at 2×
 * the output resolution so the Ken Burns zoom/pan stays smooth and sharp.
 */

export const OUT_W = 1920;
export const OUT_H = 1080;
export const FRAME_W = OUT_W * 2;
export const FRAME_H = OUT_H * 2;

const BG = "#120b20";
const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'EB Garamond', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";

function escapeXml(text: string) {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/**
 * A photo placed on a 16:9 frame. Landscape photos near 16:9 fill the frame
 * (smart crop keeps the subject); portrait and square photos are shown whole
 * over a soft, darkened, blurred version of themselves — never distorted.
 */
export async function composePhotoFrame(input: string, output: string) {
  const meta = await sharp(input).metadata();
  const aspect = (meta.width ?? 1) / (meta.height ?? 1);

  if (aspect >= 1.45 && aspect <= 2.1) {
    await sharp(input)
      .resize(FRAME_W, FRAME_H, { fit: "cover", position: sharp.strategy.attention })
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toFile(output);
    return;
  }

  const background = await sharp(input)
    .resize(192, 108, { fit: "cover" })
    .blur(6)
    .modulate({ brightness: 0.5, saturation: 0.85 })
    .resize(FRAME_W, FRAME_H, { kernel: "cubic" })
    .blur(24)
    .toBuffer();

  const margin = Math.round(FRAME_H * 0.06);
  const foreground = await sharp(input)
    .resize(FRAME_W - margin * 2, FRAME_H - margin * 2, { fit: "inside", withoutEnlargement: false })
    .toBuffer({ resolveWithObject: true });

  await sharp(background)
    .composite([
      {
        input: foreground.data,
        left: Math.round((FRAME_W - foreground.info.width) / 2),
        top: Math.round((FRAME_H - foreground.info.height) / 2),
      },
    ])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(output);
}

async function textFrame(svgBody: string, output: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">
    <rect width="100%" height="100%" fill="${BG}"/>
    ${svgBody}
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(output);
}

/** Opening card: "October 2026 — A month of us." */
export function titleFrame(month: string, tagline: string, output: string) {
  return textFrame(
    `<text x="50%" y="1020" text-anchor="middle" font-family="${SANS}" font-size="230" font-weight="600" letter-spacing="-7" fill="#f3eeff">${escapeXml(month)}</text>
     <text x="50%" y="1230" text-anchor="middle" font-family="${SERIF}" font-size="112" font-style="italic" fill="#c9b5ff">${escapeXml(tagline)}</text>`,
    output,
  );
}

/** Closing card: month, counts, closing line. */
export function endFrame(month: string, lines: string[], closing: string, output: string) {
  const startY = 1040 - (lines.length - 1) * 70;
  const statLines = lines
    .map(
      (line, i) =>
        `<text x="50%" y="${startY + i * 140}" text-anchor="middle" font-family="${SANS}" font-size="96" font-weight="400" fill="#d9cdf7">${escapeXml(line)}</text>`,
    )
    .join("");
  return textFrame(
    `<text x="50%" y="${startY - 260}" text-anchor="middle" font-family="${SANS}" font-size="150" font-weight="600" letter-spacing="-4" fill="#f3eeff">${escapeXml(month)}</text>
     ${statLines}
     <text x="50%" y="${startY + lines.length * 140 + 150}" text-anchor="middle" font-family="${SERIF}" font-size="108" font-style="italic" fill="#c9b5ff">${escapeXml(closing)}</text>`,
    output,
  );
}

/**
 * Transparent overlay (output resolution) with a discreet date in the lower
 * left and a gentle gradient for legibility. Composited after the zoom so the
 * text stays perfectly still.
 */
export async function dateOverlay(label: string, output: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.42"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${OUT_H - 320}" width="${OUT_W}" height="320" fill="url(#g)"/>
    <text x="96" y="${OUT_H - 92}" font-family="${SANS}" font-size="34" font-weight="500" letter-spacing="1.5" fill="#ffffff" fill-opacity="0.92">${escapeXml(label)}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(output);
}

export async function posterFrom(frame: string, output: string) {
  await sharp(frame).resize(1280, 720, { fit: "cover" }).jpeg({ quality: 84, mozjpeg: true }).toFile(output);
}
