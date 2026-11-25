/* Новогоднее оформление главной страницы: включает гирлянду и снегопад только в сезон
   (1 декабря — 10 января) и выключает анимацию снега при prefers-reduced-motion. Вне сезона
   ничего не добавляет и не грузит лишнего. */
(function () {
  'use strict';
  function inSeason(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return m === 12 || (m === 1 && day <= 10);
  }
  function init() {
    if (!inSeason(new Date())) return;
    var hero = document.querySelector('.hero'); if (!hero) return;
    hero.classList.add('ny-on');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    var host = document.getElementById('ny-snow'); if (!host) return;
    var n = 22;
    for (var i = 0; i < n; i++) {
      var f = document.createElement('span');
      f.className = 'flake';
      f.textContent = Math.random() < 0.5 ? '❅' : '❆';
      var size = 10 + Math.random() * 14;
      var left = Math.random() * 100;
      var dur = 7 + Math.random() * 8;
      var delay = Math.random() * 10;
      f.style.left = left + '%';
      f.style.fontSize = size + 'px';
      f.style.animationDuration = dur + 's';
      f.style.animationDelay = '-' + delay + 's';
      host.appendChild(f);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
