(() => {
    const message = document.getElementById('emailVerificationMessage');
    const address = document.getElementById('emailVerificationAddress');
    const resend = document.getElementById('emailVerificationResend');
    const verifyButton = document.getElementById('emailVerificationButton');
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

    const resendEmail = async () => {
        const csrf = getCookie('csrf_token');
        await fetch('/api/email-verification/resend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrf || ''
            },
            body: JSON.stringify({ email })
        });
    };

    if (resend) {
        resend.addEventListener('click', async (event) => {
            event.preventDefault();
            resend.classList.add('disabled');

            try {
                await resendEmail();
                setMessage('We have resent the verification email to', true);
            } catch (err) {
                setMessage('Unable to resend the email right now. Please try again.');
            } finally {
                resend.classList.remove('disabled');
            }
        });
    }

    if (verifyButton) {
        verifyButton.addEventListener('click', async (event) => {
            event.preventDefault();
            verifyButton.classList.add('disabled');
            try {
                if (email) {
                    await resendEmail();
                    setMessage('We have resent the verification email to', true);
                } else {
                    setMessage('Please check your inbox and open the verification link.');
                }
            } catch (err) {
                setMessage('Unable to send the verification email right now. Please try again.');
            } finally {
                verifyButton.classList.remove('disabled');
            }
        });
    }
})();
