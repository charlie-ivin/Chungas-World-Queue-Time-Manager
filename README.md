# Park Map

A two-page site: `index.html` is the public map (embeddable in an iframe),
`admin.html` is where you set opening hours, place pins, and set queue
times / ride status.

## 1. Put this on GitHub Pages

1. Create a repo, push these files to the root (or a `/docs` folder).
2. Repo Settings → Pages → set the source branch/folder → save.
3. Your public map will be at `https://<you>.github.io/<repo>/index.html`,
   embeddable with:
   ```html
   <iframe src="https://<you>.github.io/<repo>/index.html" width="100%" height="700"></iframe>
   ```

## 2. Set up the admin login

The admin page isn't a real user-accounts system — it's a static page that
uses a **GitHub personal access token** to commit your changes to
`data.json` directly via the GitHub API. Anyone who finds the admin page
could still *see* it, but only someone with a valid, correctly-scoped
token can save changes.

1. Fill in `githubOwner` / `githubRepo` / `githubBranch` / `dataPath` in
   `config.js` — these must exactly match your repo's owner and name
   (check the URL on github.com, it's case-sensitive).
2. Create a personal access token:
   - **Fine-grained** (recommended): [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
     — Repository access: only this repository. Permissions: Contents →
     Read and write.
   - **Classic**: [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
     — tick `public_repo` if the repo is public, or `repo` if it's private.
3. On `admin.html`, paste that token to log in. It's held in a JS
   variable for that browser tab only — never written to storage, never
   committed anywhere. Reloading the page logs you out.
4. Treat the token like a password. Don't paste it into any other site,
   and regenerate it if you ever think it leaked.

## 3. Set opening hours

On the admin page, the **Opening Hours** panel sets:

- **Opens / Closes** — plain time-of-day, used every day
- **Extended hours** — flip this on to keep the park open past closing
  time (e.g. for a special event). Flip it back off manually when
  extended hours end.

Once the current time passes closing time (and Extended hours is off),
the public map automatically shows every ride as "Park closed" — you
don't need to touch anything else for that to happen.

## 4. Add your real map

Replace the placeholder grid by setting `mapImageUrl` in `config.js` to
an image URL (e.g. an image you add to the repo, like `map.png`, referenced
as `"map.png"`).

**Whenever you edit `config.js`**, also bump the `?v=` number on the
`<script src="config.js?v=...">` lines in `index.html` and `admin.html`
(e.g. v=3 → v=4). This forces browsers/CDNs to fetch the new version
instead of an old cached copy.

## 5. Ride statuses

Each pin has one of four statuses, settable from the admin page:

- **Open** — shows the queue time (multiples of 5, editable range in
  `config.js` via `queueMin`/`queueMax`/`queueStep`)
- **Closed — Engineering Work**
- **Closed — All Day**
- **Temporarily Shut**

These are independent of the park-wide auto-close — if the whole park is
past closing time, every pin shows "Park closed" regardless of its
individual status; during open hours, each pin shows whatever you set it to.
