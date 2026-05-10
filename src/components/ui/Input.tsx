import React from 'react';
import { clsx } from 'clsx';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, fullWidth, icon, ...props }, ref) => {
    return (
      <div className={clsx('input-group', fullWidth && 'w-full', className)}>
        {label && <label className="input-label">{label}</label>}
        <div className="input-wrapper">
          {icon && <span className="input-icon">{icon}</span>}
          <input
            ref={ref}
            className={clsx('input-field', icon && 'has-icon', error && 'has-error')}
            {...props}
          />
        </div>
        {error && <span className="input-error">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
