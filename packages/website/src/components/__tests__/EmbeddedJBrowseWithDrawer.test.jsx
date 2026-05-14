import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@jbrowse/core/configuration', () => ({
  readConfObject: () => ({})
}));

vi.mock('@jbrowse/core/ui', () => ({
  createJBrowseTheme: () => ({}),
  LoadingEllipses: () => <div data-testid="loading" />
}));

vi.mock('@jbrowse/embedded-core', () => ({
  EmbeddedViewContainer: ({ children }) => (
    <div data-testid="embedded-view-container">{children}</div>
  )
}));

vi.mock('@jbrowse/mobx-state-tree', () => ({
  getEnv: (session) => session.__env
}));

vi.mock('@mui/material', () => ({
  ThemeProvider: ({ children }) => <>{children}</>
}));

vi.mock('mobx-react', () => ({
  observer: (component) => component
}));

import EmbeddedJBrowseWithDrawer from '../EmbeddedJBrowseWithDrawer.jsx';

function createViewState({ visibleWidget = null, hideWidget = vi.fn() } = {}) {
  const ViewComponent = vi.fn(({ model }) => (
    <div data-testid="linear-view">{model.id}</div>
  ));
  const WidgetComponent = vi.fn(({ model, overrideDimensions }) => (
    <div
      data-testid="drawer-widget"
      data-widget-id={model.id}
      data-width={overrideDimensions.width}
    />
  ));
  const pluginManager = {
    getViewType: vi.fn(() => ({ ReactComponent: ViewComponent })),
    getWidgetType: vi.fn(() => ({
      ReactComponent: WidgetComponent,
      heading: 'Lorax metadata'
    })),
    evaluateExtensionPoint: vi.fn((_name, component) => component)
  };
  const session = {
    __env: { pluginManager },
    drawerWidth: 420,
    hideWidget,
    view: { id: 'view-1', type: 'LinearGenomeView' },
    visibleWidget
  };
  return {
    pluginManager,
    session,
    viewState: {
      config: { configuration: {} },
      session
    }
  };
}

describe('EmbeddedJBrowseWithDrawer', () => {
  it('renders only the embedded genome view when no widget is visible', () => {
    const { viewState } = createViewState();

    render(<EmbeddedJBrowseWithDrawer viewState={viewState} />);

    expect(screen.getByTestId('embedded-view-container')).toBeInTheDocument();
    expect(screen.getByTestId('linear-view')).toHaveTextContent('view-1');
    expect(screen.queryByTestId('jbrowse-widget-drawer')).not.toBeInTheDocument();
  });

  it('renders a visible widget in a side drawer', () => {
    const { viewState, pluginManager } = createViewState({
      visibleWidget: { id: 'loraxMetadata', type: 'LoraxMetadataWidget' }
    });

    render(<EmbeddedJBrowseWithDrawer viewState={viewState} />);

    expect(screen.getByTestId('jbrowse-widget-drawer')).toBeInTheDocument();
    expect(screen.getByText('Lorax metadata')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-widget')).toHaveAttribute(
      'data-widget-id',
      'loraxMetadata'
    );
    expect(screen.getByTestId('drawer-widget')).toHaveAttribute('data-width', '420');
    expect(pluginManager.getWidgetType).toHaveBeenCalledWith('LoraxMetadataWidget');
  });

  it('hides the active widget when the drawer close button is clicked', async () => {
    const hideWidget = vi.fn();
    const widget = { id: 'loraxMetadata', type: 'LoraxMetadataWidget' };
    const { viewState } = createViewState({
      visibleWidget: widget,
      hideWidget
    });

    render(<EmbeddedJBrowseWithDrawer viewState={viewState} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close widget' }));

    expect(hideWidget).toHaveBeenCalledWith(widget);
  });
});
