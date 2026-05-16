import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createViewState: vi.fn((options) => ({ options })),
  LoraxPlugin: class LoraxPlugin {}
}));

vi.mock('@jbrowse/react-linear-genome-view2', () => ({
  createViewState: mocks.createViewState
}));

vi.mock('../EmbeddedJBrowseWithDrawer.jsx', () => ({
  default: ({ viewState }) => (
    <div data-testid="jbrowse-view" data-location={viewState.options.location} />
  )
}));

vi.mock('@jbrowse/core/ui', () => ({
  Logomark: () => <svg data-testid="mock-jbrowse-logo" aria-hidden="true" />
}));

vi.mock('jbrowse-plugin-lorax', () => ({
  default: mocks.LoraxPlugin
}));

vi.mock('@lorax/core', () => ({
  useLorax: () => ({
    loraxSid: 'sid-1'
  })
}));

import JBrowseFileView from '../JBrowseFileView.jsx';

describe('JBrowseFileView', () => {
  beforeEach(() => {
    mocks.createViewState.mockClear();
  });

  it('creates an embedded JBrowse view with hg19, chr2, LoraxPlugin, and LoraxTrack', () => {
    render(
      <MemoryRouter initialEntries={['/jbrowse/1kg_chr2.trees.tsz?project=1000Genomes']}>
        <Routes>
          <Route path="/jbrowse/:file" element={<JBrowseFileView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('jbrowse-view')).toHaveAttribute(
      'data-location',
      'chr2:136608644..136608651'
    );
    expect(screen.getByTestId('jbrowse-header-logo')).toBeInTheDocument();
    expect(screen.getByText('1000Genomes')).toBeInTheDocument();
    expect(screen.queryByText(/1000Genomes · hg19/i)).not.toBeInTheDocument();
    expect(mocks.createViewState).toHaveBeenCalledTimes(1);

    const options = mocks.createViewState.mock.calls[0][0];
    expect(options.assembly.name).toBe('hg19');
    expect(options.plugins).toEqual([mocks.LoraxPlugin]);
    expect(options.location).toBe('chr2:136608644..136608651');
    expect(options.tracks[0]).toMatchObject({
      type: 'LoraxTrack',
      name: '1kg_chr2.trees.tsz',
      assemblyNames: ['hg19'],
      adapter: {
        type: 'LoraxAdapter',
        project: '1000Genomes',
        file: '1kg_chr2.trees.tsz',
        loraxSid: 'sid-1'
      }
    });
    expect(options.defaultSession.view.tracks[0]).toMatchObject({
      type: 'LoraxTrack',
      configuration: options.tracks[0].trackId
    });
  });

  it('asks for an assembly when the project has no configured assembly', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/jbrowse/erato-sara_chr2.csv?project=Heliconius&genomiccoordstart=10790402&genomiccoordend=10814152']}>
        <Routes>
          <Route path="/jbrowse/:file" element={<JBrowseFileView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('jbrowse-view')).not.toBeInTheDocument();
    expect(mocks.createViewState).not.toHaveBeenCalled();
    expect(screen.getByTestId('jbrowse-header-logo')).toBeInTheDocument();
    expect(screen.getByText('Heliconius')).toBeInTheDocument();
    expect(screen.queryByText(/Heliconius · chr2/i)).not.toBeInTheDocument();

    expect(screen.getByLabelText(/assembly/i)).toHaveValue('hg19');
    expect(screen.getByLabelText(/chromosome/i)).toHaveValue('chr2');

    await user.click(screen.getByRole('button', { name: /open/i }));

    await waitFor(() => expect(mocks.createViewState).toHaveBeenCalledTimes(1));
    const options = mocks.createViewState.mock.calls[0][0];
    expect(options.assembly.name).toBe('hg19');
    expect(options.location).toBe('chr2');
    expect(options.tracks[0].assemblyNames).toEqual(['hg19']);
  });

  it('creates a JBrowse view from a custom assembly URL', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/jbrowse/erato-sara_chr2.csv?project=Heliconius']}>
        <Routes>
          <Route path="/jbrowse/:file" element={<JBrowseFileView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByLabelText(/assembly name/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/assembly/i), 'custom');
    await user.clear(screen.getByLabelText(/fasta url/i));
    await user.type(screen.getByLabelText(/fasta url/i), 'https://example.org/hel.fa.gz');
    await user.clear(screen.getByLabelText(/fai url/i));
    await user.type(screen.getByLabelText(/fai url/i), 'https://example.org/hel.fa.gz.fai');
    await user.clear(screen.getByLabelText(/gzi url/i));
    await user.type(screen.getByLabelText(/gzi url/i), 'https://example.org/hel.fa.gz.gzi');
    await user.click(screen.getByRole('button', { name: /open/i }));

    await waitFor(() => expect(mocks.createViewState).toHaveBeenCalledTimes(1));
    const options = mocks.createViewState.mock.calls[0][0];
    expect(options.assembly).toMatchObject({
      name: 'hel',
      sequence: {
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: {
            uri: 'https://example.org/hel.fa.gz',
            locationType: 'UriLocation'
          },
          faiLocation: {
            uri: 'https://example.org/hel.fa.gz.fai',
            locationType: 'UriLocation'
          },
          gziLocation: {
            uri: 'https://example.org/hel.fa.gz.gzi',
            locationType: 'UriLocation'
          }
        }
      }
    });
    expect(options.tracks[0].assemblyNames).toEqual(['hel']);
  });

  it('offers uploaded custom assembly files', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/jbrowse/erato-sara_chr2.csv?project=Heliconius']}>
        <Routes>
          <Route path="/jbrowse/:file" element={<JBrowseFileView />} />
        </Routes>
      </MemoryRouter>
    );

    await user.selectOptions(screen.getByLabelText(/assembly/i), 'custom');
    await user.click(screen.getByRole('radio', { name: /upload/i }));

    expect(screen.getByLabelText(/fasta file/i)).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText(/fai file/i)).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText(/gzi file/i)).toHaveAttribute('type', 'file');
    expect(screen.queryByLabelText(/fasta url/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/assembly name/i)).not.toBeInTheDocument();
  });
});
