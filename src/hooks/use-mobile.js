import * as React from "react"
import { MOBILE_BREAKPOINT } from "@/lib/time"

export function useIsMobile() {
  const subscribe = React.useCallback(
    (onStoreChange) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    []
  )

  const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT
  const getServerSnapshot = () => false

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
