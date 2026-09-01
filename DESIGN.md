---
name: Reii 小店
description: A precise, inventory-led storefront for instantly delivered digital licenses.
colors:
  ink-canvas: "#060a08"
  charcoal: "#0b100e"
  pine-surface: "#101714"
  pine-surface-strong: "#151e1a"
  structural-line: "#26332e"
  warm-white: "#f1f5f1"
  muted-sage: "#9aa8a2"
  delivery-mint: "#68ddb5"
  delivery-mint-deep: "#3ab58c"
  status-amber: "#e4b45d"
  status-danger: "#e88378"
typography:
  display:
    fontFamily: "ZCOOL XiaoWei, Noto Serif SC, Songti SC, serif"
    fontSize: "clamp(48px, 7vw, 92px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "ZCOOL XiaoWei, Noto Serif SC, Songti SC, serif"
    fontSize: "clamp(34px, 4.5vw, 56px)"
    fontWeight: 400
    lineHeight: 1.05
  body:
    fontFamily: "Noto Sans SC, Microsoft YaHei UI, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Noto Sans SC, Microsoft YaHei UI, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 720
    lineHeight: 1.4
rounded:
  control: "7px"
  panel: "12px"
  prominent: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "28px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.delivery-mint}"
    textColor: "{colors.ink-canvas}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  button-secondary:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  panel:
    backgroundColor: "{colors.pine-surface}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.panel}"
    padding: "28px"
---

# Design System: Reii 小店

## Overview

**Creative North Star: "The Live License Ledger"**

Reii 小店 feels like a quiet, always-current ledger for digital inventory: factual, dark, and precise. Its hierarchy makes availability, pricing, delivery, and order traceability visible before decoration. The Reii bear supplies warmth; the interface around it remains restrained and operational.

The system avoids fabricated proof, urgency, glossy glass effects, and ornamental gradients. Motion communicates state changes and navigation rather than creating ambient spectacle.

**Key Characteristics:**

- Real inventory and delivery state lead the first viewport.
- Warm display type sits above compact, highly legible operational text.
- Mint is rare and functional: primary action, focus, selection, success, and live state.
- Dark surfaces are separated by tone and fine structural borders.

## Colors

The palette combines near-black ink, deep pine surfaces, warm white type, and a single delivery-mint accent; amber and coral appear only for status.

### Primary

- **Delivery Mint:** Used for primary actions, live inventory, focus rings, selection, and successful delivery.
- **Delivery Mint Deep:** Used for stronger hover states and accent support.

### Neutral

- **Ink Canvas:** The page-level background and deepest spatial plane.
- **Charcoal:** Compact controls and inset regions.
- **Pine Surface:** Default cards, forms, panels, and dialogs.
- **Pine Surface Strong:** Raised or selected dark surfaces.
- **Structural Line:** Quiet boundaries between functional regions.
- **Warm White:** Primary copy and high-value numeric data.
- **Muted Sage:** Supporting copy, metadata, and helper text.

### Named Rules

**The Mint Means Action Rule.** Mint must identify interaction, live state, selection, focus, or success; it is not a decorative wash.

**The Honest Status Rule.** Amber and danger coral are reserved for actual caution, failure, or exceptional states.

## Typography

**Display Font:** ZCOOL XiaoWei, with Chinese serif fallbacks  
**Body Font:** Noto Sans SC, with Microsoft YaHei UI and Segoe UI fallbacks

**Character:** Display type adds a human, shop-like voice to large promises and section titles. The sans-serif body remains dense, modern, and reliable for pricing, stock, checkout, and administration.

### Hierarchy

- **Display** (regular, fluid large size, tight line height): Hero promises only; keep it short.
- **Headline** (regular, fluid section size): Major catalog, order, policy, and login headings.
- **Body** (regular, 14px class, relaxed line height): Explanations and purchasing guidance, normally no wider than 65 characters in Chinese contexts.
- **Label** (semibold, 12px class): Navigation, fields, stock, prices, and compact metadata.

### Named Rules

**The Two-Voice Rule.** Serif creates orientation; sans-serif carries every operational detail.

## Layout

The shared content container tops out at 1240px with 24px desktop gutters. The first viewport is a two-column composition: promise and actions on the left, real catalog data on the right. The catalog then separates product understanding from purchase completion, while order lookup and checkout use purpose-built split layouts.

Below 720px, sections become single-column, actions become full-width, and the navigation occupies its own row. Product tabs scroll horizontally with complete labels instead of shrinking into unreadable fragments. Anchored sections account for the sticky header. Spacing follows an 8–12–18–28–48px rhythm, with generous section gaps and compact control interiors.

## Elevation & Depth

Depth is primarily tonal and structural. Surfaces are distinguished through the canvas/surface scale and fine borders; ambient shadows appear only under prominent consoles, purchase panels, dialogs, and hover-raised identity marks.

**The Flat-By-Default Rule.** A surface earns shadow only when it must read above another interactive plane.

## Shapes

Controls use gently squared corners, generally 7px. Content and purchase panels use 12px, while the live inventory console may use 14px. Pills are limited to stock and compact status indicators. Borders remain one pixel and low-contrast; the bear image is the only deliberately soft, illustrative silhouette.

## Components

### Buttons

- **Shape:** Restrained squared control corners.
- **Primary:** Delivery mint with ink text and confident horizontal padding.
- **Hover / Focus:** A small upward transform or deeper mint state; focus uses a two-pixel mint outline with separation.
- **Secondary:** Charcoal or transparent pine with warm-white text and a structural border.

### Chips

- **Style:** Compact bordered pills for stock and status only.
- **State:** Mint for live/available, coral for empty or failed, amber for pending attention.

### Cards / Containers

- **Corner Style:** Panel-radius corners with clipped media.
- **Background:** Pine surface above the ink canvas.
- **Shadow Strategy:** Tonal first, sparse ambient shadow second.
- **Border:** One-pixel structural line.
- **Internal Padding:** Usually 28px, reduced on narrow screens.

### Inputs / Fields

- **Style:** Dark inset field, structural border, control radius, warm-white input text.
- **Focus:** Mint border or outline; never rely on color alone when an error message is present.
- **Error / Disabled:** Danger coral for failure copy; reduced contrast and blocked cursor for unavailable actions.

### Navigation

The brand returns home. Purchase and order lookup sit in a compact sliding tab control; the active surface uses delivery mint. On mobile the brand/actions stay above a full-width navigation row.

### Live Catalog Console

The signature console lists real product name, category, stock, and price. It links directly to the matching product without invented social proof. The three-step delivery track closes the trust loop: choose, pay, automatic delivery.

## Do's and Don'ts

### Do:

- **Do** populate catalog and proof surfaces from real product, price, and inventory data.
- **Do** show delivery, refund, and query expectations before payment.
- **Do** keep every interactive state keyboard-visible and respect reduced-motion preferences.
- **Do** record shipping raster provenance in `.impeccable/provenance.json`.

### Don't:

- **Don't** fabricate sales counts, testimonials, ratings, scarcity, or product availability.
- **Don't** use Alipay or another payment provider as a visual identity or marketing claim.
- **Don't** reintroduce light mode, glassmorphism, gradient text, oversized pills, or continuous decorative animation.
- **Don't** expose development tokens or operational secrets in production UI.
