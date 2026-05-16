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
      viewerTourDefaultStepOrder.map((id) => {
        if (id === "viewer-landing-page") return "/docs/viewer-tour/viewer-landing-page.png";
        if (id === "viewer-reset-view") return "/docs/viewer-tour/viewer-reset.png";
        return `/docs/viewer-tour/${id}.png`;
      })
    );
    expect(
      slides.every((slide) =>
        existsSync(
          path.join(
            viewerTourImageDir,
            slide.id === "viewer-landing-page"
              ? `${slide.id}.png`
              : slide.id === "viewer-reset-view"
                ? "viewer-reset.png"
                : `${slide.id}.png`
          )
        )
      )
    ).toBe(true);
  });

  it("starts the documentation walkthrough from the landing page choices", () => {
    const slides = getViewerTourDocumentationSlides();

    expect(viewerTourDefaultStepOrder[0]).toBe("viewer-landing-page");
    expect(slides[0]).toMatchObject({
      id: "viewer-landing-page",
      title: "Landing page",
      imageSrc: "/docs/viewer-tour/viewer-landing-page.png"
    });
    expect(slides[0].content).toContain("Lorax viewer");
    expect(slides[0].content).toContain("JBrowse view");
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

  it("documents the Info panel as Details, Mutations, and Sample Filter sections", () => {
    const slides = getViewerTourDocumentationSlides();
    const infoIndex = viewerTourDefaultStepOrder.indexOf("viewer-info-details");

    expect(viewerTourDefaultStepOrder).not.toContain("viewer-info-button");
    expect(infoIndex).toBeGreaterThanOrEqual(0);
    expect(viewerTourDefaultStepOrder.slice(infoIndex, infoIndex + 3)).toEqual([
      "viewer-info-details",
      "viewer-info-mutations",
      "viewer-info-filter"
    ]);
    expect(
      slides.slice(infoIndex, infoIndex + 3).map(({ id, title, imageSrc }) => ({
        id,
        title,
        imageSrc
      }))
    ).toEqual([
      {
        id: "viewer-info-details",
        title: "Details",
        imageSrc: "/docs/viewer-tour/viewer-info-details.png"
      },
      {
        id: "viewer-info-mutations",
        title: "Mutations",
        imageSrc: "/docs/viewer-tour/viewer-info-mutations.png"
      },
      {
        id: "viewer-info-filter",
        title: "Sample Filter",
        imageSrc: "/docs/viewer-tour/viewer-info-filter.png"
      }
    ]);
    expect(slides[infoIndex].content).toContain("selected tree");
    expect(slides[infoIndex + 1].content).toContain("current genomic window");
    expect(slides[infoIndex + 2].content).toContain("sample metadata");
  });
});
