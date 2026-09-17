// Safe, lightweight DOM-based confetti celebration
// Does not use Web Workers, OffscreenCanvas, or window resize listeners that cause canvas.getBoundingClientRect errors

export function triggerConfetti() {
  if (typeof document === 'undefined') return;

  try {
    const container = document.createElement('div');
    container.setAttribute('id', 'confetti-portal');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    container.style.overflow = 'hidden';

    document.body.appendChild(container);

    const colors = ['#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#fbbf24', '#38bdf8', '#818cf8', '#f43f5e'];
    const count = 65;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      const startX = 20 + Math.random() * 60; // Spread around center
      const endX = startX + (Math.random() * 50 - 25);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 6 + Math.random() * 6;
      const duration = 1.8 + Math.random() * 1.4;
      const delay = Math.random() * 0.3;
      const rotation = Math.random() * 720 - 360;

      particle.style.position = 'absolute';
      particle.style.left = `${startX}%`;
      particle.style.top = '-10px';
      particle.style.width = `${size}px`;
      particle.style.height = `${size * (Math.random() > 0.5 ? 1 : 1.6)}px`;
      particle.style.backgroundColor = color;
      particle.style.borderRadius = Math.random() > 0.4 ? '2px' : '50%';
      particle.style.opacity = '1';
      particle.style.transform = `rotate(${Math.random() * 360}deg)`;
      particle.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1) ${delay}s, top ${duration}s cubic-bezier(0.1, 0.8, 0.3, 1) ${delay}s, opacity ${duration}s ease-in ${delay + duration * 0.5}s`;

      container.appendChild(particle);

      // Trigger animation in next tick
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          particle.style.top = `${60 + Math.random() * 35}%`;
          particle.style.left = `${endX}%`;
          particle.style.transform = `rotate(${rotation}deg) scale(0.8)`;
          particle.style.opacity = '0';
        });
      });
    }

    // Clean up container after animations finish
    setTimeout(() => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 3800);
  } catch (e) {
    console.warn('Confetti animation suppressed', e);
  }
}
