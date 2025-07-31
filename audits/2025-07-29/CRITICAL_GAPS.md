# SyllabAI Critical Gaps - Must Fix Before Any Development
**Date**: July 29, 2025  
**Priority**: CRITICAL - Block all development until resolved

## 🚨 Database SSL Connection (CRITICAL)
**Risk**: All application data exposed to interception  
**Current Status**: SSL connection problems preventing database cleanup  
**Impact**: Complete data compromise risk

**Fix Required**:
```python
# backend/app/config.py
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql://") and "sslmode" not in DATABASE_URL:
    DATABASE_URL += "?sslmode=require"

engine_options = {"connect_args": {"sslmode": "require"}} if DATABASE_URL.startswith("postgresql://") else {}
engine = create_engine(DATABASE_URL, **engine_options)
```

## 🔐 Plaintext Token Storage (CRITICAL)
**Risk**: Database compromise = immediate user account takeover  
**File**: `backend/app/models/user.py` line 29  
**Impact**: Google OAuth tokens stored unencrypted

**Fix Required**: 
- Run migration script `migrate_access_token_to_encrypted()` immediately
- Verify all tokens are encrypted before proceeding

## ⚡ Disabled DoS Protection (CRITICAL)
**Risk**: Server vulnerable to Slowloris and DoS attacks  
**File**: `backend/app/main.py` line 273  
**Current Status**: TimeoutMiddleware commented out due to "request hangs"

**Fix Required**:
- Debug root cause of request hangs
- Re-enable TimeoutMiddleware with proper configuration
- Never disable security features without alternatives

## 🛡️ CSRF Vulnerability (HIGH)
**Risk**: Cross-site request forgery attacks  
**File**: `backend/app/routers/auth.py` line 98  
**Issue**: `samesite="none"` cookies without CSRF protection

**Fix Required**:
```python
# Install: pip install fastapi-csrf-protect
from fastapi_csrf_protect import CsrfProtect

@CsrfProtect.load_config
def get_csrf_config():
    return CsrfSettings(secret_key=settings.secret_key)

# Frontend needs to fetch CSRF token and include in X-CSRF-Token header
```

## 🔒 Weak Encryption (HIGH)
**Risk**: Faster brute-force attacks if database + SECRET_KEY compromised  
**File**: `backend/app/utils/crypto.py` line 24  
**Issue**: PBKDF2 uses only 100,000 iterations (OWASP recommends 600,000+)

**Fix Required**:
```python
# Increase iterations and implement versioned encryption
PBKDF2_ITERATIONS = 600_000  # Update from 100,000
```

## 📊 No Comprehensive Testing (CRITICAL)
**Risk**: Every deployment is a gamble  
**Missing**: Unit, integration, and E2E tests

**Fix Required**:
- Implement testing pyramid: Unit → Integration → E2E
- Block deployments without passing tests
- Test critical flows: auth, course creation, calendar export

**Estimated Time**: 2-3 days for critical fixes before any new development can proceed