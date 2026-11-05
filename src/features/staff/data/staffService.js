// Supabase access for staff + locations.
// Tables: staff_members, departments, location (see the schema diagram).
import { supabase } from '../../../services/supabaseClient';

// Staff page sections (see STAFF_SECTIONS in staffData.js) chosen from the department name.
// Anything that is not a college/institute is listed under "Offices & Administration".
const SECTION_RULES = [
  [/college of business|entrepreneurship|accountancy|\bcbea\b/i, 'cbea'],
  [/institute of computer|\bics\b/i, 'ics'],
  [/college of arts|\bcas\b/i, 'cas'],
  [/college of education|\bced\b/i, 'ced'],
];

export function sectionForDepartment(name = '') {
  const hit = SECTION_RULES.find(([re]) => re.test(name));
  return hit ? hit[1] : 'offices';
}

const COLUMN = {
  firstName: 'first_name',
  lastName: 'last_name',
  role: 'role',
  email: 'email',
  departmentId: 'department_id',
  officeLocationId: 'office_location_id',
};

function toRow(values) {
  const row = {};
  Object.entries(values).forEach(([key, value]) => {
    const column = COLUMN[key];
    if (!column) return;
    if (key.endsWith('Id')) row[column] = value === '' || value == null ? null : Number(value);
    else row[column] = typeof value === 'string' ? value.trim() || null : value;
  });
  return row;
}

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data || [];
}

// Same shape the Staff page already uses: { id, name, position, office, groups }
export async function fetchStaff() {
  const staffRows = check(
    await supabase
      .from('staff_members')
      .select('employee_number, department_id, office_location_id, first_name, last_name, role, email')
      .order('last_name'),
  );
  if (staffRows.length === 0) return [];

  const officeIds = [...new Set(staffRows.map((r) => r.office_location_id).filter((v) => v != null))];
  const [departments, offices] = await Promise.all([
    supabase.from('departments').select('departmentid, name').then(check),
    officeIds.length
      ? supabase.from('location').select('locationid, name').in('locationid', officeIds).then(check)
      : Promise.resolve([]),
  ]);
  const deptName = new Map(departments.map((d) => [d.departmentid, d.name]));
  const officeName = new Map(offices.map((o) => [o.locationid, o.name]));

  return staffRows.map((r) => ({
    id: r.employee_number,
    name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
    position: r.role || '',
    office: officeName.get(r.office_location_id) || '',
    groups: [sectionForDepartment(deptName.get(r.department_id))],
    // extra fields used by the admin forms
    firstName: r.first_name || '',
    lastName: r.last_name || '',
    email: r.email || '',
    departmentId: r.department_id,
    officeLocationId: r.office_location_id,
  }));
}

export async function fetchDepartments() {
  const rows = check(await supabase.from('departments').select('departmentid, name').order('name'));
  return rows.map((d) => ({ id: d.departmentid, name: d.name }));
}

export async function fetchLocations() {
  const rows = check(
    await supabase
      .from('location')
      .select('locationid, name, code, building_code')
      .order('name')
      .limit(5000),
  );
  return rows.map((l) => ({ id: l.locationid, name: l.name, code: l.code, building: l.building_code }));
}

// Row-level security can make a write succeed with zero rows changed, so ask for the rows back.
function changed(rows) {
  if (rows.length === 0) {
    throw new Error('Nothing was saved. Your account may not have permission to change this table.');
  }
  return rows;
}

export async function addStaff({ employeeNumber, ...values }) {
  const row = toRow(values);
  if (employeeNumber !== '' && employeeNumber != null) row.employee_number = Number(employeeNumber);
  return changed(check(await supabase.from('staff_members').insert(row).select()));
}

export async function updateStaff(employeeNumber, values) {
  return changed(
    check(await supabase.from('staff_members').update(toRow(values)).eq('employee_number', employeeNumber).select()),
  );
}

export async function deleteStaff(employeeNumber) {
  return changed(check(await supabase.from('staff_members').delete().eq('employee_number', employeeNumber).select()));
}

export async function renameLocation(locationId, name) {
  return changed(
    check(await supabase.from('location').update({ name: name.trim() }).eq('locationid', locationId).select()),
  );
}
