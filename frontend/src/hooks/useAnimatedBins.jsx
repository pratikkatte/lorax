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
  
  // Track previous positions only (not full bin objects) to avoid keeping bin.path references alive
  // Store only translate/scale values needed for animation comparison
  const prevPositionsRef = useRef(new Map()); // Map<key, {translate, scale}>

  /**
   * Animation loop using requestAnimationFrame
   */
  const animate = useCallback(() => {
    const now = performance.now();
    const animState = animationStateRef.current;
    let hasActiveAnimations = false;

    // Create new bins map with interpolated values
    const newAnimatedBins = new Map();

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

        // Build new modelMatrix with interpolated values
        const animatedMatrix = tempMatrix.current.identity()
          .translate([interpolatedTranslate, 0, 0])
          .scale([interpolatedScale, 1, 1]);

        newAnimatedBins.set(key, {
          ...bin,
          modelMatrix: animatedMatrix.clone()
        });
      }
    }

    // Update state and store positions (not full bins) to avoid keeping bin.path references alive
    setAnimatedBins(newAnimatedBins);
    // Update prevPositionsRef with current positions from newAnimatedBins
    for (const [key, bin] of newAnimatedBins.entries()) {
      if (bin?.modelMatrix) {
        prevPositionsRef.current.set(key, {
          translate: bin.modelMatrix[12],
          scale: bin.modelMatrix[0]
        });
      }
    }
    // Clean up positions for bins that no longer exist
    for (const key of prevPositionsRef.current.keys()) {
      if (!newAnimatedBins.has(key)) {
        prevPositionsRef.current.delete(key);
      }
    }

    if (hasActiveAnimations) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      isAnimatingRef.current = false;
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
      prevPositionsRef.current.clear();
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
        // Use ref to get previous rendered position (avoids stale closure issue)
        const prevPos = prevPositionsRef.current.get(key);
        
        if (prevPos) {
          const translateChanged = Math.abs(targetTranslate - prevPos.translate) > 0.001;
          const scaleChanged = Math.abs(targetScale - prevPos.scale) > 0.001;

          if (translateChanged || scaleChanged) {
            // Position changed - start animation from previous to new
            animState.set(key, {
              startTranslate: prevPos.translate,
              startScale: prevPos.scale,
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
    let binsRemoved = false;
    for (const key of animState.keys()) {
      if (!rawBins.has(key)) {
        animState.delete(key);
        binsRemoved = true;
      }
    }
    
    // Also check if prevPositionsRef has keys not in rawBins
    if (!binsRemoved) {
      for (const key of prevPositionsRef.current.keys()) {
        if (!rawBins.has(key)) {
          binsRemoved = true;
          break;
        }
      }
    }

    // CRITICAL: Always update animatedBins immediately when bins are removed to allow GC of path data
    // Don't wait for animation - removed bins must be removed from state immediately
    
    if (needsAnimation) {
      // If animating, the animate() function will create newAnimatedBins without removed bins
      // But we should also immediately update state if bins were removed to allow GC
      if (binsRemoved) {
        // Create a new Map with only bins that still exist in rawBins
        const cleanedBins = new Map();
        for (const [key, bin] of rawBins.entries()) {
          cleanedBins.set(key, bin);
        }
        setAnimatedBins(cleanedBins);
      }
      startAnimationLoop();
    } else {
      // No animations needed - immediately use raw bins (which doesn't include removed bins)
      // This ensures removed bins are immediately removed from state, allowing GC of path data
      setAnimatedBins(rawBins);
      // Update prevPositionsRef with current positions from rawBins
      for (const [key, bin] of rawBins.entries()) {
        if (bin?.modelMatrix) {
          prevPositionsRef.current.set(key, {
            translate: bin.modelMatrix[12],
            scale: bin.modelMatrix[0]
          });
        }
      }
      // Clean up positions for bins that no longer exist
      for (const key of prevPositionsRef.current.keys()) {
        if (!rawBins.has(key)) {
          prevPositionsRef.current.delete(key);
        }
      }
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


