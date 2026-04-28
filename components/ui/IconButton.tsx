import { ButtonHTMLAttributes, forwardRef } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'ghost' | 'outline-solid';
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ size = 'md', variant = 'ghost', className = '', children, ...props }, ref) => {
        const sizeClasses = {
            sm: 'w-7 h-7 text-sm',
            md: 'w-9 h-9 text-base',
            lg: 'w-11 h-11 text-lg',
        };

        const variantClasses = {
            default: 'bg-(--bg-secondary) hover:bg-(--bg-hover) text-(--text-primary)',
            ghost: 'hover:bg-(--bg-hover) text-(--text-secondary)',
            outline: 'border border-(--border-color) hover:bg-(--bg-hover) text-(--text-secondary)',
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