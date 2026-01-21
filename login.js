console.log('[LOGIN] root login.js loaded');

window.addEventListener('DOMContentLoaded', () => {
  console.log('[LOGIN] DOMContentLoaded');

  const loginPage  = document.querySelector('.login-page');
  const appRoot    = document.querySelector('#app-root');
  const loginButton = document.querySelector('.login-button');

  console.log('[LOGIN] found:', { loginPage: !!loginPage, appRoot: !!appRoot, loginButton: !!loginButton });

  if (!loginPage || !appRoot || !loginButton) {
    console.warn('Login-Layout nicht vollständig gefunden.');
    return;
  }

  loginButton.addEventListener('click', () => {
    console.log('[LOGIN] click');
    loginPage.remove();
    appRoot.classList.remove('app-hidden');
    console.log('[LOGIN] appRoot classes:', appRoot.className);
  });
});




