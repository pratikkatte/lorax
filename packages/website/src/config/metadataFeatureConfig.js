// Metadata feature presets for InfoFilter.
// Keep IDs unique and matches exact project + filename.
export const metadataFeatureConfig = [
  {
    id: "Heliconius_erato_sara_hdem_chr2",
    description: "inversions on chr2",
    label: "inversions on chr2",
    project: "Heliconius",
    filename: "erato-sara_chr2.csv",
    genomicCoords: [8790771, 16465129],
    actions: ["adjustView"],
    metadata: {
      key: "sample",
      values: ["Hsar", "Hhsa", "Hhim", "Hdem", "Htel", "HeraRef"],
      colors: {
        Hsar: "#18b938",
        Hhsa: "#d80e0e",
        Hhim: "#c20a0a",
        Hdem: "#33993a",
        Htel: "#08d92b",
        HeraRef: "#dd2727"
      }
    },
    displayLineage: true
  },
  {
    id: "lactase_persistence",
    label: "Lactase Persistence",
    description: "Genomic locus associated with lactase persistence in humans.",
    project: "1000Genomes",
    filename: "1kg_chr2.trees.tsz",
    genomicCoords: [136608644, 136608651],
    metadata: {
      key: "name",
      values: [ "GBR", "CHS"],
      colors: {
        GBR: "#18b938",
        CHS: "#d80e0e"
      }
    },
    displayLineage: true
  }
];
