import { OrthographicController } from "@deck.gl/core";

let globalSetZoomAxis = () => {};
let globalPanDirection = () => {};
let globalSetWheelPanDeltaX = () => {};
let wheelPanDeltaX = 0;
let wheelPanDeltaY = 0;

/**
 * Set global controller callbacks for zoom axis and pan direction
 * @param {Function} setZoomAxis - State setter for zoom axis ('X', 'Y', or 'all')
 * @param {Function} setPanDirection - State setter for pan direction ('L', 'R', or null)
 */
export const setGlobalControllers = (setZoomAxis, setPanDirection, setWheelPanDeltaX) => {
  globalSetZoomAxis = setZoomAxis;
  globalPanDirection = setPanDirection;
  globalSetWheelPanDeltaX = setWheelPanDeltaX;
};

export const getWheelPanDeltaX = () => wheelPanDeltaX;
export const getWheelPanDeltaY = () => wheelPanDeltaY;

/**
 * Custom OrthographicController with specialized zoom/pan behavior:
 * - Ctrl+wheel = X-axis zoom
 * - Wheel (vertical) = Y-axis zoom
 * - Shift+wheel or trackpad horizontal = X-axis pan
 * - Touch pinch = Y-axis zoom only
 */
export class MyOrthographicController extends OrthographicController {
  handleEvent(event) {
    // Handle touch pinch - only allow Y-axis zoom
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

    // Handle pan move
    if (event.type === 'panmove') {
      globalSetZoomAxis('all');
      globalPanDirection(null);
      globalSetWheelPanDeltaX(0);
      wheelPanDeltaX = 0;
      wheelPanDeltaY = 0;
    }

    // Handle wheel events
    if (event.type === "wheel") {
      const controlKey = event.srcEvent.ctrlKey;
      if (controlKey) {
        // Ctrl+wheel = X-axis zoom
        globalSetZoomAxis('X');
        globalPanDirection(null);
        globalSetWheelPanDeltaX(0);
        wheelPanDeltaX = 0;
        wheelPanDeltaY = event.srcEvent.deltaY || 0;
      } else {
        const absDeltaX = Math.abs(event.srcEvent.deltaX || 0);
        const absDeltaY = Math.abs(event.srcEvent.deltaY || 0);
        if (absDeltaX > 0 && absDeltaX > absDeltaY) {
          // Horizontal scroll (trackpad) = pan (use deck's target update on X)
          globalSetZoomAxis('X');
          globalPanDirection(null);
          wheelPanDeltaX = event.srcEvent.deltaX || 0;
          wheelPanDeltaY = event.srcEvent.deltaY || 0;
          globalSetWheelPanDeltaX(wheelPanDeltaX);
        } else {
          // Vertical scroll = Y-axis zoom
          globalSetZoomAxis('Y');
          globalPanDirection(null);
          globalSetWheelPanDeltaX(0);
          wheelPanDeltaX = 0;
          wheelPanDeltaY = event.srcEvent.deltaY || 0;
        }
      }
    }

    super.handleEvent(event);
  }
}
