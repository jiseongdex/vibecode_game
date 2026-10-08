# Task: T01 Curved dotted stage connectors

## Status: done

## Goal

Replace rigid straight dotted connectors with playful, readable S curves between consecutive stage icons.

## Implementation

- `public/assets/campaign/route-horizontal.svg` :: new vector path with a modest horizontal S curve, green round dots, and `preserveAspectRatio="none"`.
- `public/assets/campaign/route-vertical.svg` :: new matching vertical S curve.
- `src/components/Campaign/CampaignScreen.module.css` :: `.routeNode::after`, direction selectors, and mobile overrides. Use the SVGs as pointer-transparent backgrounds sized between stage centers; keep node buttons above them.
- No data or model schema changes. `routePosition` and stage ordering remain unchanged.

## Validation

- `npm.cmd test -- --run src/components/Campaign/CampaignScreen.test.tsx`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`
- Browser inspect desktop and mobile stage paths, including left/right turns and vertical joins; ensure no route overflow or blocked buttons.

## Commit Message

```text
style(campaign): curve dotted stage route

Plan: 2026-10-08-winding-stage-route
Phase: P01-route
Task: T01-curved-connectors

- Draw winding dotted connectors between stages
- Preserve desktop and mobile stage order
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
