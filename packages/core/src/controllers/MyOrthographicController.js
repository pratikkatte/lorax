import { OrthographicController } from "@deck.gl/core";

let globalSetZoomAxis = () => {};
let globalPanDirection = () => {};

/**
 * Set global controller callbacks for zoom axis and pan direction
 * @param {Function} setZoomAxis - State setter for zoom axis ('X', 'Y', or 'all')
 * @param {Function} setPanDirection - State setter for pan direction ('L', 'R', or null)
 */
export const setGlobalControllers = (setZoomAxis, setPanDirection) => {
  globalSetZoomAxis = setZoomAxis;
  globalPanDirection = setPanDirection;
};

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
    }

    // Handle wheel events
    if (event.type === "wheel") {
      const controlKey = event.srcEvent.ctrlKey;
      if (controlKey) {
        // Ctrl+wheel = X-axis zoom
        globalSetZoomAxis('X');
        globalPanDirection(null);
      } else {
        if (Math.abs(event.srcEvent.deltaY) === 0) {
          // Horizontal scroll (trackpad) = pan
          if (event.srcEvent.deltaX > 0) {
            globalPanDirection("R");
          } else {
            globalPanDirection("L");
          }
        } else {
          // Vertical scroll = Y-axis zoom
          globalSetZoomAxis('Y');
          globalPanDirection(null);
        }
      }
    }

    super.handleEvent(event);
  }
}
