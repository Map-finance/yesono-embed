import * as React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  fullWidth?: boolean
  as?: "input"
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  fullWidth?: boolean
  as: "textarea"
}

type Props = InputProps | TextareaProps

const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(
  ({ className = "", error = false, fullWidth = false, as = "input", ...props }, ref) => {
    const baseStyles = `
      px-3 py-2
      bg-[--bg-secondary]
      border border-[--border]
      rounded-md
      text-[--text-primary]
      placeholder:text-[--text-tertiary]
      transition-colors
      focus:outline-none
      focus:ring-2
      focus:ring-blue-500
      focus:border-transparent
      disabled:opacity-50
      disabled:cursor-not-allowed
      hover:border-[var(--border-hover)]
      ${error ? "border-red-500 focus:ring-red-500" : ""}
      ${fullWidth ? "w-full" : ""}
      ${as === "textarea" ? "resize-none" : ""}
      ${className}
    `

    if (as === "textarea") {
      return (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          className={baseStyles}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      )
    }

    return (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        className={baseStyles}
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    )
  }
)

Input.displayName = "Input"

export default Input