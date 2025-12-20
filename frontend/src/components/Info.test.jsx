import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import Info from './Info';

// Mock websocket events
vi.mock('../webworkers/websocketEvents', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock sub-components
vi.mock('./info/InfoMetadata', () => ({
  default: ({ treeDetails, nodeDetails }) => (
    <div data-testid="info-metadata">
      {treeDetails && <span>Tree: {treeDetails.id}</span>}
      {nodeDetails && <span>Node: {nodeDetails.id}</span>}
    </div>
  ),
}));

vi.mock('./info/InfoMutations', () => ({
  default: ({ treeDetails }) => (
    <div data-testid="info-mutations">
      Mutations Panel
    </div>
  ),
}));

vi.mock('./info/InfoFilter', () => ({
  default: ({ searchTerm, setSearchTerm }) => (
    <div data-testid="info-filter">
      <input
        data-testid="search-input"
        value={searchTerm || ''}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  ),
}));

describe('Info', () => {
  const createDefaultProps = (overrides = {}) => ({
    backend: {
      socketRef: { current: null },
      isConnected: false,
    },
    gettingDetails: false,
    setGettingDetails: vi.fn(),
    setShowInfo: vi.fn(),
    config: {
      tsconfig: {},

      populationFilter: {},
      sampleNames: [],
      setPopulationFilter: vi.fn(),
      sampleDetails: {},
      metadataColors: {},
      metadataKeys: ['population', 'region'],
      treeColors: {},
      setTreeColors: vi.fn(),
      searchTerm: '',
      setSearchTerm: vi.fn(),
      searchTags: [],
      setSearchTags: vi.fn(),
    },
    setConfig: vi.fn(),
    selectedFileName: 'test.trees',
    setSelectedFileName: vi.fn(),
    visibleTrees: [],
    settings: {},
    setSettings: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Info panel', () => {
    render(<Info {...createDefaultProps()} />);

    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('renders tab buttons', () => {
    render(<Info {...createDefaultProps()} />);

    expect(screen.getByRole('button', { name: /Metadata/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mutations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter/i })).toBeInTheDocument();
  });

  it('shows Metadata tab by default', () => {
    render(<Info {...createDefaultProps()} />);

    expect(screen.getByTestId('info-metadata')).toBeInTheDocument();
  });

  it('switches to Mutations tab when clicked', async () => {
    const user = userEvent.setup();
    render(<Info {...createDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /Mutations/i }));

    expect(screen.getByTestId('info-mutations')).toBeInTheDocument();
  });

  it('switches to Filter tab when clicked', async () => {
    const user = userEvent.setup();
    render(<Info {...createDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /Filter/i }));

    expect(screen.getByTestId('info-filter')).toBeInTheDocument();
  });

  it('calls setShowInfo(false) when close button is clicked', async () => {
    const user = userEvent.setup();
    const setShowInfo = vi.fn();

    render(<Info {...createDefaultProps({ setShowInfo })} />);

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(setShowInfo).toHaveBeenCalledWith(false);
  });

  it('highlights active tab', async () => {
    const user = userEvent.setup();
    render(<Info {...createDefaultProps()} />);

    const mutationsTab = screen.getByRole('button', { name: /Mutations/i });
    await user.click(mutationsTab);

    // Check that mutations tab has the active class
    expect(mutationsTab).toHaveClass('border-blue-500');
  });

  it('builds colorBy options from metadataKeys', () => {
    const props = createDefaultProps({
      config: {
        ...createDefaultProps().config,
        metadataKeys: ['population', 'super_population', 'region'],
      },
    });

    render(<Info {...props} />);

    // Component should render without errors
    expect(screen.getByTestId('info-metadata')).toBeInTheDocument();
  });

  it('handles empty metadataKeys', () => {
    const props = createDefaultProps({
      config: {
        ...createDefaultProps().config,
        metadataKeys: [],
      },
    });

    render(<Info {...props} />);

    expect(screen.getByTestId('info-metadata')).toBeInTheDocument();
  });

  it('renders with connected backend', () => {
    const props = createDefaultProps({
      backend: {
        socketRef: { current: { connected: true } },
        isConnected: true,
      },
    });

    render(<Info {...props} />);

    expect(screen.getByTestId('info-metadata')).toBeInTheDocument();
  });
});


