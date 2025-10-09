type DeviceKind = 'mobile' | 'tablet' | 'desktop';

type BlockFrame = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  rotationDeg?: number | null;
};

type CanvasSize = {
  width: number;
  height: number;
};

type ResolvedBlockLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

export function resolveBlockLayout(
  frame: BlockFrame,
  _device: DeviceKind,
  index: number,
  canvasSize: CanvasSize,
): ResolvedBlockLayout {
  const { width, height } = canvasSize;

  const x = (frame.xPct / 100) * width;
  const y = (frame.yPct / 100) * height;
  const w = (frame.wPct / 100) * width;
  const h = (frame.hPct / 100) * height;

  return {
    left: x,
    top: y,
    width: w,
    height: h,
    rotation: frame.rotationDeg ?? 0,
    zIndex: 100 + index,
  };
}

export type { BlockFrame, CanvasSize, DeviceKind, ResolvedBlockLayout };
