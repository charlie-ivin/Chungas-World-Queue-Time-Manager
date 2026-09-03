# Park Map

A two-page site: `index.html` is the public map (embeddable in an iframe),
`admin.html` is where you place pins and set queue times / ride status.
Hours come from a single daily Google Calendar event.

## 1. Put this on GitHub Pages

1. Create a repo, push these files to the root (or a `/docs` folder).
2. Repo Settings → Pages → set the source branch/folder → save.
3. Your public map will be at `https://<you>.github.io/<repo>/index.html`,
   embeddable with:
   ```html
   <iframe src="https://<you>.github.io/<repo>/index.html" width="100%" height="700"></iframe>
   ```

## 2. Set up the Google Calendar

1. In Google Calendar, create (or pick) the calendar you'll use for hours.
2. Settings for that calendar → **Access permissions** → check
   **"Make available to public"**. (It only needs to be publicly *readable*.)
3. Copy the **Calendar ID** from Settings → "Integrate calendar".
4. Get a Google API key: [Google Cloud Console](https://console.cloud.google.com/)
   → APIs & Services → Credentials → Create API key → enable the
   **Google Calendar API** for it → restrict the key to that API and,
   ideally, to your GitHub Pages URL (Application restrictions → Websites).
5. Put the calendar ID and API key into `config.js`.

**Each day, create one event** with a title like:

```
Open between 9am and 8pm
```

- To open beyond that automatically, edit the title to add a tag, e.g.:
  `Open between 9am and 8pm [extended hours]`. Remove the tag manually
  when extended hours end.
- Once the current time passes the closing time (and there's no
  `[extended hours]` tag), the public map automatically shows every ride
  as closed — you don't need to touch the admin page for that.

## 3. Set up the admin login

The admin page isn't a real user-accounts system — it's a static page that
uses a **GitHub personal access token** to commit your changes to
`data.json` directly via the GitHub API. Anyone with the token URL could
still *see* the page, but only someone with a valid, correctly-scoped
token can save changes.

1. Fill in `githubOwner` / `githubRepo` / `githubBranch` / `dataPath` in
   `config.js`.
2. Create a **fine-grained personal access token**:
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   - Repository access: **only this repository**
   - Permissions: **Contents → Read and write**
   - Nothing else.
3. On `admin.html`, paste that token to log in. It's held in a JS
   variable for that browser tab only — never written to storage, never
   committed anywhere. Reloading the page logs you out.
4. Treat the token like a password. Don't paste it into any other site,
   and regenerate it if you ever think it leaked.

## 4. Add your real map

Replace the placeholder grid by setting `mapImageUrl` in `config.js` to
an image URL (e.g. an image you add to the repo, like `map.png`, referenced
as `"map.png"`).

## 5. Ride statuses

Each pin has one of four statuses, settable from the admin page:

- **Open** — shows the queue time (multiples of 5, editable range in
  `config.js` via `queueMin`/`queueMax`/`queueStep`)
- **Closed — Engineering Work**
- **Closed — All Day**
- **Temporarily Shut**

These are independent of the park-wide auto-close from the calendar —
if the whole park is past closing time, every pin shows "Park closed"
regardless of its individual status; during open hours, each pin shows
whatever you set it to.
