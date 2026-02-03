// Metadata feature presets for InfoFilter.
// Keep IDs unique and matches exact project + filename.
export const metadataFeatureConfig = [
  {
    id: "Heliconius_erato_sara_hdem_chr2",
    description: "Highlights lineage structure within the chromosome 2 inversion, revealing increased relatedness among inversion-carrying Heliconius samples relative to flanking genomic regions",
    label: "Inversion associated ancestry (Heliconius)",
    project: "Heliconius",
    filename: "erato-sara_chr2.csv",
    genomicCoords: [9094204, 15709066],
    actions: ["adjustView"],
    metadata: {
      key: "sample",
      values: ["Hsar", "Hhsa", "Hhim", "Hdem", "Htel", "HeraRef"],
      colors: {
        Hsar: "#349A88",
        Hhsa: "#E76F51",
        Hhim: "#E17354",
        Hdem: "#2F9C8A",
        Htel: "#2A9D8F",
        HeraRef: "#DB7757"
      }
    },
    mutation: [],
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
        GBR: "#4FB6C1",
        CHS: "#9A9459"
      }
    },
    mutation: [{ nodeId: 2461020, treeIndex: 1196082}],
    displayLineage: true
  }
];
