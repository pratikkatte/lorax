import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * Configuration schema for LoraxTrack
 *
 * Minimal configuration for the Lorax ARG track.
 * Can be expanded as more features are added.
 */
export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LoraxTrack',
    {
      /**
       * Default height of the track in pixels
       */
      defaultHeight: {
        type: 'number',
        description: 'Default height of the Lorax track in pixels',
        defaultValue: 400,
      },
    },
    {
      baseConfiguration: createBaseTrackConfig(pluginManager),
      explicitIdentifier: 'trackId',
    },
  )
}
