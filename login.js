window.addEventListener('DOMContentLoaded', () => {
  const loginPage  = document.querySelector('.login-page');
  const appRoot    = document.querySelector('#app-root');
  const loginButton = document.querySelector('.login-button');

  if (!loginPage || !appRoot || !loginButton) {
    console.warn('Login-Layout nicht vollständig gefunden.');
    return;
  }

  loginButton.addEventListener('click', () => {
    // Login-Screen entfernen
    loginPage.remove();               // oder: loginPage.style.display = 'none';
    // App sichtbar machen
    appRoot.classList.remove('app-hidden');
  });
});
