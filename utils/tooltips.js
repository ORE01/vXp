export function addTooltipsForTruncatedText(container) {
    const cells = container.querySelectorAll('td');
    cells.forEach((cell) => {
      //console.log(`Cell content: "${cell.textContent}", scrollWidth: ${cell.scrollWidth}, clientWidth: ${cell.clientWidth}`);
      if (cell.scrollWidth > cell.clientWidth) {
        cell.setAttribute('title', cell.textContent);
        //console.log(`Tooltip added: "${cell.textContent}"`);
      }
    });
  }