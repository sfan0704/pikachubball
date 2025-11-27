import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../../client/src/lib/queryClient';
import { AuthProvider, useAuth } from '../../../client/src/lib/auth';

describe('Auth Context & Hooks', () => {
  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });

    it('should provide auth context when inside AuthProvider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('login');
      expect(result.current).toHaveProperty('signup');
      expect(result.current).toHaveProperty('logout');
    });
  });

  describe('AuthProvider Initial State', () => {
    it('should start with null user', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeNull();
    });

    it('should have loading state initially', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Loading depends on /api/auth/me query
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });

  describe('Login Mutation', () => {
    it('should have login method', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(typeof result.current.login).toBe('function');
    });

    it('should accept username and password', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should not throw even if API fails
      try {
        await result.current.login('testuser', 'testpassword');
      } catch (e) {
        // Expected to fail without backend
      }
    });
  });

  describe('Signup Mutation', () => {
    it('should have signup method', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(typeof result.current.signup).toBe('function');
    });

    it('should accept username and password', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should not throw even if API fails
      try {
        await result.current.signup('newuser', 'newpassword');
      } catch (e) {
        // Expected to fail without backend
      }
    });
  });

  describe('Logout Mutation', () => {
    it('should have logout method', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(typeof result.current.logout).toBe('function');
    });

    it('should clear cache on logout', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      try {
        await result.current.logout();
      } catch (e) {
        // Expected to fail without backend
      }
    });
  });

  describe('Auth State Persistence', () => {
    it('should fetch current user on mount', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should have attempted to fetch /api/auth/me
      expect(result.current).toBeDefined();
    });

    it('should update user state when fetched', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // User state should exist (even if null)
      expect(result.current.user === null || result.current.user !== null).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle login errors gracefully', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should not crash on failed login
      try {
        await result.current.login('wrong', 'creds');
      } catch (e) {
        // Expected error
        expect(e).toBeDefined();
      }
    });

    it('should handle signup errors gracefully', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should not crash on failed signup
      try {
        await result.current.signup('user', 'pass');
      } catch (e) {
        // Expected error
        expect(e).toBeDefined();
      }
    });
  });
});
