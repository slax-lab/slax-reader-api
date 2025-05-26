export const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  if (!line.trim()) return []

  while (i < line.length) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i += 2
      } else {
        inQuotes = !inQuotes
        i++
      }
    } else if (char === ',' && !inQuotes) {
      result.push(processCSVField(current))
      current = ''
      i++
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      break
    } else {
      current += char
      i++
    }
  }

  result.push(processCSVField(current))

  return result
}

export const processCSVField = (field: string): string => {
  if (field.startsWith('"') && field.endsWith('"')) {
    field = field.slice(1, -1)
    field = field.replace(/""/g, '"')
  } else {
    field = field.trim()
  }

  return field
}
