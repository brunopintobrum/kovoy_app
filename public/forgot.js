(() => {
    const form = document.getElementById('forgotForm');
    const alertBox = document.getElementById('forgotAlert');

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
                const res = await fetch('/api/forgot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                await res.json().catch(() => ({}));
                setAlert('If the email exists, we will send you reset instructions.', 'success');
            } catch (err) {
                setAlert('Connection error. Please try again.', 'error');
            }
        });
    }
})();
