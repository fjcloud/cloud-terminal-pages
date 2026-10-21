const workshops = {
  'rosa-ai-app-platform': { title: 'AI developer platform on ROSA', cloud: 'AWS' },
  'aro-ai-app-platform': { title: 'AI developer platform on ARO', cloud: 'Azure' },
};

const $ = (id) => document.getElementById(id);
let active = null;

function environmentURL(raw) {
  let url;
  try { url = new URL(raw.trim()); } catch { throw new Error('Enter the HTTPS Showroom URL from your RHDP environment details.'); }
  const trusted = ['opentlc.com', 'demo.redhat.com'].some(domain => url.hostname.endsWith(`.${domain}`));
  if (url.protocol !== 'https:' || !trusted || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Use an HTTPS RHDP URL on opentlc.com or demo.redhat.com, without credentials or a custom port.');
  }
  if (url.search || url.hash) throw new Error('Use the Showroom URL without query parameters or a fragment.');
  if (!/^\/(?:showroom(?:\/.*)?|wetty\/?)?$/.test(url.pathname)) {
    throw new Error('Use the Showroom or WeTTY URL from your RHDP environment details.');
  }
  return new URL('/showroom/', url.origin).href;
}

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = !message;
  $('showroom').setAttribute('aria-invalid', message ? 'true' : 'false');
}

function shareURL() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = new URLSearchParams(active).toString();
  return url;
}

function openWorkshop(workshop, raw) {
  if (!Object.hasOwn(workshops, workshop)) throw new Error('Choose one of the listed workshops.');
  const showroom = environmentURL(raw);
  const guide = `https://fjcloud.github.io/${workshop}/modules/100-setup/lab_1_access_${workshop.startsWith('rosa') ? 'rosa' : 'aro'}.html`;
  const terminal = new URL('/wetty/', showroom).href;
  active = { workshop, showroom };
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

$('start-form').addEventListener('submit', event => {
  event.preventDefault();
  try { openWorkshop($('workshop').value, $('showroom').value); }
  catch (error) { showError(error.message); $('showroom').focus(); }
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
  $('showroom').focus();
});

$('copy-link').addEventListener('click', async () => {
  if (!active) return;
  try {
    await navigator.clipboard.writeText(shareURL().href);
    $('status').textContent = 'Workshop link copied. Share it only with people assigned to this environment.';
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
if (initial.has('showroom') || initial.has('workshop')) {
  $('showroom').value = initial.get('showroom') || '';
  const workshop = initial.get('workshop') || $('workshop').value;
  if (Object.hasOwn(workshops, workshop)) $('workshop').value = workshop;
  try { openWorkshop(workshop, $('showroom').value); }
  catch (error) { showError(error.message); }
}
