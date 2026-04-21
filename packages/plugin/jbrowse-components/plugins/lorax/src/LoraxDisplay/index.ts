import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'

import configSchema from './configSchema'
import stateModelFactory from './model'

/**
 * Factory function to register the LoraxDisplay type
 *
 * The LoraxDisplay renders ARG trees using deck.gl in a LinearGenomeView.
 * It synchronizes with the genome view's coordinate system and provides
 * interactive tree exploration.
 */
export default function LoraxDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LoraxDisplay',
      displayName: 'Lorax ARG Display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'LoraxTrack',
      viewType: 'LinearGenomeView',
      // Lazy load the React component for better performance
      ReactComponent: lazy(() => import('./components/LoraxComponent')),
    })
  })
}
