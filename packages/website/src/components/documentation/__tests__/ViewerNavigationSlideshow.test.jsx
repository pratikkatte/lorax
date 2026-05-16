import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getViewerTourDocumentationSlides } from "../../../data/viewerTourNarration.js";
import ViewerNavigationSlideshow from "../ViewerNavigationSlideshow.jsx";

describe("ViewerNavigationSlideshow", () => {
  it("shows a horizontal pan animation in the description area for step 6", async () => {
    const user = userEvent.setup();

    render(<ViewerNavigationSlideshow slides={getViewerTourDocumentationSlides()} />);

    expect(screen.queryByLabelText("Horizontal pan gesture")).not.toBeInTheDocument();

    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole("button", { name: "Next step" }));
    }

    expect(screen.getByText("Step 6 of 12")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Horizontal pan gesture" })).toBeInTheDocument();
  });

  it("shows gesture animations in the description area for steps 7 and 9", async () => {
    const user = userEvent.setup();

    render(<ViewerNavigationSlideshow slides={getViewerTourDocumentationSlides()} />);

    for (let i = 0; i < 6; i += 1) {
      await user.click(screen.getByRole("button", { name: "Next step" }));
    }

    expect(screen.getByText("Step 7 of 12")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Zoom gesture" })).toBeInTheDocument();

    for (let i = 0; i < 2; i += 1) {
      await user.click(screen.getByRole("button", { name: "Next step" }));
    }

    expect(screen.getByText("Step 9 of 12")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Time scale scroll gesture" })).toBeInTheDocument();
  });
});
