import { motion, type HTMLMotionProps } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'title'> {
  title?: string;
  icon?: LucideIcon;
  /** Right-aligned summary text inside the card header. e.g. "Updated 4m ago" */
  meta?: string;
  children: ReactNode;
  index?: number;
  innerClassName?: string;
}

export function Card({
  title,
  icon: Icon,
  meta,
  children,
  index = 0,
  className = '',
  innerClassName = '',
  ...rest
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: 0.06 + index * 0.06,
        ease: [0.4, 0, 0.2, 1],
      }}
      whileTap={{ scale: 0.985 }}
      className={`panel panel-padded ${className}`}
      {...rest}
    >
      {title ? (
        <header className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-3">
          {Icon ? (
            <Icon
              className="h-3.5 w-3.5"
              strokeWidth={1.6}
              style={{ color: 'var(--accent)' }}
            />
          ) : null}
          <span className="card-label">{title}</span>
          {meta ? <span className="ml-auto card-meta">{meta}</span> : null}
        </header>
      ) : null}
      <div className={innerClassName}>{children}</div>
    </motion.div>
  );
}
