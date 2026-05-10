import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  hoverable = false,
  padding = 'md',
  className = '',
  children,
  onClick,
  ...props
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] transition-all duration-150',
        paddingClasses[padding],
        hoverable || onClick
          ? 'hover:border-[var(--accent)] hover:shadow-md cursor-pointer hover:-translate-y-0.5'
          : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
