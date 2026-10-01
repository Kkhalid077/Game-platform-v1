/* Keep the platform version stable across devices and refreshes. */
(function updatePlatformVersion(){
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  footer.textContent = 'رقم الإصدار 0.01';
})();
