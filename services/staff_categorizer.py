import re
from typing import Iterable, List, Optional

STAFF_SECTIONS = [
    {"id": "offices", "title": "Offices & Administration"},
    {"id": "cbm", "title": "College of Business and Management"},
    {"id": "ics", "title": "Institute of Computer Studies"},
    {"id": "cas", "title": "College of Arts and Sciences"},
    {"id": "ced", "title": "College of Education"},
]

VALID_SECTION_IDS = {s["id"] for s in STAFF_SECTIONS}

LEGACY_SECTION_MAP = {
    "cbea": "cbm",
}

# Ordered rules mapping department/program names to their parent directory section.
# Administrative units (e.g., "Human Resource Management Unit", "Cooperative Education Unit")
# intentionally fall through to "offices".
_SECTION_RULES = [
    (
        re.compile(
            r"college of business|entrepreneurship|accountancy|\bcbm\b|\bcbea\b|\bbsba\b|\bbsoa\b|office administration",
            re.IGNORECASE,
        ),
        "cbm",
    ),
    (
        re.compile(
            r"institute of computer|computer studies|information technology|\bbsit\b",
            re.IGNORECASE,
        ),
        "ics",
    ),
    (
        re.compile(
            r"college of arts|arts and sciences|\bcas\b",
            re.IGNORECASE,
        ),
        "cas",
    ),
    (
        re.compile(
            r"college of education|teacher education|secondary education|elementary education|\bced\b|\bbsed\b|\bbeed\b|\bbtled\b|\bbped\b",
            re.IGNORECASE,
        ),
        "ced",
    ),
]


def normalize_section_id(section_id: Optional[str]) -> Optional[str]:
    """Normalizes a section/group ID (converting legacy 'cbea' -> 'cbm')."""
    if not section_id or not isinstance(section_id, str):
        return None
    cleaned = section_id.strip().lower()
    mapped = LEGACY_SECTION_MAP.get(cleaned, cleaned)
    return mapped if mapped in VALID_SECTION_IDS else None


def resolve_section_from_department(department_name: Optional[str]) -> str:
    """Resolves the directory section ID from a department or program name."""
    if not department_name:
        return "offices"
    for pattern, section_id in _SECTION_RULES:
        if pattern.search(department_name):
            return section_id
    return "offices"


def normalize_groups(
    groups: Optional[Iterable[str]],
    department_name: Optional[str] = None,
) -> List[str]:
    """
    Normalizes stored metadata.groups and guarantees at least one valid section ID.
    Falls back to department-based resolution when groups is empty or unrecognized.
    """
    normalized: List[str] = []
    if isinstance(groups, (list, tuple)):
        for g in groups:
            sec = normalize_section_id(g)
            if sec and sec not in normalized:
                normalized.append(sec)

    if not normalized:
        normalized.append(resolve_section_from_department(department_name))

    return normalized