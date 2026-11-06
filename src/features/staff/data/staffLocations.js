// Where each staff member can be found on the campus map.
//
// TEMPORARY RULES (until every office has its own room on the map):
//   1. If the person's office has a room on the map, they are linked to that room.
//   2. Otherwise, college staff are linked to their college's main office.
//   3. Otherwise (administration units with no room yet), they are linked to the Javier Building.
//
// Rooms are referenced by the `code` property used in /public/data/floor{n}/buildings_f{n}.geojson,
// so nothing here depends on generated ids. To give an office its real room later,
// just add a line to OFFICE_ROOMS.

import { getAll } from '../../navigation/services/locationService';

// Office name (as written in staffData.js) -> room code on the map
export const OFFICE_ROOMS = {
  'Office of the Chancellor': 'F2-JAV-OFCHAN',
  'Disaster Risk Reduction Management Office': 'JAV-DRRMU',
  'Office of the Vice Chancellor for Finance and Administration': 'F2-JAV-OVCFA',
  'Human Resource Management Unit': 'JAV-HRMU',
  'Records Management Section': 'F2-JAV-RMS',
  'Office of the Vice Chancellor for Research, Innovation, and Extension Services': 'F2-JAV-OVCRIES',
  'Office of the Vice Chancellor for Planning, Quality Assurance, and Strategic Initiatives': 'F2-JAV-OVCPQASI',
  'Management Information System Unit': 'F2-MAE-MISU',
  'Office of the Vice Chancellor for Academics and Students Affairs': 'F2-JAV-OVCASA',
  'Office of Student and Alumni Affairs Services': 'JAV-SAASU/SAO',
  'Students and Alumni Affairs Services Unit': 'JAV-SAASU/SAO',
  'Counseling and Assessment Services Unit': 'JAV-CASU',
  'Scholarship and Financial Assistance Unit': 'JAV-SFAU',
  'Library Management and Services Unit': 'F2-JAV-LMSU',
  'Health Services Unit': 'JAV-CLINIC',
  'Cooperative Education Unit': 'F2-JAV-CEU',
  'National Service Training Program Office': 'MAE-NSTP',
};

// Main office of each college / institute (keyed by the first entry of `groups`)
export const COLLEGE_MAIN_OFFICE = {
  cbea: 'F2-JAV-OFDEAN', // Office of the Dean (Javier, 2nd floor)
  ics: 'MAE-ICSOFFICE', // ICS Office of the Director (M.A.E, 1st floor)
  cas: 'F2-CAS-ADEAN', // CAS Assistant Dean's Office
  ced: 'F2-CED-ADEAN', // CED Assistant Dean's Office
};

// CBEA program heads have their own room
const CBEA_PROGRAM_HEADS_ROOM = 'F2-JAV-PROGHEADS';

// Used when nothing more specific is known
const FALLBACK_BUILDING = 'Javier Building';

// Building name on the map -> id used by the dashboard map's building highlight
const BUILDING_FILTER = {
  'M.A.E Building': 'mae',
  'CED Building': 'ced',
  'CAS Building': 'cas',
  'Javier Building': 'javier',
  Canteen: 'canteen',
};

// What we know about a person's place, before looking at the map data.
// kind: 'office' (their own office) | 'college' (college main office) | 'building' (building only)
export function getLocationRef(staff) {
  // 1. Prio: Database-assigned room code (from FastAPI joined with location table)
  if (staff.room_code) return { kind: 'office', code: staff.room_code };

  // 2. Fallback: Hardcoded dictionary mapping
  const own = OFFICE_ROOMS[staff.office];
  if (own) return { kind: 'office', code: own };

  const section = staff.groups?.[0];
  if (section && section !== 'offices') {
    if (section === 'cbea' && staff.position === 'Program Head') {
      return { kind: 'college', code: CBEA_PROGRAM_HEADS_ROOM };
    }
    if (COLLEGE_MAIN_OFFICE[section]) {
      return { kind: 'college', code: COLLEGE_MAIN_OFFICE[section] };
    }
  }

  return { kind: 'building', building: FALLBACK_BUILDING };
}

// Finds the map location (room or building) for a staff member.
// Resolves to: { loc, kind, filterId, exact }
//   loc      - location object understood by the Directions screen (room or building)
//   kind     - 'office' | 'college' | 'building'
//   filterId - building id for the map highlight (undefined if the building is not highlightable)
//   exact    - true only when the person's own office is on the map
export async function resolveStaffLocation(staff) {
  const all = await getAll();
  const ref = getLocationRef(staff);

  let kind = ref.kind;
  let loc = ref.code ? all.find((l) => l.type === 'room' && l.code === ref.code) : null;

  if (!loc) {
    kind = 'building';
    const name = ref.building || FALLBACK_BUILDING;
    loc = all.find((l) => l.id === `building:${name}`) || null;
  }

  return {
    loc,
    kind,
    filterId: loc ? BUILDING_FILTER[loc.building] : undefined,
    exact: kind === 'office',
  };
}
