/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetSearchParams = vi.fn();
const infoFetchStates = [];

vi.mock('react-router-dom', () => ({
  useParams: () => ({ file: 'test.trees' }),
  useSearchParams: () => [new URLSearchParams('project=demo'), mockSetSearchParams]
}));

vi.mock('../ViewportOverlay', () => ({
  default: () => <div data-testid="viewport-overlay" />
}));

vi.mock('../Info', () => ({
  default: ({ isFetchingDetails = false }) => {
    infoFetchStates.push(Boolean(isFetchingDetails));
    return <div data-testid="info-panel">{String(Boolean(isFetchingDetails))}</div>;
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
  default: () => ({ hasSeen: true, markSeen: vi.fn() })
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
    HoverTooltip: ({ tooltip }) => tooltip ? (
      <div data-testid="hover-tooltip">
        <div>{tooltip.title}</div>
        {(tooltip.rows || []).map((row) => (
          <div key={`${row.k}-${row.v}`}>
            <span>{row.k}</span>
            <span>{row.v}</span>
          </div>
        ))}
      </div>
    ) : null,
    formatTooltipTime: (value) => String(value ?? '-'),
    formatTooltipValue: (value) => String(value ?? '-'),
    getTooltipClientCoords: () => ({ x: 0, y: 0 }),
    LoraxDeckGL: ReactMod.forwardRef((props, ref) => {
      ReactMod.useImperativeHandle(ref, () => ({
        setGenomicCoords: vi.fn(),
        viewAdjustY: vi.fn(),
        getDeck: vi.fn()
      }));

      return (
        <div>
          <button onClick={() => props.onEdgeClick?.({ tree_idx: 1 })}>edge-click</button>
          <button onClick={() => props.onTipClick?.({ tree_idx: 2, node_id: 42 })}>tip-click</button>
          <button onMouseEnter={() => props.onTipHover?.(
            { tree_idx: 2, node_id: 42, node_time: 42.5 },
            { x: 10, y: 20 },
            null
          )}>tip-hover</button>
          <button onMouseEnter={() => props.onEdgeHover?.(
            { tree_idx: 1, parent_id: 7, child_id: 9, parent_time: 100, child_time: 25.25 },
            { x: 10, y: 20 },
            null
          )}>edge-hover</button>
        </div>
      );
    })
  };
});

import FileView from '../FileView.jsx';

const createDeferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('FileView details loading wiring', () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockQueryFile.mockReset();
    mockHandleConfigUpdate.mockReset();
    mockQueryDetails.mockReset();
    infoFetchStates.length = 0;
  });

  const openInfoPanel = async (user) => {
    await user.click(screen.getByTitle('Info & Filters'));
    await waitFor(() => {
      expect(screen.getByTestId('info-panel')).toBeInTheDocument();
      expect(screen.getByTestId('info-panel')).toHaveTextContent('false');
    });
  };

  it('toggles isFetchingDetails around edge details fetch', async () => {
    const deferred = createDeferred();
    mockQueryDetails.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();

    render(<FileView />);
    await openInfoPanel(user);

    await user.click(screen.getByRole('button', { name: 'edge-click' }));

    await waitFor(() => {
      expect(mockQueryDetails).toHaveBeenCalledWith({ treeIndex: 1 });
      expect(screen.getByTestId('info-panel')).toHaveTextContent('true');
    });

    deferred.resolve({ tree: { num_nodes: 1 } });

    await waitFor(() => {
      expect(screen.getByTestId('info-panel')).toHaveTextContent('false');
    });
    expect(infoFetchStates).toContain(true);
  });

  it('toggles isFetchingDetails around tip details fetch', async () => {
    const deferred = createDeferred();
    mockQueryDetails.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();

    render(<FileView />);
    await openInfoPanel(user);

    await user.click(screen.getByRole('button', { name: 'tip-click' }));

    await waitFor(() => {
      expect(mockQueryDetails).toHaveBeenCalledWith({
        treeIndex: 2,
        node: 42,
        comprehensive: true
      });
      expect(screen.getByTestId('info-panel')).toHaveTextContent('true');
    });

    deferred.resolve({ node: { id: 42 } });

    await waitFor(() => {
      expect(screen.getByTestId('info-panel')).toHaveTextContent('false');
    });
    expect(infoFetchStates).toContain(true);
  });

  it('shows node time in the tip hover tooltip', async () => {
    const user = userEvent.setup();

    render(<FileView />);

    await user.hover(screen.getByRole('button', { name: 'tip-hover' }));

    expect(await screen.findByText('Node time')).toBeInTheDocument();
    expect(screen.getByText('42.5')).toBeInTheDocument();
  });

  it('shows parent and child times in the edge hover tooltip', async () => {
    const user = userEvent.setup();

    render(<FileView />);

    await user.hover(screen.getByRole('button', { name: 'edge-hover' }));

    expect(await screen.findByText('Parent time')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Child time')).toBeInTheDocument();
    expect(screen.getByText('25.25')).toBeInTheDocument();
  });
});
