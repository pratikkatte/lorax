/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetSearchParams = vi.fn();
let latestDeckProps = null;
let latestInfoProps = null;
let mockLoraxState;

vi.mock('react-router-dom', () => ({
  useParams: () => ({ file: 'test.csv' }),
  useSearchParams: () => [new URLSearchParams('project=demo&presetfeature=tree-colors'), mockSetSearchParams]
}));

vi.mock('../ViewportOverlay', () => ({
  default: () => <div data-testid="viewport-overlay" />
}));

vi.mock('../Info', () => ({
  default: (props) => {
    latestInfoProps = props;
    return (
      <div data-testid="info-panel">
        <button onClick={() => props.setColorByTree?.((prev) => !prev)}>toggle-color-by-tree</button>
        <button onClick={() => props.setTreeColors?.((prev) => ({ ...prev, 1: '#00AA00' }))}>set-tree-1-color</button>
      </div>
    );
  }
}));

vi.mock('../Settings', () => ({
  default: () => null
}));

vi.mock('../ScreenshotModal', () => ({
  default: () => null
}));

vi.mock('../TourOverlay', () => ({
  default: () => null
}));

vi.mock('../hooks/useTourState', () => ({
  default: () => ({ hasSeen: true })
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
      queryDetails: mockQueryDetails,
      selectedColorBy: null,
      metadataArrays: null,
      ...mockLoraxState
    }),
    DEFAULT_VIEW_CONFIG: {
      ortho: {},
      genomeInfo: {},
      genomePositions: {},
      treeTime: {}
    },
    HoverTooltip: ({ tooltip }) => tooltip ? <div data-testid="hover-tooltip">{tooltip.title}</div> : null,
    formatTooltipTime: (value) => String(value ?? '-'),
    formatTooltipValue: (value) => String(value ?? '-'),
    getTooltipClientCoords: () => ({ x: 0, y: 0 }),
    LoraxDeckGL: ReactMod.forwardRef((props, ref) => {
      latestDeckProps = props;
      ReactMod.useImperativeHandle(ref, () => ({
        setGenomicCoords: vi.fn(),
        viewAdjustY: vi.fn(),
        getDeck: vi.fn()
      }));
      return <div data-testid="deck" />;
    })
  };
});

import FileView from '../FileView.jsx';

function makeLoraxState(treeInfo = { 0: '#F25555', 1: '#5583F2', 2: 'not-a-color' }) {
  return {
    tsconfig: {
      filename: 'test.csv',
      file_path: '/tmp/test.csv',
      genome_length: 1000,
      value: [0, 100],
      intervals: [0, 100, 200, 300],
      times: { type: 'branch length' },
      ...(treeInfo ? { tree_info: treeInfo } : {})
    },
    filename: 'test.csv',
    genomeLength: 1000,
    isConnected: true,
    loraxSid: 'session-1'
  };
}

describe('FileView CSV tree-info polygon colors', () => {
  beforeEach(() => {
    latestDeckProps = null;
    latestInfoProps = null;
    mockSetSearchParams.mockReset();
    mockQueryFile.mockReset();
    mockHandleConfigUpdate.mockReset();
    mockQueryDetails.mockReset();
    mockLoraxState = makeLoraxState();
  });

  it('uses default picker colors when disabled and CSV picker colors when color-by-tree is enabled', async () => {
    const user = userEvent.setup();
    render(<FileView />);

    await waitFor(() => {
      expect(screen.getByTestId('deck')).toBeInTheDocument();
      expect(latestInfoProps?.treeColors).toEqual({});
    });

    expect(latestDeckProps?.colorEdgesByTree).toBe(false);
    expect(latestDeckProps?.polygonOptions?.treeColors).toEqual({});

    await user.click(screen.getByRole('button', { name: 'toggle-color-by-tree' }));

    await waitFor(() => {
      expect(latestInfoProps?.treeColors).toEqual({
        0: '#F25555',
        1: '#5583F2',
      });
      expect(latestDeckProps?.colorEdgesByTree).toBe(false);
      expect(latestDeckProps?.polygonOptions?.treeColors).toEqual({
        0: '#F25555',
        1: '#5583F2',
      });
    });

    await user.click(screen.getByRole('button', { name: 'set-tree-1-color' }));

    await waitFor(() => {
      expect(latestInfoProps?.treeColors).toEqual({
        0: '#F25555',
        1: '#00AA00',
      });
      expect(latestDeckProps?.polygonOptions?.treeColors).toEqual({
        0: '#F25555',
        1: '#00AA00',
      });
    });

    await user.click(screen.getByRole('button', { name: 'toggle-color-by-tree' }));

    await waitFor(() => {
      expect(latestInfoProps?.treeColors).toEqual({});
      expect(latestDeckProps?.polygonOptions?.treeColors).toEqual({});
    });
  });

  it('clears stale CSV and manual tree colors when the next file has no tree_info', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FileView />);

    await waitFor(() => {
      expect(latestInfoProps?.treeColors).toEqual({});
    });

    await user.click(screen.getByRole('button', { name: 'set-tree-1-color' }));
    await waitFor(() => {
      expect(latestDeckProps?.polygonOptions?.treeColors).toEqual({
        1: '#00AA00'
      });
    });

    await user.click(screen.getByRole('button', { name: 'toggle-color-by-tree' }));
    await waitFor(() => {
      expect(latestDeckProps?.polygonOptions?.treeColors).toEqual({
        0: '#F25555',
        1: '#5583F2',
      });
    });

    mockLoraxState = makeLoraxState(null);
    mockLoraxState.tsconfig.filename = 'next.csv';
    mockLoraxState.filename = 'next.csv';
    rerender(<FileView />);

    await waitFor(() => {
      expect(latestInfoProps?.treeColors).toEqual({});
      expect(latestDeckProps?.polygonOptions?.treeColors).toEqual({});
    });
  });
});
