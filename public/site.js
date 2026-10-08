/* FreelanceHub: Home, Browse gigs, How it works, About */
const fhCat = c => `<button class="btn btn-outline-secondary text-start" onclick="$('cat').value='${c}';showView('browse')">${c}</button>`;
window.SITE_CFG = {
  show: 'showView', hero: '.fh-hero', home: 'home',
  pages: {
    home: `<div class="row align-items-center g-4 py-3">
      <div class="col-lg-7">
        <h1 class="display-5 fw-bold">Small jobs. Real people. Done well.</h1>
        <p class="lead text-secondary">FreelanceHub connects clients who need a task done with freelancers who can do it. Post a gig, compare proposals and hire in one click.</p>
        <div class="d-flex gap-2 flex-wrap"><button class="btn btn-fh btn-lg" onclick="showView('browse')">Browse gigs</button>
          <button class="btn btn-lg btn-ghost" onclick="openAuth('register')">Join free</button></div>
      </div>
      <div class="col-lg-5"><div class="fh-card p-4"><h5 class="mb-3">Popular categories</h5>
        <div class="d-grid gap-2">${fhCat('Design')}${fhCat('Web Development')}${fhCat('Data Entry')}${fhCat('Writing')}</div></div></div></div>`,
    how: `<h2 class="mb-4">How it works</h2><div class="row g-3">
      <div class="col-md-6"><div class="fh-card p-4 h-100"><h5>If you need work done</h5><ol class="mb-0 mt-3">
        <li>Create a client account.</li><li>Post a gig with a budget.</li><li>Read the proposals you receive.</li><li>Hire the freelancer you like.</li></ol></div></div>
      <div class="col-md-6"><div class="fh-card p-4 h-100"><h5>If you want to earn</h5><ol class="mb-0 mt-3">
        <li>Create a freelancer account.</li><li>Search gigs that match your skills.</li><li>Send one proposal with your price.</li><li>Track whether it is accepted.</li></ol></div></div></div>`,
    about: `<div class="row"><div class="col-lg-8"><h2>About FreelanceHub</h2>
      <p class="mt-3">FreelanceHub is a small freelance marketplace built as a college project. Clients post gigs, freelancers send proposals, and the client hires exactly one of them.</p>
      <p>It is made with HTML, CSS, JavaScript, Bootstrap, Node.js and an SQLite database.</p>
      <p class="text-secondary">Developed by Khuman Ritu.</p></div></div>`
  },
  nav() {
    const L = (p, t) => `<button class="nl" data-page="${p}" onclick="showView('${p}')">${t}</button>`;
    const auth = me
      ? `<span class="who d-none d-lg-inline">Hi, ${esc(me.name)}</span>
         ${me.role === 'client' ? '<button class="btn btn-sm btn-fh" onclick="showView(\'post\')">Post a gig</button>' : ''}
         <button class="btn-ghost" onclick="showView('dash')">My ${me.role === 'client' ? 'gigs' : 'proposals'}</button>
         <button class="btn-ghost" onclick="openAuth('login')">Switch account</button>
         <button class="btn-ghost" onclick="logout()">Log out</button>`
      : `<button class="btn-ghost" onclick="openAuth('login')">Log in</button><button class="btn btn-sm btn-fh" onclick="openAuth('register')">Sign up</button>`;
    return `<div class="d-flex flex-wrap align-items-center gap-1 w-100"><div class="d-flex flex-wrap">${L('home', 'Home')}${L('browse', 'Browse gigs')}${L('how', 'How it works')}${L('about', 'About')}</div>
      <div class="ms-auto d-flex flex-wrap gap-2 align-items-center">${auth}</div></div>`;
  }
};

/* ---- page engine: extra pages, nav, back button (shared logic) ---- */
(function () {
  const C = window.SITE_CFG, orig = window[C.show], stack = [], PROTECTED = ['dash', 'upload', 'post', 'create'];
  let current = null;
  const main = document.querySelector('main');
  Object.entries(C.pages).forEach(([id, html]) => {
    const s = document.createElement('section');
    s.id = 'view-' + id; s.className = 'site-page d-none'; s.innerHTML = html;
    main.appendChild(s);
  });
  const bar = document.createElement('div');
  bar.id = 'backBar'; bar.className = 'd-none mb-3';
  bar.innerHTML = '<button class="back-btn" onclick="goBack()">&larr; Back</button>';
  $('alertBox').after(bar);
  const hero = document.querySelector(C.hero);
  function setActive(v) { document.querySelectorAll('[data-page]').forEach(e => e.classList.toggle('active', e.dataset.page === v)); }
  window[C.show] = function (v, fromBack) {
    const isPage = !!C.pages[v];
    if (!isPage && PROTECTED.includes(v) && !me) return orig(v);       // asks the user to log in
    if (!fromBack && current && current !== v) stack.push(current);
    current = v;
    document.querySelectorAll('.site-page').forEach(s => s.classList.toggle('d-none', s.id !== 'view-' + v));
    if (isPage) ['browse', 'dash', 'upload', 'post', 'create'].forEach(x => { const e = $('view-' + x); if (e) e.classList.add('d-none'); });
    else orig(v);
    if (hero) hero.classList.toggle('d-none', v !== 'browse');
    bar.classList.toggle('d-none', v === C.home || v === 'browse');
    setActive(v); window.scrollTo(0, 0);
  };
  window.goBack = function () { window[C.show](stack.pop() || C.home, true); };
  window.renderNav = function () { $('navRight').innerHTML = C.nav(); setActive(current); };
  window[C.show](C.home);
})();
