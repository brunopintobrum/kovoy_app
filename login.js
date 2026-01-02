(() => {
    const form = document.getElementById('loginForm');
    const alertBox = document.getElementById('loginAlert');

    const setAlert = (message, type = 'error') => {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.dataset.type = type;
        alertBox.style.display = message ? 'block' : 'none';
    };

    const checkSession = async () => {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                window.location.href = '/orlando.html';
            }
        } catch (err) {
            setAlert('', 'error');
        }
    };

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setAlert('');
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setAlert(data.error || 'Nao foi possivel entrar. Tente novamente.', 'error');
                    return;
                }

                setAlert('Login realizado com sucesso. Redirecionando...', 'success');
                setTimeout(() => {
                    window.location.href = '/orlando.html';
                }, 600);
            } catch (err) {
                setAlert('Erro de conexao. Tente novamente.', 'error');
            }
        });
    }

    checkSession();
})();
