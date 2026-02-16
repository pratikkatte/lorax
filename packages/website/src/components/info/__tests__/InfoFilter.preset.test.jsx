import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import InfoFilter from '../InfoFilter.jsx';
import { LoraxTestProvider } from '@lorax/core';
import { metadataFeatureConfig } from '../../../config/metadataFeatureConfig';

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
const TEST_FEATURE = metadataFeatureConfig.find(
  (feature) =>
    feature?.project === TEST_CONFIG.project &&
    feature?.filename === TEST_CONFIG.filename
);
const ACTION_FEATURE = metadataFeatureConfig.find(
  (feature) => Array.isArray(feature?.actions) && feature.actions.length > 0
);

const hexToRgba = (hex) => {
  const normalized = String(hex || '').replace('#', '');
  if (!/^[a-fA-F0-9]{6}$/.test(normalized)) return null;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
    255
  ];
};

const createDeferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
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
    const [compareMode, setCompareMode] = React.useState(false);

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
      compareMode,
      setCompareMode,
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
    if (!TEST_FEATURE) {
      throw new Error('Missing 1000Genomes feature preset in metadataFeatureConfig');
    }

    const loadedMetadata = new Map([[TEST_FEATURE.metadata.key, 'pyarrow']]);
    const { onNavigateToCoords } = renderWithLorax({
      initialEntries: [`/file?presetfeature=${TEST_FEATURE.id}`],
      loraxOverrides: { loadedMetadata },
    });

    await waitFor(() => {
      expect(screen.getByTestId('selectedColorBy')).toHaveTextContent(TEST_FEATURE.metadata.key);
    });

    const values = TEST_FEATURE.metadata.values.map(String);
    const firstValue = values[0];
    const parsedColors = JSON.parse(screen.getByTestId('metadataColors').textContent || '{}');
    expect(screen.getByTestId('searchTags')).toHaveTextContent(values.join(','));
    expect(screen.getByTestId('enabledValues')).toHaveTextContent([...values].sort().join(','));
    expect(parsedColors?.[TEST_FEATURE.metadata.key]?.[firstValue]).toEqual(
      hexToRgba(TEST_FEATURE.metadata.colors[firstValue])
    );
    expect(onNavigateToCoords).toHaveBeenCalledWith(TEST_FEATURE.genomicCoords);
  });

  it('enables preset from toggle and updates URL', async () => {
    if (!TEST_FEATURE) {
      throw new Error('Missing 1000Genomes feature preset in metadataFeatureConfig');
    }

    const loadedMetadata = new Map([[TEST_FEATURE.metadata.key, 'pyarrow']]);
    const { user } = renderWithLorax({
      initialEntries: ['/file'],
      loraxOverrides: { loadedMetadata },
    });

    const enableButton = await screen.findByTitle('Enable preset');
    await user.click(enableButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent(
        `presetfeature=${TEST_FEATURE.id}`
      );
    });
    expect(screen.getByTestId('selectedColorBy')).toHaveTextContent(TEST_FEATURE.metadata.key);
    expect(screen.getByTestId('searchTags')).toHaveTextContent(
      TEST_FEATURE.metadata.values.map(String).join(',')
    );
  });

  it('disables preset, clears URL, and resets filter state', async () => {
    if (!TEST_FEATURE) {
      throw new Error('Missing 1000Genomes feature preset in metadataFeatureConfig');
    }

    const loadedMetadata = new Map([[TEST_FEATURE.metadata.key, 'pyarrow']]);
    const metadataColors = {
      [TEST_FEATURE.metadata.key]: {
        GBR: [24, 185, 56, 255],
        CHS: [216, 14, 14, 255],
        FIN: [120, 120, 120, 255],
      },
    };
    const { user } = renderWithLorax({
      initialEntries: [`/file?presetfeature=${TEST_FEATURE.id}`],
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

  it('calls onBeforePresetApply when applying preset', async () => {
    if (!TEST_FEATURE) {
      throw new Error('Missing 1000Genomes feature preset in metadataFeatureConfig');
    }

    const loadedMetadata = new Map([[TEST_FEATURE.metadata.key, 'pyarrow']]);
    const onBeforePresetApply = vi.fn();
    const { user } = renderWithLorax({
      initialEntries: ['/file'],
      loraxOverrides: { loadedMetadata },
      propsOverrides: { onBeforePresetApply },
    });

    const enableButton = await screen.findByTitle('Enable preset');
    await user.click(enableButton);

    await waitFor(() => {
      expect(onBeforePresetApply).toHaveBeenCalled();
    });
  });

  it('waits for navigation before firing preset actions', async () => {
    if (!ACTION_FEATURE) {
      throw new Error('Missing action feature preset in metadataFeatureConfig');
    }

    const loadedMetadata = new Map([[ACTION_FEATURE.metadata.key, 'pyarrow']]);
    const deferred = createDeferred();
    const onNavigateToCoords = vi.fn(() => deferred.promise);
    const onPresetAction = vi.fn();
    const { user } = renderWithLorax({
      initialEntries: ['/file'],
      loraxOverrides: {
        loadedMetadata,
        tsconfig: {
          project: ACTION_FEATURE.project,
          filename: ACTION_FEATURE.filename
        }
      },
      propsOverrides: { onNavigateToCoords, onPresetAction }
    });

    const enableButton = await screen.findByTitle('Enable preset');
    await user.click(enableButton);

    expect(onNavigateToCoords).toHaveBeenCalledWith(ACTION_FEATURE.genomicCoords);
    expect(onPresetAction).not.toHaveBeenCalled();

    deferred.resolve();

    await waitFor(() => {
      expect(onPresetAction).toHaveBeenCalledWith(
        ACTION_FEATURE.actions,
        expect.objectContaining({ id: ACTION_FEATURE.id })
      );
    });
  });
});
