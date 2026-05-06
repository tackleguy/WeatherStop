export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): T & { cancel: () => void } {
  let timer: number | undefined;
  const wrapped = ((...args: Parameters<T>) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer) window.clearTimeout(timer);
  };
  return wrapped;
}
