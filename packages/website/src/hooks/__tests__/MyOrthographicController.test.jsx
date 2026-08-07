import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleEvent = vi.fn();

vi.mock('@deck.gl/core', () => ({
  OrthographicController: class {
    constructor() {
      this.props = { zoomAxis: 'all' };
    }

    handleEvent(event) {
      handleEvent({ event, zoomAxis: this.props.zoomAxis });
      return true;
    }
  }
}));

import { MyOrthographicController } from '@lorax/core/src/controllers/MyOrthographicController.js';

describe('MyOrthographicController browser zoom routing', () => {
  beforeEach(() => {
    handleEvent.mockClear();
  });

  it('routes a ctrl+wheel pinch to X zoom before Deck handles the same event', () => {
    const controller = new MyOrthographicController();
    controller.handleEvent({
      type: 'wheel',
      srcEvent: { ctrlKey: true, deltaX: 0, deltaY: -3 }
    });

    expect(handleEvent).toHaveBeenCalledWith(expect.objectContaining({ zoomAxis: 'X' }));
  });

  it('routes ordinary vertical wheel input to Y zoom', () => {
    const controller = new MyOrthographicController();
    controller.handleEvent({
      type: 'wheel',
      srcEvent: { ctrlKey: false, deltaX: 0, deltaY: 12 }
    });

    expect(handleEvent).toHaveBeenCalledWith(expect.objectContaining({ zoomAxis: 'Y' }));
  });

  it('routes real touch pinch events to Y zoom', () => {
    const controller = new MyOrthographicController();
    controller.handleEvent({ type: 'pinchmove', pointerType: 'touch' });

    expect(handleEvent).toHaveBeenCalledWith(expect.objectContaining({ zoomAxis: 'Y' }));
  });
});
