import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('LoraxMetadataWidget', {})

const stateModel = types.model('LoraxMetadataWidget', {
  id: ElementId,
  type: types.literal('LoraxMetadataWidget'),
  trackLabel: types.optional(types.string, ''),
  snapshot: types.maybeNull(types.frozen()),
})

export default function LoraxMetadataWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'LoraxMetadataWidget',
      heading: 'Lorax metadata',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./components/LoraxMetadataWidget')),
    })
  })
}
