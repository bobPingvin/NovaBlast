import React, { useRef, useState, useEffect, useMemo } from 'react';
import { GridState, Coordinates, ToolType, SymmetryAxisType } from '../types';
import { Language, getTranslation } from '../src/l10n';
import { Ruler, X, Compass, Maximize2, Minimize2, Eye, EyeOff, FlipHorizontal, Columns2, Rows2, Grid2x2, Move, Sparkles, ArrowLeftRight, ArrowUpDown } from 'lucide-react';

interface CanvasProps {
  grid: GridState;
  setGrid: (grid: GridState) => void;
  activeTool: ToolType;
  activeColor: string;
  setActiveColor: (c: string) => void;
  width: number;
  height: number;
  brushSize: number;
  gradientColors: string[];
  showGrid: boolean;
  onionSkinGrid?: GridState | null;
  language?: Language;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  grid, 
  setGrid, 
  activeTool, 
  activeColor, 
  setActiveColor,
  width,
  height,
  brushSize,
  gradientColors,
  showGrid,
  onionSkinGrid,
  language = 'ru'
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onionCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverCoord, setHoverCoord] = useState<Coordinates | null>(null);
  
  // Tool-specific states
  const [gradientStart, setGradientStart] = useState<Coordinates | null>(null);
  const [gradientMask, setGradientMask] = useState<boolean[][] | null>(null);
  const [lineStart, setLineStart] = useState<Coordinates | null>(null);
  
  // Persistent Ruler state (stays active across tool switches so user can draw along measurement)
  const [rulerStart, setRulerStart] = useState<Coordinates | null>(null);
  const [rulerEnd, setRulerEnd] = useState<Coordinates | null>(null);
  const [isRulerCollapsed, setIsRulerCollapsed] = useState(false);

  // Symmetry (Mirror) State
  const [symmetryAxis, setSymmetryAxis] = useState<SymmetryAxisType>('vertical');
  const [symmetryAxisX, setSymmetryAxisX] = useState<number>(width / 2);
  const [symmetryAxisY, setSymmetryAxisY] = useState<number>(height / 2);
  const [isSymmetryCollapsed, setIsSymmetryCollapsed] = useState(false);
  const [isDraggingAxis, setIsDraggingAxis] = useState<'x' | 'y' | null>(null);

  // Update default symmetry axes when canvas dimensions change
  useEffect(() => {
    setSymmetryAxisX(width / 2);
    setSymmetryAxisY(height / 2);
  }, [width, height]);

  // Zoom and Pan State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 600, h: 600 });

  // Measure container size with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ w: rect.width, h: rect.height });
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          setContainerSize({ w, h });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Helper to deep copy grid
  const cloneGrid = (g: GridState): GridState => g.map(row => [...row]);

  // Draw the grid onto the canvas whenever it changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = grid[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, [grid, width, height]);

  // Draw onion skin canvas whenever onionSkinGrid changes
  useEffect(() => {
    const canvas = onionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!onionSkinGrid) return;

    ctx.globalAlpha = 0.35;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = onionSkinGrid[y]?.[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }, [onionSkinGrid, width, height]);

  // Only clear active line drag state when tool changes; keep ruler persistent!
  useEffect(() => {
    setLineStart(null);
  }, [activeTool]);

  // Helper to get grid coordinates from mouse event
  const getGridCoords = (e: React.MouseEvent | MouseEvent): Coordinates | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      return { x, y };
    }
    return null;
  };

  // Reset transform when dimensions change significantly
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [width, height]);

  // Spacebar Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const lastDrawCoord = useRef<Coordinates | null>(null);

  // Helper to compute symmetrical coordinates for any given pixel (x, y)
  const getSymmetricPoints = (x: number, y: number): Coordinates[] => {
    const pts: Coordinates[] = [{ x, y }];
    const mirX = Math.round(2 * symmetryAxisX - 1 - x);
    const mirY = Math.round(2 * symmetryAxisY - 1 - y);

    const hasMirX = mirX >= 0 && mirX < width && mirX !== x;
    const hasMirY = mirY >= 0 && mirY < height && mirY !== y;

    if (symmetryAxis === 'vertical') {
      if (hasMirX) {
        pts.push({ x: mirX, y });
      }
    } else if (symmetryAxis === 'horizontal') {
      if (hasMirY) {
        pts.push({ x, y: mirY });
      }
    } else if (symmetryAxis === 'dual') {
      if (hasMirX) pts.push({ x: mirX, y });
      if (hasMirY) pts.push({ x, y: mirY });
      if (hasMirX && hasMirY) pts.push({ x: mirX, y: mirY });
    }

    return pts;
  };

  // Flip canvas operations across current symmetry axes
  const flipCanvasLeftToRight = () => {
    const newGrid = cloneGrid(grid);
    let changed = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < Math.floor(symmetryAxisX); x++) {
        const mirX = Math.round(2 * symmetryAxisX - 1 - x);
        if (mirX >= 0 && mirX < width) {
          if (newGrid[y][mirX] !== grid[y][x]) {
            newGrid[y][mirX] = grid[y][x];
            changed = true;
          }
        }
      }
    }
    if (changed) setGrid(newGrid);
  };

  const flipCanvasRightToLeft = () => {
    const newGrid = cloneGrid(grid);
    let changed = false;
    for (let y = 0; y < height; y++) {
      for (let x = Math.ceil(symmetryAxisX); x < width; x++) {
        const mirX = Math.round(2 * symmetryAxisX - 1 - x);
        if (mirX >= 0 && mirX < width) {
          if (newGrid[y][mirX] !== grid[y][x]) {
            newGrid[y][mirX] = grid[y][x];
            changed = true;
          }
        }
      }
    }
    if (changed) setGrid(newGrid);
  };

  const flipCanvasTopToBottom = () => {
    const newGrid = cloneGrid(grid);
    let changed = false;
    for (let y = 0; y < Math.floor(symmetryAxisY); y++) {
      const mirY = Math.round(2 * symmetryAxisY - 1 - y);
      if (mirY >= 0 && mirY < height) {
        for (let x = 0; x < width; x++) {
          if (newGrid[mirY][x] !== grid[y][x]) {
            newGrid[mirY][x] = grid[y][x];
            changed = true;
          }
        }
      }
    }
    if (changed) setGrid(newGrid);
  };

  const flipCanvasBottomToTop = () => {
    const newGrid = cloneGrid(grid);
    let changed = false;
    for (let y = Math.ceil(symmetryAxisY); y < height; y++) {
      const mirY = Math.round(2 * symmetryAxisY - 1 - y);
      if (mirY >= 0 && mirY < height) {
        for (let x = 0; x < width; x++) {
          if (newGrid[mirY][x] !== grid[y][x]) {
            newGrid[mirY][x] = grid[y][x];
            changed = true;
          }
        }
      }
    }
    if (changed) setGrid(newGrid);
  };

  // Paint function that mutates the grid directly
  const applyPaint = (x: number, y: number, gridToMutate: GridState): boolean => {
    if (activeTool === ToolType.PICKER) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const currentColor = gridToMutate[y][x];
        if (currentColor) setActiveColor(currentColor);
      }
      return false;
    }

    let changed = false;
    const offset = Math.floor(brushSize / 2);

    for (let dy = 0; dy < brushSize; dy++) {
      for (let dx = 0; dx < brushSize; dx++) {
        const targetX = x - offset + dx;
        const targetY = y - offset + dy;

        if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
          const currentColor = gridToMutate[targetY][targetX];
          
          if (activeTool === ToolType.PEN || activeTool === ToolType.MIRROR) {
            if (currentColor !== activeColor) {
              gridToMutate[targetY][targetX] = activeColor;
              changed = true;
            }
          } else if (activeTool === ToolType.ERASER) {
            if (currentColor !== null) {
              gridToMutate[targetY][targetX] = null;
              changed = true;
            }
          }
        }
      }
    }

    return changed;
  };

  // Calculate Bresenham pixel coordinates with brush size
  const getLinePixels = (x0: number, y0: number, x1: number, y1: number, bSize: number): Coordinates[] => {
    const points: Coordinates[] = [];
    const visited = new Set<string>();
    const offset = Math.floor(bSize / 2);

    const addBrush = (cx: number, cy: number) => {
      for (let dy = 0; dy < bSize; dy++) {
        for (let dx = 0; dx < bSize; dx++) {
          const tx = cx - offset + dx;
          const ty = cy - offset + dy;
          if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
            const key = `${tx},${ty}`;
            if (!visited.has(key)) {
              visited.add(key);
              points.push({ x: tx, y: ty });
            }
          }
        }
      }
    };

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      addBrush(cx, cy);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }

    return points;
  };

  const paintLine = (x0: number, y0: number, x1: number, y1: number, currentGrid: GridState): GridState | null => {
    const newGrid = cloneGrid(currentGrid);
    let changed = false;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      if (applyPaint(cx, cy, newGrid)) {
        changed = true;
      }

      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }

    return changed ? newGrid : null;
  };

  const hexToRgb = (hex: string) => {
    if (hex === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: result[4] ? parseInt(result[4], 16) / 255 : 1
    } : { r: 0, g: 0, b: 0, a: 1 };
  };

  const interpolateColor = (color1: string, color2: string, factor: number) => {
    if (color1 === 'transparent' && color2 === 'transparent') return null;
    
    let c1 = hexToRgb(color1);
    let c2 = hexToRgb(color2);
    
    if (color1 === 'transparent') c1 = { ...c2, a: 0 };
    if (color2 === 'transparent') c2 = { ...c1, a: 0 };
    
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    const a = c1.a + factor * (c2.a - c1.a);

    if (a <= 0.01) return null;
    if (a >= 0.99) return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    
    const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}${alphaHex}`;
  };

  const blendColors = (bg: string | null, fg: string | null) => {
    if (!fg) return bg;
    if (!bg) return fg;
    
    const fgRgb = hexToRgb(fg);
    const bgRgb = hexToRgb(bg);
    
    if (fgRgb.a >= 0.99) return fg;
    if (fgRgb.a <= 0.01) return bg;
    
    const a = fgRgb.a + bgRgb.a * (1 - fgRgb.a);
    if (a <= 0.01) return null;
    
    const r = Math.round((fgRgb.r * fgRgb.a + bgRgb.r * bgRgb.a * (1 - fgRgb.a)) / a);
    const g = Math.round((fgRgb.g * fgRgb.a + bgRgb.g * bgRgb.a * (1 - fgRgb.a)) / a);
    const b = Math.round((fgRgb.b * fgRgb.a + bgRgb.b * bgRgb.a * (1 - fgRgb.a)) / a);
    
    if (a >= 0.99) return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    
    const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}${alphaHex}`;
  };

  const getFloodFillMask = (startX: number, startY: number, currentGrid: GridState): boolean[][] => {
    const mask = Array(height).fill(false).map(() => Array(width).fill(false));
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return mask;

    const targetColor = currentGrid[startY][startX];
    const queue: Coordinates[] = [{ x: startX, y: startY }];
    
    const visited = Array(height).fill(false).map(() => Array(width).fill(false));
    visited[startY][startX] = true;
    mask[startY][startX] = true;

    let iterations = 0;
    const maxIterations = width * height * 10;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const { x, y } = queue.pop()!;

      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
          if (!visited[n.y][n.x] && currentGrid[n.y][n.x] === targetColor) {
            visited[n.y][n.x] = true;
            mask[n.y][n.x] = true;
            queue.push(n);
          }
        }
      }
    }
    return mask;
  };

  const applyGradient = (start: Coordinates, end: Coordinates, mask: boolean[][]) => {
    if (start.x === end.x && start.y === end.y) return;
    
    const newGrid = cloneGrid(grid);
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    
    let changed = false;
    const N = gradientColors.length;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y][x]) continue;

        const vx = x - start.x;
        const vy = y - start.y;
        let t = (vx * dx + vy * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
        
        let colorToApply: string | null = null;

        if (t >= 1) {
          colorToApply = gradientColors[N - 1] === 'transparent' ? null : gradientColors[N - 1];
        } else if (t <= 0) {
          colorToApply = gradientColors[0] === 'transparent' ? null : gradientColors[0];
        } else {
          const scaledT = t * (N - 1);
          const index = Math.floor(scaledT);
          const localT = scaledT - index;
          
          const colorA = gradientColors[index];
          const colorB = gradientColors[index + 1];
          
          colorToApply = interpolateColor(colorA, colorB, localT);
        }
        
        const blendedColor = blendColors(newGrid[y][x], colorToApply);
        
        if (newGrid[y][x] !== blendedColor) {
          newGrid[y][x] = blendedColor;
          changed = true;
        }
      }
    }
    if (changed) setGrid(newGrid);
  };

  const handleFloodFill = (startX: number, startY: number) => {
    const targetColor = grid[startY][startX];
    if (targetColor === activeColor) return;

    const mask = getFloodFillMask(startX, startY, grid);
    const newGrid = cloneGrid(grid);
    let changed = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x]) {
          newGrid[y][x] = activeColor;
          changed = true;
        }
      }
    }
    if (changed) setGrid(newGrid);
  };

  const handleMouseDown = (x: number, y: number, e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 0) {
      if (activeTool === ToolType.FILL) {
        handleFloodFill(x, y);
      } else if (activeTool === ToolType.GRADIENT) {
        setIsDrawing(true);
        setGradientStart({ x, y });
        setGradientMask(getFloodFillMask(x, y, grid));
      } else if (activeTool === ToolType.LINE) {
        setIsDrawing(true);
        setLineStart({ x, y });
      } else if (activeTool === ToolType.RULER) {
        setIsDrawing(true);
        setRulerStart({ x, y });
        setRulerEnd({ x, y });
      } else if (activeTool === ToolType.MIRROR) {
        setIsDrawing(true);
        lastDrawCoord.current = { x, y };
        const newGrid = cloneGrid(grid);
        let changed = false;
        const symPoints = getSymmetricPoints(x, y);
        for (const pt of symPoints) {
          if (applyPaint(pt.x, pt.y, newGrid)) {
            changed = true;
          }
        }
        if (changed) {
          setGrid(newGrid);
        }
      } else {
        setIsDrawing(true);
        lastDrawCoord.current = { x, y };
        const newGrid = cloneGrid(grid);
        if (applyPaint(x, y, newGrid)) {
          setGrid(newGrid);
        }
      }
    }
  };

  const handleMouseEnter = (x: number, y: number) => {
    setHoverCoord({ x, y });
    if (isDrawing && !isPanning) {
      if (activeTool === ToolType.PEN || activeTool === ToolType.ERASER) {
        if (lastDrawCoord.current) {
          const newGrid = paintLine(lastDrawCoord.current.x, lastDrawCoord.current.y, x, y, grid);
          if (newGrid) setGrid(newGrid);
        } else {
          const newGrid = cloneGrid(grid);
          if (applyPaint(x, y, newGrid)) {
            setGrid(newGrid);
          }
        }
        lastDrawCoord.current = { x, y };
      } else if (activeTool === ToolType.MIRROR) {
        if (lastDrawCoord.current) {
          const p0 = lastDrawCoord.current;
          const p1 = { x, y };
          const p0Sym = getSymmetricPoints(p0.x, p0.y);
          const p1Sym = getSymmetricPoints(p1.x, p1.y);

          let nextGrid = cloneGrid(grid);
          let changed = false;
          const minLen = Math.min(p0Sym.length, p1Sym.length);
          for (let i = 0; i < minLen; i++) {
            const g = paintLine(p0Sym[i].x, p0Sym[i].y, p1Sym[i].x, p1Sym[i].y, nextGrid);
            if (g) {
              nextGrid = g;
              changed = true;
            }
          }
          if (changed) setGrid(nextGrid);
        } else {
          const newGrid = cloneGrid(grid);
          let changed = false;
          const pts = getSymmetricPoints(x, y);
          for (const pt of pts) {
            if (applyPaint(pt.x, pt.y, newGrid)) {
              changed = true;
            }
          }
          if (changed) setGrid(newGrid);
        }
        lastDrawCoord.current = { x, y };
      } else if (activeTool === ToolType.RULER && rulerStart) {
        setRulerEnd({ x, y });
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const sensitivity = 0.001;
      const delta = -e.deltaY * sensitivity;
      setTransform(prev => {
        const newScale = Math.min(Math.max(0.1, prev.scale + delta), 20);
        return { ...prev, scale: newScale };
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingAxis) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          if (isDraggingAxis === 'x') {
            const scaleX = canvas.width / rect.width;
            const rawX = (e.clientX - rect.left) * scaleX;
            const clampedX = Math.max(0.5, Math.min(width - 0.5, Math.round(rawX * 2) / 2));
            setSymmetryAxisX(clampedX);
          } else if (isDraggingAxis === 'y') {
            const scaleY = canvas.height / rect.height;
            const rawY = (e.clientY - rect.top) * scaleY;
            const clampedY = Math.max(0.5, Math.min(height - 0.5, Math.round(rawY * 2) / 2));
            setSymmetryAxisY(clampedY);
          }
        }
        return;
      }

      if (isPanning) {
        e.preventDefault();
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setTransform(prev => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy
        }));
        panStart.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      if (isDraggingAxis) {
        setIsDraggingAxis(null);
      }
      if (isDrawing) {
        if (activeTool === ToolType.GRADIENT && gradientStart && hoverCoord && gradientMask) {
          applyGradient(gradientStart, hoverCoord, gradientMask);
        } else if (activeTool === ToolType.LINE && lineStart && hoverCoord) {
          const points = getLinePixels(lineStart.x, lineStart.y, hoverCoord.x, hoverCoord.y, brushSize);
          const newGrid = cloneGrid(grid);
          let changed = false;
          for (const pt of points) {
            if (newGrid[pt.y][pt.x] !== activeColor) {
              newGrid[pt.y][pt.x] = activeColor;
              changed = true;
            }
          }
          if (changed) setGrid(newGrid);
        } else if (activeTool === ToolType.RULER && rulerStart && hoverCoord) {
          setRulerEnd(hoverCoord);
        }
      }
      setGradientStart(null);
      setGradientMask(null);
      setLineStart(null);
      setIsDrawing(false);
      setIsPanning(false);
      lastDrawCoord.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, isDrawing, isDraggingAxis, activeTool, gradientStart, lineStart, rulerStart, hoverCoord, grid, activeColor, gradientMask, gradientColors, brushSize, width, height]);

  // Active line preview pixels (for Line Tool)
  const linePreviewPoints = useMemo(() => {
    if (activeTool === ToolType.LINE && isDrawing && lineStart && hoverCoord) {
      return getLinePixels(lineStart.x, lineStart.y, hoverCoord.x, hoverCoord.y, brushSize);
    }
    return [];
  }, [activeTool, isDrawing, lineStart, hoverCoord, brushSize, width, height]);

  // Measurements calculation for Ruler Tool (displayed whenever ruler points are set)
  const rulerMetrics = useMemo(() => {
    if (!rulerStart || !rulerEnd) return null;
    const dx = rulerEnd.x - rulerStart.x;
    const dy = rulerEnd.y - rulerStart.y;
    const distEuclid = Math.hypot(dx, dy);
    const distManhattan = Math.abs(dx) + Math.abs(dy);
    
    // Angle in degrees: 0° is Right (+X), 90° is Up (-Y in screen coords), 180° is Left, 270° is Down
    let angleRad = Math.atan2(-dy, dx);
    let angleDeg = (angleRad * 180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    const widthBox = Math.abs(dx) + 1;
    const heightBox = Math.abs(dy) + 1;
    const boxArea = widthBox * heightBox;
    const minX = Math.min(rulerStart.x, rulerEnd.x);
    const minY = Math.min(rulerStart.y, rulerEnd.y);

    return {
      dx,
      dy,
      distEuclid: distEuclid.toFixed(2),
      distManhattan,
      angleDeg: angleDeg.toFixed(1),
      widthBox,
      heightBox,
      boxArea,
      minX,
      minY,
      startX: rulerStart.x,
      startY: rulerStart.y,
      endX: rulerEnd.x,
      endY: rulerEnd.y
    };
  }, [rulerStart, rulerEnd]);

  // Calculate optimal pixel size to fit exactly inside container with padding
  const padding = 20;
  const availW = Math.max(30, containerSize.w - padding);
  const availH = Math.max(30, containerSize.h - padding);
  const fitScale = Math.min(availW / width, availH / height);
  const targetW = Math.max(16, Math.floor(width * fitScale));
  const targetH = Math.max(16, Math.floor(height * fitScale));

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full min-h-0 min-w-0 flex items-center justify-center p-2 bg-slate-900/90 shadow-2xl rounded-2xl select-none overflow-hidden ring-1 ring-white/10 ${isSpacePressed || isPanning ? 'cursor-grab active:cursor-grabbing' : 'canvas-cursor'}`}
      style={{ touchAction: 'none' }} 
      onMouseDown={(e) => {
        if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
          e.preventDefault();
          setIsPanning(true);
          panStart.current = { x: e.clientX, y: e.clientY };
        }
      }}
    >
      <div 
        className="w-full h-full flex items-center justify-center origin-center transition-transform duration-75 ease-out will-change-transform pointer-events-none"
        style={{ 
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
        }}
      >
        <div 
          className="relative shadow-2xl rounded-sm overflow-hidden pointer-events-auto"
          style={{
            width: `${targetW}px`,
            height: `${targetH}px`,
          }}
        >
          {/* Checkerboard Background - Perfectly aligned with grid */}
          <div 
            className={`absolute inset-0 pointer-events-none z-0 transition-opacity duration-300 ${showGrid ? 'opacity-30' : 'opacity-0'}`}
            style={{
              backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyJyBoZWlnaHQ9JzInIHZpZXdCb3g9JzAgMCAyIDInPjxyZWN0IHdpZHRoPScyJyBoZWlnaHQ9JzInIGZpbGw9JyMwZjE3MmEnLz48cmVjdCB3aWR0aD0nMScgaGVpZ2h0PScxJyBmaWxsPScjMWUyOTNiJy8+PHJlY3QgeD0nMScgeT0nMScgd2lkdGg9JzEnIGhlaWdodD0nMScgZmlsbD0nIzFlMjkzYicvPjwvc3ZnPg==")`,
              backgroundSize: `calc(100% / ${width} * 2) calc(100% / ${height} * 2)`,
              imageRendering: 'pixelated'
            }}
          />

          {/* Onion Skin Layer */}
          <canvas
            ref={onionCanvasRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-[5] w-full h-full"
            style={{
              imageRendering: 'pixelated',
            }}
          />

          {/* Main Drawing Canvas */}
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="relative z-10 w-full h-full"
            style={{
              imageRendering: 'pixelated',
            }}
            onMouseLeave={() => setHoverCoord(null)}
            onMouseDown={(e) => {
              e.stopPropagation();
              const coords = getGridCoords(e);
              if (coords) {
                handleMouseDown(coords.x, coords.y, e);
              }
            }}
            onMouseMove={(e) => {
              const coords = getGridCoords(e);
              if (coords) {
                if (!hoverCoord || hoverCoord.x !== coords.x || hoverCoord.y !== coords.y) {
                  handleMouseEnter(coords.x, coords.y);
                }
              } else {
                setHoverCoord(null);
              }
            }}
          />

          {/* Grid Overlay */}
          {showGrid && (
            <div 
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
                `,
                backgroundSize: `calc(100% / ${width}) calc(100% / ${height})`
              }}
            />
          )}

          {/* Standard Hover Indicator */}
          {hoverCoord && !isPanning && activeTool !== ToolType.GRADIENT && activeTool !== ToolType.LINE && activeTool !== ToolType.RULER && activeTool !== ToolType.MIRROR && (
            <div 
              className={`absolute border-2 ${activeTool === ToolType.ERASER ? 'border-red-500 bg-red-500/20' : 'border-white bg-white/20'} pointer-events-none z-30`}
              style={{
                left: `${(hoverCoord.x - Math.floor(brushSize / 2)) * (100 / width)}%`,
                top: `${(hoverCoord.y - Math.floor(brushSize / 2)) * (100 / height)}%`,
                width: `${brushSize * (100 / width)}%`,
                height: `${brushSize * (100 / height)}%`,
              }}
            />
          )}

          {/* Mirror / Symmetry Hover Indicators */}
          {hoverCoord && !isPanning && activeTool === ToolType.MIRROR && (
            <div className="absolute inset-0 pointer-events-none z-30">
              {getSymmetricPoints(hoverCoord.x, hoverCoord.y).map((pt, idx) => (
                <div 
                  key={`sym-cur-${idx}-${pt.x}-${pt.y}`}
                  className={`absolute border-2 transition-transform duration-75 ${
                    idx === 0 
                      ? 'border-cyan-400 bg-cyan-400/20 shadow-[0_0_8px_rgba(6,182,212,0.8)]' 
                      : 'border-fuchsia-400 bg-fuchsia-400/20 border-dashed shadow-[0_0_8px_rgba(217,70,239,0.8)]'
                  }`}
                  style={{
                    left: `${(pt.x - Math.floor(brushSize / 2)) * (100 / width)}%`,
                    top: `${(pt.y - Math.floor(brushSize / 2)) * (100 / height)}%`,
                    width: `${brushSize * (100 / width)}%`,
                    height: `${brushSize * (100 / height)}%`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Line Tool Hover & Drag Preview */}
          {activeTool === ToolType.LINE && (
            <>
              {hoverCoord && !isDrawing && !isPanning && (
                <div 
                  className="absolute border-2 border-indigo-400 bg-indigo-500/30 pointer-events-none z-30"
                  style={{
                    left: `${(hoverCoord.x - Math.floor(brushSize / 2)) * (100 / width)}%`,
                    top: `${(hoverCoord.y - Math.floor(brushSize / 2)) * (100 / height)}%`,
                    width: `${brushSize * (100 / width)}%`,
                    height: `${brushSize * (100 / height)}%`,
                  }}
                />
              )}

              {/* Line Drag Pixels Preview */}
              {isDrawing && linePreviewPoints.length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  {linePreviewPoints.map((pt) => (
                    <div 
                      key={`${pt.x}-${pt.y}`}
                      className="absolute border border-white/40 shadow-sm transition-opacity"
                      style={{
                        left: `${pt.x * (100 / width)}%`,
                        top: `${pt.y * (100 / height)}%`,
                        width: `${100 / width}%`,
                        height: `${100 / height}%`,
                        backgroundColor: activeColor,
                      }}
                    />
                  ))}
                  {/* Subtle vector guide line */}
                  {lineStart && hoverCoord && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-40" style={{ overflow: 'visible' }}>
                      <line 
                        x1={`${(lineStart.x + 0.5) * (100 / width)}%`} 
                        y1={`${(lineStart.y + 0.5) * (100 / height)}%`} 
                        x2={`${(hoverCoord.x + 0.5) * (100 / width)}%`} 
                        y2={`${(hoverCoord.y + 0.5) * (100 / height)}%`} 
                        stroke="rgba(255,255,255,0.7)" 
                        strokeWidth="1.5" 
                        strokeDasharray="3 3"
                      />
                    </svg>
                  )}
                </div>
              )}
            </>
          )}

          {/* Ruler Hover Crosshair when idle in Ruler Tool */}
          {activeTool === ToolType.RULER && hoverCoord && !rulerStart && !isPanning && (
            <div 
              className="absolute border-2 border-cyan-400 bg-cyan-500/20 pointer-events-none z-30 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.6)]"
              style={{
                left: `${hoverCoord.x * (100 / width)}%`,
                top: `${hoverCoord.y * (100 / height)}%`,
                width: `${100 / width}%`,
                height: `${100 / height}%`,
              }}
            />
          )}

          {/* Persistent Ruler Visuals Overlay on Canvas (Visible even while painting with pen/brush) */}
          {rulerMetrics && (
            <div className={`absolute inset-0 pointer-events-none z-40 transition-opacity duration-200 ${activeTool === ToolType.RULER ? 'opacity-100' : 'opacity-85'}`}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                {/* Bounding box outline */}
                <rect 
                  x={`${rulerMetrics.minX * (100 / width)}%`}
                  y={`${rulerMetrics.minY * (100 / height)}%`}
                  width={`${rulerMetrics.widthBox * (100 / width)}%`}
                  height={`${rulerMetrics.heightBox * (100 / height)}%`}
                  fill="rgba(6, 182, 212, 0.08)"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Vector Distance Line */}
                <line 
                  x1={`${(rulerMetrics.startX + 0.5) * (100 / width)}%`} 
                  y1={`${(rulerMetrics.startY + 0.5) * (100 / height)}%`} 
                  x2={`${(rulerMetrics.endX + 0.5) * (100 / width)}%`} 
                  y2={`${(rulerMetrics.endY + 0.5) * (100 / height)}%`} 
                  stroke="#38bdf8" 
                  strokeWidth="2.5" 
                  className="drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                />

                {/* Start Marker */}
                <circle 
                  cx={`${(rulerMetrics.startX + 0.5) * (100 / width)}%`} 
                  cy={`${(rulerMetrics.startY + 0.5) * (100 / height)}%`} 
                  r="5" 
                  fill="#38bdf8" 
                  stroke="#0f172a" 
                  strokeWidth="2"
                  className="drop-shadow-md"
                />

                {/* End Marker */}
                <circle 
                  cx={`${(rulerMetrics.endX + 0.5) * (100 / width)}%`} 
                  cy={`${(rulerMetrics.endY + 0.5) * (100 / height)}%`} 
                  r="5.5" 
                  fill="#f43f5e" 
                  stroke="#ffffff" 
                  strokeWidth="2"
                  className="drop-shadow-md"
                />
              </svg>
            </div>
          )}

          {/* Gradient Mask Highlight */}
          {gradientMask && isDrawing && activeTool === ToolType.GRADIENT && (
            <canvas
              className="absolute inset-0 w-full h-full pointer-events-none z-30 opacity-30 animate-pulse"
              style={{ imageRendering: 'pixelated' }}
              ref={(node) => {
                if (node) {
                  node.width = width;
                  node.height = height;
                  const ctx = node.getContext('2d');
                  if (ctx) {
                    ctx.fillStyle = 'white';
                    for (let y = 0; y < height; y++) {
                      for (let x = 0; x < width; x++) {
                        if (gradientMask[y][x]) {
                          ctx.fillRect(x, y, 1, 1);
                        }
                      }
                    }
                  }
                }
              }}
            />
          )}
          
          {/* Gradient Preview */}
          {gradientStart && hoverCoord && activeTool === ToolType.GRADIENT && isDrawing && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-40" style={{ overflow: 'visible' }}>
              <line 
                x1={`${(gradientStart.x + 0.5) * (100 / width)}%`} 
                y1={`${(gradientStart.y + 0.5) * (100 / height)}%`} 
                x2={`${(hoverCoord.x + 0.5) * (100 / width)}%`} 
                y2={`${(hoverCoord.y + 0.5) * (100 / height)}%`} 
                stroke="white" 
                strokeWidth="2" 
                strokeDasharray="4 4"
                className="drop-shadow-md"
              />
              <circle 
                cx={`${(gradientStart.x + 0.5) * (100 / width)}%`} 
                cy={`${(gradientStart.y + 0.5) * (100 / height)}%`} 
                r="4" fill="white" 
              />
              <circle 
                cx={`${(hoverCoord.x + 0.5) * (100 / width)}%`} 
                cy={`${(hoverCoord.y + 0.5) * (100 / height)}%`} 
                r="4" fill="transparent" stroke="white" strokeWidth="2"
              />
            </svg>
          )}
          {/* Symmetry Axes Overlay & Draggable Handles on Canvas */}
          {activeTool === ToolType.MIRROR && (
            <div className="absolute inset-0 pointer-events-none z-35" style={{ overflow: 'visible' }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                {/* Vertical Axis Line */}
                {(symmetryAxis === 'vertical' || symmetryAxis === 'dual') && (
                  <line
                    x1={`${(symmetryAxisX / width) * 100}%`}
                    y1="0%"
                    x2={`${(symmetryAxisX / width) * 100}%`}
                    y2="100%"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    className="drop-shadow-[0_0_6px_rgba(6,182,212,0.9)]"
                  />
                )}

                {/* Horizontal Axis Line */}
                {(symmetryAxis === 'horizontal' || symmetryAxis === 'dual') && (
                  <line
                    x1="0%"
                    y1={`${(symmetryAxisY / height) * 100}%`}
                    x2="100%"
                    y2={`${(symmetryAxisY / height) * 100}%`}
                    stroke="#d946ef"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    className="drop-shadow-[0_0_6px_rgba(217,70,239,0.9)]"
                  />
                )}
              </svg>

              {/* Vertical Drag Handle (Top and Bottom) */}
              {(symmetryAxis === 'vertical' || symmetryAxis === 'dual') && (
                <>
                  <div
                    className="absolute -top-3.5 -translate-x-1/2 z-40 bg-slate-900 border border-cyan-400 text-cyan-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)] flex items-center gap-1 cursor-ew-resize hover:bg-cyan-500 hover:text-white transition-colors pointer-events-auto select-none"
                    style={{ left: `${(symmetryAxisX / width) * 100}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingAxis('x');
                    }}
                    title="Тяните для перемещения оси X"
                  >
                    <ArrowLeftRight size={10} />
                    <span>X:{symmetryAxisX}</span>
                  </div>
                  <div
                    className="absolute -bottom-3.5 -translate-x-1/2 z-40 bg-slate-900 border border-cyan-400 text-cyan-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)] flex items-center gap-1 cursor-ew-resize hover:bg-cyan-500 hover:text-white transition-colors pointer-events-auto select-none"
                    style={{ left: `${(symmetryAxisX / width) * 100}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingAxis('x');
                    }}
                    title="Тяните для перемещения оси X"
                  >
                    <ArrowLeftRight size={10} />
                    <span>X:{symmetryAxisX}</span>
                  </div>
                </>
              )}

              {/* Horizontal Drag Handle (Left and Right) */}
              {(symmetryAxis === 'horizontal' || symmetryAxis === 'dual') && (
                <>
                  <div
                    className="absolute -left-3.5 -translate-y-1/2 z-40 bg-slate-900 border border-fuchsia-400 text-fuchsia-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(217,70,239,0.6)] flex items-center gap-1 cursor-ns-resize hover:bg-fuchsia-500 hover:text-white transition-colors pointer-events-auto select-none"
                    style={{ top: `${(symmetryAxisY / height) * 100}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingAxis('y');
                    }}
                    title="Тяните для перемещения оси Y"
                  >
                    <ArrowUpDown size={10} />
                    <span>Y:{symmetryAxisY}</span>
                  </div>
                  <div
                    className="absolute -right-3.5 -translate-y-1/2 z-40 bg-slate-900 border border-fuchsia-400 text-fuchsia-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(217,70,239,0.6)] flex items-center gap-1 cursor-ns-resize hover:bg-fuchsia-500 hover:text-white transition-colors pointer-events-auto select-none"
                    style={{ top: `${(symmetryAxisY / height) * 100}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingAxis('y');
                    }}
                    title="Тяните для перемещения оси Y"
                  >
                    <ArrowUpDown size={10} />
                    <span>Y:{symmetryAxisY}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Symmetry / Mirror HUD Overlay */}
      {activeTool === ToolType.MIRROR && (
        <div className="absolute top-3 right-3 z-50 bg-slate-950/95 backdrop-blur-md border border-fuchsia-500/50 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex flex-col gap-2.5 min-w-[260px] max-w-[310px] pointer-events-auto ring-1 ring-fuchsia-500/30 transition-all duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-fuchsia-500/20 text-fuchsia-400">
                <FlipHorizontal size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white font-mono tracking-wide">
                  {getTranslation(language, 'mirror')}
                </span>
                <span className="text-[9px] text-fuchsia-300/80 font-mono">
                  {symmetryAxis === 'vertical' ? getTranslation(language, 'symmetryVertical') : symmetryAxis === 'horizontal' ? getTranslation(language, 'symmetryHorizontal') : getTranslation(language, 'symmetryDual')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSymmetryCollapsed(!isSymmetryCollapsed)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                title={isSymmetryCollapsed ? 'Развернуть' : 'Свернуть'}
              >
                {isSymmetryCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
            </div>
          </div>

          {!isSymmetryCollapsed && (
            <>
              {/* Axis Selector Mode */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {getTranslation(language, 'symmetryAxisTitle')}
                </span>
                <div className="grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setSymmetryAxis('vertical')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      symmetryAxis === 'vertical'
                        ? 'bg-cyan-500 text-white shadow-md font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={getTranslation(language, 'symmetryVertical')}
                  >
                    <Columns2 size={13} />
                    <span>Вертикаль</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSymmetryAxis('horizontal')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      symmetryAxis === 'horizontal'
                        ? 'bg-fuchsia-500 text-white shadow-md font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={getTranslation(language, 'symmetryHorizontal')}
                  >
                    <Rows2 size={13} />
                    <span>Горизонт</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSymmetryAxis('dual')}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      symmetryAxis === 'dual'
                        ? 'bg-indigo-500 text-white shadow-md font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    title={getTranslation(language, 'symmetryDual')}
                  >
                    <Grid2x2 size={13} />
                    <span>4 стороны</span>
                  </button>
                </div>
              </div>

              {/* Axis Coordinates Controllers */}
              <div className="flex flex-col gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-white/5">
                {/* X Axis Slider & Stepper */}
                {(symmetryAxis === 'vertical' || symmetryAxis === 'dual') && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        <ArrowLeftRight size={11} /> {getTranslation(language, 'symmetryX')}
                      </span>
                      <span className="bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 font-bold">
                        {symmetryAxisX} px
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSymmetryAxisX(prev => Math.max(0.5, prev - 0.5))}
                        className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-mono cursor-pointer border border-white/10"
                      >
                        -
                      </button>
                      <input 
                        type="range"
                        min="0.5"
                        max={width - 0.5}
                        step="0.5"
                        value={symmetryAxisX}
                        onChange={(e) => setSymmetryAxisX(parseFloat(e.target.value))}
                        className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setSymmetryAxisX(prev => Math.min(width - 0.5, prev + 0.5))}
                        className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-mono cursor-pointer border border-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Y Axis Slider & Stepper */}
                {(symmetryAxis === 'horizontal' || symmetryAxis === 'dual') && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-fuchsia-400 font-bold flex items-center gap-1">
                        <ArrowUpDown size={11} /> {getTranslation(language, 'symmetryY')}
                      </span>
                      <span className="bg-fuchsia-950/80 text-fuchsia-300 px-1.5 py-0.5 rounded border border-fuchsia-500/30 font-bold">
                        {symmetryAxisY} px
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSymmetryAxisY(prev => Math.max(0.5, prev - 0.5))}
                        className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-mono cursor-pointer border border-white/10"
                      >
                        -
                      </button>
                      <input 
                        type="range"
                        min="0.5"
                        max={height - 0.5}
                        step="0.5"
                        value={symmetryAxisY}
                        onChange={(e) => setSymmetryAxisY(parseFloat(e.target.value))}
                        className="flex-1 accent-fuchsia-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setSymmetryAxisY(prev => Math.min(height - 0.5, prev + 0.5))}
                        className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-mono cursor-pointer border border-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Center Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSymmetryAxisX(width / 2);
                    setSymmetryAxisY(height / 2);
                  }}
                  className="mt-1 w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Compass size={13} className="text-cyan-400" />
                  <span>{getTranslation(language, 'symmetryCenter')}</span>
                </button>
              </div>

              {/* Instant Canvas Flip Tools */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {getTranslation(language, 'symmetryFlipCanvas')}
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(symmetryAxis === 'vertical' || symmetryAxis === 'dual') && (
                    <>
                      <button
                        type="button"
                        onClick={flipCanvasLeftToRight}
                        className="py-1 px-2 bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-300 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title={getTranslation(language, 'symmetryFlipLeftToRight')}
                      >
                        <span>Лево ➔ Право</span>
                      </button>
                      <button
                        type="button"
                        onClick={flipCanvasRightToLeft}
                        className="py-1 px-2 bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-300 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title={getTranslation(language, 'symmetryFlipRightToLeft')}
                      >
                        <span>Право ➔ Лево</span>
                      </button>
                    </>
                  )}
                  {(symmetryAxis === 'horizontal' || symmetryAxis === 'dual') && (
                    <>
                      <button
                        type="button"
                        onClick={flipCanvasTopToBottom}
                        className="py-1 px-2 bg-slate-900/90 hover:bg-fuchsia-950 border border-fuchsia-500/30 text-fuchsia-300 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title={getTranslation(language, 'symmetryFlipTopToBottom')}
                      >
                        <span>Верх ➔ Низ</span>
                      </button>
                      <button
                        type="button"
                        onClick={flipCanvasBottomToTop}
                        className="py-1 px-2 bg-slate-900/90 hover:bg-fuchsia-950 border border-fuchsia-500/30 text-fuchsia-300 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title={getTranslation(language, 'symmetryFlipBottomToTop')}
                      >
                        <span>Низ ➔ Верх</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tip info */}
              <div className="text-[10px] text-slate-400 bg-slate-900/50 px-2 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400 shrink-0" />
                <span>{getTranslation(language, 'mirrorDragTip')}</span>
              </div>
            </>
          )}

          {isSymmetryCollapsed && (
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-cyan-300 font-bold">X: {symmetryAxisX}</span>
              {(symmetryAxis === 'horizontal' || symmetryAxis === 'dual') && (
                <span className="text-fuchsia-300 font-bold">Y: {symmetryAxisY}</span>
              )}
              <span className="text-slate-400 text-[10px]">
                {symmetryAxis === 'vertical' ? 'Вертикаль' : symmetryAxis === 'horizontal' ? 'Горизонт' : '4-way'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Enlarged Persistent Floating Ruler HUD Overlay */}
      {rulerMetrics && (
        <div className="absolute top-3 left-3 z-50 bg-slate-950/95 backdrop-blur-md border border-cyan-500/50 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex flex-col gap-2.5 min-w-[240px] max-w-[300px] pointer-events-auto ring-1 ring-cyan-500/30 transition-all duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Ruler size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white font-mono tracking-wide">
                  {getTranslation(language, 'ruler')}
                </span>
                <span className="text-[9px] text-cyan-300/80 font-mono">
                  {activeTool === ToolType.RULER ? 'Режим замера (M)' : 'Ориентир для рисования'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsRulerCollapsed(!isRulerCollapsed)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                title={isRulerCollapsed ? 'Развернуть' : 'Свернуть'}
              >
                {isRulerCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button
                type="button"
                onClick={() => { setRulerStart(null); setRulerEnd(null); }}
                className="text-slate-400 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Сбросить линейку"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isRulerCollapsed && (
            <>
              {/* Primary Large Highlight Metrics */}
              <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {getTranslation(language, 'rulerInfoDistance')}
                  </span>
                  <span className="text-lg font-black font-mono text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                    {rulerMetrics.distEuclid} <span className="text-xs font-normal text-cyan-400/80">px</span>
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {getTranslation(language, 'rulerInfoAngle')}
                  </span>
                  <span className="text-lg font-black font-mono text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.4)]">
                    {rulerMetrics.angleDeg}°
                  </span>
                </div>
              </div>

              {/* Secondary Details Grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-mono px-0.5">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">ΔX / ΔY</span>
                  <span className="font-semibold text-slate-200">
                    {rulerMetrics.dx >= 0 ? `+${rulerMetrics.dx}` : rulerMetrics.dx} / {rulerMetrics.dy >= 0 ? `+${rulerMetrics.dy}` : rulerMetrics.dy} px
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">{getTranslation(language, 'rulerInfoArea')}</span>
                  <span className="font-semibold text-slate-200">
                    {rulerMetrics.widthBox}×{rulerMetrics.heightBox} <span className="text-[10px] text-slate-400 font-normal">({rulerMetrics.boxArea} px²)</span>
                  </span>
                </div>
              </div>

              {/* Start -> End Coordinates Bar */}
              <div className="text-[11px] font-mono text-slate-300 pt-2 border-t border-white/10 flex items-center justify-between px-0.5">
                <span className="bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/5">
                  X:{rulerMetrics.startX}, Y:{rulerMetrics.startY}
                </span>
                <span className="text-cyan-400 font-bold">➔</span>
                <span className="bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/5 text-rose-300">
                  X:{rulerMetrics.endX}, Y:{rulerMetrics.endY}
                </span>
              </div>
            </>
          )}

          {isRulerCollapsed && (
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-cyan-300 font-bold">{rulerMetrics.distEuclid} px</span>
              <span className="text-fuchsia-300 font-bold">{rulerMetrics.angleDeg}°</span>
              <span className="text-slate-400 text-[10px]">{rulerMetrics.widthBox}×{rulerMetrics.heightBox}</span>
            </div>
          )}
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-50 flex gap-2">
        <button 
          className="bg-slate-800 text-slate-200 text-sm px-3 py-1.5 rounded-lg border border-slate-600 shadow-lg hover:bg-slate-700 transition-colors font-bold cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setTransform({x:0, y:0, scale:1}); }}
          title="Reset View"
        >
          {Math.round(transform.scale * 100)}%
        </button>
      </div>
    </div>
  );
};
