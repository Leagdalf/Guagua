import { useEffect, useSyncExternalStore } from "react";
import { getNeedRefresh, registerServiceWorker, reloadForUpdate, subscribeUpdate } from "./register";

export interface UpdateState {
  /** Eine neue Version wartet. */
  ready: boolean;
  /** Aktiviert die neue Version und lädt neu. */
  reload: () => void;
}

/** Meldet den Service Worker an und sagt, ob eine neue Version bereitliegt. */
export function useUpdateNotice(): UpdateState {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  const ready = useSyncExternalStore(subscribeUpdate, getNeedRefresh, () => false);
  return { ready, reload: reloadForUpdate };
}
