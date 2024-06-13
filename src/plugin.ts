import type { Config, Plugin } from 'payload/config'

import type { PluginTypes } from './types'
import newCollection from './newCollection'
import {ActionSchedulerInfo} from "./gloabals/ActionSchedulerInfo";
import {ScheduledActions} from "./collections/ScheduledActions";

type PluginType = (pluginOptions: PluginTypes) => Plugin

export const actionScheduler =
  (pluginOptions: PluginTypes): Plugin =>
  incomingConfig => {
    let config = { ...incomingConfig }

    // If the plugin is disabled, return the config without modifying it
    // The order of this check is important, we still want any webpack extensions to be applied even if the plugin is disabled
    if (pluginOptions.enabled === false) {
      return config
    }

    config.collections = [
      ...(config.collections || []),
      // Add additional collections here
      ScheduledActions(pluginOptions),
    ]

    config.globals = [
      ...(config.globals || []),
      // Add additional globals here
      ActionSchedulerInfo
    ]

    return config
  }
