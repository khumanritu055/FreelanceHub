let me = null;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let authMode = 'login';

async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
const alertHtml = (msg, type = 'danger') => `<div class="alert alert-${type} py-2">${esc(msg)}</div>`;
function flash(msg, type = 'success') { $('alertBox').innerHTML = alertHtml(msg, type); setTimeout(() => $('alertBox').innerHTML = '', 3500); }
const modal = id => bootstrap.Modal.getOrCreateInstance($(id));

function renderNav() {
  $('navRight').innerHTML = me
    ? `<span class="text-white-50 d-none d-md-inline">Hi, ${esc(me.name)} (${me.role})</span>
       ${me.role === 'client' ? '<button class="btn btn-sm btn-fh" onclick="showView(\'post\')">Post a gig</button>' : ''}
       <button class="btn btn-sm btn-outline-light" onclick="showView('dash')">My ${me.role === 'client' ? 'gigs' : 'proposals'}</button>
       <button class="btn btn-sm btn-outline-light" onclick="logout()">Log out</button>`
    : `<button class="btn btn-sm btn-outline-light" onclick="openAuth('login')">Log in</button>
       <button class="btn btn-sm btn-fh" onclick="openAuth('register')">Sign up</button>`;
}

function showView(v) {
  if ((v === 'dash' || v === 'post') && !me) return openAuth('login');
  ['browse', 'dash', 'post'].forEach(x => $('view-' + x).classList.toggle('d-none', x !== v));
  if (v === 'browse') loadGigs();
  if (v === 'dash') loadDash();
}

// ---------- Auth ----------
function openAuth(mode) { authMode = mode; applyAuthMode(); $('authAlert').innerHTML = ''; modal('authModal').show(); }
function toggleAuth() { authMode = authMode === 'login' ? 'register' : 'login'; applyAuthMode(); }
function applyAuthMode() {
  const reg = authMode === 'register';
  $('regOnly').classList.toggle('d-none', !reg);
  $('authTitle').textContent = reg ? 'Create account' : 'Log in';
  $('authBtn').textContent = reg ? 'Create account' : 'Log in';
  $('authSwitch').textContent = reg ? 'Already have an account? Log in' : 'New here? Create an account';
}
async function submitAuth() {
  try {
    const body = { email: $('a_email').value, password: $('a_pass').value };
    if (authMode === 'register') Object.assign(body, { name: $('a_name').value, role: $('a_role').value, skills: $('a_skills').value });
    me = await api('/api/' + authMode, 'POST', body);
    modal('authModal').hide(); renderNav(); showView('browse'); flash(`Welcome, ${me.name}!`);
  } catch (e) { $('authAlert').innerHTML = alertHtml(e.message); }
}
async function logout() { await api('/api/logout', 'POST'); me = null; renderNav(); showView('browse'); }

// ---------- Gigs ----------
async function loadGigs() {
  const gigs = await api(`/api/gigs?q=${encodeURIComponent($('q').value)}&category=${encodeURIComponent($('cat').value)}`);
  $('gigList').innerHTML = gigs.length ? gigs.map(g => `
    <div class="col-md-6"><div class="card fh-card h-100"><div class="card-body d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start">
        <h5 class="mb-1">${esc(g.title)}</h5><span class="badge badge-${g.status}">${g.status}</span>
      </div>
      <div class="text-muted small mb-2">${esc(g.category)} - posted by ${esc(g.client_name)}</div>
      <p class="flex-grow-1">${esc(g.description)}</p>
      <div class="d-flex justify-content-between align-items-center">
        <div><span class="budget">Rs. ${g.budget}</span> <span class="text-muted small">- ${g.proposal_count} proposal(s)</span></div>
        ${me && me.role === 'freelancer' && g.status === 'open'
          ? `<button class="btn btn-sm btn-fh" onclick="openProposal(${g.id})">Send proposal</button>` : ''}
      </div>
    </div></div></div>`).join('')
    : '<div class="col-12"><div class="alert alert-light border">No gigs match your search. Try a different word, or post the first one.</div></div>';
}

async function postGig() {
  try {
    await api('/api/gigs', 'POST', { title: $('g_title').value, description: $('g_desc').value, category: $('g_cat').value, budget: Number($('g_budget').value) });
    ['g_title', 'g_desc', 'g_budget'].forEach(i => $(i).value = '');
    showView('dash'); flash('Gig posted.');
  } catch (e) { flash(e.message, 'danger'); }
}

// ---------- Proposals ----------
function openProposal(id) {
  if (!me) return openAuth('login');
  $('p_gig').value = id; $('p_price').value = ''; $('p_msg').value = ''; $('propAlert').innerHTML = '';
  modal('propModal').show();
}
async function sendProposal() {
  try {
    await api(`/api/gigs/${$('p_gig').value}/proposals`, 'POST', { price: Number($('p_price').value), message: $('p_msg').value });
    modal('propModal').hide(); flash('Proposal sent.'); loadGigs();
  } catch (e) { $('propAlert').innerHTML = alertHtml(e.message); }
}
async function viewProposals(gigId) {
  const list = await api(`/api/gigs/${gigId}/proposals`);
  $('listBody').innerHTML = list.length ? list.map(p => `
    <div class="card fh-card mb-2"><div class="card-body">
      <div class="d-flex justify-content-between"><strong>${esc(p.freelancer_name)}</strong>
        <span class="badge badge-${p.status}">${p.status}</span></div>
      <div class="text-muted small">${esc(p.skills) || 'No skills listed'}</div>
      <p class="my-2">${esc(p.message)}</p>
      <div class="d-flex justify-content-between align-items-center"><span class="budget">Rs. ${p.price}</span>
        ${p.status === 'pending' ? `<button class="btn btn-sm btn-fh" onclick="accept(${p.id},${gigId})">Hire this freelancer</button>` : ''}</div>
    </div></div>`).join('') : '<p class="mb-0">No proposals yet. Freelancers will appear here once they apply.</p>';
  modal('listModal').show();
}
async function accept(pid, gigId) {
  try { await api(`/api/proposals/${pid}/accept`, 'POST'); await viewProposals(gigId); loadDash(); flash('Freelancer hired.'); }
  catch (e) { flash(e.message, 'danger'); }
}
async function delGig(id) {
  if (!confirm('Delete this gig and its proposals?')) return;
  await api('/api/gigs/' + id, 'DELETE'); loadDash();
}

// ---------- Dashboard ----------
async function loadDash() {
  const rows = await api('/api/dashboard');
  const isClient = me.role === 'client';
  $('view-dash').innerHTML = `<h4 class="mb-3">${isClient ? 'My gigs' : 'My proposals'}</h4>` + (rows.length ? rows.map(r => isClient ? `
    <div class="card fh-card mb-2"><div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div><strong>${esc(r.title)}</strong> <span class="badge badge-${r.status}">${r.status}</span>
        <div class="text-muted small">Rs. ${r.budget} - ${r.proposal_count} proposal(s)</div></div>
      <div class="d-flex gap-2"><button class="btn btn-sm btn-fh" onclick="viewProposals(${r.id})">View proposals</button>
        <button class="btn btn-sm btn-outline-danger" onclick="delGig(${r.id})">Delete</button></div>
    </div></div>` : `
    <div class="card fh-card mb-2"><div class="card-body d-flex justify-content-between align-items-center">
      <div><strong>${esc(r.title)}</strong><div class="text-muted small">Your price: Rs. ${r.price} (budget Rs. ${r.budget})</div></div>
      <span class="badge badge-${r.status}">${r.status}</span>
    </div></div>`).join('')
    : `<div class="alert alert-light border">${isClient ? 'You have not posted any gigs yet.' : 'You have not sent any proposals yet. Browse gigs and apply.'}</div>`);
}

(async () => { me = await api('/api/me'); renderNav(); loadGigs(); })();
