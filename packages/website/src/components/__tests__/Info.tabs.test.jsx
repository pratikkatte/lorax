/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@lorax/core', () => ({
  useLorax: () => ({
    metadataArrays: {},
    loadedMetadata: null,
    tsconfig: {},
    isConnected: false,
    queryMutationsWindow: vi.fn(),
    searchMutations: vi.fn(),
    genomeLength: 0,
  }),
  useMutations: () => ({
    mutations: [],
    totalCount: 0,
    hasMore: false,
    isLoading: false,
    error: null,
    searchPosition: null,
    searchRange: 5000,
    isSearchMode: false,
    loadMore: vi.fn(),
    triggerSearch: vi.fn(),
    clearSearch: vi.fn(),
    setSearchRange: vi.fn(),
  }),
}));

vi.mock('../info/InfoMetadata', () => ({
  default: () => <div data-testid="info-metadata" />,
}));

vi.mock('../info/InfoMutations', () => ({
  default: () => <div data-testid="info-mutations" />,
}));

vi.mock('../info/InfoFilter', () => ({
  default: () => <div data-testid="info-filter" />,
}));

import Info from '../Info.jsx';

describe('Info tabs', () => {
  it('names the metadata tab Samples and explains sample annotation tools', async () => {
    const user = userEvent.setup();

    render(<Info setShowInfo={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^Samples$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Metadata$/ })).not.toBeInTheDocument();

    await user.hover(screen.getByLabelText('Explain Samples tab'));

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Search, filter, highlight, and color samples or trees using sample annotations',
    );
  });
});
