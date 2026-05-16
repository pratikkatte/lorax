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
  default: () => <div data-testid="info-panel" />
}));

vi.mock('../Settings', () => ({
  default: () => <div data-testid="settings-panel" />
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

vi.mock('../PositionSlider', () => ({
  default: ({ lockModelMatrix, setLockModelMatrix }) => (
    <div>
      <span data-testid="lock-state">{String(lockModelMatrix)}</span>
      <button onClick={() => setLockModelMatrix(true)}>user-lock-on</button>
      <button onClick={() => setLockModelMatrix(false)}>user-lock-off</button>
    </div>
  )
}));

const mockQueryFile = vi.fn();
const mockHandleConfigUpdate = vi.fn();
const mockQueryDetails = vi.fn();
const mockViewAdjustY = vi.fn();
let emitInitialTreeCount = false;

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
        viewAdjustY: mockViewAdjustY,
        getDeck: vi.fn()
      }));
      ReactMod.useEffect(() => {
        if (emitInitialTreeCount) {
          props.onTreesInWindowCountChange?.(5);
        }
      }, [props]);
      return (
        <div>
          <button onClick={() => props.onShowingAllTreesChange?.(true)}>showing-true</button>
          <button onClick={() => props.onShowingAllTreesChange?.(false)}>showing-false</button>
          <button onClick={() => props.onTreesInWindowCountChange?.(5)}>count-5</button>
          <button onClick={() => props.onTreesInWindowCountChange?.(11)}>count-11</button>
        </div>
      );
    })
  };
});

import FileView from '../FileView.jsx';

describe('FileView lock auto behavior', () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockQueryFile.mockReset();
    mockHandleConfigUpdate.mockReset();
    mockQueryDetails.mockReset();
    mockViewAdjustY.mockReset();
    emitInitialTreeCount = false;
  });

  it('automatically resets the vertical view once when the file loads', async () => {
    render(<FileView />);

    await waitFor(() => expect(mockViewAdjustY).toHaveBeenCalledTimes(1));
  });

  it('retries the initial vertical reset until tree bounds are available', async () => {
    emitInitialTreeCount = true;
    mockViewAdjustY
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    render(<FileView />);

    await waitFor(() => expect(mockViewAdjustY).toHaveBeenCalledTimes(2));
  });

  it('auto-enables on showingAllTrees with <=10 trees and auto-disables when trees exceed 10', async () => {
    const user = userEvent.setup();
    render(<FileView />);

    expect(screen.getByTestId('lock-state')).toHaveTextContent('false');

    await user.click(screen.getByRole('button', { name: 'count-5' }));
    await user.click(screen.getByRole('button', { name: 'showing-true' }));

    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('true'));

    await user.click(screen.getByRole('button', { name: 'count-11' }));
    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('false'));
  });

  it('respects manual OFF override until context reset', async () => {
    const user = userEvent.setup();
    render(<FileView />);

    await user.click(screen.getByRole('button', { name: 'count-5' }));
    await user.click(screen.getByRole('button', { name: 'showing-true' }));
    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('true'));

    await user.click(screen.getByRole('button', { name: 'user-lock-off' }));
    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('false'));

    await user.click(screen.getByRole('button', { name: 'showing-true' }));
    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('false'));

    await user.click(screen.getByRole('button', { name: 'showing-false' }));
    await user.click(screen.getByRole('button', { name: 'showing-true' }));
    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('true'));
  });

  it('manual ON does not auto-disable when trees exceed threshold', async () => {
    const user = userEvent.setup();
    render(<FileView />);

    await user.click(screen.getByRole('button', { name: 'user-lock-on' }));
    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('true'));

    await user.click(screen.getByRole('button', { name: 'count-11' }));
    await waitFor(() => expect(screen.getByTestId('lock-state')).toHaveTextContent('true'));
  });
});
