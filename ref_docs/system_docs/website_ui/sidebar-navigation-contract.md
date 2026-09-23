# Shared sidebar navigation contract

## Authority

This is the authoritative presentation contract for the shared UK AQ website navigation implemented by `/sidebar.js`.

It is narrower than [`contract.md`](contract.md) for menu order, icon geometry, item spacing, vertical overflow and the placement of Resources and Contact. The broad responsive UI contract remains authoritative for the shared mobile boundary, drawer behaviour and page-specific constrained-width sidebar occupancy rules.

## Current navigation order

The shared sidebar MUST present the main navigation in this order:

1. Home
2. Hex Map
3. Sensor Map
4. WHO Guidelines
5. Wood Burning
6. NAEI Data
7. Research
8. AQ in the News

The existing divider MUST then separate the utility links:

9. Resources
10. Contact

No additional section heading or divider MUST be inserted between the main navigation items unless this contract is intentionally updated.

A menu item whose destination is not yet active MAY be rendered in an accessible disabled or pending state. It MUST NOT link to a nonexistent route merely to satisfy the ordering contract.

## Width and icon geometry

The normal expanded sidebar width MUST remain `212px`.

The Mini sidebar width MUST remain `64px`.

Normal sidebar icons MUST retain the existing `40px × 40px` presentation area.

The Home icon MUST retain its existing `44px × 44px` treatment.

WHO Guidelines and AQ in the News MUST retain their existing wordmark-specific icon treatment rather than being forced into the normal square-icon geometry.

Artwork MUST preserve its aspect ratio and MUST NOT be stretched or cropped merely to fill the icon slot.

## Vertical item spacing

The established sidebar vertical rhythm is part of the shared navigation presentation and MUST be preserved when adding or reordering menu items.

Normal navigation items MUST retain the current padding:

```css
padding: 9px 10px 9px 14px;
```

Mini navigation items MUST retain the current padding:

```css
padding: 9px 4px;
```

Implementation MUST NOT reduce this vertical padding, shrink the icon presentation or otherwise compress the established item spacing merely to fit additional menu entries into the viewport.

If the full navigation does not fit vertically, the sidebar MUST remain vertically scrollable instead of compressing the menu-item rhythm.

## Resources and Contact placement

Resources and Contact MUST remain together, in that order, after the existing divider.

When available sidebar height permits, the Resources/Contact section SHOULD sit at the bottom of the navigation area.

On shorter viewports, bottom positioning MUST NOT make either item unreachable. Vertical sidebar scrolling MUST keep the complete navigation accessible.

The shared website footer is outside this contract and MUST NOT be changed merely to accommodate sidebar navigation.

## Behaviour preservation

Changes to menu order, labels, icons or destinations MUST preserve the existing shared navigation behaviour unless a separate authorised contract intentionally changes it.

In particular, sidebar work MUST preserve:

- desktop and tablet Mini/expanded behaviour;
- hover expansion and automatic collapse;
- desktop pinning where permitted by the broad responsive contract;
- session-scoped pinned-state behaviour;
- same-tab expanded-navigation handoff across internal navigation;
- mobile drawer open/close behaviour;
- overlay dismissal;
- active-page highlighting;
- accessible disabled/pending semantics for unavailable destinations.

Page-specific constrained-width sidebar occupancy rules remain owned by [`contract.md`](contract.md) and MUST NOT be duplicated or weakened here.

## Implementation ownership

The active implementation is owned by:

```text
TEST-uk-aq/TEST-uk-aq.github.io/sidebar.js
```

Sidebar icon assets are owned by the website repository's `/sidebar-images/` directory.

This contract does not authorise page implementation for Wood Burning, NAEI Data or Research. It governs their shared-navigation presentation and ordering only.

## Validation

Before deployment, only structural viability checks are required for a sidebar-only presentation change, such as JavaScript syntax/parsing and diff whitespace checks.

Functional and visual acceptance MUST occur through the deployed TEST website.

Representative post-deployment checks SHOULD confirm:

- normal expanded spacing;
- Mini spacing;
- icon alignment and aspect ratio;
- sidebar scrolling on a short viewport;
- Resources and Contact accessibility;
- hover-expand/collapse and pin behaviour where applicable;
- mobile drawer operation;
- enabled link destinations and disabled/pending states.
