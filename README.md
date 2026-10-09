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

Without any setup the app runs as an in-browser demo with sample photos. To store real
submissions, connect it to a Google Sheet (below).

## Connecting the Google Sheet

Submissions become rows in a Google Sheet and photos go into a Google Drive folder. A
small script inside the Sheet (`apps-script/Code.gs`) connects them to the website. There
are no API keys or paid services: the script runs as the Google account that sets it up.

**Do this from South-View's own Google account, not a student's.** Whoever owns the Sheet
owns the gallery. If that account is deleted, the gallery stops working.

1. Create a Google Sheet (for example "South-View Gallery") in the Drive folder where you
   want everything kept.
2. In the Sheet, open **Extensions → Apps Script**. Delete the starter code, paste in all
   of `apps-script/Code.gs`, and click **Save**.
3. Open **Project Settings** (the gear icon) and under **Script properties** add:
   - `STAFF_PASSWORD`: a passphrase staff will use on the Staff page.
   - `FOLDER_ID` (optional): the Drive folder photos should go into. Open the folder in
     Drive and paste its link from the address bar. Without it, photos go into a new
     **South-View Gallery Photos** folder next to the Sheet.
   - `SHEET_ID` (optional): only needed if the script isn't attached to a Sheet (made at
     script.google.com instead of step 2) and you want it to use a Sheet you already
     have. Paste the Sheet's link. Without it, such a script creates a
     **South-View Gallery** Sheet for you, inside the photos folder if `FOLDER_ID` is set.
4. Back in the editor, choose `setup` from the function menu in the toolbar and click
   **Run**. Google asks for permission. Because this is your own script and not a
   published app, it shows "Google hasn't verified this app". Click **Advanced → Go to
   (project name)** and allow. This creates the **Submissions** tab, checks that it can
   save to the photos folder, and shows links to the Sheet and folder in the log so you
   can confirm they're the right ones.
5. Click **Deploy → New deployment**, choose **Web app**, set **Execute as: Me** and
   **Who has access: Anyone**, then **Deploy**. Copy the web app URL (it ends in `/exec`).
6. Open that URL in a browser. You should see `{"ok":true,"photos":[]}`.
7. For local development, copy `.env.example` to `.env` and paste the URL into
   `VITE_APPS_SCRIPT_URL`.
8. For the live site, open the GitHub repo's **Settings → Secrets and variables →
   Actions → Variables** tab, add a variable named `APPS_SCRIPT_URL` with the URL, then
   push to `main` or re-run the Deploy workflow.

The web app URL isn't a secret, since it ends up in the public site. The staff password
is, which is why it lives in the script and never in `.env`.

The URL also decides which Google account receives the photos: the one that deployed
the script. To use a different account, repeat steps 1–5 from that account and swap in
the new URL. This also lets you point your local `.env` at a test copy in your own
account while the live site uses South-View's.

### Day to day

- Staff can approve photos on the Staff page, or by changing the **Status** column in
  the Sheet to `pending`, `approved` or `rejected`. Deleting a row removes it from the
  gallery (the photo file stays in the Drive folder).
- Staff add and delete events on the Staff page's **Events** tab. These are the events
  visitors can pick on the photo form and the QR sign, and the gallery's filter
  buttons. They live in the Sheet's
  **Events** tab, which `setup` creates with the original four events. Deleting an
  event unticks its **Active** box rather than removing the row, so photos already
  shared from it keep the event's name. Adding the same name again brings it back.
- Don't rename the **ID**, **Status** or **File ID** columns. Other columns can be
  reordered, and you can add your own. In the **Events** tab, don't change an event's
  **ID**: that's how photos stay linked to it.
- To change the staff password, edit the script property. It takes effect right away.
- To send new photos to a different folder, change `FOLDER_ID` and run `setup` again to
  check it. Photos already uploaded keep showing in the gallery, even if you move them
  between folders, because the Sheet tracks each photo by its file ID.
- The account that deployed the script must be able to edit the photos folder. If the
  folder belongs to someone else, the photos still count against the deploying
  account's storage, unless the folder is in a shared drive.
- If you change the script, paste in the new `Code.gs`, run `setup` again (it adds any
  new columns to the end of the Sheet, and the **Events** tab if it's missing), then use
  **Deploy → Manage deployments**, click the pencil, choose **Version: New version** and
  **Deploy**. Don't make a *new* deployment: that creates a new URL and the website
  stops working until it's updated.
- Photos are shared as "anyone with the link" so the gallery can show them, but the
  website only gives out links to approved photos.

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

Run any real model, such as WebLLM, **on the Staff page, on the staff member's laptop**,
not on the visitor's phone when they submit:

- **Phones can't be relied on.** WebLLM needs WebGPU and enough memory to hold the
  model. Many phones lack one or the other, and even where it works, downloading a
  model of hundreds of MB to several GB over event signal isn't realistic.
- **Staff laptops can.** A recent desktop browser with WebGPU (Chrome or Edge are the
  safest bets) runs it, and the browser keeps the model after the first download.
- **It's harder to fake.** A check that runs on the visitor's device can be skipped or
  its result made up by the sender. One that runs on the Staff page can't.

Today the simulated check runs at submit time: `checkSubmission()` in
`src/moderation/index.js`, called from `src/pages/Submit.jsx`. That only works because
the simulated version is instant and needs no model. When swapping in a real one:

1. Stop calling `checkSubmission()` from the Submit page, so new photos arrive without
   an AI check.
2. Run it on the Staff page for pending photos, for example with a "Run AI check" button
   on each card or one for all pending photos.
3. Save the result to the Sheet through a new staff action in `apps-script/Code.gs`
   (next to `setStatus`) that fills the **AI flagged**, **AI notes** and
   **AI check data** columns.

Keep the same result shape: `{ engine, flagged, rules: [{ label, result, reason }] }`.
The rules in `src/moderation/simulated.js` follow the CLUE approach from Joey's
research: split "is this appropriate?" into specific, checkable rules.

## Notes

- In demo mode, data lives only in the browser that submitted it. Clearing site data or
  using another device starts fresh from the sample photos.
- The demo staff PIN is a gate, not security. With the Google Sheet connected, the staff
  password is checked by the script, and 10 wrong tries lock the Staff page for 15 minutes.
- Sample photos in `public/seed/` are from southviewpreservation.com (Historic
  South-View Preservation Foundation), used for this class prototype.


## Link to App Scripts (Test)

* Note: We will make Charlene set this up (one time set up) with SouthView's google account

- https://script.google.com/d/1czJlFd9LyINuWI_jMCLffQJR9GgOtjypv3bjQLR58-u8YJY2cfRUHrgn/edit?usp=sharing 