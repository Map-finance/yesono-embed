/**
 * 主题配置
 * 定义完整的主题系统，包括颜色、字体、间距等
 */

export interface Theme {
  name: string;
  colors: {
    // 背景色
    bg: {
      primary: string;
      secondary: string;
      card: string;
      hover: string;
    };
    // 文字色
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    // 主题色
    accent: {
      primary: string;
      secondary: string;
      hover: string;
    };
    // 状态色
    status: {
      success: string;
      error: string;
      warning: string;
      info: string;
    };
    // 边框色
    border: {
      default: string;
      light: string;
      dark: string;
    };
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
    sizes: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    weights: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
}

/**
 * 默认主题（深色主题）
 */
export const defaultTheme: Theme = {
  name: 'dark',
  colors: {
    bg: {
      primary: '#111111',
      secondary: '#1a1a1a',
      card: '#1e1e1e',
      hover: '#2a2a2a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
      tertiary: '#808080',
      inverse: '#000000',
    },
    accent: {
      primary: '#FFD608',
      secondary: '#FFE44D',
      hover: '#FFC700',
    },
    status: {
      success: '#00ff00',
      error: '#ff4757',
      warning: '#ffa502',
      info: '#3742fa',
    },
    border: {
      default: '#2a2a2a',
      light: '#3a3a3a',
      dark: '#1a1a1a',
    },
  },
  fonts: {
    primary: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    secondary: 'system-ui, -apple-system, sans-serif',
    mono: 'Menlo, Monaco, "Courier New", monospace',
    sizes: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
    },
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },
  borderRadius: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  transitions: {
    fast: '150ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
};

/**
 * 浅色主题
 */
export const lightTheme: Theme = {
  ...defaultTheme,
  name: 'light',
  colors: {
    bg: {
      primary: '#ffffff',
      secondary: '#f5f5f5',
      card: '#fafafa',
      hover: '#e5e5e5',
    },
    text: {
      primary: '#000000',
      secondary: '#4a4a4a',
      tertiary: '#808080',
      inverse: '#ffffff',
    },
    accent: {
      primary: '#FFD608',
      secondary: '#FFE44D',
      hover: '#FFC700',
    },
    status: {
      success: '#00c853',
      error: '#d32f2f',
      warning: '#f57c00',
      info: '#1976d2',
    },
    border: {
      default: '#e0e0e0',
      light: '#f0f0f0',
      dark: '#d0d0d0',
    },
  },
};

/**
 * 主题映射
 */
export const themes: Record<string, Theme> = {
  dark: defaultTheme,
  light: lightTheme,
};

