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
const mockSignup = vi.fn();
vi.mock('../../../client/src/lib/auth', () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
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

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render login and signup tabs', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByTestId('tab-login')).toBeInTheDocument();
      expect(screen.getByTestId('tab-signup')).toBeInTheDocument();
    });

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
      expect(screen.getByText('Sign in or create an account to get started')).toBeInTheDocument();
    });

    it('should show login form by default', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByTestId('input-username-login')).toBeInTheDocument();
      expect(screen.getByTestId('input-password-login')).toBeInTheDocument();
      expect(screen.getByTestId('button-login')).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('should switch to signup tab when clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT
      await user.click(screen.getByTestId('tab-signup'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('input-username-signup')).toBeInTheDocument();
        expect(screen.getByTestId('input-password-signup')).toBeInTheDocument();
        expect(screen.getByTestId('button-signup')).toBeInTheDocument();
      });
    });

    it('should switch back to login tab when clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT - Switch to signup then back to login
      await user.click(screen.getByTestId('tab-signup'));
      await user.click(screen.getByTestId('tab-login'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('input-username-login')).toBeInTheDocument();
        expect(screen.getByTestId('button-login')).toBeInTheDocument();
      });
    });
  });

  describe('login form', () => {
    it('should call login with correct credentials on submit', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockLogin.mockResolvedValue(undefined);
      render(<AuthPage />);

      // ACT
      await user.type(screen.getByTestId('input-username-login'), 'testuser');
      await user.type(screen.getByTestId('input-password-login'), 'testpassword');
      await user.click(screen.getByTestId('button-login'));

      // ASSERT
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpassword');
      });
    });

    it('should show error toast on login failure', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));
      render(<AuthPage />);

      // ACT
      await user.type(screen.getByTestId('input-username-login'), 'testuser');
      await user.type(screen.getByTestId('input-password-login'), 'testpassword');
      await user.click(screen.getByTestId('button-login'));

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

      // ACT
      await user.type(screen.getByTestId('input-username-login'), 'ab');
      await user.type(screen.getByTestId('input-password-login'), 'testpassword');
      await user.click(screen.getByTestId('button-login'));

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

      // ACT
      await user.type(screen.getByTestId('input-username-login'), 'testuser');
      await user.type(screen.getByTestId('input-password-login'), 'short');
      await user.click(screen.getByTestId('button-login'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('signup form', () => {
    it('should call signup with correct credentials on submit', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockSignup.mockResolvedValue(undefined);
      render(<AuthPage />);

      // ACT - Switch to signup tab
      await user.click(screen.getByTestId('tab-signup'));

      // Fill form
      await user.type(screen.getByTestId('input-username-signup'), 'newuser');
      await user.type(screen.getByTestId('input-password-signup'), 'newpassword');
      await user.click(screen.getByTestId('button-signup'));

      // ASSERT
      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalledWith('newuser', 'newpassword');
      });
    });

    it('should show success toast on signup success', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockSignup.mockResolvedValue(undefined);
      render(<AuthPage />);

      // ACT - Switch to signup tab
      await user.click(screen.getByTestId('tab-signup'));

      // Fill form and submit
      await user.type(screen.getByTestId('input-username-signup'), 'newuser');
      await user.type(screen.getByTestId('input-password-signup'), 'newpassword');
      await user.click(screen.getByTestId('button-signup'));

      // ASSERT
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success',
            description: 'Account created successfully',
          })
        );
      });
    });

    it('should show error toast on signup failure', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockSignup.mockRejectedValue(new Error('Username already exists'));
      render(<AuthPage />);

      // ACT - Switch to signup tab
      await user.click(screen.getByTestId('tab-signup'));

      // Fill form and submit
      await user.type(screen.getByTestId('input-username-signup'), 'existinguser');
      await user.type(screen.getByTestId('input-password-signup'), 'newpassword');
      await user.click(screen.getByTestId('button-signup'));

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
  });

  describe('button states', () => {
    it('should show "Log In" text on login button', () => {
      // ARRANGE & ACT
      render(<AuthPage />);

      // ASSERT
      expect(screen.getByTestId('button-login')).toHaveTextContent('Log In');
    });

    it('should show "Create Account" text on signup button', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AuthPage />);

      // ACT
      await user.click(screen.getByTestId('tab-signup'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('button-signup')).toHaveTextContent('Create Account');
      });
    });
  });
});
