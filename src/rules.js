/**
 * CampusClubs Portal (P08 — DIK1305)
 * Sof biznes qoidalari moduli (DOMga bog'liq emas, Browser va Node.js da ishlaydi)
 */

function cloneState(state) {
  return structuredClone(state);
}

/**
 * Tadbir uchun faol band qilingan o'rinlar sonini hisoblaydi
 * (CONFIRMED ishtirokchilar + kutish ro'yxatidan OFFERED taklifi berilganlar).
 */
export function getOccupiedSeats(event) {
  const confirmedCount = event.registrations.filter((r) => r.status === 'CONFIRMED').length;
  const offeredCount = event.waitlist.filter((w) => w.status === 'OFFERED').length;
  return confirmedCount + offeredCount;
}

/**
 * Tadbir sig'imi haqida qisqacha ma'lumot qaytaradi.
 */
export function getEventCapacitySummary(event) {
  const confirmed = event.registrations.filter((r) => r.status === 'CONFIRMED').length;
  const offered = event.waitlist.filter((w) => w.status === 'OFFERED').length;
  const waiting = event.waitlist.filter((w) => w.status === 'WAITLISTED').length;
  const occupied = confirmed + offered;
  const remaining = Math.max(0, event.capacity - occupied);

  return {
    capacity: event.capacity,
    confirmed,
    offered,
    waiting,
    occupied,
    remaining,
    isFull: occupied >= event.capacity
  };
}

/**
 * Talabaning tadbirga to'g'ridan-to'g'ri yozilishi.
 * - Joy bo'sh bo'lsa -> status: "CONFIRMED"
 * - Joy to'la bo'lsa -> status: "REJECTED", sabab va "JOIN_WAITLIST" keyingi amali qaytadi.
 */
export function registerForEvent(state, eventId, student) {
  const nextState = cloneState(state);
  const event = nextState.events.find((e) => e.id === eventId);

  if (!event) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Tadbir topilmadi.',
      nextAction: null,
      state: nextState
    };
  }

  const alreadyConfirmed = event.registrations.some(
    (r) => r.studentId === student.id && r.status === 'CONFIRMED'
  );
  if (alreadyConfirmed) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Siz ushbu tadbirga allaqachon yozilgansiz.',
      nextAction: null,
      state: nextState
    };
  }

  const existingWait = event.waitlist.find((w) => w.studentId === student.id);
  if (existingWait) {
    if (existingWait.status === 'OFFERED') {
      return {
        ok: false,
        status: 'OFFERED',
        reason: 'Siz uchun joy bo‘shagan! Iltimos, kabinetingizdan joyni tasdiqlang.',
        nextAction: 'ACCEPT_OFFER',
        state: nextState
      };
    }
    return {
      ok: false,
      status: 'WAITLISTED',
      reason: 'Siz allaqachon ushbu tadbirning kutish ro‘yxatidasiz.',
      nextAction: null,
      state: nextState
    };
  }

  const occupied = getOccupiedSeats(event);
  if (occupied >= event.capacity) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: `${event.capacity} ta joyning barchasi band`,
      nextAction: 'JOIN_WAITLIST',
      nextActionLabel: 'Kutish ro‘yxatiga qo‘shilish',
      occupiedSeats: occupied,
      capacity: event.capacity,
      state: nextState
    };
  }

  event.registrations.push({
    studentId: student.id,
    studentName: student.name,
    group: student.group || 'DIK',
    status: 'CONFIRMED',
    attended: false,
    registeredAt: new Date().toISOString()
  });

  const newOccupied = getOccupiedSeats(event);
  return {
    ok: true,
    status: 'CONFIRMED',
    reason: `Tabriklaymiz! "${event.title}" tadbiriga muvaffaqiyatli yozildingiz (${newOccupied}/${event.capacity}).`,
    nextAction: null,
    occupiedSeats: newOccupied,
    capacity: event.capacity,
    state: nextState
  };
}

/**
 * To'lgan tadbirning kutish ro'yxatiga qo'shilish.
 */
export function joinWaitlist(state, eventId, student) {
  const nextState = cloneState(state);
  const event = nextState.events.find((e) => e.id === eventId);

  if (!event) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Tadbir topilmadi.',
      state: nextState
    };
  }

  const alreadyConfirmed = event.registrations.some(
    (r) => r.studentId === student.id && r.status === 'CONFIRMED'
  );
  if (alreadyConfirmed) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Siz allaqachon asosiy ro‘yxatdasiz.',
      state: nextState
    };
  }

  const existing = event.waitlist.find((w) => w.studentId === student.id);
  if (existing) {
    return {
      ok: false,
      status: existing.status,
      reason: 'Siz allaqachon kutish ro‘yxatiga qo‘shilgansiz.',
      state: nextState
    };
  }

  const position = event.waitlist.length + 1;
  event.waitlist.push({
    studentId: student.id,
    studentName: student.name,
    group: student.group || 'DIK',
    status: 'WAITLISTED',
    joinedAt: new Date().toISOString(),
    offeredAt: null
  });

  return {
    ok: true,
    status: 'WAITLISTED',
    position,
    reason: `Siz "${event.title}" kutish ro‘yxatiga #${position}-o‘rinda qo‘shildingiz. Joy bo‘shashi bilan sizga taklif yuboriladi.`,
    state: nextState
  };
}

/**
 * Ichki yordamchi funksiya: bo'sh o'rinlar boricha kutish ro'yxatidagi navbatdagi talabalarga OFFERED beradi.
 */
function promoteWaitlistIfAvailable(event) {
  const promoted = [];
  while (getOccupiedSeats(event) < event.capacity) {
    const nextInLine = event.waitlist.find((w) => w.status === 'WAITLISTED');
    if (!nextInLine) break;
    nextInLine.status = 'OFFERED';
    nextInLine.offeredAt = new Date().toISOString();
    promoted.push(nextInLine);
  }
  return promoted;
}

/**
 * Ishtirokchi bandlovini bekor qiladi.
 * Agar kutish ro'yxatida talaba bo'lsa, avtomatik tarzda navbatdagisiga OFFERED holatini beradi.
 */
export function cancelRegistration(state, eventId, studentId) {
  const nextState = cloneState(state);
  const event = nextState.events.find((e) => e.id === eventId);

  if (!event) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Tadbir topilmadi.',
      offeredStudent: null,
      state: nextState
    };
  }

  const idx = event.registrations.findIndex(
    (r) => r.studentId === studentId && r.status === 'CONFIRMED'
  );
  if (idx === -1) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Ushbu tadbir bo‘yicha faol bandlovingiz topilmadi.',
      offeredStudent: null,
      state: nextState
    };
  }

  event.registrations.splice(idx, 1);

  const promoted = promoteWaitlistIfAvailable(event);
  const offeredStudent = promoted[0] || null;

  return {
    ok: true,
    status: 'CANCELLED',
    reason: offeredStudent
      ? `Bandlovingiz bekor qilindi. Bo‘shagan joy avtomatik ravishda kutish ro‘yxatidagi ${offeredStudent.studentName} ga taklif qilindi.`
      : `"${event.title}" tadbiridagi bandlovingiz muvaffaqiyatli bekor qilindi.`,
    offeredStudent,
    occupiedSeats: getOccupiedSeats(event),
    state: nextState
  };
}

/**
 * Kutish ro'yxatidan "OFFERED" taklifi olgan talaba joyni tasdiqlaydi va asosiy ro'yxatga o'tadi.
 */
export function acceptWaitlistOffer(state, eventId, studentId) {
  const nextState = cloneState(state);
  const event = nextState.events.find((e) => e.id === eventId);

  if (!event) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Tadbir topilmadi.',
      state: nextState
    };
  }

  const waitIdx = event.waitlist.findIndex(
    (w) => w.studentId === studentId && w.status === 'OFFERED'
  );
  if (waitIdx === -1) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Sizda ushbu tadbir uchun faol joy taklifi topilmadi.',
      state: nextState
    };
  }

  const [entry] = event.waitlist.splice(waitIdx, 1);
  event.registrations.push({
    studentId: entry.studentId,
    studentName: entry.studentName,
    group: entry.group,
    status: 'CONFIRMED',
    attended: false,
    registeredAt: new Date().toISOString()
  });

  return {
    ok: true,
    status: 'CONFIRMED',
    reason: `Joy tasdiqlandi! Siz "${event.title}" tadbirining asosiy ishtirokchilari ro‘yxatiga o‘tdingiz.`,
    occupiedSeats: getOccupiedSeats(event),
    state: nextState
  };
}

/**
 * Talaba "OFFERED" taklifini rad etsa, uni kutish ro'yxatidan chiqaradi va navbatdagiga o'tkazadi.
 */
export function declineWaitlistOffer(state, eventId, studentId) {
  const nextState = cloneState(state);
  const event = nextState.events.find((e) => e.id === eventId);

  if (!event) {
    return { ok: false, status: 'REJECTED', reason: 'Tadbir topilmadi.', state: nextState };
  }

  const waitIdx = event.waitlist.findIndex(
    (w) => w.studentId === studentId && w.status === 'OFFERED'
  );
  if (waitIdx === -1) {
    return { ok: false, status: 'REJECTED', reason: 'Faol taklif topilmadi.', state: nextState };
  }

  event.waitlist.splice(waitIdx, 1);
  const promoted = promoteWaitlistIfAvailable(event);

  return {
    ok: true,
    status: 'DECLINED',
    reason: 'Taklif rad etildi va navbat keyingi talabaga o‘tkazildi.',
    offeredStudent: promoted[0] || null,
    state: nextState
  };
}

/**
 * Klubga a'zolik arizasini yuborish.
 */
export function applyForClubMembership(state, clubId, student, motivation = '') {
  const nextState = cloneState(state);
  const club = nextState.clubs.find((c) => c.id === clubId);

  if (!club) {
    return { ok: false, status: 'REJECTED', reason: 'Klub topilmadi.', state: nextState };
  }

  const existing = nextState.memberships.find(
    (m) => m.clubId === clubId && m.studentId === student.id && m.status !== 'REJECTED'
  );
  if (existing) {
    const msg =
      existing.status === 'APPROVED'
        ? `Siz allaqachon "${club.name}" a’zosisiz.`
        : `Sizning "${club.name}" klubiga yuborgan arizangiz ko‘rib chiqilmoqda.`;
    return { ok: false, status: existing.status, reason: msg, state: nextState };
  }

  const application = {
    id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    clubId,
    studentId: student.id,
    studentName: student.name,
    group: student.group || 'DIK',
    motivation: motivation.trim() || 'Klub faoliyatida faol ishtirok etishni xohlayman.',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  nextState.memberships.unshift(application);

  return {
    ok: true,
    status: 'PENDING',
    reason: `"${club.name}" klubiga a’zolik arizangiz yuborildi. Klub rahbari tasdiqlashini kuting.`,
    application,
    state: nextState
  };
}

/**
 * Klub rahbari a'zolik arizasini tasdiqlaydi yoki rad etadi.
 */
export function reviewMembershipApplication(state, membershipId, decision) {
  const nextState = cloneState(state);
  const membership = nextState.memberships.find((m) => m.id === membershipId);

  if (!membership) {
    return { ok: false, status: 'REJECTED', reason: 'Ariza topilmadi.', state: nextState };
  }

  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    return { ok: false, status: 'REJECTED', reason: 'Noto‘g‘ri qaror qiymati.', state: nextState };
  }

  membership.status = decision;
  membership.reviewedAt = new Date().toISOString();

  return {
    ok: true,
    status: decision,
    reason:
      decision === 'APPROVED'
        ? `${membership.studentName} ning a’zolik arizasi tasdiqlandi.`
        : `${membership.studentName} ning a’zolik arizasi rad etildi.`,
    state: nextState
  };
}

/**
 * Klub rahbari tadbir sig'imini o'zgartiradi.
 * Sig'im amaldagi band o'rinlardan kam bo'la olmaydi; sig'im oshsa kutish ro'yxati avtomatik taklif oladi.
 */
export function updateEventCapacity(state, eventId, newCapacity) {
  const nextState = cloneState(state);
  const event = nextState.events.find((e) => e.id === eventId);

  if (!event) {
    return { ok: false, status: 'REJECTED', reason: 'Tadbir topilmadi.', state: nextState };
  }

  const parsed = Number(newCapacity);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: 'Sig‘im musbat butun son bo‘lishi kerak.',
      state: nextState
    };
  }

  const occupied = getOccupiedSeats(event);
  if (parsed < occupied) {
    return {
      ok: false,
      status: 'REJECTED',
      reason: `Sig‘imni ${occupied} dan kamaytirib bo‘lmaydi (hozir ${occupied} ta joy band).`,
      state: nextState
    };
  }

  event.capacity = parsed;
  const promoted = promoteWaitlistIfAvailable(event);

  return {
    ok: true,
    status: 'UPDATED',
    promotedCount: promoted.length,
    reason:
      promoted.length > 0
        ? `"${event.title}" sig‘imi ${parsed} o‘ringa o‘zgartirildi va ${promoted.length} nafar kutayotgan talabaga joy taklif qilindi.`
        : `"${event.title}" sig‘imi ${parsed} o‘ringa o‘zgartirildi.`,
    state: nextState
  };
}

/**
 * Klub rahbari tadbir ishtirokchisining davomatini ("Keldi") belgilaydi.
 */
export function markAttendance(state, eventId, studentId, attended) {
  const nextState = cloneState(state);
  const event = nextState.events.find((e) => e.id === eventId);

  if (!event) {
    return { ok: false, status: 'REJECTED', reason: 'Tadbir topilmadi.', state: nextState };
  }

  const participant = event.registrations.find(
    (r) => r.studentId === studentId && r.status === 'CONFIRMED'
  );
  if (!participant) {
    return { ok: false, status: 'REJECTED', reason: 'Ishtirokchi topilmadi.', state: nextState };
  }

  participant.attended = Boolean(attended);

  return {
    ok: true,
    status: 'UPDATED',
    reason: `${participant.studentName}: ${participant.attended ? 'Keldi deb belgilandi' : 'Davomat belgisi olib tashlandi'}.`,
    state: nextState
  };
}
