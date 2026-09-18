# QA — Current HP overflow fix

## Original issue

In v0.1, the Active State card displayed Current HP as one horizontal line containing:

```text
[-5] [-1] [48/48] [+1] [+5]
```

At the actual card width this row exceeded the available content area and the final control was clipped.

The user-provided reproduction is preserved as:

`docs/qa/current-hp-overflow-v01.png`

## v0.2 solution

Current HP is now a small vertical component:

```text
Current HP
48 / 48                         100%
██████████████████████████████████
[ -5 ] [ -1 ] [ +1 ] [ +5 ]
```

The four action buttons use:

```css
grid-template-columns: repeat(4, minmax(0, 1fr));
```

and therefore divide the available card width instead of forcing fixed-width content outside the panel.

Injuries use a separate compact 3-column stepper.

## Acceptance criteria

- No HP button may cross the Active State card boundary.
- The HP value must remain visually central and legible.
- The HP progress bar must reflect the same current/max HP state.
- The four HP actions must remain visible at desktop widths supported by the prototype.
- The Injuries control must not change width when the Injury value changes from one to two digits.
