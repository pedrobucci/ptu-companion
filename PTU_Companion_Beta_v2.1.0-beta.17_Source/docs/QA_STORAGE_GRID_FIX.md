# QA — Storage multi-card layout fix (v0.3)

## Reported issue

In v0.2, the **STORED** panel could collapse to roughly one creature-card width. Even when the header reported multiple stored Pokémon, only one card was comfortably visible at a time.

The user-provided reproduction is preserved at:

`docs/qa/storage-single-column-v02.png`

## Cause

The desktop storage shell used an asymmetric grid:

```css
grid-template-columns: 1fr 120px .62fr;
```

while each storage list forced four columns:

```css
grid-template-columns: repeat(4, 1fr);
```

The right-hand storage pane therefore received too little width and its children could collapse/overflow instead of reflowing into a useful number of columns.

## v0.3 correction

Both collection panes now receive equal flexible width:

```css
.storage-layout {
  grid-template-columns: minmax(0, 1fr) 104px minmax(0, 1fr);
}
```

Each Pokémon collection uses a content-aware responsive grid:

```css
.storage-grid {
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
}
```

At narrower desktop widths the entire storage workflow stacks vertically, while the creature grid continues to auto-fill.

## Expected behavior

- 1 stored Pokémon: one readable card; unused space remains available.
- 2–4 stored Pokémon: cards share the row when space permits.
- larger collections: cards wrap naturally into additional rows.
- no Pokémon should become inaccessible because the panel is narrower than a fixed multi-column layout.
- the same layout rule applies to Carried and Stored collections.
