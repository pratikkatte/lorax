import { useState, useEffect, useRef, useCallback } from 'react';
import { Matrix4 } from '@math.gl/core';

/**
 * Easing functions for smooth animations
 */
const easingFunctions = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

/**
 * Linear interpolation helper
 */
function lerp(start, end, t) {
  return start + (end - start) * t;
}

// ─────────────────────────────────────────────────────────────────
// Matrix4 Object Pool - Avoids allocation per animation frame
// ─────────────────────────────────────────────────────────────────
const matrixPool = [];
const MAX_POOL_SIZE = 100; // Prevent unbounded pool growth

/**
 * Get a Matrix4 from the pool or create a new one
 */
function acquireMatrix() {
  if (matrixPool.length > 0) {
    return matrixPool.pop();
  }
  return new Matrix4();
}

/**
 * Return a Matrix4 to the pool for reuse
 */
function releaseMatrix(matrix) {
  if (matrix && matrixPool.length < MAX_POOL_SIZE) {
    matrix.identity(); // Reset for next use
    matrixPool.push(matrix);
  }
}

/**
 * useAnimatedBins Hook
 * 
 * Provides smooth animated transitions when tree positions change.
 * Interpolates between old and new modelMatrix values over a configurable duration.
 * 
 * @param {Map} rawBins - The raw bins from useRegions with target transforms
 * @param {Object} options - Animation configuration
 * @param {number} options.transitionDuration - Duration in ms (default: 300)
 * @param {string} options.easing - Easing function name: 'linear', 'easeOut', 'easeInOut' (default: 'easeOut')
 * @returns {Map} Animated bins with interpolated modelMatrix values
 */
const useAnimatedBins = (rawBins, options = {}) => {
  const {
    transitionDuration = 300,
    easing = 'easeOut'
  } = options;

  const easingFn = easingFunctions[easing] || easingFunctions.easeOut;

  // State for the animated bins that will be rendered
  const [animatedBins, setAnimatedBins] = useState(rawBins);

  // Track animation state per tree: { currentTranslate, currentScale, targetTranslate, targetScale, startTime }
  const animationStateRef = useRef(new Map());

  // Track if animation loop is running
  const isAnimatingRef = useRef(false);
  const animationFrameRef = useRef(null);

  // Preallocate a reusable Matrix4 for building animated matrices
  const tempMatrix = useRef(new Matrix4());

  // Track used matrices per animation cycle (for pool management)
  const usedMatricesRef = useRef(new Map());

  /**
   * Animation loop using requestAnimationFrame
   * OPTIMIZED: Uses matrix pool and reuses Map to reduce allocations
   */
  const animate = useCallback(() => {
    const now = performance.now();
    const animState = animationStateRef.current;
    let hasActiveAnimations = false;

    // Reuse Map - clear it instead of creating new one
    const newAnimatedBins = new Map();

    // Release matrices from previous frame back to pool
    for (const matrix of usedMatricesRef.current.values()) {
      releaseMatrix(matrix);
    }
    usedMatricesRef.current.clear();

    for (const [key, bin] of rawBins.entries()) {
      if (!bin || !bin.modelMatrix || !bin.visible) {
        // Pass through non-visible bins as-is
        newAnimatedBins.set(key, bin);
        continue;
      }

      const state = animState.get(key);

      if (!state) {
        // No animation state - use raw values
        newAnimatedBins.set(key, bin);
        continue;
      }

      const elapsed = now - state.startTime;
      const progress = Math.min(1, elapsed / transitionDuration);
      const easedProgress = easingFn(progress);

      if (progress >= 1) {
        // Animation complete - use target values and clean up
        newAnimatedBins.set(key, bin);
        animState.delete(key);
      } else {
        // Interpolate between current and target
        hasActiveAnimations = true;

        const interpolatedTranslate = lerp(state.startTranslate, state.targetTranslate, easedProgress);
        const interpolatedScale = lerp(state.startScale, state.targetScale, easedProgress);

        // Get matrix from pool instead of cloning
        const animatedMatrix = acquireMatrix()
          .translate([interpolatedTranslate, 0, 0])
          .scale([interpolatedScale, 1, 1]);

        // Track for release next frame
        usedMatricesRef.current.set(key, animatedMatrix);

        newAnimatedBins.set(key, {
          ...bin,
          modelMatrix: animatedMatrix
        });
      }
    }

    setAnimatedBins(newAnimatedBins);

    if (hasActiveAnimations) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      isAnimatingRef.current = false;
      // Release all matrices when animation ends
      for (const matrix of usedMatricesRef.current.values()) {
        releaseMatrix(matrix);
      }
      usedMatricesRef.current.clear();
    }
  }, [rawBins, transitionDuration, easingFn]);

  /**
   * Start animation loop if not already running
   */
  const startAnimationLoop = useCallback(() => {
    if (!isAnimatingRef.current) {
      isAnimatingRef.current = true;
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  /**
   * When rawBins change, detect position changes and setup animations
   */
  useEffect(() => {
    if (!rawBins || rawBins.size === 0) {
      setAnimatedBins(rawBins);
      return;
    }

    const now = performance.now();
    const animState = animationStateRef.current;
    let needsAnimation = false;

    for (const [key, bin] of rawBins.entries()) {
      if (!bin || !bin.modelMatrix || !bin.visible) {
        // Clean up animation state for non-visible trees
        animState.delete(key);
        continue;
      }

      const targetTranslate = bin.modelMatrix[12];
      const targetScale = bin.modelMatrix[0];

      const existingState = animState.get(key);

      // Check if this tree was already being animated or has previous position
      if (existingState) {
        // Tree is mid-animation - calculate current interpolated position
        const elapsed = now - existingState.startTime;
        const progress = Math.min(1, elapsed / transitionDuration);
        const easedProgress = easingFn(progress);

        const currentTranslate = lerp(existingState.startTranslate, existingState.targetTranslate, easedProgress);
        const currentScale = lerp(existingState.startScale, existingState.targetScale, easedProgress);

        // Check if target has changed
        const translateChanged = Math.abs(targetTranslate - existingState.targetTranslate) > 0.001;
        const scaleChanged = Math.abs(targetScale - existingState.targetScale) > 0.001;

        if (translateChanged || scaleChanged) {
          // New target - animate from current interpolated position to new target
          animState.set(key, {
            startTranslate: currentTranslate,
            startScale: currentScale,
            targetTranslate,
            targetScale,
            startTime: now
          });
          needsAnimation = true;
        } else if (progress < 1) {
          // Still animating to same target
          needsAnimation = true;
        }
      } else {
        // Check if we have a previous rendered position from animatedBins
        const prevBin = animatedBins?.get?.(key);
        
        if (prevBin && prevBin.modelMatrix && prevBin.visible) {
          const prevTranslate = prevBin.modelMatrix[12];
          const prevScale = prevBin.modelMatrix[0];

          const translateChanged = Math.abs(targetTranslate - prevTranslate) > 0.001;
          const scaleChanged = Math.abs(targetScale - prevScale) > 0.001;

          if (translateChanged || scaleChanged) {
            // Position changed - start animation from previous to new
            animState.set(key, {
              startTranslate: prevTranslate,
              startScale: prevScale,
              targetTranslate,
              targetScale,
              startTime: now
            });
            needsAnimation = true;
          }
        }
        // If no previous position, tree will appear at target position immediately (no animation for new trees)
      }
    }

    // Clean up animation state for trees that are no longer in rawBins
    for (const key of animState.keys()) {
      if (!rawBins.has(key)) {
        animState.delete(key);
      }
    }

    if (needsAnimation) {
      startAnimationLoop();
    } else {
      // No animations needed - just use raw bins
      setAnimatedBins(rawBins);
    }
  }, [rawBins, transitionDuration, easingFn, startAnimationLoop]);

  /**
   * Cleanup animation frame on unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return animatedBins;
};

export default useAnimatedBins;

