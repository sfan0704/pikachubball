/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthPage from '../../../client/src/pages/AuthPage';

// Mock useAuth hook
const mockLogin = vi.fn();
vi.mock('../../../client/src/lib/auth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock window.location for Yahoo OAuth redirect
const originalLocation = window.location;
beforeEach(() => {
  // @ts-expect-error - intentionally deleting window.location for test
  delete window.location;
  window.location = { ...originalLocation, href: '' } as Location;
});

afterEach(() => {
  window.location = originalLocation;
});

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render page title', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByText('Yahoo Fantasy Basketball')).toBeInTheDocument();
    });

    it('should render description text', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByText(/Sign in with your Yahoo account/i)).toBeInTheDocument();
    });

    it('should render Yahoo login button', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByTestId('button-yahoo-login')).toBeInTheDocument();
      expect(screen.getByText('Continue with Yahoo')).toBeInTheDocument();
    });

    it('should render Admin Login toggle button', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByTestId('button-admin-toggle')).toBeInTheDocument();
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });

    it('should not show admin login form by default', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT - Admin form should be collapsed
      expect(screen.queryByTestId('input-username-admin')).not.toBeInTheDocument();
    });
  });

  describe('Yahoo login', () => {
    it('should redirect to Yahoo OAuth endpoint when clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT
      await user.click(screen.getByTestId('button-yahoo-login'));

      // ASSERT
      expect(window.location.href).toBe('/api/auth/yahoo');
    });
  });

  describe('admin login', () => {
    it('should show admin login form when toggle is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT
      await user.click(screen.getByTestId('button-admin-toggle'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('input-username-admin')).toBeInTheDocument();
        expect(screen.getByTestId('input-password-admin')).toBeInTheDocument();
        expect(screen.getByTestId('button-admin-login')).toBeInTheDocument();
      });
    });

    it('should call login with correct credentials on admin form submit', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(undefined);
      render(<AuthPage />);

      // ACT - Open admin login form
      await user.click(screen.getByTestId('button-admin-toggle'));

      // Fill and submit form
      await waitFor(() => {
        expect(screen.getByTestId('input-username-admin')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('input-username-admin'), 'adminuser');
      await user.type(screen.getByTestId('input-password-admin'), 'adminpassword');
      await user.click(screen.getByTestId('button-admin-login'));

      // ASSERT
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('adminuser', 'adminpassword');
      });
    });

    it('should show error toast on admin login failure', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));
      render(<AuthPage />);

      // ACT - Open admin login form
      await user.click(screen.getByTestId('button-admin-toggle'));

      // Fill and submit form
      await waitFor(() => {
        expect(screen.getByTestId('input-username-admin')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('input-username-admin'), 'adminuser');
      await user.type(screen.getByTestId('input-password-admin'), 'adminpassword');
      await user.click(screen.getByTestId('button-admin-login'));

      // ASSERT
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            variant: 'destructive',
          })
        );
      });
    });

    it('should show validation error for short username', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT - Open admin login form
      await user.click(screen.getByTestId('button-admin-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('input-username-admin')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('input-username-admin'), 'ab');
      await user.type(screen.getByTestId('input-password-admin'), 'testpassword');
      await user.click(screen.getByTestId('button-admin-login'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Username must be at least 3 characters/i)).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show validation error for short password', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT - Open admin login form
      await user.click(screen.getByTestId('button-admin-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('input-username-admin')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('input-username-admin'), 'testuser');
      await user.type(screen.getByTestId('input-password-admin'), 'short');
      await user.click(screen.getByTestId('button-admin-login'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('button states', () => {
    it('should show "Continue with Yahoo" text on Yahoo button', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByTestId('button-yahoo-login')).toHaveTextContent('Continue with Yahoo');
    });

    it('should show "Log In as Admin" text on admin login button', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT - Open admin login form
      await user.click(screen.getByTestId('button-admin-toggle'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('button-admin-login')).toHaveTextContent('Log In as Admin');
      });
    });
  });
});
