/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetSearchParams = vi.fn();
let mockJBrowseRoute = '/jbrowse/test.trees?project=demo&assembly=hg19&genomiccoordstart=0&genomiccoordend=100';

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

vi.mock('../../config/jbrowseConfig.js', () => ({
  buildJBrowseRoute: () => mockJBrowseRoute
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
    mockJBrowseRoute = '/jbrowse/test.trees?project=demo&assembly=hg19&genomiccoordstart=0&genomiccoordend=100';
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

  it('adds time view steps after zoom and before the remaining tutorial steps', async () => {
    render(<FileView />);

    await waitFor(() => {
      expect(tourOverlayMockState.lastProps?.steps?.length).toBeGreaterThan(0);
    });

    const stepIds = tourOverlayMockState.lastProps.steps.map((step) => step.id);
    expect(stepIds.slice(0, 10)).toEqual([
      'viewer-position',
      'viewer-reset-view',
      'viewer-compare-topology',
      'viewer-lock-view',
      'viewer-viewport',
      'viewer-pan',
      'viewer-zoom',
      'viewer-time-view',
      'viewer-time-scale-scroll',
      'viewer-info-button'
    ]);

    const timeViewStep = tourOverlayMockState.lastProps.steps.find(
      (step) => step.id === 'viewer-time-view'
    );
    const timeScrollStep = tourOverlayMockState.lastProps.steps.find(
      (step) => step.id === 'viewer-time-scale-scroll'
    );

    expect(timeViewStep.target).toBe('[data-tour="viewer-time-view"]');
    expect(timeScrollStep.target).toBe('[data-tour="viewer-time-view"]');
    expect(timeScrollStep.animation?.gesture).toBe('two-finger-scroll');
  });

  it('adds a final JBrowse step when the JBrowse button is enabled', async () => {
    render(<FileView />);

    await waitFor(() => {
      expect(tourOverlayMockState.lastProps?.steps?.length).toBeGreaterThan(0);
    });

    const steps = tourOverlayMockState.lastProps.steps;
    expect(steps.at(-1)).toMatchObject({
      id: 'viewer-jbrowse-button',
      target: '[data-tour="viewer-jbrowse-button"]'
    });
    expect(screen.getByLabelText('Open in JBrowse')).toHaveAttribute('href', mockJBrowseRoute);
  });

  it('omits the JBrowse tour step when the JBrowse button is disabled', async () => {
    mockJBrowseRoute = '/';

    render(<FileView />);

    await waitFor(() => {
      expect(tourOverlayMockState.lastProps?.steps?.length).toBeGreaterThan(0);
    });

    const stepIds = tourOverlayMockState.lastProps.steps.map((step) => step.id);
    expect(stepIds).not.toContain('viewer-jbrowse-button');
    expect(screen.getByLabelText('Open in JBrowse')).toHaveAttribute('aria-disabled', 'true');
  });

  it('links to JBrowse while preserving current genomic coordinates', async () => {
    window.localStorage.setItem('lorax_tour:viewer', 'done');
    render(<FileView />);

    await waitFor(() => {
      const jbrowseLink = screen.getByLabelText('Open in JBrowse');

      expect(jbrowseLink).toHaveAttribute(
        'href',
        '/jbrowse/test.trees?project=demo&assembly=hg19&genomiccoordstart=0&genomiccoordend=100'
      );
      expect(screen.getByTestId('sidebar-jbrowse-icon')).toBeInTheDocument();
      expect(jbrowseLink).toContainElement(screen.getByTestId('sidebar-jbrowse-icon'));
    });
  });
});
