import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from './test/test-utils';
import App from './App';

// Mock all the complex hooks and components
vi.mock('./hooks/useConfig', () => ({
  default: () => ({
    data: null,
    setData: vi.fn(),
  }),
}));

vi.mock('./globalconfig.js', () => ({
  default: () => ({
    API_BASE: 'http://localhost:8000',
  }),
}));

vi.mock('./hooks/useConnect.jsx', () => ({
  default: () => ({
    connected: false,
    sendMessage: vi.fn(),
  }),
}));

vi.mock('./hooks/useFileUpload.jsx', () => ({
  default: () => ({
    uploadFile: vi.fn(),
    loadFile: vi.fn(),
    uploading: false,
    progress: 0,
  }),
}));

vi.mock('./components/LandingPage.jsx', () => ({
  default: ({ API_BASE }) => (
    <div data-testid="landing-page">
      Landing Page - API: {API_BASE}
    </div>
  ),
}));

vi.mock('./LoraxViewer.jsx', () => ({
  default: () => <div data-testid="lorax-viewer">Lorax Viewer</div>,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders landing page on root route', () => {
    render(<App />, { route: '/' });
    
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  it('renders lorax viewer on file route', () => {
    render(<App />, { route: '/test-file' });
    
    expect(screen.getByTestId('lorax-viewer')).toBeInTheDocument();
  });

  it('passes API_BASE to landing page', () => {
    render(<App />, { route: '/' });
    
    expect(screen.getByText(/API: http:\/\/localhost:8000/)).toBeInTheDocument();
  });
});
