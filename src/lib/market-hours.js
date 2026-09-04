/**
 * Check if the current time in a given timezone is within market hours.
 * Returns false on weekends.
 */
export function isWithinMarketHours(timeZone, openHour, openMinute, closeHour, closeMinute) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const weekday = (get("weekday") || "").slice(0, 3).toLowerCase();
    if (weekday === "sat" || weekday === "sun") return false;
    const totalMinutes = hour * 60 + minute;
    const open = openHour * 60 + openMinute;
    const close = closeHour * 60 + closeMinute;
    return totalMinutes >= open && totalMinutes <= close;
  } catch (error) {
    console.warn(`Failed to check market hours for ${timeZone}`, error);
    return false;
  }
}
