function updateTrafficLight(wrapperSelector, state) {
  const wrap = document.querySelector(wrapperSelector);
  if (!wrap) {
    console.error('Traffic light wrapper not found:', wrapperSelector);
    return;
  }
  const red    = wrap.querySelector('.light.red');
  const yellow = wrap.querySelector('.light.yellow');
  const green  = wrap.querySelector('.light.green');

  [red, yellow, green].forEach(el => el && el.classList.remove('active'));

  if (state === 'green'  && green)  green.classList.add('active');
  if (state === 'yellow' && yellow) yellow.classList.add('active');
  if (state === 'red'    && red)    red.classList.add('active');
}

window.updateTrafficLight = updateTrafficLight; // optional global


