import { GlobalConfig} from 'payload/types';

export const ActionSchedulerInfo: GlobalConfig = {
  slug: 'action-scheduler-info',
  admin: {
    hidden: true,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'lastRun',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
            width: '50%'
          },
        },
        {
          name: 'lastQueDuration',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'The duration of the last run in milliseconds',
            width: '50%'
          },
        }
      ]
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalQueDocs',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'The total number of documents processed in the queue',
            width: '50%'
          },
        },
        {
          name: 'errorCount',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'The total number of errors encountered',
            width: '50%'
          }
        }
      ]
    }
  ]
}
