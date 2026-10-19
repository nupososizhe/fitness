const API = '../server/api.php';
const BADGE = { 1: 'badge--new', 2: 'badge--confirmed', 3: 'badge--done' };

async function api(action, { method = 'GET', body, query = '' } = {}) {
  const res = await fetch(`${API}?action=${action}${query}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch (e) { data = { error: 'Сервер недоступен' }; }
  return { ok: res.ok, status: res.status, data };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => iso.split('-').reverse().join('.');
const badge = (id, title) => `<span class="badge ${BADGE[id]}" data-badge>${esc(title)}</span>`;

/* ---------- Шапка ---------- */
async function initHeader() {
  const { data } = await api('me');
  const user = data.user;
  document.querySelectorAll('[data-auth="guest"]').forEach((el) => (el.hidden = Boolean(user)));
  document.querySelectorAll('[data-auth="user"]').forEach((el) => (el.hidden = !user));
  document.querySelectorAll('[data-auth="admin"]').forEach((el) => (el.hidden = !(user && user.is_admin)));
  const out = document.getElementById('logout');
  if (out) out.addEventListener('click', async (e) => {
    e.preventDefault();
    await api('logout', { method: 'POST' });
    location.href = 'index.html';
  });
  return user;
}

// Страницы с доступом только после входа
function requireUser(user, adminOnly = false) {
  if (!user) { location.href = 'login.html'; return false; }
  if (adminOnly && !user.is_admin) { location.href = 'index.html'; return false; }
  return true;
}

/* ---------- Главная ---------- */
async function initIndex() {
  const { data } = await api('catalog');
  const box = document.getElementById('catalog');
  if (!data.workouts) { box.innerHTML = `<p class="notice">${esc(data.error || 'Не удалось загрузить каталог')}</p>`; return; }
  box.innerHTML = data.workouts.map((w) => `
    <article class="card">
      <img src="images/${esc(w.image_path)}" alt="${esc(w.title)}" width="320" height="180" loading="lazy">
      <div class="card__body">
        <h3>${esc(w.title)}</h3>
        <a class="btn" href="application.html?workout=${w.id}">Записаться</a>
      </div>
    </article>`).join('');
}

/* ---------- Регистрация и вход ---------- */
function initRegister() {
  const form = document.getElementById('register-form');
  const names = ['login', 'password', 'full_name', 'phone', 'email'];
  names.forEach((n) => form.elements[n].addEventListener('blur', () =>
    setFieldError(form, n, validateField(n, form.elements[n].value))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    let bad = false;
    names.forEach((n) => {
      const msg = validateField(n, form.elements[n].value);
      if (msg) { setFieldError(form, n, msg); bad = true; }
    });
    if (bad) return form.querySelector('.field--error').focus();
    const body = Object.fromEntries(names.map((n) => [n, form.elements[n].value]));
    const { ok, data } = await api('register', { method: 'POST', body });
    if (ok) { location.href = 'login.html?registered=1'; return; }
    Object.entries(data.errors || {}).forEach(([n, m]) => setFieldError(form, n, m));
    if (data.error) document.getElementById('form-error').textContent = data.error;
  });
}

function initLogin() {
  const form = document.getElementById('login-form');
  if (new URLSearchParams(location.search).has('registered'))
    document.getElementById('form-ok').textContent = 'Регистрация прошла успешно. Войдите в аккаунт.';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    document.getElementById('form-error').textContent = '';
    let bad = false;
    ['login', 'password'].forEach((n) => {
      if (!form.elements[n].value.trim()) { setFieldError(form, n, 'Заполните поле'); bad = true; }
    });
    if (bad) return;
    const { ok, data } = await api('login', { method: 'POST',
      body: { login: form.elements.login.value, password: form.elements.password.value } });
    if (ok) location.href = data.user.is_admin ? 'admin.html' : 'cabinet.html';
    else document.getElementById('form-error').textContent = data.error || 'Ошибка входа';
  });
}

/* ---------- Заявка ---------- */
async function initApplication() {
  const form = document.getElementById('application-form');
  const { data } = await api('catalog');
  const fill = (name, rows) => {
    form.elements[name].insertAdjacentHTML('beforeend', rows.map((r) => `<option value="${r.id}">${esc(r.title)}</option>`).join(''));
  };
  fill('workout_id', data.workouts || []);
  fill('payment_id', data.payments || []);
  const pre = new URLSearchParams(location.search).get('workout');
  if (pre) form.elements.workout_id.value = pre;
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  form.elements.desired_date.min = today;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const names = { workout_id: 'Выберите направление', payment_id: 'Выберите способ оплаты', desired_date: 'Укажите дату' };
    let bad = false;
    Object.entries(names).forEach(([n, m]) => { if (!form.elements[n].value) { setFieldError(form, n, m); bad = true; } });
    if (form.elements.desired_date.value && form.elements.desired_date.value < today) {
      setFieldError(form, 'desired_date', 'Дата не может быть в прошлом'); bad = true;
    }
    if (bad) return;
    const body = Object.fromEntries(Object.keys(names).map((n) => [n, form.elements[n].value]));
    const res = await api('apply', { method: 'POST', body });
    if (res.ok) { location.href = 'cabinet.html'; return; }
    Object.entries(res.data.errors || {}).forEach(([n, m]) => setFieldError(form, n, m));
    if (res.data.error) document.getElementById('form-error').textContent = res.data.error;
  });
}

/* ---------- Мои заявки ---------- */
function stars(n) {
  return Array.from({ length: 5 }, (_, i) =>
    `<img class="star ${i < n ? 'star--on' : ''}" src="images/icon-star.png" alt="" width="20" height="20">`).join('');
}

function reviewBlock(a) {
  if (a.rating) return `<div class="review"><div aria-label="Оценка ${a.rating} из 5">${stars(a.rating)}</div><p>${esc(a.comment)}</p></div>`;
  if (a.status_id != 3) return '';
  return `
    <button class="btn btn--ghost" type="button" data-open-review="${a.id}">Оставить отзыв</button>
    <form class="review-form" data-review="${a.id}" hidden novalidate>
      <div class="stars-input" role="radiogroup" aria-label="Оценка">
        ${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="star-btn" data-rate="${i}" aria-label="${i} из 5"><img class="star" src="images/icon-star.png" alt="" width="28" height="28"></button>`).join('')}
      </div>
      <input type="hidden" name="rating">
      <div class="error-text" data-error-for="rating" role="alert"></div>
      <textarea class="field" name="comment" rows="3" placeholder="Расскажите, как прошла тренировка" aria-label="Комментарий"></textarea>
      <div class="error-text" data-error-for="comment" role="alert"></div>
      <div class="error-text is-shown" id="review-error-${a.id}" role="alert"></div>
      <button class="btn" type="submit">Отправить отзыв</button>
    </form>`;
}

async function initCabinet() {
  const list = document.getElementById('my-list');
  const load = async () => {
    const { ok, data } = await api('my_applications');
    if (!ok) { list.innerHTML = `<p class="notice">${esc(data.error || 'Ошибка')}</p>`; return; }
    if (!data.applications.length) {
      list.innerHTML = `<div class="empty"><img src="images/empty.webp" alt="Шейкер и гантель на полу" width="352" height="198"><p>Заявок пока нет. Выберите направление и запишитесь на первую тренировку.</p><a class="btn" href="application.html">Записаться</a></div>`;
      return;
    }
    list.innerHTML = data.applications.map((a) => `
      <article class="card card--request">
        <div class="card__body">
          <div class="row"><h3>${esc(a.workout)}</h3>${badge(a.status_id, a.status)}</div>
          <p class="meta"><img src="images/icon-calendar.png" alt="" width="20" height="20">${fmtDate(a.desired_date)}</p>
          <p class="meta"><img src="images/icon-card.png" alt="" width="20" height="20">${esc(a.payment)}</p>
          ${reviewBlock(a)}
        </div>
      </article>`).join('');
  };
  list.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open-review]');
    if (open) { open.nextElementSibling.hidden = false; open.hidden = true; return; }
    const star = e.target.closest('[data-rate]');
    if (star) {
      const form = star.closest('form');
      form.elements.rating.value = star.dataset.rate;
      form.querySelectorAll('[data-rate]').forEach((b) => b.firstElementChild.classList.toggle('star--on', +b.dataset.rate <= +star.dataset.rate));
      setFieldError(form, 'rating', '');
    }
  });
  list.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    clearErrors(form);
    const id = form.dataset.review;
    const rating = +form.elements.rating.value;
    const comment = form.elements.comment.value;
    let bad = false;
    if (!rating) { setFieldError(form, 'rating', 'Поставьте оценку'); bad = true; }
    if (!comment.trim()) { setFieldError(form, 'comment', 'Напишите комментарий'); bad = true; }
    if (bad) return;
    const res = await api('review', { method: 'POST', body: { application_id: +id, rating, comment } });
    if (res.ok) return load();
    Object.entries(res.data.errors || {}).forEach(([n, m]) => setFieldError(form, n, m));
    document.getElementById('review-error-' + id).textContent = res.data.error || '';
  });
  load();
}

/* ---------- Админка ---------- */
async function initAdmin() {
  const filter = document.getElementById('status-filter');
  const cards = document.getElementById('requests-cards');
  const tbody = document.getElementById('requests-body');
  const tableWrap = document.getElementById('requests-table');
  const empty = document.getElementById('admin-empty');
  const cat = (await api('catalog')).data;
  const options = (cur) => cat.statuses.map((s) => `<option value="${s.id}" ${s.id == cur ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
  filter.insertAdjacentHTML('beforeend', cat.statuses.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join(''));

  const picker = (a) => `
    <label class="visually-hidden" for="st-${a.id}-${a.uid}">Статус заявки ${a.id}</label>
    <select class="field" id="st-${a.id}-${a.uid}" data-status-select="${a.id}">${options(a.status_id)}</select>
    <button class="btn" type="button" data-save="${a.id}">Сохранить</button>`;

  const load = async () => {
    const q = filter.value ? `&status_id=${filter.value}` : '';
    const { ok, data } = await api('admin_applications', { query: q });
    if (!ok) { empty.hidden = false; empty.querySelector('p').textContent = data.error || 'Ошибка'; return; }
    const rows = data.applications;
    empty.hidden = rows.length > 0;
    empty.querySelector('p').textContent = 'Заявок с таким статусом нет.';
    cards.innerHTML = rows.map((a) => `
      <article class="card card--request" data-id="${a.id}">
        <div class="card__body">
          <div class="row"><h3>${esc(a.workout)}</h3>${badge(a.status_id, a.status)}</div>
          <p class="meta"><img src="images/icon-profile.png" alt="" width="20" height="20">${esc(a.full_name)} (${esc(a.login)})</p>
          <p class="meta"><img src="images/icon-calendar.png" alt="" width="20" height="20">${fmtDate(a.desired_date)}</p>
          <p class="meta"><img src="images/icon-card.png" alt="" width="20" height="20">${esc(a.payment)}</p>
          <div class="status-edit">${picker({ ...a, uid: 'c' })}</div>
        </div>
      </article>`).join('');
    tbody.innerHTML = rows.map((a) => `
      <tr data-id="${a.id}">
        <td>${esc(a.full_name)}<br><small>${esc(a.login)}</small></td>
        <td>${esc(a.workout)}</td><td>${fmtDate(a.desired_date)}</td><td>${esc(a.payment)}</td>
        <td>${badge(a.status_id, a.status)}</td>
        <td class="status-edit">${picker({ ...a, uid: 't' })}</td>
      </tr>`).join('');
    tableWrap.hidden = rows.length === 0;
  };

  document.querySelector('main').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    const id = btn.dataset.save;
    const sel = btn.parentElement.querySelector('select');
    const res = await api('set_status', { method: 'POST', body: { id: +id, status_id: +sel.value } });
    if (!res.ok) { alert(res.data.error || 'Не удалось сменить статус'); return; }
    if (filter.value) return load(); // при активном фильтре заявка может выпасть из выборки
    const title = sel.options[sel.selectedIndex].text;
    document.querySelectorAll(`[data-id="${id}"] [data-badge]`).forEach((b) => {
      b.className = `badge ${BADGE[sel.value]} badge--changed`;
      b.textContent = title;
      setTimeout(() => b.classList.remove('badge--changed'), 300);
    });
    document.querySelectorAll(`[data-id="${id}"] select`).forEach((s) => (s.value = sel.value));
  });
  filter.addEventListener('change', load);
  load();
}

/* ---------- Запуск ---------- */
(async function () {
  const page = document.body.dataset.page;
  const user = await initHeader();
  if (page === 'cabinet' && !requireUser(user)) return;
  if (page === 'application' && !requireUser(user)) return;
  if (page === 'admin' && !requireUser(user, true)) return;
  ({ index: initIndex, register: initRegister, login: initLogin,
     application: initApplication, cabinet: initCabinet, admin: initAdmin })[page]?.();
})();
