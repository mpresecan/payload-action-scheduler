'use client'

import React from 'react'
import { useTableCell } from '@payloadcms/ui/elements/Table/TableCellProvider'
import {stringifyDiff} from "../../helpers/time";

const ScheduleDateCell = () => {
  const { cellData, rowData } = useTableCell()

  if (!cellData) return 'async'

  const now = new Date();
  const future = new Date(cellData);
  const diffTime = future.getTime() - now.getTime();

  let diffString = '';

  if(diffTime < 0) {
    if(rowData.status === 'pending') {
      diffString = 'the next queue';
    } else {
      diffString = 'the past';
    }
  } else {
    diffString = stringifyDiff(diffTime);
  }

  const date = new Date(cellData).toISOString();

  if(diffString === 'the past') return date;

  return (
    <>
      {date} <br /> ({`In ${diffString}`})
    </>
  )
}

export default ScheduleDateCell
