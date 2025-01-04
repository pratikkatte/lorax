import { types } from "mobx-state-tree" // alternatively, `import { t } from "mobx-state-tree"`

export const ViewModel = types
  .model("ViewModel", {
    newick: types.string,
  })
  .actions((self) => ({
    updateNewick(newNewickString) {
      self.newick = newNewickString;
    },
  }));

export const ConfigModel = types.model("ConfigModel", {
  view: ViewModel,
});