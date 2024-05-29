'use client'

import React from 'react'
import { useTableCell } from '@payloadcms/ui/elements/Table/TableCellProvider'
import { ScheduledAction } from '../../types'
import { Pill, PillProps } from '@payloadcms/ui/elements/Pill'

const StatusCell = () => {
  const cellContext = useTableCell()
  const cellData = cellContext.cellData as ScheduledAction['status']
  let pillStyle: PillProps['pillStyle'] = 'light-gray'

  if (cellData === 'completed') pillStyle = 'success'
  if (cellData === 'failed' || cellData === 'timeout') pillStyle = 'error'
  if (cellData === 'cancelled') pillStyle = 'warning'
  if (cellData === 'running') pillStyle = 'dark'

  return (
    <Pill pillStyle={pillStyle}>
      {cellData}
    </Pill>
  )
}

export default StatusCell
