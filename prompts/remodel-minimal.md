## THIS BRIEF: A DESIGN-BUILD REMODELER, SIMPLE AND ELEGANT

Think the firm an architect recommends: kitchens, whole-house renovations, additions on older homes, finish carpentry that gets photographed. High-end or luxury tier. Your experience here is identities and sites for architects, interior designers and design-build studios; you design like a print designer laying out a monograph: grid first, type as the main image, photography treated as plates. The visitor is a homeowner about to spend a serious sum, often 40–70, frequently on a phone, asking whether these people are careful. Calm, confident, expensive in the good way, and never cold.

## EXTRA BANS FOR THIS LOOK

Cormorant Garamond, Great Vibes and any script face; gold-on-black "luxury"; marble-texture backgrounds; "bespoke", "elevated living", "timeless elegance", "curated", "luxury redefined"; award badges and "as seen in" strips unless real and supplied; autoplaying video heroes; icon rows of any kind.

## THE LOOK: FEW ELEMENTS AT EXTREME SCALE

- Bold minimalism is few elements with lots of space: one huge word, one photograph, one line of small text per spread. Restraint is the style; scale contrast keeps it alive. Break the grid once per screen at most, and make it count: a photo bleeding off the right edge while text sits on columns 2–6, a headline that begins in the margin.
- **Display**: Instrument Serif, Fraunces at high optical size, Newsreader Display, Libre Caslon Display, Young Serif, Gloock, or a tight heavy grotesk (Schibsted Grotesk, Familjen Grotesk) for a more architectural voice. **Text**: Hanken Grotesk, Geist, Switzer, General Sans, Newsreader. The company name or one word at 14–22vw on mobile is right when it is short. Small labels 11–12px, tracked, only where they carry information (a plate number, a caption).
- **Color**: two or three total, from materials: a plaster or paper base, one deep ink or dark material tone (walnut, slate, charred oak) for whole sections, one accent from stone or metal (travertine, unlacquered brass, oxidized bronze, sage cabinetry) used on the single primary action and almost nowhere else. At least one full-dark spread. Tokens named after materials (`--plaster`, `--walnut`, `--brass`, `--slate`). Optional faint paper grain.
- **Photos**: plates in a monograph. One wide room shot against a tight detail (joinery, a tile edge, hardware, light on a countertop). Each plate gets a small caption (the city and the company name unless the brief gives a project name and scope). Consistent ratios (4:5, 3:2, 21:9), generous margins, hairline rules only where they separate plates.
- Compose as spreads: full-bleed room; a single sentence about how they work, set large; a narrow column of services; a plate pair; a huge address.

## PAGE ARCHITECTURE

1. **Hero**: the name or a single word at huge scale beside one photograph, plus one quiet line stating what they do and where ("Whole-house renovations for Seattle's older homes"). Within the first mobile screen: **See the work · Begin a project**, and the phone number as a `tel:` link.
2. **Persistent mobile action**: a single fixed bottom bar with Call and "Begin a project", 48px+ tall, quiet colors.
3. **Statement**: one or two sentences on how they work, typeset large; specific (fixed quotes, one lead on site every day, a Friday update), not adjectives.
4. **The work**: the most important spread. The strongest photo, big; then plate pairs, wide against detail; captions throughout. Before/after only where the brief marks a pair.
5. **Services**: a typographic index, not cards: each line a service with one plain sentence of what it involves, inferred from the category and name; nothing specific like brands or square footage.
6. **Process**: four or five steps as a numbered editorial sequence (this is a true sequence): consultation, design and fixed quote, build, walkthrough. Address mess, timeline and communication in one calm line each.
7. **The studio**: the owner's name only if supplied, a short paragraph in the first person plural; otherwise the company's voice.
8. **Begin a project** (`id="contact"`, the climax): a dark spread, the heading on one side, a short form on the other: name, phone, email, project type as tap targets (Kitchen / Bath / Whole home / Addition / Other), "when works for a call" free text, message, honeypot. Button: "Begin a project". The phone number beside it as the alternative.
9. **Footer**: name, phone, address, service area, socials as text.

Conversion rules: three conversion points (hero, after the work, the contact spread) plus the mobile bar; the phone number visible in the header at every size. Form wiring in one commented config block: `const FORM = { endpoint: "{{form_endpoint}}", key: "{{form_access_key}}", email: "{{client_email}}" };` posting with `fetch` (FormData), loading/success ("Received. We'll call within one business day.")/error states with the phone as fallback, never clearing on error, a plain `<form method="post">` fallback. A placeholder endpoint still renders the form; the error state simply shows the phone.

## MOTION FOR THIS LOOK

A slow camera move through a finished house. Two or three of: the hero word revealing line by line from a mask while the photograph wipes in with a clip-path; inner-image zoom-out (1.08 → 1) inside a fixed frame on large plates; a single pinned sequence of three plates crossfading as one caption changes; a background shift from plaster to ink between spreads. Durations 200 / 600 / 1200ms, no bounce, nothing under 768px beyond simple reveals.

## VOICE

Short, specific, assured. Materials, house types, neighborhoods, how a week on site actually goes. Sentence case. Let the photographs do the talking.

## CLIENT BRIEF

```
business_name: {{business_name}}
city / service_area: {{city}} — {{neighborhoods_or_cities_served}}
years_in_business: {{years}}
owner_name / team: {{owner_and_team}}
services (ranked by priority/profit): {{services}}
price_tier: {{high-end | luxury}}
typical_project_ranges: {{ranges}}
typical_timelines: {{timelines}}
license / insurance / certifications: {{license_number, certs}}
google_rating / review_count: {{rating}} / {{count}}
testimonials: {{quotes with name, neighborhood, project}}
press / awards (real only): {{...}}
photos: {{image URLs + what each shows; mark before/after pairs}}
existing_brand (logo, colors, fonts): {{if any, or "none"}}
differentiators: {{what they actually do differently}}
phone / email / address: {{contact}}
social: {{links}}
form_endpoint: {{https://api.web3forms.com/submit (default) | other}}
form_access_key: {{key, or "placeholder"}}
client_email: {{where submissions should go}}
```
