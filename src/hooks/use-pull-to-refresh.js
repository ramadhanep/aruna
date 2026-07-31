"use client";

import { useCallback, useRef, useState } from "react";

export function usePullToRefresh({
  onRefresh,
  isRefreshing,
  enabled = true,
  containerRef = null,
  threshold = 80,
  maxDistance = 150,
}) {
  const touchStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);

  const isAtTop = useCallback(() => {
    if (containerRef?.current) {
      return containerRef.current.scrollTop <= 0;
    }
    return window.scrollY <= 5;
  }, [containerRef]);

  const handleTouchStart = useCallback(
    (event) => {
      if (!enabled) return;
      touchStartY.current = isAtTop() ? event.touches[0].clientY : 0;
    },
    [enabled, isAtTop]
  );

  const handleTouchMove = useCallback(
    (event) => {
      if (!enabled || isRefreshing || touchStartY.current === 0) return;
      if (!isAtTop()) {
        touchStartY.current = 0;
        setPullDistance(0);
        return;
      }
      const distance = event.touches[0].clientY - touchStartY.current;
      if (distance > 0) {
        setPullDistance(Math.min(distance, maxDistance));
      } else {
        setPullDistance(0);
      }
    },
    [enabled, isRefreshing, isAtTop, maxDistance]
  );

  const handleTouchEnd = useCallback(async () => {
    touchStartY.current = 0;
    if (pullDistance > threshold) {
      await onRefresh();
    }
    setPullDistance(0);
  }, [pullDistance, threshold, onRefresh]);

  return { pullDistance, handleTouchStart, handleTouchMove, handleTouchEnd };
}
