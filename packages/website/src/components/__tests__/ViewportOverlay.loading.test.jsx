/* @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import ViewportOverlay from '../ViewportOverlay.jsx';

describe('ViewportOverlay loading indicator', () => {
  it('shows tree-fetching overlay only when treeIsLoading is true', () => {
    const baseProps = {
      statusMessage: null,
      filename: 'example.trees',
      viewport: { top: '0%', left: '0%', width: '100%', height: '100%' },
      views: {
        ortho: { y: '6%', height: '80%' },
        genomeInfo: { y: '4%', height: '2%' },
        genomePositions: { y: '1%', height: '3%' },
        treeTime: { y: '6%', height: '80%' }
      },
      resizable: false,
      treeIsLoading: false
    };

    const { rerender } = render(<ViewportOverlay {...baseProps} />);
    expect(screen.queryByText('Fetching trees from backend...')).not.toBeInTheDocument();

    rerender(<ViewportOverlay {...baseProps} treeIsLoading />);
    expect(screen.getByText('Fetching trees from backend...')).toBeInTheDocument();

    // Lock-refresh-only cycles keep treeIsLoading false, so overlay remains hidden.
    rerender(<ViewportOverlay {...baseProps} treeIsLoading={false} />);
    expect(screen.queryByText('Fetching trees from backend...')).not.toBeInTheDocument();
  });
});
