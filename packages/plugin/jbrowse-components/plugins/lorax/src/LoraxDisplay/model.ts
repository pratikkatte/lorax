import { types, Instance } from '@jbrowse/mobx-state-tree'
import { ConfigurationReference, AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'

export default function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  const model = types.compose(
    'LoraxDisplay',
    BaseDisplay,
    types.model({
      type: types.literal('LoraxDisplay'),
      configuration: ConfigurationReference(configSchema),
      height: types.optional(types.number, 400),
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
    }))
    .views(() => ({
      trackMenuItems() {
        return []
      },
    }))
}

export type LoraxDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LoraxDisplayModel = Instance<LoraxDisplayStateModel>
