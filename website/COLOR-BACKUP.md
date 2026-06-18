# Color Backup — Pre "Charcoal & Signal Orange" Theme

Record of the color values in use before switching to the new palette, so the
site can be reverted if needed.

## CSS variables (style.css `:root`, originally around line 2-12)

```css
:root {
  --navy:       #1e2633;
  --navy-dark:  #13181f;
  --navy-mid:   #27313f;
  --gold:       #e85d1a;
  --gold-light: #f07040;
  --light:      #f4f5f7;
  --white:      #ffffff;
  --text:       #1a202c;
  --text-muted: #6b7280;
  --border:     #e2e6ea;
}
```

## Hardcoded (non-variable) colors that matched the old theme

These were hardcoded inline rather than using a variable, so they need
restoring by hand if reverting:

- `style.css` hero background gradient 3rd stop: `#1e3a6e` (blue accent)
- `style.css` hero overlay gradient: `rgba(19,24,31,.90)`, `rgba(26,39,68,.85)`, `rgba(30,58,110,.72)`
- `style.css` navy-tint icon backgrounds: `rgba(26,39,68,.06)` / `.07` / `.08`
- `style.css` hero tag background: `rgba(201,169,78,.15)` (old tan/gold tint)
- `style.css` tag hover text color: `#c94a0e`
- `index.html` connector-arrow icons (2x) and checkmark icons (5x): `stroke="#e85d1a"`
- `index.html` hero wave divider: `fill="#f5f7fa"`
- `engineers.html` hero wave divider: `fill="#f4f5f7"`

## To revert

1. Replace the `:root` block in `style.css` with the block above.
2. Restore the hardcoded values listed above to their old hex/rgba values.
