const TIMEZONE_MODE = String(import.meta.env.VITE_TIMEZONE_MODE || 'local').trim().toLowerCase()
const USE_EASTERN_TIME = TIMEZONE_MODE === 'est' || TIMEZONE_MODE === 'eastern' || TIMEZONE_MODE === 'et'
const EASTERN_TIMEZONE = 'America/New_York'

function toDate(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getTimezoneOptions(includeDate = true) {
  const base = includeDate
    ? {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }
    : {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }

  if (!USE_EASTERN_TIME) {
    return base
  }

  return {
    ...base,
    timeZone: EASTERN_TIMEZONE,
    timeZoneName: 'short'
  }
}

export function formatDateTime(value) {
  const date = toDate(value)
  if (!date) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, getTimezoneOptions(true)).format(date)
}

export function formatTime(value) {
  const date = toDate(value)
  if (!date) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, getTimezoneOptions(false)).format(date)
}
