// Metadata feature presets for InfoFilter.
// Keep IDs unique and matches exact project + filename.
export const metadataFeatureConfig = [
  {
    id: "Heliconius_erato_sara_hdem",
    label: "Hdem sample lineage",
    project: "Heliconius",
    filename: "erato-sara_chr0.csv",
    genomicCoords: [0, 1000],
    metadata: {
      key: "sample",
      values: ["Hdem"],
      colors: {
        Hdem: "#2b6cb0"
      }
    },
    displayLineage: true
  },
  {
    id: "Heliconius_erato_sara_hdem_chr2",
    label: "inversions on chr2",
    project: "Heliconius",
    filename: "erato-sara_chr2.csv",
    genomicCoords: [8790771, 16465129],
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
  }
];
