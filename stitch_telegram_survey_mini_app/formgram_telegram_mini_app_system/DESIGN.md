---
name: FormGram Telegram Mini App System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style
The design system delivers an intuitive, calm, and trustworthy survey-taking and authoring interface optimized for Telegram's Mini App webview environment. It targets students, researchers, community managers, and casual survey respondents who demand instant readability and effortless tap interactions within an active messaging context.

The aesthetic fuses **Modern Corporate** reliability with **Soft Tech Minimalism**:
- **Clarity over novelty:** Immediate cognitive recognition of form elements, active progress states, and actionable choices.
- **Haptic-friendly lightness:** Crisp hairline surfaces floating over a soft backdrop to reduce eye strain during extended response flows.
- **Native cohesion:** Blends naturally into mobile messaging viewports (390px baseline) while maintaining balanced proportions when previewed in desktop Telegram clients.

## Colors
The palette is engineered for high legibility in mobile webviews under variable ambient lighting conditions.

- **Primary (`#2563EB`):** High-trust cobalt indigo used for primary action buttons, active selection rings, and linear progress fills. It maintains strong contrast against both white cards and the muted canvas.
- **Secondary (`#0EA5E9`):** Vibrant sky blue accent for metadata highlights, auxiliary actions, and active category pills.
- **Tertiary / Success (`#10B981`):** Emerald green for survey completion states, positive feedback badges, and verified author markers.
- **Neutral Canvas & Surfaces:**
  - Base canvas: `#F8FAFC` (Slate 50) provides soft warm tone separation without visual glare.
  - Interactive cards: Pure `#FFFFFF` (White) to anchor question blocks.
  - Borders: Crisp hairline `#E2E8F0` (Slate 200) defining bounded response zones.
- **Text Layers:**
  - Primary: `#0F172A` (Slate 900) for question stems, headers, and active options.
  - Secondary: `#64748B` (Slate 500) for instructions, hints, and placeholder text.
  - Tertiary: `#94A3B8` (Slate 400) for deactivated indicators and micro-meta labels.
- **Semantic Signals:**
  - Warning: `#F59E0B` (Amber 500)
  - Destructive / Error: `#EF4444` (Rose 500)

## Typography
Typographic rhythm relies on clean geometric sans-serif construction with high multilingual compatibility (pairing seamlessly with Pretendard or system Apple SD Gothic Neo for Korean glyph rendering).

- **Question Titles & Section Headers:** Set using `headline-md` and `headline-sm` with tight tracking (`-0.015em` to `-0.01em`) to maintain structural punch inside limited mobile widths.
- **Response Options & Labels:** Standardized on `body-lg` (16px) to eliminate automated iOS Safari zoom triggers on input focus, ensuring smooth form navigation.
- **Secondary Instructions & Helpers:** Formatted in `body-sm` (13px) and `label-md` (12px) using neutral slate variants to prevent visual clutter around critical touch elements.

## Layout & Spacing
The layout model operates as a mobile-first, fixed-width centered card viewport designed for Telegram's overlay frame.

- **Viewport Constraints:**
  - Mobile (Default): Fluid full-width between 320px and 430px (standard target 390px), clamped with an outer canvas padding of `margin` (16px).
  - Desktop Telegram Client / Webview: Centered shell with a strict `max-width: 480px`, presenting an elevated mock mobile frame against the client environment.
- **Rhythm & Grid:**
  - Base 4px layout scale with questions grouped as self-contained stacked vertical cards.
  - Inter-card spacing strictly utilizes `space-xl` (24px) for logical separation between survey question sets.
  - Intra-component gaps (e.g., between individual radio/checkbox choices) follow `space-md` (12px) to prevent mis-taps.
- **Safe Area Insets:**
  - Fixed sticky footer action bars reserve `env(safe-area-inset-bottom) + 12px` padding to avoid Telegram bottom navigation collisions.

## Elevation & Depth
Depth hierarchy relies on crisp surface separation rather than heavy physical drops, mirroring contemporary native micro-apps:

- **Level 0 (Canvas):** Tone `#F8FAFC`, flat, unbordered.
- **Level 1 (Card & Section Surfaces):** Pure `#FFFFFF` background with a subtle 1px hairline border in `#E2E8F0` and an ultra-soft ambient shadow (`box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`).
- **Level 2 (Interactive Floating Elements / Popovers / Sticky Nav):** Pure `#FFFFFF` accompanied by a refined dual shadow (`box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)`) with an accented border in `#CBD5E1`.
- **Level 3 (Focused & Selected State):** Layered focus ring with `0 0 0 3px rgba(37, 99, 235, 0.15)` combined with a crisp border shift to `#2563EB`.

## Shapes
The design uses friendly, ergonomic curvature centered around `rounded-xl` (12px to 16px radius) to soften technical survey structures without sacrificing density.

- **Question Cards & Containers:** Standardized on 16px radius (`rounded-2xl` in standard utility mapping) to provide gentle visual containment.
- **Input Fields & Option Rows:** 12px radius (`rounded-xl`), creating accessible, tap-friendly rectangular pills.
- **Action Buttons & Badges:** Primary interactive buttons adopt 12px radius; status pills and count badges remain fully rounded (`rounded-full`).

## Components

### Buttons
- **Primary Action (Next / Submit):** Full-width or auto-stretched, minimum height of 48px to satisfy Telegram mobile thumb-zone ergonomical guidelines. Background `#2563EB`, text `#FFFFFF`, font weight 600. Active state scales subtly (`scale-[0.99]`) with background `#1D4ED8`.
- **Secondary / Back Action:** Height 48px, background `#F1F5F9`, text `#334155`, hover/active `#E2E8F0`.
- **Ghost / Tertiary Action:** Minimum tap target 44px, text `#64748B`, hover text `#0F172A`.

### Survey Option Rows (Radio & Checkbox)
- **Container:** Full-width selectable card row, minimum height 52px, padding `12px 16px`, border 1.5px solid `#E2E8F0`, background `#FFFFFF`, rounded 12px.
- **Selected State:** Border color `#2563EB`, background `#EFF6FF` (Indigo 50), text `#1E40AF`.
- **Radio Indicator:** 20px circle, 2px border `#CBD5E1`. Selected: `#2563EB` solid fill with an inset 6px pure white dot.
- **Checkbox Indicator:** 20px rounded square (4px radius), 2px border `#CBD5E1`. Selected: `#2563EB` fill with centered white check icon.

### Input Fields & Textareas
- **Text Inputs:** Height 48px, horizontal padding 14px, 1px border `#CBD5E1`, background `#FFFFFF`, rounded 12px. Typography `body-lg` (`16px`) to avoid browser scaling bugs. Focus: `#2563EB` border with 3px `#DBEAFE` ambient halo ring.
- **Textarea:** Minimum height 104px, padding 12px 14px, matching border and focus behaviors.

### Survey Cards
- Question groupings encapsulated in isolated white cards. Top header includes question counter (`01 / 10`) set in `label-sm` (`#64748B`), bold question title in `headline-sm` (`#0F172A`), optional helper note in `body-sm` (`#64748B`), followed by response options stacked with 10px gaps.

### Progress Indicators
- **Step Header / Linear Bar:** Fixed or sticky top bar. Track height 4px, background `#E2E8F0`, rounded-full. Indicator `#2563EB` with smooth ease-out width transition. Counter badge alongside in `label-md` bold slate.

### Chips & Filter Pills
- Height 32px, padding 0 12px, rounded-full. Inactive: `#F1F5F9` background, `#475569` text. Active: `#2563EB` background, `#FFFFFF` text.