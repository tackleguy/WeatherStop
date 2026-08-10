/** Build the alerts-page URL for a specific NWS alert id. */
export function alertsPageHref(alertId: string): string {
  return `/alerts?id=${encodeURIComponent(alertId)}`;
}
