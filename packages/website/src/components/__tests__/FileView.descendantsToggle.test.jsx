/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetSearchParams = vi.fn();
let latestDeckProps = null;

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
  default: (props) => (
    <div data-testid="position-slider">
      <label htmlFor="position-descendants-toggle">position-descendants-toggle</label>
      <input
        id="position-descendants-toggle"
        type="checkbox"
        checked={Boolean(props.highlightDescendantsOnHover)}
        onChange={(e) => props.setHighlightDescendantsOnHover?.(e.target.checked)}
      />
    </div>
  )
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

vi.mock('../Settings', () => ({
  default: (props) => (
    <div data-testid="settings-panel">
      <label htmlFor="descendants-color">descendants-color</label>
      <input
        id="descendants-color"
        type="color"
        value="#5eb19b"
        onChange={() => props.setDescendantsHighlightColor?.([255, 0, 0, 255])}
      />
    </div>
  )
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

describe('FileView descendants-hover setting', () => {
  beforeEach(() => {
    latestDeckProps = null;
    mockSetSearchParams.mockReset();
    mockQueryFile.mockReset();
    mockHandleConfigUpdate.mockReset();
    mockQueryDetails.mockReset();
  });

  it('passes descendants hover toggle from PositionSlider and color from Settings to LoraxDeckGL', async () => {
    const user = userEvent.setup();
    render(<FileView />);

    await waitFor(() => {
      expect(screen.getByTestId('deck')).toBeInTheDocument();
    });
    expect(latestDeckProps?.highlightDescendantsOnHover).toBe(false);
    expect(latestDeckProps?.descendantsHighlightColor).toEqual([94, 177, 155, 255]);
    expect(latestDeckProps?.enableTimeAxisWheelPan).toBe(true);

    const toggle = screen.getByLabelText('position-descendants-toggle');
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    await waitFor(() => {
      expect(latestDeckProps?.highlightDescendantsOnHover).toBe(true);
    });

    await user.click(screen.getByTitle('Settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('descendants-toggle')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('descendants-color'), { target: { value: '#ff0000' } });
    await waitFor(() => {
      expect(latestDeckProps?.descendantsHighlightColor).toEqual([255, 0, 0, 255]);
    });
  });
});
