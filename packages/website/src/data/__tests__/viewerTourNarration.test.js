import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getViewerTourDocumentationSlides,
  viewerTourDefaultStepOrder
} from "../viewerTourNarration.js";

const viewerTourImageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/docs/viewer-tour"
);

describe("getViewerTourDocumentationSlides", () => {
  it("uses a dedicated annotated screenshot for each default documentation step", () => {
    const slides = getViewerTourDocumentationSlides();

    expect(slides).toHaveLength(viewerTourDefaultStepOrder.length);
    expect(slides.map((slide) => slide.id)).toEqual(viewerTourDefaultStepOrder);
    expect(slides.map((slide) => slide.imageSrc)).toEqual(
      viewerTourDefaultStepOrder.map((id) => `/docs/viewer-tour/${id}.png`)
    );
    expect(
      slides.every((slide) => existsSync(path.join(viewerTourImageDir, `${slide.id}.png`)))
    ).toBe(true);
  });

  it("documents Highlight descendants immediately after Compare topology", () => {
    const slides = getViewerTourDocumentationSlides();
    const compareIndex = viewerTourDefaultStepOrder.indexOf("viewer-compare-topology");
    const descendantsSlide = slides.find((slide) => slide.id === "viewer-highlight-descendants");

    expect(compareIndex).toBeGreaterThanOrEqual(0);
    expect(viewerTourDefaultStepOrder.slice(compareIndex, compareIndex + 2)).toEqual([
      "viewer-compare-topology",
      "viewer-highlight-descendants"
    ]);
    expect(descendantsSlide).toMatchObject({
      title: "Highlight descendants",
      imageSrc: "/docs/viewer-tour/viewer-highlight-descendants.png"
    });
  });
});
