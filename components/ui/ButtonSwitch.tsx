import React from 'react';

interface ButtonSwitchOption {
    label: string | React.ReactNode;
    value: string;
}

interface ButtonSwitchProps {
    options: ButtonSwitchOption[];
    value?: string;
    className?: string;
    onClick?: (href: string) => void;
}

export default function ButtonSwitch({ options, value, className = '', onClick }: ButtonSwitchProps) {
    return (
        <div className={`flex gap-1 ${className}`}>
            {options.map((option) => (
                <div
                    key={option.value}
                    className={`min-w-[56px] h-[38px] flex items-center justify-center rounded-md transition-colors ${
                        value === option.value ? 'bg-(--bg-secondary) text-(--text-primary)' : 'text-(--text-secondary) hover:text-(--text-primary)'
                    }`}
                    onClick={(e) => {
                        if (onClick) {
                            e.preventDefault();
                            onClick(option.value);
                        }
                    }}
                >
                    {option.label}
                </div>
            ))}
        </div>
    );
}