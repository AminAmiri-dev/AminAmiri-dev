(function (window) {
  "use strict";

  const SmoothScrollModule = (() => {
    let lenis;
    let fallbackRafId = 0;
    let gsapTickerBound = false;
    let gsapLenisTick = null;
    let stUpdateRafId = 0;
    const STORAGE_KEY = "__resume_scroll_restore__";

    function scheduleScrollTriggerUpdate() {
      if (!window.ScrollTrigger) {
        return;
      }

      if (stUpdateRafId) {
        return;
      }

      stUpdateRafId = window.requestAnimationFrame(() => {
        stUpdateRafId = 0;
        window.ScrollTrigger.update();
      });
    }

    function setManualScrollRestoration() {
      if (!("scrollRestoration" in window.history)) {
        return;
      }

      window.history.scrollRestoration = "manual";
    }

    function getNavigationType() {
      const entries =
        typeof window.performance?.getEntriesByType === "function"
          ? window.performance.getEntriesByType("navigation")
          : [];

      if (entries && entries.length) {
        return entries[0].type;
      }

      if (window.performance?.navigation) {
        return window.performance.navigation.type === 1 ? "reload" : "navigate";
      }

      return "navigate";
    }

    function getCurrentScrollY() {
      if (lenis && typeof lenis.scroll === "number") {
        return Math.max(0, Math.round(lenis.scroll));
      }

      return Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
    }

    function saveScrollPosition() {
      try {
        const payload = {
          y: getCurrentScrollY(),
          path: `${window.location.pathname}${window.location.search}`,
          ts: Date.now()
        };
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (_error) {
        // no-op: storage can be unavailable in private contexts
      }
    }

    function bindPersistOnUnload() {
      window.addEventListener("pagehide", saveScrollPosition);
      window.addEventListener("beforeunload", saveScrollPosition);
    }

    function readSavedPosition() {
      try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        window.sessionStorage.removeItem(STORAGE_KEY);

        if (!parsed || typeof parsed.y !== "number") {
          return null;
        }

        const currentPath = `${window.location.pathname}${window.location.search}`;
        if (parsed.path !== currentPath) {
          return null;
        }

        // Prevent very old entries from being restored.
        if (typeof parsed.ts === "number" && Date.now() - parsed.ts > 1000 * 60 * 20) {
          return null;
        }

        return Math.max(0, Math.round(parsed.y));
      } catch (_error) {
        return null;
      }
    }

    function animateRestoreScroll(savedY, reduceMotion) {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetY = Math.min(savedY, maxScroll);

      if (targetY <= 2) {
        return;
      }

      if (lenis && typeof lenis.scrollTo === "function") {
        lenis.scrollTo(0, { immediate: true, force: true });

        if (reduceMotion) {
          lenis.scrollTo(targetY, { immediate: true, force: true });
          return;
        }

        const duration = Math.min(2.8, Math.max(1.15, targetY / 1300));
        lenis.scrollTo(targetY, {
          duration,
          force: true,
          immediate: false,
          lock: true,
          easing: (t) => 1 - Math.pow(1 - t, 4)
        });
        return;
      }

      window.scrollTo(0, 0);

      if (reduceMotion) {
        window.scrollTo(0, targetY);
        return;
      }

      window.scrollTo({
        top: targetY,
        behavior: "smooth"
      });
    }

    function restoreAfterReload(reduceMotion) {
      if (getNavigationType() !== "reload") {
        return;
      }

      const savedY = readSavedPosition();
      if (savedY == null) {
        return;
      }

      // Wait until all modules are initialized and layout is stable.
      window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          animateRestoreScroll(savedY, reduceMotion);
        });
      }, 80);
    }

    function initLenisWithGsap() {
      if (!window.gsap || !window.ScrollTrigger) {
        if (fallbackRafId) {
          window.cancelAnimationFrame(fallbackRafId);
        }

        const raf = (time) => {
          if (lenis) {
            lenis.raf(time);
          }
          fallbackRafId = window.requestAnimationFrame(raf);
        };

        fallbackRafId = window.requestAnimationFrame(raf);
        return;
      }

      if (fallbackRafId) {
        window.cancelAnimationFrame(fallbackRafId);
        fallbackRafId = 0;
      }

      if (!gsapTickerBound) {
        gsapLenisTick = (time) => {
          if (!lenis) {
            return;
          }
          lenis.raf(time * 1000);
        };

        window.gsap.ticker.add(gsapLenisTick);
        gsapTickerBound = true;
      }

      window.gsap.ticker.fps(60);
      window.gsap.ticker.lagSmoothing(500, 33);
    }

    function init() {
      setManualScrollRestoration();
      bindPersistOnUnload();

      if (!window.Lenis) {
        restoreAfterReload(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        return;
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      lenis = new window.Lenis({
        smoothWheel: !reduceMotion,
        smoothTouch: !reduceMotion,
        syncTouch: !reduceMotion,
        normalizeWheel: true,
        lerp: reduceMotion ? 1 : 0.085,
        duration: reduceMotion ? 0 : 1.1,
        wheelMultiplier: 0.92,
        touchMultiplier: 1.02,
        autoResize: true
      });

      lenis.on("scroll", scheduleScrollTriggerUpdate);
      initLenisWithGsap();
      window.lenis = lenis;
      window.__scheduleScrollTriggerUpdate = scheduleScrollTriggerUpdate;
      restoreAfterReload(reduceMotion);
    }

    return {
      init,
      getInstance: () => lenis
    };
  })();

  window.SmoothScrollModule = SmoothScrollModule;
})(window);
