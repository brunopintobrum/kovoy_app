(() => {
    const form = document.getElementById('resetForm');
    const alertBox = document.getElementById('resetAlert');
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const setAlert = (message, type = 'error') => {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.dataset.type = type;
        alertBox.style.display = message ? 'block' : 'none';
    };

    if (!token) {
        setAlert('Token nao encontrado. Solicite um novo link.', 'error');
        return;
    }

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setAlert('');
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());
            payload.token = token;

            try {
                const res = await fetch('/api/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setAlert(data.error || 'Nao foi possivel atualizar a senha.', 'error');
                    return;
                }

                setAlert('Senha atualizada. Redirecionando...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 700);
            } catch (err) {
                setAlert('Erro de conexao. Tente novamente.', 'error');
            }
        });
    }
})();
