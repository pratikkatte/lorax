import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import LandingPage from './LandingPage';

// Mock the global config
vi.mock('../globalconfig.js', () => ({
  default: () => ({
    API_BASE: 'http://localhost:8000',
  }),
}));

// Mock sub-components
vi.mock('./ErrorAlert.jsx', () => ({
  default: ({ message, onDismiss }) => (
    <div data-testid="error-alert" onClick={onDismiss}>
      {message}
    </div>
  ),
}));

vi.mock('./loraxMessage.jsx', () => ({
  default: ({ status, message }) => (
    <div data-testid="lorax-message">{message}</div>
  ),
}));

vi.mock('./landing/DatasetFiles.jsx', () => ({
  default: ({ files }) => (
    <div data-testid="dataset-files">{files.length} files</div>
  ),
}));

vi.mock('./landing/FeatureCard.jsx', () => ({
  default: ({ title, desc }) => (
    <div data-testid="feature-card">
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  ),
}));

vi.mock('./landing/ARGIllustration.jsx', () => ({
  default: () => <div data-testid="arg-illustration">ARG</div>,
}));

describe('LandingPage', () => {
  const createMockUpload = (overrides = {}) => ({
    browse: vi.fn(),
    projects: {},
    isUploading: false,
    uploadStatus: 'Uploading...',
    selectedFileName: null,
    dragOver: false,
    error: null,
    dismissError: vi.fn(),
    statusMessage: null,
    loadFile: vi.fn(),
    loadingFile: null,
    setLoadingFile: vi.fn(),
    getInputProps: () => ({ type: 'file', style: { display: 'none' } }),
    getDropzoneProps: () => ({ onDrop: vi.fn(), onDragOver: vi.fn() }),
    ...overrides,
  });

  it('renders the header with Lorax branding', () => {
    render(<LandingPage upload={createMockUpload()} />);
    
    expect(screen.getByText('Lorax')).toBeInTheDocument();
    expect(screen.getByText(/Interactive ARG visualization/)).toBeInTheDocument();
  });

  it('renders the hero section', () => {
    render(<LandingPage upload={createMockUpload()} />);
    
    expect(screen.getByText(/Visualize and Analyze/)).toBeInTheDocument();
    expect(screen.getByText(/Ancestral Recombination Graphs/)).toBeInTheDocument();
  });

  it('renders upload button', () => {
    render(<LandingPage upload={createMockUpload()} />);
    
    expect(screen.getByRole('button', { name: /Load a \.trees file/i })).toBeInTheDocument();
  });

  it('calls browse when upload button is clicked', async () => {
    const user = userEvent.setup();
    const browse = vi.fn();
    
    render(<LandingPage upload={createMockUpload({ browse })} />);
    
    await user.click(screen.getByRole('button', { name: /Load a \.trees file/i }));
    
    expect(browse).toHaveBeenCalled();
  });

  it('shows uploading status when isUploading is true', () => {
    render(<LandingPage upload={createMockUpload({ 
      isUploading: true, 
      uploadStatus: 'Processing...' 
    })} />);
    
    expect(screen.getByRole('button', { name: /Processing/i })).toBeInTheDocument();
  });

  it('disables upload button while uploading', () => {
    render(<LandingPage upload={createMockUpload({ isUploading: true })} />);
    
    expect(screen.getByRole('button', { name: /Uploading/i })).toBeDisabled();
  });

  it('shows selected file name', () => {
    render(<LandingPage upload={createMockUpload({ 
      selectedFileName: 'my-tree.trees' 
    })} />);
    
    expect(screen.getByText(/Selected:/)).toBeInTheDocument();
    expect(screen.getByText('my-tree.trees')).toBeInTheDocument();
  });

  it('renders error alert when error exists', () => {
    render(<LandingPage upload={createMockUpload({ 
      error: 'File upload failed' 
    })} />);
    
    expect(screen.getByTestId('error-alert')).toBeInTheDocument();
    expect(screen.getByText('File upload failed')).toBeInTheDocument();
  });

  it('renders features section', () => {
    render(<LandingPage upload={createMockUpload()} />);
    
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByTestId('feature-card')).toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    render(<LandingPage upload={createMockUpload()} />);
    
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} Lorax`))).toBeInTheDocument();
  });

  it('renders projects list when available', async () => {
    const user = userEvent.setup();
    const projects = {
      'Test Project': {
        folder: 'test',
        files: ['file1.trees', 'file2.trees'],
        description: 'A test dataset'
      }
    };
    
    render(<LandingPage upload={createMockUpload({ projects })} />);
    
    // Project name should be visible
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    
    // Click to expand
    await user.click(screen.getByText('Test Project'));
    
    // Files should be visible
    expect(screen.getByTestId('dataset-files')).toBeInTheDocument();
  });

  it('renders version badge', () => {
    render(<LandingPage upload={createMockUpload()} version="v1.0.0" />);
    
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('renders GitHub link', () => {
    render(<LandingPage upload={createMockUpload()} />);
    
    const githubLink = screen.getByRole('link', { name: /GitHub/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/pratikkatte/lorax/');
  });

  it('shows drag over state', () => {
    const { container } = render(<LandingPage upload={createMockUpload({ dragOver: true })} />);
    
    // The dropzone should have different styling when dragging over
    const dropzone = container.querySelector('.border-emerald-500\\/70');
    expect(dropzone).toBeInTheDocument();
  });
});


