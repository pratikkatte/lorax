import { OrthographicController } from "@deck.gl/core";

/**
 * Global controller state for deck.gl controller <-> React communication
 * 
 * Note: This pattern is necessary because deck.gl instantiates controller classes
 * internally, and they can't receive React props directly. The module-level state
 * allows the controller to call React setState functions.
 * 
 * Limitation: Only supports a single DeckGL instance. Multiple instances would
 * share these handlers. For multi-instance support, consider using a WeakMap
 * keyed by deck instance or a global event bus.
 */
let globalSetZoomAxis = () => {};
let globalPanDirection = () => {};
let isInitialized = false;

/**
 * Initialize global controllers from React component
 * Should be called once from useView hook's useEffect
 * @param {Function} setZoomAxis - React setState for zoom axis
 * @param {Function} setPanDirection - React setState for pan direction
 */
export const setGlobalControllers = (setZoomAxis, setPanDirection) => {
  if (typeof setZoomAxis !== 'function' || typeof setPanDirection !== 'function') {
    console.warn('setGlobalControllers called with invalid arguments');
    return;
  }
  globalSetZoomAxis = setZoomAxis;
  globalPanDirection = setPanDirection;
  isInitialized = true;
};

/**
 * Reset global controllers (for cleanup)
 */
export const resetGlobalControllers = () => {
  globalSetZoomAxis = () => {};
  globalPanDirection = () => {};
  isInitialized = false;
};

export class MyOrthographicController extends OrthographicController {
  
  handleEvent(event) {
    // Safety check - don't try to set state if not initialized
    if (!isInitialized) {
      super.handleEvent(event);
      return;
    }

    if (event.pointerType === "touch") {
      if (event.type === "pinchmove") {
        if (
          this.scrollZoom &&
          this.scrollZoom.zoomAxis &&
          this.scrollZoom.zoomAxis === "X"
        ) {
          return false;
        }
      }
    }
    
    if (event.type === 'panmove') {
      globalSetZoomAxis('all');
    }
    
    if (event.type === "wheel") {
      const controlKey = event.srcEvent.ctrlKey;
      if (controlKey) {
        globalSetZoomAxis('X');
        globalPanDirection(null);
      } else {
        if (Math.abs(event.srcEvent.deltaY) === 0) {
          if (event.srcEvent.deltaX > 0) {
            globalPanDirection("R");
          } else {
            globalPanDirection("L");
          }
        } else {
          globalSetZoomAxis('Y');
          globalPanDirection(null);
        }
      }
    }
    
    super.handleEvent(event);
  }
}
