(() => {
    const form = document.getElementById('forgotForm');
    const alertBox = document.getElementById('forgotAlert');

    const setAlert = (message, type = 'success') => {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.dataset.type = type;
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

                const data = await res.json().catch(() => ({}));
                let message = 'Se o email existir, enviaremos um link de redefinicao.';
                if (data.token) {
                    message += ` Link de teste: /reset?token=${data.token}`;
                }
                setAlert(message, 'success');
            } catch (err) {
                setAlert('Erro de conexao. Tente novamente.', 'error');
            }
        });
    }
})();
