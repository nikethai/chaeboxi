type SessionRouteQueryState<T> = {
  session: T | null | undefined
  isPending: boolean
  isError: boolean
}

export function getSessionRouteState<T>({ session, isPending, isError }: SessionRouteQueryState<T>) {
  if (session) {
    return 'loaded' as const
  }
  if (isPending) {
    return 'loading' as const
  }
  if (isError) {
    return 'error' as const
  }
  return 'not-found' as const
}
