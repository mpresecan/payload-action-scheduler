'use client'

import {useTableCell} from '@payloadcms/ui/elements/Table/TableCellProvider'
import '../index.scss'
import React from "react";
import {cronToHumanReadable} from "../../helpers/time-client";

const RecurringCell = () => {
  const {cellData} = useTableCell()

  return (
    <div>
      {!cellData ? 'Non-repeatable' :
        <React.Fragment>
          <span className='text-muted'>{cellData}</span><br/>
          {cronToHumanReadable(cellData)}
        </React.Fragment>
      }
    </div>
  )
}

export default RecurringCell
