import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { buildPrintableTicketText, buildTicketDocument, buildTestEscPosHex, renderTicketDocumentSvg, type PrintJobLike, type PrintRuleLike, type TicketBuildOptions } from './printContentBuilder';

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

function pngToEscPosRaster(pngBuffer: Buffer, feedLines: number) {
  const png = PNG.sync.read(pngBuffer);
  const width = png.width;
  const height = png.height;
  const bytesPerRow = Math.ceil(width / 8);
  const raster = new Uint8Array(bytesPerRow * height);
  let darkPixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (png.width * y + x) * 4;
      const r = png.data[idx] ?? 255;
      const g = png.data[idx + 1] ?? 255;
      const b = png.data[idx + 2] ?? 255;
      const a = png.data[idx + 3] ?? 0;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const isBlack = a > 0 && luminance < 200;
      if (!isBlack) continue;
      darkPixelCount += 1;
      const offset = y * bytesPerRow + (x >> 3);
      raster[offset] |= 0x80 >> (x & 7);
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  const init = Uint8Array.from([0x1b, 0x40, 0x1b, 0x61, 0x01]);
  const imageCmd = Uint8Array.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const feed = Uint8Array.from(Array.from({ length: feedLines }, () => 0x0a));
  const cut = Uint8Array.from([0x1d, 0x56, 0x00]);
  const all = new Uint8Array(init.length + imageCmd.length + raster.length + feed.length + cut.length);
  all.set(init, 0);
  all.set(imageCmd, init.length);
  all.set(raster, init.length + imageCmd.length);
  all.set(feed, init.length + imageCmd.length + raster.length);
  all.set(cut, init.length + imageCmd.length + raster.length + feed.length);
  return { width, height, darkPixelCount, hex: toHex(all) };
}

function maybeWriteDebugArtifact(kind: 'svg' | 'png', jobId: string, data: string | Buffer) {
  const debugDir = process.env.PRINT_DEBUG_DIR;
  if (!debugDir) return null;
  fs.mkdirSync(debugDir, { recursive: true });
  const filePath = path.join(debugDir, `${jobId}.${kind}`);
  fs.writeFileSync(filePath, data);
  return filePath;
}


export async function buildSunmiTicketBitmapContent(job: PrintJobLike, rule: PrintRuleLike = {}, options: TicketBuildOptions = {}) {
  const width = options.width || '80mm';
  if (job.source === 'test') {
    const test = buildTestEscPosHex(job, width);
    return { ...test, width: null, height: null, svg: null, png: null };
  }

  const document = buildTicketDocument(job, rule, options);
  const svg = renderTicketDocumentSvg(document);
  const text = buildPrintableTicketText(job, rule, options);
  const resvg = new Resvg(svg.svg, {
    fitTo: {
      mode: 'width',
      value: svg.width,
    },
    background: 'white',
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const raster = pngToEscPosRaster(pngBuffer, document.feedLines);
  const svgArtifactPath = maybeWriteDebugArtifact('svg', job.id, svg.svg);
  const pngArtifactPath = maybeWriteDebugArtifact('png', job.id, pngBuffer);

  console.info('[ticket-bitmap] render diagnostics', {
    job_id: job.id,
    ticket_type: job.ticket_type,
    width: raster.width,
    height: raster.height,
    svg_length: svg.svg.length,
    png_length: pngBuffer.length,
    dark_pixels: raster.darkPixelCount,
    hex_length: raster.hex.length,
    svg_artifact_path: svgArtifactPath,
    png_artifact_path: pngArtifactPath,
  });

  return {
    text,
    svg: svg.svg,
    png: pngBuffer,
    width: raster.width,
    height: raster.height,
    hex: raster.hex,
    darkPixelCount: raster.darkPixelCount,
  };
}
