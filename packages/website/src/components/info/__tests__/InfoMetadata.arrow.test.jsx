import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InfoMetadata from '../InfoMetadata.jsx';

const baseProps = {
  treeDetails: null,
  individualDetails: null,
  tsconfig: {},
  populationDetails: null,
  nodeMutations: null,
  nodeEdges: null,
  selectedTipMetadata: null,
  setHighlightedMutationNode: vi.fn(),
  setHighlightedMutationTreeIndex: vi.fn(),
};

describe('InfoMetadata Arrow sample metadata', () => {
  it('derives sample metadata from Arrow arrays for the selected node', () => {
    const metadataArrays = {
      population: {
        uniqueValues: ['AFR', 'SAS', 'EUR'],
        indices: Uint32Array.from([0, 2]),
        nodeIdToIdx: new Map([[5, 1]])
      },
      empty_value: {
        uniqueValues: [''],
        indices: Uint32Array.from([0]),
        nodeIdToIdx: new Map([[5, 0]])
      }
    };
    const loadedMetadata = new Map([
      ['population', 'pyarrow'],
      ['empty_value', 'pyarrow']
    ]);

    render(
      <InfoMetadata
        {...baseProps}
        nodeDetails={{ id: 5, time: 0, individual: -1, metadata: { name: 'sample-5' } }}
        metadataArrays={metadataArrays}
        loadedMetadata={loadedMetadata}
      />
    );

    expect(screen.getByText('Sample Metadata')).toBeInTheDocument();
    expect(screen.getByText('Population')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
    expect(screen.queryByText('Empty value')).not.toBeInTheDocument();
  });

  it('omits sample metadata card when no Arrow metadata exists for the selected node', () => {
    const metadataArrays = {
      population: {
        uniqueValues: ['AFR'],
        indices: Uint32Array.from([0]),
        nodeIdToIdx: new Map([[5, 0]])
      }
    };
    const loadedMetadata = new Map([['population', 'pyarrow']]);

    render(
      <InfoMetadata
        {...baseProps}
        nodeDetails={{ id: 9, time: 0, individual: -1, metadata: {} }}
        metadataArrays={metadataArrays}
        loadedMetadata={loadedMetadata}
      />
    );

    expect(screen.queryByText('Sample Metadata')).not.toBeInTheDocument();
  });
});
