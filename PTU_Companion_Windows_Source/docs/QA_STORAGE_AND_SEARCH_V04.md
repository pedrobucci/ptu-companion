# QA — Storage and Rules Library Search v0.4

## Storage defect from v0.3

The rendered markup had two content panels, but `.storage-layout` still declared three columns:

`1fr 104px 1fr`

The first panel occupied the first flexible column and the second (`STORED`) occupied the 104px middle column. The final flexible column was unused.

### v0.4 correction

`grid-template-columns: repeat(2, minmax(0, 1fr))`

Both panels now receive equal width. Each internal `.storage-grid` uses `auto-fill` and a minimum card width, so stored Pokémon wrap horizontally and vertically.

## Rules Library search defect from v0.3

`refreshDefinitionRows()` set loading state and immediately called the global `render()`. Since this implementation replaces `#app.innerHTML`, the focused input element was destroyed after the first debounce interval.

### v0.4 correction

- query input has a stable DOM id;
- typing updates query state without rebuilding the page;
- search is debounced at 600ms;
- each request receives a sequence number;
- stale responses are discarded;
- the accepted result re-renders the screen;
- focus and caret position are restored to the search field;
- Enter triggers an immediate search.

This keeps the vanilla reference runtime usable while preserving the same behavior a controlled React input should have in the production frontend.
