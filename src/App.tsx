import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { processImage, loadImageFile } from './utils/canvasEngine';
import type { ShapeType, FilterType, RGB } from './utils/canvasEngine';

const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const RAINBOW_PALETTE: RGB[] = [
  { r: 148, g: 0, b: 211 },    // Violet
  { r: 75, g: 0, b: 130 },     // Indigo
  { r: 0, g: 0, b: 255 },       // Blue
  { r: 0, g: 255, b: 0 },       // Green
  { r: 255, g: 255, b: 0 },     // Yellow
  { r: 255, g: 127, b: 0 },     // Orange
  { r: 255, g: 0, b: 0 },       // Red
  { r: 0, g: 0, b: 0 },         // Black
  { r: 255, g: 255, b: 255 }    // White
];

const RGB_PALETTE: RGB[] = [
  { r: 255, g: 0, b: 0 },   // Red
  { r: 0, g: 255, b: 0 },   // Green
  { r: 0, g: 0, b: 255 },   // Blue
  { r: 0, g: 0, b: 0 },     // Black
  { r: 255, g: 255, b: 255 } // White
];

const YCM_PALETTE: RGB[] = [
  { r: 255, g: 255, b: 0 },   // Yellow
  { r: 0, g: 255, b: 255 },   // Cyan
  { r: 255, g: 0, b: 255 },   // Magenta
  { r: 0, g: 0, b: 0 },       // Black
  { r: 255, g: 255, b: 255 }   // White
];

const REGIA_PALETTE: RGB[] = [
  { r: 210, g: 43, b: 43 },    // Fiery Red
  { r: 255, g: 140, b: 0 },    // Vivid Orange
  { r: 224, g: 17, b: 95 },    // Ruby/Pink
  { r: 204, g: 170, b: 34 },   // Earthy Yellow/Ochre
  { r: 0, g: 71, b: 171 },     // Cobalt Blue
  { r: 0, g: 128, b: 0 },      // Forest Green
  { r: 128, g: 0, b: 128 },    // Purple
  { r: 0, g: 0, b: 0 },        // Black
  { r: 255, g: 255, b: 255 }   // White
];

const SUNSET_PALETTE: RGB[] = [
  { r: 45, g: 3, b: 59 },      // Shadows: Deep Plum
  { r: 140, g: 0, b: 0 },      // Deep Skin: Blood Red
  { r: 214, g: 90, b: 49 },    // Mid Skin: Burnt Orange
  { r: 255, g: 215, b: 0 },    // Highlight: Gold
  { r: 62, g: 84, b: 172 },    // Accent 1: Royal Blue
  { r: 245, g: 232, b: 199 },  // Accent 2: Soft Cream
  { r: 255, g: 46, b: 99 }     // Background: Vibrant Pink
];

const ELECTRIC_PALETTE: RGB[] = [
  { r: 0, g: 0, b: 0 },        // Shadows: True Black
  { r: 78, g: 49, b: 170 },    // Deep Skin: Electric Violet
  { r: 58, g: 16, b: 120 },    // Mid Skin: Deep Grape
  { r: 0, g: 215, b: 255 },    // Highlight: Cyan
  { r: 247, g: 208, b: 96 },   // Accent 1: Mustard
  { r: 255, g: 0, b: 96 },     // Accent 2: Hot Magenta
  { r: 17, g: 106, b: 123 }    // Background: Dark Teal
];

const RETRO_PALETTE: RGB[] = [
  { r: 26, g: 18, b: 11 },     // Shadows: Dark Espresso
  { r: 60, g: 42, b: 33 },     // Deep Skin: Coffee
  { r: 188, g: 108, b: 37 },   // Mid Skin: Terracotta
  { r: 254, g: 250, b: 224 },  // Highlight: Off-White
  { r: 96, g: 108, b: 56 },    // Accent 1: Olive
  { r: 40, g: 54, b: 24 },     // Accent 2: Forest
  { r: 221, g: 161, b: 94 }    // Background: Sandy Orange
];

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [gridSize, setGridSize] = useState<number>(50);
  const [shape, setShape] = useState<ShapeType | 'paper' | 'custom'>('circle');
  const [filter, setFilter] = useState<FilterType>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [brightness, setBrightness] = useState<number>(1.0);
  const [saturation, setSaturation] = useState<number>(1.0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkState, setBlinkState] = useState(false);

  // Separate palettes for Noir (fixed 2) and Pop Art
  const [noirPalette, setNoirPalette] = useState<RGB[]>([
    { r: 0, g: 0, b: 0 },       // Black
    { r: 255, g: 255, b: 255 }  // White
  ]);
  const [popArtScheme, setPopArtScheme] = useState<number>(0); // 0=VIBGYOR, 1=RGB, 2=YCM, 3=Regia, 4=Sunset, 5=Electric, 6=Retro
  const [popPalette, setPopPalette] = useState<RGB[]>(RAINBOW_PALETTE); // Start with VIBGYOR

  const [randomSeed, setRandomSeed] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDesaturated, setIsDesaturated] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-process when options change or image changes
  useEffect(() => {
    if (image && canvasRef.current) {
      setIsProcessing(true);
      setTimeout(() => {
        // Fallback for shapes not yet in engine
        const engineShape = (shape === 'paper' || shape === 'custom') ? 'rectangle' : (shape as ShapeType);

        // Choose correct palette for the engine
        let activePalette: RGB[] = [];
        if (filter === 'noir') activePalette = noirPalette;
        else if (filter === 'popart') {
          if (popArtScheme === 0) activePalette = popPalette;
          else if (popArtScheme === 1) activePalette = RGB_PALETTE;
          else if (popArtScheme === 2) activePalette = YCM_PALETTE;
          else if (popArtScheme === 3) activePalette = REGIA_PALETTE;
          else if (popArtScheme === 4) activePalette = SUNSET_PALETTE;
          else if (popArtScheme === 5) activePalette = ELECTRIC_PALETTE;
          else if (popArtScheme === 6) activePalette = RETRO_PALETTE;
        }
        else if (filter === 'rainbow') activePalette = RAINBOW_PALETTE;

        processImage(image, canvasRef.current!, {
          gridSize,
          shape: engineShape,
          filter,
          palette: activePalette,
          randomSeed,
          zoom,
          offsetX: pan.x,
          offsetY: pan.y,
          isDesaturated,
          brightness,
          saturation,
          blinkState
        });
        setIsProcessing(false);
      }, 50);
    }
  }, [image, gridSize, shape, filter, noirPalette, popPalette, popArtScheme, randomSeed, zoom, pan, isDesaturated, brightness, saturation, blinkState]);

  // Handle the blinking effect timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isBlinking) {
      interval = setInterval(() => {
        setBlinkState(prev => !prev);
      }, 500); // Blink every 500ms
    } else {
      setBlinkState(false); // Reset to off if blinking is disabled
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBlinking]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = await loadImageFile(file);
      setImage(img);
    } catch (err) {
      console.error("Failed to load image", err);
      alert("Failed to load the image.");
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current || !image) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `pixel-art-${Date.now()}.png`;
    a.click();
  };

  const addPopColor = (hex: string) => {
    if (popPalette.length >= 30) return;
    const rgb = hexToRgb(hex);
    if (!popPalette.some(p => p.r === rgb.r && p.g === rgb.g && p.b === rgb.b)) {
      setPopPalette([...popPalette, rgb]);
    }
  };

  const removePopColor = (index: number) => {
    if (popPalette.length <= 1) return;
    setPopPalette(popPalette.filter((_, i) => i !== index));
  };

  const updateNoirColor = (index: number, hex: string) => {
    const newNoir = [...noirPalette];
    newNoir[index] = hexToRgb(hex);
    setNoirPalette(newNoir);
  };

  return (
    <div className="app-container">
      <header>
        <h1>PixelArt Pro</h1>
        <p className="subtitle">Transform anything into beautiful grid-based art</p>
      </header>

      <main className="workspace">
        <section className="glass-panel canvas-panel">
          <div className="canvas-container">
            <canvas ref={canvasRef} />

            {!image && (
              <div
                className="upload-overlay"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <h2>Upload an Image</h2>
                <p>Click or tap to select a photo</p>
              </div>
            )}

            {isProcessing && image && (
              <div className="upload-overlay" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <h2>Processing...</h2>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
            />
          </div>

          {image && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                className="action-btn"
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Photo
              </button>
              <button
                className="action-btn"
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.capture = 'user';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.capture = 'environment'; }, 1000);
                  }
                }}
              >
                Selfie
              </button>
            </div>
          )}
        </section>

        <section className="glass-panel controls-panel">
          <div className="control-group">
            <label>Grid Density: {gridSize}x</label>
            <input
              type="range"
              min="10"
              max="150"
              value={gridSize}
              onChange={(e) => setGridSize(parseInt(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Brightness: {brightness.toFixed(2)}x</label>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.1"
              value={brightness}
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Saturation: {saturation.toFixed(2)}x</label>
            <input
              type="range"
              min="0.0"
              max="3.0"
              step="0.1"
              value={saturation}
              onChange={(e) => setSaturation(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Image Zoom: {zoom.toFixed(1)}x</label>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Image Panning</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: '5px', justifyContent: 'center', marginTop: '5px' }}>
              <div />
              <button className="toggle-btn" onClick={() => setPan((p: { x: number, y: number }) => ({ ...p, y: Math.max(-0.5, p.y - 0.1) }))}>↑</button>
              <div />
              <button className="toggle-btn" onClick={() => setPan((p: { x: number, y: number }) => ({ ...p, x: Math.max(-0.5, p.x - 0.1) }))}>←</button>
              <button className="toggle-btn" onClick={() => setPan({ x: 0, y: 0 })}>•</button>
              <button className="toggle-btn" onClick={() => setPan((p: { x: number, y: number }) => ({ ...p, x: Math.min(0.5, p.x + 0.1) }))}>→</button>
              <div />
              <button className="toggle-btn" onClick={() => setPan((p: { x: number, y: number }) => ({ ...p, y: Math.min(0.5, p.y + 0.1) }))}>↓</button>
              <div />
            </div>
          </div>

          <div className="control-group">
            <label>Shape</label>
            <div className="toggle-group">
              <button className={`toggle-btn ${shape === 'rectangle' ? 'active' : ''}`} onClick={() => setShape('rectangle')}>Rectangle</button>
              <button className={`toggle-btn ${shape === 'square' ? 'active' : ''}`} onClick={() => setShape('square')}>Square</button>
              <button className={`toggle-btn ${shape === 'circle' ? 'active' : ''}`} onClick={() => setShape('circle')}>Circle</button>
              <button className={`toggle-btn ${shape === 'heart' ? 'active' : ''}`} onClick={() => setShape('heart')}>Heart</button>
            </div>
          </div>

          <div className="control-group">
            <label>Style Filter</label>
            <div className="toggle-group">
              <button className={`toggle-btn ${filter === 'none' ? 'active' : ''}`} onClick={() => setFilter('none')}>Standard</button>
              <button className={`toggle-btn ${filter === 'noir' ? 'active' : ''}`} onClick={() => setFilter('noir')}>Noir</button>
              <button
                className={`toggle-btn ${filter === 'popart' ? 'active' : ''}`}
                onClick={() => {
                  if (filter === 'popart') setPopArtScheme((popArtScheme + 1) % 7);
                  else setFilter('popart');
                }}
              >
                Pop Art {filter === 'popart' ? `(${popArtScheme === 0 ? 'VIBGYOR' : popArtScheme === 1 ? 'RGB' : popArtScheme === 2 ? 'YCM' : popArtScheme === 3 ? 'Regia' : popArtScheme === 4 ? 'Sunset' : popArtScheme === 5 ? 'Electric' : 'Retro'})` : ''}
              </button>
              <button
                className={`toggle-btn ${filter === 'rainbow' ? 'active' : ''}`}
                onClick={() => setFilter(filter === 'rainbow' ? 'none' : 'rainbow')}
              >
                Rainbow
              </button>
            </div>
          </div>

          <div className="control-group">
            <label>Filters & Refinement</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${randomSeed > 0 ? 'active' : ''}`}
                onClick={() => setRandomSeed(randomSeed > 0 ? 0 : Date.now())}
              >
                {randomSeed > 0 ? 'Randomized' : 'Uniform'}
              </button>
              <button
                className={`toggle-btn ${isDesaturated ? 'active' : ''}`}
                onClick={() => setIsDesaturated(!isDesaturated)}
              >
                {isDesaturated ? '7-Colors Only' : 'Full Palette'}
              </button>
              <button
                className={`toggle-btn ${isBlinking ? 'active' : ''}`}
                onClick={() => setIsBlinking(!isBlinking)}
              >
                {isBlinking ? 'Stop Blinking' : '10th Row/Col Blink'}
              </button>
            </div>
          </div>

          {filter !== 'none' && filter !== 'rainbow' && (
            <div className="control-group">
              <label>
                {filter === 'noir' ? 'Noir Duotone' :
                  popArtScheme === 0 ? `Palette (${popPalette.length}/30)` :
                    popArtScheme === 1 ? 'RGB Palette' :
                      popArtScheme === 2 ? 'YCM Palette' :
                        popArtScheme === 3 ? 'Regia Palette' :
                          popArtScheme === 4 ? 'Sunset Soul Palette' :
                            popArtScheme === 5 ? 'Electric Palette' : 'Retro Earth Palette'}
              </label>
              {((filter === 'popart' && popArtScheme === 0) || filter === 'noir') && (
                <div className="palette-grid">
                  {filter === 'noir' ? (
                    noirPalette.map((color, i) => (
                      <div
                        key={i}
                        className="color-swatch"
                        style={{ background: `rgb(${color.r}, ${color.g}, ${color.b})`, border: '1px solid white' }}
                        title="Click to edit"
                      >
                        <input
                          type="color"
                          onChange={(e) => updateNoirColor(i, e.target.value)}
                          value={rgbToHex(color.r, color.g, color.b)}
                          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                        />
                      </div>
                    ))
                  ) : (
                    <>
                      {popPalette.map((color, i) => (
                        <div
                          key={i}
                          className="color-swatch"
                          style={{ background: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                          onClick={() => removePopColor(i)}
                          title="Click to remove"
                        />
                      ))}
                      {popPalette.length < 30 && (
                        <div className="color-swatch add-color">
                          +
                          <input
                            type="color"
                            onChange={(e) => addPopColor(e.target.value)}
                            value="#ffffff"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            className="action-btn"
            onClick={handleDownload}
            disabled={!image}
            style={{ opacity: !image ? 0.5 : 1, cursor: !image ? 'not-allowed' : 'pointer', marginTop: '1rem' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 24, height: 24 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Art
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;
