#!/usr/bin/env node
// Fetch LinkedIn profile via Apify -> normalise -> merge into data/profile.json.
// Env:
//   APIFY_TOKEN      (required unless LINKEDIN_FIXTURE is set)
//   LINKEDIN_URL     profile URL
//   APIFY_ACTOR      actor id, default dev_fusion~linkedin-profile-scraper
//   LINKEDIN_FIXTURE path to a saved actor response (offline testing)
//   SUMMARY_FILE     where to write a markdown change summary (for the PR body)
//   NOTES_FILE       where to write report-only notes (projects/skills not on the site)
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const profile = read('data/profile.json');
const overrides = read('data/overrides.json');

// ---------- helpers ----------
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const esc = s => String(s ?? '').replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const display = s => plain(s).length ? String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
const norm = s => plain(s).replace(/[^a-z0-9]+/g, ' ').trim();
const ignored = (list, name) => (list || []).some(x => norm(name).includes(norm(x)));

// Accepts "10-2026", "2026-10", "Oct 2026", "2026", {month,year}, {year}, null
function fmtDate(d) {
  if (d == null || d === '') return '';
  if (typeof d === 'object') {
    const y = d.year ?? d.y, m = d.month ?? d.m;
    if (!y) return '';
    const mi = typeof m === 'string' && isNaN(+m) ? MONTHS.findIndex(x => m.toLowerCase().startsWith(x.toLowerCase())) : (+m || 0) - 1;
    return mi >= 0 && mi < 12 ? `${MONTHS[mi]} ${y}` : String(y);
  }
  const s = String(d).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[-/](\d{4})$/))) return `${MONTHS[+m[1] - 1]} ${m[2]}`;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})/))) return `${MONTHS[+m[2] - 1]} ${m[1]}`;
  if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/))) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}`;
  if (/^\d{4}$/.test(s)) return s;
  return s;
}
const text = s => esc(s).replace(/\r?\n/g, '<br>');

// ---------- fetch ----------
async function fetchRaw() {
  if (process.env.LINKEDIN_FIXTURE) return JSON.parse(fs.readFileSync(process.env.LINKEDIN_FIXTURE, 'utf8'));
  const token = process.env.APIFY_TOKEN, url = process.env.LINKEDIN_URL;
  if (!token) throw new Error('APIFY_TOKEN is not set');
  if (!url) throw new Error('LINKEDIN_URL is not set');
  const actor = process.env.APIFY_ACTOR || 'dev_fusion~linkedin-profile-scraper';
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ profileUrls: [url] }),
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  if (!res.ok) throw new Error(`Apify returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ---------- normalise (tolerant of field-name variants between actors) ----------
const pick = (o, ...keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; };

function normalise(raw) {
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== 'object') throw new Error('Empty response from scraper');
  const exp = (pick(p, 'experiences', 'experience', 'positions') || []).map(e => {
    const still = pick(e, 'jobStillWorking', 'current', 'isCurrent');
    const end = fmtDate(pick(e, 'jobEndedOn', 'endDate', 'end', 'endedOn'));
    return {
      title: esc(pick(e, 'title', 'position', 'jobTitle')),
      org: esc(pick(e, 'companyName', 'company', 'organization')),
      start: fmtDate(pick(e, 'jobStartedOn', 'startDate', 'start', 'startedOn')),
      end: still || !end ? 'Present' : end,
      description: text(pick(e, 'jobDescription', 'description', 'summary') ?? ''),
    };
  });
  const edu = (pick(p, 'educations', 'education') || []).map(e => {
    const period = pick(e, 'period') || {};
    const degree = [pick(e, 'degree', 'degreeName'), pick(e, 'fieldOfStudy', 'field')].filter(Boolean).join(', ');
    return {
      title: esc(degree || pick(e, 'subtitle') || ''),
      org: esc(pick(e, 'schoolName', 'school', 'title', 'institution')),
      start: fmtDate(pick(e, 'startDate', 'start') ?? period.startedOn),
      end: fmtDate(pick(e, 'endDate', 'end') ?? period.endedOn),
      description: text(pick(e, 'description', 'grade', 'activities') ?? ''),
    };
  });
  const certs = (pick(p, 'licenseAndCertificates', 'certifications', 'licenses') || []).map(c => ({
    name: esc(pick(c, 'title', 'name')),
    issuer: esc(pick(c, 'subtitle', 'authority', 'issuer', 'issuedBy')),
    date: fmtDate(pick(c, 'issuedAt', 'issueDate', 'date', 'issued')).replace(/^Issued\s*/i, ''),
  }));
  const projects = (pick(p, 'projects') || []).map(x => ({
    name: String(pick(x, 'title', 'name') ?? '').trim(),
    date: fmtDate(pick(x, 'startDate', 'start', 'date') ?? (pick(x, 'period') || {}).startedOn),
    url: pick(x, 'url', 'link') || '',
  })).filter(x => x.name);
  const aboutRaw = pick(p, 'about', 'summary');
  const about = aboutRaw ? String(aboutRaw).split(/\n\s*\n/).map(s => text(s.trim())).filter(Boolean) : [];
  return { about, experience: exp.filter(e => e.title && e.org), education: edu.filter(e => e.org),
           certifications: certs.filter(c => c.name), projects, skills: (pick(p, 'skills') || []).map(s => typeof s === 'string' ? s : s.title || s.name).filter(Boolean) };
}

// ---------- merge ----------
const key = e => norm(e.org) + '|' + norm(e.title);
// Keep curated bits (tags, hand-written HTML like <strong>) when LinkedIn's text is semantically unchanged.
function mergeList(oldList, fresh, ignoreList) {
  return fresh.filter(e => !ignored(ignoreList, e.org + ' ' + e.title)).map(n => {
    const o = oldList.find(x => key(x) === key(n)) || oldList.find(x => norm(x.org) === norm(n.org) && x.start === n.start);
    if (!o) return { ...n, tags: [] };
    return { ...n, title: plain(o.title) === plain(n.title) ? o.title : n.title,
             description: !plain(n.description) || plain(o.description) === plain(n.description) ? o.description : n.description, tags: o.tags || [] };
  });
}
function mergeCerts(oldList, fresh) { // add/update only, never delete
  const out = [...oldList];
  for (const c of fresh) {
    if (ignored(overrides.ignoreCertifications, c.name + ' ' + c.issuer)) continue;
    const i = out.findIndex(x => norm(x.name) === norm(c.name));
    if (i < 0) { const at = out.findIndex(x => ts(x.date) < ts(c.date)); out.splice(at < 0 ? out.length : at, 0, c); } else if (c.date && out[i].date !== c.date) out[i] = { ...out[i], date: c.date };
  }
  return out;
}
const ts = d => { const m = String(d).match(/([A-Za-z]{3})?\s*(\d{4})/); return m ? +m[2] * 12 + Math.max(0, MONTHS.indexOf(m[1])) : 0; };

function mergeAbout(oldAbout, freshAbout) {
  if (!freshAbout.length) return oldAbout;
  return plain(oldAbout.join(' ')) === plain(freshAbout.join(' ')) ? oldAbout : freshAbout;
}

// ---------- main ----------
const fresh = normalise(await fetchRaw());

// Sanity guard: a partial/garbled scrape must not wipe the site.
if (fresh.experience.length === 0 || fresh.experience.length < Math.ceil(profile.experience.length * 0.6))
  throw new Error(`Scrape looks incomplete: ${fresh.experience.length} experience entries vs ${profile.experience.length} on site. Aborting.`);
if (fresh.education.length === 0 || fresh.education.length < Math.ceil(profile.education.length * 0.6))
  throw new Error(`Scrape looks incomplete: ${fresh.education.length} education entries vs ${profile.education.length} on site. Aborting.`);

const next = {
  about: mergeAbout(profile.about, fresh.about),
  experience: mergeList(profile.experience, fresh.experience, overrides.ignoreExperience),
  education: mergeList(profile.education, fresh.education, overrides.ignoreEducation),
  certifications: mergeCerts(profile.certifications, fresh.certifications),
};

// Change summary for the PR body
const lines = [];
const diffList = (label, a, b, id) => {
  const ak = new Map(a.map(x => [id(x), x])), bk = new Map(b.map(x => [id(x), x]));
  for (const [k, v] of bk) if (!ak.has(k)) lines.push(`- **${label} added:** ${display(id(v))}`);
  for (const [k, v] of ak) if (!bk.has(k)) lines.push(`- **${label} removed:** ${display(id(v))}`);
  for (const [k, v] of bk) if (ak.has(k) && JSON.stringify(ak.get(k)) !== JSON.stringify(v)) lines.push(`- **${label} changed:** ${display(id(v))}`);
};
if (JSON.stringify(next.about) !== JSON.stringify(profile.about)) lines.push('- **About** text changed');
diffList('Experience', profile.experience, next.experience, e => `${e.title} @ ${e.org}`);
diffList('Education', profile.education, next.education, e => `${e.title} @ ${e.org}`);
diffList('Certification', profile.certifications, next.certifications, c => c.name);

// Report-only: things on LinkedIn that are curated by hand on the site. Never written to the site.
const notes = [];
const known = new Set(Object.values(read('data/skills-known.json')).flat().map(norm));
const newSkills = fresh.skills.filter(s => !known.has(norm(s)));
if (newSkills.length) notes.push(`- **Skills** on LinkedIn but not on the site: ${newSkills.join(', ')}`);

const knownProjects = read('data/projects-known.json').projects.map(norm);
const matches = n => knownProjects.some(k => n.includes(k) || k.includes(n));
const newProjects = fresh.projects.filter(x => !matches(norm(x.name)) && !ignored(overrides.ignoreProjects, x.name));
for (const x of newProjects)
  notes.push(`- **Project** "${x.name}"${x.date ? ` (${x.date})` : ''}${x.url ? ` ${x.url}` : ''} is on LinkedIn but has no card on the site. Add one in index.html and list it in data/projects-known.json.`);

const out = [...lines, ...(notes.length ? ['', '### On LinkedIn but not on the site (report only, nothing was changed)', ...notes] : [])];
if (process.env.SUMMARY_FILE) fs.writeFileSync(process.env.SUMMARY_FILE, out.length ? out.join('\n') + '\n' : 'No changes.\n');
if (process.env.NOTES_FILE) fs.writeFileSync(process.env.NOTES_FILE, notes.join('\n') + (notes.length ? '\n' : ''));
if (JSON.stringify(next) === JSON.stringify(profile)) { console.log('No changes from LinkedIn.' + (notes.length ? '\n' + notes.join('\n') : '')); process.exit(0); }
fs.writeFileSync(new URL('data/profile.json', root), JSON.stringify(next, null, 2) + '\n');
console.log('profile.json updated:\n' + out.join('\n'));
