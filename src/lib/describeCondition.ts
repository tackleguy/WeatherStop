// Takes canonical °F. Display layer is responsible for converting before
// rendering — but the categorical bands here are always defined in °F.

export function describeCondition(tempF: number, code: number): string {
  const t =
    tempF < 40
      ? 'Cold'
      : tempF < 55
        ? 'Cool'
        : tempF < 75
          ? 'Mild'
          : tempF < 88
            ? 'Warm'
            : 'Hot';

  if (code === 0) return `${t} and clear`;
  if (code === 1) return `${t} and mostly clear`;
  if (code === 2) return `${t}, partly cloudy`;
  if (code === 3) return `${t} and cloudy`;
  if (code === 45 || code === 48) return `${t} and foggy`;
  if (code >= 51 && code <= 67) return `${t} and rainy`;
  if (code >= 80 && code <= 82) return `${t} with showers`;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return `${t} and snowy`;
  if (code >= 95) return 'Stormy';
  return t;
}
