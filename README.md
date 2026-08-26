# Market Partner — static site

This folder is a self-contained, static export of the Market Partner site: a homepage plus five service deep-dive pages. Every page is plain HTML/CSS/JS with no build step and no server-side code, so it can be hosted anywhere that serves static files.

## Files

- `index.html` — homepage
- `attendance-management.html`
- `companion-app.html`
- `touchscreen-rental.html`
- `virtual-event-production.html`
- `registration-sites.html`

All internal links between these pages are relative (e.g. `href="registration-sites.html"`), so the site works identically from any domain or folder — no find-and-replace needed before deploying.

## Local preview

No install required. From this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying

See the deployment guide for the full GitHub → AWS walkthrough. In short:

1. Push this folder to a GitHub repository.
2. Host the repository's contents on Amazon S3 (static website hosting) behind CloudFront for HTTPS and a CDN.
3. Point the `marketpartner.com` DNS at CloudFront and request a free TLS certificate via AWS Certificate Manager.

A ready-to-use GitHub Actions workflow (`.github/workflows/deploy.yml`) is included — it syncs this folder to an S3 bucket on every push to `main` once you add your AWS credentials as repository secrets.

## Notes

- Fonts (Hanken Grotesk, IBM Plex Mono) load from Google Fonts via `<link>` tags — no local font files needed.
- Each page duplicates the full design-system CSS inline (no shared stylesheet), which is why the pages are self-contained but a little larger than a typical multi-page site. This can be refactored into a shared `styles.css` later if desired.
