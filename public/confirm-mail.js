(() => {
    const title = document.getElementById('confirmMailTitle');
    const message = document.getElementById('confirmMailMessage');
    const action = document.getElementById('confirmMailAction');
    const status = new URLSearchParams(window.location.search).get('status') || 'missing';

    const states = {
        success: {
            title: 'Success !',
            message: 'Your email has been verified successfully.',
            actionText: 'Back to Home',
            actionHref: '/login'
        },
        used: {
            title: 'Link already used',
            message: 'This verification link has already been used. Please sign in.',
            actionText: 'Go to Login',
            actionHref: '/login'
        },
        expired: {
            title: 'Link expired',
            message: 'This verification link has expired. Please request a new one.',
            actionText: 'Go to Login',
            actionHref: '/login'
        },
        invalid: {
            title: 'Invalid link',
            message: 'The verification link is invalid. Please request a new one.',
            actionText: 'Go to Login',
            actionHref: '/login'
        },
        missing: {
            title: 'Check your email',
            message: 'Please use the verification link that was sent to your email.',
            actionText: 'Go to Login',
            actionHref: '/login'
        }
    };

    const state = states[status] || states.missing;
    if (title) title.textContent = state.title;
    if (message) message.textContent = state.message;
    if (action) {
        action.textContent = state.actionText;
        action.setAttribute('href', state.actionHref);
    }
})();
