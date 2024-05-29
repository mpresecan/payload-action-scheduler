'use client'

import React, { useEffect, useTransition } from 'react'
import { Button } from '@payloadcms/ui/elements/Button'

import '../index.scss'
import { useRefresh } from '../../hooks/useRefresh'
import { stringifyDiff } from '../../helpers/time-client'
import { LoaderIcon, PlayIcon, RefreshIcon } from '../Icons'

const SCHEDULED_ACTIONS_COLLECTION_SLUG = 'scheduled-actions'
const SCHEDULED_ACTIONS_ENDPOINT = '/run'

const BeforeScheduledActionsList = () => {
  const [isRunning, startRunningTransition] = useTransition()
  const [lastRun, setLastRun] = React.useState<Date | null>()
  const [duration, setDuration] = React.useState<number | null>()
  const [totalDocs, totalActions] = React.useState<number | null>()
  const [errorCount, setErrorCount] = React.useState<number | null>()
  const { refresh } = useRefresh()


  const onRunActionQueue = () => {
    startRunningTransition(async () => {
      const results = await fetch(`/api/${SCHEDULED_ACTIONS_COLLECTION_SLUG}${SCHEDULED_ACTIONS_ENDPOINT}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      refresh()
      // set last run from results
      const data = await results.json()
      setLastRun(new Date(data.startedAt))
      totalActions(data.numberOfActions)
      setDuration(data.duration)
      setErrorCount(data.errorCount)
    })
  }

  useEffect(() => {
    const fetchLastRun = async () => {
      const results = await fetch(`/api/globals/action-scheduler-info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const data = await results.json()

      setLastRun(new Date(data.lastRun))
      totalActions(data.totalQueDocs)
      setDuration(data.lastQueDuration)
      setErrorCount(data.errorCount)
    }
    fetchLastRun()
  }, [])

  const lastRunString = lastRun ? <><span
    className="doc-controls__value">Last run:</span> {lastRun && stringifyDiff(new Date().getTime() - lastRun.getTime())} ago</> : null
  const totalDocsString = totalDocs ? <> | <span
    className="doc-controls__value">Actions:</span> {totalDocs !== 0 ? <>{totalDocs} total</> : 'none'}</> : null
  const errorCountString = errorCount && errorCount > 0 ? <>, {errorCount} error{errorCount > 1 && 's'}</> : null
  const durationString = duration ? <> | <span
    className="doc-controls__value">Duration:</span> {stringifyDiff(duration, true)}</> : null

  return (
    <div className="items-center justify-between action-table-commands">
      <div className="items-center gap">
        <Button size="small" onClick={onRunActionQueue} className={`icon-button ${isRunning && 'spin'}`}
                disabled={isRunning}>
          {isRunning ? <LoaderIcon /> : <PlayIcon />} Run Action Queue
        </Button>
        {!isRunning &&
          <span className="doc-controls__label">{lastRunString}{totalDocsString}{errorCountString}{durationString}</span>}
      </div>
      <Button buttonStyle="none" size="small" onClick={refresh}
              className="icon-button text-muted"><RefreshIcon /></Button>
    </div>
  )
}

export default BeforeScheduledActionsList
