(() => {
    const form = document.querySelector('form.form-horizontal');
    const usernameInput = form ? form.querySelector('#email') : null;
    const passwordInput = form ? form.querySelector('input[type="password"]') : null;
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const rememberInput = document.getElementById('remember-check');
    const googleButton = document.querySelector('.social-list-item.bg-danger');
    const passwordToggle = document.getElementById('password-addon');
    let alertBox = document.getElementById('loginAlert');

    const getReturnUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/')) {
            return returnUrl;
        }
        if (returnUrl) {
            try {
                const url = new URL(returnUrl);
                if (url.origin === window.location.origin) {
                    return url.pathname + url.search;
                }
            } catch (e) {}
        }
        return '/groups';
    };

    const redirectUrl = getReturnUrl();

    const ensureAlert = () => {
        if (alertBox || !form) return alertBox;
        alertBox = document.createElement('div');
        alertBox.id = 'loginAlert';
        alertBox.className = 'alert alert-danger mt-3 d-none';
        alertBox.setAttribute('role', 'status');
        alertBox.setAttribute('aria-live', 'polite');
        form.appendChild(alertBox);
        return alertBox;
    };

    const setAlert = (message, type = 'error') => {
        const box = ensureAlert();
        if (!box) return;
        box.textContent = message;
        box.classList.remove('d-none', 'alert-danger', 'alert-success');
        if (!message) {
            box.classList.add('d-none');
            return;
        }
        box.classList.add(type === 'success' ? 'alert-success' : 'alert-danger');
    };

    const isValidEmail = (value) => {
        if (!value || typeof value !== 'string') return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
    };

    const setSubmitting = (isSubmitting) => {
        if (!submitButton) return;
        submitButton.disabled = isSubmitting;
        submitButton.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
    };

    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
    };

    const refreshSession = async () => {
        const csrf = getCookie('csrf_token');
        const res = await fetch('/api/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf || ''
            }
        });
        return res.ok;
    };

    const checkSession = async () => {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                window.location.href = redirectUrl;
                return;
            }
            if (res.status === 401) {
                const refreshed = await refreshSession();
                if (refreshed) {
                    const retry = await fetch('/api/me');
                    if (retry.ok) {
                        window.location.href = redirectUrl;
                    }
                }
            }
        } catch (err) {
            setAlert('', 'error');
        }
    };

    const googleStatus = new URLSearchParams(window.location.search).get('google');
    if (googleStatus === 'missing') {
        setAlert('Google login is not configured yet.', 'error');
    } else if (googleStatus === 'conflict') {
        setAlert('There is already another account using this email or Google.', 'error');
    } else if (googleStatus === 'error') {
        setAlert('Could not sign in with Google. Please try again.', 'error');
    }

    if (googleButton) {
        googleButton.addEventListener('click', (event) => {
            event.preventDefault();
            setAlert('Redirecting to Google...', 'success');
            window.location.href = '/api/auth/google';
        });
    }

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const isHidden = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isHidden ? 'text' : 'password');
            passwordToggle.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
            const icon = passwordToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('mdi-eye-outline', !isHidden);
                icon.classList.toggle('mdi-eye-off-outline', isHidden);
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setAlert('');
            const emailValue = usernameInput ? usernameInput.value.trim() : '';
            const passwordValue = passwordInput ? passwordInput.value : '';

            if (!emailValue) {
                setAlert('Email is required.', 'error');
                return;
            }
            if (!isValidEmail(emailValue)) {
                setAlert('Please enter a valid email address.', 'error');
                return;
            }
            if (!passwordValue) {
                setAlert('Password is required.', 'error');
                return;
            }

            setSubmitting(true);
            const payload = {
                email: emailValue,
                password: passwordValue,
                remember: Boolean(rememberInput && rememberInput.checked)
            };

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    if (res.status === 403 && data.code === 'email_verification_required') {
                        window.location.href = `/email-verification?email=${encodeURIComponent(emailValue)}`;
                        return;
                    }
                    setAlert(data.error || 'Could not sign in. Please try again.', 'error');
                    setSubmitting(false);
                    return;
                }

                const data = await res.json().catch(() => ({}));
                if (data.twoFactorRequired) {
                    window.location.href = '/two-step-verification';
                    return;
                }

                setAlert('Signed in successfully. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 600);
            } catch (err) {
                setAlert('Connection error. Please try again.', 'error');
                setSubmitting(false);
            }
        });
    }

    checkSession();
})();
