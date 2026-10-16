import gsap from 'gsap';
import { profile, about, projects, goals, contact } from '../content.js';
import { STOPS, activeSection } from '../core/timeline.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function panelHead(s) {
  return `
    <div class="panel__kicker" style="--accent:${s.accent};--accent2:${s.accent2}">
      <span class="panel__index">${s.index}</span><span>${esc(s.kicker)}</span>
    </div>
    <h2 class="panel__title" data-text="${esc(s.title)}">${esc(s.title)}</h2>
    <p class="panel__headline">${esc(s.headline)}</p>`;
}

function aboutHTML() {
  return `
    ${panelHead(about)}
    ${about.paragraphs.map((p) => `<p class="panel__body">${esc(p)}</p>`).join('')}
    <dl class="facts">${about.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>
    <ul class="chips">${about.skills.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
}

function projectsHTML() {
  return `
    ${panelHead(projects)}
    <ol class="projects">${projects.items
      .map(
        (p, i) => `
      <li>
        <a class="project" href="${esc(p.link)}" target="_blank" rel="noopener" aria-label="${esc(p.name)} — open on GitHub">
          <div class="project__num">${String(i + 1).padStart(2, '0')}</div>
          <div>
            <h3>${esc(p.name)} <span class="${/progress|development/i.test(p.status) ? 'is-live' : ''}">${esc(p.status)}</span></h3>
            <p>${esc(p.blurb)}</p>
            <div class="project__meta">
              ${p.tags.map((t) => `<em>${esc(t)}</em>`).join('')}
              <span class="project__gh">GitHub ↗</span>
            </div>
          </div>
        </a>
      </li>`
      )
      .join('')}</ol>`;
}

function goalsHTML() {
  return `
    ${panelHead(goals)}
    <ul class="goals">${goals.items
      .map(
        (g) => `
      <li>
        <span class="goals__when">${esc(g.when)}</span>
        <strong>${esc(g.title)}</strong>
        <p>${esc(g.goal)}</p>
        <div class="bar"><i style="--w:${Math.round(g.progress * 100)}%"></i></div>
      </li>`
      )
      .join('')}</ul>
    <blockquote>“${esc(goals.quote)}”</blockquote>`;
}

export class UI {
  constructor({ onNavigate, onReturn, audio }) {
    this.onReturn = onReturn;
    this.onNavigate = onNavigate;
    this.audio = audio;
    this.current = null;
    this.build();
    this.bindCursor();
  }

  build() {
    const root = $('#ui');
    root.innerHTML = `
      <header class="hud">
        <a class="logo" href="#" aria-label="Back to the portal">
          <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c-3 0-5 3-5 7 0 2 .5 4 1.5 5.5L18 13l-3 3 11 8c-1 1-1.5 2-1.5 3.5L12 26l-1 4 13.6 2.5c.2 1 .6 2 1.2 3L13 44l2 3.5 13-7.5c1 .8 2.4 1.5 4 1.5s3-.7 4-1.5l13 7.5 2-3.5-12.8-8.5c.6-1 1-2 1.2-3L53 30l-1-4-12.5 1.5c0-1.5-.5-2.5-1.5-3.5l11-8-3-3-10.5 5.5C36.5 17 37 15 37 13c0-4-2-7-5-7z"/></svg>
          <span>${esc(profile.shortName)}</span>
        </a>
        <div class="dimension" aria-live="polite"><i></i><span id="dim-label">${esc(profile.earth)}</span></div>
        <div class="sound-ctl">
          <button class="sound" id="sound" aria-pressed="false"><span class="sound__bars"><i></i><i></i><i></i><i></i></span><span class="sound__txt">Sound off</span></button>
          <label class="volume" title="Volume">
            <span class="sr-only">Volume</span>
            <svg class="volume__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="volume__w1" d="M16 9.5a3.5 3.5 0 0 1 0 5"/><path class="volume__w2" d="M18.5 7a7 7 0 0 1 0 10"/></svg>
            <input type="range" id="volume" min="0" max="100" step="1" value="50" aria-label="Volume" />
            <output class="volume__val" for="volume">50</output>
          </label>
        </div>
      </header>

      <nav class="nav" aria-label="Sections">
        ${STOPS.map((s) => `<button data-p="${s.p}" data-id="${s.id}"><span>${s.label}</span><i></i></button>`).join('')}
      </nav>

      <section class="hero" id="hero">
        <p class="hero__pre">${esc(profile.earth)} // Portfolio</p>
        <h1 class="hero__name" data-text="${esc(profile.name)}">${esc(profile.name)}</h1>
        <p class="hero__role">${esc(profile.role)}</p>
        <p class="hero__tag">${esc(profile.tagline)}</p>
        <div class="hero__cta">
          <span class="scroll-hint"><span class="mouse"><i></i></span>Scroll to enter the portal</span>
          <button class="skip" id="skip">Skip to the city ⟶</button>
        </div>
      </section>

      <div class="city-title" id="city-title">
        <span class="city-title__earth">${esc(profile.cityEarth)}</span>
        <strong data-text="${esc(profile.city)}">${esc(profile.city)}</strong>
        <span class="city-title__hint">Keep scrolling — every building has a story</span>
      </div>

      <aside class="panel" data-id="about" style="--accent:${about.accent};--accent2:${about.accent2}">${aboutHTML()}</aside>
      <aside class="panel" data-id="projects" style="--accent:${projects.accent};--accent2:${projects.accent2}">${projectsHTML()}</aside>
      <aside class="panel" data-id="goals" style="--accent:${goals.accent};--accent2:${goals.accent2}">${goalsHTML()}</aside>

      <section class="outro panel" data-id="contact" style="--accent:#ff2d6f;--accent2:#2de2ff">
        <div class="panel__kicker"><span class="panel__index">04</span><span>Signal the web-slinger</span></div>
        <h2 class="panel__title" data-text="LET'S TALK">LET'S TALK</h2>
        <div class="outro__mailrow">
          <a class="outro__mail" href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=${encodeURIComponent(contact.email)}" target="_blank" rel="noopener" title="Write to me in Gmail">${esc(contact.email)}</a>
          <button class="outro__copy" id="copy-mail" aria-label="Copy email address">Copy</button>
        </div>
        <div class="outro__links">${contact.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>
        <button class="outro__back" id="back-top">⟲ Back through the portal</button>
      </section>

      <div class="sfx" id="sfx" aria-hidden="true"></div>
      <div class="flash" id="flash"></div>
      <div class="speedlines" id="speedlines"></div>
      <div class="progress"><i id="progress"></i></div>
      <div class="cursor" id="cursor"><i></i></div>
      <p class="hover-tip" id="hover-tip">Click to open</p>
    `;

    this.el = {
      hero: $('#hero'),
      cityTitle: $('#city-title'),
      dim: $('#dim-label'),
      progress: $('#progress'),
      flash: $('#flash'),
      speed: $('#speedlines'),
      sfx: $('#sfx'),
      cursor: $('#cursor'),
      tip: $('#hover-tip'),
      panels: [...document.querySelectorAll('.panel')],
      nav: [...document.querySelectorAll('.nav button')],
    };

    for (const b of this.el.nav)
      b.addEventListener('click', () => (b.dataset.id === 'portal' ? this.onReturn() : this.onNavigate(parseFloat(b.dataset.p))));
    $('#skip').addEventListener('click', () => this.onNavigate(STOPS[1].p));
    $('#back-top').addEventListener('click', () => this.onReturn());
    $('.logo').addEventListener('click', (e) => {
      e.preventDefault();
      this.onReturn();
    });
    const btn = $('#sound');
    const txt = $('.sound__txt');
    this.audio.onStatus = (status) => {
      btn.classList.toggle('on', status === 'on');
      btn.setAttribute('aria-pressed', status === 'on');
      txt.textContent = status === 'on' ? 'Sound on' : 'Sound off';
    };
    btn.addEventListener('click', () => this.audio.toggle());

    // Volume slider — always in the HUD, so the level can be changed anywhere on the site.
    const vol = $('#volume');
    const volBox = $('.volume');
    const volOut = $('.volume__val');
    let saved = 50;
    try {
      const v = parseInt(localStorage.getItem('sv-ambient-volume'), 10);
      if (!Number.isNaN(v)) saved = Math.min(100, Math.max(0, v));
    } catch {}
    const setVol = (v, persist) => {
      vol.value = v;
      volOut.textContent = v;
      volBox.style.setProperty('--v', `${v}%`);
      volBox.dataset.level = v === 0 ? 'mute' : v < 50 ? 'low' : 'high';
      this.audio.setVolume(v / 100);
      // turning the volume up while sound is off switches it on
      if (persist && v > 0 && !this.audio.enabled) this.audio.toggle(true);
      if (persist) try { localStorage.setItem('sv-ambient-volume', v); } catch {}
    };
    setVol(saved, false);
    vol.addEventListener('input', () => setVol(+vol.value, true));
    // the page scroll listens for wheel events; keep wheel-on-slider from scrolling the story
    vol.addEventListener('wheel', (e) => {
      e.preventDefault();
      setVol(Math.min(100, Math.max(0, +vol.value + (e.deltaY < 0 ? 5 : -5))), true);
    }, { passive: false });

    // copy email
    const copyBtn = $('#copy-mail');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(contact.email);
        copyBtn.textContent = 'Copied!';
      } catch {
        copyBtn.textContent = 'Select & copy';
      }
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1600);
    });
  }

  bindCursor() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    document.body.classList.add('has-cursor');
    const c = this.el.cursor;
    const xTo = gsap.quickTo(c, 'x', { duration: 0.15, ease: 'power3' });
    const yTo = gsap.quickTo(c, 'y', { duration: 0.15, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      this.el.tip.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 18}px)`;
    });
    window.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button, .panel, .sound-ctl')) return;
      this.webSplat(e.clientX, e.clientY);
    });
  }

  // Comic web splat where the user clicks.
  webSplat(x, y) {
    this.audio.thwip();
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '-50 -50 100 100');
    s.classList.add('splat');
    let d = '';
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + Math.random() * 0.3;
      d += `M0 0 L${Math.cos(a) * 46} ${Math.sin(a) * 46} `;
    }
    for (const r of [12, 24, 36]) {
      d += 'M';
      for (let i = 0; i <= spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        const rr = r + (Math.random() - 0.5) * 4;
        d += `${Math.cos(a) * rr} ${Math.sin(a) * rr} ${i < spokes ? 'L' : ''}`;
      }
    }
    s.innerHTML = `<path d="${d}" />`;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    document.body.appendChild(s);
    gsap.fromTo(s, { scale: 0.2, rotate: Math.random() * 90, opacity: 1 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    gsap.to(s, { opacity: 0, delay: 0.7, duration: 0.6, onComplete: () => s.remove() });
  }

  // Comic sound-effect lettering.
  sfx(text, { x = 50, y = 40, color = '#ffd400', size = 1, rotate = -8 } = {}) {
    const el = document.createElement('div');
    el.className = 'sfx__word';
    el.textContent = text;
    el.dataset.text = text;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.setProperty('--c', color);
    el.style.fontSize = `${size * 8}vmin`;
    this.el.sfx.appendChild(el);
    gsap.fromTo(el, { scale: 0, rotate: rotate - 20, opacity: 1 }, { scale: 1, rotate, duration: 0.35, ease: 'back.out(3)' });
    gsap.to(el, { scale: 1.15, opacity: 0, delay: 0.9, duration: 0.4, onComplete: () => el.remove() });
  }

  flash(strength = 1) {
    gsap.fromTo(this.el.flash, { opacity: strength }, { opacity: 0, duration: 0.6, ease: 'power2.out' });
  }

  setHover(on, label) {
    document.body.classList.toggle('hovering', on);
    this.el.tip.classList.toggle('show', on);
    if (label) this.el.tip.textContent = label;
  }

  update(p, { warp = 0, falling = 0, inCity = false }) {
    this.el.progress.style.transform = `scaleX(${p})`;

    // hero copy fades as Spider-Man swings in
    const heroO = Math.max(0, 1 - p / 0.06);
    this.el.hero.style.opacity = heroO;
    this.el.hero.style.transform = `translateY(${-p * 600}px)`;
    this.el.hero.style.visibility = heroO <= 0 ? 'hidden' : 'visible';

    // dimension readout
    const label = warp > 0.05 && warp < 0.98 ? 'JUMPING ▓▒░' : inCity ? `${profile.cityEarth} · ${profile.city}` : profile.earth;
    if (this.el.dim.textContent !== label) this.el.dim.textContent = label;
    document.body.classList.toggle('in-city', inCity);

    // city title card shows during the skyline reveal
    const ct = p > 0.455 && p < 0.52;
    this.el.cityTitle.classList.toggle('show', ct);

    this.el.speed.style.opacity = falling;

    const active = activeSection(p);
    if (active !== this.current) {
      this.current = active;
      for (const panel of this.el.panels) panel.classList.toggle('show', panel.dataset.id === active);
    }
    // nav highlight = last stop whose range has started
    let idx = 0;
    STOPS.forEach((s, i) => {
      if (p >= s.from) idx = i;
    });
    this.el.nav.forEach((b, i) => b.classList.toggle('active', i === idx));
  }
}
