import {PluginTypes} from "./types";

export const MAX_NODE_TIMEOUT_SECONDS = 86400

export const pluginDefaults : PluginTypes = {
  actions: [],
  runtime: 'serverless',
  debug: false,
  createAccess: (args) => true,
  readAccess: (args) => true,
  timeoutSeconds: 60,
  errorHooks: [],
  enabled: true,
  apiURL: '/api',
}
