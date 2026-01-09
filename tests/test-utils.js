const fs = require('fs');
const path = require('path');

const loadPage = (relativePath) => {
  const html = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
};

const resetLocation = () => {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true
  });
};

module.exports = { loadPage, resetLocation };
