export interface Size2D {
  width: number;
  height: number;
}

export interface Rect2D extends Size2D {
  left: number;
  top: number;
}

function normalizeFiniteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateContainedRect(container: Size2D, media: Size2D): Rect2D {
  if (
    !Number.isFinite(container.width)
    || !Number.isFinite(container.height)
    || container.width <= 0
    || container.height <= 0
    || !Number.isFinite(media.width)
    || !Number.isFinite(media.height)
    || media.width <= 0
    || media.height <= 0
  ) {
    return {
      left: 0,
      top: 0,
      width: normalizeFiniteNonNegative(container.width),
      height: normalizeFiniteNonNegative(container.height),
    };
  }

  const containerAspect = container.width / container.height;
  const mediaAspect = media.width / media.height;

  if (mediaAspect > containerAspect) {
    const width = container.width;
    const height = width / mediaAspect;
    return {
      left: 0,
      top: (container.height - height) / 2,
      width,
      height,
    };
  }

  const height = container.height;
  const width = height * mediaAspect;
  return {
    left: (container.width - width) / 2,
    top: 0,
    width,
    height,
  };
}
