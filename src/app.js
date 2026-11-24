/**
 * CampusClubs Portal (P08 — DIK1305)
 * UI va rules.js ni bog'lovchi boshqaruv moduli
 */

import { STORAGE_KEY, createInitialState } from './data.js';
import {
  getEventCapacitySummary,
  registerForEvent,
  joinWaitlist,
  cancelRegistration,
  acceptWaitlistOffer,
  declineWaitlistOffer,
  applyForClubMembership,
  reviewMembershipApplication,
  updateEventCapacity,
  markAttendance
} from './rules.js';

let state = loadState();
let activeScreen = 'catalog';
let selectedEventId = state.events[0]?.id || '';
let selectedAttendanceEventId = state.events[1]?.id || state.events[0]?.id || '';
let lastResult = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.clubs)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('localStorage o‘qishda xatolik, namuna ma’lumotlar tiklanmoqda:', err);
  }
  const initial = createInitialState();
  saveState(initial);
  return initial;
}

function saveState(nextState) {
  state = nextState;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('localStorage saqlashda xatolik:', err);
  }
}

function getActiveUser() {
  return state.users.find((u) => u.id === state.activeUserId) || state.users[0];
}

function getClubById(clubId) {
  return state.clubs.find((c) => c.id === clubId);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getUserEventStatus(event, userId) {
  const reg = event.registrations.find((r) => r.studentId === userId && r.status === 'CONFIRMED');
  if (reg) return { status: 'CONFIRMED', entry: reg };

  const wait = event.waitlist.find((w) => w.studentId === userId);
  if (wait) {
    const position =
      event.waitlist.filter((w) => w.status === 'WAITLISTED').findIndex((w) => w.studentId === userId) + 1;
    return { status: wait.status, entry: wait, position };
  }
  return { status: 'NONE', entry: null };
}

function setScreen(screenName) {
  activeScreen = screenName;
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.screen === screenName);
  });
  document.querySelectorAll('.screen').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `screen-${screenName}`);
  });
  renderAll();
}

function showResult(result, { eventId = null, openModal = false } = {}) {
  lastResult = { ...result, eventId };
  renderResultBanner();
  renderDashboard();
  if (openModal) {
    renderResultModal();
  }
}

function closeResultModal() {
  document.getElementById('resultModalBackdrop').classList.add('hidden');
}

function statusToCssClass(status) {
  switch (status) {
    case 'CONFIRMED':
    case 'APPROVED':
    case 'UPDATED':
    case 'CANCELLED':
      return 'status-confirmed';
    case 'REJECTED':
      return 'status-rejected';
    case 'WAITLISTED':
    case 'PENDING':
      return 'status-waitlisted';
    case 'OFFERED':
      return 'status-offered';
    default:
      return 'status-confirmed';
  }
}

function statusToLabel(status) {
  switch (status) {
    case 'CONFIRMED':
      return 'QABUL QILINDI (CONFIRMED)';
    case 'REJECTED':
      return 'RAD ETILDI (REJECTED)';
    case 'WAITLISTED':
      return 'KUTISH RO‘YXATI (WAITLISTED)';
    case 'OFFERED':
      return 'JOY BO‘SHADI TAKLIFI (OFFERED)';
    case 'CANCELLED':
      return 'BEKOR QILINDI';
    case 'PENDING':
      return 'ARIZA YUBORILDI (PENDING)';
    case 'APPROVED':
      return 'TASDIQLANDI (APPROVED)';
    case 'UPDATED':
      return 'YANGILANDI';
    default:
      return status;
  }
}

/* ==================== RENDERING ==================== */

function renderRoleSwitcher() {
  const container = document.getElementById('roleSwitcher');
  const activeUser = getActiveUser();

  container.innerHTML = state.users
    .map((user) => {
      const hasOffer = state.events.some((ev) =>
        ev.waitlist.some((w) => w.studentId === user.id && w.status === 'OFFERED')
      );
      const pendingApps =
        user.role === 'leader'
          ? state.memberships.filter((m) => m.status === 'PENDING').length
          : 0;

      const indicator = hasOffer
        ? '<span class="nav-badge" title="Joy bo‘shadi taklifi bor!">!</span>'
        : pendingApps > 0
          ? `<span class="nav-badge" title="Kutilayotgan arizalar">${pendingApps}</span>`
          : '';

      return `
        <button
          type="button"
          class="role-btn ${user.id === activeUser.id ? 'active' : ''}"
          data-user-id="${escapeHtml(user.id)}"
        >
          ${user.id === activeUser.id ? '<span class="role-dot"></span>' : ''}
          ${escapeHtml(user.shortLabel)}
          ${indicator}
        </button>
      `;
    })
    .join('');

  // Nav badge yangilash
  const offerCount = state.events.filter((ev) =>
    ev.waitlist.some((w) => w.studentId === activeUser.id && w.status === 'OFFERED')
  ).length;
  const navOfferBadge = document.getElementById('navOfferBadge');
  navOfferBadge.textContent = String(offerCount);
  navOfferBadge.classList.toggle('hidden', offerCount === 0);

  const pendingCount = state.memberships.filter((m) => m.status === 'PENDING').length;
  const navPendingBadge = document.getElementById('navPendingBadge');
  navPendingBadge.textContent = String(pendingCount);
  navPendingBadge.classList.toggle('hidden', pendingCount === 0);
}

function renderActiveUserStrip() {
  const user = getActiveUser();
  const strip = document.getElementById('activeUserStrip');
  const roleLabel = user.role === 'leader' ? 'Klub rahbari' : 'Talaba';
  const offerEvents = state.events.filter((ev) =>
    ev.waitlist.some((w) => w.studentId === user.id && w.status === 'OFFERED')
  );

  strip.innerHTML = `
    <div>
      Faol hisob: <strong>${escapeHtml(user.name)}</strong>
      <span class="muted">(${escapeHtml(roleLabel)} • ${escapeHtml(user.group)})</span>
    </div>
    <div class="actions-row" style="margin-top:0">
      ${
        offerEvents.length > 0
          ? `<button type="button" class="btn btn-primary btn-sm" data-action="go-dashboard">
               🔔 Joy bo‘shadi (${offerEvents.length}) — Tasdiqlashga o‘tish
             </button>`
          : ''
      }
      <span class="badge ${user.role === 'leader' ? 'badge-warning' : 'badge-info'}">
        ${escapeHtml(user.shortLabel)}
      </span>
    </div>
  `;
}

function renderResultBanner() {
  const banner = document.getElementById('resultBanner');
  if (!lastResult) {
    banner.classList.add('hidden');
    return;
  }

  const css = statusToCssClass(lastResult.status);
  const badgeClass =
    css === 'status-confirmed'
      ? 'badge-success'
      : css === 'status-rejected'
        ? 'badge-danger'
        : css === 'status-offered'
          ? 'badge-info'
          : 'badge-warning';

  const nextActionHtml =
    lastResult.nextAction === 'JOIN_WAITLIST' && lastResult.eventId
      ? `<button type="button" class="btn btn-warning btn-sm" data-action="join-waitlist" data-event-id="${escapeHtml(lastResult.eventId)}">
           ${escapeHtml(lastResult.nextActionLabel || 'Kutish ro‘yxatiga qo‘shilish')}
         </button>`
      : lastResult.nextAction === 'ACCEPT_OFFER' && lastResult.eventId
        ? `<button type="button" class="btn btn-success btn-sm" data-action="accept-offer" data-event-id="${escapeHtml(lastResult.eventId)}">
             Joyni tasdiqlash
           </button>`
        : '';

  banner.className = `result-banner ${css}`;
  banner.innerHTML = `
    <div>
      <span class="badge ${badgeClass}">${escapeHtml(statusToLabel(lastResult.status))}</span>
      <div style="margin-top:6px; font-weight:600;">${escapeHtml(lastResult.reason)}</div>
    </div>
    <div class="actions-row" style="margin-top:0">
      ${nextActionHtml}
      <button type="button" class="btn btn-ghost btn-sm" data-action="dismiss-banner">Yopish</button>
    </div>
  `;
}

function renderResultModal() {
  const backdrop = document.getElementById('resultModalBackdrop');
  const card = document.getElementById('resultModalCard');
  if (!lastResult) {
    backdrop.classList.add('hidden');
    return;
  }

  const css = statusToCssClass(lastResult.status);
  const badgeClass =
    css === 'status-confirmed'
      ? 'badge-success'
      : css === 'status-rejected'
        ? 'badge-danger'
        : css === 'status-offered'
          ? 'badge-info'
          : 'badge-warning';

  const title =
    lastResult.status === 'CONFIRMED'
      ? 'Yozilish tasdiqlandi!'
      : lastResult.status === 'REJECTED'
        ? 'To‘g‘ridan-to‘g‘ri yozilish rad etildi'
        : lastResult.status === 'WAITLISTED'
          ? 'Kutish ro‘yxatiga qo‘shildingiz'
          : 'Bildirishnoma';

  const primaryNextBtn =
    lastResult.nextAction === 'JOIN_WAITLIST' && lastResult.eventId
      ? `<button type="button" class="btn btn-warning" data-action="join-waitlist" data-event-id="${escapeHtml(lastResult.eventId)}">
           Kutish ro‘yxatiga qo‘shilish
         </button>`
      : `<button type="button" class="btn btn-primary" data-action="go-dashboard">
           Talaba kabinetiga o‘tish
         </button>`;

  card.className = `modal-card ${css}`;
  card.innerHTML = `
    <span class="badge ${badgeClass}">${escapeHtml(statusToLabel(lastResult.status))}</span>
    <h3 id="modalTitle">${escapeHtml(title)}</h3>
    <p class="muted" style="color: var(--text-soft); margin-bottom: 16px;">${escapeHtml(lastResult.reason)}</p>
    <div class="actions-row">
      ${primaryNextBtn}
      <button type="button" class="btn btn-ghost" data-action="close-modal">Yopish</button>
    </div>
  `;
  backdrop.classList.remove('hidden');
}

function renderCapacityBar(summary) {
  const pct = Math.min(100, Math.round((summary.occupied / summary.capacity) * 100));
  const fillClass = summary.isFull ? 'full' : summary.remaining <= 2 ? 'almost' : 'open';
  const statusBadge = summary.isFull
    ? '<span class="badge badge-danger">To‘la (Kutish ro‘yxati)</span>'
    : summary.remaining === 1
      ? '<span class="badge badge-warning">Oxirgi 1 o‘rin!</span>'
      : `<span class="badge badge-success">${summary.remaining} ta bo‘sh o‘rin</span>`;

  return `
    <div class="capacity-block">
      <div class="capacity-label-row">
        <span>Sig‘im: <strong>${summary.occupied}/${summary.capacity}</strong> band</span>
        ${statusBadge}
      </div>
      <div class="progress-track">
        <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
      </div>
      ${
        summary.waiting > 0 || summary.offered > 0
          ? `<div class="list-item-sub">Kutish ro‘yxatida: ${summary.waiting} • Taklif kutilmoqda: ${summary.offered}</div>`
          : ''
      }
    </div>
  `;
}

function renderCatalog() {
  const user = getActiveUser();

  // KPIlar
  const totalMembers = state.memberships.filter((m) => m.status === 'APPROVED').length;
  const totalRegistrations = state.events.reduce(
    (sum, ev) => sum + ev.registrations.filter((r) => r.status === 'CONFIRMED').length,
    0
  );
  document.getElementById('catalogKpis').innerHTML = `
    <div class="kpi-box">
      <div class="kpi-value">${state.clubs.length}</div>
      <div class="kpi-label">Faol klublar</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-value">${state.events.length}</div>
      <div class="kpi-label">Yaqin tadbirlar</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-value">${totalRegistrations}</div>
      <div class="kpi-label">Faol bandlovlar</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-value">${totalMembers}</div>
      <div class="kpi-label">Tasdiqlangan a’zolar</div>
    </div>
  `;

  // Klublar
  document.getElementById('clubsGrid').innerHTML = state.clubs
    .map((club) => {
      const approvedCount = state.memberships.filter(
        (m) => m.clubId === club.id && m.status === 'APPROVED'
      ).length;
      const myMem = state.memberships.find(
        (m) => m.clubId === club.id && m.studentId === user.id && m.status !== 'REJECTED'
      );

      return `
        <article class="card">
          <div class="card-header">
            <h3>${escapeHtml(club.name)}</h3>
            <span class="badge badge-info">${escapeHtml(club.category)}</span>
          </div>
          <p class="muted" style="color: var(--text-soft);">${escapeHtml(club.description)}</p>
          <div class="meta-list">
            <div>👤 <strong>Rahbar:</strong> ${escapeHtml(club.leaderName)}</div>
            <div>🕒 <strong>Uchrashuv vaqti:</strong> ${escapeHtml(club.meetingTime)}</div>
            <div>👥 <strong>Tasdiqlangan a’zolar:</strong> ${approvedCount} nafar</div>
          </div>
          <div class="tags-row">
            ${club.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="actions-row">
            ${
              user.role === 'leader'
                ? `<button type="button" class="btn btn-ghost btn-sm" data-action="go-leader">Rahbar panelida boshqarish</button>`
                : myMem
                  ? `<span class="badge ${myMem.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}">
                       ${myMem.status === 'APPROVED' ? 'Siz klub a’zosisiz' : 'Arizangiz ko‘rib chiqilmoqda'}
                     </span>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-action="open-membership" data-club-id="${escapeHtml(club.id)}">
                       Klubga a’zo bo‘lish
                     </button>`
            }
          </div>
        </article>
      `;
    })
    .join('');

  // Tadbirlar
  document.getElementById('eventsCatalogGrid').innerHTML = state.events
    .map((event) => {
      const club = getClubById(event.clubId);
      const summary = getEventCapacitySummary(event);
      const userState = getUserEventStatus(event, user.id);

      let actionButton = '';
      if (user.role === 'leader') {
        actionButton = `<button type="button" class="btn btn-ghost btn-block" data-action="go-leader">Sig‘im va davomatni boshqarish</button>`;
      } else if (userState.status === 'CONFIRMED') {
        actionButton = `<button type="button" class="btn btn-success btn-block" data-action="go-dashboard">✓ Yozilgansiz — Kabinetda ko‘rish</button>`;
      } else if (userState.status === 'OFFERED') {
        actionButton = `<button type="button" class="btn btn-primary btn-block" data-action="accept-offer" data-event-id="${escapeHtml(event.id)}">🔔 Joy bo‘shadi — Joyni tasdiqlash</button>`;
      } else if (userState.status === 'WAITLISTED') {
        actionButton = `<span class="badge badge-warning">Kutish ro‘yxatidasiz (#${userState.position})</span>`;
      } else {
        actionButton = `
          <button type="button" class="btn ${summary.isFull ? 'btn-danger' : 'btn-primary'} btn-block" data-action="register-event" data-event-id="${escapeHtml(event.id)}">
            ${summary.isFull ? 'Yozilishga urinish (20/20 to‘la)' : 'Tadbirga yozilish'}
          </button>
        `;
      }

      return `
        <article class="card">
          <div class="card-header">
            <h3>${escapeHtml(event.title)}</h3>
            <span class="badge badge-neutral">${escapeHtml(club?.name || '')}</span>
          </div>
          <p class="muted" style="color: var(--text-soft); font-size:0.88rem;">${escapeHtml(event.description)}</p>
          <div class="meta-list">
            <div>📅 ${escapeHtml(event.date)} • ⏰ ${escapeHtml(event.time)}</div>
            <div>📍 ${escapeHtml(event.location)}</div>
          </div>
          ${renderCapacityBar(summary)}
          <div class="actions-row">
            ${actionButton}
          </div>
        </article>
      `;
    })
    .join('');
}

function renderRegisterScreen() {
  const user = getActiveUser();
  const eventSelect = document.getElementById('eventSelect');
  const clubSelect = document.getElementById('clubSelect');

  eventSelect.innerHTML = state.events
    .map((ev) => {
      const sum = getEventCapacitySummary(ev);
      return `<option value="${escapeHtml(ev.id)}" ${ev.id === selectedEventId ? 'selected' : ''}>
        ${escapeHtml(ev.title)} (${sum.occupied}/${sum.capacity})
      </option>`;
    })
    .join('');

  if (!state.events.some((e) => e.id === selectedEventId)) {
    selectedEventId = state.events[0]?.id || '';
  }

  const event = state.events.find((e) => e.id === selectedEventId);
  const preview = document.getElementById('selectedEventPreview');

  if (event) {
    const club = getClubById(event.clubId);
    const summary = getEventCapacitySummary(event);
    const userState = getUserEventStatus(event, user.id);

    let ctaHtml = '';
    if (user.role === 'leader') {
      ctaHtml = `<p class="muted">Tadbirga yozilish uchun yuqori paneldan Talaba 1 yoki Talaba 2 roliga o‘ting.</p>`;
    } else if (userState.status === 'CONFIRMED') {
      ctaHtml = `
        <div class="actions-row">
          <span class="badge badge-success">✓ Siz ushbu tadbirga yozilgansiz</span>
          <button type="button" class="btn btn-danger btn-sm" data-action="cancel-registration" data-event-id="${escapeHtml(event.id)}">
            Bandlovni bekor qilish
          </button>
        </div>
      `;
    } else if (userState.status === 'OFFERED') {
      ctaHtml = `
        <div class="actions-row">
          <button type="button" class="btn btn-success" data-action="accept-offer" data-event-id="${escapeHtml(event.id)}">
            Joy bo‘shadi — Joyni tasdiqlash
          </button>
          <button type="button" class="btn btn-ghost" data-action="decline-offer" data-event-id="${escapeHtml(event.id)}">
            Taklifni rad etish
          </button>
        </div>
      `;
    } else if (userState.status === 'WAITLISTED') {
      ctaHtml = `<span class="badge badge-warning">Kutish ro‘yxatidasiz (#${userState.position}-o‘rin)</span>`;
    } else {
      ctaHtml = `
        <div class="actions-row">
          <button type="button" class="btn btn-primary" data-action="register-event" data-event-id="${escapeHtml(event.id)}">
            Tadbirga yozilish
          </button>
          ${
            summary.isFull
              ? `<button type="button" class="btn btn-warning" data-action="join-waitlist" data-event-id="${escapeHtml(event.id)}">
                   Kutish ro‘yxatiga qo‘shilish
                 </button>`
              : ''
          }
        </div>
      `;
    }

    preview.innerHTML = `
      <div class="card-header" style="margin-bottom:8px;">
        <h3>${escapeHtml(event.title)}</h3>
        <span class="badge badge-neutral">${escapeHtml(club?.name || '')}</span>
      </div>
      <p class="muted" style="color:var(--text-soft); font-size:0.88rem;">${escapeHtml(event.description)}</p>
      <div class="meta-list">
        <div>📅 <strong>Sana:</strong> ${escapeHtml(event.date)} • ${escapeHtml(event.time)}</div>
        <div>📍 <strong>Manzil:</strong> ${escapeHtml(event.location)}</div>
      </div>
      ${renderCapacityBar(summary)}
      ${ctaHtml}
    `;
  }

  const currentClubVal = clubSelect.value || state.clubs[0]?.id || '';
  clubSelect.innerHTML = state.clubs
    .map(
      (c) => `<option value="${escapeHtml(c.id)}" ${c.id === currentClubVal ? 'selected' : ''}>
        ${escapeHtml(c.name)} — ${escapeHtml(c.category)}
      </option>`
    )
    .join('');

  const submitBtn = document.getElementById('submitMembershipBtn');
  submitBtn.disabled = user.role === 'leader';
  submitBtn.textContent =
    user.role === 'leader'
      ? 'Ariza yuborish uchun Talaba roliga o‘ting'
      : 'A’zolik arizasini yuborish';
}

function renderDashboard() {
  const user = getActiveUser();

  // Joy bo'shadi takliflari (OFFERED)
  const offeredEvents = state.events.filter((ev) =>
    ev.waitlist.some((w) => w.studentId === user.id && w.status === 'OFFERED')
  );
  const offersSection = document.getElementById('offersSection');
  if (offeredEvents.length > 0) {
    offersSection.innerHTML = offeredEvents
      .map(
        (ev) => `
          <div class="offer-highlight-card">
            <span class="badge badge-info">🔔 JOY BO‘SHADI — OFFERED</span>
            <h3 style="margin:10px 0 6px;">"${escapeHtml(ev.title)}" tadbirida siz uchun joy bo‘shadi!</h3>
            <p class="muted" style="color:var(--text-soft);">
              Oldingi ishtirokchi bandlovini bekor qildi. Asosiy ro‘yxatga o‘tish uchun joyni tasdiqlang.
            </p>
            <div class="actions-row">
              <button type="button" class="btn btn-success" data-action="accept-offer" data-event-id="${escapeHtml(ev.id)}">
                ✓ Joy bo‘shadi — Joyni tasdiqlash
              </button>
              <button type="button" class="btn btn-ghost" data-action="decline-offer" data-event-id="${escapeHtml(ev.id)}">
                Rad etish
              </button>
            </div>
          </div>
        `
      )
      .join('');
  } else {
    offersSection.innerHTML = '';
  }

  // Bandlangan tadbirlar
  const confirmedEvents = state.events.filter((ev) =>
    ev.registrations.some((r) => r.studentId === user.id && r.status === 'CONFIRMED')
  );
  document.getElementById('confirmedCountBadge').textContent = String(confirmedEvents.length);
  document.getElementById('myConfirmedEvents').innerHTML =
    confirmedEvents.length > 0
      ? confirmedEvents
          .map((ev) => {
            const reg = ev.registrations.find((r) => r.studentId === user.id);
            const sum = getEventCapacitySummary(ev);
            return `
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">${escapeHtml(ev.title)}</div>
                  <div class="list-item-sub">
                    📅 ${escapeHtml(ev.date)} • ${escapeHtml(ev.time)} • Sig‘im: ${sum.occupied}/${sum.capacity}
                    ${reg?.attended ? ' • <strong style="color:var(--success)">✓ Keldi</strong>' : ''}
                  </div>
                </div>
                <button type="button" class="btn btn-danger btn-sm" data-action="cancel-registration" data-event-id="${escapeHtml(ev.id)}">
                  Bandlovni bekor qilish
                </button>
              </div>
            `;
          })
          .join('')
      : '<div class="empty-state">Hozircha bandlangan tadbirlar yo‘q. Katalogdan tadbir tanlang.</div>';

  // Kutish ro'yxati
  const waitlistEvents = state.events
    .map((ev) => {
      const entry = ev.waitlist.find((w) => w.studentId === user.id);
      if (!entry) return null;
      const pos =
        ev.waitlist.filter((w) => w.status === 'WAITLISTED').findIndex((w) => w.studentId === user.id) + 1;
      return { ev, entry, pos };
    })
    .filter(Boolean);

  document.getElementById('waitlistCountBadge').textContent = String(waitlistEvents.length);
  document.getElementById('myWaitlistEvents').innerHTML =
    waitlistEvents.length > 0
      ? waitlistEvents
          .map(
            ({ ev, entry, pos }) => `
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">${escapeHtml(ev.title)}</div>
                  <div class="list-item-sub">
                    ${
                      entry.status === 'OFFERED'
                        ? 'Siz uchun joy ajratildi — tasdiqlashingiz kutilmoqda.'
                        : `Navbatdagi o‘rningiz: #${pos}`
                    }
                  </div>
                </div>
                ${
                  entry.status === 'OFFERED'
                    ? `<button type="button" class="btn btn-success btn-sm" data-action="accept-offer" data-event-id="${escapeHtml(ev.id)}">Joyni tasdiqlash</button>`
                    : '<span class="badge badge-warning">WAITLISTED</span>'
                }
              </div>
            `
          )
          .join('')
      : '<div class="empty-state">Kutish ro‘yxatida tadbirlar yo‘q.</div>';

  // Klub a'zoliklari
  const myMemberships = state.memberships.filter((m) => m.studentId === user.id);
  document.getElementById('myMembershipsList').innerHTML =
    myMemberships.length > 0
      ? myMemberships
          .map((m) => {
            const club = getClubById(m.clubId);
            const badgeClass =
              m.status === 'APPROVED'
                ? 'badge-success'
                : m.status === 'REJECTED'
                  ? 'badge-danger'
                  : 'badge-warning';
            const badgeText =
              m.status === 'APPROVED'
                ? 'Tasdiqlangan a’zo'
                : m.status === 'REJECTED'
                  ? 'Rad etilgan'
                  : 'Ko‘rib chiqilmoqda';
            return `
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">${escapeHtml(club?.name || m.clubId)}</div>
                  <div class="list-item-sub">${escapeHtml(m.motivation)}</div>
                </div>
                <span class="badge ${badgeClass}">${badgeText}</span>
              </div>
            `;
          })
          .join('')
      : '<div class="empty-state">Hali birorta klubga a’zo bo‘lmagansiz.</div>';

  // Ishtirok tarixi (avvalgi tadbirlar + hozirgi "Keldi" belgilangan tadbirlar)
  const pastItems = state.pastHistory
    .filter((h) => h.studentId === user.id)
    .map((h) => ({
      title: h.eventTitle,
      club: h.clubName,
      date: h.date
    }));

  const currentAttended = state.events
    .filter((ev) => ev.registrations.some((r) => r.studentId === user.id && r.attended))
    .map((ev) => ({
      title: ev.title,
      club: getClubById(ev.clubId)?.name || '',
      date: ev.date
    }));

  const historyItems = [...currentAttended, ...pastItems];
  document.getElementById('myHistoryList').innerHTML =
    historyItems.length > 0
      ? historyItems
          .map(
            (item) => `
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">${escapeHtml(item.title)}</div>
                  <div class="list-item-sub">${escapeHtml(item.club)} • 📅 ${escapeHtml(item.date)}</div>
                </div>
                <span class="badge badge-success">✓ Qatnashgan</span>
              </div>
            `
          )
          .join('')
      : '<div class="empty-state">Hozircha ishtirok tarixi bo‘sh.</div>';
}

function renderLeaderPanel() {
  const user = getActiveUser();
  const notice = document.getElementById('leaderAccessNotice');
  const body = document.getElementById('leaderPanelBody');

  if (user.role !== 'leader') {
    notice.className = 'card';
    notice.innerHTML = `
      <div class="card-header">
        <h3>Klub rahbari huquqi talab qilinadi</h3>
        <span class="badge badge-warning">Hozirgi rol: ${escapeHtml(user.shortLabel)}</span>
      </div>
      <p class="muted" style="color:var(--text-soft);">
        A’zolik arizalarini tasdiqlash, tadbir sig‘imini o‘zgartirish va davomatni belgilash uchun Klub rahbari hisobiga o‘ting.
      </p>
      <div class="actions-row">
        <button type="button" class="btn btn-primary" data-action="switch-to-leader">
          Klub rahbari roliga o‘tish
        </button>
      </div>
    `;
    body.classList.add('hidden');
    return;
  }

  notice.classList.add('hidden');
  body.classList.remove('hidden');

  // 1. A'zolik arizalari
  const pendingCount = state.memberships.filter((m) => m.status === 'PENDING').length;
  document.getElementById('leaderPendingCount').textContent = `${pendingCount} kutilmoqda`;

  document.getElementById('leaderApplicationsList').innerHTML =
    state.memberships.length > 0
      ? state.memberships
          .map((m) => {
            const club = getClubById(m.clubId);
            const badgeClass =
              m.status === 'APPROVED'
                ? 'badge-success'
                : m.status === 'REJECTED'
                  ? 'badge-danger'
                  : 'badge-warning';

            return `
              <div class="list-item">
                <div class="list-item-main">
                  <div class="list-item-title">
                    ${escapeHtml(m.studentName)} <span class="muted">(${escapeHtml(m.group)})</span>
                    → ${escapeHtml(club?.name || '')}
                  </div>
                  <div class="list-item-sub">${escapeHtml(m.motivation)}</div>
                </div>
                <div class="actions-row" style="margin-top:0">
                  <span class="badge ${badgeClass}">${escapeHtml(m.status)}</span>
                  ${
                    m.status === 'PENDING'
                      ? `
                        <button type="button" class="btn btn-success btn-sm" data-action="approve-membership" data-membership-id="${escapeHtml(m.id)}">
                          Tasdiqlash
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" data-action="reject-membership" data-membership-id="${escapeHtml(m.id)}">
                          Rad etish
                        </button>
                      `
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('')
      : '<div class="empty-state">A’zolik arizalari mavjud emas.</div>';

  // 2. Tadbir sig'imini boshqarish
  document.getElementById('leaderCapacityList').innerHTML = state.events
    .map((ev) => {
      const sum = getEventCapacitySummary(ev);
      return `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${escapeHtml(ev.title)}</div>
            <div class="list-item-sub">
              Band: <strong>${sum.occupied}/${sum.capacity}</strong> • Kutish ro‘yxati: ${sum.waiting} • Taklif: ${sum.offered}
            </div>
          </div>
          <div class="capacity-control">
            <input
              type="number"
              min="${sum.occupied}"
              max="200"
              value="${ev.capacity}"
              class="input capacity-input"
              id="cap-input-${escapeHtml(ev.id)}"
              aria-label="${escapeHtml(ev.title)} sig‘imi"
            />
            <button type="button" class="btn btn-primary btn-sm" data-action="save-capacity" data-event-id="${escapeHtml(ev.id)}">
              Saqlash
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // 3. Davomat
  const attSelect = document.getElementById('attendanceEventSelect');
  if (!state.events.some((e) => e.id === selectedAttendanceEventId)) {
    selectedAttendanceEventId = state.events[0]?.id || '';
  }
  attSelect.innerHTML = state.events
    .map(
      (ev) => `<option value="${escapeHtml(ev.id)}" ${ev.id === selectedAttendanceEventId ? 'selected' : ''}>
        ${escapeHtml(ev.title)} (${ev.registrations.length} ishtirokchi)
      </option>`
    )
    .join('');

  const attEvent = state.events.find((e) => e.id === selectedAttendanceEventId);
  if (attEvent) {
    const confirmed = attEvent.registrations.filter((r) => r.status === 'CONFIRMED');
    const attendedCount = confirmed.filter((r) => r.attended).length;
    document.getElementById('attendanceSummaryBadge').textContent = `${attendedCount} / ${confirmed.length} keldi`;

    document.getElementById('leaderAttendanceList').innerHTML =
      confirmed.length > 0
        ? confirmed
            .map(
              (p) => `
                <div class="list-item">
                  <div class="list-item-main">
                    <div class="list-item-title">${escapeHtml(p.studentName)}</div>
                    <div class="list-item-sub">Guruh: ${escapeHtml(p.group)}</div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm ${p.attended ? 'btn-success' : 'btn-ghost'}"
                    data-action="toggle-attendance"
                    data-event-id="${escapeHtml(attEvent.id)}"
                    data-student-id="${escapeHtml(p.studentId)}"
                    data-attended="${p.attended ? 'false' : 'true'}"
                  >
                    ${p.attended ? '✓ Keldi' : 'Keldi deb belgilash'}
                  </button>
                </div>
              `
            )
            .join('')
        : '<div class="empty-state">Ushbu tadbirda tasdiqlangan ishtirokchilar yo‘q.</div>';
  }
}

function renderAll() {
  renderRoleSwitcher();
  renderActiveUserStrip();
  renderResultBanner();
  renderCatalog();
  renderRegisterScreen();
  renderDashboard();
  renderLeaderPanel();
}

/* ==================== EVENT HANDLERS ==================== */

function handleGlobalClick(e) {
  const roleBtn = e.target.closest('.role-btn');
  if (roleBtn) {
    const userId = roleBtn.dataset.userId;
    saveState({ ...state, activeUserId: userId });
    lastResult = null;
    closeResultModal();
    renderAll();
    return;
  }

  const navTab = e.target.closest('.nav-tab');
  if (navTab) {
    setScreen(navTab.dataset.screen);
    return;
  }

  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) {
    if (e.target.id === 'resultModalBackdrop') {
      closeResultModal();
    }
    return;
  }

  const { action, eventId, clubId, membershipId, studentId, attended } = actionEl.dataset;
  const user = getActiveUser();

  switch (action) {
    case 'register-event': {
      const res = registerForEvent(state, eventId, user);
      saveState(res.state);
      renderAll();
      showResult(res, { eventId, openModal: true });
      break;
    }

    case 'join-waitlist': {
      const res = joinWaitlist(state, eventId, user);
      saveState(res.state);
      closeResultModal();
      renderAll();
      showResult(res, { eventId, openModal: false });
      break;
    }

    case 'cancel-registration': {
      const res = cancelRegistration(state, eventId, user.id);
      saveState(res.state);
      renderAll();
      showResult(res, { eventId, openModal: false });
      break;
    }

    case 'accept-offer': {
      const res = acceptWaitlistOffer(state, eventId, user.id);
      saveState(res.state);
      closeResultModal();
      renderAll();
      showResult(res, { eventId, openModal: true });
      break;
    }

    case 'decline-offer': {
      const res = declineWaitlistOffer(state, eventId, user.id);
      saveState(res.state);
      renderAll();
      showResult(res, { eventId, openModal: false });
      break;
    }

    case 'open-membership': {
      setScreen('register');
      const clubSelect = document.getElementById('clubSelect');
      if (clubSelect && clubId) {
        clubSelect.value = clubId;
      }
      document.getElementById('motivationInput')?.focus();
      break;
    }

    case 'approve-membership': {
      const res = reviewMembershipApplication(state, membershipId, 'APPROVED');
      saveState(res.state);
      renderAll();
      showResult(res);
      break;
    }

    case 'reject-membership': {
      const res = reviewMembershipApplication(state, membershipId, 'REJECTED');
      saveState(res.state);
      renderAll();
      showResult(res);
      break;
    }

    case 'save-capacity': {
      const input = document.getElementById(`cap-input-${eventId}`);
      const res = updateEventCapacity(state, eventId, Number(input?.value));
      saveState(res.state);
      renderAll();
      showResult(res, { eventId });
      break;
    }

    case 'toggle-attendance': {
      const res = markAttendance(state, eventId, studentId, attended === 'true');
      saveState(res.state);
      renderAll();
      showResult(res, { eventId });
      break;
    }

    case 'switch-to-leader': {
      saveState({ ...state, activeUserId: 'leader-1' });
      renderAll();
      break;
    }

    case 'go-dashboard': {
      closeResultModal();
      setScreen('dashboard');
      break;
    }

    case 'go-leader': {
      closeResultModal();
      setScreen('leader');
      break;
    }

    case 'dismiss-banner': {
      lastResult = null;
      renderResultBanner();
      break;
    }

    case 'close-modal': {
      closeResultModal();
      break;
    }

    default:
      break;
  }
}

function init() {
  document.addEventListener('click', handleGlobalClick);

  document.getElementById('eventSelect').addEventListener('change', (e) => {
    selectedEventId = e.target.value;
    renderRegisterScreen();
  });

  document.getElementById('attendanceEventSelect').addEventListener('change', (e) => {
    selectedAttendanceEventId = e.target.value;
    renderLeaderPanel();
  });

  document.getElementById('membershipForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = getActiveUser();
    const clubId = document.getElementById('clubSelect').value;
    const motivationEl = document.getElementById('motivationInput');
    const res = applyForClubMembership(state, clubId, user, motivationEl.value);
    saveState(res.state);
    if (res.ok) {
      motivationEl.value = '';
    }
    renderAll();
    showResult(res, { openModal: true });
  });

  document.getElementById('resetDemoBtn').addEventListener('click', () => {
    const fresh = createInitialState();
    saveState(fresh);
    selectedEventId = fresh.events[0]?.id || '';
    selectedAttendanceEventId = fresh.events[1]?.id || fresh.events[0]?.id || '';
    lastResult = {
      ok: true,
      status: 'UPDATED',
      reason: 'Demo ma’lumotlar boshlang‘ich holatga muvaffaqiyatli tiklandi.'
    };
    closeResultModal();
    renderAll();
  });

  renderAll();
}

init();
