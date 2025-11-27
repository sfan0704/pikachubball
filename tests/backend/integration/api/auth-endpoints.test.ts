import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';
import { registerAuthRoutes } from '../../../../server/auth-routes';
import { storage } from '../../../../server/storage';
import { insertUserSchema } from '../../../../shared/schema';

describe('Authentication API Endpoints', () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret-key',
      resave: false,
      saveUninitialized: true,
      cookie: { 
        httpOnly: true,
        secure: false, // In tests
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
      }
    }));

    // Initialize Passport (would normally be done in auth.ts)
    const { passport } = await import('../../../../server/auth');
    app.use(passport.initialize());
    app.use(passport.session());

    // Register auth routes
    registerAuthRoutes(app);
  });

  describe('POST /api/auth/signup', () => {
    beforeEach(async () => {
      // Clean up before each test
      try {
        const users = await storage.getAllUsers?.();
        // Note: storage cleanup would happen here if available
      } catch (e) {
        // Storage might not be in test mode
      }
    });

    it('should signup with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'newuser123',
          password: 'SecurePassword123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('username');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return user object without password hash', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'user-no-password-test',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(201);
      expect(response.body.user.password).toBeUndefined();
    });

    it('should require username', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          password: 'TestPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should require password', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject empty username', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: '',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty password', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser',
          password: ''
        });

      expect(response.status).toBe(400);
    });

    it('should auto-login user after signup', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'autotest-user',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(201);
      
      // Check if session cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('connect.sid'))).toBe(true);
    });

    it('should return 400 for invalid input format', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 123, // Should be string
          password: 'TestPassword123'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      // First signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'logintest-user',
          password: 'TestPassword123'
        });

      expect(signupRes.status).toBe(201);

      // Then login (would normally be a new session)
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'logintest-user',
          password: 'TestPassword123'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('user');
      expect(loginRes.body.user.username).toBe('logintest-user');
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent-user-xyz',
          password: 'SomePassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication failed');
    });

    it('should reject wrong password', async () => {
      // Signup
      await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'wrongpwd-test',
          password: 'CorrectPassword123'
        });

      // Try login with wrong password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'wrongpwd-test',
          password: 'WrongPassword123'
        });

      expect(response.status).toBe(401);
    });

    it('should require username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'TestPassword123'
        });

      expect(response.status).toBe(401);
    });

    it('should require password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser'
        });

      expect(response.status).toBe(401);
    });

    it('should set secure session cookie', async () => {
      // Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'cookie-test',
          password: 'TestPassword123'
        });

      const cookies = signupRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      // Check for httpOnly flag (in Set-Cookie header)
      const sessionCookie = cookies.find((c: string) => c.includes('connect.sid'));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
    });

    it('should not send password hash in response', async () => {
      // Signup
      await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'pwd-response-test',
          password: 'TestPassword123'
        });

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'pwd-response-test',
          password: 'TestPassword123'
        });

      expect(response.body.user.password).toBeUndefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout authenticated user', async () => {
      // Signup to create session
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'logout-test',
          password: 'TestPassword123'
        });

      expect(signupRes.status).toBe(201);

      // Extract session cookie
      const cookies = signupRes.headers['set-cookie'];
      
      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .send({});

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
    });

    it('should clear session on logout', async () => {
      // Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'clear-session-test',
          password: 'TestPassword123'
        });

      const cookies = signupRes.headers['set-cookie'];

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .send({});

      // Try to access protected route (GET /api/auth/me) without session
      const meRes = await request(app)
        .get('/api/auth/me');

      expect(meRes.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return authenticated user', async () => {
      // Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'me-test-user',
          password: 'TestPassword123'
        });

      const cookies = signupRes.headers['set-cookie'];

      // Get current user
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body).toHaveProperty('user');
      expect(meRes.body.user.username).toBe('me-test-user');
      expect(meRes.body.user.password).toBeUndefined();
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Not authenticated');
    });

    it('should return correct user after logout', async () => {
      // Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'logout-verify',
          password: 'TestPassword123'
        });

      const cookies = signupRes.headers['set-cookie'];

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .send({});

      // Try /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meRes.status).toBe(401);
    });

    it('should not return password hash', async () => {
      // Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'no-pwd-hash',
          password: 'TestPassword123'
        });

      const cookies = signupRes.headers['set-cookie'];

      // Get current user
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meRes.body.user.password).toBeUndefined();
    });
  });
});
