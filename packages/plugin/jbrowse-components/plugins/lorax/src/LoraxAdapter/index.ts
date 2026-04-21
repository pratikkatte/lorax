import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LoraxAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'LoraxAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./LoraxAdapter').then(r => r.default),
      }),
  )
}
