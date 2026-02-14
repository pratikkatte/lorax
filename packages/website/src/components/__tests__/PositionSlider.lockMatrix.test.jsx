/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let compareModeState = false;
let setCompareModeMock = vi.fn();

vi.mock('@lorax/core', () => ({
  useLorax: () => ({
    compareMode: compareModeState,
    setCompareMode: setCompareModeMock
  })
}));

import PositionSlider from '../PositionSlider.jsx';

describe('PositionSlider lock view toggle', () => {
  beforeEach(() => {
    compareModeState = false;
    setCompareModeMock = vi.fn();
  });

  it('renders lock switch defaulted off and toggles on click', async () => {
    const user = userEvent.setup();
    const setLockModelMatrix = vi.fn();

    render(
      <MemoryRouter>
        <PositionSlider
          filename="test.trees"
          genomeLength={1000}
          value={[0, 100]}
          onChange={vi.fn()}
          onResetY={vi.fn()}
          project={null}
          tsconfig={{}}
          lockModelMatrix={false}
          setLockModelMatrix={setLockModelMatrix}
        />
      </MemoryRouter>
    );

    const lockSwitch = screen.getByRole('switch', { name: /lock view/i });
    expect(lockSwitch).toHaveAttribute('aria-checked', 'false');

    await user.click(lockSwitch);
    expect(setLockModelMatrix).toHaveBeenCalledWith(true);
    expect(
      screen.getByText(/Lock view enabled: zoom changes will not fetch trees/i)
    ).toBeInTheDocument();
  });
});
