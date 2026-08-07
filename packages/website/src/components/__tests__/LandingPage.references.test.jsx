import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '../LandingPage.jsx';

describe('LandingPage project references', () => {
  it('shows a project’s provenance links after its card is opened', async () => {
    render(
      <MemoryRouter>
        <LandingPage
          upload={{
            projects: {
              'Phlag Avian': {
                display_name: 'Phlag Avian — Stiller et al. (2024)',
                description: 'Avian gene trees from Stiller et al. (2024).',
                files: ['avian.trees'],
                references: [
                  { label: 'Dataset on Zenodo', url: 'https://zenodo.org/records/19713363' },
                  { label: 'Stiller et al. (2024)', url: 'https://www.nature.com/articles/s41586-024-07323-1' },
                ],
              },
            },
            browse: vi.fn(),
            getDropzoneProps: () => ({}),
            getInputProps: () => ({}),
            loadFile: vi.fn(),
            loadingFile: null,
            setLoadingFile: vi.fn(),
          }}
        />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /phlag avian/i }));

    expect(screen.getByRole('link', { name: 'Dataset on Zenodo' })).toHaveAttribute(
      'href',
      'https://zenodo.org/records/19713363'
    );
    expect(screen.getByRole('link', { name: 'Stiller et al. (2024)' })).toHaveAttribute(
      'href',
      'https://www.nature.com/articles/s41586-024-07323-1'
    );
  });
});
