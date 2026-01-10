(() => {
    const message = document.getElementById('emailVerificationMessage');
    const address = document.getElementById('emailVerificationAddress');
    const resend = document.getElementById('emailVerificationResend');
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');

    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
    };

    const setMessage = (text, keepEmail) => {
        if (!message) return;
        if (keepEmail && address && email) {
            address.textContent = email;
            const nodes = message.childNodes;
            if (nodes[0] && nodes[0].nodeType === Node.TEXT_NODE) {
                nodes[0].textContent = `${text} `;
            }
            if (nodes[2] && nodes[2].nodeType === Node.TEXT_NODE) {
                nodes[2].textContent = '';
            }
            return;
        }
        message.textContent = text;
    };

    if (email && address) {
        address.textContent = email;
    }

    if (resend) {
        resend.addEventListener('click', async (event) => {
            event.preventDefault();
            resend.classList.add('disabled');
            const csrf = getCookie('csrf_token');

            try {
                await fetch('/api/email-verification/resend', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrf || ''
                    },
                    body: JSON.stringify({ email })
                });
                setMessage('We have resent the verification email to', true);
            } catch (err) {
                setMessage('Unable to resend the email right now. Please try again.');
            } finally {
                resend.classList.remove('disabled');
            }
        });
    }
})();
