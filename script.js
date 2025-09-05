// Minimal enhancements: accessible hash focus & future hooks
(function(){
  if (location.hash) {
    const el = document.querySelector(location.hash);
    if (el) el.setAttribute('tabindex','-1'), el.focus();
  }
})();
