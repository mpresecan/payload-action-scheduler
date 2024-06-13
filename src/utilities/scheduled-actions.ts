import {BasePayload, GeneratedTypes, getPayload} from 'payload'
import {
  AddActionType,
  GetActionType,
  ErrorLogFunctionArgs,
  RunActionArgs, TimeoutError, ScheduledAction
} from "../types";
import {parseExpression} from "cron-parser";
import {SCHEDULED_ACTIONS_COLLECTION_SLUG} from "../collections/ScheduledActions";
import {normalizeJSONString, sortObjectKeys} from "../helpers";
import {stringifyDiff} from "../helpers/time-server";
import {generateSignature} from "./security";


export const addAction = async (props: AddActionType) => {
  props.args = props.args ? sortObjectKeys(props.args) : undefined
  const action = constructNewAction(props)

  const {
    endpoint,
    args,
    cronExpression,
    scheduledDateTime,
    group,
    status,
    priority,
    log,
  } = action

  const {payload} = props;

  const isScheduled = await isActionScheduled(payload, endpoint, scheduledDateTime, 'pending')
  if (isScheduled)
    return action


  return await payload.create<'scheduled-actions'>({
    collection: SCHEDULED_ACTIONS_COLLECTION_SLUG,
    data: {
      endpoint,
      args,
      cronExpression,
      scheduledDateTime,
      group,
      status,
      priority,
      log,
    },
  })
}

export const constructNewAction = (props: AddActionType) => {

  const {
    endpoint: endpointConst,
    args,
    cronExpression,
    scheduledAt: scheduledAtConst,
    group,
    priority,
  } = props

  let scheduledAt = scheduledAtConst

  if (!endpointConst) {
    throw new Error('Endpoint is required', {cause: 'endpoint'})
  }

  // for empty endpoint add @ to the start
  const endpoint = !endpointConst.startsWith('http') && !endpointConst.startsWith('https') && !endpointConst.startsWith('/') && !endpointConst.startsWith('@') ? `@${endpointConst}` : endpointConst

  const now = new Date()

  if (scheduledAt && now.getTime() > scheduledAt.getTime() && !cronExpression) {
    throw new Error('Cannot schedule an action in the past', {cause: 'scheduledAt'})
  }

  if (cronExpression) {
    // in case of cron expression which is defined "every X s/m/h/d/m/y" we need to find the next scheduled date if the date is in the past.
    // That cycle will run until the future date is found.
    do {
      scheduledAt = parseExpression(cronExpression, {
        currentDate: scheduledAt,
        iterator: true,
        tz: 'utc',
      }).next().value.toDate() // will throw an error if not correct expression
    } while (scheduledAt.getTime() <= new Date().getTime())
  }

  return {
    endpoint,
    args,
    cronExpression,
    scheduledDateTime: scheduledAt ? scheduledAt.toISOString() : undefined,
    group,
    priority: priority || 0,
    status: 'pending' as const,
    log: [
      {
        date: new Date().toISOString(),
        message: 'Action scheduled',
      },
    ],
  }
}


export const isActionScheduled = async (payload: BasePayload<GeneratedTypes>, endpoint: string, scheduledAt?: Date | string, status?: ScheduledAction['status']) => {

  if (typeof scheduledAt === 'string') {
    scheduledAt = new Date(scheduledAt)
  }

  return hasAction(payload, {endpoint, scheduledAt, status})
}


/**
 * Check if an action exists in the queue
 * @param payload
 * @param props
 */
export const hasAction = async (payload: BasePayload<GeneratedTypes>, props: GetActionType) => {
  const action = await getActions(payload, props)
  return action.totalDocs > 0
}

// @ts-ignore
/**
 * Get an action from the database based by the provided props
 * @param payload
 * @param props
 */
export const getActions = async (payload: BasePayload<GeneratedTypes>, props: GetActionType) => {
  const {endpoint, args, cronExpression, scheduledAt: scheduledAtConst, group, status, priority} = props

  let scheduledAt = scheduledAtConst

  if (cronExpression) {
    scheduledAt = parseExpression(cronExpression, {currentDate: new Date(), iterator: true}).next().value.toDate() // will throw an error if not correct expression
  }

  const endpointString = !endpoint.startsWith('http') && !endpoint.startsWith('https') && !endpoint.startsWith('/') && !endpoint.startsWith('@') ? `@${endpoint}` : endpoint

  // Build the query
  let andQuery: any = [{'endpoint': {equals: endpointString}}]
  if (args) andQuery.push({'args': {equals: sortObjectKeys(args)}})
  if (cronExpression) andQuery.push({'cronExpression': {equals: cronExpression}})
  if (scheduledAt) andQuery.push({'scheduledDateTime': {equals: scheduledAt.toISOString()}})
  if (group) andQuery.push({'group': {equals: group}})
  if (status) andQuery.push({'status': {equals: status}})
  if (priority) andQuery.push({'priority': {equals: priority}})

  return payload.find<'scheduled-actions'>({
    collection: SCHEDULED_ACTIONS_COLLECTION_SLUG,
    where: {
      and: andQuery,
    },
  })
}

export const getActionsQueue = async (payload: BasePayload<GeneratedTypes>, timeoutSeconds: number) => {

  return payload.find<'scheduled-actions'>({
    collection: SCHEDULED_ACTIONS_COLLECTION_SLUG,
    where: {
      or: [
        {
          and: [
            {'status': {equals: 'pending'}},
            {'scheduledDateTime': {less_than_equal: new Date().toISOString()}},
          ],
        },
        {
          and: [
            {'status': {equals: 'pending'}},
            {'scheduledDateTime': {equals: null}},
          ],
        },
        {
          and: [
            {'status': {equals: 'running'}},
            {'scheduledDateTime': {less_than: new Date(new Date().getTime() - timeoutSeconds * 1000).toISOString()}},
          ],
        },
        {
          and: [
            {'status': {equals: 'running'}},
            {'scheduledDateTime': {equals: null}},
          ],
        }
      ],
    },
    pagination: false,
    sort: '-priority',
  })
}


export const processActionsQueue = async ({
                                            payload,
                                            actions,
                                            actionHandlers,
                                            timeoutSeconds,
                                            errorHooks,
                                            apiURL
                                          }: Omit<RunActionArgs, 'action'> & {
  actions: ScheduledAction[]
}) => {
  if (actions.length === 0) {
    return 0
  }

  // Start processing the batch by updating the status of the actions
  await updateActionsToRunningStatus(payload, actions)

  // Process in parallel
  const runActionPromises = actions.map(async action => runAction({
    payload: payload,
    action: action,
    timeoutSeconds: timeoutSeconds,
    actionHandlers: actionHandlers,
    errorHooks: errorHooks,
    apiURL: apiURL
  }))

  try {
    // Execute all fetch requests in parallel
    const results = await Promise.allSettled(runActionPromises)

    const successes = results.filter(result => result.status === 'fulfilled')
    return successes.length

  } catch (error) {
    console.error('An error occurred:', error)

    // count as if everything failed
    return 0
  }
}

export const updateActionsToRunningStatus = async (payload: BasePayload<GeneratedTypes>, actions: ScheduledAction[]) => {
  await payload.update({
    collection: SCHEDULED_ACTIONS_COLLECTION_SLUG,
    where: {
      id: {
        in: actions.map((action) => action.id),
      },
    },
    data: {
      status: 'running',
    },
  })
}

export const runAction = async ({
                                  action,
                                  payload,
                                  timeoutSeconds,
                                  actionHandlers,
                                  errorHooks,
                                  apiURL
                                }: RunActionArgs) => {
  timeoutSeconds = timeoutSeconds - 1 // make sure to finish before the serverless function times out in serverless runtime, and in the server-node, it will give 24 hours of work

  logStartAction(action)

  // first determine the action
  let actionPromise: Promise<Response>
  if (action.endpoint.startsWith('@')) {

    let registeredAction = actionHandlers.find(a => a.endpoint === action.endpoint)

    if (!registeredAction && action.endpoint.startsWith('@')) {
      registeredAction = actionHandlers.find(a => a.endpoint === action.endpoint.slice(1))
    }

    if (!registeredAction) {
      const updatedAction = await actionCleanup(payload, errorHooks, action, 'failed', `Action ${action.endpoint} is not registered`, 404)
      await executeErrorLog(payload, errorHooks, updatedAction, `Action ${action.endpoint} is not registered`, 404)
      return Promise.reject(new Error(`Action ${action.endpoint} is not registered`))
    }

    if (typeof registeredAction.handler !== 'function') {
      const updatedAction = await actionCleanup(payload, errorHooks, action, 'failed', `Action ${action.endpoint} is not a function`, 422)
      await executeErrorLog(payload, errorHooks, updatedAction, `Action ${action.endpoint} is not a function`, 422)
      return Promise.reject(new Error(`Action ${action.endpoint} is not a function`))
    }

    actionPromise = registeredAction.handler(payload, action.args)

  } else {
    const endPoint: string = action.endpoint.startsWith('http') ? action.endpoint : `${apiURL}${action.endpoint}`

    actionPromise = fetch(endPoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Action-Scheduler-Signature': generateSignature(JSON.stringify(action.args)),
        'X-Scheduled-Action-Args': action.args ? normalizeJSONString(action.args)! : '',
      },
    })
  }

  // set a timeout for the action
  let timeoutHandle: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      console.error('Action timed out', action.endpoint)
      reject(new TimeoutError('Timed out'))
    }, timeoutSeconds * 1000)
  })

  // add clear up function to ensure timeout is cleared
  actionPromise = actionPromise
    .then(response => {
      clearTimeout(timeoutHandle) // Ensure timeout is cleared
      return response
    })
    .catch(error => {
      clearTimeout(timeoutHandle) // Ensure timeout is cleared
      throw error
    })

  let status: ScheduledAction['status'] = 'failed'
  let message: string = 'Unknown error'
  let code: number = 500

  try {
    // perform THE RACE
    const response = await Promise.race([actionPromise, timeoutPromise])

    // case with the registered actions
    if (!response || !response.status) {
      status = 'completed';
      message = 'Action completed';
      code = 200;
    } else { // fetch promises
      status = response.status >= 200 && response.status < 300 ? 'completed' : 'failed';
      message = status === 'completed' ? 'Action completed' : response.statusText;
      code = response.status;
    }

    await actionCleanup(payload, errorHooks, action, status, message, code)

    if (status === 'failed') {
      await executeErrorLog(payload, errorHooks, action, message, code)
    }

    return response
  } catch (error) {

    if (error instanceof TimeoutError) {
      status = 'timeout'
      code = 504
      message = error.message
    } else if (error instanceof Error) {
      message = error.message
      code = error.message === 'Not Found' ? 404 : 500
    }

    const updatedAction = await actionCleanup(payload, errorHooks, action, status, message, code)
    await executeErrorLog(payload, errorHooks, updatedAction, message, code)

    return Promise.reject(error)
  }
}

const logStartAction = (action: ScheduledAction) => {
  // @ts-ignore
  action.log?.push({
    date: new Date().toISOString(),
    message: 'Action started',
  })
}

const actionCleanup = async (
  payload: BasePayload<GeneratedTypes>,
  errorHooks: ((args: ErrorLogFunctionArgs) => Promise<void>)[],
  action: ScheduledAction,
  status: ScheduledAction['status'],
  message: string,
  code?: number,
) => {
  let updatedAction = await logAction(payload, action, status, message, code, true)
  if (action.cronExpression) {
    try {
      await rescheduleAction(payload, action)
    } catch {
      updatedAction = await logAction(payload, updatedAction, status, 'Failed to reschedule action', 500)
      await executeErrorLog(payload, errorHooks, updatedAction, 'Failed to reschedule action', 500)
    }
  }

  return updatedAction
}

export const logAction = async (
  payload: BasePayload<GeneratedTypes>,
  action: ScheduledAction,
  status: ScheduledAction["status"],
  message: string,
  code?: number,
  calculateTimeDiff = false
) => {

  const timestamp = new Date()

  // @ts-ignore
  if (calculateTimeDiff && action.log && action.log.length > 0 && action.log[action.log.length - 1].message === 'Action started') {
    // @ts-ignore
    const startTime = new Date(action.log[action.log.length - 1].date)
    const diffTime = timestamp.getTime() - startTime.getTime()
    message += ` [${stringifyDiff(diffTime)}]`
  }

  // @ts-ignore
  await payload.update({
    collection: SCHEDULED_ACTIONS_COLLECTION_SLUG,
    id: action.id,
    data: {
      status,
      log: [
        ...(action.log || []),
        {
          date: timestamp.toISOString(),
          message,
          code,
        },
      ],
    },
  })

  return {
    ...action,
    status,
    log: [
      ...(action.log || []),
      {
        date: timestamp.toISOString(),
        message,
        code,
      },
    ],
  }
}


const executeErrorLog = async (
  payload: BasePayload<GeneratedTypes>,
  errorHooks: ((args: ErrorLogFunctionArgs) => Promise<void>)[],
  action: ScheduledAction,
  message: string,
  code?: number
) => {
  if (errorHooks.length === 0) {
    return
  }

  for (const hook of errorHooks) {
    if (typeof hook === 'function') {
      await hook({payload, action, message, code})
    }
  }
}


const rescheduleAction = async (payload: BasePayload<GeneratedTypes>, action: ScheduledAction) => {

  if (!action.cronExpression) {
    throw new Error('Cannot reschedule an action without a cron expression')
  }

  // @ts-ignore
  let nextScheduledDate = action.scheduledDateTime ? new Date(action.scheduledDateTime) : new Date()

  do {
    // @ts-ignore
    nextScheduledDate = parseExpression(action.cronExpression, {
      currentDate: nextScheduledDate,
      iterator: true,
    }).next().value.toDate() // will throw an error if not correct expression
  } while (nextScheduledDate.getTime() <= new Date().getTime())

  // check if the same action is already present in the queue
  // @ts-ignore
  const isScheduled = await isActionScheduled(payload, action.endpoint, nextScheduledDate, 'pending')
  if (isScheduled) {
    return action
  }

  return payload.create({
    collection: SCHEDULED_ACTIONS_COLLECTION_SLUG,
    data: {
      ...action,
      scheduledDateTime: nextScheduledDate.toISOString(),
      status: 'pending',
      log: [
        {
          date: new Date().toISOString(),
          message: 'Action re-scheduled',
        },
      ],
    },
  })
}

export const updateActionSchedulerStatus = async (payload: BasePayload<GeneratedTypes>, startTime: Date, endTime: Date, totalDocs: number, errorCount: number) => {
  await payload.updateGlobal({
    slug: 'action-scheduler-info',
    data: {
      lastRun: startTime.toISOString(),
      lastQueDuration: endTime.getTime() - startTime.getTime(),
      totalQueDocs: totalDocs,
      errorCount: errorCount,
    },
  })
}
