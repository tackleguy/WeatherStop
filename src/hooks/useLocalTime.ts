import { useEffect, useState } from 'react';

// Returns "h:mm AM/PM" for the given timezone, ticking every 60 seconds.
export function useLocalTime(timezone?: string): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}
