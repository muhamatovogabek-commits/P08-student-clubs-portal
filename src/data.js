/**
 * CampusClubs Portal (P08 — DIK1305)
 * Boshlang'ich namuna ma'lumotlar (Demo Dataset)
 */

export const STORAGE_KEY = 'campusclubs_portal_p08_v1';

export const DEMO_USERS = [
  {
    id: 'student-1',
    name: "Og'abek Muhamatov",
    shortLabel: "Talaba 1 (Og'abek)",
    role: 'student',
    group: 'DIK-105',
    email: 'ogabek.m@cyberuni.uz'
  },
  {
    id: 'student-2',
    name: 'Aziz Karimov',
    shortLabel: 'Talaba 2 (Aziz)',
    role: 'student',
    group: 'DIK-103',
    email: 'aziz.k@cyberuni.uz'
  },
  {
    id: 'leader-1',
    name: 'Sardorbek Alimov',
    shortLabel: 'Klub rahbari',
    role: 'leader',
    group: 'CyberSec & AI Koordinatori',
    email: 'sardor.alimov@cyberuni.uz'
  }
];

function createParticipantBatch(prefix, count, startIndex = 1) {
  const sampleNames = [
    'Dilshod Tursunov',
    'Madina Rahimova',
    'Javohir Ergashev',
    'Sevara Qodirova',
    'Bekzod Nurmatov',
    'Zarina Abdullayeva',
    'Shohruh Mamatov',
    'Nilufar Sobirova',
    'Temur Toshmatov',
    'Malika Hasanova',
    'Umidjon Raxmatov',
    'Gulnoza Karimova',
    'Bobur Ismoilov',
    'Mohira Yusupova',
    'Farruh Xolmatov',
    'Diyora Oripova',
    'Sanjar Rustamov',
    'Kamola Nazarova',
    'Akmal Saidov',
    'Shahzoda Mirzayeva'
  ];

  const list = [];
  for (let i = 0; i < count; i += 1) {
    const idx = startIndex + i;
    const name = sampleNames[i % sampleNames.length];
    list.push({
      studentId: `${prefix}-${idx}`,
      studentName: name,
      group: `DIK-10${(i % 5) + 1}`,
      status: 'CONFIRMED',
      attended: false,
      registeredAt: '2026-11-20T10:00:00+05:00'
    });
  }
  return list;
}

export function createInitialState() {
  // Tadbir A: Frontend Practicum (14/20 band)
  const frontendParticipants = createParticipantBatch('demo-fe', 14);

  // Tadbir B: CyberSec CTF Bootcamp (20/20 to'la — ichida Talaba 2 (Aziz) ham bor)
  const ctfOthers = createParticipantBatch('demo-ctf', 19);
  const ctfParticipants = [
    {
      studentId: 'student-2',
      studentName: 'Aziz Karimov',
      group: 'DIK-103',
      status: 'CONFIRMED',
      attended: false,
      registeredAt: '2026-11-19T14:30:00+05:00'
    },
    ...ctfOthers
  ];

  // Tadbir C: AI Prompt Engineering Lab (19/20 band — 1-urinish QABUL, 2-urinish RAD ETISH)
  const aiLabParticipants = createParticipantBatch('demo-ai', 19);

  return {
    activeUserId: 'student-1',
    users: structuredClone(DEMO_USERS),
    clubs: [
      {
        id: 'club-cybersec',
        name: 'CyberSec Club',
        category: 'Kiberxavfsizlik',
        leaderId: 'leader-1',
        leaderName: 'Sardorbek Alimov',
        meetingTime: 'Seshanba va Payshanba, 16:30 — B-204 laboratoriya',
        description:
          'CTF musobaqalari, tarmoq xavfsizligi, penetrasion test asoslari va amaliy kiber-mashg‘ulotlar klubi.',
        tags: ['CTF', 'Network Security', 'Linux']
      },
      {
        id: 'club-aidev',
        name: 'AI & Dev Club',
        category: 'Dasturlash va Sun’iy Intellekt',
        leaderId: 'leader-1',
        leaderName: 'Sardorbek Alimov',
        meetingTime: 'Chorshanba va Juma, 17:00 — C-301 innovatsiya xonasi',
        description:
          'Zamonaviy veb-ilovalar, sun’iy intellekt loyihalari, hakatonlarga tayyorgarlik va kod ko‘rib chiqish sessiyalari.',
        tags: ['Frontend', 'AI / ML', 'Hackathon']
      }
    ],
    memberships: [
      {
        id: 'mem-1',
        clubId: 'club-cybersec',
        studentId: 'student-2',
        studentName: 'Aziz Karimov',
        group: 'DIK-103',
        motivation: 'CTF jamoasida qatnashib, tarmoq xavfsizligi bo‘yicha tajriba orttirmoqchiman.',
        status: 'APPROVED',
        createdAt: '2026-11-10T09:15:00+05:00'
      },
      {
        id: 'mem-2',
        clubId: 'club-aidev',
        studentId: 'demo-fe-1',
        studentName: 'Dilshod Tursunov',
        group: 'DIK-101',
        motivation: 'Veb-dasturlash va React/JS loyihalarida jamoaviy ishlashni xohlayman.',
        status: 'PENDING',
        createdAt: '2026-11-22T11:40:00+05:00'
      },
      {
        id: 'mem-3',
        clubId: 'club-cybersec',
        studentId: 'demo-ctf-2',
        studentName: 'Madina Rahimova',
        group: 'DIK-102',
        motivation: 'Kriptografiya va kiber-gigiyena bo‘yicha seminarlar o‘tkazishga qiziqaman.',
        status: 'PENDING',
        createdAt: '2026-11-22T15:20:00+05:00'
      }
    ],
    events: [
      {
        id: 'event-frontend',
        clubId: 'club-aidev',
        title: 'Frontend Practicum',
        date: '2026-11-26',
        time: '15:00',
        location: 'C-301 Innovatsiya xonasi',
        description:
          'Responsive UI, CSS Grid va ES Modules yordamida real kampus loyihasini nol dan yig‘ish amaliyoti.',
        capacity: 20,
        registrations: frontendParticipants,
        waitlist: []
      },
      {
        id: 'event-ctf',
        clubId: 'club-cybersec',
        title: 'CyberSec CTF Bootcamp',
        date: '2026-11-28',
        time: '16:00',
        location: 'B-204 Kiberxavfsizlik laboratoriyasi',
        description:
          'Web Exploitation, OSINT va Cryptography bo‘yicha 3 soatlik intensiv Capture The Flag mashg‘uloti.',
        capacity: 20,
        registrations: ctfParticipants,
        waitlist: []
      },
      {
        id: 'event-ailab',
        clubId: 'club-aidev',
        title: 'AI Prompt Engineering Lab',
        date: '2026-11-30',
        time: '14:30',
        location: 'A-105 Konferensiya zali',
        description:
          'LLM modellari bilan samarali ishlash, avtomatlashtirish va amaliy keyslar tahlili (oxirgi 1 o‘rin qoldi).',
        capacity: 20,
        registrations: aiLabParticipants,
        waitlist: []
      }
    ],
    pastHistory: [
      {
        id: 'hist-1',
        studentId: 'student-1',
        eventTitle: 'DIK1305 Kirish Seminari: Git & CI/CD',
        clubName: 'AI & Dev Club',
        date: '2026-11-12',
        status: 'ATTENDED'
      },
      {
        id: 'hist-2',
        studentId: 'student-2',
        eventTitle: 'Linux Asoslari va Bash Skripting',
        clubName: 'CyberSec Club',
        date: '2026-11-14',
        status: 'ATTENDED'
      }
    ]
  };
}
