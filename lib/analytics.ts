export function trackReportDownload() {
  if (typeof window === "undefined") return;

  const endpoint = "/api/analytics/report-download";

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      const blob = new Blob([], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    } catch {
      // Fallback to fetch below.
    }
  }

  fetch(endpoint, {
    method: "POST",
    keepalive: true,
    credentials: "omit",
  }).catch(() => {});
}
