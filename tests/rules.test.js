import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/data.js';
import {
  registerForEvent,
  joinWaitlist,
  cancelRegistration,
  acceptWaitlistOffer,
  applyForClubMembership,
  reviewMembershipApplication,
  updateEventCapacity,
  markAttendance,
  getOccupiedSeats
} from '../src/rules.js';

test('Test 1 (Qabul holati): 19/20 tadbirga yozilganda CONFIRMED qaytadi va band o‘rinlar 20 bo‘ladi', () => {
  const state = createInitialState();
  const ogabek = state.users.find((u) => u.id === 'student-1');

  // event-ailab boshlang'ich holatda 19/20 band
  const beforeEvent = state.events.find((e) => e.id === 'event-ailab');
  assert.equal(getOccupiedSeats(beforeEvent), 19);

  const result = registerForEvent(state, 'event-ailab', ogabek);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'CONFIRMED');
  assert.equal(result.occupiedSeats, 20);

  const afterEvent = result.state.events.find((e) => e.id === 'event-ailab');
  assert.equal(getOccupiedSeats(afterEvent), 20);
  assert.equal(
    afterEvent.registrations.some((r) => r.studentId === ogabek.id && r.status === 'CONFIRMED'),
    true
  );
});

test('Test 2 (Rad etish, kutish ro‘yxati va OFFERED taklifi): 20/20 to‘lgan tadbir ssenariysi', () => {
  const initialState = createInitialState();
  const ogabek = initialState.users.find((u) => u.id === 'student-1');
  const aziz = initialState.users.find((u) => u.id === 'student-2');

  // 1-qadam: 20/20 to'la "CyberSec CTF Bootcamp" tadbiriga to'g'ridan-to'g'ri yozilish rad etiladi
  const regResult = registerForEvent(initialState, 'event-ctf', ogabek);
  assert.equal(regResult.ok, false);
  assert.equal(regResult.status, 'REJECTED');
  assert.match(regResult.reason, /20 ta joyning barchasi band/);
  assert.equal(regResult.nextAction, 'JOIN_WAITLIST');

  // 2-qadam: Talaba 1 kutish ro'yxatiga qo'shiladi
  const waitResult = joinWaitlist(regResult.state, 'event-ctf', ogabek);
  assert.equal(waitResult.ok, true);
  assert.equal(waitResult.status, 'WAITLISTED');
  assert.equal(waitResult.position, 1);

  // 3-qadam: Talaba 2 (Aziz) bandlovini bekor qiladi -> Talaba 1 ga avtomatik OFFERED beriladi
  const cancelResult = cancelRegistration(waitResult.state, 'event-ctf', aziz.id);
  assert.equal(cancelResult.ok, true);
  assert.equal(cancelResult.status, 'CANCELLED');
  assert.ok(cancelResult.offeredStudent);
  assert.equal(cancelResult.offeredStudent.studentId, ogabek.id);
  assert.equal(cancelResult.offeredStudent.status, 'OFFERED');

  const ctfAfterCancel = cancelResult.state.events.find((e) => e.id === 'event-ctf');
  const ogabekWaitEntry = ctfAfterCancel.waitlist.find((w) => w.studentId === ogabek.id);
  assert.equal(ogabekWaitEntry.status, 'OFFERED');

  // 4-qadam: Talaba 1 taklifni tasdiqlaydi -> asosiy ro'yxatga (CONFIRMED) o'tadi
  const acceptResult = acceptWaitlistOffer(cancelResult.state, 'event-ctf', ogabek.id);
  assert.equal(acceptResult.ok, true);
  assert.equal(acceptResult.status, 'CONFIRMED');
  assert.equal(acceptResult.occupiedSeats, 20);

  const ctfFinal = acceptResult.state.events.find((e) => e.id === 'event-ctf');
  assert.equal(
    ctfFinal.registrations.some((r) => r.studentId === ogabek.id && r.status === 'CONFIRMED'),
    true
  );
  assert.equal(ctfFinal.waitlist.length, 0);
});

test('Test 3 (Klub a’zoligi va rahbar boshqaruvi): ariza, tasdiqlash, sig‘im va davomat', () => {
  const initialState = createInitialState();
  const ogabek = initialState.users.find((u) => u.id === 'student-1');

  // Klubga ariza topshirish
  const applyRes = applyForClubMembership(
    initialState,
    'club-cybersec',
    ogabek,
    'CTF jamoasiga qo‘shilmoqchiman.'
  );
  assert.equal(applyRes.ok, true);
  assert.equal(applyRes.status, 'PENDING');

  // Klub rahbari tasdiqlashi
  const reviewRes = reviewMembershipApplication(
    applyRes.state,
    applyRes.application.id,
    'APPROVED'
  );
  assert.equal(reviewRes.ok, true);
  assert.equal(reviewRes.status, 'APPROVED');

  // Sig'imni band o'rinlardan pastga tushirish rad etiladi
  const badCap = updateEventCapacity(reviewRes.state, 'event-ctf', 15);
  assert.equal(badCap.ok, false);

  // Sig'imni oshirish muvaffaqiyatli ishlaydi
  const goodCap = updateEventCapacity(reviewRes.state, 'event-ctf', 25);
  assert.equal(goodCap.ok, true);
  assert.equal(goodCap.state.events.find((e) => e.id === 'event-ctf').capacity, 25);

  // Davomatni ("Keldi") belgilash
  const attendRes = markAttendance(goodCap.state, 'event-ctf', 'student-2', true);
  assert.equal(attendRes.ok, true);
  const azizReg = attendRes.state.events
    .find((e) => e.id === 'event-ctf')
    .registrations.find((r) => r.studentId === 'student-2');
  assert.equal(azizReg.attended, true);
});
