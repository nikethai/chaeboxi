// (legacy comment removed)
export const formatNumber = (num: number, decimals: number = 0): string => {
  if (Math.abs(num) >= 1000000) {
    return decimals > 0 ? `${(num / 1000000).toFixed(decimals)}M` : `${Math.floor(num / 1000000)}M`
  } else if (Math.abs(num) >= 1000) {
    return decimals > 0 ? `${(num / 1000).toFixed(decimals)}K` : `${Math.floor(num / 1000)}K`
  }
  // (legacy comment)
  return num.toString()
}

// (legacy comment removed)
export const formatUsage = (used: number, total: number, decimals: number = 0): string => {
  return `${formatNumber(used, decimals)}/${formatNumber(total, decimals)}`
}
