# JC Muay Thai

Static site build — plain HTML/CSS/JS, no build step required. `index.html`
loads its runtime from `support.js`, which in turn pulls React, ReactDOM,
and Babel Standalone from unpkg at runtime.

## Deploy

Deploys as-is on Vercel (or any static host): no install, no build command,
output is the repo root. See `vercel.json`.

## Local preview

Serve the directory with any static file server, e.g.:

```
npx serve .
```
