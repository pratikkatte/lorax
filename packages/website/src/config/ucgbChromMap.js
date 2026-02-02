const ucgbChromMap = {
  // Example explicit mapping
  '2': '1kg_chr2.trees.tsz',
  '1': '1kg_chr1.trees.tsz',
  '3': '1kg_chr3.trees.tsz',
  '4': '1kg_chr4.trees.tsz',
  '5': '1kg_chr5.trees.tsz',
  '6': '1kg_chr6.trees.tsz',
  '7': '1kg_chr7.trees.tsz',
  '8': '1kg_chr8.trees.tsz',
  '9': '1kg_chr9.trees.tsz',
  '10': '1kg_chr10.trees.tsz',
  '11': '1kg_chr11.trees.tsz',
  '12': '1kg_chr12.trees.tsz',
  '13': '1kg_chr13.trees.tsz',
  '14': '1kg_chr14.trees.tsz',
  '15': '1kg_chr15.trees.tsz',
  '16': '1kg_chr16.trees.tsz',
  '17': '1kg_chr17.trees.tsz',
  '18': '1kg_chr18.trees.tsz',
  '19': '1kg_chr19.trees.tsz',
  '20': '1kg_chr20.trees.tsz',
  '21': '1kg_chr21.trees.tsz',
  '22': '1kg_chr22.trees.tsz',
};

function normalizeChrom(chrom) {
  if (!chrom) return null;
  const trimmed = String(chrom).trim();
  if (!trimmed) return null;
  return trimmed.replace(/^chr/i, '').toUpperCase();
}

export function resolveUcgbFilename(chrom) {
  const key = normalizeChrom(chrom);
  if (!key) return null;
  return ucgbChromMap[key] || `1kg_chr${key}.trees.tsz`;
}

export default ucgbChromMap;
