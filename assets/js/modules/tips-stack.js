(function (window, document) {
  "use strict";

  const TipsStackModule = (() => {
    const RESTING_ROTATIONS = [0, -2.4, 0.15, -2.2, 1.25];
    const HIDDEN_ROTATIONS = [0, -2.9, 0.45, -2.7, 1.8];
    const HIDDEN_OFFSETS = [0, 88, 104, 120, 136];
    const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function lerp(start, end, progress) {
      return start + (end - start) * progress;
    }

    function easeOutCubic(progress) {
      return 1 - Math.pow(1 - progress, 3);
    }

    function isCompactViewport() {
      return window.matchMedia("(max-width: 991.98px)").matches;
    }

    function prefersReducedMotion() {
      return window.matchMedia(REDUCED_MOTION_QUERY).matches;
    }

    function setAnimatingState(targets, isAnimating) {
      targets.forEach((target) => {
        if (!(target instanceof Element)) {
          return;
        }
        target.classList.toggle("is-animating", isAnimating);
      });
    }

    function buildPlan(viewport, cardCount, compact) {
      const firstHoldPx = viewport * (compact ? 0.78 : 1.45);
      const revealPx = viewport * (compact ? 0.46 : 0.6);
      const middleHoldPx = viewport * (compact ? 0.58 : 1.05);
      const finalHoldPx = viewport * (compact ? 0.7 : 1.25);

      const transitions = [];
      let cursor = firstHoldPx;

      for (let index = 1; index < cardCount; index += 1) {
        const holdPx = index === cardCount - 1 ? finalHoldPx : middleHoldPx;
        transitions.push({
          index,
          revealStart: cursor,
          revealEnd: cursor + revealPx,
          holdEnd: cursor + revealPx + holdPx
        });
        cursor += revealPx + holdPx;
      }

      return {
        firstHoldPx,
        revealPx,
        middleHoldPx,
        finalHoldPx,
        transitions,
        totalPx: cursor
      };
    }

    function resolveStage(scrollPx, transitions, cardCount) {
      let activeIndex = 0;
      let revealIndex = -1;
      let revealT = 0;

      for (let i = 0; i < transitions.length; i += 1) {
        const item = transitions[i];
        if (scrollPx < item.revealStart) {
          return { activeIndex, revealIndex, revealT };
        }

        if (scrollPx >= item.revealStart && scrollPx < item.revealEnd) {
          activeIndex = item.index - 1;
          revealIndex = item.index;
          revealT = easeOutCubic(
            clamp((scrollPx - item.revealStart) / (item.revealEnd - item.revealStart), 0, 1)
          );
          return { activeIndex, revealIndex, revealT };
        }

        activeIndex = item.index;
        if (scrollPx < item.holdEnd) {
          return { activeIndex, revealIndex, revealT };
        }
      }

      return {
        activeIndex: cardCount - 1,
        revealIndex: -1,
        revealT: 0
      };
    }

    function initStack() {
      if (!window.gsap || !window.ScrollTrigger) {
        return;
      }

      const cards = window.gsap.utils.toArray(".tips-stack .tip-card");
      const scene = document.querySelector(".tips-scene");
      const surface = document.querySelector(".tips-surface");
      const title = surface ? surface.querySelector(".tips-title") : null;
      const author = surface ? surface.querySelector(".tips-author") : null;
      const cardTextGroups = cards.map((card) =>
        window.gsap.utils.toArray(card.querySelectorAll(".tip-card__content > *"))
      );
      const cardTextNodes = cardTextGroups.flat();

      if (!cards.length || !scene || !surface) {
        return;
      }

      const existingTrigger = window.ScrollTrigger.getById("tips-stack-scroll");
      if (existingTrigger) {
        existingTrigger.kill(true);
      }

      let plan;
      let compactMode = isCompactViewport();
      let lastAppliedPx = Number.NEGATIVE_INFINITY;
      const getViewport = () => window.innerHeight || document.documentElement.clientHeight || 900;
      const reduceMotion = prefersReducedMotion();

      function syncSceneHeight() {
        const viewport = getViewport();
        compactMode = isCompactViewport();
        plan = buildPlan(viewport, cards.length, compactMode);
        scene.style.minHeight = `${Math.ceil(plan.totalPx + viewport)}px`;
        lastAppliedPx = Number.NEGATIVE_INFINITY;
      }

      function setCardState(index, state) {
        window.gsap.set(cards[index], state);
      }

      function setTextState(index, state) {
        if (!cardTextGroups[index] || !cardTextGroups[index].length) {
          return;
        }
        window.gsap.set(cardTextGroups[index], state);
      }

      function baseCardZIndex(index) {
        return index + 1;
      }

      function progressToPx(progress) {
        return clamp(progress, 0, 1) * plan.totalPx;
      }

      function applyState(scrollPx) {
        const px = clamp(scrollPx, 0, plan.totalPx);
        if (Math.abs(px - lastAppliedPx) < 0.45) {
          return;
        }
        lastAppliedPx = px;

        const effectivePx = compactMode ? Math.min(plan.totalPx, px + plan.firstHoldPx * 0.52) : px;
        const introPx = plan.firstHoldPx * 0.38;
        const firstCardIntroPx = plan.firstHoldPx * 0.48;
        const titleT = easeOutCubic(clamp(effectivePx / introPx, 0, 1));
        const authorT = easeOutCubic(clamp((effectivePx - introPx * 0.16) / (introPx * 0.88), 0, 1));
        const firstCardT = easeOutCubic(clamp(effectivePx / firstCardIntroPx, 0, 1));

        if (title) {
          window.gsap.set(title, {
            autoAlpha: titleT,
            y: lerp(40, 0, titleT),
            scale: lerp(0.98, 1, titleT)
          });
        }

        if (author) {
          window.gsap.set(author, {
            autoAlpha: authorT,
            y: lerp(28, 0, authorT)
          });
        }

        const stage = resolveStage(effectivePx, plan.transitions, cards.length);
        const replacingActive = stage.revealIndex === stage.activeIndex + 1;

        for (let index = 0; index < cards.length; index += 1) {
          const restingRotate = RESTING_ROTATIONS[index] ?? 0;
          const hiddenRotate = HIDDEN_ROTATIONS[index] ?? 0;
          const hiddenOffset = HIDDEN_OFFSETS[index] ?? 110;

          if (index > stage.activeIndex && index !== stage.revealIndex) {
            setCardState(index, {
              autoAlpha: 0,
              yPercent: hiddenOffset,
              y: 0,
              scale: 1,
              rotate: hiddenRotate,
              zIndex: baseCardZIndex(index)
            });
            setTextState(index, { autoAlpha: 0, y: 16 });
            continue;
          }

          if (index === stage.revealIndex) {
            const t = stage.revealT;
            setCardState(index, {
              autoAlpha: t,
              yPercent: lerp(hiddenOffset, 0, t),
              y: 0,
              scale: 1,
              rotate: lerp(hiddenRotate, restingRotate, t),
              zIndex: baseCardZIndex(index)
            });
            setTextState(index, {
              autoAlpha: t,
              y: lerp(18, 0, t)
            });
            continue;
          }

          if (index === stage.activeIndex) {
            const depth = replacingActive ? stage.revealT : 0;
            const lift = -9 * depth;
            const scale = 1 - 0.014 * depth;
            const drift = (index % 2 === 0 ? -0.15 : 0.15) * depth;
            const firstCardIntro = stage.activeIndex === 0 && stage.revealIndex === -1;

            if (firstCardIntro) {
              setCardState(index, {
                autoAlpha: firstCardT,
                yPercent: lerp(108, 0, firstCardT),
                y: lerp(20, 0, firstCardT),
                scale: lerp(0.985, 1, firstCardT),
                rotate: lerp(-1.8, restingRotate, firstCardT),
                zIndex: baseCardZIndex(index)
              });
              setTextState(index, {
                autoAlpha: firstCardT,
                y: lerp(24, 0, firstCardT)
              });
              continue;
            }

            setCardState(index, {
              autoAlpha: 1,
              yPercent: 0,
              y: lift,
              scale,
              rotate: restingRotate + drift,
              zIndex: baseCardZIndex(index)
            });
            setTextState(index, {
              autoAlpha: replacingActive ? lerp(1, 0.45, stage.revealT) : 1,
              y: replacingActive ? lerp(0, -4, stage.revealT) : 0
            });
            continue;
          }

          const depthBase = stage.activeIndex - index;
          const depth = replacingActive ? depthBase + stage.revealT : depthBase;
          const lift = -9 - (depth - 1) * 5;
          const scale = Math.max(0.93, 0.995 - depth * 0.013);
          const drift = (index % 2 === 0 ? -0.15 : 0.15) * depth;

          setCardState(index, {
            autoAlpha: 1,
            yPercent: 0,
            y: lift,
            scale,
            rotate: restingRotate + drift,
            zIndex: baseCardZIndex(index)
          });
          setTextState(index, {
            autoAlpha: 0.45,
            y: -4
          });
        }
      }

      syncSceneHeight();
      if (reduceMotion) {
        scene.style.minHeight = "100vh";
        if (title) {
          window.gsap.set(title, { autoAlpha: 1, y: 0, scale: 1 });
        }
        if (author) {
          window.gsap.set(author, { autoAlpha: 1, y: 0 });
        }

        cards.forEach((card, index) => {
          const restingRotate = RESTING_ROTATIONS[index] ?? 0;
          const isVisible = index === 0;
          window.gsap.set(card, {
            autoAlpha: isVisible ? 1 : 0,
            yPercent: isVisible ? 0 : 110,
            y: 0,
            scale: 1,
            rotate: restingRotate,
            zIndex: baseCardZIndex(index)
          });
        });

        cardTextGroups.forEach((group, groupIndex) => {
          window.gsap.set(group, {
            autoAlpha: groupIndex === 0 ? 1 : 0,
            y: 0
          });
        });
        return;
      }

      applyState(0);

      window.ScrollTrigger.create({
        id: "tips-stack-scroll",
        trigger: scene,
        start: "top top",
        end: () => `+=${plan.totalPx}`,
        fastScrollEnd: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefreshInit: syncSceneHeight,
        onRefresh: (self) => applyState(progressToPx(self.progress)),
        onUpdate: (self) => applyState(progressToPx(self.progress)),
        onLeaveBack: () => {
          applyState(0);
          setAnimatingState([title, author, ...cards, ...cardTextNodes], false);
        },
        onLeave: () => {
          applyState(plan.totalPx);
          setAnimatingState([title, author, ...cards, ...cardTextNodes], false);
        },
        onEnter: () => setAnimatingState([title, author, ...cards, ...cardTextNodes], true),
        onEnterBack: () => setAnimatingState([title, author, ...cards, ...cardTextNodes], true)
      });
    }

    function init() {
      initStack();
    }

    return {
      init
    };
  })();

  window.TipsStackModule = TipsStackModule;
})(window, document);
