# Lorax Track Zoom Fix

## Problem
Wheel and trackpad pinch events were still being handled by the parent JBrowse
view. This caused the full JBrowse component to zoom even when the user intended
to zoom only the Lorax track. React's `onWheel` handler is passive by default in
many environments, so calling `preventDefault()` inside it produced warnings and
did not reliably stop propagation. At the same time, horizontal scrolling should
continue to pan the parent JBrowse view.

## What made it work
- Attach a native `wheel` listener directly to the Lorax container with
  `{ passive: false }`, so `preventDefault()` is allowed.
- Call both `stopPropagation()` and `preventDefault()` only for zoom gestures
  (vertical wheel or pinch), keeping them local to the Lorax track.
- Let horizontal scroll events pass through so the parent JBrowse view can pan.
- Keep independent X/Y zoom by using `LoraxOrthographicController` to select
  the active zoom axis and applying the axis-specific zoom in
  `onViewStateChange`.

## Key implementation
- `LoraxComponent` sets a non-passive `wheel` listener on the container and
  blocks only zoom gestures from reaching JBrowse.
- `LoraxOrthographicController` ignores horizontal wheel scroll and allows those
  events to bubble to the parent view for panning.
- Deck.gl continues to receive zoom events and applies axis-specific zoom only
  inside the Lorax track.
