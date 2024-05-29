import {BasePayload, GeneratedTypes, Payload} from 'payload'
import {AccessArgs} from "payload/types";

export interface PluginTypes {
  /**
   * Enable or disable plugin
   * @default false
   */
  enabled?: boolean

  /**
   * Enable or disable debug mode
   */
  debug?: boolean

  /**
   * Runtime environment
   */
  runtime?: 'serverless' | 'node-server',

  /**
   * Given array of function which will be called when error occurs
   */
  errorHooks?: ((args: ErrorLogFunctionArgs) => Promise<void>)[],

  /**
   * Access control for creating scheduled actions
   * @default true every user can create
   */
  createAccess?: (args: AccessArgs) => boolean

  /**
   * Access control for reading scheduled actions
   * @default true every user can read
   */
  readAccess?: (args: AccessArgs) => boolean

  /**
   * An array of action function with corresponding endpoint and handler function
   */
  actions?: ActionDefinition[]

  /**
   * In Serverless runtime lambda functions have a timeout limit, please specify it for your environment
   * @default 60 seconds for Vercel Hobby plan
   */
  timeoutSeconds?: number,

  /**
   * Base URL for the API routes
   * @default '/api'
   */
  apiURL?: string,
}

export interface ErrorLogFunctionArgs{
  payload: Payload,
  action: GeneratedTypes["collections"]["scheduled-actions"],
  message: string,
  code?: number,
}

export type ArgumentsType = string | number | boolean | { [k: string]: unknown; } | unknown[] | null | undefined;

/**
 * Type for adding an action to the queue
 */
export type AddActionType = {
  /**
   * The endpoint to call (required)
   */
  endpoint: string,
  args?: ArgumentsType,
  group?: string,
  scheduledAt?: Date,
  cronExpression?: string,
  priority?: number,
}

export type GetActionType = AddActionType & {
  status?: GeneratedTypes["collections"]["scheduled-actions"]['status'],
}

export type ActionDefinition = {
  endpoint: string
  handler: (payload: Payload, args?: ArgumentsType) => Promise<any>
}

export interface RunActionArgs {
  payload: BasePayload<GeneratedTypes>;
  action: GeneratedTypes["collections"]["scheduled-actions"];
  timeoutSeconds: number;
  actionHandlers: ActionDefinition[];
  errorHooks: ((args: ErrorLogFunctionArgs) => Promise<void>)[];
  apiURL: string;
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}
