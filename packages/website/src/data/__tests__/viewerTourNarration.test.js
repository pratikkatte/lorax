import { describe, expect, it } from "vitest";
import {
  getViewerTourDocumentationSlides,
  viewerTourDefaultStepOrder
} from "../viewerTourNarration.js";

describe("getViewerTourDocumentationSlides", () => {
  it("uses a dedicated annotated screenshot for each default documentation step", () => {
    const slides = getViewerTourDocumentationSlides();

    expect(slides).toHaveLength(viewerTourDefaultStepOrder.length);
    expect(slides.map((slide) => slide.id)).toEqual(viewerTourDefaultStepOrder);
    expect(slides.map((slide) => slide.imageSrc)).toEqual(
      viewerTourDefaultStepOrder.map((id) => `/docs/viewer-tour/${id}.png`)
    );
  });
});
