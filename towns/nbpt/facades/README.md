# Storefront facades from photos

The game lays real photos of shop fronts onto the buildings' street walls. Nothing
here ships until `facades.json` and `facades.png` exist in `towns/nbpt/public/`.

## Taking the photos
- Stand across the street, phone level, and get the whole shop front in the frame:
  sign, windows, door, from the sidewalk up to the top of the ground floor (or the
  eave, if the whole face is the business).
- Midday, overcast is best; no cars parked in front if you can help it.
- Note the width of the face in metres (pace it: a pace is about 0.8 m).

## Making the atlas
Open `tools/facades.html` in a browser (no server needed). For each photo:
1. Open it, click the four corners of the shop front in order: top-left, top-right,
   bottom-right, bottom-left. The tile on the right is the rectified face.
2. Type the business name exactly as the map names it (the name on its sign in the
   game, or the building's name), the width in metres, and whether the photo covers
   the ground floor or the whole face.
3. ADD. Repeat for the next shop. EXPORT downloads `facades.json` and `facades.png`.
4. Put both in `towns/nbpt/public/`. Commit. The next build carries them.

To add to an existing set, LOAD both files first, then add more and EXPORT again.

## A shop the map does not name
Most State Street shops are not points in the map data yet, so the name alone finds
nothing. In the game, stand at the shop's door, open the browser console, run
`nbpt.pos()`, and put the two numbers in the item as `"at": [x, y]` in `facades.json`
(the tool exports the file as plain JSON; edit it). The game then finds the building
under that point.

## What the game does with them
Each tile is laid on the building's street-facing wall, a hair proud of the brick,
centred where the business's map point projects onto that wall, as wide as you said
in metres, ground floor (3.75 m) or the whole face. The name sign the game already
makes for the shop stays.
