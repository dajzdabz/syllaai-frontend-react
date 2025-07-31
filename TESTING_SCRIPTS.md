# 🧪 Cookie Authentication Testing Scripts

## 📋 **Testing Plan**

1. **Test 1**: Verify cookie headers on login
2. **Test 2**: Check if cookies are sent with API requests  
3. **Test 3**: Validate authentication flow end-to-end
4. **Test 4**: Test logout functionality

---

## 🔍 **Test 1: Cookie Headers on Login**

**What to do**: Login and check the Set-Cookie header

1. **Clear all site data**: 
   - Open DevTools → Application → Storage → Clear site data
   - Or go to `chrome://settings/content/cookies` and delete all SyllabAI cookies

2. **Open Network tab** in DevTools before logging in

3. **Login with Google**

4. **Find the `/api/auth/authenticate` request** in Network tab

5. **Check Response Headers** - Should see:
   ```
   Set-Cookie: auth_token=...; HttpOnly; Max-Age=3600; Path=/; SameSite=None; Secure
   ```

**Run this in console after login**:
```javascript
// Test 1: Cookie Header Verification
console.log("=== COOKIE HEADER TEST ===");

// Check if auth_token cookie exists
const cookies = document.cookie;
console.log("🍪 Document cookies:", cookies);

if (cookies.includes('auth_token')) {
    console.log("❌ ERROR: auth_token visible in document.cookie (security issue)");
} else {
    console.log("✅ GOOD: auth_token not visible in JavaScript (HttpOnly working)");
}

// Check localStorage - should only have user data, no tokens
const localStorageKeys = Object.keys(localStorage);
console.log("💾 localStorage keys:", localStorageKeys);

if (localStorageKeys.includes('access_token')) {
    console.log("❌ ERROR: access_token still in localStorage");
} else {
    console.log("✅ GOOD: No access_token in localStorage");
}

console.log("Expected localStorage: user, session_expires_at, user_permissions");
```

---

## 🔍 **Test 2: API Request Cookie Verification**

**What to do**: Check if cookies are sent with API requests

1. **After successful login**, open Network tab
2. **Navigate or refresh** to trigger a `/api/courses/` request
3. **Check the Request Headers** - Should see:
   ```
   Cookie: auth_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
   ```

**Run this in console**:
```javascript
// Test 2: API Request Cookie Test
console.log("=== API REQUEST TEST ===");

async function testApiRequest() {
    try {
        console.log("🚀 Testing /api/courses/ request...");
        
        const response = await fetch('https://syllaai-ai.onrender.com/api/courses/', {
            method: 'GET',
            credentials: 'include',  // This sends cookies
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log("📊 Response status:", response.status);
        
        if (response.status === 200) {
            console.log("✅ SUCCESS: API request with cookies working!");
            const data = await response.json();
            console.log("📦 Response data:", data);
        } else if (response.status === 403) {
            console.log("❌ FAILED: Still getting 403 - cookies not being sent");
            console.log("🔍 Check Network tab for Cookie header in request");
        } else {
            console.log("⚠️ UNEXPECTED: Got status", response.status);
        }
    } catch (error) {
        console.log("❌ ERROR:", error);
    }
}

testApiRequest();
```

---

## 🔍 **Test 3: End-to-End Authentication Flow**

**Run this comprehensive test**:
```javascript
// Test 3: Complete Authentication Flow Test
console.log("=== COMPLETE AUTH FLOW TEST ===");

async function fullAuthTest() {
    console.log("1️⃣ Checking localStorage auth data...");
    
    const user = localStorage.getItem('user');
    const sessionExpiry = localStorage.getItem('session_expires_at');
    
    if (user && sessionExpiry) {
        console.log("✅ User data present in localStorage");
        console.log("👤 User:", JSON.parse(user).email);
        console.log("⏰ Session expires:", new Date(parseInt(sessionExpiry)));
    } else {
        console.log("❌ Missing auth data in localStorage");
        return;
    }
    
    console.log("2️⃣ Testing /api/auth/me endpoint...");
    
    try {
        const meResponse = await fetch('https://syllaai-ai.onrender.com/api/auth/me', {
            credentials: 'include'
        });
        
        if (meResponse.ok) {
            console.log("✅ /api/auth/me working");
            const userData = await meResponse.json();
            console.log("👤 User from API:", userData.email);
        } else {
            console.log("❌ /api/auth/me failed:", meResponse.status);
        }
    } catch (error) {
        console.log("❌ /api/auth/me error:", error);
    }
    
    console.log("3️⃣ Testing protected endpoint...");
    
    try {
        const coursesResponse = await fetch('https://syllaai-ai.onrender.com/api/courses/', {
            credentials: 'include'
        });
        
        if (coursesResponse.ok) {
            console.log("✅ Protected endpoint working!");
            const courses = await coursesResponse.json();
            console.log("📚 Courses count:", courses.length);
        } else {
            console.log("❌ Protected endpoint failed:", coursesResponse.status);
        }
    } catch (error) {
        console.log("❌ Protected endpoint error:", error);
    }
}

fullAuthTest();
```

---

## 🔍 **Test 4: Logout Test**

**Run this to test logout**:
```javascript
// Test 4: Logout Functionality Test
console.log("=== LOGOUT TEST ===");

async function testLogout() {
    console.log("🚪 Testing logout...");
    
    try {
        const logoutResponse = await fetch('https://syllaai-ai.onrender.com/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (logoutResponse.ok) {
            console.log("✅ Logout endpoint successful");
            
            // Wait a moment then test if we're really logged out
            setTimeout(async () => {
                console.log("🔍 Testing if we're logged out...");
                
                const testResponse = await fetch('https://syllaai-ai.onrender.com/api/auth/me', {
                    credentials: 'include'
                });
                
                if (testResponse.status === 401 || testResponse.status === 403) {
                    console.log("✅ LOGOUT SUCCESS: No longer authenticated");
                } else {
                    console.log("❌ LOGOUT FAILED: Still authenticated");
                }
            }, 1000);
            
        } else {
            console.log("❌ Logout endpoint failed:", logoutResponse.status);
        }
    } catch (error) {
        console.log("❌ Logout error:", error);
    }
}

// Uncomment to test logout (will log you out!)
// testLogout();
console.log("💡 Uncomment the last line to test logout");
```

---

## 📋 **Quick Success Checklist**

Run these tests in order and check:

- [ ] **Test 1**: ✅ No `auth_token` visible in `document.cookie`
- [ ] **Test 1**: ✅ No `access_token` in localStorage
- [ ] **Test 2**: ✅ `/api/courses/` returns 200 (not 403)
- [ ] **Test 3**: ✅ All three API calls succeed
- [ ] **Test 4**: ✅ Logout works and subsequent calls get 401/403

---

## 🚨 **If Tests Fail**

1. **Still getting 403?** 
   - Check Network tab for `Cookie` header in requests
   - Verify `Set-Cookie` header shows `SameSite=None`

2. **Cookies not being sent?**
   - Ensure backend deployment finished (check Render.com logs)
   - Try hard refresh: Ctrl+Shift+R

3. **Still issues?**
   - Clear all browser data and retry
   - Check browser console for CORS errors

---

**🎯 Expected Result**: All tests should pass, meaning secure cross-domain cookie authentication is working!