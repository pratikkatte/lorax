export const INITIAL_VIEW_STATE = {
  'genome-positions': {
    target: [0, 1],
    zoom: [5, 8],
    // minZoom: 1,
  },
  'genome-info': {
    target: [0, 1],
    zoom: [5, 8],
    // minZoom: 1,
  },
  'tree-time': {
    target: [0.5, 0],
    zoom: [0, 8],
    // minZoom: 1,
  },
  'ortho': {
    target: [0, 0],
    zoom: [5, 8],
    // minZoom: 1,
  }
}

export function getPanStep({ zoomX, baseStep = 8, sensitivity = 0.5 }) {

  if (zoomX < 0) {
    // 2. Increase baseStep by the magnitude of the negative zoomX
    // e.g., if zoomX is -4, the multiplier is 4+1 = 5
    baseStep = baseStep * (Math.abs(zoomX) / 2 + 1);
  }

  return baseStep / Math.pow(2, zoomX * sensitivity);
}

export function panLimit(target, oldTarget, genomeLength, globalBpPerUnit) {
  if (target[0] < 0) {
    return oldTarget;
  }
  if (target[0] > genomeLength / globalBpPerUnit) {
    return oldTarget;
  }
  return target;
}
