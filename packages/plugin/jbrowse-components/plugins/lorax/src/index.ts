import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

import LoraxTrackF from './LoraxTrack'
import LoraxDisplayF from './LoraxDisplay'
import LoraxAdapterF from './LoraxAdapter'
import LoraxRPCMethodsF from './LoraxRPC'
import LoraxMetadataWidgetF from './LoraxMetadataWidget'

/**
 * LoraxPlugin - JBrowse 2 plugin for Lorax ARG visualization
 *
 * Provides a minimal Lorax deck.gl visualization
 * as a track type within JBrowse.
 */
export default class LoraxPlugin extends Plugin {
  name = 'LoraxPlugin'
  version = '0.1.0'

  install(pluginManager: PluginManager) {
    LoraxTrackF(pluginManager)
    LoraxDisplayF(pluginManager)
    LoraxAdapterF(pluginManager)
    LoraxRPCMethodsF(pluginManager)
    LoraxMetadataWidgetF(pluginManager)
  }

  configure(_pluginManager: PluginManager) {}
}
