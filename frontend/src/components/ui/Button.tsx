import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-solid-bg text-solid-ink border-solid-bg hover:opacity-85',
  secondary: 'bg-surface text-ink border-line-strong hover:bg-hover',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-hover hover:text-ink',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`cursor-pointer rounded-[var(--radius-control)] border px-3.5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
