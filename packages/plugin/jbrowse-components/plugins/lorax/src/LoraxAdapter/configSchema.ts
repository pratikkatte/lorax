import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LoraxAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'LoraxAdapter',
  {
    /**
     * #slot
     * Base URL for the Lorax backend (e.g. http://localhost:8080 or /api)
     */
    apiBase: {
      type: 'string',
      defaultValue: '',
    },

    /**
     * #slot
     * Absolute or backend-relative path to the .trees file
     */
    filePath: {
      type: 'string',
      defaultValue: '',
    },

    /**
     * #slot
     * Lorax project folder (used with file)
     */
    project: {
      type: 'string',
      defaultValue: '',
    },

    /**
     * #slot
     * Filename within the project
     */
    file: {
      type: 'string',
      defaultValue: '',
    },

    /**
     * #slot
     * Optional share session ID for uploaded files
     */
    shareSid: {
      type: 'string',
      defaultValue: '',
    },

    /**
     * #slot
     * Upload local file via POST /upload before load_file
     */
    useUpload: {
      type: 'boolean',
      defaultValue: false,
    },

    /**
     * #slot
     * Optional fileLocation for upload (BlobLocation or UriLocation)
     */
    fileLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot
     * Use production socket path resolution
     */
    isProd: {
      type: 'boolean',
      defaultValue: false,
    },
  },
  {
    explicitlyTyped: true,
    implicitIdentifier: 'adapterId',
  },
)

export default configSchema
