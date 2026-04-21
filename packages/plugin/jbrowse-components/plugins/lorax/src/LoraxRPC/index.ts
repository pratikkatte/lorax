import type PluginManager from '@jbrowse/core/PluginManager'

import {
  LoraxApplyTransformRpcMethod,
  LoraxClearRenderBuffersRpcMethod,
  LoraxComputeRenderDataRpcMethod,
  LoraxConfigRpcMethod,
  LoraxIntervalsRpcMethod,
  LoraxLocalDataRpcMethod,
} from './rpcMethods'

export default function LoraxRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new LoraxConfigRpcMethod(pm))
  pm.addRpcMethod(() => new LoraxIntervalsRpcMethod(pm))
  pm.addRpcMethod(() => new LoraxLocalDataRpcMethod(pm))
  pm.addRpcMethod(() => new LoraxComputeRenderDataRpcMethod(pm))
  pm.addRpcMethod(() => new LoraxApplyTransformRpcMethod(pm))
  pm.addRpcMethod(() => new LoraxClearRenderBuffersRpcMethod(pm))
}
