import { Thermometer } from 'lucide-react';
import { Card } from './Card';
import { comfortFor, dewPointComfort } from '../lib/comfort';
import { displayTemp } from '../lib/display';
import type { Settings, WeatherData } from '../types';

interface Props {
  data: WeatherData;
  settings: Settings;
  index?: number;
}

export function ComfortCard({ data, settings, index }: Props) {
  const c = data.current;
  const comfort = comfortFor({
    tempF: c.temp,
    rh: c.humidity,
    windMph: c.windSpeed,
    apparentF: c.feelsLike,
  });
  const dew = dewPointComfort(c.dewPoint);

  const tone = comfort.kind === 'wind-chill' ? '#7dd3fc' :
    comfort.kind === 'cold' ? '#bae6fd' :
    comfort.kind === 'humid' ? '#fbbf24' :
    comfort.kind === 'heat' ? '#fb923c' :
    comfort.kind === 'dry' ? '#fde68a' :
    'rgba(255,255,255,0.85)';

  return (
    <Card
      title="Feels Like"
      icon={Thermometer}
      index={index}
      meta={comfort.diff === 0 ? 'Same as actual' : `${comfort.diff > 0 ? '+' : ''}${comfort.diff}° vs actual`}
    >
      <div className="flex items-baseline gap-3">
        <span className="card-value text-white">
          {displayTemp(comfort.feelsLikeF, settings)}
        </span>
        <span className="text-[14px] font-medium" style={{ color: tone }}>
          {comfort.label}
        </span>
      </div>
      <p className="mt-2 text-[13px] text-white/75">{comfort.reason}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
        <div>
          <div className="card-label">Humidity</div>
          <div className="mt-0.5 text-[18px] font-medium tabular text-white">
            {Math.round(c.humidity)}%
          </div>
          <div className="card-sub mt-0.5">
            Dew {displayTemp(c.dewPoint, settings)}
          </div>
        </div>
        <div>
          <div className="card-label">Air comfort</div>
          <div className="mt-0.5 text-[14px] font-medium" style={{
            color: dew.tone === 'oppressive' ? '#fb923c' :
              dew.tone === 'sticky' ? '#fbbf24' :
              dew.tone === 'okay' ? '#a3e635' :
              '#86efac',
          }}>
            {dew.label}
          </div>
          <div className="card-sub mt-0.5">
            Based on dew point
          </div>
        </div>
      </div>
    </Card>
  );
}
