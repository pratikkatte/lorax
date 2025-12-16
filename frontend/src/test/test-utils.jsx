import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components with necessary providers
 * Add more providers here as needed (e.g., context providers, redux store, etc.)
 */
function customRender(ui, options = {}) {
  const {
    route = '/',
    ...renderOptions
  } = options;

  // Set initial route if needed
  window.history.pushState({}, 'Test page', route);

  const Wrapper = ({ children }) => {
    return (
      <BrowserRouter>
        {children}
      </BrowserRouter>
    );
  };

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Re-export everything from RTL
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };

// Export userEvent for convenience
export { default as userEvent } from '@testing-library/user-event';


