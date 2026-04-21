import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { openLocation } from '@jbrowse/core/util/io'
import { io } from 'socket.io-client'

import type { FileLocation } from '@jbrowse/core/util/types'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import type { Socket } from 'socket.io-client'

type LoadFileResult = {
  message?: string
  filename?: string
  config?: unknown
  owner_sid?: string
  sid?: string
  /** Lorax session ID used for load_file - pass to LoraxProvider for session unification */
  loraxSid?: string
}

type UploadResult = {
  filename?: string
  owner_sid?: string
}

export default class LoraxAdapter extends BaseFeatureDataAdapter {
  private socket?: Socket
  private socketPromise?: Promise<Socket>
  private loraxSid?: string

  public async getRefNames(_opts?: BaseOptions): Promise<string[]> {
    return []
  }

  public getFeatures(_region: Region, _opts?: BaseOptions) {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }

  private getApiBase() {
    const apiBase = this.getConf('apiBase') as string
    return apiBase || window.location.origin
  }

  private getIsProd() {
    return Boolean(this.getConf('isProd'))
  }

  private hasFileLocation(location?: FileLocation) {
    if (!location) {
      return false
    }
    if ('uri' in location) {
      return Boolean(location.uri)
    }
    if ('localPath' in location) {
      return Boolean(location.localPath)
    }
    if ('blobId' in location) {
      return Boolean(location.blobId)
    }
    return false
  }

  private inferFileName(location?: FileLocation) {
    if (!location) {
      return 'upload.trees'
    }
    if ('name' in location && location.name) {
      return location.name
    }
    if ('uri' in location && location.uri) {
      return location.uri.split('/').pop() || 'upload.trees'
    }
    if ('localPath' in location && location.localPath) {
      const normalized = location.localPath.replace(/\\/g, '/')
      return normalized.split('/').pop() || 'upload.trees'
    }
    return 'upload.trees'
  }

  private resolveFileTarget() {
    const filePath = (this.getConf('filePath') as string) || ''
    const project = (this.getConf('project') as string) || ''
    const file = (this.getConf('file') as string) || ''

    if (filePath) {
      return {
        filePath,
        project: '',
        file: '',
      }
    }

    if (filePath && (!project || !file)) {
      const normalized = filePath.replace(/\\/g, '/')
      const splitIndex = normalized.lastIndexOf('/')
      if (splitIndex >= 0) {
        return {
          filePath,
          project: normalized.slice(0, splitIndex),
          file: normalized.slice(splitIndex + 1),
        }
      }
      return {
        filePath,
        project: '',
        file: normalized,
      }
    }

    return { project, file }
  }

  private async ensureSession() {
    if (this.loraxSid) {
      return this.loraxSid
    }

    const apiBase = this.getApiBase().replace(/\/$/, '')
    const response = await fetch(`${apiBase}/init-session`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(
        `[LoraxAdapter] init-session failed (${response.status})`,
      )
    }

    const data = (await response.json()) as { sid?: string }
    if (!data.sid) {
      throw new Error('[LoraxAdapter] init-session missing sid')
    }

    this.loraxSid = data.sid
    return data.sid
  }

  private async ensureSocket() {
    if (this.socket?.connected) {
      return this.socket
    }

    if (!this.socketPromise) {
      this.socketPromise = new Promise((resolve, reject) => {
        const apiBase = this.getApiBase()
        const resolvedApiBase = new URL(apiBase, window.location.origin)
        const isCrossOrigin =
          resolvedApiBase.origin !== window.location.origin
        const host = isCrossOrigin
          ? resolvedApiBase.origin
          : window.location.origin
        const apiPath = resolvedApiBase.pathname.replace(/\/$/, '')
        const socketPath = apiPath ? `${apiPath}/socket.io/` : '/socket.io/'
        const socket = io(host, {
          transports: ['websocket', 'polling'],
          withCredentials: true,
          path: socketPath,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 3000,
          timeout: 60000,
        })

        this.socket = socket

        if (socket.connected) {
          resolve(socket)
          return
        }

        const handleConnect = () => {
          socket.off('connect_error', handleError)
          resolve(socket)
        }

        const handleError = (error: Error) => {
          socket.off('connect', handleConnect)
          reject(error)
        }

        socket.once('connect', handleConnect)
        socket.once('connect_error', handleError)
      })
    }

    return this.socketPromise
  }

  private async uploadFile(location: FileLocation): Promise<UploadResult> {
    const apiBase = this.getApiBase().replace(/\/$/, '')
    const filehandle = openLocation(location, this.pluginManager)
    const bytes = await filehandle.readFile()
    const fileName = this.inferFileName(location)

    const formData = new FormData()
    formData.append('file', new Blob([bytes]), fileName)

    const response = await fetch(`${apiBase}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`[LoraxAdapter] upload failed (${response.status})`)
    }

    return (await response.json()) as UploadResult
  }

  public async loadFile(): Promise<LoadFileResult> {
    await this.ensureSession()
    const socket = await this.ensureSocket()
    const loraxSid = this.loraxSid

    if (!loraxSid) {
      throw new Error('[LoraxAdapter] missing session id')
    }

    const useUpload = Boolean(this.getConf('useUpload'))
    const fileLocation = this.getConf('fileLocation') as
      | FileLocation
      | undefined
    const hasFile = Boolean(this.getConf('file') || this.getConf('filePath'))
    const shouldUpload = useUpload || (!hasFile && this.hasFileLocation(fileLocation))

    const target = this.resolveFileTarget()
    let { project, file } = target
    let shareSid = (this.getConf('shareSid') as string) || undefined

    if (target.filePath) {
      return new Promise((resolve, reject) => {
        const handleResult = (message: LoadFileResult) => {
          cleanup()
          resolve({ ...message, loraxSid })
        }

        const handleError = (message: { message?: string }) => {
          cleanup()
          reject(
            new Error(
              message?.message || '[LoraxAdapter] load_file error',
            ),
          )
        }

        const cleanup = () => {
          socket.off('load-file-result', handleResult)
          socket.off('error', handleError)
        }

        socket.once('load-file-result', handleResult)
        socket.once('error', handleError)
        socket.emit('load_file', {
          lorax_sid: loraxSid,
          file_path: target.filePath,
        })
      })
    }

    if (shouldUpload && fileLocation && this.hasFileLocation(fileLocation)) {
      const uploadResult = await this.uploadFile(fileLocation)
      project = 'Uploads'
      if (uploadResult.filename) {
        file = uploadResult.filename
      }
      if (uploadResult.owner_sid) {
        shareSid = uploadResult.owner_sid
      }
    }

    if (!file) {
      throw new Error('[LoraxAdapter] file or filePath is required')
    }

    const payload = {
      lorax_sid: loraxSid,
      project: project || 'Uploads',
      file,
      share_sid: shareSid,
    }

    return new Promise((resolve, reject) => {
      const handleResult = (message: LoadFileResult) => {
        cleanup()
        resolve({ ...message, loraxSid })
      }

      const handleError = (message: { message?: string }) => {
        cleanup()
        reject(
          new Error(
            message?.message || '[LoraxAdapter] load_file error',
          ),
        )
      }

      const cleanup = () => {
        socket.off('load-file-result', handleResult)
        socket.off('error', handleError)
      }

      socket.once('load-file-result', handleResult)
      socket.once('error', handleError)
      socket.emit('load_file', payload)
    })
  }
}
