#!/usr/bin/env node
// Renders data/profile.json into the marked regions of index.html.
// Usage: node scripts/build.js
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const profile = JSON.parse(fs.readFileSync(new URL('data/profile.json', root), 'utf8'));
const htmlPath = new URL('index.html', root);
let html = fs.readFileSync(htmlPath, 'utf8');

// Text from LinkedIn is escaped on the way in (sync.js); values here are trusted HTML.
const tags = t => (t && t.length ? `\n          <div class="tags">${t.map(x => `<span>${x}</span>`).join('')}</div>` : '');
const dates = e => `${e.start} – ${e.end}`;
const entry = e =>
`        <article class="glass">
          <span class="date">${dates(e)}</span>
          <h4>${e.title} <em>· ${e.org}</em></h4>${e.description ? `\n          <p>${e.description}</p>` : ''}${tags(e.tags)}
        </article>`;

const regions = {
  about: () => profile.about.map(p => `          <p>${p}</p>`).join('\n'),
  experience: () => profile.experience.map(entry).join('\n'),
  education: () => profile.education.map(entry).join('\n'),
  certifications: () => profile.certifications
    .map(c => `        <div class="glass"><b>${c.name}</b><span>${c.issuer} · ${c.date}</span></div>`).join('\n'),
};

for (const [name, render] of Object.entries(regions)) {
  const re = new RegExp(`(<!-- BEGIN:${name} -->\\n)[\\s\\S]*?(\\n\\s*<!-- END:${name} -->)`);
  if (!re.test(html)) throw new Error(`Marker region "${name}" not found in index.html`);
  html = html.replace(re, (_, a, b) => a + render() + b);
}
fs.writeFileSync(htmlPath, html);
console.log('index.html rebuilt from data/profile.json');
