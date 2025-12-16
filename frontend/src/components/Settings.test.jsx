import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import Settings from './Settings';

describe('Settings', () => {
  const defaultProps = {
    settings: {
      number_of_trees: 10,
      display_lineage_paths: false,
    },
    setSettings: vi.fn(),
    showSettings: true,
    setShowSettings: vi.fn(),
  };

  it('renders the settings panel', () => {
    render(<Settings {...defaultProps} />);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the close button', () => {
    render(<Settings {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls setShowSettings(false) when close button is clicked', async () => {
    const user = userEvent.setup();
    const setShowSettings = vi.fn();
    
    render(<Settings {...defaultProps} setShowSettings={setShowSettings} />);
    
    await user.click(screen.getByRole('button', { name: /close/i }));
    
    expect(setShowSettings).toHaveBeenCalledWith(false);
  });

  it('displays "No settings available" message', () => {
    render(<Settings {...defaultProps} />);
    
    expect(screen.getByText('No settings available')).toBeInTheDocument();
  });

  it('renders with proper styling classes', () => {
    const { container } = render(<Settings {...defaultProps} />);
    
    const settingsDiv = container.firstChild;
    expect(settingsDiv).toHaveClass('w-full', 'h-full', 'bg-gray-50');
  });
});


