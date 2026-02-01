import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import InfoFilter from '../InfoFilter.jsx';
import { LoraxTestProvider } from '@lorax/core';

vi.mock('@lorax/core', async () => {
  const React = await import('react');
  const LoraxTestContext = React.createContext(null);
  const useLorax = () => React.useContext(LoraxTestContext);
  const LoraxTestProvider = ({ value, children }) =>
    React.createElement(LoraxTestContext.Provider, { value }, children);
  return { useLorax, LoraxTestProvider };
});

const TEST_CONFIG = {
  project: '1000Genomes',
  filename: '1kg_chr2.trees.tsz',
};

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const renderWithLorax = ({
  initialEntries = ['/file'],
  loraxOverrides = {},
  propsOverrides = {},
} = {}) => {
  const onNavigateToCoords = vi.fn();

  const TestHarness = () => {
    const [selectedColorBy, setSelectedColorBy] = React.useState(
      loraxOverrides.selectedColorBy ?? null
    );
    const [searchTags, setSearchTags] = React.useState(
      loraxOverrides.searchTags ?? []
    );
    const [enabledValues, setEnabledValues] = React.useState(
      loraxOverrides.enabledValues ?? new Set()
    );
    const [metadataColors, setMetadataColors] = React.useState(
      loraxOverrides.metadataColors ?? {}
    );
    const [displayLineagePaths, setDisplayLineagePaths] = React.useState(false);

    const value = {
      tsconfig: loraxOverrides.tsconfig ?? TEST_CONFIG,
      selectedColorBy,
      setSelectedColorBy,
      searchTags,
      setSearchTags,
      enabledValues,
      setEnabledValues,
      metadataColors,
      setMetadataColors,
      loadedMetadata: loraxOverrides.loadedMetadata ?? new Map(),
      displayLineagePaths,
      setDisplayLineagePaths,
      searchTerm: '',
      setSearchTerm: vi.fn(),
      highlightedMetadataValue: null,
      setHighlightedMetadataValue: vi.fn(),
      coloryby: loraxOverrides.coloryby ?? { name: 'Population' },
    };

    return (
      <LoraxTestProvider value={value}>
        <MemoryRouter initialEntries={initialEntries}>
          <InfoFilter onNavigateToCoords={onNavigateToCoords} {...propsOverrides} />
          <LocationDisplay />
          <div data-testid="selectedColorBy">{selectedColorBy || ''}</div>
          <div data-testid="searchTags">{searchTags.join(',')}</div>
          <div data-testid="enabledValues">
            {Array.from(enabledValues).sort().join(',')}
          </div>
          <div data-testid="metadataColors">{JSON.stringify(metadataColors)}</div>
        </MemoryRouter>
      </LoraxTestProvider>
    );
  };

  return {
    user: userEvent.setup(),
    onNavigateToCoords,
    ...render(<TestHarness />),
  };
};

describe('InfoFilter presetFeature', () => {
  it('applies preset from URL (select key, values, colors, coords)', async () => {
    const loadedMetadata = new Map([['name', 'pyarrow']]);
    const { onNavigateToCoords } = renderWithLorax({
      initialEntries: ['/file?presetfeature=1000Genomes_chr2'],
      loraxOverrides: { loadedMetadata },
    });

    await waitFor(() => {
      expect(screen.getByTestId('selectedColorBy')).toHaveTextContent('name');
    });

    expect(screen.getByTestId('searchTags')).toHaveTextContent('GBR,CHS');
    expect(screen.getByTestId('enabledValues')).toHaveTextContent('CHS,GBR');
    expect(screen.getByTestId('metadataColors')).toHaveTextContent(
      '"GBR":[24,185,56,255]'
    );
    expect(onNavigateToCoords).toHaveBeenCalledWith([136608644, 136608651]);
  });

  it('enables preset from toggle and updates URL', async () => {
    const loadedMetadata = new Map([['name', 'pyarrow']]);
    const { user } = renderWithLorax({
      initialEntries: ['/file'],
      loraxOverrides: { loadedMetadata },
    });

    const enableButton = await screen.findByTitle('Enable preset');
    await user.click(enableButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent(
        'presetfeature=1000Genomes_chr2'
      );
    });
    expect(screen.getByTestId('selectedColorBy')).toHaveTextContent('name');
    expect(screen.getByTestId('searchTags')).toHaveTextContent('GBR,CHS');
  });

  it('disables preset, clears URL, and resets filter state', async () => {
    const loadedMetadata = new Map([['name', 'pyarrow']]);
    const metadataColors = {
      name: {
        GBR: [24, 185, 56, 255],
        CHS: [216, 14, 14, 255],
        FIN: [120, 120, 120, 255],
      },
    };
    const { user } = renderWithLorax({
      initialEntries: ['/file?presetfeature=1000Genomes_chr2'],
      loraxOverrides: { loadedMetadata, metadataColors },
    });

    const disableButton = await screen.findByTitle('Disable preset');
    await user.click(disableButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toBe('');
    });
    expect(screen.getByTestId('searchTags').textContent).toBe('');
    expect(screen.getByTestId('enabledValues')).toHaveTextContent(
      'CHS,FIN,GBR'
    );
  });
});
