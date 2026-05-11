/** Short documentation articles for library-driven viewer demos. */
export const useCaseArticles = {
  "lactase-persistence": {
    title: "Lactase persistence",
    eyebrow: "Use case",
    summary:
      "Walk through the lactase persistence locus on human chromosome 2 using the 1000 Genomes ARG, with presets that highlight population labels at the selected site.",
    paragraphs: [
      "Lactase persistence—the continued digestion of milk sugar in adulthood—shows one of the clearest genome-wide signals of recent selection in humans. The regulatory region near the LCT gene on chromosome 2 carries alleles that differ strongly across populations, so local trees around that locus are a practical place to compare haplotype structure and coalescent depth.",
      "This Lorax use case loads the compressed tree sequence `1kg_chr2.trees.tsz` from the Inferred Project Library and applies the `lactase_persistence` feature preset. The viewer recenters near ~136.6 Mb (preset coordinates from the library), opens the metadata panel, and colors tips using the preset’s sample metadata so you can relate branch structure to population labels.",
      "Use the genomic navigator and metadata filters as you would on any other dataset; the preset is only a starting point—you can clear it or switch features from the info panel."
    ],
    dataset: "1000 Genomes — `1kg_chr2.trees.tsz` (chr2 tskit tree sequence).",
    viewerTo: "/view/1kg_chr2.trees.tsz?presetfeature=lactase_persistence"
  },
  heliconius: {
    title: "Heliconius butterfly",
    eyebrow: "Use case",
    summary:
      "Inspect lineage structure around the chromosome 2 inversion in Heliconius using CSV-backed local trees and sample-aware coloring.",
    paragraphs: [
      "Heliconius butterflies are a classic system for studying adaptive introgression and chromosomal inversions. On chromosome 2, an inversion separates haplotypes that carry distinct ancestry; local genealogies in and around the inversion highlight elevated relatedness among samples that share inversion backgrounds compared with flanking sequence.",
      "Here Lorax loads `erato-sara_chr2.csv` from the Heliconius project in the library. Each row is a recombination interval with a Newick string. The `Heliconius_erato_sara_hdem_chr2` preset focuses the view on the inversion-associated interval, enables lineage display, and applies named population / lineage colors so branch structure is easier to read against biological groupings.",
      "Because the input is CSV, time in the layout follows branch lengths in the Newick strings unless you provide an optional `max_branch_length` column—see the Supported Input Files section of the main documentation for the full schema."
    ],
    dataset: "Heliconius — `erato-sara_chr2.csv` (Newick-per-row CSV).",
    viewerTo: "/view/erato-sara_chr2.csv?presetfeature=Heliconius_erato_sara_hdem_chr2"
  }
};

export function getUseCaseArticle(slug) {
  return useCaseArticles[slug] ?? null;
}
