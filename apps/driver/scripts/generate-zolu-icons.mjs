import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const colors = {
  cream: [0xf5, 0xef, 0xe2],
  gold: [0xf2, 0xa5, 0x00],
  forest: [0x0d, 0x4a, 0x37],
};
const samplesPerAxis = 8;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function insideRoundedSquare(x, y, size, radius) {
  const nearestX = Math.max(radius, Math.min(size - radius, x));
  const nearestY = Math.max(radius, Math.min(size - radius, y));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function renderLogo(size) {
  const samplesPerPixel = samplesPerAxis * samplesPerAxis;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const center = size / 2;
  const outerRadius = size * 0.3;
  const innerRadius = size * 0.2;
  const cornerRadius = size * 0.18;

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < size; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let coveredSamples = 0;

      for (let sampleY = 0; sampleY < samplesPerAxis; sampleY += 1) {
        for (let sampleX = 0; sampleX < samplesPerAxis; sampleX += 1) {
          const pointX = x + (sampleX + 0.5) / samplesPerAxis;
          const pointY = y + (sampleY + 0.5) / samplesPerAxis;
          if (!insideRoundedSquare(pointX, pointY, size, cornerRadius)) continue;

          const dx = pointX - center;
          const dy = pointY - center;
          const distanceSquared = dx * dx + dy * dy;
          let color = colors.cream;

          if (distanceSquared >= innerRadius * innerRadius && distanceSquared <= outerRadius * outerRadius) {
            const degrees = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
            color = degrees >= 270 || degrees <= 30 ? colors.gold : colors.forest;
          }

          red += color[0];
          green += color[1];
          blue += color[2];
          coveredSamples += 1;
        }
      }

      const pixelOffset = rowStart + 1 + x * 4;
      if (coveredSamples === 0) continue;
      raw[pixelOffset] = Math.round(red / coveredSamples);
      raw[pixelOffset + 1] = Math.round(green / coveredSamples);
      raw[pixelOffset + 2] = Math.round(blue / coveredSamples);
      raw[pixelOffset + 3] = Math.round((coveredSamples / samplesPerPixel) * 255);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const assetsDir = fileURLToPath(new URL('../assets/', import.meta.url));
mkdirSync(assetsDir, { recursive: true });
for (const size of [512, 64]) {
  writeFileSync(`${assetsDir}${size === 512 ? 'icon' : 'favicon'}.png`, renderLogo(size));
}