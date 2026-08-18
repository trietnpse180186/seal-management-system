---
name: ui-ux-refactor
description: Rules and guidelines for refactoring UI/UX to ensure a premium, modern, accessible, and high-performance design system.
---

# UI/UX Refactoring Skill & Guidelines

This skill is a customized blend of the industry-standard `cursor-designer` principles and the workspace-specific design rules. It serves as a guardrail and instruction manual for all UI/UX refactoring tasks in this repository.

---

## 1. Core Constraints & Boundaries

- **NO 3D/Colored Emojis or Icons**: Never use 3D-styled colored emoji/icon assets (such as 📥, 📤, or similar 3D colored emojis) in code or UI. Always use flat, outline, vector-based SVG icons (such as Lucide React icons like `Download`, `Upload`, etc.) to maintain a premium, clean, professional modern developer aesthetic.
- **Vanilla CSS by Default**: Use Vanilla CSS for maximum flexibility and control. Avoid using TailwindCSS unless explicitly requested; in this case, first confirm which TailwindCSS version to use.
- **Zero Placeholders**: Do not use placeholder images or components. If an image is needed, generate one using the proper tools or use CSS-based high-fidelity placeholders.
- **Consistent Design Tokens**: Maintain strict alignment with existing design tokens for colors, fonts, spacing, and radii. Do not invent ad-hoc CSS values.

---

## 2. UX Foundations (Design-First)

Prioritize **Nielsen's 10 usability heuristics**, with particular focus on:
1. **Visibility of system status**: Surface progress, loading states, success messages, and errors quickly and clearly.
2. **Match between system and the real world**: Use language, layouts, and mental models familiar to the user.
3. **Error prevention and recovery**: Prevent validation errors before submission (e.g., disable submit button if form is invalid, show inline validation) and provide simple, actionable recovery steps.
4. **Consistency and standards**: Maintain consistent interactions across the app.
5. **Progressive Disclosure**: Show only what is necessary at the current step. Hide advanced settings/actions under menus or collapsible panels to avoid overwhelming the user.

---

## 3. UI Aesthetics & Spacing (Premium Look & Feel)

- **Rich Aesthetics**: The design must feel modern, premium, and state-of-the-art:
  - Use curated, harmonious color palettes (prefer HSL-tailored colors).
  - Use sleek dark modes or clean light/dark transitions.
  - Implement smooth gradients, subtle card borders, and glassmorphism (where appropriate).
- **Typography**: 
  - Use modern, premium typography (e.g., Google Fonts like *Inter*, *Roboto*, or *Outfit*) instead of system/browser defaults.
  - Establish a clear hierarchy (H1, H2, H3, Body, Metadata) using distinct weights, sizes, and colors (e.g., muted grays for metadata, high-contrast colors for headings).
- **Visual Rhythm & Spacing**:
  - Always use a consistent spacing scale (e.g., 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px). Never hardcode random margin/padding values.
  - Maintain a balanced visual density. Keep adequate whitespace to let elements breathe.
  - Add subtle micro-interactions and animations (e.g., button scale hover, fade-in transitions) to make the UI feel alive.

---

## 4. Interactive Elements & Forms

- **Validation States**: Forms must clearly convey validation states:
  - Use outline rings, subtle background tint shifts, and inline icon/text feedback (e.g., red outline for error, green for valid).
  - Do not use harsh primary red or green; use pastel/muted HSL colors instead.
- **Action Hierarchy**:
  - Primary actions (e.g., "Save", "Submit") must be visually dominant (filled color, high contrast).
  - Secondary actions (e.g., "Cancel", "Back") should be secondary (outline or text buttons).
  - Destructive actions (e.g., "Delete") must use distinct danger styling and request verification.
- **Interactive States**: Every interactive element (buttons, links, inputs) must have explicit `:hover`, `:focus`, `:active`, and `:disabled` styles.

---

## 5. Accessibility (WCAG 2.1 AA)

- **Semantic HTML**: Use proper HTML5 elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<button>`, `<a>`) rather than nested `<div>`s.
- **Keyboard Navigation**: Ensure all interactive elements can be focused using the `Tab` key and have highly visible focus indicators (outline/ring).
- **Color Contrast**: Verify all text meets WCAG AA contrast ratio requirements (at least 4.5:1 for body text, 3:1 for large text).
- **ARIA Attributes**: Add `aria-label`, `aria-expanded`, `aria-hidden`, and other ARIA attributes where semantic HTML is insufficient.

---

## 6. SEO & Performance Best Practices

- **Title Tags & Meta Descriptions**: Add descriptive title tags and meta descriptions for pages.
- **Heading Structure**: Use exactly one `<h1>` per page, and structure subheadings (`<h2>`, `<h3>`) in a correct hierarchy.
- **Unique IDs**: Ensure all interactive elements have unique, descriptive `id` attributes to aid browser testing and accessibility.
- **Performance**: Optimize CSS bundle sizes, avoid layout shifts (CLS), and use modern CSS layouts (Flexbox, Grid) instead of outdated techniques.
