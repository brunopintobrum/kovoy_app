/* Targets:
 * - public/login.html
 * - public/login.js
 */
const { screen } = require('@testing-library/dom');
const userEvent = require('@testing-library/user-event').default;
const { loadPage, resetLocation } = require('./test-utils');

const setupLogin = () => {
  jest.resetModules();
  loadPage('public/login.html');
  resetLocation();
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({})
  });
  require('../public/login.js');
  global.fetch.mockClear();
};

describe('Login page', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('renders email and password fields and submit button', () => {
    setupLogin();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /log in/i })).toBeTruthy();
  });

  test('empty submit shows error and does not call login', async () => {
    setupLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(document.getElementById('loginAlert').textContent).toMatch(/email is required/i);
  });

  test('invalid email shows error and does not call login', async () => {
    setupLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(document.getElementById('loginAlert').textContent).toMatch(/valid email address/i);
  });

  test('submits valid login and redirects on success', async () => {
    jest.useFakeTimers();
    setupLogin();
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.type(screen.getByLabelText(/email/i), ' user@example.com ');
    await user.type(screen.getByLabelText(/password/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(global.fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'Abcdef1!' })
    }));

    jest.runAllTimers();
    expect(window.location.href).toBe('/orlando.html');
    jest.useRealTimers();
  });

  test('shows API error message on 401', async () => {
    setupLogin();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials.' })
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(document.getElementById('loginAlert').textContent).toMatch(/invalid credentials/i);
  });

  test('shows generic error on network failure', async () => {
    setupLogin();
    global.fetch.mockRejectedValueOnce(new Error('Network down'));
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(document.getElementById('loginAlert').textContent).toMatch(/connection error/i);
  });

  test('disables submit button while request is in flight', async () => {
    setupLogin();
    let resolveFetch;
    global.fetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Abcdef1!');
    const submitButton = screen.getByRole('button', { name: /log in/i });
    await user.click(submitButton);

    expect(submitButton.disabled).toBe(true);
    resolveFetch({ ok: false, json: async () => ({ error: 'Invalid credentials.' }) });
  });

  test('toggles password visibility', async () => {
    setupLogin();
    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText(/password/i);
    const toggle = document.getElementById('password-addon');

    expect(passwordInput.getAttribute('type')).toBe('password');
    await user.click(toggle);
    expect(passwordInput.getAttribute('type')).toBe('text');
    await user.click(toggle);
    expect(passwordInput.getAttribute('type')).toBe('password');
  });
});
