// Where each staff member can be found on the campus map.
//
// Priority order:
//   1. Database-assigned officeLocationId / office_location_id (set in Admin -> Directory)
//   2. Database-assigned room_code or matching room name
//   3. Hardcoded OFFICE_ROOMS / COLLEGE_MAIN_OFFICE dictionary fallback
//   4. Javier Building fallback

import { getAll } from '../../navigation/services/locationService';

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

export const COLLEGE_MAIN_OFFICE = {
  cbea: 'F2-JAV-OFDEAN',
  ics: 'MAE-ICSOFFICE',
  cas: 'F2-CAS-ADEAN',
  ced: 'F2-CED-ADEAN',
};

const CBEA_PROGRAM_HEADS_ROOM = 'F2-JAV-PROGHEADS';
const FALLBACK_BUILDING = 'Javier Building';

const BUILDING_FILTER = {
  'M.A.E Building': 'mae',
  'CED Building': 'ced',
  'CAS Building': 'cas',
  'Javier Building': 'javier',
  Canteen: 'canteen',
};

export function getLocationRef(staff) {
  const locationId = staff.officeLocationId ?? staff.office_location_id;
  if (locationId != null && locationId !== '') {
    return { kind: 'office', locationId: String(locationId), code: staff.room_code || null };
  }

  if (staff.room_code) {
    return { kind: 'office', code: staff.room_code };
  }

  if (staff.office) {
    const exactMatch = OFFICE_ROOMS[staff.office];
    if (exactMatch) return { kind: 'office', code: exactMatch };

    const normOffice = staff.office.trim().toLowerCase();
    const ciKey = Object.keys(OFFICE_ROOMS).find((k) => k.toLowerCase() === normOffice);
    if (ciKey) return { kind: 'office', code: OFFICE_ROOMS[ciKey] };

    return { kind: 'office', code: staff.office.trim(), query: staff.office.trim() };
  }

  const section = (staff.groups?.[0] || '').toLowerCase();
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

export async function resolveStaffLocation(staff) {
  const all = await getAll();
  const ref = getLocationRef(staff);

  let kind = ref.kind;
  let loc = null;

  if (ref.locationId) {
    loc =
      all.find(
        (l) =>
          String(l.dbId ?? l.location_id ?? '') === ref.locationId ||
          String(l.id) === ref.locationId ||
          String(l.id) === `room:${ref.locationId}`
      ) || null;
  }

  if (!loc && ref.code) {
    const normCode = ref.code.trim().toLowerCase();
    loc =
      all.find(
        (l) =>
          l.type === 'room' &&
          ((l.id && String(l.id).toLowerCase() === normCode) ||
            (l.code && l.code.toLowerCase() === normCode.split('@')[0]) ||
            (l.name && l.name.toLowerCase() === normCode) ||
            (l.label && l.label.toLowerCase() === normCode))
      ) || null;
  }

  if (!loc && ref.query) {
    const normQuery = ref.query.toLowerCase();
    loc =
      all.find(
        (l) =>
          l.type === 'room' &&
          ((l.name && l.name.toLowerCase() === normQuery) ||
            (l.full_name && l.full_name.toLowerCase() === normQuery))
      ) || null;
  }

  if (!loc) {
    kind = 'building';
    const name = ref.building || FALLBACK_BUILDING;
    loc = all.find((l) => l.id === `building:${name}`) || null;
  }

  return {
    loc,
    kind,
    filterId: loc ? BUILDING_FILTER[loc.building] : undefined,
    exact: kind === 'office' && loc?.type === 'room',
  };
}
