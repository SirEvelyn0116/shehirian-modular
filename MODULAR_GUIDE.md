# Modular Architecture Guide

Each section lives in `sections/<sectionName>/` and includes:

- `<section>.en.json`, `<section>.fr.json`, `<section>.ar.json` — multilingual content
- `render.js` — exports a `render<SectionName>(lang)` function that returns a DOM section
- Optional: `<section>.<lang>.jsonld` — SEO schema for structured data

Sections are dynamically loaded in `preview.js` and injected into the DOM.