// Shared by the browser and the optional catalog relay. Never return credentials.
export function workshopID(raw) {
  const text = String(raw || '').trim();
  const valid = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;
  if (valid.test(text)) return text;
  try {
    const url = new URL(text);
    const match = /^\/workshop\/([^/]+)\/?$/.exec(url.pathname);
    if (url.protocol === 'https:' && url.hostname === 'catalog.demo.redhat.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && match && valid.test(match[1])) return match[1];
  } catch { /* The caller presents the same message for all invalid IDs. */ }
  throw new Error('Enter your workshop ID or its catalog.demo.redhat.com/workshop/… URL.');
}

export function environmentURL(raw) {
  let url;
  try { url = new URL(String(raw).trim()); } catch { throw new Error('The assigned environment did not include a valid Showroom URL.'); }
  const trusted = ['opentlc.com', 'demo.redhat.com', 'azure.redhatworkshops.io'].some(domain => url.hostname.endsWith(`.${domain}`));
  if (url.protocol !== 'https:' || !trusted || url.username || url.password || (url.port && url.port !== '443') || url.search || url.hash || !/^\/(?:showroom(?:\/.*)?|wetty\/?)?$/.test(url.pathname)) {
    throw new Error('The assigned Showroom URL is not a supported RHDP browser terminal. Ask your facilitator to check the environment.');
  }
  return new URL('/showroom/', url.origin).href;
}

export function showroomURL(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('The workshop catalog returned an invalid assignment. Try again.');
  if (typeof payload.showroomUrl === 'string') return environmentURL(payload.showroomUrl);
  const assignment = payload.assignment;
  if (!assignment || typeof assignment !== 'object') throw new Error('Your environment has not been assigned yet. Ask your facilitator to check the workshop.');
  if (typeof assignment.labUserInterface?.url === 'string') return environmentURL(assignment.labUserInterface.url);
  const rows = Object.values(assignment.data || {}).filter(row => row && typeof row === 'object');
  for (const key of ['showroom_primary_view_url', 'showroom_url', 'lab_ui_url', 'bastion_showroom_url']) {
    const values = [...new Set(rows.map(row => row[key]).filter(value => typeof value === 'string' && value.trim()))];
    if (values.length > 1) throw new Error('Your assignment contains multiple Showroom environments. Ask your facilitator to check the workshop.');
    if (values.length === 1) return environmentURL(values[0]);
  }
  // Some VM-based environments report their Showroom link only in user messages.
  if (typeof assignment.messages === 'string') {
    const matches = [...new Set(assignment.messages.match(/https:\/\/[^\s<>"'\\]+\/showroom\/?(?=[\s<>"']|$)/g) || [])];
    if (matches.length === 1) return environmentURL(matches[0]);
  }
  throw new Error('Your assigned environment has no Showroom terminal. Ask your facilitator for a ready ROSA or ARO workshop environment; a Blank Environment is not sufficient.');
}

export function validateCredentials(email, password) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter the email assigned to this workshop.');
  if (typeof password !== 'string' || !password.length || password.length > 128 || /[\r\n\x00]/.test(password)) throw new Error('Enter the workshop password supplied by your facilitator.');
}

export function catalogError(status) {
  return ({
    400: 'The workshop rejected that email or password.',
    401: 'The workshop rejected that email or password.',
    403: 'The workshop password was not accepted.',
    404: 'That workshop was not found. Check the workshop ID.',
    409: 'No seats are left for this workshop. Ask your facilitator.',
    410: 'That workshop environment has expired. Ask your facilitator.',
    422: 'Your assignment has no supported Showroom terminal. Ask your facilitator for a ready ROSA or ARO workshop environment.',
    429: 'The workshop catalog is busy. Wait a moment and try again.',
  })[status] || 'The workshop catalog could not retrieve your environment. Try again or contact your facilitator.';
}

export async function readJSON(response, limit = 1024 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The workshop catalog returned an empty response. Try again.');
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('The workshop catalog returned an oversized response. Contact your facilitator.'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { throw new Error('The workshop catalog returned an invalid response. Try again.'); }
}
