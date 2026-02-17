/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetSearchParams = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ file: 'test.trees' }),
  useSearchParams: () => [new URLSearchParams('project=demo'), mockSetSearchParams]
}));

vi.mock('../ViewportOverlay', () => ({
  default: () => <div data-testid="viewport-overlay" />
}));

vi.mock('../Info', () => ({
  default: () => null
}));

vi.mock('../Settings', () => ({
  default: () => null
}));

vi.mock('../ScreenshotModal', () => ({
  default: () => null
}));

vi.mock('../PositionSlider', () => ({
  default: () => <div data-testid="position-slider" />
}));

const mockViewportDimensions = {
  viewport: { top: 0, left: 0, width: 800, height: 600 },
  views: {
    ortho: {},
    genomeInfo: {},
    genomePositions: {},
    treeTime: {}
  },
  updateViewport: vi.fn(),
  updateView: vi.fn()
};

vi.mock('../hooks/useViewportDimensions', () => ({
  useViewportDimensions: () => ({
    ...mockViewportDimensions
  })
}));

vi.mock('../hooks/useViewportDimensions.jsx', () => ({
  useViewportDimensions: () => ({
    ...mockViewportDimensions
  })
}));

const mockQueryFile = vi.fn();
const mockHandleConfigUpdate = vi.fn();
const mockQueryDetails = vi.fn();

vi.mock('@lorax/core', async () => {
  const ReactMod = await import('react');
  return {
    useLorax: () => ({
      queryFile: mockQueryFile,
      handleConfigUpdate: mockHandleConfigUpdate,
      tsconfig: {
        filename: 'test.trees',
        file_path: '/tmp/test.trees',
        genome_length: 1000,
        value: [0, 100],
        intervals: [0, 100, 200, 300],
        times: { type: 'gen' }
      },
      filename: 'test.trees',
      genomeLength: 1000,
      isConnected: true,
      queryDetails: mockQueryDetails,
      selectedColorBy: null,
      metadataArrays: null
    }),
    DEFAULT_VIEW_CONFIG: {
      ortho: {},
      genomeInfo: {},
      genomePositions: {},
      treeTime: {}
    },
    LoraxDeckGL: ReactMod.forwardRef((props, ref) => {
      ReactMod.useImperativeHandle(ref, () => ({
        setGenomicCoords: vi.fn(),
        viewAdjustY: vi.fn(),
        getDeck: vi.fn()
      }));
      return <div data-testid="deck" />;
    })
  };
});

const tourOverlayMockState = {
  openStates: [],
  lastProps: null
};

vi.mock('../TourOverlay', () => ({
  default: (props) => {
    tourOverlayMockState.openStates.push(Boolean(props?.open));
    tourOverlayMockState.lastProps = props;
    if (!props?.open) return null;
    return (
      <div data-testid="tour-overlay">
        <button onClick={() => props.onFinish?.()}>finish-tour</button>
      </div>
    );
  }
}));

import FileView from '../FileView.jsx';

describe('FileView tutorial behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    tourOverlayMockState.openStates.length = 0;
    tourOverlayMockState.lastProps = null;
    mockSetSearchParams.mockReset();
    mockQueryFile.mockReset();
    mockHandleConfigUpdate.mockReset();
    mockQueryDetails.mockReset();
  });

  it('auto-opens for first-time users', async () => {
    render(<FileView />);
    await waitFor(() => {
      expect(screen.getByTestId('tour-overlay')).toBeInTheDocument();
    });
  });

  it('does not auto-open for returning users', async () => {
    window.localStorage.setItem('lorax_tour:viewer', 'done');
    render(<FileView />);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(screen.queryByTestId('tour-overlay')).not.toBeInTheDocument();
    expect(tourOverlayMockState.openStates).not.toContain(true);
  });

  it('allows returning users to manually reopen via sidebar button', async () => {
    window.localStorage.setItem('lorax_tour:viewer', 'done');
    const user = userEvent.setup();
    render(<FileView />);
    await user.click(screen.getByTitle('Tutorial'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-overlay')).toBeInTheDocument();
    });
  });

  it('marks tutorial as seen on finish', async () => {
    const user = userEvent.setup();
    render(<FileView />);
    await waitFor(() => {
      expect(screen.getByTestId('tour-overlay')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'finish-tour' }));

    expect(window.localStorage.getItem('lorax_tour:viewer')).toBe('done');
    await waitFor(() => {
      expect(screen.queryByTestId('tour-overlay')).not.toBeInTheDocument();
    });
  });
});
