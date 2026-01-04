(() => {
    const form = document.getElementById('loginForm');
    const alertBox = document.getElementById('loginAlert');
    const googleButton = document.getElementById('googleLogin');

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

    const googleStatus = new URLSearchParams(window.location.search).get('google');
    if (googleStatus === 'missing') {
        setAlert('Login com Google ainda nao foi configurado.', 'error');
    } else if (googleStatus === 'conflict') {
        setAlert('Ja existe outra conta com esse email ou Google conectado. Fale com o suporte.', 'error');
    } else if (googleStatus === 'error') {
        setAlert('Nao foi possivel entrar com o Google. Tente novamente.', 'error');
    }

    if (googleButton) {
        googleButton.addEventListener('click', () => {
            googleButton.disabled = true;
            googleButton.setAttribute('aria-busy', 'true');
            setAlert('Redirecionando para o Google...', 'success');
            window.location.href = '/api/auth/google';
        });
    }

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
