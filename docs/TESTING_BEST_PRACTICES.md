# Testing Best Practices & Patterns

This guide documents the testing patterns, best practices, and conventions used in this codebase. Follow these principles to write maintainable, reliable, and comprehensive tests.

---

## 📁 Test Organization

```
tests/
├── backend/
│   ├── fixtures/          ← Reusable test helpers and mocks
│   ├── integration/       ← Integration tests (full request/response)
│   └── unit/              ← Unit tests (isolated components)
│       ├── controllers/   ← Controller tests
│       ├── middleware/    ← Middleware tests
│       ├── services/      ← Service tests
│       └── utils/         ← Utility function tests
└── frontend/              ← Frontend component tests
```

---

## 🎯 Core Testing Principles

### 1. Arrange-Act-Assert (AAA) Pattern

**Always structure tests using the AAA pattern:**

```typescript
it('should do something', () => {
  // ARRANGE: Set up test data, mocks, and dependencies
  const input = 'test-data';
  const mockFn = vi.fn();
  
  // ACT: Execute the code under test
  const result = functionUnderTest(input, mockFn);
  
  // ASSERT: Verify the expected outcome
  expect(result).toBe('expected-value');
  expect(mockFn).toHaveBeenCalledWith(input);
});
```

**Why AAA?**
- ✅ Clear separation of concerns
- ✅ Easy to read and understand
- ✅ Consistent structure across all tests
- ✅ Makes it obvious what's being tested

**Example from this codebase:**
```typescript
it('should return user ID if authenticated', () => {
  // ARRANGE
  const user = createMockUser();
  mockReq = createAuthenticatedRequest(user) as Request;
  
  // ACT
  const userId = getAuthenticatedUserId(mockReq);
  
  // ASSERT
  expect(userId).toBe(user.id);
});
```

---

## 📋 Test Structure

### Test File Organization

```typescript
// 1. Imports
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { functionUnderTest } from '../../../server/path/to/module';
import { createMockRequest, createMockResponse } from '../../fixtures/test-helpers';

// 2. Mock dependencies (at top level, outside describe)
vi.mock('../../../server/path/to/dependency');

// 3. Test suite
describe('ModuleName', () => {
  // 4. Setup variables
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;
  
  // 5. beforeEach for common setup
  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });
  
  // 6. Test cases grouped by functionality
  describe('functionName', () => {
    it('should handle success case', () => {
      // ARRANGE
      // ACT
      // ASSERT
    });
    
    it('should handle error case', () => {
      // ARRANGE
      // ACT
      // ASSERT
    });
  });
});
```

---

## 🧪 Testing Different Layers

### 1. Controller Tests

**Purpose:** Test HTTP request/response handling, input validation, and service delegation.

**Characteristics:**
- ✅ Mock all dependencies (services, storage, auth)
- ✅ Test HTTP-specific concerns (status codes, response format)
- ✅ Test input validation and error handling
- ✅ Verify service calls with correct parameters
- ✅ Test authentication/authorization checks

**Example:**
```typescript
describe('authController', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe('signup', () => {
    it('should create a new user and return user without password', async () => {
      // ARRANGE
      const username = 'newuser';
      const password = 'password123';
      const hashedPassword = 'hashed-password';
      const newUser = createMockUser({ username, password: hashedPassword });
      
      mockReq.body = { username, password };
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.createUser).mockResolvedValue(newUser);
      vi.mocked(hashPassword).mockResolvedValue(hashedPassword);
      mockReq.login = vi.fn((user: any, callback: (err?: Error) => void) => {
        setTimeout(() => callback(), 0);
      }) as any;

      // ACT
      const handler = authController.signup as any;
      await handler(mockReq, mockRes, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      // ASSERT
      expect(storage.getUserByUsername).toHaveBeenCalledWith(username);
      expect(hashPassword).toHaveBeenCalledWith(password);
      expect(storage.createUser).toHaveBeenCalledWith({
        username,
        password: hashedPassword,
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        user: {
          id: newUser.id,
          username: newUser.username,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt,
        },
      });
    });

    it('should throw ConflictError if username already exists', async () => {
      // ARRANGE
      const username = 'existinguser';
      const existingUser = createMockUser({ username });
      mockReq.body = { username, password: 'password123' };
      vi.mocked(storage.getUserByUsername).mockResolvedValue(existingUser);

      // ACT
      const handler = authController.signup as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ConflictError);
      expect(storage.createUser).not.toHaveBeenCalled();
    });
  });
});
```

**Best Practices:**
- Use `asyncHandler` wrapped functions - test errors passed to `next()`
- Mock all external dependencies (storage, services, auth)
- Test both success and error paths
- Verify HTTP status codes and response formats
- Test input validation (empty strings, invalid types, etc.)

---

### 2. Service Tests

**Purpose:** Test business logic in isolation, without HTTP concerns.

**Characteristics:**
- ✅ Mock external dependencies (APIs, storage, other services)
- ✅ Test business rules and transformations
- ✅ Test error handling and edge cases
- ✅ No HTTP dependencies (`req`, `res`)
- ✅ Testable in isolation

**Example:**
```typescript
describe('league-service', () => {
  let mockMCPClient: ReturnType<typeof createMockMCPClient>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMCPClient = createMockMCPClient();
    await mockMCPClient.setCredentials('test-token', 'refresh-token', Date.now() + 3600000);
  });

  describe('getUserLeagues', () => {
    it('should return empty array if no leagues data', async () => {
      // ARRANGE
      const emptyClient = createMockMCPClient();
      await emptyClient.setCredentials('test-token', 'refresh-token', Date.now() + 3600000);
      emptyClient.getUserLeagues = vi.fn().mockResolvedValue({
        fantasy_content: { users: null },
      }) as any;

      // ACT
      const leagues = await getUserLeagues(emptyClient as any);

      // ASSERT
      expect(leagues).toEqual([]);
    });

    it('should handle credential errors', async () => {
      // ARRANGE
      const errorClient = createMockMCPClient();
      await errorClient.setCredentials('test-token', 'refresh-token', Date.now() + 3600000);
      errorClient.getUserLeagues = vi.fn().mockRejectedValue(
        new Error('Yahoo Fantasy credentials expired or invalid')
      ) as any;

      // ACT & ASSERT
      await expect(getUserLeagues(errorClient as any)).rejects.toThrow(
        'Yahoo Fantasy credentials expired or invalid'
      );
    });
  });
});
```

**Best Practices:**
- Test business logic transformations
- Test error handling and edge cases
- Mock external API calls
- Test parallel operations (Promise.all)
- Verify data transformations and calculations

---

### 3. Middleware Tests

**Purpose:** Test Express middleware functions that handle cross-cutting concerns.

**Characteristics:**
- ✅ Test request/response modification
- ✅ Test `next()` calls (success and error paths)
- ✅ Test authentication/authorization logic
- ✅ Test error handling middleware

**Example:**
```typescript
describe('auth middleware', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe('requireAuth', () => {
    it('should call next() if user is authenticated', () => {
      // ARRANGE
      mockReq.isAuthenticated = vi.fn(() => true);

      // ACT
      requireAuth(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockReq.isAuthenticated).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      // ARRANGE
      mockReq.isAuthenticated = vi.fn(() => false);

      // ACT
      requireAuth(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockReq.isAuthenticated).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
```

**Best Practices:**
- Test both authenticated and unauthenticated paths
- Verify `next()` is called or not called appropriately
- Test error responses (status codes, error messages)
- Test request modification (adding properties to `req`)

---

### 4. Utility Tests

**Purpose:** Test small, pure helper functions.

**Characteristics:**
- ✅ Test pure functions (no side effects)
- ✅ Test edge cases (null, undefined, empty strings)
- ✅ Test input validation
- ✅ Simple, focused tests

**Example:**
```typescript
describe('weekParser', () => {
  describe('parseWeekParam', () => {
    it('should return undefined for empty input', () => {
      // ARRANGE & ACT
      const result = parseWeekParam(undefined);
      
      // ASSERT
      expect(result).toBeUndefined();
    });

    it('should parse valid week number', () => {
      // ARRANGE & ACT
      const result = parseWeekParam('5');
      
      // ASSERT
      expect(result).toBe(5);
    });

    it('should return undefined for invalid input', () => {
      // ARRANGE & ACT
      const result = parseWeekParam('invalid');
      
      // ASSERT
      expect(result).toBeUndefined();
    });
  });
});
```

**Best Practices:**
- Test all edge cases
- Test input validation
- Keep tests simple and focused
- Test both valid and invalid inputs

---

### 5. Integration Tests

**Purpose:** Test full request/response flow through the Express app.

**Characteristics:**
- ✅ Use Supertest for HTTP requests
- ✅ Test real Express app setup
- ✅ Test middleware chains
- ✅ Test database interactions (if applicable)
- ✅ Test authentication flows

**Example:**
```typescript
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';

describe('Visualization API Endpoints', () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }));
    
    // Register routes and middleware
    app.get('/api/viz/rankings', async (req, res) => {
      res.json({
        rankings: [],
        metadata: { scope: 'week', week: 1, currentWeek: 1, totalWeeks: 20 }
      });
    });
  });

  describe('GET /api/viz/rankings', () => {
    it('should return 200 and rankings data structure', async () => {
      // ARRANGE
      const leagueKey = 'test-league-key';
      
      // ACT
      const response = await request(app)
        .get('/api/viz/rankings')
        .query({ leagueKey });

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rankings');
      expect(response.body).toHaveProperty('metadata');
    });
  });
});
```

**Best Practices:**
- Use Supertest for HTTP testing
- Test full request/response cycle
- Test authentication and authorization
- Test error handling end-to-end
- Keep integration tests focused on critical paths

---

## 🎭 Mocking Strategies

### 1. Module Mocking

**Use `vi.mock()` at the top level to mock entire modules:**

```typescript
// Mock at top level, outside describe
vi.mock('../../../server/storage');
vi.mock('../../../server/config/auth');

describe('authController', () => {
  // Use vi.mocked() to get typed mocks
  beforeEach(() => {
    vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
  });
});
```

### 2. Function Mocking

**Use `vi.fn()` for individual function mocks:**

```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue(Promise.resolve('value'));
mockFn.mockRejectedValue(new Error('error'));
```

### 3. Mock Helpers

**Use test helpers for common mock objects:**

```typescript
// Use helpers from test-helpers.ts
const mockReq = createMockRequest() as Request;
const mockRes = createMockResponse() as Response;
const mockNext = createMockNext();
const mockUser = createMockUser({ username: 'testuser' });
const authenticatedReq = createAuthenticatedRequest(mockUser);
```

### 4. Partial Mocking

**Mock only what you need:**

```typescript
// Mock specific methods
vi.mocked(storage.getUserByUsername).mockResolvedValue(user);
vi.mocked(storage.createUser).mockResolvedValue(newUser);

// Leave other methods unmocked (they'll throw if called)
```

---

## ✅ Test Naming Conventions

### Test Descriptions

**Use descriptive test names that explain what is being tested:**

```typescript
// ✅ GOOD: Clear and descriptive
it('should return user ID if authenticated', () => {});
it('should throw ConflictError if username already exists', () => {});
it('should return empty array if no leagues data', () => {});

// ❌ BAD: Vague or unclear
it('works', () => {});
it('test 1', () => {});
it('should work correctly', () => {});
```

### Test Structure

**Group related tests using `describe` blocks:**

```typescript
describe('authController', () => {
  describe('signup', () => {
    it('should create a new user', () => {});
    it('should throw ConflictError if username exists', () => {});
    it('should validate input data', () => {});
  });
  
  describe('login', () => {
    it('should authenticate user', () => {});
    it('should return 401 for invalid credentials', () => {});
  });
});
```

---

## 🔧 Vitest-Specific Patterns

### 1. Setup and Teardown

```typescript
describe('MyTest', () => {
  // Runs once before all tests
  beforeAll(() => {
    // Setup that applies to all tests
  });
  
  // Runs before each test
  beforeEach(() => {
    vi.clearAllMocks(); // Important: clear mocks between tests
    // Setup for each test
  });
  
  // Runs after each test
  afterEach(() => {
    // Cleanup after each test
  });
  
  // Runs once after all tests
  afterAll(() => {
    // Final cleanup
  });
});
```

### 2. Async Testing

```typescript
// For async functions
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

// For promises that should reject
it('should throw error', async () => {
  await expect(asyncFunction()).rejects.toThrow('error message');
});
```

### 3. Mock Assertions

```typescript
// Verify function was called
expect(mockFn).toHaveBeenCalled();

// Verify function was called with specific arguments
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');

// Verify function was called N times
expect(mockFn).toHaveBeenCalledTimes(2);

// Verify function was not called
expect(mockFn).not.toHaveBeenCalled();

// Verify function returned specific value
expect(mockFn).toHaveReturnedWith('value');
```

### 4. Error Testing

```typescript
// Test that error is thrown
it('should throw error', () => {
  expect(() => functionUnderTest()).toThrow('error message');
});

// Test specific error type
it('should throw ValidationError', () => {
  expect(() => functionUnderTest()).toThrow(ValidationError);
});

// Test async errors
it('should reject promise', async () => {
  await expect(asyncFunction()).rejects.toThrow('error message');
});
```

---

## 📊 Test Coverage Guidelines

### What to Test

**✅ DO Test:**
- Business logic and calculations
- Error handling and edge cases
- Input validation
- Authentication and authorization
- Critical user flows
- Data transformations

**❌ DON'T Test:**
- Third-party library code
- Framework internals (Express, Vitest)
- Simple getters/setters without logic
- Code that's already tested elsewhere (avoid duplication)

### Coverage Goals

- **Controllers:** 80%+ coverage
- **Services:** 90%+ coverage (core business logic)
- **Middleware:** 80%+ coverage
- **Utils:** 100% coverage (small, critical functions)

---

## 🚫 Common Anti-Patterns

### ❌ Testing Implementation Details

```typescript
// ❌ BAD: Testing internal implementation
it('should call storage.getUserByUsername', () => {
  // This is too focused on HOW, not WHAT
});

// ✅ GOOD: Testing behavior
it('should return user if found', () => {
  // Focus on WHAT the function does
});
```

### ❌ Over-Mocking

```typescript
// ❌ BAD: Mocking everything
vi.mock('../../../server/storage');
vi.mock('../../../server/services');
vi.mock('../../../server/utils');
// Too many mocks = brittle tests

// ✅ GOOD: Mock only external dependencies
vi.mock('../../../server/storage'); // External dependency
// Don't mock internal utilities
```

### ❌ Test Interdependence

```typescript
// ❌ BAD: Tests depend on each other
let counter = 0;
it('should increment counter', () => {
  counter++;
  expect(counter).toBe(1);
});
it('should increment counter again', () => {
  counter++;
  expect(counter).toBe(2); // Depends on previous test
});

// ✅ GOOD: Tests are independent
it('should increment counter', () => {
  let counter = 0;
  counter++;
  expect(counter).toBe(1);
});
```

### ❌ Unclear Test Intent

```typescript
// ❌ BAD: Unclear what's being tested
it('test 1', () => {
  const result = doSomething();
  expect(result).toBeTruthy();
});

// ✅ GOOD: Clear intent
it('should return user object when user exists', () => {
  const user = getUserById('123');
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('username');
});
```

---

## 🎯 Decision Trees

### What Type of Test Should I Write?

**Is it testing a single function in isolation?**
- ✅ Yes → Unit test

**Is it testing HTTP request/response handling?**
- ✅ Yes → Controller test (unit test)

**Is it testing business logic without HTTP?**
- ✅ Yes → Service test (unit test)

**Is it testing Express middleware?**
- ✅ Yes → Middleware test (unit test)

**Is it testing the full request/response cycle?**
- ✅ Yes → Integration test

**Is it testing a small helper function?**
- ✅ Yes → Utility test (unit test)

---

### Where Should This Test Go?

**Is it testing a controller?**
- ✅ Yes → `tests/backend/unit/controllers/`

**Is it testing a service?**
- ✅ Yes → `tests/backend/unit/services/`

**Is it testing middleware?**
- ✅ Yes → `tests/backend/unit/middleware/`

**Is it testing a utility function?**
- ✅ Yes → `tests/backend/unit/utils/`

**Is it testing full API endpoints?**
- ✅ Yes → `tests/backend/integration/api/`

---

## 📝 Test Checklist

When writing a test, ensure:

- [ ] Test follows AAA pattern (Arrange-Act-Assert)
- [ ] Test has a descriptive name explaining what it tests
- [ ] All dependencies are properly mocked
- [ ] Test is independent (doesn't rely on other tests)
- [ ] Test covers both success and error paths
- [ ] Test verifies expected behavior, not implementation
- [ ] Test uses appropriate test helpers (`createMockRequest`, etc.)
- [ ] Mocks are cleared in `beforeEach`
- [ ] Async operations are properly awaited
- [ ] Assertions are clear and specific

---

## 🔄 Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/backend/unit/controllers/auth-controller.test.ts

# Run tests matching pattern
npm test -- --grep "authController"
```

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Arrange-Act-Assert Pattern](https://wiki.c2.com/?ArrangeActAssert)

---

## ✅ Summary

1. **Always use AAA pattern** - Arrange, Act, Assert
2. **Mock external dependencies** - Keep tests isolated
3. **Test behavior, not implementation** - Focus on WHAT, not HOW
4. **Write descriptive test names** - Make intent clear
5. **Keep tests independent** - No test should depend on another
6. **Test both success and error paths** - Cover edge cases
7. **Use test helpers** - Reuse common mock objects
8. **Clear mocks between tests** - Use `vi.clearAllMocks()` in `beforeEach`

This guide should be referenced when writing new tests or reviewing existing tests to ensure consistency and quality across the codebase.

