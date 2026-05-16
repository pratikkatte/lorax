import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DatasetFiles from '../DatasetFiles.jsx';

describe('DatasetFiles JBrowse actions', () => {
  it('shows separate Lorax and JBrowse launch actions with inline icons', async () => {
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

    const loraxButton = screen.getByRole('button', { name: /open 1kg_chr2\.trees\.tsz in lorax/i });
    const jbrowseLink = screen.getByRole('link', { name: /open 1kg_chr2\.trees\.tsz in jbrowse/i });
    const launchActions = screen.getByTestId('file-launch-actions');

    expect(loraxButton).not.toHaveTextContent(/lorax/i);
    expect(jbrowseLink).not.toHaveTextContent(/jbrowse/i);
    expect(launchActions).toContainElement(loraxButton);
    expect(launchActions).toContainElement(jbrowseLink);
    expect(launchActions).toHaveClass('opacity-0');
    expect(launchActions).toHaveClass('absolute');
    expect(launchActions).toHaveClass('group-hover/file:opacity-100');
    expect(launchActions).toHaveClass('group-focus-within/file:opacity-100');

    const loraxIcon = screen.getByTestId('lorax-launch-icon');
    const jbrowseIcon = screen.getByTestId('jbrowse-launch-icon');

    expect(loraxIcon).toHaveAttribute('src', '/logo.png');
    expect(loraxIcon).not.toHaveClass('opacity-0');
    expect(jbrowseIcon).not.toHaveClass('opacity-0');
    expect(loraxButton).toContainElement(loraxIcon);
    expect(jbrowseLink).toContainElement(jbrowseIcon);

    await userEvent.click(loraxButton);

    expect(setLoadingFile).toHaveBeenCalledWith('1kg_chr2.trees.tsz');
    expect(loadFile).toHaveBeenCalledWith({
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz'
    });
    expect(jbrowseLink).toHaveAttribute(
      'href',
      '/jbrowse/1kg_chr2.trees.tsz?project=1000Genomes&assembly=hg19'
    );
  });

  it('hides the JBrowse launch action for Heliconius files', async () => {
    const loadFile = vi.fn();
    const setLoadingFile = vi.fn();

    render(
      <MemoryRouter>
        <DatasetFiles
          project="Heliconius"
          files={['erato-sara_chr2.csv']}
          loadFile={loadFile}
          loadingFile={null}
          setLoadingFile={setLoadingFile}
        />
      </MemoryRouter>
    );

    const loraxButton = screen.getByRole('button', { name: /open erato-sara_chr2\.csv in lorax/i });
    const launchActions = screen.getByTestId('file-launch-actions');

    expect(screen.queryByRole('link', { name: /open erato-sara_chr2\.csv in jbrowse/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('jbrowse-launch-icon')).not.toBeInTheDocument();
    expect(launchActions).toContainElement(loraxButton);

    await userEvent.click(loraxButton);

    expect(setLoadingFile).toHaveBeenCalledWith('erato-sara_chr2.csv');
    expect(loadFile).toHaveBeenCalledWith({
      project: 'Heliconius',
      file: 'erato-sara_chr2.csv'
    });
  });
});
