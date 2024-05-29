import crypto from 'crypto'
import { ArgumentsType } from '../types'

import { createPayloadRequest } from '@payloadcms/next/utilities'
import { PayloadRequest } from 'payload/types'

export const ActionSchedulerRoute = (handler: (request: PayloadRequest, args?: ArgumentsType) => Promise<Response> | Response) => {
  return async (request: Request) => {
    // Get the signature and arguments from the request headers
    const signature = request.headers.get('X-Action-Scheduler-Signature')
    let args = request.headers.get('X-Scheduled-Action-Args')

    // Generate the expected signature
    const generatedSignature = generateSignature(args)

    // Validate the signature
    if (signature !== generatedSignature) {
      return new Response('Invalid Signature', { status: 401 })
    }

    const payloadRequest = await createPayloadRequest({
      config, // TODO: how to get config? or is there another way to get payload request?
      request,
    })

    args = args ? JSON.parse(args) : undefined;

    // If the signature is valid, proceed to the handler
    return handler(payloadRequest, args)
  }
}

export const generateSignature = (body?: string | null) => {

  body = body || 'undefined' // sometimes body returns 'undefined' as string

  const secret = process.env.PAYLOAD_SECRET

  if (!secret) throw new Error('Payload secret is required')

  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}
