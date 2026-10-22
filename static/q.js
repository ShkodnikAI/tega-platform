(function(){
  function open(){
    var h=location.hash.slice(1); if(!h) return;
    var el=document.getElementById(h); if(!el) return;
    var d=el.closest&&el.closest('details'); if(el.tagName==='DETAILS') d=el;
    if(d&&!d.open){ d.open=true; el.scrollIntoView(); }
  }
  window.addEventListener('hashchange',open); open();
})();
