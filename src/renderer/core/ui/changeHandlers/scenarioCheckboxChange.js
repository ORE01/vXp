export function handleScenarioCheckboxChange(target) {
  if (!target?.classList?.contains('select-scenario')) return false;

  const checkboxes = document.querySelectorAll('.select-scenario');

  checkboxes.forEach((checkbox) => {
    if (checkbox !== target) checkbox.checked = false;
  });

  return true;
}