interface Props {
  color?: string;
  size?: number;
}

export function PulseDot({ color = 'var(--sev-severe)', size = 8 }: Props) {
  return (
    <span
      aria-hidden
      className="relative inline-block animate-pulse-dot"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 0 2px ${color}33, 0 0 8px ${color}99`,
      }}
    />
  );
}
