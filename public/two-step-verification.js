(() => {
    const form = document.getElementById('twoStepForm');
    const confirmButton = document.getElementById('twoStepConfirm');
    const resend = document.getElementById('twoStepResend');
    const message = document.getElementById('twoStepMessage');
    const digits = [
        document.getElementById('digit1-input'),
        document.getElementById('digit2-input'),
        document.getElementById('digit3-input'),
        document.getElementById('digit4-input')
    ];

    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
    };

    const setMessage = (text) => {
        if (!message) return;
        message.textContent = text;
    };

    const getCode = () => digits.map((input) => (input ? input.value.trim() : '')).join('');

    const setDisabled = (disabled) => {
        if (confirmButton) {
            confirmButton.classList.toggle('disabled', disabled);
            confirmButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        }
    };

    const submitCode = async () => {
        const code = getCode();
        if (!/^\d{4}$/.test(code)) {
            setMessage('Please enter the 4 digit code.');
            return;
        }

        setDisabled(true);
        const csrf = getCookie('csrf_token');
        try {
            const res = await fetch('/api/two-step/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrf || ''
                },
                body: JSON.stringify({ code })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setMessage(data.error || 'Invalid verification code.');
                setDisabled(false);
                return;
            }

            window.location.href = '/groups';
        } catch (err) {
            setMessage('Unable to verify the code. Please try again.');
            setDisabled(false);
        }
    };

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            submitCode();
        });
    }

    if (confirmButton) {
        confirmButton.addEventListener('click', (event) => {
            event.preventDefault();
            submitCode();
        });
    }

    if (resend) {
        resend.addEventListener('click', async (event) => {
            event.preventDefault();
            resend.classList.add('disabled');
            const csrf = getCookie('csrf_token');
            try {
                await fetch('/api/two-step/resend', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrf || ''
                    }
                });
                setMessage('We have resent your verification code.');
            } catch (err) {
                setMessage('Unable to resend the code. Please try again.');
            } finally {
                resend.classList.remove('disabled');
            }
        });
    }
})();
