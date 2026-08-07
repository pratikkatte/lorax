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

function isHorizontalWheelEvent(event) {
  const source = event?.srcEvent;
  if (!source || source.ctrlKey) return false;
  const deltaX = Math.abs(source.deltaX || 0);
  const deltaY = Math.abs(source.deltaY || 0);
  return deltaX > 0 && deltaX > deltaY;
}

/**
 * Custom OrthographicController with specialized zoom/pan behavior:
 * - Ctrl+wheel = X-axis zoom
 * - Wheel (vertical) = Y-axis zoom
 * - Shift+wheel or trackpad horizontal = X-axis pan
 * - Touch pinch = Y-axis zoom only
 */
export class MyOrthographicController extends OrthographicController {
  setZoomAxisForEvent(zoomAxis) {
    // OrthographicController reads zoomAxis while handling the event. Keep this
    // decision on the controller instead of waiting for React to re-render: a
    // trackpad can emit another wheel event before that state update lands.
    this.props.zoomAxis = zoomAxis;
  }

  handleEvent(event) {
    // Handle touch pinch - only allow Y-axis zoom. This covers browsers that
    // expose a real pinch event, while Safari desktop exposes a ctrl+wheel
    // event below.
    if (event.pointerType === "touch" && event.type === "pinchmove") {
      this.setZoomAxisForEvent('Y');
      globalSetZoomAxis('Y');
      globalPanDirection(null);
    }

    // Handle pan move
    if (event.type === 'panmove') {
      this.setZoomAxisForEvent('all');
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
        this.setZoomAxisForEvent('X');
        globalSetZoomAxis('X');
        globalPanDirection(null);
        globalSetWheelPanDeltaX(0);
        wheelPanDeltaX = 0;
        wheelPanDeltaY = event.srcEvent.deltaY || 0;
      } else {
        const absDeltaX = Math.abs(event.srcEvent.deltaX || 0);
        const absDeltaY = Math.abs(event.srcEvent.deltaY || 0);
        if (absDeltaX > 0 && absDeltaX > absDeltaY) {
          // Horizontal scroll is a pan, not an X zoom. _onWheel handles this
          // directly so it never enters the zoom and view-state correction path.
          globalSetZoomAxis('all');
          globalPanDirection(null);
          globalSetWheelPanDeltaX(0);
          wheelPanDeltaX = 0;
          wheelPanDeltaY = 0;
        } else {
          // Vertical scroll = Y-axis zoom
          this.setZoomAxisForEvent('Y');
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

  _onWheel(event) {
    if (!isHorizontalWheelEvent(event)) {
      return super._onWheel(event);
    }

    const pos = this.getCenter(event);
    if (!this.isPointInBounds(pos, event)) {
      return false;
    }

    event.srcEvent.preventDefault();
    const controllerState = this.controllerState;
    const viewport = this.makeViewport(controllerState.getViewportProps());
    const startPosition = viewport.unproject(pos);
    const newControllerState = controllerState.pan({
      startPosition,
      // Match the previous target delta while using Deck.gl's real pan path.
      pos: [pos[0] - event.srcEvent.deltaX, pos[1]]
    });

    this.updateViewport(newControllerState, null, { isPanning: true });
    // Wheel input has no explicit end event; Lorax keeps the interaction active
    // briefly after this reset to coalesce a trackpad gesture.
    this._setInteractionState({ isPanning: false });
    return true;
  }
}
