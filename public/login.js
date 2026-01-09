(() => {
    const form = document.querySelector('form.form-horizontal');
    const usernameInput = form ? form.querySelector('#email') : null;
    const passwordInput = form ? form.querySelector('input[type="password"]') : null;
    const googleButton = document.querySelector('.social-list-item.bg-danger');
    const passwordToggle = document.getElementById('password-addon');
    let alertBox = document.getElementById('loginAlert');

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

    const checkSession = async () => {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                window.location.href = '/orlando.html';
            }
        } catch (err) {
            setAlert('', 'error');
        }
    };

    const googleStatus = new URLSearchParams(window.location.search).get('google');
    if (googleStatus === 'missing') {
        setAlert('Google login is not configured yet.', 'error');
    } else if (googleStatus === 'conflict') {
        setAlert('Ja existe outra conta com esse email ou Google conectado. Fale com o suporte.', 'error');
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
            const payload = {
                email: usernameInput ? usernameInput.value.trim() : '',
                password: passwordInput ? passwordInput.value : ''
            };

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setAlert(data.error || 'Could not sign in. Please try again.', 'error');
                    return;
                }

                setAlert('Signed in successfully. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = '/orlando.html';
                }, 600);
            } catch (err) {
                setAlert('Connection error. Please try again.', 'error');
            }
        });
    }

    checkSession();
})();
