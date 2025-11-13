"use client";

let lightweightChartsPromise;

export function loadLightweightCharts() {
  if (!lightweightChartsPromise) {
    lightweightChartsPromise = import("lightweight-charts");
  }
  return lightweightChartsPromise;
}
