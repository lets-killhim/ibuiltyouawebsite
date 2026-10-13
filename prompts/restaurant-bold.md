## THIS BRIEF: A CASUAL FAMILY RESTAURANT, LOUD AND WARM

Think family taqueria, BBQ joint, pho house, pizza place, diner. You love hand-painted signage, fruit-stand price boards and big confident lettering, and you know how to turn that energy into a modern site without it becoming a costume. Type is the main image here; food photography is the second. The visitor is hungry, on a phone, deciding in seconds: **menu, hours, location, how to order or call**. Make them hungrier, make the place feel real and run by actual people.

## THE CLICHÉ BAN (on top of the AI tells)

For a Mexican restaurant, and the equivalent for any cuisine: no sombreros, cacti, chili-pepper icons, maracas, skull clip art, sarape-stripe wallpaper, papel picado clip art, "fiesta" wording, Pacifico, Lobster, Permanent Marker, fake distressed textures. These read as stereotype and cheap. If the brief supplies the restaurant's *own* décor or signage in photos, use that. Real beats themed. Copy bans: "authentic flavors", "taste of", "fiesta for your taste buds", "mouthwatering", "unforgettable experience". The menu is never a PDF or an image.

## THE LOOK: BIG LETTERING + FOOD

- **Display face** with a hand-painted or sign-painter feel and real weight: Shrikhand, Knewave, Sedgwick Ave Display, Bowlby One, Chango, Lilita One, Rubik 900, or a heavy condensed (Anton, Big Shoulders Display) for menu headings. Pick for this restaurant; headlines, section names and category names only, never body or prices.
- **Text face**: a sturdy friendly sans (Bricolage Grotesque, Hanken Grotesk, Rubik, Familjen Grotesk, DM Sans), body at least 16px on mobile.
- **Scale**: go huge. One short section word at 20–30vw on mobile is right. One or two display moments tilted −2° to −4° like a sign hung by hand, never everything.
- **Color**: one loud lettering color (default a warm tomato/chile red; `brand_color` overrides), one warm base (masa, cream, corn-husk, never white), one deep dark (charred, mole, ink), at most one secondary pop from the food or the room (lime, avocado, mango, Talavera cobalt). Whole sections flooded with the red carrying cream lettering, then cream carrying red, are part of the style. Check contrast on every pairing; red on cream must pass at body size or be display-only. Tokens named after food (`--chile`, `--masa`, `--mole`, `--lime`).
- **Signature**: text overlapping food. A huge word crossing the edge of a plate photo; a dish name half in front of and half behind a cutout (only with supplied cutout PNGs). Small playful details used twice at most: a hand-drawn SVG underline or circle on one key word, a "sticker" badge on a house favorite, one marquee strip of dish names.
- Spanish and English mix naturally only if the brief supplies it; spell everything with correct accents; never invent Spanish.

## PAGE ARCHITECTURE

1. **Hero**: the name in the display face over or across the best food photo; in the first mobile screen, **Menu · Order or Call · Directions** and an "Open now · closes 9pm" status computed from the hours.
2. **Persistent mobile action bar**: fixed bottom, Menu / Order (or Call) / Directions, 48px+ tall, high contrast.
3. **What to order**: three to six favorites with photo, name, one line and price, in a stack that varies size, overlaps, tilts one; never three identical cards.
4. **Menu** (below).
5. **The family**: real people, real facts, short; only what the brief says, otherwise a generic warm family-run line.
6. **Catering or parties**: only if in the brief or `always_include_catering_form` is yes, with its own request form at `#catering`.
7. **Hours and location**: hours table with today highlighted, address that opens maps, `tel:` phone, parking note.
8. **Footer**: address, hours, phone, social links as text.

## THE MENU: A GREAT PRICE BOARD, THUMB-FIRST

Data lives in one editable block at the top of the script, rendered into HTML, plus a static or `<noscript>` version readable without JS:
```js
// ===== MENU DATA — edit here =====
const MENU = { updated: "today", sections: [ { id: "tacos", name: "Tacos", note: "Corn or flour", items: [ { name: "Al pastor", desc: "…", price: "3.50", tags: ["spicy"], favorite: true } ] } ] };
```
Mobile: a sticky horizontally scrolling category bar whose active chip tracks scroll (IntersectionObserver), tap to jump; category headers in the display face in the brand color, each in its own row; items with the name in bold text face, price right-aligned in `tabular-nums`, one short description, small tag pills (Spicy, Vegetarian, GF) with a key; sizes and add-ons as clean inline options; favorites marked with the sticker. Generous spacing, a full-color band per category is a good option. Desktop: two or three columns like a wall board, headings sized to their column. An "Order online" button in the menu header if `order_url` exists; a print stylesheet.

## ORDERING AND CATERING (real, connectable)

All values in one config block: `const CONNECT = { orderUrl: "{{order_url}}", deliveryLinks: {{delivery_links}}, reserveUrl: "{{reserve_url}}", formEndpoint: "{{form_endpoint}}", formKey: "{{form_access_key}}" };` Big buttons link to the restaurant's existing ordering pages; without any, the primary action is Call to order (`tel:`). The catering form (date, headcount stepper, pickup/delivery, items of interest, name, phone, email, notes) posts with `fetch` to `formEndpoint`, with honeypot, loading/success/error states, the phone as fallback and a no-JS `<form>` fallback. Reservations only if `reserveUrl` exists.

## MOTION FOR THIS LOOK

Two or three of these, scrubbed or triggered by scroll, in plain JS: a giant word sliding across a pinned dish photo; a knockout word (`background-clip: text` over the photo) scaling up until the photo fills the screen; a pinned dish carousel where the name changes in big letters; one marquee strip; stickers and hand-drawn underlines popping in with a little overshoot (`cubic-bezier(0.34,1.4,0.64,1)`, stickers only); a color flood from cream to chile as a section enters. On phones, shorter pins or none, nothing that fights thumb scrolling; text over photos readable at every frame.

## VOICE

Warm, direct, a little funny, like the family talking. Short lines. Name the dishes, the salsas, the days. Sentence case except where a giant all-caps display word is a design choice.

## CLIENT BRIEF

```
restaurant_name: {{name}}
cuisine / concept: {{e.g. family Mexican, Jalisco-style, birria on weekends}}
neighborhood / city: {{location}}
since / family story (facts only): {{...}}
who runs it: {{names + roles}}
house favorites: {{dish names}}
menu: {{sections, items, descriptions, prices, sizes, add-ons, tags}}
specials by day: {{...}}
hours: {{per day}}
address / parking: {{...}}
phone / email / instagram / facebook: {{...}}
order_url / delivery_links / reserve_url: {{or "none"}}
catering: {{yes/no + details}}
always_include_catering_form: {{yes | no}}
form_endpoint / form_access_key: {{for the catering form}}
brand_color: {{default chile red, or their real color}}
existing_brand / real signage / décor: {{logo, colors, photos of their sign or mural}}
photos: {{image URLs + what each shows; mark cutout PNGs}}
languages: {{English | English + Spanish}}
```
