import { OrthographicController } from '@deck.gl/core'

type ZoomAxis = 'X' | 'Y' | 'all'

let globalSetZoomAxis: (axis: ZoomAxis) => void = () => {}

/**
 * Set global controller callback for zoom axis
 * @param setZoomAxis - State setter for zoom axis ('X', 'Y', or 'all')
 */
export const setGlobalZoomAxisCallback = (setZoomAxis: (axis: ZoomAxis) => void) => {
  globalSetZoomAxis = setZoomAxis
}

/**
 * Custom OrthographicController with independent X/Y zoom:
 * - Ctrl+wheel = X-axis zoom (horizontal)
 * - Wheel (vertical scroll) = Y-axis zoom (vertical)
 * - Pan = moves in both directions
 */
export class LoraxOrthographicController extends OrthographicController {
  handleEvent(event: any): boolean {
    // Handle pan move - allow both axes
    if (event.type === 'panmove') {
      globalSetZoomAxis('all')
    }

    // Handle wheel events
    if (event.type === 'wheel') {
      const ctrlKey = event.srcEvent?.ctrlKey || event.srcEvent?.metaKey
      const deltaX = event.deltaX ?? 0
      const deltaY = event.deltaY ?? 0
      const isHorizontalScroll = Math.abs(deltaX) > Math.abs(deltaY)

      if (ctrlKey) {
        // Ctrl+wheel = X-axis zoom (horizontal)
        globalSetZoomAxis('X')
      } else if (isHorizontalScroll) {
        // Horizontal scroll should bubble to JBrowse
        return false
      } else {
        // Regular wheel = Y-axis zoom (vertical)
        globalSetZoomAxis('Y')
      }
    }

    return super.handleEvent(event)
  }
}

export type { ZoomAxis }
