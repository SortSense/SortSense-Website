import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const sizeStyles = {
    sm: 'min-h-[34px] px-3 py-1 text-xs rounded-lg gap-1.5',
    md: 'min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl gap-2',
    lg: 'min-h-[46px] px-5 py-2.5 text-sm font-semibold rounded-xl gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#176B45] text-white border border-[#0F4C35] hover:bg-[#0F4C35] shadow-xs hover:shadow-sm active:translate-y-[1px]',
    secondary:
      'bg-white text-[#202A25] border border-[#E1E8E1] hover:bg-[#E9F3ED] hover:border-[#CDE3D5] active:translate-y-[1px]',
    danger:
      'bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7] hover:bg-[#C84F49] hover:text-white active:translate-y-[1px]',
    ghost:
      'bg-transparent text-[#65736A] hover:text-[#176B45] hover:bg-[#E9F3ED]/50 active:translate-y-[1px]',
  };

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium transition-all select-none disabled:opacity-50 disabled:pointer-events-none ${
        sizeStyles[size]
      } ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
