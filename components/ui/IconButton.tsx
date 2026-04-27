import { ButtonHTMLAttributes, forwardRef } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'ghost' | 'outline';
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ size = 'md', variant = 'ghost', className = '', children, ...props }, ref) => {
        const sizeClasses = {
            sm: 'w-7 h-7 text-sm',
            md: 'w-9 h-9 text-base',
            lg: 'w-11 h-11 text-lg',
        };

        const variantClasses = {
            default: 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]',
            ghost: 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]',
            outline: 'border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]',
        };

        return (
            <button
                ref={ref}
                className={`
                    inline-flex items-center justify-center
                    rounded-full
                    transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${sizeClasses[size]}
                    ${variantClasses[variant]}
                    ${className}
                `}
                {...props}
            >
                {children}
            </button>
        );
    }
);

IconButton.displayName = 'IconButton';

export default IconButton;