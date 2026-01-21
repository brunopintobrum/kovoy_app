/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');
const { screen } = require('@testing-library/dom');
const userEvent = require('@testing-library/user-event').default;

const loadLoginDom = ({ search = '' } = {}) => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'login.html'), 'utf8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    document.body.innerHTML = doc.body.innerHTML;
    document.cookie = 'csrf_token=test-token';
    delete window.location;
    window.location = { href: '', search };
};

const mockFetch = (handlers) => {
    global.fetch = jest.fn((url, options) => {
        const handler = handlers.find((item) => item.match(url, options));
        if (!handler) {
            return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
        }
        return handler.handle(url, options);
    });
};

const setupLoginPage = (loginHandler) => {
    mockFetch([
        {
            match: (url) => url === '/api/me',
            handle: async () => ({ ok: false, status: 401, json: async () => ({}) })
        },
        {
            match: (url) => url === '/api/refresh',
            handle: async () => ({ ok: false, status: 401, json: async () => ({}) })
        },
        loginHandler
    ]);
    loadLoginDom();
    require('../public/login.js');
};

describe('Login page', () => {
    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = '';
        global.fetch = undefined;
    });

    test('renders required inputs and links', () => {
        setupLoginPage({
            match: () => true,
            handle: async () => ({ ok: false, status: 401, json: async () => ({}) })
        });

        expect(screen.getByLabelText('Email')).toBeTruthy();
        expect(screen.getByLabelText('Password')).toBeTruthy();
        expect(screen.getByRole('button', { name: /log in/i })).toBeTruthy();
        expect(screen.getByText(/forgot your password/i)).toBeTruthy();
    });

    test('validates empty submit', async () => {
        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async () => ({ ok: false, status: 401, json: async () => ({}) })
        });

        await userEvent.click(screen.getByRole('button', { name: /log in/i }));
        expect(screen.getByText('Email is required.')).toBeTruthy();
        expect(global.fetch).not.toHaveBeenCalledWith(
            '/api/login',
            expect.any(Object)
        );
    });

    test('validates invalid email', async () => {
        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async () => ({ ok: false, status: 401, json: async () => ({}) })
        });

        await userEvent.type(screen.getByLabelText('Email'), 'invalid-email');
        await userEvent.click(screen.getByRole('button', { name: /log in/i }));
        expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
    });

    test('validates missing password', async () => {
        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async () => ({ ok: false, status: 401, json: async () => ({}) })
        });

        await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
        await userEvent.click(screen.getByRole('button', { name: /log in/i }));
        expect(screen.getByText('Password is required.')).toBeTruthy();
    });

    test('submits payload with remember me', async () => {
        jest.useFakeTimers();
        let payload;
        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async (_url, options) => {
                payload = JSON.parse(options.body);
                return { ok: true, status: 200, json: async () => ({ ok: true }) };
            }
        });

        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await user.type(screen.getByLabelText('Email'), 'user@example.com');
        await user.type(screen.getByLabelText('Password'), 'Password123!');
        await user.click(screen.getByLabelText('Remember me'));
        await user.click(screen.getByRole('button', { name: /log in/i }));

        expect(payload).toMatchObject({
            email: 'user@example.com',
            password: 'Password123!',
            remember: true
        });

        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('shows error on invalid credentials (401)', async () => {
        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async () => ({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Invalid credentials.' })
            })
        });

        await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
        await userEvent.type(screen.getByLabelText('Password'), 'Password123!');
        await userEvent.click(screen.getByRole('button', { name: /log in/i }));

        expect(screen.getByText('Invalid credentials.')).toBeTruthy();
    });

    test('disables submit while request is pending', async () => {
        jest.useFakeTimers();
        let resolveLogin;
        const pending = new Promise((resolve) => {
            resolveLogin = resolve;
        });

        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async () => {
                await pending;
                return { ok: true, status: 200, json: async () => ({ ok: true }) };
            }
        });

        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await user.type(screen.getByLabelText('Email'), 'user@example.com');
        await user.type(screen.getByLabelText('Password'), 'Password123!');

        const submit = screen.getByRole('button', { name: /log in/i });
        await user.click(submit);
        expect(submit.disabled).toBe(true);

        resolveLogin();
        await Promise.resolve();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('redirects to email verification on 403', async () => {
        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async () => ({
                ok: false,
                status: 403,
                json: async () => ({ code: 'email_verification_required' })
            })
        });

        await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
        await userEvent.type(screen.getByLabelText('Password'), 'Password123!');
        await userEvent.click(screen.getByRole('button', { name: /log in/i }));

        expect(window.location.href).toBe('/email-verification?email=user%40example.com');
    });

    test('toggles password visibility', async () => {
        setupLoginPage({
            match: (url) => url === '/api/login',
            handle: async () => ({ ok: false, status: 401, json: async () => ({}) })
        });

        const passwordInput = screen.getByLabelText('Password');
        const toggle = document.getElementById('password-addon');
        expect(passwordInput.getAttribute('type')).toBe('password');

        await userEvent.click(toggle);
        expect(passwordInput.getAttribute('type')).toBe('text');
    });
});
