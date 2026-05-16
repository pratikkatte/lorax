/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMetadataFilter } from './useMetadataFilter.jsx';

describe('useMetadataFilter', () => {
  it('prefers sample as the default metadata key when available', async () => {
    const fetchMetadataArrayForKey = vi.fn();

    const { result } = renderHook(() =>
      useMetadataFilter({
        enabled: true,
        config: {
          metadataKeys: ['region', 'sample', 'name'],
          metadataKeysBySource: {
            individual: ['sample', 'name'],
            node: [],
            population: ['region']
          },
          metadataColors: {},
          setMetadataColors: vi.fn(),
          fetchMetadataArrayForKey,
          isConnected: true,
          tsconfig: { project: 'Heliconius' }
        }
      })
    );

    await waitFor(() => {
      expect(result.current.selectedColorBy).toBe('sample');
    });
    expect(fetchMetadataArrayForKey).toHaveBeenCalledWith('sample');
  });
});
