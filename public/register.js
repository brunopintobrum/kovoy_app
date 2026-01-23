(() => {
    const form = document.querySelector('form.needs-validation');
    const emailInput = form ? form.querySelector('#useremail') : null;
    const firstNameInput = form ? form.querySelector('#firstname') : null;
    const lastNameInput = form ? form.querySelector('#lastname') : null;
    const passwordInput = form ? form.querySelector('#userpassword') : null;
    const confirmPasswordInput = form ? form.querySelector('#userpasswordconfirm') : null;
    const passwordToggle = document.getElementById('password-addon');
    const confirmPasswordToggle = document.getElementById('password-confirm-addon');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const strengthBar = document.getElementById('passwordStrengthBar');
    const strengthText = document.getElementById('passwordStrengthText');
    const rules = {
        length: document.getElementById('rule-length'),
        upper: document.getElementById('rule-upper'),
        lower: document.getElementById('rule-lower'),
        number: document.getElementById('rule-number'),
        special: document.getElementById('rule-special')
    };
    const ruleLabels = {
        length: rules.length ? rules.length.textContent.trim() : '',
        upper: rules.upper ? rules.upper.textContent.trim() : '',
        lower: rules.lower ? rules.lower.textContent.trim() : '',
        number: rules.number ? rules.number.textContent.trim() : '',
        special: rules.special ? rules.special.textContent.trim() : ''
    };
    let alertBox = document.getElementById('registerAlert');
    const googleButton = document.querySelector('.social-list-item.bg-danger');

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

    const isValidEmail = (value) => {
        if (!value || typeof value !== 'string') return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
    };

    const setSubmitting = (isSubmitting) => {
        if (!submitButton) return;
        submitButton.disabled = isSubmitting;
        submitButton.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
    };

    const evaluatePassword = () => {
        const password = passwordInput ? passwordInput.value : '';
        const hasInput = password.length > 0;
        const hasLength = password.length >= 9;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':",.<>/?\\|]/.test(password);

        const applyRule = (node, key, ok) => {
            if (!node) return;
            if (!hasInput) {
                node.textContent = ruleLabels[key] || node.textContent.replace(/^OK |^NO /, '');
                return;
            }
            const label = ruleLabels[key] || node.textContent.replace(/^OK |^NO /, '');
            node.textContent = `${ok ? 'OK' : 'NO'} ${label}`;
        };

        applyRule(rules.length, 'length', hasLength);
        applyRule(rules.upper, 'upper', hasUpper);
        applyRule(rules.lower, 'lower', hasLower);
        applyRule(rules.number, 'number', hasNumber);
        applyRule(rules.special, 'special', hasSpecial);
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
        if (score >= 4 && hasLength) {
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

        const valid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
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
            const firstNameValue = firstNameInput ? firstNameInput.value.trim() : '';
            const lastNameValue = lastNameInput ? lastNameInput.value.trim() : '';
            const passwordValue = passwordInput ? passwordInput.value : '';
            const confirmPasswordValue = confirmPasswordInput ? confirmPasswordInput.value : '';

            if (!emailValue) {
                setAlert('Email is required.', 'error');
                return;
            }
            if (!isValidEmail(emailValue)) {
                setAlert('Please enter a valid email address.', 'error');
                return;
            }
            if (!firstNameValue) {
                setAlert('First name is required.', 'error');
                return;
            }
            if (firstNameValue.length > 80) {
                setAlert('First name must be 80 characters or fewer.', 'error');
                return;
            }
            if (!lastNameValue) {
                setAlert('Last name is required.', 'error');
                return;
            }
            if (lastNameValue.length > 80) {
                setAlert('Last name must be 80 characters or fewer.', 'error');
                return;
            }
            if (!passwordValue) {
                setAlert('Password is required.', 'error');
                return;
            }
            if (!confirmPasswordValue) {
                setAlert('Confirm password is required.', 'error');
                return;
            }
            if (passwordValue !== confirmPasswordValue) {
                setAlert('Passwords do not match.', 'error');
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
                firstName: firstNameValue,
                lastName: lastNameValue,
                password: passwordValue,
                confirmPassword: confirmPasswordValue
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

                const data = await res.json().catch(() => ({}));
                setAlert('Account created successfully. Redirecting...', 'success');
                setTimeout(() => {
                    if (data.emailVerificationRequired) {
                        window.location.href = `/email-verification?email=${encodeURIComponent(emailValue)}`;
                        return;
                    }
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

    if (confirmPasswordToggle && confirmPasswordInput) {
        confirmPasswordToggle.addEventListener('click', () => {
            const isHidden = confirmPasswordInput.getAttribute('type') === 'password';
            confirmPasswordInput.setAttribute('type', isHidden ? 'text' : 'password');
            confirmPasswordToggle.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
            const icon = confirmPasswordToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('mdi-eye-outline', !isHidden);
                icon.classList.toggle('mdi-eye-off-outline', isHidden);
            }
        });
    }
})();
