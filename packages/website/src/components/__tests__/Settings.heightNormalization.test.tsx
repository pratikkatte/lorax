/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Settings from '../Settings';

function renderSettings(overrides = {}) {
  const props = {
    setShowSettings: vi.fn(),
    polygonFillColor: [145, 194, 244, 46] as [number, number, number, number],
    setPolygonFillColor: vi.fn(),
    defaultTipColor: [150, 150, 150, 200] as [number, number, number, number],
    setDefaultTipColor: vi.fn(),
    timeScale: 'linear' as const,
    setTimeScale: vi.fn(),
    normalizeTreeHeights: false,
    setNormalizeTreeHeights: vi.fn(),
    heightNormalizationAvailable: false,
    compareInsertionColor: [0, 255, 0, 200] as [number, number, number, number],
    setCompareInsertionColor: vi.fn(),
    compareDeletionColor: [255, 0, 0, 200] as [number, number, number, number],
    setCompareDeletionColor: vi.fn(),
    showCompareInsertion: true,
    setShowCompareInsertion: vi.fn(),
    showCompareDeletion: true,
    setShowCompareDeletion: vi.fn(),
    edgeColor: [100, 100, 100, 255] as [number, number, number, number],
    setEdgeColor: vi.fn(),
    descendantsHighlightColor: [94, 177, 155, 255] as [number, number, number, number],
    setDescendantsHighlightColor: vi.fn(),
    ...overrides,
  };

  render(<Settings {...props} />);
  return props;
}

describe('Settings height normalization', () => {
  it('shows a disabled control for non-Phlag datasets', () => {
    renderSettings();

    expect(screen.getByRole('switch', { name: 'Height normalization' })).toBeDisabled();
    expect(screen.getByText('Available for Phlag datasets.')).toBeInTheDocument();
  });

  it('lets Phlag users enable normalization', async () => {
    const user = userEvent.setup();
    const props = renderSettings({ heightNormalizationAvailable: true });
    const toggle = screen.getByRole('switch', { name: 'Height normalization' });

    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);

    expect(props.setNormalizeTreeHeights).toHaveBeenCalledWith(true);
  });
});
