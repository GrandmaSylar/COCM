# **Comprehensive Test Scenarios Document**
## **Project: Church Management System (CMS-demo)**

---

## **1. Test Strategy Overview**
### **Testing Approach**
- **Hybrid Testing**: Combination of manual and automated testing.
- **Shift-Left Testing**: Early integration of testing in the development lifecycle.
- **Risk-Based Testing**: Prioritize high-risk areas (e.g., data integrity, security, performance).
- **Test Pyramid**: Emphasize unit tests (base), followed by integration and E2E tests (top).

### **Test Scope & Objectives**
- **Scope**: Full coverage of React/Vue components, API endpoints, database operations, and user workflows.
- **Objectives**:
  - Ensure **functional correctness** of all features.
  - Validate **data integrity** and **security** (e.g., Supabase auth, input sanitization).
  - Verify **performance** under expected and peak loads.
  - Test **cross-browser compatibility** and **mobile responsiveness**.
  - Validate **error handling** and **user feedback**.

### **Risk Assessment & Mitigation**
| **Risk**                     | **Impact**               | **Mitigation Strategy**                          |
|------------------------------|--------------------------|--------------------------------------------------|
| Data corruption in Supabase | High (data loss)         | Use transactions, rollback on failure.          |
| Authentication vulnerabilities | High (security breach) | Penetration testing, OWASP guidelines.            |
| Slow API responses           | Medium (UX degradation)  | Load testing, caching strategies.                |
| UI inconsistencies           | Medium (user frustration)| Cross-browser testing, accessibility checks.    |
| Race conditions in realtime  | High (data inconsistency)| Test with mocked WebSocket delays.               |

### **Test Environment Requirements**
- **Development**: Local Vite + Supabase setup.
- **Staging**: Vercel/Netlify + Supabase sandbox.
- **Production-like**: Mocked Supabase with test data.
- **Tools**:
  - **Testing**: Jest (Unit/Integration), Playwright/Cypress (E2E).
  - **Performance**: k6, Lighthouse.
  - **Security**: OWASP ZAP, Supabase security scanner.

---

## **2. Functional Test Scenarios**
### **2.1. Positive Test Cases**
#### **Member Management (Add/Edit/Delete)**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| FUNC-001    | Add a new child member successfully     | Fill form with valid data, submit.                                        | Member added; success toast appears.         |
| FUNC-002    | Edit an existing member’s details       | Navigate to edit page, modify fields, save.                              | Changes saved; member data updated.          |
| FUNC-003    | Delete a member                          | Select member, confirm deletion.                                          | Member removed; confirmation dialog appears. |

#### **Authentication & Authorization**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| FUNC-004    | Successful login with valid credentials  | Enter correct email/password, submit.                                    | Redirect to dashboard; session created.      |
| FUNC-005    | Logout functionality                     | Click logout button.                                                      | Redirect to login; session destroyed.       |
| FUNC-006    | Role-based access (Admin vs. User)       | Admin creates a member; User cannot delete.                              | Admin: Success; User: "Permission denied".   |

#### **Realtime Updates (Supabase Realtime)**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| FUNC-007    | Real-time member list updates            | Add a member; verify UI updates instantly.                                | List refreshes without manual reload.       |
| FUNC-008    | Conflict resolution in realtime         | Two users edit same member simultaneously.                               | Last write wins or merge dialog appears.     |

---

### **2.2. Negative Test Cases**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| NEG-001     | Add member with invalid email format     | Submit form with `invalid-email@`.                                        | Error: "Invalid email format".              |
| NEG-002     | Delete non-existent member               | Attempt to delete member with ID `999`.                                   | Error: "Member not found".                  |
| NEG-003     | Login with wrong credentials             | Enter incorrect password.                                                | Error: "Invalid credentials".               |
| NEG-004     | Supabase auth token expiration           | Manually expire token; retry login.                                      | Redirect to login; refresh token prompt.    |

---

### **2.3. Edge Cases**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| EDGE-001    | Add member with empty name               | Submit form with `name: ""`.                                             | Error: "Name is required".                  |
| EDGE-002    | Bulk import 10,000 members               | Upload CSV with 10,000 rows.                                               | Success; partial failures logged.           |
| EDGE-003    | Network failure during realtime sync     | Simulate offline mode; reconnect.                                         | Queue updates; sync on reconnect.           |
| EDGE-004    | Concurrent realtime conflicts            | Two users edit same field; resolve conflict.                             | Merge dialog or last-write-wins.            |

---

### **2.4. Business Logic Tests**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| BUS-001     | Child member must have at least 1 parent | Add child without parents.                                                | Error: "At least one parent required".      |
| BUS-002     | Member status transitions                | New → Active → Inactive → Deleted.                                       | Status updates reflect in UI/database.       |
| BUS-003     | Age validation for minors               | Set age < 18; attempt to add.                                             | Error: "Minors require guardian approval".   |

---

## **3. Unit Test Scenarios**
### **3.1. Function/Method Testing**
#### **Example: `AddChildMember` Component**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| UNIT-001    | Validate `removeParent` logic           | Call `removeParent(id)`; verify state update.                           | Parent removed from `parents` array.         |
| UNIT-002    | Test `pendingRemovalId` state            | Set `pendingRemovalId = "123"`; verify UI shows loading state.           | Loading spinner appears for parent `123`.    |
| UNIT-003    | Mock API call on `onSave`                | Mock `api.post`; call `onSave(child)`.                                   | API call succeeds; child saved to DB.        |

#### **Mocking External Dependencies**
- **Supabase Client**: Mock `supabase.from('members').insert()`.
- **React Hooks**: Mock `useState`, `useEffect` for async operations.

---

### **3.2. Code Coverage Targets**
| **Component/File**               | **Target Coverage** | **Notes**                                  |
|----------------------------------|---------------------|--------------------------------------------|
| `AddChildMember.tsx`             | 90%                 | Critical: form validation, API calls.      |
| `api.ts` (Supabase wrapper)      | 100%                | Core logic for DB operations.              |
| `Children.ts` (Type definitions)| 80%                 | Ensure types align with Supabase schema.   |
| Utility functions (e.g., `clamp`) | 100%               | Pure functions; easy to test.              |

---

## **4. Integration Test Scenarios**
### **4.1. API Integration**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| INT-001     | Supabase `POST /members`                 | Send valid member data; verify response.                                  | Status 201; `id` returned.                  |
| INT-002     | Supabase `GET /members` with filters      | Query with `status=active`.                                               | Returns only active members.                |
| INT-003     | Real-time channel subscription            | Subscribe to `members` channel; emit event.                               | Client receives update via WebSocket.        |

#### **Mocking Supabase for Integration Tests**
```typescript
// Example: Mock Supabase in Jest
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [] }),
      insert: jest.fn().mockResolvedValue({ data: { id: '123' } }),
    }),
    realtime: {
      subscribe: jest.fn(),
      on: jest.fn(),
    },
  }),
}));
```

---

### **4.2. Database Integration**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| INT-004     | CRUD operations (Create-Read-Update-Delete) | Perform full cycle on a test member. | Data persists; transactions atomic.       |
| INT-005     | Transaction rollback on error            | Insert invalid data; verify rollback.                                    | No partial updates; error logged.            |
| INT-006     | Supabase Row Level Security (RLS)         | Test `select()` with RLS policies.                                       | Only authorized data returned.              |

---

## **5. End-to-End (E2E) Test Scenarios**
### **5.1. User Journey Testing**
#### **Scenario: Add a Child Member**
| **Test ID** | **Steps**                                                                 | **Expected Result**                          |
|-------------|---------------------------------------------------------------------------|----------------------------------------------|
| E2E-001     | 1. Navigate to "Add Child" page. <br> 2. Fill form (name, age, parents). <br> 3. Submit. | Success toast; member appears in list.      |
| E2E-002     | 1. Add child with invalid age (<1). <br> 2. Submit.                       | Error: "Age must be ≥1".                     |

#### **Tools**: Playwright/Cypress (for React/Vue).
```typescript
// Playwright Example
test('Add child member E2E', async ({ page }) => {
  await page.goto('/add-child');
  await page.fill('#name', 'John Doe');
  await page.fill('#age', '5');
  await page.selectOption('#parent', 'Parent ID');
  await page.click('#submit');
  await expect(page.locator('.success-toast')).toBeVisible();
});
```

---

### **5.2. Cross-Browser/Platform Testing**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| E2E-003     | Test on Chrome, Firefox, Safari          | Open app in each browser.                                                 | UI renders correctly; no layout breaks.      |
| E2E-004     | Mobile responsiveness (iOS/Android)       | Resize viewport; test touch interactions.                                | UI adapts; buttons accessible.               |

---

### **5.3. Data Flow Testing**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| E2E-005     | Data sync between frontend and Supabase   | Edit member in UI; verify DB update.                                      | DB reflects changes; realtime updates UI.    |
| E2E-006     | Offline mode (PWA)                       | Disable network; edit data; reconnect.                                   | Data saved locally; syncs on reconnect.       |

---

## **6. Performance Test Scenarios**
### **6.1. Load Testing**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| PERF-001    | 100 concurrent users                     | Simulate 100 users adding members.                                        | <500ms response time; no crashes.            |
| PERF-002    | Supabase API under load                  | Spawn 500 requests/sec to `/members`.                                    | <1s latency; no timeouts.                   |

#### **Tools**: k6, JMeter.
```javascript
// k6 Example
import http from 'k6/http';

export const options = {
  vus: 100,
  duration: '30s',
};

export default function () {
  const res = http.post('https://api.supabase.co/rest/v1/members', {
    name: 'Test User',
    age: 10,
  });
  check(res, { 'Status is 201': (r) => r.status === 201 });
}
```

---

### **6.2. Stress Testing**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| PERF-003    | 10,000 members bulk import              | Upload CSV with 10,000 rows.                                               | Completes in <10s; no memory leaks.         |
| PERF-004    | Real-time channel with 500 subscribers   | Simulate 500 clients subscribed.                                          | No lag; updates broadcasted to all.         |

---

## **7. Security Test Scenarios**
### **7.1. Authentication Testing**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| SEC-001     | JWT token validation                     | Intercept token; modify payload.                                          | Invalid token; 401 Unauthorized.            |
| SEC-002     | Brute-force protection                  | Attempt 100 failed logins.                                                | Account locked after 5 attempts.            |

---

### **7.2. Input Validation**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| SEC-003     | SQL injection attempt                   | Submit `' OR '1'='1`.                                                     | Rejected; sanitized input.                   |
| SEC-004     | XSS payload in member name               | Submit `<script>alert(1)</script>`.                                      | Escaped in UI; no execution.                 |

#### **Tools**: OWASP ZAP, Supabase security scanner.
```typescript
// Example: Test SQL injection in Jest
test('SQL injection prevention', async () => {
  const mockInsert = jest.fn().mockRejectedValue(new Error('SQL error'));
  SupabaseClient.prototype.from.mockReturnValue({
    insert: mockInsert,
  });

  await expect(
    addMember({ name: "O'Reilly'", age: 10 })
  ).rejects.toThrow('SQL error');
});
```

---

### **7.3. Data Security**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| SEC-005     | RLS policy enforcement                   | Query as non-admin user.                                                  | Only authorized data returned.              |
| SEC-006     | Encrypted sensitive fields              | Test `password_hash` field in DB.                                         | Hash matches expected format.                |

---

## **8. Error Handling & Recovery**
| **Test ID** | **Description**                          | **Steps**                                                                 | **Expected Result**                          |
|-------------|------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| ERR-001     | Network error during API call            | Mock `fetch` to fail.                                                    | User sees "Network error"; retry option.    |
| ERR-002     | Supabase auth error                      | Simulate token expiration.                                                | Redirect to login; refresh token prompt.    |
| ERR-003     | Database connection failure              | Mock Supabase to throw `PostgrestError`.                                 | Fallback UI; notify admin.                  |

---

## **9. Test Data Requirements**
### **9.1. Test Data Sets**
| **Data Type**       | **Volume** | **Example**                                  |
|--------------------|------------|---------------------------------------------|
| Members            | 100        | 50 active, 30 inactive, 20 deleted.         |
| Parents            | 50         | 20 with children, 30 without.              |
| Child-Parent Links | 80         | 1-4 parents per child.                      |
| Events             | 200        | Past/future; with/without attendees.        |

### **9.2. Mock Data Generation**
```typescript
// Example: Faker.js for test data
import { faker } from '@faker-js/faker';

const generateMember = () => ({
  id: faker.database.mongodbObjectId(),
  name: faker.person.fullName(),
  age: faker.number.int({ min: 1, max: 100 }),
  status: faker.helpers.arrayElement(['active', 'inactive', 'new']),
});
```

---

## **10. Test Automation Recommendations**
### **10.1. Automation Strategy**
| **Test Type**       | **Framework** | **Priority** | **Notes**                                  |
|--------------------|---------------|--------------|--------------------------------------------|
| Unit Tests         | Jest          | High         | 90%+ coverage for critical paths.         |
| Integration Tests  | Jest          | Medium       | Mock Supabase; test API contracts.         |
| E2E Tests          | Playwright    | High         | Cross-browser; mobile testing.             |
| Performance Tests   | k6            | Medium       | Load/stress scenarios.                     |
| Security Tests     | OWASP ZAP     | High         | Penetration testing; automated scans.     |

### **10.2. CI/CD Integration**
```yaml
# Example: GitHub Actions workflow
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run test:unit  # Jest
      - run: npm run test:e2e   # Playwright
      - run: npm run test:security  # OWASP ZAP
```

### **10.3. Maintenance Guidelines**
- **Update tests** when:
  - New features are added.
  - Breaking changes occur (e.g., Supabase API updates).
- **Refactor tests** if:
  - Duplication detected.
  - Mocks become overly complex.
- **Run tests** in CI for every commit.

---

## **11. Acceptance Criteria & Test Cases**
### **11.1. Example: Add Child Member**
| **Test ID** | **Description**                          | **Given**                                  | **When**                                   | **Then**                                  |
|-------------|------------------------------------------|-------------------------------------------|--------------------------------------------|-------------------------------------------|
| ACC-001     | Valid child added                        | User is logged in as admin.               | Fills form with valid data; submits.       | Child appears in list; success toast.     |
| ACC-002     | Invalid age rejected                     | User submits age `0`.                      | Form validation runs.                      | Error: "Age must be ≥1".                  |

### **11.2. Traceability Matrix**
| **Requirement**               | **Test ID** | **Status** |
|------------------------------|-------------|------------|
| Members can be added         | FUNC-001    | Pass       |
| Real-time updates work       | FUNC-007    | Pass       |
| SQL injection prevented      | SEC-003     | Pass       |
| Load handles 100 users       | PERF-001    | Pass       |

---

## **12. Risk-Based Testing**
| **Risk Level** | **Area**               | **Test ID Examples**               | **Mitigation**                          |
|----------------|------------------------|-------------------------------------|-----------------------------------------|
| **High**       | Authentication         | SEC-001, SEC-002                    | Penetration testing; rate limiting.      |
| **High**       | Data Integrity         | INT-004, INT-005                    | Transactions; rollback on error.         |
| **Medium**     | Performance            | PERF-001, PERF-003                  | Load testing; optimize queries.          |
| **Low**        | UI Layout              | E2E-003                             | Cross-browser testing.                  |

---

## **Appendices**
### **A. Test Environment Setup**
1. **Local**:
   ```bash
   npm install
   npm run dev
   ```
2. **Supabase Sandbox**:
   - Create a project in [Supabase Dashboard](https://app.supabase.com/).
   - Use `.env` for credentials:
     ```
     SUPABASE_URL=your-url
     SUPABASE_KEY=your-key
     ```

### **B. Test Data Scripts**
```typescript
// Example: Seed test data
import { supabase } from '@/services/api';

async function seedMembers() {
  const members = Array(100).fill().map(() => ({
    name: faker.person.fullName(),
    age: faker.number.int({ min: 1, max: 100 }),
    status: faker.helpers.arrayElement(['active', 'inactive']),
  }));
  await supabase.from('members').insert(members);
}
```

### **C. Test Coverage Report**
```bash
npm run test:coverage
```
**Target**: 90%+ for critical paths (e.g., `AddChildMember`).

---
**Final Notes**:
- **Prioritize**: Security, data integrity, and performance.
- **Automate**: Unit/integration tests in CI; E2E for critical flows.
- **Review**: Test results post-release to identify gaps.