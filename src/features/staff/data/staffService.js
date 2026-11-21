import { apiClient } from '../../../services/apiClient';
import { invalidateLocationCache } from '../../navigation/services/locationService';

// Staff page sections chosen from the department name (mirrors backend staff_categorizer.py).
const SECTION_RULES = [
  [/college of business|entrepreneurship|accountancy|\bcbm\b|\bcbea\b|\bbsba\b|\bbsoa\b|office administration/i, 'cbm'],
  [/institute of computer|computer studies|information technology|computer science|\bics\b|\bbsit\b|\bbscs\b/i, 'ics'],
  [/college of arts|arts and sciences|\bcas\b/i, 'cas'],
  [/college of education|teacher education|secondary education|elementary education|\bced\b|\bbsed\b|\bbeed\b|\bbtled\b|\bbped\b/i, 'ced'],
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
  section: 'section',
  secondaryRole: 'secondary_role',
  secondaryDepartmentId: 'secondary_department_id',
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
  invalidateLocationCache();
  return response.data;
}