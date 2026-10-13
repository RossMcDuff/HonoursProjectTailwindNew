/* Shared code: TMDb AJAX helper, favourites (localStorage), cards, detail modal, nav. */
const API_KEY = 'c0ec73b3ee9cde420c363615e269bac7'; // TMDb key (client-side, as in the original study)
const IMG = 'https://image.tmdb.org/t/p/';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cache = {};
const HEART = '<svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2.1 0 3.4 1.2 4 2.3h4c.6-1.1 1.9-2.3 4-2.3 3.3 0 5.1 3.4 3.6 6.8C19.5 16.4 12 21 12 21z"/></svg>';

document.head.insertAdjacentHTML('beforeend', '<style>[data-fav][aria-pressed=true]{color:#ef6f6c}[data-fav][aria-pressed=true] svg{fill:currentColor}.no-scrollbar::-webkit-scrollbar{display:none}@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}</style>');

/* AJAX request to TMDb (XMLHttpRequest wrapped in a Promise) */
function api(path, params = {}) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({ api_key: API_KEY, language: 'en-GB', ...params });
    const x = new XMLHttpRequest();
    x.open('GET', `https://api.themoviedb.org/3/${path}?${q}`);
    x.onload = () => x.status === 200 ? resolve(JSON.parse(x.responseText)) : reject(new Error(x.status));
    x.onerror = () => reject(new Error('network'));
    x.send();
  });
}

/* Favourites: [{id, title, poster}] in localStorage (same shape as the original sites) */
const Fav = {
  all() { try { return JSON.parse(localStorage.getItem('favourites')) || []; } catch { return []; } },
  has(id) { return this.all().some(f => String(f.id) === String(id)); },
  toggle(m) {
    const had = this.has(m.id);
    const next = had ? this.all().filter(f => String(f.id) !== String(m.id))
                     : [...this.all(), { id: String(m.id), title: m.title, poster: m.poster_path }];
    localStorage.setItem('favourites', JSON.stringify(next));
    toast(had ? `Removed ${m.title} from favourites` : `Saved ${m.title} to favourites`);
    updateCount();
    return !had;
  }
};
const favText = id => Fav.has(id) ? 'Saved to favourites' : 'Save to favourites';
function syncFavs() {
  document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', Fav.has(b.dataset.fav)));
  document.querySelectorAll('[data-favtext]').forEach(s => s.textContent = favText(s.dataset.favtext));
}
function updateCount() {
  const el = $('#favCount'), n = Fav.all().length;
  if (el) { el.textContent = n; el.classList.toggle('hidden', !n); }
}
function toast(msg) {
  document.querySelectorAll('#toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.id = 'toast'; t.setAttribute('role', 'status');
  t.className = 'fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-cream px-5 py-2 text-sm font-medium text-ink shadow-lg';
  t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* Layout shared by every page */
function shell(active) {
  const link = (h, t) => `<a href="${h}" ${active === h ? 'aria-current="page"' : ''} class="rounded-md px-3 py-2 ${active === h ? 'text-gold' : 'text-cream/80 hover:text-cream'}">${t}${h === 'favourites.html' ? '<span id="favCount" class="ml-2 hidden rounded-full bg-gold/20 px-2 text-sm text-gold"></span>' : ''}</a>`;
  $('#nav').innerHTML = `<nav class="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur"><div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between px-4 py-3">
    <a href="index.html" class="font-display text-2xl font-semibold">Movie Finder</a>
    <button id="menuBtn" aria-expanded="false" aria-controls="menu" class="rounded-md border border-line px-3 py-1.5 md:hidden">Menu</button>
    <div id="menu" class="hidden w-full flex-col pt-3 md:flex md:w-auto md:flex-row md:gap-1 md:pt-0">${link('index.html', 'Home')}${link('search.html', 'Search')}${link('favourites.html', 'Favourites')}</div></div></nav>`;
  $('#menuBtn').onclick = e => { const m = $('#menu'); m.classList.toggle('hidden'); e.target.setAttribute('aria-expanded', !m.classList.contains('hidden')); };
  $('#foot').innerHTML = '<div class="mx-auto mt-16 max-w-7xl border-t border-line px-4 py-8 text-sm text-cream/60">Movie data comes from TMDb. This product uses the TMDb API but is not endorsed or certified by TMDb.</div>';
  updateCount();
}

const skeleton = (n, cls = '') => Array(n).fill(`<div class="aspect-[2/3] animate-pulse rounded-lg bg-panel ${cls}"></div>`).join('');
const errorBox = '<p class="py-6 text-cream/70">Movies could not be loaded. Check your connection, then <button onclick="location.reload()" class="text-gold underline">reload the page</button>.</p>';

function card(m, row) {
  cache[m.id] = m;
  const year = (m.release_date || '').slice(0, 4);
  const hasPoster = m.poster_path && !/^(null|undefined)$/.test(m.poster_path);
  const img = hasPoster ? `<img src="${IMG}w342${m.poster_path}" alt="" loading="lazy" class="aspect-[2/3] w-full object-cover">`
    : `<div class="grid aspect-[2/3] place-items-center bg-panel p-3 text-center text-cream/60">${esc(m.title)}</div>`;
  return `<article class="relative ${row ? 'w-40 shrink-0 snap-start sm:w-44' : ''}">
    <button data-open="${m.id}" class="block w-full overflow-hidden rounded-lg border border-line bg-panel text-left transition hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">${img}
      <span class="block p-3"><span class="line-clamp-2 block text-sm font-medium leading-snug">${esc(m.title)}</span><span class="mt-1 block text-sm text-cream/60">${year}</span></span></button>
    ${m.vote_average ? `<span class="absolute left-2 top-2 rounded bg-ink/85 px-2 py-0.5 text-xs font-semibold text-gold">${m.vote_average.toFixed(1)}</span>` : ''}
    <button data-fav="${m.id}" aria-pressed="${Fav.has(m.id)}" aria-label="Save ${esc(m.title)} to favourites" class="absolute right-2 top-2 rounded-full bg-ink/85 p-1.5 text-cream/80 hover:text-coral">${HEART}</button></article>`;
}

/* Detail modal: one request returns details, credits and similar movies */
async function openMovie(id) {
  const box = $('#modal');
  document.body.classList.add('overflow-hidden');
  box.innerHTML = '<div data-close class="fixed inset-0 z-40 grid place-items-center bg-black/75"><div class="h-16 w-16 animate-pulse rounded-full bg-panel"></div></div>';
  try {
    const m = await api(`movie/${id}`, { append_to_response: 'credits,similar' });
    cache[m.id] = m;
    const director = m.credits.crew.filter(c => c.job === 'Director').map(c => c.name).join(', ') || 'Not listed';
    const cast = m.credits.cast.slice(0, 6).map(c => c.name).join(', ') || 'Not listed';
    const similar = m.similar.results.filter(s => s.poster_path).slice(0, 5);
    const run = m.runtime ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m` : '';
    const link = 'rounded-full border border-line px-5 py-2.5 hover:border-gold';
    box.innerHTML = `<div data-close class="fixed inset-0 z-40 overflow-y-auto bg-black/75 sm:p-6"><div role="dialog" aria-modal="true" aria-label="${esc(m.title)}" class="mx-auto max-w-4xl overflow-hidden border-line bg-ink sm:rounded-2xl sm:border">
      <div class="relative h-48 bg-panel sm:h-64">${m.backdrop_path ? `<img src="${IMG}w1280${m.backdrop_path}" alt="" class="h-full w-full object-cover">` : ''}
        <div class="absolute inset-0 bg-gradient-to-t from-ink to-transparent"></div>
        <button data-closebtn class="absolute right-3 top-3 rounded-full bg-ink/85 px-4 py-1.5 hover:text-gold">Close</button></div>
      <div class="relative px-5 pb-8 sm:px-8"><div class="flex gap-5 sm:gap-8">
        ${m.poster_path ? `<img src="${IMG}w342${m.poster_path}" alt="Poster for ${esc(m.title)}" class="-mt-20 hidden w-40 self-start rounded-lg border border-line sm:block">` : ''}
        <div class="min-w-0 flex-1"><h2 class="font-display text-3xl font-semibold sm:text-4xl">${esc(m.title)}</h2>
          ${m.tagline ? `<p class="mt-1 italic text-cream/60">${esc(m.tagline)}</p>` : ''}
          <p class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-cream/80"><span>${(m.release_date || '').slice(0, 4)}</span><span>${run}</span><span class="text-gold">★ ${m.vote_average ? m.vote_average.toFixed(1) : 'Not rated'}</span></p>
          <p class="mt-3 flex flex-wrap gap-2">${m.genres.map(g => `<span class="rounded-full bg-panel px-3 py-1 text-sm">${esc(g.name)}</span>`).join('')}</p></div></div>
        <p class="mt-6 max-w-prose leading-relaxed text-cream/90">${esc(m.overview) || 'No plot summary available.'}</p>
        <dl class="mt-5 grid gap-1 text-sm sm:grid-cols-[6rem_1fr]"><dt class="text-cream/60">Director</dt><dd>${esc(director)}</dd><dt class="text-cream/60">Cast</dt><dd>${esc(cast)}</dd></dl>
        <div class="mt-6 flex flex-wrap gap-3">
          <button data-fav="${m.id}" aria-pressed="${Fav.has(m.id)}" class="${link} bg-panel"><span data-favtext="${m.id}">${favText(m.id)}</span></button>
          <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + ' trailer')}" target="_blank" rel="noopener" class="${link}">Watch trailer</a>
          <a href="https://www.imdb.com/find?q=${encodeURIComponent(m.title)}&s=tt" target="_blank" rel="noopener" class="${link}">Read reviews</a></div>
        ${similar.length ? `<h3 class="mt-10 font-display text-xl">Similar movies</h3><div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">${similar.map(s => card(s)).join('')}</div>` : ''}
      </div></div></div>`;
    box.firstElementChild.scrollTop = 0;
    box.querySelector('[data-closebtn]').focus();
  } catch { box.innerHTML = `<div data-close class="fixed inset-0 z-40 grid place-items-center bg-black/75 p-6"><div class="rounded-xl bg-ink p-6">Details could not be loaded. <button data-closebtn class="text-gold underline">Close</button></div></div>`; }
}
function closeModal() { $('#modal').innerHTML = ''; document.body.classList.remove('overflow-hidden'); }

document.addEventListener('click', e => {
  const f = e.target.closest('[data-fav]');
  if (f) { const m = cache[f.dataset.fav]; if (m) { Fav.toggle(m); syncFavs(); if (window.onFavChange) window.onFavChange(); } return; }
  const o = e.target.closest('[data-open]');
  if (o) { openMovie(o.dataset.open); return; }
  if (e.target.matches('[data-close]') || e.target.closest('[data-closebtn]')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* Scroll arrows for horizontally scrolling rows (shown on wider screens; touch users swipe) */
function addArrows(el, top = 'top-1/3') {
  const wrap = document.createElement('div');
  wrap.className = 'relative';
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  const make = (dir, label, side) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', label); b.textContent = dir < 0 ? '\u2039' : '\u203A';
    b.className = `absolute ${side} ${top} z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/90 text-2xl leading-none shadow-lg hover:border-gold hover:text-gold`;
    b.onclick = () => el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
    wrap.appendChild(b);
    return b;
  };
  const left = make(-1, 'Scroll left', 'left-1'), right = make(1, 'Scroll right', 'right-1');
  const update = () => {
    left.classList.toggle('md:grid', el.scrollLeft > 8);
    right.classList.toggle('md:grid', el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };
  el.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  new MutationObserver(update).observe(el, { childList: true });
  update();
}
