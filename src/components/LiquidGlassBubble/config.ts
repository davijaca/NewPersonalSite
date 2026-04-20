export type GlassConfig = {
  width: number;
  height: number;
  radius: number;
  border: number;
  alpha: number;
  lightness: number;
  blur: number;
  scale: number;
  r: number;
  g: number;
  b: number;
  displace: number;
  frost: number;
  saturation: number;
  blend: string;
  x: 'R' | 'G' | 'B';
  y: 'R' | 'G' | 'B';
};

export const defaultGlassConfig: GlassConfig = {
  width: 140,
  height: 140,
  radius: 70,
  border: 0.07,
  alpha: 0.93,
  lightness: 50,
  blur: 11,
  scale: -180,
  r: 0,
  g: 10,
  b: 20,
  displace: 0,
  frost: 0,
  saturation: 1,
  blend: 'difference',
  x: 'R',
  y: 'B',
};
