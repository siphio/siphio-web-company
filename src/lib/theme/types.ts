// Theme type definitions — mirrors context/style-profile.yaml Section 9

export interface ThemePalette {
  background: string;
  surface: string;
  border: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  accent_primary: string;
  accent_secondary: string;
  accent_warm: string;
  cta_fill: string;
  cta_text: string;
}

export interface ThemeTypography {
  heading_font: string;
  heading_weight: number;
  accent_font: string;
  accent_weight: number;
  accent_style: string;
  body_font: string;
  body_weight: number;
  body_line_height: number;
}

export interface ThemeBorders {
  radius_sm: string;
  radius_md: string;
  radius_lg: string;
  radius_pill: string;
}

export interface ThemeShadows {
  card: string;
  elevated: string;
}

export interface ThemeEffects {
  grain: boolean;
  glassmorphism: boolean;
  mesh_gradient: boolean;
  soft_gradient: boolean;
}

export interface Theme {
  name: string;
  palette: ThemePalette;
  typography: ThemeTypography;
  borders: ThemeBorders;
  shadows: ThemeShadows;
  effects: ThemeEffects;
}

export interface BusinessProfileFeature {
  title: string;
  description: string;
}

export interface BusinessProfile {
  name: string;
  description: string;
  features: BusinessProfileFeature[];
  audience: string;
  industry?: string;
  brand_colors?: {
    primary: string;
    secondary?: string;
  };
  tone?: 'professional' | 'friendly' | 'bold' | 'minimal';
}
