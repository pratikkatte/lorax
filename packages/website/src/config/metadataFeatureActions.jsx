export const metadataFeatureActions = {
  adjustView: ({ deckRef }) => {
    deckRef?.current?.viewAdjustY?.();
  }
};
