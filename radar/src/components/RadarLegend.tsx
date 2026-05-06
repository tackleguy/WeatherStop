// Compact dBZ scale anchored to the bottom-right of the map. The bands
// are the standard NEXRAD reflectivity colors so they line up visually
// with the NOAA mapservices PNG output. We don't recolor the data — the
// legend is purely informational.

const BANDS: Array<{ from: number; color: string }> = [
  { from: 45, color: '#E0E0E0' },
  { from: 40, color: '#FFFFFF' },
  { from: 35, color: '#9955C9' },
  { from: 30, color: '#FF00FF' },
  { from: 25, color: '#C00000' },
  { from: 20, color: '#D60000' },
  { from: 15, color: '#FF0000' },
  { from: 10, color: '#FF9000' },
  { from: 5, color: '#E7C000' },
  { from: 0, color: '#FFFF00' },
  { from: -5, color: '#009000' },
  { from: -10, color: '#00C800' },
  { from: -15, color: '#00FF00' },
  { from: -20, color: '#0000F6' },
  { from: -25, color: '#01A0F6' },
  { from: -30, color: '#00ECEC' },
];

export function RadarLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex select-none gap-2">
      <div className="flex flex-col-reverse rounded-md border border-white/8 bg-black/55 backdrop-blur-md">
        {BANDS.map((b) => (
          <div
            key={b.from}
            className="h-[14px] w-9"
            style={{ background: b.color }}
            title={`${b.from} dBZ`}
          />
        ))}
      </div>
      <div className="flex flex-col-reverse justify-between py-0 text-[10px] font-medium text-white/75">
        <span>-30</span>
        <span>0</span>
        <span>30</span>
        <span>45+</span>
      </div>
    </div>
  );
}
