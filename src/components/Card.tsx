import { motion, type HTMLMotionProps } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'title'> {
  title?: string;
  icon?: LucideIcon;
  children: ReactNode;
  index?: number;
  innerClassName?: string;
}

export function Card({
  title,
  icon: Icon,
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
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      className={`glass rounded-3xl p-5 ${className}`}
      {...rest}
    >
      {title ? (
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
          {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2.2} /> : null}
          <span>{title}</span>
        </div>
      ) : null}
      <div className={innerClassName}>{children}</div>
    </motion.div>
  );
}
