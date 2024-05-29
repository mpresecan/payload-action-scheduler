'use client'

import { useTableCell } from '@payloadcms/ui/elements/Table/TableCellProvider'

const GroupCell = () => {
  const {cellData } = useTableCell();

  return cellData;
}

export default GroupCell
