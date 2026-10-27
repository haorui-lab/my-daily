(function () {
  var toggle = document.getElementById("toc-toggle");
  var drawer = document.getElementById("toc-drawer");
  var toc = document.getElementById("toc");

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function setDrawer(open) {
    if (!drawer || !toggle) return;
    drawer.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("toc-open", open);
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
  }

  // Scroll-spy: highlight TOC links whose targets are in view
  var targets = [];
  document.querySelectorAll(".content section[id], .content .item[id]").forEach(function (el) {
    targets.push(el);
  });

  var links = Array.prototype.slice.call(
    document.querySelectorAll(".toc-nav a[href^='#']")
  );

  function setActive(id) {
    links.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-active", on);
    });
  }

  function spy() {
    if (!targets.length) return;
    var offset = isMobile() ? 96 : 48;
    var current = targets[0].id;
    for (var i = 0; i < targets.length; i++) {
      var top = targets[i].getBoundingClientRect().top;
      if (top - offset <= 0) current = targets[i].id;
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

  // Keep desktop sticky TOC from fighting mobile drawer
  if (toc) {
    document.documentElement.classList.add("js");
  }
})();
