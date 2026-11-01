# Ryan Wong – Portfolio

Static portfolio site (HTML/CSS/JS, no build step).

## Deploy as your GitHub Pages site
1. Create a **public** repo named exactly `<your-github-username>.github.io`.
2. Upload these files (or `git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push -u origin main`).
3. Repo → Settings → Pages → Source: **Deploy from a branch** → `main` / root.
4. Your site goes live at `https://<your-github-username>.github.io`.

## Optional: profile README
A repo named exactly `<your-github-username>` with a `README.md` shows on your GitHub profile page. Link to this site from there.

## Customise
Edit `index.html` directly; all content (experience, projects, skills, certifications) lives there.

GitHub username: `Ryan-wong123` → create the repo `Ryan-wong123.github.io` for the site at `https://ryan-wong123.github.io`.

## Automatic LinkedIn sync
The **Experience, Education, Certifications** and **About** sections are generated from `data/profile.json`.
A monthly GitHub Action (`.github/workflows/sync-linkedin.yml`) pulls your LinkedIn profile through an
[Apify](https://apify.com) actor, merges it into `data/profile.json`, rebuilds `index.html`
(`node scripts/build.js`) and opens a **pull request** for you to review. Merge it to publish.

### One-time setup
1. Create an Apify account and copy your API token (Settings → Integrations).
2. Repo → Settings → Secrets and variables → Actions → **New repository secret** `APIFY_TOKEN`.
3. Repo → Settings → Actions → General → enable **Allow GitHub Actions to create and approve pull requests**.
4. Optional repository *variables*: `LINKEDIN_URL` (defaults to your profile) and `APIFY_ACTOR`
   (default `dev_fusion~linkedin-profile-scraper`).
5. Run it once from the Actions tab (**Sync LinkedIn → Run workflow**) to check it works.

### What is and isn't synced
- Synced from LinkedIn: about, experience, education, certifications (certs are add/update only, never deleted).
- Kept by hand: tags on entries (preserved across syncs), projects, skills, hero, contact. Skills and projects on LinkedIn
  that aren't on the site are **reported only** (in the PR body, or in a "LinkedIn items not on the site" issue when
  there's no PR). Add them by hand, and list new projects in `data/projects-known.json`.
- `data/overrides.json` lists LinkedIn entries to ignore (e.g. the three Workato certs merged into one card).
- Safety nets: the job aborts if the scrape returns far fewer entries than the site has, and opens an
  issue if a run fails.

Test offline without Apify: `LINKEDIN_FIXTURE=sample.json node scripts/sync-linkedin.js`.
