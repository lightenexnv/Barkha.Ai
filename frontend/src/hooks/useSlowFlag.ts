import { useEffect, useState } from "react";

/** True once `active` has stayed true for `afterMs` (e.g. a request that is taking long). */
export const useSlowFlag = (active: boolean, afterMs = 8000) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!active) return;
    const timer = window.setTimeout(() => setSlow(true), afterMs);
    return () => window.clearTimeout(timer);
  }, [active, afterMs]);
  return slow;
};
