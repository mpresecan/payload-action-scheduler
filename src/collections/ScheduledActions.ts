import type {CollectionConfig} from 'payload/types'
import BeforeScheduledActionsList from '../components/BeforeScheduledActionsList'
import {
  ArgumentCell,
  GroupCell,
  LogCell,
  ScheduleDateCell,
  StatusCell,
  RecurringCell,
} from '../components/Cells'
import {parseExpression} from 'cron-parser'
import {AddActionType, PluginTypes} from "../types";
import {MAX_NODE_TIMEOUT_SECONDS, pluginDefaults} from "../defaults";
import {sortObjectKeys} from "../helpers";
import {
  constructNewAction,
  getActionsQueue,
  isActionScheduled,
  processActionsQueue,
  updateActionSchedulerStatus
} from "../utilities";
import {stringifyDiff} from "../helpers/time-server";
import {GeneratedTypes} from "payload";

export const SCHEDULED_ACTIONS_COLLECTION_SLUG = 'scheduled-actions' // do not put in config to change the collection slug
export const SCHEDULED_ACTIONS_ENDPOINT = '/run'

// export const RECURRING_INTERVAL_SECONDS = 60 // not needed
// export const TIMEOUT_SECONDS = 8
// export const API_URI = 'http://localhost:3000'

export const ScheduledActions = (pluginConfig: PluginTypes) : CollectionConfig => {

  const {
    createAccess,
    readAccess,
    runtime,
    debug,
    actions,
    timeoutSeconds: timeoutSecondsConst,
    errorHooks,
    apiURL,
  } = {
    ...pluginDefaults,
    ...pluginConfig
  }

  const timeoutSeconds = timeoutSecondsConst || MAX_NODE_TIMEOUT_SECONDS

  // TODO: you will need to validate the config here
  // - scheduledActionsEndpoint needs to start with a slash
  // - apiUrl needs to be a valid URL or should start with a slash

  const description = runtime === 'serverless' ?
    `In a serverless environment, use an external scheduler (e.g., AWS CloudWatch, Google Cloud Scheduler) to call /api/${SCHEDULED_ACTIONS_COLLECTION_SLUG}${SCHEDULED_ACTIONS_ENDPOINT} at regular intervals.` :
    `In a node-server environment, set up a custom cron script (e.g., using node-cron) to regularly call /api/${SCHEDULED_ACTIONS_COLLECTION_SLUG}${SCHEDULED_ACTIONS_ENDPOINT}.`

  return {
    slug: SCHEDULED_ACTIONS_COLLECTION_SLUG,
    access: {
      create: createAccess,
      delete: () => false,
      update: () => false,
      read: readAccess,
    },
    versions: false,
    admin: {
      listSearchableFields: ['endpoint', 'status', 'group'],
      defaultColumns: ['endpoint', 'status', 'group', 'recurrence', 'scheduled_date'],
      description: description,
      pagination: {
        defaultLimit: 10,
      },
      useAsTitle: 'endpoint',
      hideAPIURL: true,
      components: {
        BeforeListTable: [BeforeScheduledActionsList],
      },
    },
    disableDuplicate: true,
    hooks: {
      beforeValidate: [
        async ({data, operation, originalDoc, req}) => {

          if (operation === 'update') return data;

          const {payload} = req;

          const action = data as AddActionType;
          action.args = sortObjectKeys(action.args);

          const props = constructNewAction(action);
          const {endpoint, scheduledDateTime} = props;

          // check if the same action is already present in the queue
          const isScheduled = await isActionScheduled(payload, endpoint, scheduledDateTime, 'pending');
          if (isScheduled)
            return 'Action is already scheduled';

          return props;
        }
      ]
    },
    endpoints: [
      {
        path: SCHEDULED_ACTIONS_ENDPOINT,
        method: 'get',
        async handler(request) {
          const {payload} = request

          const startTime = new Date()
          let duration: number
          let totalDocs = 0
          let resultMessage: string
          let resultStatusCode: number
          let successCount: number = 0

          try {
            const results = await getActionsQueue(payload, timeoutSeconds!)
            totalDocs = results.totalDocs

            const batchFetchTime = new Date()
            if (debug) {
              if (results.page === 1) {
                payload.logger.info(`[Action Scheduler][RUN] Started ----------------------------`)
                payload.logger.info(`[Action Scheduler][FETCH] Completed in ${stringifyDiff(batchFetchTime.getTime() - startTime.getTime())}`)
                payload.logger.info(`[Action Scheduler][Total Actions] ${totalDocs}`)
              }
            }

            successCount = await processActionsQueue({
              payload: payload,
              actions: results.docs as GeneratedTypes["collections"]["scheduled-actions"][],
              actionHandlers: actions!,
              timeoutSeconds: timeoutSeconds,
              errorHooks: errorHooks!,
              apiURL: apiURL!,
            })

            const batchProcessTime = new Date()
            if (debug) {
              payload.logger.info(`[Action Scheduler][PROCESS] Completed in ${stringifyDiff(batchProcessTime.getTime() - batchFetchTime.getTime())}`)
            }

            resultMessage = 'Action Scheduler Completed'
            resultStatusCode = 200
          } catch (error) {
            payload.logger.error(error)

            resultMessage = 'Action Scheduler Failed to run processes'
            resultStatusCode = 401
          } finally {
            const finishProcessBatchTime = new Date()
            // duration for the database log
            duration = finishProcessBatchTime.getTime() - startTime.getTime()
            await updateActionSchedulerStatus(payload, startTime, finishProcessBatchTime, totalDocs, totalDocs - successCount)

            const finishUpdateStatusTime = new Date()
            // total duration (including storing in database)
            duration = finishUpdateStatusTime.getTime() - startTime.getTime()
            if (debug) {
              payload.logger.info(`[Action Scheduler][Update Status][Finished] in ${stringifyDiff(finishUpdateStatusTime.getTime() - finishProcessBatchTime.getTime())}`)
              payload.logger.info(`[Action Scheduler][Total Duration] ${stringifyDiff(duration)}`)
            }
          }

          return new Response(JSON.stringify({
            message: resultMessage,
            startedAt: startTime,
            duration,
            numberOfActions: totalDocs,
            errorCount: totalDocs - successCount,
          }), {status: resultStatusCode})
        },
      },
    ],
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'endpoint',
            type: 'text',
            required: true,
            admin: {
              readOnly: false,
              description: 'The endpoint with the relative path will call config.apiUri + endpoint',
              width: '50%',
            },
          },
          {
            name: 'status',
            type: 'select',
            options: ['pending', 'completed', 'failed', 'running', 'cancelled', 'timeout'],
            required: false,
            admin: {
              readOnly: true,
              components: {
                Cell: StatusCell,
              },
              width: '50%',
            },
          },
        ],
      },
      {
        name: 'args',
        label: 'Arguments',
        type: 'json',
        admin: {
          readOnly: false,
          components: {
            Cell: ArgumentCell,
          },
        },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'group',
            type: 'text',
            admin: {
              readOnly: false,
              components: {
                Cell: GroupCell,
              },
              description: 'The group the action belongs to',
              width: '50%',
            },
          },
          {
            name: 'priority',
            type: 'number',
            admin: {
              readOnly: false,
              description: 'Higher number, higher priority',
              width: '50%',
            },
            defaultValue: 0,
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'cronExpression',
            label: 'Cron Expression',
            type: 'text',
            admin: {
              readOnly: false,
              description: 'Leave empty for one-time actions. For recurring actions, use a cron expression. see more at: https://crontab.guru/',
              components: {
                Cell: RecurringCell,
              },
              width: '50%',
            },
            validate: async (value) => {
              if (!value) {
                return true;
              }
              try {
                const parts = value.split(' ')
                if (parts.length < 5 || parts.length > 6)
                  return "Invalid cron expression. It must have 5 or 6 parts separated by spaces."

                parseExpression(value);
                return true;
              } catch (error) {
                if (error instanceof Error) {
                  return error.message;
                }
                return 'Invalid cron expression';
              }
            },
          },
          {
            name: 'scheduledDateTime',
            label: 'Scheduled Date',
            type: 'date',
            admin: {
              readOnly: false,
              date: {
                pickerAppearance: 'dayAndTime',
              },
              components: {
                Cell: ScheduleDateCell,
              },
              width: '50%',
            },
          },
        ],
      },
      {
        name: 'log',
        type: 'array',
        fields: [
          {
            type: 'row',
            fields: [
              {
                name: 'date',
                type: 'date',
                required: true,
              },
              {
                name: 'code',
                type: 'number',
                required: false,
              },
            ],
          },
          {
            name: 'message',
            type: 'text',
            required: true,
          },
        ],
        admin: {
          readOnly: true,
          components: {
            Cell: LogCell,
          },
        },
      },
    ],
    defaultSort: 'updatedAt',
  }
}
