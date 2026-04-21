import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

/**
 * Configuration schema for LoraxDisplay
 *
 * Minimal configuration extending the base linear display.
 * Can be expanded as more visualization options are added.
 */
const configSchema = ConfigurationSchema(
  'LoraxDisplay',
  {
    /**
     * Default height of the display
     */
    defaultHeight: {
      type: 'number',
      description: 'Default height of the Lorax display in pixels',
      defaultValue: 400,
    },
  },
  {
    baseConfiguration: baseLinearDisplayConfigSchema,
    explicitlyTyped: true,
  },
)

export default configSchema
