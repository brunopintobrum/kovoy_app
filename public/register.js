(() => {
    const form = document.querySelector('form.needs-validation');
    const emailInput = form ? form.querySelector('#useremail') : null;
    const passwordInput = form ? form.querySelector('#userpassword') : null;
    const passwordToggle = document.getElementById('password-addon');
    let alertBox = document.getElementById('registerAlert');

    const ensureAlert = () => {
        if (alertBox || !form) return alertBox;
        alertBox = document.createElement('div');
        alertBox.id = 'registerAlert';
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

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setAlert('');
            const payload = {
                email: emailInput ? emailInput.value.trim() : '',
                password: passwordInput ? passwordInput.value : ''
            };

            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setAlert(data.error || 'Could not create the account.', 'error');
                    return;
                }

                setAlert('Account created successfully. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 700);
            } catch (err) {
                setAlert('Connection error. Please try again.', 'error');
            }
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
})();
