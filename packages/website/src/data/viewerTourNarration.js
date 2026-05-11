/** Shared title/body copy for the in-app viewer tour and documentation slideshow. */

export const viewerTourNarrationById = {
  "viewer-position": {
    title: "Genome window",
    content: "Pan and set the genomic range you want to explore. Click Go to apply edits."
  },
  "viewer-reset-view": {
    title: "Reset view",
    content: "Reset the vertical zoom while keeping your current genomic window."
  },
  "viewer-compare-topology": {
    title: "Compare topology",
    content: "Highlight edge differences between adjacent genealogies to compare their topologies."
  },
  "viewer-lock-view": {
    title: "Lock view",
    content: "Zoom/pan into the trees and inspect the specific region without the trees shifting around."
  },
  "viewer-viewport": {
    title: "Main viewport",
    content: "Interact with trees in the viewport. Hover for details and click nodes or edges."
  },
  "viewer-pan": {
    title: "Pan left and right",
    content: "Drag horizontally on the viewport to pan across the genome."
  },
  "viewer-zoom": {
    title: "Zoom",
    content: "Scroll up/down to zoom vertically. Hold Ctrl and scroll up/down to zoom horizontally."
  },
  "viewer-tree-polygon": {
    title: "Pick a tree",
    content: "The center tree is highlighted. Hover it to see details, then click any tree to zoom in."
  },
  "viewer-tree-edge": {
    title: "Open tree details",
    content: "Click any edge on the highlighted tree to open the Info panel."
  },
  "viewer-info-button": {
    title: "Info & Filters",
    content: "Open metadata, mutations, and filtering controls for deeper inspection."
  },
  "viewer-info-details": {
    title: "Details",
    content: "Explore tree, node, and sample details for the selected tree."
  },
  "viewer-info-mutations": {
    title: "Mutations",
    content: "Browse mutations for the current window or search by position."
  },
  "viewer-info-filter": {
    title: "Filters",
    content: "Color and filter trees to focus on specific structures."
  },
  "viewer-settings-button": {
    title: "Settings",
    content: "Customize display options like colors and view settings."
  },
  "viewer-screenshot-button": {
    title: "Screenshot",
    content: "Capture a PNG or SVG of the current view."
  }
};

/** Default tour order when advanced steps are off (matches docs slideshow). */
export const viewerTourDefaultStepOrder = [
  "viewer-position",
  "viewer-reset-view",
  "viewer-compare-topology",
  "viewer-lock-view",
  "viewer-viewport",
  "viewer-pan",
  "viewer-zoom",
  "viewer-info-button",
  "viewer-settings-button",
  "viewer-screenshot-button"
];

/**
 * @param {{ imageSrc?: string; imageSrcsById?: Record<string, string> }} opts
 * @returns {Array<{ id: string; title: string; content: string; imageSrc: string }>}
 */
export function getViewerTourDocumentationSlides(opts = {}) {
  const { imageSrc = "/docs/viewer-nav-placeholder.png", imageSrcsById = {} } = opts;
  return viewerTourDefaultStepOrder.map((id) => ({
    id,
    ...viewerTourNarrationById[id],
    imageSrc: imageSrcsById[id] ?? imageSrc
  }));
}
