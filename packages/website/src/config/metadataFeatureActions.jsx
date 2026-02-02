export const metadataFeatureActions = {
  adjustView: ({ deckRef }) => {
    const applied = deckRef?.current?.viewAdjustY?.();
    return applied;
  }
};
