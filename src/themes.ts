/**
 * Theme catalog.
 */

export const THEMES = [
  {
    id: 'signal',
    label: 'Signal',
    description: 'Mist teal atmosphere with ink type and a live pulse accent.',
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral dark placeholder.',
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Light example theme.',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Read the currently active theme id from <html data-theme>. */
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'signal'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'signal'
}

/** Look up a theme entry by id, or fall back to the first theme. */
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
