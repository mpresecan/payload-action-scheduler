import { buildConfig } from 'payload/config'
import path from 'path'
import Users from './collections/Users'
import Examples from './collections/Examples'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { actionScheduler } from '../../src'
import sharp from 'sharp'

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
        endpoint: 'long-running-action',
        handler: async (payload, args) => {
          console.log('Running long-waiting-action action', args, typeof args)
          await new Promise(resolve => setTimeout(resolve, 25000));
        }
      }
    ]
  })],
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  sharp,
})
