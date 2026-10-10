# DESIGN

## Visual world: "the sky above Alliance at golden hour"
Drawn from the name. Cloud9 means soft, light, above it all. We avoid the category's beige
sameness by working with an actual sky: warm cloud-white by day, twilight ink by night, and one
sunset accent.

| Token | Hex | Use |
|---|---|---|
| cloud | #F7F3EE | page background |
| vapor | #FFFDFA | raised surfaces |
| haze | #E4EAF0 | cool secondary surface (clubs, tool) |
| ink | #1C2033 | text, primary buttons, night sections |
| ink-soft | #4A4F66 | secondary text (7.0:1 on cloud) |
| ember | #E27D58 | the one accent: markers, focus, highlights (never body text) |
| ember-deep | #A84E2C | accent when it must be text on light (AA) |

## Type
- Display: **Instrument Serif** (regular + italic). Huge, tight, with italic words for warmth.
- Text/UI: **Hanken Grotesk** variable. Covers all Spanish characters.
- Scale: fluid clamp(), display up to 9.5rem on desktop, 3.4rem on phone.

## Radius
One soft system: 14px (inputs, chips), 28px (cards, panels), 999px (buttons, pills), arch tops
(team frames, intro window). Nothing sharp.

## Light/dark
Light page (booked on phones in daylight), with two night sections (depth, plan result) for rhythm.

## Motion
- Hero: a live WebGL sky, clouds drifting very slowly, reacting faintly to the pointer.
- Headings reveal word by word; illustrations unmask on scroll; scroll-progress line in ember.
- Cross-document view transitions between languages.
- Only transform, opacity, clip-path. IntersectionObserver and CSS scroll timelines, no scroll listeners.
- prefers-reduced-motion: no sky animation (one static frame), no reveals, everything visible.
- Without JS: all content visible; hidden states only apply under html.js.

## Signature moment: "How deep we go"
A pinned skin cross-section. As you scroll, a soft beam descends layer by layer: surface, dermis,
volume, muscle, and finally the whole body. Each stop lights the layer and names the Cloud9
treatments that work there, with prices. It explains the menu better than any list and makes the
point the brand wants to make: every treatment is chosen for where your concern actually lives.
On phones the diagram becomes a compact sticky strip and the stops scroll beneath it.

## Interactive tool: "Your Cloud9 plan"
Four quick steps (concerns, areas, downtime, experience and timing) produce a personal starting
plan with real prices, a membership check that does the maths, and a readable reference code
(e.g. C9-LV-FE-1NE-K). The front desk decodes it at /front-desk/. Ends in a call-back form.
