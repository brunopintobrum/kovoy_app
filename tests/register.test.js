/* Targets:
 * - public/register.html
 * - public/register.js
 */
const { screen } = require('@testing-library/dom');
const userEvent = require('@testing-library/user-event').default;
const { loadPage, resetLocation } = require('./test-utils');

const setupRegister = () => {
  jest.resetModules();
  loadPage('public/register.html');
  resetLocation();
  global.fetch = jest.fn();
  require('../public/register.js');
  global.fetch.mockClear();
};

describe('Register page', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('renders email, password and submit button', () => {
    setupRegister();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /register/i })).toBeTruthy();
  });

  test('empty submit shows error and does not call register', async () => {
    setupRegister();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/email is required/i);
  });

  test('invalid email shows error and does not call register', async () => {
    setupRegister();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'invalid');
    await user.type(screen.getByLabelText(/^password$/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /register/i }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/valid email address/i);
  });

  test('password rule failure shows error and checklist updates', async () => {
    setupRegister();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'short');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/does not meet all requirements/i);
    expect(screen.getByText(/NO 8 to 64 characters/i)).toBeTruthy();
  });

  test('strong password updates strength indicator', async () => {
    setupRegister();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Abcdef1!');

    expect(screen.getByText(/strength: strong/i)).toBeTruthy();
    expect(document.getElementById('rule-upper').textContent).toMatch(/^OK /);
  });

  test('submits valid register and redirects on success', async () => {
    jest.useFakeTimers();
    setupRegister();
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.type(screen.getByLabelText(/email/i), ' user@example.com ');
    await user.type(screen.getByLabelText(/^password$/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(global.fetch).toHaveBeenCalledWith('/api/register', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'Abcdef1!' })
    }));

    jest.runAllTimers();
    expect(window.location.href).toBe('/login');
    jest.useRealTimers();
  });

  test('shows API error message on email conflict', async () => {
    setupRegister();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Email already registered.' })
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByRole('status').textContent).toMatch(/already registered/i);
  });

  test('shows generic error on network failure', async () => {
    setupRegister();
    global.fetch.mockRejectedValueOnce(new Error('Network down'));
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByRole('status').textContent).toMatch(/connection error/i);
  });

  test('disables submit button while request is in flight', async () => {
    setupRegister();
    let resolveFetch;
    global.fetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Abcdef1!');
    const submitButton = screen.getByRole('button', { name: /register/i });
    await user.click(submitButton);

    expect(submitButton.disabled).toBe(true);
    resolveFetch({ ok: false, json: async () => ({ error: 'Email already registered.' }) });
  });

  test('toggles password visibility', async () => {
    setupRegister();
    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText(/^password$/i);
    const toggle = document.getElementById('password-addon');

    expect(passwordInput.getAttribute('type')).toBe('password');
    await user.click(toggle);
    expect(passwordInput.getAttribute('type')).toBe('text');
  });
});
