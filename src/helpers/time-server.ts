export function stringifyDiff(diffTime: number) {
  const minutes = Math.floor(diffTime / (1000 * 60))
  const seconds = Math.floor((diffTime % (1000 * 60)) / 1000)
  const milliseconds = diffTime % 1000

  let result = ''

  if (minutes > 0) {
    result += minutes + 'min '
  }

  if (seconds > 0 || minutes > 0) {
    result += seconds + 'sec '
  }

  result += milliseconds + 'ms'

  return result.trim()
}
