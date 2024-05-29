export function stringifyDiff(diffTime: number, showMilliseconds = false) {
  const years = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
  const days = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);
  const milliseconds = diffTime % 1000;

  let result = '';
  if (years > 0) {
    result += years + ' year' + (years > 1 ? 's ' : ' ');
    result += months > 0 ? months + ' month' + (months > 1 ? 's ' : ' ') : '';
  } else if (months > 0) {
    result += months + ' month' + (months > 1 ? 's ' : ' ');
    result += days > 0 ? days + ' day' + (days > 1 ? 's ' : ' ') : '';
  } else if (days > 7) {
    result += days + ' day' + (days > 1 ? 's ' : ' ');
  } else if (days > 0) {
    result += days + ' day' + (days > 1 ? 's ' : ' ');
    result += hours > 0 ? hours + ' hour' + (hours > 1 ? 's ' : ' ') : '';
  } else if (hours > 0) {
    result += hours + ' hour' + (hours > 1 ? 's ' : ' ');
    result += minutes > 0 ? minutes + ' minute' + (minutes > 1 ? 's ' : ' ') : '';
  } else if (minutes > 0) {
    result += minutes + ' minute' + (minutes > 1 ? 's ' : ' ');
  } else if (seconds > 0 || !showMilliseconds ){
    result += seconds + ' second' + (seconds > 1 ? 's ' : ' ');
  }

  if (showMilliseconds && milliseconds > 0) {
    result += milliseconds + ' millisecond' + (milliseconds > 1 ? 's ' : ' ');
  }

  return result.trim();
}



function isInteger(str: string) {
  return /^\d+$/.test(str)
}

function formatNumber(num: number) {
  return num < 10 ? `0${num}` : num.toString()
}

export function cronToHumanReadable(cronExpression: string): string {

  if (!cronExpression) {
    return ''
  }

  const parts = cronExpression.split(' ')
  if (parts.length < 5 || parts.length > 6) {
    throw new Error('Invalid cron expression')
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


  let second = '-'
  let minute = parts[0]
  let hour = parts[1]
  let dayOfMonth = parts[2]
  let month = parts[3]
  let dayOfWeek = parts[4]

  const includeSeconds = parts.length === 6
  if (includeSeconds) {
    second = parts[0]
    minute = parts[1]
    hour = parts[2]
    dayOfMonth = parts[3]
    month = parts[4]
    dayOfWeek = parts[5]
  }

  function segmentText(segment: string, option: 'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek', includeSeconds = false, inList = false, inRepeater = false) {

    let text = ''

    if (segment === '*') {
      if (option === 'minute' && !includeSeconds) return 'every minute'
      if (option === 'second') return 'every second'
      return ''
    }

    const optionLabel = option === 'dayOfMonth' ? 'day-of-month' : option === 'dayOfWeek' ? 'day-of-week' : option

    // separate commas
    const segments = segment.split(/,(?<!\/\d+)/)
    if (segments.length > 1) {
      segments.forEach((subText, index) => {
        text = text + segmentText(subText, option, includeSeconds, index !== 0) + (index === segments.length - 1 ? ' ' : (index === segments.length - 2 ? ' and ' : ', '))
      })
      return text.trimEnd()
    }

    if (segment.includes('/')) {
      const [start, intervalString] = segment.split('/')
      const interval = parseInt(intervalString)
      let string = interval === 1 ? `${interval}st` : interval == 2 ? `${interval}nd ` : interval > 3 ? `${interval}th ` : `${interval}rd `
      text = text + `every ${string} ${optionLabel} `

      if (start.includes('-')) {
        text = text + segmentText(start, option, includeSeconds, inList, true)
      }

      if (isInteger(start)) {
        let startPeriod = start
        let endPeriod = '59'
        switch (option) {
          case 'dayOfWeek':
            startPeriod = daysOfWeek[parseInt(start)]
            endPeriod = daysOfWeek[7]
            break
          case 'dayOfMonth':
            endPeriod = '31'
            break
          case 'month':
            startPeriod = months[parseInt(start)]
            endPeriod = months[12]
            break
          case 'hour':
            endPeriod = '23'
            break
          default:
            break
        }

        text = text + `from ${startPeriod} through ${endPeriod}`
      }
    }

    if (segment.includes('-') && !segment.includes('/')) {
      const [start, end] = segment.split('-')
      let startPeriod = start
      let endPeriod = end
      switch (option) {
        case 'dayOfWeek':
          startPeriod = daysOfWeek[parseInt(start)]
          endPeriod = daysOfWeek[parseInt(end)]
          break
        case 'month':
          startPeriod = months[parseInt(start)]
          endPeriod = months[parseInt(end)]
          break
        default:
          break
      }
      const prefixed = !inRepeater ? `every ${optionLabel} ` : ''

      text = text + `${prefixed}from ` + startPeriod + ' through ' + endPeriod
    }

    if (isInteger(segment)) {
      let value = segment
      let prefix = ''
      switch (option) {
        case 'dayOfWeek':
          value = daysOfWeek[parseInt(segment)]
          break
        case 'month':
          value = months[parseInt(segment)]
          break
        default:
          prefix = !inList ? `${optionLabel} ` : ''
          break
      }
      text = `${prefix}${value}`
    }

    return text
  }

  const dayOfWeekString = segmentText(dayOfWeek, 'dayOfWeek', includeSeconds)
  const monthString = segmentText(month, 'month', includeSeconds)
  const dayOfMonthString = segmentText(dayOfMonth, 'dayOfMonth', includeSeconds)
  const hourString = isInteger(minute) && isInteger(hour) ? formatNumber(parseInt(hour)) : segmentText(hour, 'hour', includeSeconds)
  const minuteString = isInteger(minute) && isInteger(hour) ? formatNumber(parseInt(minute)) : segmentText(minute, 'minute', includeSeconds)
  const secondString = includeSeconds ? isInteger(minute) && isInteger(hour) && isInteger(second) ? ':' + formatNumber(parseInt(second)) : segmentText(second, 'second', includeSeconds) : ''

  let text = `${dayOfMonthString ? 'on ' + dayOfMonthString + ' ' : ''}${dayOfWeekString && dayOfMonthString ? 'and ' : ''}${dayOfWeekString ? 'on ' + dayOfWeekString + ' ' : ''}${monthString ? 'in ' + monthString : ''}`;

  if (isInteger(minute) && isInteger(hour) && (isInteger(second) || !includeSeconds)) {
    text = `${hourString}:${minuteString}${secondString} ${text}`
  } else {
    text = `${secondString ? secondString + ' ' : ''}${includeSeconds ? 'past the ' : ''}${minuteString ? minuteString + ' ' : ''}${hourString ? 'past ' + hourString + ' ' : ''}${text}`
  }

  return `At ${text.trim()}.`
}
