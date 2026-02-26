(function (window, document) {
  "use strict";

  const ScrollAnimationsModule = (() => {
    let refreshRafId = 0;
    let refreshTimeoutId = 0;
    const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

    function canAnimate() {
      return Boolean(window.gsap && window.ScrollTrigger);
    }

    function canUseGsap() {
      return Boolean(window.gsap);
    }

    function prefersReducedMotion() {
      return window.matchMedia(REDUCED_MOTION_QUERY).matches;
    }

    function isCompactViewport() {
      return window.matchMedia("(max-width: 991.98px)").matches;
    }

    function toElements(targets) {
      if (!targets) {
        return [];
      }

      if (typeof targets === "string") {
        return Array.from(document.querySelectorAll(targets));
      }

      if (targets instanceof Element) {
        return [targets];
      }

      if (Array.isArray(targets)) {
        return targets.flatMap((target) => toElements(target));
      }

      if (typeof NodeList !== "undefined" && targets instanceof NodeList) {
        return Array.from(targets).filter((target) => target instanceof Element);
      }

      return [];
    }

    function setAnimatingState(targets, isAnimating) {
      toElements(targets).forEach((target) => {
        target.classList.toggle("is-animating", isAnimating);
      });
    }

    function observeOnce(target, onEnter, options = {}) {
      if (!(target instanceof Element) || typeof onEnter !== "function") {
        return;
      }

      if (!("IntersectionObserver" in window)) {
        onEnter();
        return;
      }

      const observer = new window.IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry || !entry.isIntersecting) {
            return;
          }

          observer.disconnect();
          onEnter();
        },
        {
          root: null,
          threshold: options.threshold ?? 0.12,
          rootMargin: options.rootMargin ?? "0px 0px -12% 0px"
        }
      );

      observer.observe(target);
    }

    function scheduleScrollTriggerUpdate() {
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

    function registerPlugins() {
      if (!canAnimate()) {
        return;
      }

      window.gsap.registerPlugin(window.ScrollTrigger);
      window.gsap.config({
        force3D: true,
        nullTargetWarn: false
      });
      window.ScrollTrigger.config({
        limitCallbacks: true,
        ignoreMobileResize: false
      });
    }

    function queueRefresh() {
      if (!canAnimate()) {
        return;
      }

      if (refreshTimeoutId) {
        window.clearTimeout(refreshTimeoutId);
      }
      if (refreshRafId) {
        window.cancelAnimationFrame(refreshRafId);
      }

      refreshTimeoutId = window.setTimeout(() => {
        refreshRafId = window.requestAnimationFrame(() => {
          window.ScrollTrigger.refresh(true);
          scheduleScrollTriggerUpdate();
          refreshRafId = 0;
          refreshTimeoutId = 0;
        });
      }, 80);
    }

    function bindRefreshLifecycle() {
      if (!canAnimate()) {
        return;
      }

      window.addEventListener("load", queueRefresh, { once: true });
      window.addEventListener("pageshow", queueRefresh, { passive: true });
      window.addEventListener("resize", queueRefresh, { passive: true });
      window.addEventListener("orientationchange", queueRefresh, { passive: true });

      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", queueRefresh, { passive: true });
      }

      if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
        document.fonts.ready.then(queueRefresh).catch(() => {});
      }
    }

    function heroIntro(reduceMotion) {
      if (!canUseGsap()) {
        return;
      }

      if (reduceMotion) {
        window.gsap.set(".hero-surface .primary-nav", { y: 0, autoAlpha: 1 });
        window.gsap.set(".hero-title, .hero-subtitle, .hero-stack-chips li", { y: 0, autoAlpha: 1 });
        return;
      }

      const timeline = window.gsap.timeline({
        defaults: {
          ease: "expo.out",
          duration: 1.05
        }
      });

      timeline
        .from(".hero-surface .primary-nav", { y: -28, autoAlpha: 0, duration: 0.9 })
        .from(".hero-title", { y: 62, autoAlpha: 0, duration: 1.2 }, "-=0.62")
        .from(".hero-subtitle", { y: 22, autoAlpha: 0, duration: 0.9 }, "-=0.88")
        .from(
          ".hero-stack-chips li",
          {
            y: 20,
            autoAlpha: 0,
            stagger: 0.06,
            duration: 0.7
          },
          "-=0.72"
        );
    }

    function revealTopicsHead(reduceMotion) {
      if (!canUseGsap()) {
        return;
      }

      const topicsHead = document.querySelector(".topics-head");
      if (!topicsHead) {
        return;
      }

      if (reduceMotion) {
        window.gsap.set(topicsHead, { autoAlpha: 1, y: 0 });
        return;
      }

      window.gsap.set(topicsHead, { autoAlpha: 0, y: 64 });
      observeOnce(topicsHead, () => {
        setAnimatingState(topicsHead, true);
        window.gsap.to(topicsHead, {
          y: 0,
          autoAlpha: 1,
          ease: "power3.out",
          duration: 0.7,
          overwrite: "auto",
          onComplete: () => setAnimatingState(topicsHead, false)
        });
      });
    }

    function heroScroll(reduceMotion) {
      if (!canAnimate()) {
        return;
      }

      if (reduceMotion) {
        window.gsap.set(".hero-image-layer", { yPercent: 0, scale: 1 });
        window.gsap.set(".hero-copy", { yPercent: 0, autoAlpha: 1 });
        return;
      }

      const targets = [".hero-image-layer", ".hero-copy"];
      const activate = () => setAnimatingState(targets, true);
      const deactivate = () => setAnimatingState(targets, false);

      window.gsap.to(".hero-image-layer", {
        yPercent: 6,
        scale: 1.08,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-scene",
          start: "top top",
          end: "bottom top",
          scrub: 1.4,
          onEnter: activate,
          onEnterBack: activate,
          onLeave: deactivate,
          onLeaveBack: deactivate
        }
      });

      window.gsap.to(".hero-copy", {
        yPercent: -18,
        autoAlpha: 0.35,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-scene",
          start: "top top",
          end: "bottom top",
          scrub: 1.3,
          onEnter: activate,
          onEnterBack: activate,
          onLeave: deactivate,
          onLeaveBack: deactivate
        }
      });
    }

    function learningHighlight(reduceMotion) {
      if (!canAnimate()) {
        return;
      }

      const scene = document.querySelector(".learning-scene");
      const title = document.querySelector(".learning-title");
      const tabs = document.querySelector(".learning-tabs");
      const cards = window.gsap.utils.toArray(".learning-grid .course-card");
      const highlightCard = document.getElementById("courseHighlight");
      const arrow = highlightCard ? highlightCard.querySelector(".course-card__arrow") : null;

      if (!scene || !title || !tabs || !cards.length || !highlightCard) {
        return;
      }

      if (reduceMotion) {
        window.gsap.set([title, tabs, cards], { autoAlpha: 1, y: 0, rotate: 0 });
        if (arrow) {
          window.gsap.set(arrow, { autoAlpha: 1, x: 0 });
        }
        highlightCard.classList.add("is-active");
        return;
      }

      window.gsap.set(title, { autoAlpha: 0, y: 48 });
      window.gsap.set(tabs, { autoAlpha: 0, y: 32 });
      window.gsap.set(cards, { autoAlpha: 0, y: 92, rotate: 1.2 });

      if (arrow) {
        window.gsap.set(arrow, { autoAlpha: 0, x: -12 });
      }

      const animatedTargets = [title, tabs, ...cards];
      if (arrow) {
        animatedTargets.push(arrow);
      }

      const timeline = window.gsap.timeline({
        defaults: {
          ease: "power3.out"
        },
        scrollTrigger: {
          trigger: scene,
          start: isCompactViewport() ? "top 78%" : "top top",
          end: isCompactViewport() ? "top 18%" : "bottom top",
          scrub: isCompactViewport() ? false : 1.25,
          fastScrollEnd: false,
          onUpdate: (self) => {
            const isHighlight = self.progress >= 0.34;
            highlightCard.classList.toggle("is-active", isHighlight);
          },
          onEnter: () => setAnimatingState(animatedTargets, true),
          onEnterBack: () => setAnimatingState(animatedTargets, true),
          onLeave: () => setAnimatingState(animatedTargets, false),
          onLeaveBack: () => setAnimatingState(animatedTargets, false),
          toggleActions: isCompactViewport() ? "play none none reverse" : "play none none none",
          invalidateOnRefresh: true
        }
      });

      timeline
        .to(title, { autoAlpha: 1, y: 0, duration: 0.14 }, 0.02)
        .to(tabs, { autoAlpha: 1, y: 0, duration: 0.13 }, 0.08)
        .to(cards[0], { autoAlpha: 1, y: 0, rotate: 0, duration: 0.2 }, 0.14)
        .to(cards[1], { autoAlpha: 1, y: 0, rotate: 0, duration: 0.2 }, 0.22);

      if (arrow) {
        timeline.to(arrow, { autoAlpha: 1, x: 0, duration: 0.14 }, 0.38);
      }

      timeline.to({}, { duration: 0.94 }, 0.52);
    }

    function pillsReveal(reduceMotion) {
      if (!canAnimate()) {
        return;
      }

      const scene = document.querySelector(".pills-scene");
      const title = document.querySelector(".pills-title");
      const pills = window.gsap.utils.toArray(".stress-pills .stress-pill");

      if (!scene || !title || !pills.length) {
        return;
      }

      if (reduceMotion) {
        window.gsap.set(title, { autoAlpha: 1, y: 0, scale: 1 });
        window.gsap.set(pills, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0 });
        return;
      }

      const existingTrigger = window.ScrollTrigger.getById("pills-showcase");
      if (existingTrigger) {
        existingTrigger.kill(true);
      }

      window.gsap.set(title, {
        autoAlpha: 0,
        y: 62,
        scale: 0.95
      });

      window.gsap.set(pills, {
        autoAlpha: 0,
        y: 130,
        scale: 0.84,
        rotate: (index) => (index % 2 === 0 ? -2.8 : 2.8),
        transformOrigin: "center bottom"
      });

      const timeline = window.gsap.timeline({
        defaults: {
          ease: "power3.out"
        },
        scrollTrigger: {
          id: "pills-showcase",
          trigger: scene,
          start: isCompactViewport() ? "top 80%" : "top top",
          end: isCompactViewport() ? "top 22%" : "bottom top",
          scrub: isCompactViewport() ? false : 1.2,
          fastScrollEnd: false,
          onEnter: () => setAnimatingState([title, ...pills], true),
          onEnterBack: () => setAnimatingState([title, ...pills], true),
          onLeave: () => setAnimatingState([title, ...pills], false),
          onLeaveBack: () => setAnimatingState([title, ...pills], false),
          toggleActions: "play none none reverse",
          invalidateOnRefresh: true
        }
      });

      timeline
        .to(title, { autoAlpha: 1, y: 0, scale: 1, duration: 0.14 }, 0.04)
        .to(
          pills,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotate: 0,
            stagger: {
              each: 0.09,
              from: "start"
            },
            duration: 0.22
          },
          0.12
        );

      timeline.to({}, { duration: 1 }, 0.66);
    }

    function keyholeTimeline(reduceMotion) {
      if (!canAnimate()) {
        return;
      }

      const compact = isCompactViewport();
      const scene = document.querySelector(".keyhole-scene");
      const nav = document.querySelector(".keyhole-surface .primary-nav--ghost");
      const stage = document.querySelector(".keyhole-stage");
      const shape = document.querySelector(".keyhole-shape");
      const peek = document.querySelector(".keyhole-peek");
      const reveal = document.querySelector(".keyhole-fullscreen");
      const lines = window.gsap.utils.toArray(".keyline");
      const orbits = window.gsap.utils.toArray(".orbit");

      if (!scene || !nav || !stage || !shape || !peek || !reveal || !lines.length || !orbits.length) {
        return;
      }

      if (reduceMotion) {
        window.gsap.set(shape, { scale: 1, autoAlpha: 1 });
        window.gsap.set(peek, { autoAlpha: 0.24 });
        window.gsap.set(lines, { autoAlpha: 1, x: 0, y: 0 });
        window.gsap.set(orbits, { autoAlpha: 1, scale: 1, rotation: 0 });
        window.gsap.set(reveal, { autoAlpha: 1, scale: 1 });
        window.gsap.set(nav, { autoAlpha: 1, y: 0 });
        window.gsap.set(stage, { autoAlpha: 1 });
        return;
      }

      function getCompactEnd() {
        const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
        const docMaxScroll = Math.max(0, document.documentElement.scrollHeight - viewport);
        const availableFromScene = Math.max(320, docMaxScroll - scene.offsetTop - 4);
        const preferred = Math.max(viewport * 1.2, scene.offsetHeight * 0.92);
        return `+=${Math.round(Math.min(preferred, availableFromScene))}`;
      }

      const existingTrigger = window.ScrollTrigger.getById("keyhole-reveal");
      if (existingTrigger) {
        existingTrigger.kill(true);
      }

      window.gsap.set(shape, { scale: compact ? 0.72 : 0.62, autoAlpha: 0.82, transformOrigin: "center center" });
      window.gsap.set(peek, { autoAlpha: 0.24 });
      window.gsap.set(lines, { autoAlpha: 0, y: compact ? 14 : 24 });
      window.gsap.set(orbits, { autoAlpha: 0, scale: compact ? 0.82 : 0.72, rotation: 0, transformOrigin: "center center" });
      window.gsap.set(reveal, { autoAlpha: 0, scale: 1.12, transformOrigin: "center center" });
      window.gsap.set(nav, { autoAlpha: 1, y: 0 });
      window.gsap.set(stage, { autoAlpha: 1 });

      const timeline = window.gsap.timeline({
        defaults: {
          ease: "power2.out",
          duration: 1
        },
        scrollTrigger: {
          id: "keyhole-reveal",
          trigger: scene,
          start: "top top",
          end: compact ? getCompactEnd : "bottom top",
          scrub: compact ? 1.55 : 1.15,
          fastScrollEnd: false,
          onEnter: () => setAnimatingState([shape, peek, reveal, nav, ...lines, ...orbits], true),
          onEnterBack: () => setAnimatingState([shape, peek, reveal, nav, ...lines, ...orbits], true),
          onLeave: () => setAnimatingState([shape, peek, reveal, nav, ...lines, ...orbits], false),
          onLeaveBack: () => setAnimatingState([shape, peek, reveal, nav, ...lines, ...orbits], false),
          invalidateOnRefresh: true
        }
      });

      timeline
        .to(shape, { scale: 1, autoAlpha: 1, duration: 0.24 }, 0.08)
        .to(lines[0], { x: 0, y: 0, autoAlpha: 1, duration: 0.22 }, 0.24)
        .to(lines[1], { x: 0, y: 0, autoAlpha: 1, duration: 0.22 }, 0.3)
        .to(
          orbits,
          {
            autoAlpha: 1,
            rotation: 180,
            scale: 1,
            stagger: 0.09,
            ease: "none",
            duration: 0.3
          },
          0.38
        )
        .to({}, { duration: 0.52 }, 0.72)
        .to(lines, { autoAlpha: 0, y: -20, duration: 0.2, stagger: 0.05 }, 1.06)
        .to(orbits, { autoAlpha: 0, scale: 0.78, duration: 0.2, stagger: 0.03 }, 1.08)
        .to(nav, { autoAlpha: 0, y: -14, duration: 0.24 }, 1.12)
        .to(peek, { autoAlpha: 0, duration: 0.1 }, 1.16)
        .to(shape, { scale: compact ? 9.6 : 12, duration: 0.62, ease: "power2.inOut" }, 1.14)
        .to(shape, { autoAlpha: 0, duration: 0.2, ease: "power1.out" }, 1.5)
        .to(reveal, { autoAlpha: 1, scale: 1, duration: compact ? 0.46 : 0.54, ease: "power2.out" }, 1.28)
        .to({}, { duration: 0.62 }, 1.78);
    }

    function init() {
      const reduceMotion = prefersReducedMotion();

      registerPlugins();
      heroIntro(reduceMotion);
      heroScroll(reduceMotion);
      revealTopicsHead(reduceMotion);
      learningHighlight(reduceMotion);
      pillsReveal(reduceMotion);
      keyholeTimeline(reduceMotion);

      if (!reduceMotion) {
        bindRefreshLifecycle();
        queueRefresh();
      }
    }

    return {
      init
    };
  })();

  window.ScrollAnimationsModule = ScrollAnimationsModule;
})(window, document);
