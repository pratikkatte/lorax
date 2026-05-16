import React from 'react';
import { render, screen } from '@testing-library/react';
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

  it('does not create a JBrowse view for projects without a configured assembly', () => {
    render(
      <MemoryRouter initialEntries={['/jbrowse/erato-sara_chr2.csv?project=Heliconius&genomiccoordstart=10790402&genomiccoordend=10814152']}>
        <Routes>
          <Route path="/jbrowse/:file" element={<JBrowseFileView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('jbrowse-view')).not.toBeInTheDocument();
    expect(screen.getByText(/no jbrowse assembly is configured/i)).toBeInTheDocument();
    expect(mocks.createViewState).not.toHaveBeenCalled();
  });
});
