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
      screen.getByText(/Trees are frozen in place/i)
    ).toBeInTheDocument();
  });

  it('disables lock before applying position change when lock is on', async () => {
    const user = userEvent.setup();
    const callOrder = [];
    const setLockModelMatrix = vi.fn(() => callOrder.push('setLock'));
    const onChange = vi.fn(() => callOrder.push('onChange'));

    render(
      <MemoryRouter>
        <PositionSlider
          filename="test.trees"
          genomeLength={1000}
          value={[0, 100]}
          onChange={onChange}
          onResetY={vi.fn()}
          project={null}
          tsconfig={{}}
          lockModelMatrix={true}
          setLockModelMatrix={setLockModelMatrix}
        />
      </MemoryRouter>
    );

    const [startInput, endInput] = screen.getAllByRole('spinbutton');
    await user.clear(startInput);
    await user.type(startInput, '50');
    await user.clear(endInput);
    await user.type(endInput, '200');

    const applyButton = screen.getByTitle('Apply changes');
    await user.click(applyButton);

    expect(setLockModelMatrix).toHaveBeenCalledWith(false);
    expect(onChange).toHaveBeenCalledWith([50, 200]);
    expect(callOrder).toEqual(['setLock', 'onChange']);
  });

  it('disables lock before pan when lock is on', async () => {
    const user = userEvent.setup();
    const setLockModelMatrix = vi.fn();
    const onChange = vi.fn();

    render(
      <MemoryRouter>
        <PositionSlider
          filename="test.trees"
          genomeLength={1000}
          value={[0, 100]}
          onChange={onChange}
          onResetY={vi.fn()}
          project={null}
          tsconfig={{}}
          lockModelMatrix={true}
          setLockModelMatrix={setLockModelMatrix}
        />
      </MemoryRouter>
    );

    const panLeftButton = screen.getByTitle('Pan left');
    await user.click(panLeftButton);

    expect(setLockModelMatrix).toHaveBeenCalledWith(false);
    expect(onChange).toHaveBeenCalled();
    expect(setLockModelMatrix.mock.invocationCallOrder[0]).toBeLessThan(
      onChange.mock.invocationCallOrder[0]
    );
  });
});
