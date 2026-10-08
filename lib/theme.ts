// Design tokens from the "Quiet Dark" handoff (resources/README.md).

export const colors = {
  bg: '#16191d',
  surface: '#1f2429',
  row: '#262b31',
  raised: '#2c3238',
  line: '#3a4148',
  text: '#e6e8ea',
  muted: '#8b939b',
  dimLine: '#4a525a',
  sage: '#8fc4ab',
  sagePressed: '#7bb399',
  destructive: '#e8a29a',
  scrim: 'rgba(5,6,7,.6)',
  // Unchecked checkbox ring in the add-workout sheet.
  checkRing: '#5a626a',
  // Text drawn on top of sage fills.
  onSage: '#16191d',
} as const;

// Custom fonts ignore `fontWeight`, so each weight is its own family.
export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

export const layout = {
  screenPadding: 20,
  // Scroll content bottom padding so the floating tab bar never covers it.
  tabBarClearance: 120,
  minTapTarget: 44,
} as const;

// Logger stepper amounts (lb). Both are always on screen, so there's no step-size setting.
export const steps = {
  big: 5,
  small: 2.5,
} as const;
