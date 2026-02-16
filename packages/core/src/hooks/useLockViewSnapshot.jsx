import { useCallback, useEffect, useRef, useState } from 'react';
import { buildLockViewSnapshot } from '../utils/lockViewSnapshot.js';

export const LOCK_SNAPSHOT_DEBUG_LABEL_BY_CORNER = {
  topLeft: { dx: 8, dy: 16, textAnchor: 'start' },
  topRight: { dx: -8, dy: 16, textAnchor: 'end' },
  bottomRight: { dx: -8, dy: -8, textAnchor: 'end' },
  bottomLeft: { dx: 8, dy: -8, textAnchor: 'start' }
};

export function formatLockSnapshotDebugCoordinate(value) {
  if (!Number.isFinite(value)) return 'null';
  return Number(value).toFixed(4);
}

function normalizeTargetLocalBBox(targetLocalBBox) {
  if (!targetLocalBBox || typeof targetLocalBBox !== 'object') return null;
  const treeIndex = Number(targetLocalBBox.treeIndex);
  const minX = Number(targetLocalBBox.minX);
  const maxX = Number(targetLocalBBox.maxX);
  const minY = Number(targetLocalBBox.minY);
  const maxY = Number(targetLocalBBox.maxY);
  if (
    !Number.isFinite(treeIndex)
    || !Number.isFinite(minX)
    || !Number.isFinite(maxX)
    || !Number.isFinite(minY)
    || !Number.isFinite(maxY)
  ) {
    return null;
  }
  return {
    treeIndex,
    minX,
    maxX,
    minY,
    maxY
  };
}

function normalizeLockViewPayload(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const targetLocalBBox = normalizeTargetLocalBBox(snapshot.targetLocalBBox);
  return {
    targetIndex: targetLocalBBox ? targetLocalBBox.treeIndex : null,
    targetLocalBBox
  };
}

function buildOutgoingLockPayload(snapshot) {
  if (!snapshot) return null;
  if (!snapshot.targetLocalBBox) return null;
  return {
    targetIndex: snapshot.targetIndex,
    targetLocalBBox: snapshot.targetLocalBBox
  };
}

function buildDebugOverlay(snapshot, orthoViewport) {
  if (!snapshot || !orthoViewport) return null;

  const width = Number(orthoViewport.width);
  const height = Number(orthoViewport.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const x = Number(orthoViewport.x);
  const y = Number(orthoViewport.y);
  const viewportX = Number.isFinite(x) ? x : 0;
  const viewportY = Number.isFinite(y) ? y : 0;

  const cornerPixels = {
    topLeft: [viewportX, viewportY],
    topRight: [viewportX + width, viewportY],
    bottomRight: [viewportX + width, viewportY + height],
    bottomLeft: [viewportX, viewportY + height]
  };

  const corners = Array.isArray(snapshot.corners)
    ? snapshot.corners.map((corner) => {
      const [px, py] = cornerPixels[corner.corner] || [viewportX, viewportY];
      return { ...corner, px, py };
    })
    : [];

  return {
    x: viewportX,
    y: viewportY,
    width,
    height,
    corners,
    boundingBox: snapshot.boundingBox
  };
}

export function useLockViewSnapshot({
  deckRef,
  localBins,
  lockModelMatrix = false,
  debug = false
}) {
  const snapshotRafRef = useRef(null);
  const pendingSnapshotRef = useRef(false);
  const prevLockModelMatrixRef = useRef(lockModelMatrix);

  const [lockViewPayload, setLockViewPayload] = useState(null);
  const [lockSnapshotDebugOverlay, setLockSnapshotDebugOverlay] = useState(null);

  const clearScheduledCapture = useCallback(() => {
    if (snapshotRafRef.current == null) return;
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(snapshotRafRef.current);
    }
    snapshotRafRef.current = null;
  }, []);

  const captureLockViewSnapshot = useCallback(() => {
    if (!lockModelMatrix) return false;

    const deck = deckRef.current?.deck;
    const viewports = deck?.getViewports?.();
    if (!Array.isArray(viewports)) return false;

    const orthoViewport = viewports.find((vp) => vp?.id === 'ortho') || null;
    const snapshot = buildLockViewSnapshot({ orthoViewport, localBins });
    if (!snapshot) return false;

    const normalizedSnapshot = normalizeLockViewPayload(snapshot);
    if (!normalizedSnapshot) return false;

    setLockViewPayload(buildOutgoingLockPayload(normalizedSnapshot));
    setLockSnapshotDebugOverlay(
      debug ? buildDebugOverlay(snapshot, orthoViewport) : null
    );
    return true;
  }, [deckRef, localBins, lockModelMatrix, debug]);

  const runScheduledCapture = useCallback(() => {
    snapshotRafRef.current = null;
    const captured = captureLockViewSnapshot();
    pendingSnapshotRef.current = !captured;
  }, [captureLockViewSnapshot]);

  const scheduleCapture = useCallback(() => {
    if (!lockModelMatrix) return;

    pendingSnapshotRef.current = true;
    if (snapshotRafRef.current != null) return;

    if (typeof requestAnimationFrame === 'function') {
      snapshotRafRef.current = requestAnimationFrame(runScheduledCapture);
    } else {
      runScheduledCapture();
    }
  }, [lockModelMatrix, runScheduledCapture]);

  const flushPendingCapture = useCallback(() => {
    if (!lockModelMatrix) return;
    if (!pendingSnapshotRef.current) return;
    if (snapshotRafRef.current != null) return;
    const captured = captureLockViewSnapshot();
    pendingSnapshotRef.current = !captured;
  }, [lockModelMatrix, captureLockViewSnapshot]);

  useEffect(() => {
    if (!debug) {
      setLockSnapshotDebugOverlay(null);
    }
  }, [debug]);

  useEffect(() => {
    const prevLocked = prevLockModelMatrixRef.current;
    prevLockModelMatrixRef.current = lockModelMatrix;

    if (!prevLocked && lockModelMatrix) {
      pendingSnapshotRef.current = true;
      const captured = captureLockViewSnapshot();
      pendingSnapshotRef.current = !captured;
      if (!captured) {
        scheduleCapture();
      }
      return;
    }

    if (prevLocked && !lockModelMatrix) {
      pendingSnapshotRef.current = false;
      clearScheduledCapture();
      setLockSnapshotDebugOverlay(null);
      setLockViewPayload(null);
    }
  }, [lockModelMatrix, captureLockViewSnapshot, scheduleCapture, clearScheduledCapture]);

  useEffect(() => () => {
    pendingSnapshotRef.current = false;
    clearScheduledCapture();
  }, [clearScheduledCapture]);

  console.log('[useLockViewSnapshot] lockViewPayload:', lockViewPayload);
  return {
    lockViewPayload,
    lockSnapshotDebugOverlay,
    scheduleCapture,
    flushPendingCapture
  };
}

export default useLockViewSnapshot;
