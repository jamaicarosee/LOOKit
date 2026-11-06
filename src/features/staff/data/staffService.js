import { apiClient } from '../../../services/apiClient';

// Staff page sections chosen from the department name.
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

// Maps frontend camelCase state to backend snake_case JSON keys
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

// ------------------------------------------------------------------
// GET requests (Public & Admin)
// ------------------------------------------------------------------

export async function fetchStaff() {
  const response = await apiClient.get('/api/staff');
  return response.data?.staff || [];
}

export async function fetchDepartments() {
  const response = await apiClient.get('/api/staff/departments');
  return response.data?.departments || [];
}

export async function fetchLocations() {
  const response = await apiClient.get('/api/staff/locations');
  return response.data?.locations || [];
}

// ------------------------------------------------------------------
// Admin Mutations (Requires Admin JWT Bearer Token)
// ------------------------------------------------------------------

export async function addStaff({ employeeNumber, ...values }) {
  const row = toRow(values);
  if (employeeNumber !== '' && employeeNumber != null) {
    row.employee_number = Number(employeeNumber);
  }
  const response = await apiClient.post('/api/staff', row);
  return response.data;
}

export async function updateStaff(employeeNumber, values) {
  const response = await apiClient.put(`/api/staff/${employeeNumber}`, toRow(values));
  return response.data;
}

export async function deleteStaff(employeeNumber) {
  const response = await apiClient.delete(`/api/staff/${employeeNumber}`);
  return response.data;
}

export async function renameLocation(locationId, name) {
  const response = await apiClient.put(`/api/navigation/locations/${locationId}`, { name });
  return response.data;
}