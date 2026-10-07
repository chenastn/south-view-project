# South-View Community Gallery (prototype)

A clickable prototype of the photo submission and gallery system our LMC 3403 team is
proposing for the Historic South-View Preservation Foundation. It walks through the
same flow the final version will use inside South-View's Wix site:

1. A visitor at an event scans a QR code and submits a photo with an optional caption
   and a consent checkbox.
2. An AI check flags anything questionable (**simulated** in this prototype).
3. A South-View staff member approves or rejects each photo.
4. Approved photos appear in a public gallery, sorted by event.

This is a stand-in for the pitch demo, not the final product. The real build uses Wix's
own tools (see the mapping below).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173/south-view-project/. `npm run build` outputs the static
site to `dist/`. Pushing to `main` deploys it to GitHub Pages through
`.github/workflows/deploy.yml`.

## Demo script (about 2 minutes)

1. **Before presenting:** open Staff (PIN `1886`) and click **Reset demo data** twice.
2. **Gallery:** show the photos and filter by event. Point out that Praise House Project
   has no photos yet.
3. **QR Sign:** pick Praise House Project. Explain that this goes on the welcome table,
   then click **Open the form** (the code works from a phone too, but a phone's
   submissions stay on that phone).
4. **Submit:** choose a photo, add a caption, check consent and send it.
5. **Staff:** enter PIN `1886`. The new photo is waiting with a passing check. Show the
   flagged example (a phone number in the caption breaks the personal-info rule) and
   reject it.
6. **Approve** the new photo, go back to the Gallery and filter by Praise House Project.

To flag a photo live, put a phone number or email in the caption, or describe someone
"standing on a headstone".

## How this maps to the Wix build

| Prototype | Wix |
| --- | --- |
| Submit form | Wix Form writing to a CMS Collection, approval field defaults to false |
| Simulated AI check | Automation on "Item added" that runs the check and emails staff |
| Staff review queue | Staff edit the Collection item and set approval to true |
| Gallery by event | Pro Gallery bound to the Collection, filtered to approved items |
| Browser storage (IndexedDB) | The CMS Collection itself |

## Swapping in a real AI check

Everything goes through `checkSubmission()` in `src/moderation/index.js`. Replace its
body with a real model call (e.g. WebLLM running in the browser) and return the same
shape: `{ engine, flagged, rules: [{ label, result, reason }] }`. The rules in
`src/moderation/simulated.js` follow the CLUE approach from Joey's research: split
"is this appropriate?" into specific, checkable rules.

## Notes

- Data lives only in the browser that submitted it. Clearing site data or using another
  device starts fresh from the sample photos.
- The staff PIN is a demo gate, not security.
- Sample photos in `public/seed/` are from southviewpreservation.com (Historic
  South-View Preservation Foundation), used for this class prototype.
