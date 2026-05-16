import { describe, expect, it } from 'vitest';
import {
  buildCustomJBrowseAssembly,
  buildJBrowseRoute,
  buildLoraxJBrowseTrack,
  getDefaultJBrowseLocation,
  inferChromosomeFromFilename,
  normalizeJBrowseAssemblyName
} from '../jbrowseConfig.js';

describe('jbrowseConfig helpers', () => {
  it('builds the JBrowse route for 1000Genomes chr2', () => {
    expect(buildJBrowseRoute({
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz'
    })).toBe('/jbrowse/1kg_chr2.trees.tsz?project=1000Genomes&assembly=hg19');
  });

  it('does not add the default assembly to other projects', () => {
    expect(buildJBrowseRoute({
      project: 'demo',
      file: 'example_chr2.trees.tsz'
    })).toBe('/jbrowse/example_chr2.trees.tsz?project=demo');
  });

  it('infers chromosome names from supported filenames', () => {
    expect(inferChromosomeFromFilename('1kg_chr2.trees.tsz')).toBe('chr2');
    expect(inferChromosomeFromFilename('cohort_chrX.trees')).toBe('chrX');
    expect(inferChromosomeFromFilename('unknown.trees')).toBe('chr1');
  });

  it('uses URL coordinates before preset defaults', () => {
    expect(getDefaultJBrowseLocation({
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz',
      genomiccoordstart: '10',
      genomiccoordend: '20'
    })).toBe('chr2:10..20');
  });

  it('uses known feature presets as default locations', () => {
    expect(getDefaultJBrowseLocation({
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz'
    })).toBe('chr2:136608644..136608651');
  });

  it('falls back to hg19 for unknown assembly names', () => {
    expect(normalizeJBrowseAssemblyName('not-real', '1000Genomes')).toBe('hg19');
  });

  it('builds a custom bgzip FASTA assembly from URLs', () => {
    expect(buildCustomJBrowseAssembly({
      fastaUri: 'https://example.org/hel.fa.gz',
      faiUri: 'https://example.org/hel.fa.gz.fai',
      gziUri: 'https://example.org/hel.fa.gz.gzi'
    })).toMatchObject({
      name: 'hel',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'hel-ref',
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
  });

  it('builds a custom bgzip FASTA assembly from uploaded files', () => {
    const assembly = buildCustomJBrowseAssembly({
      fastaLocation: new File(['>chr2\nACGT'], 'hel.fa.gz', { type: 'application/gzip' }),
      faiLocation: new File(['chr2\t4\t6\t4\t5'], 'hel.fa.gz.fai', { type: 'text/plain' }),
      gziLocation: new File(['index'], 'hel.fa.gz.gzi', { type: 'application/octet-stream' })
    });

    expect(assembly.name).toBe('hel');
    expect(assembly.sequence.adapter).toMatchObject({
      type: 'BgzipFastaAdapter',
      fastaLocation: {
        locationType: 'BlobLocation',
        name: 'hel.fa.gz'
      },
      faiLocation: {
        locationType: 'BlobLocation',
        name: 'hel.fa.gz.fai'
      },
      gziLocation: {
        locationType: 'BlobLocation',
        name: 'hel.fa.gz.gzi'
      }
    });
  });

  it('builds a Lorax track with session sharing fields', () => {
    const track = buildLoraxJBrowseTrack({
      project: '1000Genomes',
      file: '1kg_chr2.trees.tsz',
      assembly: 'hg19',
      apiBase: '/api',
      loraxSid: 'sid-1',
      shareSid: 'share-1',
      isProd: true
    });

    expect(track).toMatchObject({
      type: 'LoraxTrack',
      trackId: 'lorax_1kg_chr2.trees.tsz',
      assemblyNames: ['hg19'],
      adapter: {
        type: 'LoraxAdapter',
        apiBase: '/api',
        project: '1000Genomes',
        file: '1kg_chr2.trees.tsz',
        loraxSid: 'sid-1',
        shareSid: 'share-1',
        isProd: true
      }
    });
  });
});
