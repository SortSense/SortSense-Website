import React from 'react';

interface OperationsCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function OperationsCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  padding = 'md',
}: OperationsCardProps) {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={`bg-white rounded-lg border border-[#E1E8E1] ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 border-b border-[#E1E8E1]">
          <div className="min-w-0">
            {typeof title === 'string' ? (
              <h3 className="font-bold text-sm text-[#202A25] font-display">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <div className="text-xs text-[#65736A] mt-0.5 leading-relaxed">{subtitle}</div>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
    </div>
  );
}
