# UI Architecture

## Layout Structure

```
RootLayout (src/app/layout.jsx)
├── ThemeProvider (next-themes)
├── AuthProvider (auth context)
├── TrialProvider (trial gating)
├── AppearanceModeProvider (pro/lite mode)
├── PWARegister + PWAInstallDialog
├── TrialGuard
└── AppLayoutClient
    ├── TrialBanner
    ├── AccountSidebar (slide-out)
    ├── DesktopNavbar (hidden on mobile/tablet)
    ├── Mobile Header (hidden on lg+)
    ├── Page Content
    ├── MobileBottomNav (hidden on lg+)
    └── DesktopSidebar (optional, hidden)
```

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 768px | Mobile header, bottom nav, single column content |
| Tablet | 768px - 1024px | Mobile header, bottom nav, wider content |
| Desktop | > 1024px (`lg` in Tailwind) | Desktop navbar, left sidebar, full-width content |

- Mobile breakpoint hook: `src/hooks/use-mobile.js` (threshold: 1024px).
- Content max-width on mobile: `768px`. Desktop: `1400px`.

## Navigation

### Desktop (≥ 1024px)

**Top Navbar** (`DesktopNavbar`): Logo, nav links (Explore, Supercharts, Watchlist, Portfolio), Tools dropdown, symbol search input, theme toggle, profile button.

### Mobile (< 1024px)

- **Header**: Account menu (left), logo (center), symbol search (right).
- **Bottom Nav**: 4 icons — Watchlist, Supercharts, Explore, Portfolio. Auto-minimizes on scroll down.
- **Back Header**: Shown on certain tool pages (idx-momentum, msci).

## Page Layout

```
┌─────────────────────────────────────────────┐
│ DesktopNavbar (hidden on mobile)            │
├──────────┬──────────────────────────────────┤
│ Sidebar  │ Content area                      │
│ (hidden  │ max-w-[768px] (mobile)            │
│  on mobile) │ max-w-[1400px] (desktop)       │
│          │                                    │
│          │ Padding: p-4 (mobile), p-6 (desk) │
├──────────┴──────────────────────────────────┤
│ MobileBottomNav (hidden on desktop)         │
└─────────────────────────────────────────────┘
```

## Styling

- **Framework**: Tailwind CSS v4.
- **Design tokens**: CSS custom properties in `globals.css` (`:root` and `.dark`).
- **Color space**: `oklch()`.
- **Theme**: Dark by default (`defaultTheme="dark"`).
- **Component variants**: `class-variance-authority` (cva) for button variants.
- **Class merging**: `cn()` utility (clsx + tailwind-merge).
- **Animations**: `tw-animate-css` for transitions.

## Visual Mode (`AppearanceModeProvider`)

Two visual modes:
- **Pro**: Shows ticker logo images (default).
- **Lite**: Hides ticker logo images for faster loading.

## Theme (`ThemeProvider`)

Three theme options from `next-themes`:
- Light
- Dark (default)
- System

## Key UI Patterns

### Card Hover Effect
```css
.card-hover:hover {
  transform: scale(1.01);
}
```

### Shimmer Loading
```css
.shimmer::after {
  animation: shimmer-slide 1.6s ease-in-out infinite;
}
```

### Glass Effect
Backdrop blur utility classes defined as custom CSS.

### Fade In
```css
.fade-in {
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

## Component Architecture

- **Pages** import and compose feature components.
- **Feature components** use UI primitives from `src/components/ui/`.
- **UI primitives** are styled via `cn()` with Tailwind classes.
- No CSS modules, styled-components, or CSS-in-JS.
