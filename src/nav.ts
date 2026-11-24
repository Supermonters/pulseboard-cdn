/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar.
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
  devOnly?: boolean
}

export const nav: NavItem[] = [
  { path: '/', label: 'Home' },
  { path: '/board', label: 'Board', roles: ['member' as Role, 'admin' as Role] },
  { path: '/settings', label: 'Settings', roles: ['member' as Role, 'admin' as Role] },
]
