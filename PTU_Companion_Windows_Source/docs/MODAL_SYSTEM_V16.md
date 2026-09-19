# Pokédex Modal System — v1.6

The functional application no longer uses browser-native prompt/confirm/alert dialogs.

## Goals

- preserve the approved cartoon/Pokédex visual identity;
- keep important warnings inside the application frame;
- support structured fields rather than free-text prompts where possible;
- make destructive actions visually distinct;
- keep the same interaction model available later in Tauri/Android.

## Components

`styledConfirm()`
- confirmation/cancel flows;
- optional danger styling;
- explanatory warning panels.

`styledForm()`
- text, number, select, and textarea fields;
- automatic form collection;
- first-class cancel/save behavior.

Existing complex modals such as Held Item pickers and Ability correction continue to use `modal()` but inherit the same visual frame.

## Native-dialog policy

The functional preview must contain zero direct calls to:

- `prompt()`
- `confirm()`
- `alert()`

`VERIFY_V16.bat` checks this statically.
