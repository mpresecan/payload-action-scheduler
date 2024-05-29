export const normalizeJSONString = (obj: any): string | undefined => {
  if (!obj) return

  const sortedObject = sortObjectKeys(obj)
  return JSON.stringify(sortedObject)
}

export function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key: string) => {
        result[key] = sortObjectKeys(obj[key])
        return result
      }, {})
  }
  return obj
}
