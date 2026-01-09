(() => {
    const form = document.querySelector('form.needs-validation');
    const emailInput = form ? form.querySelector('#useremail') : null;
    const passwordInput = form ? form.querySelector('#userpassword') : null;
    const passwordToggle = document.getElementById('password-addon');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const strengthBar = document.getElementById('passwordStrengthBar');
    const strengthText = document.getElementById('passwordStrengthText');
    const rules = {
        length: document.getElementById('rule-length'),
        upper: document.getElementById('rule-upper'),
        lower: document.getElementById('rule-lower'),
        number: document.getElementById('rule-number'),
        special: document.getElementById('rule-special'),
        trim: document.getElementById('rule-trim'),
        common: document.getElementById('rule-common'),
        email: document.getElementById('rule-email'),
        confirm: null
    };
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

    const isValidEmail = (value) => {
        if (!value || typeof value !== 'string') return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
    };

    const setSubmitting = (isSubmitting) => {
        if (!submitButton) return;
        submitButton.disabled = isSubmitting;
        submitButton.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
    };

    const commonPasswords = [
        '123456', '12345678', 'password', 'qwerty', 'abc123',
        '111111', '123123', 'qwerty123', 'admin', 'letmein'
    ];

    const evaluatePassword = () => {
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const password = passwordInput ? passwordInput.value : '';
        const trimmed = password.trim();
        const hasLength = password.length >= 8 && password.length <= 64;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':",.<>/?\\|]/.test(password);
        const noTrimIssue = password === trimmed;
        const notCommon = password.length > 0
            ? !commonPasswords.some((item) => password.toLowerCase().includes(item))
            : false;
        const notEmail = email.length > 0
            ? password.toLowerCase() !== email
            : false;
        const confirmOk = true;

        const applyRule = (node, ok) => {
            if (!node) return;
            const label = node.textContent.replace(/^OK |^NO /, '');
            node.textContent = `${ok ? 'OK' : 'NO'} ${label}`;
        };

        applyRule(rules.length, hasLength);
        applyRule(rules.upper, hasUpper);
        applyRule(rules.lower, hasLower);
        applyRule(rules.number, hasNumber);
        applyRule(rules.special, hasSpecial);
        applyRule(rules.trim, noTrimIssue);
        applyRule(rules.common, notCommon);
        applyRule(rules.email, notEmail);

        let score = 0;
        if (hasUpper) score += 1;
        if (hasLower) score += 1;
        if (hasNumber) score += 1;
        if (hasSpecial) score += 1;
        if (password.length >= 12) score += 1;

        let strength = 'weak';
        let strengthClass = 'bg-danger';
        let percent = 25;
        let tip = 'Use a mix of character types to improve strength.';

        if (score >= 3 && hasLength) {
            strength = 'medium';
            strengthClass = 'bg-warning';
            percent = 60;
            tip = 'Use a longer password and mix more character types.';
        }
        if (score >= 4 && hasLength && notCommon && notEmail) {
            strength = 'strong';
            strengthClass = 'bg-success';
            percent = 100;
            tip = 'Good password.';
        }

        if (strengthBar) {
            strengthBar.classList.remove('bg-danger', 'bg-warning', 'bg-success');
            strengthBar.classList.add(strengthClass);
            strengthBar.style.width = `${percent}%`;
        }
        if (strengthText) {
            strengthText.textContent = `Strength: ${strength}. ${tip}`;
        }

        const valid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial && noTrimIssue && notCommon && notEmail && confirmOk;
        return { valid, message: tip };
    };

    const bindLiveValidation = () => {
        if (!form) return;
        const handler = () => evaluatePassword();
        if (emailInput) emailInput.addEventListener('input', handler);
        if (passwordInput) passwordInput.addEventListener('input', handler);
        handler();
    };

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setAlert('');
            const emailValue = emailInput ? emailInput.value.trim() : '';
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
            const { valid } = evaluatePassword();
            if (!valid) {
                setAlert('Password does not meet all requirements.', 'error');
                return;
            }
            setSubmitting(true);
            const payload = {
                email: emailValue,
                password: passwordValue
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
                    setSubmitting(false);
                    return;
                }

                setAlert('Account created successfully. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 700);
            } catch (err) {
                setAlert('Connection error. Please try again.', 'error');
                setSubmitting(false);
            }
        });
    }

    bindLiveValidation();

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
