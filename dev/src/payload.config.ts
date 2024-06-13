import { buildConfig } from 'payload/config'
import path from 'path'
import Users from './collections/Users'
import Examples from './collections/Examples'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { actionScheduler } from '../../src'

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor({}),
  collections: [Examples, Users],
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  plugins: [actionScheduler({
    enabled: true,
    actions: [
      {
        endpoint: 'test',
        async handler(payload, args) {
          console.log('Running test action', args, typeof args)
          return 'some message in return';
        }
      },
      {
        endpoint: 'test2',
        handler: async (payload, args) => {
          console.log('Running test2 action', args, typeof args)
        }
      },
      {
        endpoint: 'long-running-action',
        handler: async (payload, args) => {
          console.log('Running long-waiting-action action', args, typeof args)
          await new Promise(resolve => setTimeout(resolve, 25000));
        }
      }
    ],
    errorHooks: [
      async ({ payload, action, message, code }) => {
        console.error('ERROR LOG 1:', { action, message, code })
      },
      async ({ payload, action, message, code }) => {
        console.error('ERROR LOG 2:', { action, message, code })
      }
    ],
    debug: true,
    timeoutSeconds: 10,
    runtime: 'serverless',
  })],
  graphQL: {
    disable: true,
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
})
