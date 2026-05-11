export function displayErrorMessage(message) {
  const div = document.getElementById('errorMessage');
  if (div) {
    div.textContent = message;
    div.style.display = 'block';
  } else {
    console.error('[ModalFeedback] Error message container not found:', message);
  }
}