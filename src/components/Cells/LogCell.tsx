'use client'

import React from 'react'
import { useTableCell } from '@payloadcms/ui/elements/Table/TableCellProvider'
import { ScheduledAction } from '../../types'
import { stringifyDiff } from '../../helpers/time'

const LogCell = () => {
  const cellContext = useTableCell()

  const cellData = cellContext.cellData as ScheduledAction['log']

  if (!cellData) return '-'

  return (
    <ol>
      {cellData.map((log, index) => (
        <li key={index}><strong>{new Date(log.date).toLocaleString()}</strong>{index === 1 && <em>{' '}({stringifyDiff(new Date().getTime() - new Date(log.date).getTime())} ago)</em>}<br />{log.code && <code>{log.code}</code>}{log.code && ' ― '}{log.message}
        </li>
      ))}
    </ol>
  )
}

export default LogCell
