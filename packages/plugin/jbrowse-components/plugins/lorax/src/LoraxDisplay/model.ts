import { types, Instance } from '@jbrowse/mobx-state-tree'
import { ConfigurationReference, AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'

import type { MenuItem } from '@jbrowse/core/ui'

export default function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  const model = types.compose(
    'LoraxDisplay',
    BaseDisplay,
    types.model({
      type: types.literal('LoraxDisplay'),
      configuration: ConfigurationReference(configSchema),
      height: types.optional(types.number, 400),
      metadataViewEnabled: types.optional(types.boolean, false),
    })
  )

  return model
    .views(() => ({
      get rendererTypeName() {
        return 'LoraxRenderer'
      },
    }))
    .actions((self) => ({
      setHeight(height: number) {
        self.height = height
      },
      setMetadataView(value: boolean) {
        self.metadataViewEnabled = value
      },
    }))
    .views((self) => ({
      trackMenuItems(): MenuItem[] {
        return [
          {
            type: 'checkbox',
            label: 'Metadata view',
            checked: self.metadataViewEnabled,
            onClick: () => {
              self.setMetadataView(!self.metadataViewEnabled)
            },
          },
        ]
      },
    }))
}

export type LoraxDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LoraxDisplayModel = Instance<LoraxDisplayStateModel>
