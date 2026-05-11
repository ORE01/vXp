export function disableChartAnimationsGlobally() {
  const apply = () => {
    if (!window.Chart) return false;

    window.Chart.defaults.animation = false;
    window.Chart.defaults.animations = false;
    window.Chart.defaults.transitions = {
      active: { animation: { duration: 0 } },
      resize: { animation: { duration: 0 } },
      show: { animations: {} },
      hide: { animations: {} }
    };

    console.log('[Chart.js] global animations disabled');
    return true;
  };

  if (apply()) return;

  const timer = setInterval(() => {
    if (apply()) clearInterval(timer);
  }, 50);

  setTimeout(() => clearInterval(timer), 3000);
}