(function (window, document) {
  "use strict";

  const NavigationModule = (() => {
    const selectors = {
      toggles: "[data-menu-toggle]",
      navs: ".nav-links",
      anchorLinks: "a[href^='#']"
    };
    const INTERRUPT_EVENTS = ["wheel", "touchstart", "mousedown", "keydown"];
    const AUTO_SCROLL_PX_PER_SECOND = 2600;
    let autoScrollToken = 0;
    let isAutoScrolling = false;
    let detachInterruptHandlers = null;
    let nativeScrollRafId = 0;

    function getCurrentScrollY() {
      if (window.lenis && typeof window.lenis.scroll === "number") {
        return Math.max(0, window.lenis.scroll);
      }

      return Math.max(0, window.scrollY || window.pageYOffset || 0);
    }

    function getTargetScrollY(target) {
      const rect = target.getBoundingClientRect();
      const baseY = getCurrentScrollY();
      const viewport = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewport);
      const targetTop = baseY + rect.top;
      const targetBottomAligned = targetTop + rect.height - viewport;
      const rawTargetY = rect.height > viewport ? targetBottomAligned : targetTop;

      return Math.max(0, Math.min(maxScroll, Math.round(rawTargetY)));
    }

    function getAnimatedDuration(targetY) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return 0;
      }

      const distance = Math.abs(targetY - getCurrentScrollY());
      if (distance < 2) {
        return 0;
      }
      return distance / AUTO_SCROLL_PX_PER_SECOND;
    }

    function shouldHandleKeyInterrupt(event) {
      const key = event.key;
      return (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "PageUp" ||
        key === "PageDown" ||
        key === "Home" ||
        key === "End" ||
        key === " " ||
        key === "Spacebar"
      );
    }

    function syncScrollTriggers() {
      if (!window.ScrollTrigger) {
        return;
      }

      if (typeof window.__scheduleScrollTriggerUpdate === "function") {
        window.__scheduleScrollTriggerUpdate();
        return;
      }

      window.requestAnimationFrame(() => {
        window.ScrollTrigger.update();
      });
    }

    function stopAutoScroll() {
      autoScrollToken += 1;
      isAutoScrolling = false;

      if (nativeScrollRafId) {
        window.cancelAnimationFrame(nativeScrollRafId);
        nativeScrollRafId = 0;
      }

      if (detachInterruptHandlers) {
        detachInterruptHandlers();
        detachInterruptHandlers = null;
      }

      if (window.lenis && typeof window.lenis.scrollTo === "function") {
        window.lenis.scrollTo(getCurrentScrollY(), {
          immediate: true,
          force: true
        });
      }

      syncScrollTriggers();
    }

    function animateNativeSmoothScroll(targetY, duration, token) {
      if (nativeScrollRafId) {
        window.cancelAnimationFrame(nativeScrollRafId);
        nativeScrollRafId = 0;
      }

      if (duration <= 0) {
        window.scrollTo(0, targetY);
        if (token === autoScrollToken) {
          isAutoScrolling = false;
          if (detachInterruptHandlers) {
            detachInterruptHandlers();
            detachInterruptHandlers = null;
          }
          syncScrollTriggers();
        }
        return;
      }

      const startY = getCurrentScrollY();
      const delta = targetY - startY;
      if (Math.abs(delta) < 1) {
        if (token === autoScrollToken) {
          isAutoScrolling = false;
          if (detachInterruptHandlers) {
            detachInterruptHandlers();
            detachInterruptHandlers = null;
          }
          syncScrollTriggers();
        }
        return;
      }

      const startTime = window.performance.now();
      const step = (now) => {
        if (token !== autoScrollToken) {
          nativeScrollRafId = 0;
          return;
        }

        const elapsed = now - startTime;
        const t = Math.max(0, Math.min(1, elapsed / (duration * 1000)));
        window.scrollTo(0, startY + delta * t);

        if (t < 1) {
          nativeScrollRafId = window.requestAnimationFrame(step);
          return;
        }

        nativeScrollRafId = 0;
        isAutoScrolling = false;
        if (detachInterruptHandlers) {
          detachInterruptHandlers();
          detachInterruptHandlers = null;
        }
        syncScrollTriggers();
      };

      nativeScrollRafId = window.requestAnimationFrame(step);
    }

    function attachInterruptListeners(cancel) {
      const handlers = [];

      INTERRUPT_EVENTS.forEach((eventName) => {
        const handler = (event) => {
          if (eventName === "keydown" && !shouldHandleKeyInterrupt(event)) {
            return;
          }
          cancel();
        };

        window.addEventListener(eventName, handler, { passive: true });
        handlers.push({ eventName, handler });
      });

      return () => {
        handlers.forEach(({ eventName, handler }) => {
          window.removeEventListener(eventName, handler);
        });
      };
    }

    function closeMenus() {
      document.querySelectorAll(selectors.navs).forEach((nav) => {
        nav.classList.remove("is-open");
      });

      document.querySelectorAll(selectors.toggles).forEach((toggle) => {
        toggle.setAttribute("aria-expanded", "false");
      });
    }

    function bindToggle() {
      document.querySelectorAll(selectors.toggles).forEach((toggle) => {
        const controlsId = toggle.getAttribute("aria-controls");
        if (!controlsId) {
          return;
        }

        const nav = document.getElementById(controlsId);
        if (!nav) {
          return;
        }

        toggle.addEventListener("click", () => {
          const isExpanded = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", String(!isExpanded));
          nav.classList.toggle("is-open", !isExpanded);
        });
      });
    }

    function bindAnchorScroll() {
      document.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const link = event.target.closest(selectors.anchorLinks);
        if (!link) {
          return;
        }

        const href = link.getAttribute("href");
        if (!href || href === "#") {
          event.preventDefault();
          return;
        }

        const targetId = href.slice(1).trim();
        if (!targetId) {
          return;
        }

        const target = document.getElementById(targetId);
        if (!target) {
          return;
        }

        event.preventDefault();
        closeMenus();

        if (isAutoScrolling) {
          stopAutoScroll();
        }

        const targetY = getTargetScrollY(target);
        const duration = getAnimatedDuration(targetY);
        const token = ++autoScrollToken;
        isAutoScrolling = true;

        if (detachInterruptHandlers) {
          detachInterruptHandlers();
          detachInterruptHandlers = null;
        }

        const cancelAutoScroll = () => {
          if (!isAutoScrolling || token !== autoScrollToken) {
            return;
          }
          stopAutoScroll();
        };

        detachInterruptHandlers = attachInterruptListeners(cancelAutoScroll);
        syncScrollTriggers();

        if (window.lenis && typeof window.lenis.scrollTo === "function") {
          window.lenis.scrollTo(targetY, {
            duration,
            offset: 0,
            immediate: false,
            force: true,
            lock: false,
            easing: (t) => t,
            onComplete: () => {
              if (token !== autoScrollToken) {
                return;
              }
              isAutoScrolling = false;
              if (detachInterruptHandlers) {
                detachInterruptHandlers();
                detachInterruptHandlers = null;
              }
              syncScrollTriggers();
            }
          });
          return;
        }

        animateNativeSmoothScroll(targetY, duration, token);
      });
    }

    function bindOutsideClick() {
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const clickedToggle = target.closest(selectors.toggles);
        const clickedNav = target.closest(selectors.navs);

        if (!clickedToggle && !clickedNav) {
          closeMenus();
        }
      });
    }

    function bindViewportReset() {
      window.addEventListener(
        "resize",
        () => {
        if (window.innerWidth > 992) {
          closeMenus();
        }
        },
        { passive: true }
      );
    }

    function init() {
      bindToggle();
      bindAnchorScroll();
      bindOutsideClick();
      bindViewportReset();
    }

    return {
      init,
      closeMenus
    };
  })();

  window.NavigationModule = NavigationModule;
})(window, document);
