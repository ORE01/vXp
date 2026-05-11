export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function removeCouponButton() {
  const couponButton = document.getElementById('coupon-button');
  if (couponButton) {
    couponButton.remove();
  }
}

export function bindModalCloseCleanup() {
  document.addEventListener("DOMContentLoaded", () => {
    const closeButton = document.querySelector(".close");
    if (closeButton) {
      closeButton.addEventListener("click", removeCouponButton);
    }
  });
}