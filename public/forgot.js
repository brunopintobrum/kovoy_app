(() => {
    const form = document.getElementById('forgotForm');
    const alertBox = document.getElementById('forgotAlert');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;

    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
    };

    const setAlert = (message, type = 'success') => {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.classList.remove('alert-success', 'alert-danger');
        alertBox.classList.add(type === 'error' ? 'alert-danger' : 'alert-success');
        alertBox.style.display = message ? 'block' : 'none';
    };

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setAlert('');
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());

            try {
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.setAttribute('aria-busy', 'true');
                }
                const res = await fetch('/api/forgot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': getCookie('csrf_token') || ''
                    },
                    body: JSON.stringify(payload)
                });

                await res.json().catch(() => ({}));
                if (!res.ok) {
                    setAlert('Unable to send the email right now. Please try again.', 'error');
                    return;
                }
                setAlert('If the email exists, we will send you reset instructions.', 'success');
            } catch (err) {
                setAlert('Connection error. Please try again.', 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.setAttribute('aria-busy', 'false');
                }
            }
        });
    }
})();
