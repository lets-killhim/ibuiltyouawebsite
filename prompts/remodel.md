## THIS BRIEF: A RESIDENTIAL REMODELING COMPANY

Your experience here is a decade of identities and sites for architects, interior designers and design-build firms. The visitor is a homeowner about to spend $15k–$250k, often 40–70, frequently on a phone, asking: do you do my kind of project, is your work good, can I trust you in my house, how do I start. The page has two jobs, in order: turn that homeowner into a phone call or a contact-form submission, and look like an opinionated human designer made it for this company.

Generic design is a trust problem here: a homeowner judging whether a contractor is careful judges it partly by whether the website looks careful.

## MATERIALS, NOT MOODBOARDS

Remodeling is materials. Build the palette from three or four that fit this client: walnut, white oak, travertine, zellige tile, unlacquered brass, honed marble, plaster, slate, terracotta, matte black hardware, sage cabinetry. Name the tokens after them (`--plaster`, `--walnut`, `--brass`). If photos are supplied, pull the neutral and the accent from their dominant tones. Captions on project photos are part of the craft: small, specific, like a printed monograph ("Kitchen, full gut, nine weeks" only if the brief says so; otherwise the city and the company name).

## PICK ONE ART DIRECTION, DON'T BLEND

Choose from the client's tier, services and photography and commit. If `direction: auto`, pick the best fit and say why in one sentence. If `previous_direction` names one, choose differently unless it is clearly wrong for this client.

- **A. Monograph** — high-end design-build. Paper tones, large refined serif, extreme whitespace, projects presented like plates in an architecture book, captions everywhere. Motion: slow clip-path image reveals, almost no text motion.
- **B. Material Library** — kitchen and bath specialists. The palette appears as UI: services shown as material swatches (oak, terrazzo, brass) that open into project photos. Serif display with a clean grotesk.
- **C. Drafting Table** — additions, structural, whole-home. Dimension lines, a faint visible grid, plan-view line drawings as section dividers, labels set like annotations. Blueprint ink on paper, not literal blue. A seasoning, not a costume.
- **D. Workshop** — general contractors, value-to-mid tier, blue-collar confidence. Condensed industrial display at huge sizes, charcoal with one work-wear accent (safety orange, hunter green, mustard), tight grid, dense information, fast mechanical motion.
- **E. Quiet Luxury** — top-tier custom work. Almost no copy, enormous photography, muted tonal palette, tiny refined type, lots of air, one elegant "Begin a project" action.
- **F. Neighborhood Craft** — family-owned, long-tenured, community-rooted. Warm human palette, a friendly serif with personality, real people if photos allow, a handwritten-feeling accent used once or twice at most.

## PAGE ARCHITECTURE (taste never overrides this)

1. **Hero**: within five seconds, what they do, where, and for whom. A specific headline ("Kitchens and baths for Austin's older homes", never "Transform your space"), the strongest photo of real work, a primary action to `#contact`, and the phone number as a `tel:` link.
2. **Proof line**: the Google rating and review count as a refined typographic line, not badges. Years, license or certifications only if supplied.
3. **Work**: the most important spread. Lead with the best photo, big; counterpoint with a small detail crop; every photo captioned.
4. **Services**: scope shown so visitors self-qualify, in a layout that belongs to the direction (a typographic index, an indexed table, material tiles), never icon cards. Infer a plausible general set from the category and name; nothing specific like brands or square footage.
5. **Process**: four or five steps as a timeline or numbered editorial sequence (this content really is a sequence): consultation, design and fixed quote, build, walkthrough. No invented durations or guarantees. Address the anxieties here: mess, timeline overruns, budget surprises, communication.
6. **About**: short, specific, human. Use the owner's name if supplied; otherwise the company's voice.
7. **Service area**: the city and nearby, as given; no neighborhoods the brief did not name.
8. **Contact** (`id="contact"`, the destination of every CTA, designed as the climax, not an afterthought): a dark inverted spread works well, headline on one side, form on the other. Fields: name, phone, email, project type as tap targets (Kitchen / Bath / Addition / Whole home / Other), "when works for a call" free text, message, a hidden honeypot. Button: "Request a call back". The phone number beside the form as the alternative.
9. **Footer**: company name, phone, address, service area, social links if supplied.

Conversion rules: three conversion points (hero, after Work, contact) plus a sticky mobile bar (Call / Request a call) under 768px; the phone number visible in the header at every size.

Form wiring, in one commented config block at the top of the script: `const FORM = { endpoint: "{{form_endpoint}}", key: "{{form_access_key}}", email: "{{client_email}}" };` Submit with `fetch` (FormData) to `FORM.endpoint` with loading, success ("Got it, we'll call you within one business day") and error states (the phone as fallback), never clearing the form on error; a plain `<form method="post">` fallback for JavaScript off. If the endpoint is a placeholder, the form still renders and the error state simply shows the phone number.

## CLIENT BRIEF

```
business_name: {{business_name}}
city / service_area: {{city}} — {{neighborhoods_or_cities_served}}
years_in_business: {{years}}
owner_name / team: {{owner_and_team}}
services (ranked by priority/profit): {{services}}
price_tier: {{budget | mid | high-end | luxury}}
typical_project_ranges: {{ranges}}
typical_timelines: {{timelines}}
license / insurance / certifications: {{license_number, certs}}
google_rating / review_count: {{rating}} / {{count}}
testimonials: {{quotes with name, neighborhood, project}}
photos: {{list of image URLs with what each shows}}
existing_brand (logo, colors, fonts): {{if any, or "none"}}
differentiators: {{what they actually do differently}}
phone / email / address: {{contact}}
social: {{links}}
form_endpoint: {{https://api.web3forms.com/submit (default) | other}}
form_access_key: {{key, or "placeholder"}}
client_email: {{where submissions should go}}
direction: {{auto | A–F}}
previous_direction: {{last direction used}}
```
