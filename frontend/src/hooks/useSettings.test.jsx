import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSettings from './useSettings';

describe('useSettings', () => {
  it('returns default settings', () => {
    const { result } = renderHook(() => useSettings());
    
    expect(result.current.settings).toEqual({
      number_of_trees: 10,
      display_lineage_paths: false,
    });
  });

  it('provides setSettings function', () => {
    const { result } = renderHook(() => useSettings());
    
    expect(typeof result.current.setSettings).toBe('function');
  });

  it('updates settings when setSettings is called', () => {
    const { result } = renderHook(() => useSettings());
    
    act(() => {
      result.current.setSettings({
        number_of_trees: 20,
        display_lineage_paths: true,
      });
    });
    
    expect(result.current.settings).toEqual({
      number_of_trees: 20,
      display_lineage_paths: true,
    });
  });

  it('allows partial updates via callback', () => {
    const { result } = renderHook(() => useSettings());
    
    act(() => {
      result.current.setSettings(prev => ({
        ...prev,
        number_of_trees: 50,
      }));
    });
    
    expect(result.current.settings.number_of_trees).toBe(50);
    expect(result.current.settings.display_lineage_paths).toBe(false);
  });

  it('memoizes the return value', () => {
    const { result, rerender } = renderHook(() => useSettings());
    
    const firstResult = result.current;
    rerender();
    const secondResult = result.current;
    
    // Should be the same reference if settings haven't changed
    expect(firstResult).toBe(secondResult);
  });
});


