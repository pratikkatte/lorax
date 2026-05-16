import { metadataFeatureConfig } from './metadataFeatureConfig.js';
import { storeBlobLocation } from '@jbrowse/core/util/tracks';

export const DEFAULT_JBROWSE_ASSEMBLY = 'hg19';

export const JBROWSE_ASSEMBLIES = {
  hg19: {
    name: 'hg19',
    aliases: ['GRCh37'],
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'hg19-ref',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
          locationType: 'UriLocation'
        },
        faiLocation: {
          uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
          locationType: 'UriLocation'
        },
        gziLocation: {
          uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
          locationType: 'UriLocation'
        }
      }
    },
    refNameAliases: {
      adapter: {
        type: 'RefNameAliasAdapter',
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
          locationType: 'UriLocation'
        }
      }
    }
  },
  hg38: {
    name: 'hg38',
    aliases: ['GRCh38'],
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'hg38-ref',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
          locationType: 'UriLocation'
        },
        faiLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
          locationType: 'UriLocation'
        },
        gziLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
          locationType: 'UriLocation'
        }
      }
    },
    refNameAliases: {
      adapter: {
        type: 'RefNameAliasAdapter',
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
          locationType: 'UriLocation'
        }
      }
    }
  },
  mm10: {
    name: 'mm10',
    aliases: ['GRCm38'],
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'mm10-ref',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://jbrowse.org/genomes/GRCm38/fasta/mm10.fa.gz',
          locationType: 'UriLocation'
        },
        faiLocation: {
          uri: 'https://jbrowse.org/genomes/GRCm38/fasta/mm10.fa.gz.fai',
          locationType: 'UriLocation'
        },
        gziLocation: {
          uri: 'https://jbrowse.org/genomes/GRCm38/fasta/mm10.fa.gz.gzi',
          locationType: 'UriLocation'
        }
      }
    }
  }
};

const PROJECT_ASSEMBLY_DEFAULTS = {
  '1000Genomes': 'hg19'
};

const DEFAULT_WINDOW_END = 100000;

function finiteInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeJBrowseAssemblyName(assembly, project) {
  const candidate = assembly || PROJECT_ASSEMBLY_DEFAULTS[project] || DEFAULT_JBROWSE_ASSEMBLY;
  return JBROWSE_ASSEMBLIES[candidate] ? candidate : DEFAULT_JBROWSE_ASSEMBLY;
}

export function resolveJBrowseAssemblyName(assembly, project, { allowCustom = false } = {}) {
  const candidate = assembly || PROJECT_ASSEMBLY_DEFAULTS[project];
  if (!candidate) return null;
  if (allowCustom) return candidate;
  return JBROWSE_ASSEMBLIES[candidate] ? candidate : DEFAULT_JBROWSE_ASSEMBLY;
}

export function getJBrowseAssembly(assembly, project) {
  return JBROWSE_ASSEMBLIES[normalizeJBrowseAssemblyName(assembly, project)];
}

function uriLocation(uri) {
  return {
    uri,
    locationType: 'UriLocation'
  };
}

function basenameFromLocation(location) {
  if (!location) return '';
  if (typeof location === 'string') {
    const path = location.split(/[?#]/)[0];
    return decodeURIComponent(path.split('/').filter(Boolean).pop() || path);
  }
  return location.name || location.uri || '';
}

function inferAssemblyName(name, fastaLocation) {
  const source = String(name || basenameFromLocation(fastaLocation) || 'custom-assembly');
  const withoutExtensions = source
    .replace(/\.fa(sta)?\.gz$/i, '')
    .replace(/\.fa(sta)?$/i, '')
    .replace(/\.fna(\.gz)?$/i, '')
    .replace(/\.gz$/i, '');
  const safe = withoutExtensions.replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'custom-assembly';
}

function normalizeFileLocation(location) {
  if (!location) return null;
  if (typeof location === 'string') {
    const trimmed = location.trim();
    return trimmed ? uriLocation(trimmed) : null;
  }
  if (typeof File !== 'undefined' && location instanceof File) {
    return storeBlobLocation({ blob: location });
  }
  return location;
}

export function buildCustomJBrowseAssembly({
  name,
  fastaUri,
  faiUri,
  gziUri,
  fastaLocation: rawFastaLocation,
  faiLocation: rawFaiLocation,
  gziLocation: rawGziLocation
} = {}) {
  const fastaLocation = normalizeFileLocation(rawFastaLocation || fastaUri);
  const faiLocation = normalizeFileLocation(rawFaiLocation || faiUri);
  const gziLocation = normalizeFileLocation(rawGziLocation || gziUri);
  const assemblyName = inferAssemblyName(name, rawFastaLocation || fastaUri || fastaLocation);
  if (!fastaLocation) return null;

  const adapter = faiLocation && gziLocation
    ? {
        type: 'BgzipFastaAdapter',
        fastaLocation,
        faiLocation,
        gziLocation
      }
    : faiLocation
      ? {
          type: 'IndexedFastaAdapter',
          fastaLocation,
          faiLocation
        }
      : {
          type: 'UnindexedFastaAdapter',
          fastaLocation
        };

  return {
    name: assemblyName,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${assemblyName}-ref`,
      adapter
    }
  };
}

export function inferChromosomeFromFilename(file) {
  const name = String(file || '');
  const match = name.match(/(?:^|[^a-z0-9])chr(?:om(?:osome)?)?([0-9]+|x|y|m|mt)(?=[^a-z0-9]|$)/i);
  if (!match) return 'chr1';
  const suffix = match[1].toLowerCase() === 'mt' ? 'M' : match[1].toUpperCase();
  return `chr${suffix}`;
}

export function formatJBrowseLocation(refName, start, end) {
  const safeStart = Math.max(1, finiteInteger(start) ?? 1);
  const safeEnd = Math.max(safeStart, finiteInteger(end) ?? DEFAULT_WINDOW_END);
  return `${refName}:${safeStart}..${safeEnd}`;
}

export function getDefaultJBrowseLocation({
  project,
  file,
  genomiccoordstart,
  genomiccoordend
} = {}) {
  const refName = inferChromosomeFromFilename(file);
  const start = finiteInteger(genomiccoordstart);
  const end = finiteInteger(genomiccoordend);
  if (start !== null && end !== null && end >= start) {
    return formatJBrowseLocation(refName, start, end);
  }

  const preset = metadataFeatureConfig.find(
    feature => feature?.project === project &&
      feature?.filename === file &&
      Array.isArray(feature?.genomicCoords) &&
      feature.genomicCoords.length === 2
  );
  if (preset) {
    return formatJBrowseLocation(refName, preset.genomicCoords[0], preset.genomicCoords[1]);
  }

  return formatJBrowseLocation(refName, 1, DEFAULT_WINDOW_END);
}

export function buildJBrowseRoute({
  project,
  file,
  assembly,
  genomiccoordstart,
  genomiccoordend,
  sid
} = {}) {
  if (!file) return '/';

  const params = new URLSearchParams();
  if (project) params.set('project', project);
  const routeAssembly = resolveJBrowseAssemblyName(assembly, project);
  if (routeAssembly) params.set('assembly', routeAssembly);
  if (genomiccoordstart !== undefined && genomiccoordstart !== null) {
    params.set('genomiccoordstart', String(genomiccoordstart));
  }
  if (genomiccoordend !== undefined && genomiccoordend !== null) {
    params.set('genomiccoordend', String(genomiccoordend));
  }
  if (sid) params.set('sid', sid);

  return `/jbrowse/${encodeURIComponent(file)}?${params.toString()}`;
}

export function buildLoraxJBrowseTrack({
  project,
  file,
  assembly,
  apiBase,
  loraxSid,
  shareSid,
  isProd = false
} = {}) {
  const assemblyName = resolveJBrowseAssemblyName(assembly, project, { allowCustom: true }) ||
    normalizeJBrowseAssemblyName(assembly, project);
  const safeName = String(file || 'lorax').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const trackId = `lorax_${safeName}`;
  const adapter = {
    type: 'LoraxAdapter',
    apiBase,
    project,
    file,
    isProd,
    ...(loraxSid ? { loraxSid } : {}),
    ...(shareSid ? { shareSid } : {})
  };

  return {
    type: 'LoraxTrack',
    trackId,
    name: file || 'Lorax',
    assemblyNames: [assemblyName],
    category: ['ARGs'],
    adapter,
    displays: [
      {
        type: 'LoraxDisplay',
        displayId: `${trackId}-LoraxDisplay`
      }
    ]
  };
}

export function buildJBrowseDefaultSession(trackId) {
  return {
    name: 'Lorax JBrowse',
    view: {
      id: 'lorax-linear-genome-view',
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'LoraxTrack',
          configuration: trackId,
          displays: [
            {
              type: 'LoraxDisplay',
              configuration: `${trackId}-LoraxDisplay`
            }
          ]
        }
      ]
    }
  };
}
