'use client'

import React from 'react'
import { useTableCell } from '@payloadcms/ui/elements/Table/TableCellProvider'

const ArgumentCell = () => {
  const {cellData } = useTableCell();

  return <code className="json-cell">{JSON.stringify(cellData)}</code>;
}

export default ArgumentCell
