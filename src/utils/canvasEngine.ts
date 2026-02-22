export type ShapeType = 'square' | 'circle' | 'heart';
export type FilterType = 'none' | 'noir' | 'popart' | 'rainbow';

export interface RGB { r: number; g: number; b: number; }

export interface ProcessOptions {
  gridSize: number; // number of cells across the width
  shape: ShapeType;
  filter: FilterType;
  palette: RGB[]; // Custom color palette
  randomSeed: number; // For pop art randomization
  zoom: number; // Zoom level (1.0 = native, >1.0 = zoom in)
  offsetX: number; // X offset (-0.5 to 0.5)
  offsetY: number; // Y offset (-0.5 to 0.5)
  isDesaturated?: boolean; // New option for 7-color mapping
}

const DESATURATE_PALETTE: RGB[] = [
  { r: 255, g: 0, b: 0 },    // Red
  { r: 255, g: 255, b: 0 },  // Yellow
  { r: 0, g: 255, b: 0 },    // Green
  { r: 0, g: 0, b: 255 },    // Blue
  { r: 255, g: 0, b: 255 },  // Magenta
  { r: 0, g: 0, b: 0 },      // Black
  { r: 255, g: 255, b: 255 } // White
];

export const loadImageFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const topCurveHeight = height * 0.3;
  ctx.moveTo(width / 2, topCurveHeight);
  // top left curve
  ctx.bezierCurveTo(
    width / 2, 0,
    0, 0,
    0, topCurveHeight
  );
  // bottom left
  ctx.bezierCurveTo(
    0, height * 0.6,
    width / 2, height * 0.9,
    width / 2, height
  );
  // bottom right
  ctx.bezierCurveTo(
    width / 2, height * 0.9,
    width, height * 0.6,
    width, topCurveHeight
  );
  // top right curve
  ctx.bezierCurveTo(
    width, 0,
    width / 2, 0,
    width / 2, topCurveHeight
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// Palette logic is now dynamic based on user selection

const getClosestColor = (r: number, g: number, b: number, palette: RGB[]) => {
  if (palette.length === 0) return { r, g, b };
  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const color of palette) {
    const dist = Math.sqrt(Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2));
    if (dist < minDistance) {
      minDistance = dist;
      closestColor = color;
    }
  }
  return closestColor;
};

export const processImage = (image: HTMLImageElement, canvas: HTMLCanvasElement, options: ProcessOptions) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const MAX_WIDTH = 1200;
  let workWidth = image.width;
  let workHeight = image.height;

  if (workWidth > MAX_WIDTH) {
    const ratio = MAX_WIDTH / workWidth;
    workWidth = MAX_WIDTH;
    workHeight = workHeight * ratio;
  }

  canvas.width = workWidth;
  canvas.height = workHeight;

  // OFFSCREEN FOR SAMPLING
  const offscreen = document.createElement('canvas');
  offscreen.width = workWidth;
  offscreen.height = workHeight;
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!offCtx) return;

  // Calculate Source Rectangle for Zoom and Panning
  const zoom = options.zoom || 1.0;
  const sWidth = image.width / zoom;
  const sHeight = image.height / zoom;

  // Base center
  let sx = (image.width - sWidth) / 2;
  let sy = (image.height - sHeight) / 2;

  // Add offsets (clamped)
  // options.offsetX is -0.5 to 0.5
  sx += (options.offsetX || 0) * (image.width - sWidth);
  sy += (options.offsetY || 0) * (image.height - sHeight);

  // Final Clamp
  sx = Math.max(0, Math.min(image.width - sWidth, sx));
  sy = Math.max(0, Math.min(image.height - sHeight, sy));

  offCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, workWidth, workHeight);
  const imgData = offCtx.getImageData(0, 0, workWidth, workHeight).data;

  // CLEAR AND SETUP CLIPPING
  ctx.clearRect(0, 0, workWidth, workHeight);

  ctx.save();
  if (options.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(workWidth / 2, workHeight / 2, Math.min(workWidth, workHeight) / 2, 0, Math.PI * 2);
    ctx.clip();
  } else if (options.shape === 'heart') {
    drawHeart(ctx, 0, 0, workWidth, workHeight);
    ctx.clip();
  }

  // Fill background inside clip (optional, but requested slate background makes sense for contrast)
  // User asked for "crop in that shape", implying transparency outside.
  // We'll keep the background inside the shape for better visibility of the "art".
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, workWidth, workHeight);

  const cellSize = workWidth / options.gridSize;
  const rows = Math.ceil(workHeight / cellSize);

  // Pop Art Randomization Jitter
  const prng = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  let seed = options.randomSeed;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < options.gridSize; x++) {
      const px = x * cellSize;
      const py = y * cellSize;

      let r = 0, g = 0, b = 0, count = 0;
      const step = Math.max(1, Math.floor(cellSize / 4));

      for (let cy = 0; cy < cellSize; cy += step) {
        for (let cx = 0; cx < cellSize; cx += step) {
          const sampleX = Math.floor(px + cx);
          const sampleY = Math.floor(py + cy);
          if (sampleX < workWidth && sampleY < workHeight) {
            const index = (sampleY * workWidth + sampleX) * 4;
            r += imgData[index];
            g += imgData[index + 1];
            b += imgData[index + 2];
            count++;
          }
        }
      }

      if (count > 0) {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
      }

      // Jitter colors if randomization is on
      let targetR = r, targetG = g, targetB = b;
      if (options.randomSeed > 0) {
        targetR = (targetR + prng(seed++) * 50) % 255;
        targetG = (targetG + prng(seed++) * 50) % 255;
        targetB = (targetB + prng(seed++) * 50) % 255;
      }

      // Filtering logic
      if (options.filter === 'noir') {
        const gray = Math.round(targetR * 0.299 + targetG * 0.587 + targetB * 0.114);
        const contrast = gray > 128 ? Math.min(255, gray + 50) : Math.max(0, gray - 50);
        const matched = getClosestColor(contrast, contrast, contrast, options.palette);
        r = matched.r; g = matched.g; b = matched.b;
      } else if (options.filter === 'rainbow' || options.filter === 'popart') {
        // Shared Rainbow Style Mapping
        const max = Math.max(targetR, targetG, targetB);
        const min = Math.min(targetR, targetG, targetB);
        const diff = max - min;
        const brightness = (max + min) / 2;

        let styled = false;
        if (diff < 30) {
          // Desaturated: Grey/Black -> Black, Bright -> White
          if (brightness < 120) { r = 0; g = 0; b = 0; }
          else { r = 255; g = 255; b = 255; }
          styled = true;
        } else if (targetR > targetG && targetG > targetB && targetR > 60 && diff < 120) {
          // Brownish -> Orange
          const orange = options.palette.find(c => c.r === 255 && c.g === 127 && c.b === 0) || options.palette[0];
          r = orange.r; g = orange.g; b = orange.b;
          styled = true;
        }

        if (!styled || options.filter === 'popart') {
          // If custom VIBGYOR (often larger palette), use distance matching
          // Otherwise use Gradient Mapping (brightness -> palette index) for cleaner color separation
          if (options.palette.length > 5 && options.randomSeed > 0) {
            const matched = getClosestColor(targetR, targetG, targetB, options.palette);
            r = matched.r; g = matched.g; b = matched.b;
          } else {
            const brightness = Math.round(targetR * 0.299 + targetG * 0.587 + targetB * 0.114);
            // Map 0-255 to 0-palette.length-1
            const index = Math.floor((brightness / 256) * options.palette.length);
            const matched = options.palette[Math.min(index, options.palette.length - 1)];
            r = matched.r; g = matched.g; b = matched.b;
          }
        }
      } else {
        r = targetR; g = targetG; b = targetB;
      }

      // Final Desaturation mapping (5 colors + BW)
      if (options.isDesaturated) {
        const matched = getClosestColor(r, g, b, DESATURATE_PALETTE);
        r = matched.r; g = matched.g; b = matched.b;
      }

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      const padding = cellSize * 0.1;
      const drawSize = cellSize - padding * 2;
      const drawX = px + padding;
      const drawY = py + padding;

      if (options.shape === 'square') {
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, drawSize, drawSize, drawSize * 0.2);
        ctx.fill();
      } else if (options.shape === 'circle') {
        ctx.beginPath();
        const radius = drawSize / 2;
        ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (options.shape === 'heart') {
        drawHeart(ctx, drawX, drawY, drawSize, drawSize);
      }
    }
  }
  ctx.restore();
};
