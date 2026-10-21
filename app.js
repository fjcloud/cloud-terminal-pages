import { workshopID, environmentURL, showroomURL, validateCredentials, catalogError, readJSON } from './catalog.mjs';

const catalogAPI = 'https://cloud-terminal-catalog.fj-9d1.workers.dev/api/workshop/';
const workshops = {
  'rosa-ai-app-platform': { title: 'AI developer platform on ROSA', cloud: 'AWS' },
  'aro-ai-app-platform': { title: 'AI developer platform on ARO', cloud: 'Azure' },
};

const $ = (id) => document.getElementById(id);
let active = null;

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = !message;
}

function shareURL() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = new URLSearchParams(active).toString();
  return url;
}

function openWorkshop(workshop, raw, id) {
  if (!Object.hasOwn(workshops, workshop)) throw new Error('Choose one of the listed workshops.');
  const showroom = environmentURL(raw);
  const guide = `https://fjcloud.github.io/${workshop}/modules/100-setup/lab_1_access_${workshop.startsWith('rosa') ? 'rosa' : 'aro'}.html`;
  const terminal = new URL('/wetty/', showroom).href;
  active = { workshop, id };
  $('guide').src = guide;
  $('terminal').src = terminal;
  $('guide-link').href = guide;
  $('terminal-link').href = terminal;
  $('setup').hidden = true;
  $('workspace').hidden = false;
  $('session-actions').hidden = false;
  $('status').textContent = `${workshops[workshop].cloud} · ${workshops[workshop].title}`;
  document.title = `${workshops[workshop].title} · Cloud Terminal`;
  showError('');
  history.replaceState(null, '', shareURL());
  // A frame's load event cannot prove a cross-origin SSH session is ready.
  $('guide-link').focus();
}

$('start-form').addEventListener('submit', async event => {
  event.preventDefault();
  const workshop = $('workshop').value;
  const email = $('email').value.trim();
  const accessPassword = $('password').value;
  const controller = new AbortController();
  let timer;
  try {
    const id = workshopID($('workshop-id').value);
    validateCredentials(email, accessPassword);
    if (!Object.hasOwn(workshops, workshop)) throw new Error('Choose one of the listed workshops.');
    showError('');
    for (const field of $('start-form').elements) field.disabled = true;
    $('password').value = '';
    $('start').textContent = 'Finding your environment…';
    $('status').textContent = 'Retrieving your assigned workshop environment…';
    timer = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(catalogAPI + encodeURIComponent(id), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessPassword }),
        credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
      });
    } catch {
      throw new Error(controller.signal.aborted ? 'The workshop catalog took too long to respond. Try again.' : 'The workshop catalog could not be reached. Try again or contact your facilitator.');
    }
    if (!response.ok) throw new Error(catalogError(response.status));
    let payload;
    try { payload = await readJSON(response); }
    catch (error) { throw new Error(controller.signal.aborted ? 'The workshop catalog took too long to respond. Try again.' : error.message); }
    const assigned = showroomURL(payload);
    openWorkshop(workshop, assigned, id);
  } catch (error) {
    showError(error.message);
    $('status').textContent = 'The workshop could not be opened.';
  } finally {
    clearTimeout(timer);
    $('password').value = '';
    for (const field of $('start-form').elements) field.disabled = false;
    $('start').textContent = 'Open workshop';
  }
});

$('change').addEventListener('click', () => {
  $('guide').removeAttribute('src');
  $('terminal').removeAttribute('src');
  $('workspace').hidden = true;
  $('setup').hidden = false;
  $('session-actions').hidden = true;
  $('status').textContent = 'Your workshop, ready in the browser.';
  document.title = 'Cloud Terminal';
  active = null;
  history.replaceState(null, '', location.pathname);
  $('password').value = '';
  $('password').focus();
});

$('copy-link').addEventListener('click', async () => {
  if (!active) return;
  try {
    await navigator.clipboard.writeText(shareURL().href);
    $('status').textContent = 'Workshop link copied. Each participant signs in with their own assigned email and the workshop password.';
    $('copy-link').textContent = 'Link copied';
    setTimeout(() => { $('copy-link').textContent = 'Copy workshop link'; }, 2500);
  } catch {
    $('status').textContent = 'Copy the workshop link from your browser’s address bar.';
    $('copy-link').textContent = 'Copy address bar link';
  }
});

for (const panel of ['guide', 'terminal']) {
  $(`${panel}-tab`).addEventListener('click', () => {
    $('panels').classList.toggle('terminal-active', panel === 'terminal');
    $('guide-tab').setAttribute('aria-pressed', String(panel === 'guide'));
    $('terminal-tab').setAttribute('aria-pressed', String(panel === 'terminal'));
  });
}

const splitter = $('splitter');
function resize(value) {
  const width = Math.max(25, Math.min(75, value));
  $('panels').style.setProperty('--guide-width', `${width}%`);
  splitter.setAttribute('aria-valuenow', String(Math.round(width)));
}
splitter.addEventListener('keydown', event => {
  const value = Number(splitter.getAttribute('aria-valuenow'));
  const next = { ArrowLeft: value - 5, ArrowRight: value + 5, Home: 25, End: 75 }[event.key];
  if (next !== undefined) { event.preventDefault(); resize(next); }
});
splitter.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  splitter.setPointerCapture(event.pointerId);
  $('panels').classList.add('resizing');
});
splitter.addEventListener('pointermove', event => {
  if (!splitter.hasPointerCapture(event.pointerId)) return;
  const rect = $('panels').getBoundingClientRect();
  resize((event.clientX - rect.left) / rect.width * 100);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  splitter.addEventListener(event, () => $('panels').classList.remove('resizing'));
}

const initial = new URLSearchParams(location.hash.slice(1));
if (initial.has('id') || initial.has('workshop')) {
  const workshop = initial.get('workshop') || $('workshop').value;
  if (Object.hasOwn(workshops, workshop)) $('workshop').value = workshop;
  try {
    if (!Object.hasOwn(workshops, workshop)) throw new Error('Choose one of the listed workshops.');
    if (initial.has('id')) $('workshop-id').value = workshopID(initial.get('id'));
  }
  catch (error) { showError(error.message); }
}
// Keep only the workshop and ID in incoming links, never credentials or a seat URL.
const clean = new URL(location.href);
clean.search = '';
clean.hash = new URLSearchParams({ workshop: $('workshop').value, ...($('workshop-id').value ? { id: $('workshop-id').value } : {}) }).toString();
history.replaceState(null, '', clean);
