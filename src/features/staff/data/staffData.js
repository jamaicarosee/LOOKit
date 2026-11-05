// Section headings shown on the Staff page, in display order.
// A person is listed under the FIRST entry of their `groups` array
// (e.g. ['offices', 'cbea'] -> listed under "Offices & Administration").
export const STAFF_SECTIONS = [
  { id: 'offices', title: 'Offices & Administration' },
  { id: 'cbea', title: 'College of Business, Entrepreneurship, and Accountancy' },
  { id: 'ics', title: 'Institute of Computer Studies' },
  { id: 'cas', title: 'College of Arts and Sciences' },
  { id: 'ced', title: 'College of Education' },
];

// Source: "RTU-Pasig_Offices_and_Staffs.pdf"
// Each person appears ONCE. `groups[0]` decides the section they are listed under;
// any extra entries just record their other roles.
let nextId = 0;
const person = (name, position, office, groups) => ({
  id: ++nextId,
  name,
  position,
  office,
  groups,
});

const O = 'offices';
const CBEA = 'cbea';
const ICS = 'ics';
const CAS = 'cas';

// ---------- Offices & administration ----------
const offices = [
  person('Dr. Corazon D. Austria', 'Chancellor', 'Office of the Chancellor', [O, CBEA]),
  person('Instr. John Rey Dormentes', 'Head', 'Disaster Risk Reduction Management Office', [O, CBEA]),

  // Vice Chancellor for Finance and Administration
  person('Dr. Eugenia G. Samarista', 'Vice Chancellor for Finance and Administration', 'Office of the Vice Chancellor for Finance and Administration', [O, CBEA]),
  person('Dr. Francis B. Banaag, CMP', 'Head', 'Human Resource Management Unit', [O, CBEA]),
  person('Instr. Susan O. Vargas', 'Head', 'Records Management Section', [O]),
  person('Instr. Elizabeth G. Buraga, MA', 'Head', 'Employee Relations and Engagement Unit', [O]),
  person('Instr. Emerson B. Juales', 'Head', 'General Services Unit', [O, CBEA]),

  // Vice Chancellor for Research, Innovation, and Extension Services
  person('Assoc. Prof. Jason A. Romero', 'Vice Chancellor for Research, Innovation, and Extension Services', 'Office of the Vice Chancellor for Research, Innovation, and Extension Services', [O]),

  // Vice Chancellor for Planning, Quality Assurance, and Strategic Initiatives
  person('Assoc. Prof. Niño P. Maliban', 'Vice Chancellor for Planning, Quality Assurance, and Strategic Initiatives', 'Office of the Vice Chancellor for Planning, Quality Assurance, and Strategic Initiatives', [O]),
  person('Instr. Fae B. Illut', 'Head', 'Management Information System Unit', [O]),
  person('Instr. Errol F. Diestro', 'Head', 'Data Protection Unit', [O, CBEA]),

  // Vice Chancellor for Academics and Students Affairs
  person('Dr. Kristoffer M. Morada', 'Vice Chancellor for Academics and Students Affairs', 'Office of the Vice Chancellor for Academics and Students Affairs', [O]),
  person('Dr. Maria Teresa R. Beloy', 'Head', 'Office of Student and Alumni Affairs Services', [O]),
  person('Instr. Zandra L. Brinas', 'Head', 'Students and Alumni Affairs Services Unit', [O, CBEA]),
  person('Instr. Jake Jason M. Queddeng', 'Head', 'Counseling and Assessment Services Unit', [O]),
  person('Mary Prescious Glenne O. Bonifacio', 'Psychometrician / Guidance Staff', 'Counseling and Assessment Services Unit', [O]),
  person('Rohayna D. Hassan', 'Psychometrician / Guidance Staff', 'Counseling and Assessment Services Unit', [O]),
  person('Mr. James Patrick B. Almocera', 'Head', 'Scholarship and Financial Assistance Unit', [O]),
  person('Asst. Prof. Julian B. Santos Jr.', 'Head', 'Cultural Affairs Unit', [O]),
  person('Ms. Ruth Ann V. Fernandez', 'Head', 'Library Management and Services Unit', [O]),

  // Health Services Unit
  person('Lusieto B. Oporto, M.D.', 'Head, University Physician', 'Health Services Unit', [O]),
  person('Maria Bituin Asperilla, DMD', 'University Dentist', 'Health Services Unit', [O]),
  person('Angelie Anne C. Dalisay, RN', 'Head Nurse', 'Health Services Unit', [O]),
  person('Tommy Ryan A. Morales, RN', 'University Nurse', 'Health Services Unit', [O]),
  person('Reinaline A. Morilla, RN', 'University Nurse', 'Health Services Unit', [O]),

  // Cooperative Education Unit
  person('Instr. Edgardo T. Del Rosario Jr.', 'Head', 'Cooperative Education Unit', [O]),
  person('Dr. Agnes F. Montalbo', 'COE Pasig Branch Coordinator', 'Cooperative Education Unit', [O]),
  person('Asst. Prof. Aivie May R. Morada', 'COE Pasig Branch Coordinator', 'Cooperative Education Unit', [O]),
  person('Instr. Chona A. Escote', 'COE Pasig Branch Coordinator', 'Cooperative Education Unit', [O]),
  person('Instr. Krisia T. Oledan', 'COE Pasig Branch Coordinator', 'Cooperative Education Unit', [O, CBEA]),

  person('Instr. Mercy L. Alejandrino', 'Head', 'Auxiliary Services Unit', [O]),
  person('Assoc. Prof. Joven F. Andrada', 'Head', 'National Service Training Program Office', [O]),
];

// ---------- College of Business, Entrepreneurship, and Accountancy (CBEA) ----------
const COLLEGE = 'College of Business, Entrepreneurship, and Accountancy';
const HRM = 'BSBA Human Resource Management';
const OPS = 'BSBA Operations Management';
const MKT = 'BSBA Marketing Management';
const FIN = 'BSBA Financial Management';
const FT = 'Full-time Faculty';
const PT = 'Part-time Faculty';

const cbea = [
  person('Dr. Kathryn D. Tria', 'Dean', COLLEGE, [CBEA]),
  person('Dr. Jessie F. Sergote', 'Associate Dean', COLLEGE, [CBEA, O]),

  // BSBA Human Resource Management
  person('Instr. Florencia A. Dela Cruz, MBA', 'Program Head', HRM, [CBEA, O]),
  person('Asst. Prof. Luzviminda Paras', FT, HRM, [CBEA]),
  person('Instr. Maria Helen R. Gunda', FT, HRM, [CBEA]),
  person('Dr. John Philip G. Pamposa', PT, HRM, [CBEA]),
  person('Instr. Cheryll Eileen B. Nillo', PT, HRM, [CBEA]),
  person('Instr. Eileen P. Santos', PT, HRM, [CBEA]),
  person('Instr. Lucky Lester B. Ople, CPA', PT, HRM, [CBEA]),
  person('Atty. Johnson L. Villaruel', PT, HRM, [CBEA]),
  person('Instr. Kenneth Michael A.', PT, HRM, [CBEA]),

  // BSBA Operations Management
  person('Instr. Jessa C. Dionisio', 'Program Head', OPS, [CBEA, O]),
  person('Instr. Reynante A. America', FT, OPS, [CBEA]),
  person('Atty. Adrian Antazo', FT, OPS, [CBEA]),
  person('Instr. Nestor W. Espenocilla', FT, OPS, [CBEA]),
  person('Dr. Remil R. Yabut', PT, OPS, [CBEA]),
  person('Dr. Marissa C. Marable', PT, OPS, [CBEA]),
  person('Asst. Prof. Leonardo T. Cruz', PT, OPS, [CBEA]),
  person('Instr. Harvey King P. De Leon', PT, OPS, [CBEA]),
  person('Instr. Carla P. Labonete', PT, OPS, [CBEA]),
  person('Instr. William B. Perez', PT, OPS, [CBEA]),

  // BSBA Marketing Management
  // (Program Head Dr. Francis B. Banaag is listed under Offices + CBEA above)
  person('Dr. Crister Jane H. Cabejo', FT, MKT, [CBEA]),
  person('Instr. Ian M. Tianero', PT, MKT, [CBEA]),
  person('Instr. Aldren L. Lorica', PT, MKT, [CBEA]),
  person('Instr. Gladys A. Isip, CPA', PT, MKT, [CBEA]),

  // BSBA Financial Management
  person('Instr. Dan Christian L. Gabon, MBA', 'Program Head', FIN, [CBEA]),
  person('Dr. Ferdinand C. Martinez', FT, FIN, [CBEA]),
  person('Dr. Velissa C. Rubaya', FT, FIN, [CBEA]),
  person('Asst. Prof. Dorina D. Barreto', FT, FIN, [CBEA]),
  person('Asst. Prof. Jesusito E. Tiglao', FT, FIN, [CBEA]),
  person('Dr. Michael L. De La Cruz', PT, FIN, [CBEA]),
  person('Atty. Julian Tutanes', PT, FIN, [CBEA]),
  person('Instr. Reynaldo V. Meneses Jr., CPA', PT, FIN, [CBEA]),
  person('Instr. Mary Jane Garcia, CPA', PT, FIN, [CBEA]),
  person('Instr. Mark Eugene Jose Lopez, CPA', PT, FIN, [CBEA]),
  person('Instr. Rufo O. Dominguez', PT, FIN, [CBEA]),
  person('Instr. Angel M. Bautista', PT, FIN, [CBEA]),
];

// ---------- Institute of Computer Studies (ICS) ----------
const ics = [
  person('Dr. Lea S. Nisperos', 'Dean', 'Institute of Computer Studies', [ICS, O]),
  person('Instr. Noel V. Gutierrez', 'Associate Dean', 'Institute of Computer Studies', [ICS]),
];

// ---------- College of Arts and Sciences (CAS) ----------
// NOTE: the PDF gives no title for this person - fill in `position` once confirmed.
const cas = [
  person('Asst. Prof. Babylyn G. Retanan', '', 'College of Arts and Sciences', [CAS]),
];

// ---------- College of Education (CED) ----------
// The PDF lists no staff for CED yet.
const ced = [];

export const STAFF_DATA = [...offices, ...cbea, ...ics, ...cas, ...ced];

// ---------- Helpers ----------
const TITLES = /^(dr|prof|assoc|asst|instr|engr|arch|atty|mr|mrs|ms|mx)\.?$/i;
const SUFFIXES = /^(jr|sr|ii|iii|iv)\.?$/i;

// "Dr. Corazon D. Austria"                -> "CA"
// "Instr. Mary Jane Garcia, CPA"          -> "MG"  (credentials after the comma are ignored)
// "Instr. Reynaldo V. Meneses Jr., CPA"   -> "RM"  (Jr./Sr. ignored)
export function getInitials(fullName = '') {
  const parts = fullName
    .split(',')[0]
    .split(/\s+/)
    .filter((p) => p && !TITLES.test(p) && !SUFFIXES.test(p));
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Search by name, position, or office/program
export function filterStaff(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.position.toLowerCase().includes(q) ||
      s.office.toLowerCase().includes(q)
  );
}

// Split a staff list into the sections above (empty sections are left out)
export function groupStaffBySection(list) {
  return STAFF_SECTIONS.map((section) => ({
    ...section,
    staff: list.filter((person) => person.groups[0] === section.id),
  })).filter((section) => section.staff.length > 0);
}
