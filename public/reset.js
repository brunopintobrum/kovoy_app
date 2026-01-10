(() => {
    const form = document.getElementById('resetForm');
    const alertBox = document.getElementById('resetAlert');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const setAlert = (message, type = 'error') => {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.classList.remove('alert-success', 'alert-danger');
        alertBox.classList.add(type === 'error' ? 'alert-danger' : 'alert-success');
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
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('aria-busy', 'true');
            }
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
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.setAttribute('aria-busy', 'false');
            }
        }
    });
}
})();
