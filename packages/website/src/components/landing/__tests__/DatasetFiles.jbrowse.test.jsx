import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DatasetFiles from '../DatasetFiles.jsx';

describe('DatasetFiles JBrowse actions', () => {
  it('keeps the Lorax open action and adds a JBrowse route', async () => {
    const loadFile = vi.fn();
    const setLoadingFile = vi.fn();

    render(
      <MemoryRouter>
        <DatasetFiles
          project="1000Genomes"
          files={['1kg_chr2.trees.tsz']}
          loadFile={loadFile}
          loadingFile={null}
          setLoadingFile={setLoadingFile}
        />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /1kg_chr2\.trees\.tsz/i }));

    expect(setLoadingFile).toHaveBeenCalledWith('1kg_chr2.trees.tsz');
    expect(loadFile).toHaveBeenCalledWith({
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz'
    });
    expect(screen.getByRole('link', { name: /jbrowse/i })).toHaveAttribute(
      'href',
      '/jbrowse/1kg_chr2.trees.tsz?project=1000Genomes&assembly=hg19'
    );
  });
});
