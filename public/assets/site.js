(function () {
  var toggle = document.getElementById("toc-toggle");
  var drawer = document.getElementById("toc-drawer");
  var mq = window.matchMedia("(max-width: 920px)");

  function setDrawer(open) {
    if (!drawer || !toggle) return;
    drawer.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (toggle && drawer) {
    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      setDrawer(drawer.hidden);
    });
    drawer.addEventListener("click", function (e) {
      var a = e.target.closest("a[href^='#']");
      if (a) setDrawer(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setDrawer(false);
    });
    if (mq.addEventListener) {
      mq.addEventListener("change", function () {
        if (!mq.matches) setDrawer(false);
      });
    }
  }

  var targets = [];
  document.querySelectorAll(".content section[id], .content .item[id]").forEach(function (el) {
    targets.push(el);
  });

  var links = Array.prototype.slice.call(
    document.querySelectorAll(".toc-nav a[href^='#']")
  );

  function setActive(id) {
    links.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("href") === "#" + id);
    });
  }

  function spy() {
    if (!targets.length) return;
    var offset = mq.matches ? 128 : 40;
    var current = targets[0].id;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top - offset <= 0) current = targets[i].id;
    }
    if (current) setActive(current);
  }

  var ticking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        spy();
        ticking = false;
      });
    },
    { passive: true }
  );
  window.addEventListener("resize", spy);
  spy();
})();
