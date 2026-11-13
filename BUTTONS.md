# Button rules

Rules for the text, icon and tooltip of every button in the client. Follow them when adding or changing a button.

## Text

1. A button that does something has text and an icon. The text is a short verb phrase for the action (Save, Add friend, Surrender and leave, Back to home).
2. A button whose state changes shows the state in its text (Pause or Resume, Saving…, Saved, Reported, Bots: Slow).
3. The text must match the label next to it. A panel labelled "Release toxin:" has a button called Release, not Confirm.
4. A button is text-only, with no icon, only when its text is itself a name, a quantity or a value, not an action:
   - usernames and author names
   - chart and stat tabs
   - preset slot names and the map name toggle
   - tutorial section chips
   - wiki links, breadcrumbs and prev/next chips (they carry the glyphs ‹ › ↗ instead)
   - replay speed ("2x")
   - ship counts
   - OR / AND
   - emoji buttons (the emoji is the content)
   - value pickers (Selector options)
5. A button is icon-only, with no text, only when it sits in a compact toolbar, a small square slot, or inside an input, and the icon is already established in the app. Examples are the left map column, replay controls, Share, the like heart, Previous phase, "View the map", the emoji picker, the "+" and "×" buttons in table rows, and Random seed.
6. Never use an em dash in any button text or tooltip.

## Icon

1. Every icon is a file in `client/public/icons/`, black on transparent, drawn on a 20x20 grid with a 2 px stroke and round caps and joins.
2. Render icons with the `WhiteIcon` component, never with a plain image. It paints the icon in the button's text color, so the icon and the text are always black on a light background (primary, success, info, warning buttons) and white on a dark one (secondary, danger buttons, dark panels).
3. A button with an icon and text is a flex row: `d-flex` or `d-inline-flex`, `align-items-center`, `justify-content-center` and `gap-1`. An icon-only button uses the same classes so the icon is centered.
4. The icon goes before the text, except Next in a pager, which has its icon after the text.
5. Fewer icons is better. The same icon may be reused in different places, even with a slightly different meaning, if it makes sense in each place. The exception is two buttons next to each other on the same page: they must not share an icon unless they do the same thing.
6. Reuse an existing icon before drawing a new one. A new icon follows the style of the existing ones and must be centered in its box.
7. Standard icons:

| Meaning | Icon |
|---|---|
| Cancel, close, remove, clear | close.svg |
| Delete | trash.svg |
| Confirm, save a form, use | check.svg |
| Save | save.svg |
| Attack | swords.svg |
| Undo, previous phase | undo.svg |
| Redo | redo.svg |
| Restart, reset, replay again, reload | restart.svg |
| Leave, exit | exit.svg |
| Log in, Log out | login.svg, logout.svg |
| Back | step-back.svg |
| Next | skip-forward.svg or step-forward.svg |
| Add, create | plus.svg |
| Share | share.svg |
| Download, Import | download.svg, upload.svg |
| Show, hide password | eye.svg, eye-off.svg |
| Timed, waiting, slow | stopwatch.svg |
| Random, generate | the SpinningGears component |

## Tooltip

1. An icon-only button always has a tooltip. The standard modal close "×" is the only exception.
2. A tooltip says what the click does ("Send an emoji to everyone"), or names the thing when the name is the action (Cards, Logs, Settings, Discord).
3. A button with an icon and text has a tooltip only when the text does not say enough: what the effect is, who it affects, or what it costs. Examples are "Only changes the color on this device" and "Pay 5 troops, once per round".
4. A button that changes state describes both states, and says what the next click does ("Alliance request sent. Click to cancel it", "Change bots speed. Click for Medium").
5. A button that cycles through values says which value comes next.
6. A button with a keyboard shortcut shows it in the tooltip ("Play (Space)").
7. A button that can be disabled for a reason the user can fix says why in its tooltip (Start: "Pick a map", "Needs at least 2 players").
8. A disabled button cannot show a tooltip, because Bootstrap removes its pointer events. Wrap it in the `TipSpan` component, which puts the tooltip on a span around the button.
9. Use the `Tip` component for every tooltip. A native `title` attribute is only acceptable where the element is built outside React (map markers) or the button is disabled and `Tip` would not show.
10. A tooltip is a short sentence or phrase in sentence case.
