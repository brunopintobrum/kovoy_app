(() => {
    const form = document.getElementById('registerForm');
    const alertBox = document.getElementById('registerAlert');

    const setAlert = (message, type = 'error') => {
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
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setAlert(data.error || 'Nao foi possivel criar a conta.', 'error');
                    return;
                }

                setAlert('Conta criada com sucesso. Redirecionando...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 700);
            } catch (err) {
                setAlert('Erro de conexao. Tente novamente.', 'error');
            }
        });
    }
})();
