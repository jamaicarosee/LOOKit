import re
import dns.exception
import dns.resolver

INVALID_EMAIL_MESSAGE = "Please input a valid email"

_EMAIL_REGEX = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$"
)

_DISPOSABLE_DOMAINS = {
    "10minutemail.com",
    "dispostable.com",
    "dummy.com",
    "example.com",
    "example.net",
    "example.org",
    "fake.com",
    "fakeinbox.com",
    "getnada.com",
    "guerrillamail.com",
    "guerrillamail.net",
    "guerrillamail.org",
    "invalid.com",
    "maildrop.cc",
    "mailinator.com",
    "mintemail.com",
    "sharklasers.com",
    "temp-mail.org",
    "tempmail.com",
    "test.com",
    "throwawaymail.com",
    "trashmail.com",
    "yopmail.com",
}

def has_valid_mx_record(domain: str) -> bool:
    """
    Verifies that the domain has at least one active DNS MX record.
    Rejects non-existent domains, domains without mail servers, and null MX (RFC 7505).
    """

    resolver = dns.resolver.Resolver()
    resolver.timeout = 2.0
    resolver.lifetime = 3.0

    try:
        answers = resolver.resolve(domain, "MX")
        for rdata in answers:
            exchange = str(rdata.exchange).strip()
            if exchange and exchange != ".":
                return True
        return False
    except (
        dns.resolver.NXDOMAIN,
        dns.resolver.NoAnswer,
        dns.resolver.NoNameservers,
        dns.resolver.YXDOMAIN,
    ):
        return False
    except dns.exception.Timeout:
        # Avoid blocking valid sign-ups during a transient DNS timeout
        print(f"[LOOKit Auth] DNS MX lookup timed out for domain: {domain}")
        return True
    except Exception as exc:
        print(f"[LOOKit Auth] DNS MX lookup error for domain {domain}: {exc}")
        return False

def validate_email_address(email: str) -> tuple[bool, str]:
    """
    Validates email format, blocks disposable/placeholder domains,
    and checks DNS MX records for the domain.
    """

    normalized = (email or "").strip().lower()

    if not normalized or len(normalized) > 254 or ".." in normalized:
        return False, INVALID_EMAIL_MESSAGE

    if not _EMAIL_REGEX.match(normalized):
        return False, INVALID_EMAIL_MESSAGE

    local_part, domain = normalized.rsplit("@", 1)
    if (
        not local_part
        or len(local_part) > 64
        or local_part.startswith(".")
        or local_part.endswith(".")
    ):
        return False, INVALID_EMAIL_MESSAGE

    tld = domain.rsplit(".", 1)[-1]
    if len(tld) < 2 or not tld.isalpha():
        return False, INVALID_EMAIL_MESSAGE

    if domain in _DISPOSABLE_DOMAINS:
        return False, INVALID_EMAIL_MESSAGE

    if not has_valid_mx_record(domain):
        return False, INVALID_EMAIL_MESSAGE

    return True, ""

def validate_strong_password(password: str) -> str:
    """
    Enforces strong password rules:
    - 8 to 72 characters (bcrypt limit)
    - At least 1 uppercase letter
    - At least 1 number
    - At least 1 special character
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(password) > 72:
        raise ValueError("Password must be at most 72 characters.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least one uppercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must include at least one number.")
    if not re.search(r"[^A-Za-z0-9\s]", password):
        raise ValueError("Password must include at least one special character.")
    return password