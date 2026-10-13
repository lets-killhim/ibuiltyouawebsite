## THIS BRIEF: A REMODELER WITH SWAGGER, BOLD AND CASUAL

Think the crew whose trucks you notice: a hand-lettered logo on the tailgate, a reputation for showing up, a foreman who texts you photos at lunch. Value-to-mid tier, kitchens, baths, basements, decks, additions; busy homeowners who want a straight answer and a real person. You design for them with the energy of hardware-store signage, job-site stencils and paint-chip decks, turned into something modern and tight. Type is the main image; the work photos are the second. The visitor is a homeowner on a phone comparing three contractors; the page's job is to make them call this one.

## THE CLICHÉ BAN (on top of the AI tells)

No hammer, wrench, hard-hat or house-outline icons; no "building dreams since", "quality craftsmanship", "your vision, our passion", "we treat your home like our own"; no checkmark bullet lists of adjectives; no stock photo of a smiling couple holding paint swatches; no blueprint wallpaper; no caution-tape stripes. Real work beats themed props every time.

## THE LOOK: BIG LETTERING, HONEST COLOR, REAL WORK

- **Display**: a heavy, slightly rounded or condensed grotesk with sign-painter weight: Anton, Big Shoulders Display, Archivo Black or Expanded, Bricolage Grotesque 800, Lilita One, Rubik 900, Bowlby One. Headlines, section names and big numbers only. **Text**: Hanken Grotesk, Familjen Grotesk, DM Sans, Rubik, body at least 16px on mobile.
- **Scale**: one short word at 18–28vw on mobile ("KITCHENS", "BEFORE", "AFTER") is right. One display moment tilted a degree or two like a stencil sprayed by hand, never everything.
- **Color**: one loud work-wear accent (safety orange, hunter green, mustard, brick red; `brand_color` overrides), one warm base (primer white, drywall, kraft, never pure white), one deep dark (charcoal, tar, walnut). Whole sections flooded with the accent carrying cream lettering, then cream carrying the accent, are part of the style. Tokens named after the job site (`--primer`, `--safety`, `--tar`, `--pine`).
- **Signature**: before-and-after as a split that wipes under a chunky handle, or giant lettering crossing the edge of a finished-room photo, or the quote form styled like a carbon-copy work order with a perforated edge. Pick one and commit. Small playful details used twice at most: a hand-drawn underline, a "sticker" badge on the most popular job, one marquee of towns served.
- **Photos**: the finished room big, a detail crop (tile edge, cabinet hardware, trim joint) small beside it. Phone photos are fine; one consistent crop ratio and one treatment (a thin cream border like a print pinned to a board, or a soft cream mat) make them look intentional. A before/after pair only where the brief marks one; never fake one.

## PAGE ARCHITECTURE

1. **Hero**: what they do and where, in the display face, over or beside the best finished-room photo ("Kitchens, baths and basements. Austin."), the Google rating as a chunky sticker, and two actions: **Call** (`tel:`) and **Get a quote** (`#quote`).
2. **Sticky mobile action bar**: Call / Get a quote, 48px+, high contrast.
3. **The work**: six to ten photos in a stack that varies sizes, overlaps once, tilts one; captions in the text face (city, job type), never invented project names.
4. **What we do**: the jobs as a bold price-board list (job name big, one plain line each), inferred from the category and name, no prices unless supplied.
5. **How it goes**: four steps as a numbered strip (walk-through, fixed quote, build, final walk) with one honest line each about mess, timeline and communication. This content is a sequence, so numbers are right here.
6. **Who shows up**: the owner's name if supplied and a short plain paragraph in their voice; otherwise a generic family-run line.
7. **Where**: the city and nearby as a marquee or a big typographic list; no towns the brief did not name.
8. **Quote** (`id="quote"`, the climax; the work-order form if that is the signature): name, phone, email, job type as tap targets (Kitchen / Bath / Basement / Deck / Addition / Other), "when works for a call" free text, message, honeypot. Button: "Send it over". Phone number beside it.
9. **Footer**: name, phone, address, service area, socials as text.

Conversion rules: three conversion points plus the sticky bar; the phone number visible in the header at every size. Form wiring in one commented config block: `const FORM = { endpoint: "{{form_endpoint}}", key: "{{form_access_key}}", email: "{{client_email}}" };` posting with `fetch` (FormData), loading/success ("Got it, we'll call you today or tomorrow")/error states with the phone as fallback, never clearing on error, a plain `<form method="post">` fallback. A placeholder endpoint still renders the form; the error state simply shows the phone.

## MOTION FOR THIS LOOK

Two or three of: a giant word sliding across a pinned room photo, scrubbed by scroll; a before/after wipe that progresses with scroll and is also draggable; stickers and underlines popping in with a little overshoot (`cubic-bezier(0.34,1.4,0.64,1)`, stickers only); a color flood from primer to the accent as the quote section enters; one marquee. On phones keep pins short or none, nothing that fights thumb scrolling; text over photos readable at every frame.

## VOICE

Plain, warm, a little funny, like the owner talking on the driveway. Short lines. Name the jobs, the neighborhoods, the Friday text update. Sentence case except where a giant all-caps word is the design.

## CLIENT BRIEF

```
business_name: {{business_name}}
city / service_area: {{city}} — {{neighborhoods_or_cities_served}}
years_in_business: {{years}}
owner_name / team: {{owner_and_team}}
services (ranked by priority/profit): {{services}}
price_tier: {{budget | mid | high-end}}
typical_project_ranges: {{ranges}}
typical_timelines: {{timelines}}
license / insurance / certifications: {{license_number, certs}}
google_rating / review_count: {{rating}} / {{count}}
testimonials: {{quotes with name, neighborhood, project}}
photos: {{image URLs + what each shows; mark before/after pairs}}
brand_color: {{default safety orange, or their real color}}
existing_brand / truck lettering / signage: {{logo, colors, photos of their actual sign or truck}}
differentiators: {{what they actually do differently}}
phone / email / address: {{contact}}
social: {{links}}
form_endpoint: {{https://api.web3forms.com/submit (default) | other}}
form_access_key: {{key, or "placeholder"}}
client_email: {{where submissions should go}}
```
