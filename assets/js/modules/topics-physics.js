(function (window, document) {
  "use strict";

  const TopicsPhysicsModule = (() => {
    const FONT_FAMILY = '"IRANSansWeb", "Segoe UI", Tahoma, sans-serif';
    const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
    const VISIBILITY_MARGIN = "18% 0px 18% 0px";
    const PROGRESS_EPSILON = 0.0008;
    const PROGRESS_SMOOTHING = 0.16;
    const ORB_SMOOTHING = 0.14;
    const HOLD_PROGRESS_TAIL = 0.24;
    const TAU = Math.PI * 2;

    const ORBS = [
      { label: "استراتژی رشد", tier: "large", lane: 0 },
      { label: "طراحی تجربه کاربری", tier: "large", lane: 1 },
      { label: "توسعه فرانت‌اند", tier: "large", lane: 2 },
      { label: "سئو تکنیکال", tier: "medium", lane: 0 },
      { label: "طراحی رابط کاربری", tier: "medium", lane: 1 },
      { label: "سرعت و پرفورمنس", tier: "medium", lane: 2 },
      { label: "انیمیشن‌های هوشمند", tier: "medium", lane: 1 },
      { label: "بهینه‌سازی تبدیل", tier: "medium", lane: 0 },
      { label: "دسترسی‌پذیری", tier: "small", lane: 0 },
      { label: "بهینه‌سازی تصاویر", tier: "small", lane: 1 },
      { label: "ریسپانسیو دقیق", tier: "small", lane: 2 },
      { label: "کدنویسی تمیز", tier: "small", lane: 2 }
    ];

    let section;
    let surface;
    let dropZone;
    let canvas;
    let context;
    let headline;
    let progressBar;
    let resultOrb;
    let cta;

    let width = 0;
    let height = 0;
    let dpr = 1;

    let sectionTop = 0;
    let sectionRange = 1;

    let currentProgress = 0;
    let targetProgress = 0;
    let lastScrollY = 0;

    let tickRafId = 0;
    let progressRafId = 0;
    let resizeTimeoutId = 0;

    let isVisible = false;
    let isAnimatingScope = false;
    let reducedMotion = false;

    let visibilityObserver = null;

    let orbStates = [];
    let drawOrder = [];
    let ambientNodes = [];
    let ambientBeams = [];
    let ambientBuffer = null;
    let ambientBufferContext = null;
    const textSizeCache = new Map();

    const reducedMedia = window.matchMedia(REDUCED_QUERY);

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function lerp(start, end, amount) {
      return start + (end - start) * amount;
    }

    function mapProgress(value, start, length) {
      return clamp((value - start) / length, 0, 1);
    }

    function smoothstep(value) {
      const t = clamp(value, 0, 1);
      return t * t * (3 - 2 * t);
    }

    function easeOutCubic(value) {
      const t = clamp(value, 0, 1);
      return 1 - Math.pow(1 - t, 3);
    }

    function easeInOutCubic(value) {
      const t = clamp(value, 0, 1);
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function toRadians(value) {
      return (value * Math.PI) / 180;
    }

    function pseudoRandom(index, seed = 1) {
      const value = Math.sin((index + 1.13) * 12.9898 + seed * 78.233) * 43758.5453;
      return value - Math.floor(value);
    }

    function getScrollY() {
      if (window.lenis && typeof window.lenis.scroll === "number") {
        return Math.max(0, window.lenis.scroll);
      }
      return Math.max(0, window.scrollY || window.pageYOffset || 0);
    }

    function isReducedMotion() {
      return Boolean(reducedMedia.matches);
    }

    function ensureStyles() {
      if (document.getElementById("topicsCinematicStyles")) {
        return;
      }

      const style = document.createElement("style");
      style.id = "topicsCinematicStyles";
      style.textContent = `
        .topics-scene.topics-scene--cinematic {
          --tp-1: 8px;
          --tp-2: 16px;
          --tp-3: 24px;
          --tp-4: 32px;
          --tp-5: 40px;
          --tp-6: 48px;
          --tp-8: 64px;
          --tp-ease: cubic-bezier(0.22, 1, 0.36, 1);
          --tp-center-orb-size: clamp(13rem, 28vw, 23rem);
          min-height: 226vh;
          background:
            radial-gradient(120% 96% at 50% -18%, rgba(68, 133, 211, 0.22), rgba(68, 133, 211, 0) 62%),
            linear-gradient(180deg, #061328 0%, #040a16 58%, #02040a 100%);
        }

        .topics-surface.topics-surface--cinematic {
          position: sticky;
          top: 0;
          min-height: 100vh;
          overflow: hidden;
          isolation: isolate;
          color: #eef6ff;
          background:
            radial-gradient(86% 70% at 50% 78%, rgba(116, 179, 252, 0.16), rgba(116, 179, 252, 0) 72%),
            radial-gradient(74% 66% at 50% 112%, rgba(56, 108, 168, 0.18), rgba(56, 108, 168, 0) 76%);
        }

        .topics-cinematic-progress { position: absolute; top: clamp(var(--tp-2), 3.2vh, var(--tp-4)); left: 50%; width: min(78vw, 780px); height: 2px; transform: translateX(-50%); border-radius: 999px; background: rgba(135,173,219,.24); overflow: hidden; z-index: 12; pointer-events: none; }
        .topics-cinematic-progress span { display: block; width: 100%; height: 100%; transform: scaleX(0); transform-origin: center left; opacity: .24; background: linear-gradient(90deg, rgba(120,181,246,.42), rgba(170,214,255,.96)); }

        .topics-cinematic-head { position: absolute; top: clamp(5.4rem, 18vh, 10rem); left: 50%; width: min(92vw, 860px); transform: translate3d(-50%, 22px, 0); display: grid; gap: var(--tp-2); text-align: center; opacity: 0; pointer-events: none; z-index: 10; }
        .topics-cinematic-head__title { margin: 0; font-family: ${FONT_FAMILY}; font-size: clamp(2rem, 4.8vw, 4.6rem); font-weight: 700; line-height: 1.03; letter-spacing: -.012em; color: #f4f9ff; text-wrap: balance; }
        .topics-cinematic-head__subtitle { margin: 0 auto; max-width: 56ch; font-family: ${FONT_FAMILY}; font-size: clamp(.9rem, 1.18vw, 1.18rem); line-height: 1.72; letter-spacing: .01em; color: rgba(197,216,240,.82); text-wrap: balance; }

        .topics-cinematic-dropzone { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
        .topics-cinematic-dropzone::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .1; background-image: linear-gradient(rgba(138,178,224,.11) 1px, transparent 1px), linear-gradient(90deg, rgba(138,178,224,.11) 1px, transparent 1px); background-size: 72px 72px; mask-image: linear-gradient(180deg, rgba(0,0,0,.44), transparent 90%); }

        #topicsCanvas.topics-cinematic-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 1; }

        .topics-cinematic-orb { --tp-glow: 0; --tp-cap: .16; position: absolute; top: 50%; left: 50%; width: var(--tp-center-orb-size); aspect-ratio: 1; border-radius: 50%; transform: translate3d(-50%, calc(-50% + 28px), 0) scale(.92); opacity: 0; display: grid; place-content: center; justify-items: center; align-content: center; gap: var(--tp-1); padding: clamp(14px, 2.2vw, 24px); text-align: center; color: #eef7ff; background: radial-gradient(132% 108% at 27% 16%, rgba(183,222,255,.16), rgba(183,222,255,0) 48%), radial-gradient(148% 130% at 76% 90%, rgba(11,36,64,.92), rgba(6,18,33,.97) 84%); border: .85px solid rgba(146,193,244,.22); box-shadow: 0 10px 22px rgba(2,8,20,.16), 0 0 calc(8px + 16px * var(--tp-glow)) rgba(126,196,255,.11), inset 0 0 0 .8px rgba(255,255,255,.06); z-index: 9; pointer-events: none; overflow: hidden; }
        .topics-cinematic-orb::before { content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: radial-gradient(58% 40% at 32% 14%, rgba(237,247,255,.56), rgba(237,247,255,0) 72%), radial-gradient(36% 26% at 63% 26%, rgba(216,238,255,.18), rgba(216,238,255,0) 78%); opacity: var(--tp-cap); }
        .topics-cinematic-orb::after { content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: radial-gradient(110% 100% at 58% 96%, rgba(6,16,28,.26), rgba(6,16,28,0) 62%); opacity: .55; }
        .topics-cinematic-orb strong { margin: 0; width: 100%; font-family: ${FONT_FAMILY}; font-size: clamp(1.42rem, 2.22vw, 2.2rem); font-weight: 800; line-height: 1.08; letter-spacing: -.012em; color: #f2f9ff; text-align: center; text-shadow: 0 1px 10px rgba(2,12,24,.22); }
        .topics-cinematic-orb small { margin: 0 auto; display: block; width: 100%; max-width: 18ch; font-family: ${FONT_FAMILY}; font-size: clamp(.76rem, .98vw, .92rem); font-weight: 600; line-height: 1.52; letter-spacing: .003em; color: rgba(218,232,247,.9); text-align: center; }

        .topics-cinematic-cta { position: absolute; top: calc(50% + (var(--tp-center-orb-size) / 2) + clamp(24px, 2.8vh, 36px)); left: 50%; width: min(95vw, 640px); display: flex; align-items: center; justify-content: center; gap: var(--tp-3); transform: translate3d(-50%, 26px, 0); opacity: 0; z-index: 11; }
        .topics-cinematic-cta a { min-height: 3.18rem; border-radius: 999px; padding: .74rem 1.92rem; display: inline-flex; align-items: center; justify-content: center; font-family: ${FONT_FAMILY}; font-size: clamp(.82rem, 1vw, .94rem); font-weight: 600; letter-spacing: .012em; transition: transform 280ms var(--tp-ease), opacity 280ms var(--tp-ease), box-shadow 280ms var(--tp-ease), border-color 280ms var(--tp-ease), background-color 280ms var(--tp-ease); }
        .topics-cinematic-cta__primary { border: 1px solid rgba(176,218,255,.62); color: #041226; background: linear-gradient(135deg, #b5dbff, #8fc9fb); box-shadow: 0 6px 14px rgba(8,35,64,.22), inset 0 0 0 .5px rgba(255,255,255,.25); }
        .topics-cinematic-cta__secondary { border: 1px solid rgba(142,183,227,.34); color: rgba(229,241,255,.94); background: rgba(10,23,44,.7); box-shadow: inset 0 0 0 .5px rgba(181,216,252,.12); }
        @media (hover: hover) {
          .topics-cinematic-cta a:hover { transform: translate3d(0, -1px, 0); }
          .topics-cinematic-cta__primary:hover { box-shadow: 0 8px 16px rgba(8,35,64,.24), 0 0 12px rgba(148,206,255,.2), inset 0 0 0 .5px rgba(255,255,255,.28); }
          .topics-cinematic-cta__secondary:hover { border-color: rgba(168,207,246,.5); box-shadow: 0 0 10px rgba(126,189,245,.12), inset 0 0 0 .5px rgba(186,221,255,.16); }
        }

        @media (max-width: 991.98px) {
          .topics-scene.topics-scene--cinematic { min-height: 218vh; }
          .topics-scene.topics-scene--cinematic { --tp-center-orb-size: clamp(11rem, 40vw, 16rem); }
          .topics-cinematic-progress { width: min(88vw, 640px); }
          .topics-cinematic-head { top: clamp(4.6rem, 17vh, 8.2rem); width: min(94vw, 680px); }
          .topics-cinematic-head__title { font-size: clamp(1.85rem, 6.7vw, 3.25rem); line-height: 1.08; }
          .topics-cinematic-head__subtitle { max-width: 48ch; font-size: clamp(.8rem, 1.8vw, 1rem); line-height: 1.65; }
          .topics-cinematic-cta { width: min(94vw, 520px); gap: var(--tp-2); }
        }

        @media (max-width: 767.98px) {
          .topics-scene.topics-scene--cinematic { min-height: 208vh; }
          .topics-scene.topics-scene--cinematic { --tp-center-orb-size: clamp(8.6rem, 48vw, 11.4rem); }
          .topics-cinematic-progress { top: 1rem; width: min(90vw, 360px); }
          .topics-cinematic-head { top: clamp(4.2rem, 14vh, 6.5rem); width: min(93vw, 25rem); gap: 12px; }
          .topics-cinematic-head__title { font-size: clamp(1.5rem, 8.8vw, 2.35rem); }
          .topics-cinematic-head__subtitle { font-size: clamp(.75rem, 3.5vw, .9rem); line-height: 1.62; }
          .topics-cinematic-orb strong { font-size: clamp(1.05rem, 4.4vw, 1.4rem); }
          .topics-cinematic-orb small { font-size: clamp(.68rem, 3.2vw, .8rem); }
          .topics-cinematic-cta { width: min(92vw, 23.5rem); flex-direction: column; gap: 14px; }
          .topics-cinematic-cta a { width: 100%; min-height: 2.88rem; font-size: .78rem; }
        }

        .topics-scene.topics-scene--cinematic.topics-reduced-motion .topics-cinematic-head,
        .topics-scene.topics-scene--cinematic.topics-reduced-motion .topics-cinematic-cta,
        .topics-scene.topics-scene--cinematic.topics-reduced-motion .topics-cinematic-progress span,
        .topics-scene.topics-scene--cinematic.topics-reduced-motion #topicsCanvas.topics-cinematic-canvas {
          transform: none !important;
          transition: opacity 240ms var(--tp-ease) !important;
        }

        .topics-scene.topics-scene--cinematic.topics-reduced-motion .topics-cinematic-orb {
          transform: translate3d(-50%, -50%, 0) scale(1) !important;
          transition: opacity 240ms var(--tp-ease) !important;
        }
      `;

      document.head.appendChild(style);
    }

    function ensureStructure() {
      if (!section || !surface) {
        return;
      }

      section.classList.add("topics-scene--cinematic");
      surface.classList.add("topics-surface--cinematic");

      dropZone = document.getElementById("topicsWorld");
      if (dropZone) {
        dropZone.classList.add("topics-cinematic-dropzone");
      }

      canvas = document.getElementById("topicsCanvas");
      if (canvas) {
        canvas.classList.add("topics-cinematic-canvas");
      }

      let head = document.getElementById("topicsCinematicHead");
      if (!head) {
        const existingHead = surface.querySelector(".topics-head");
        head = existingHead || document.createElement("div");
        if (!existingHead) {
          surface.appendChild(head);
        }
      }

      head.className = "topics-cinematic-head";
      head.id = "topicsCinematicHead";
      head.innerHTML = `
        <h2 class="topics-cinematic-head__title">سیستم رشد حرفه‌ای برای سایت شما</h2>
        <p class="topics-cinematic-head__subtitle">مهارت‌ها کنار هم قرار می‌گیرند تا نتیجه‌ای متفاوت بسازند</p>
      `;

      let progress = document.getElementById("topicsCinematicProgress");
      if (!progress) {
        progress = document.createElement("div");
        progress.id = "topicsCinematicProgress";
        progress.className = "topics-cinematic-progress";
        progress.setAttribute("aria-hidden", "true");
        progress.innerHTML = '<span id="topicsCinematicProgressBar"></span>';
        surface.prepend(progress);
      }

      let orb = document.getElementById("topicsCinematicOrb");
      if (!orb) {
        orb = document.createElement("div");
        orb.id = "topicsCinematicOrb";
        orb.className = "topics-cinematic-orb";
        orb.innerHTML = `
          <strong>رشد هدفمند</strong>
          <small>نتیجه‌ی هماهنگی همه مهارت‌ها</small>
        `;
        surface.appendChild(orb);
      }

      let ctaElement = document.getElementById("topicsCinematicCta");
      if (!ctaElement) {
        ctaElement = document.createElement("div");
        ctaElement.id = "topicsCinematicCta";
        ctaElement.className = "topics-cinematic-cta";
        ctaElement.innerHTML = `
          <a class="topics-cinematic-cta__primary" href="#contact">شروع همکاری</a>
          <a class="topics-cinematic-cta__secondary" href="#learning">نمونه‌کارها را ببین</a>
        `;
        surface.appendChild(ctaElement);
      }
    }

    function tierRadius(tier, minSide, compact = false, spacious = false) {
      if (tier === "large") {
        return clamp(minSide * (compact ? 0.062 : spacious ? 0.088 : 0.078), compact ? 30 : 44, spacious ? 92 : 76);
      }
      if (tier === "medium") {
        return clamp(minSide * (compact ? 0.051 : spacious ? 0.066 : 0.059), compact ? 24 : 34, spacious ? 68 : 58);
      }
      return clamp(minSide * (compact ? 0.044 : spacious ? 0.056 : 0.05), compact ? 20 : 28, spacious ? 56 : 46);
    }

    function tierSpeed(tier) {
      if (tier === "large") {
        return 0.92;
      }
      if (tier === "small") {
        return 1.1;
      }
      return 1;
    }

    function tierPalette(tier) {
      if (tier === "large") {
        return { base: "#0d294b", mid: "#1a456f", highlight: "#75aedb" };
      }
      if (tier === "medium") {
        return { base: "#0b2440", mid: "#153c62", highlight: "#679dc9" };
      }
      return { base: "#091d33", mid: "#11304d", highlight: "#5c8bb1" };
    }

    function resolveCenterOrbDiameter(viewportWidth) {
      const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      if (viewportWidth <= 767.98) {
        return clamp(viewportWidth * 0.48, 8.6 * rootFontSize, 11.4 * rootFontSize);
      }
      if (viewportWidth <= 991.98) {
        return clamp(viewportWidth * 0.4, 11 * rootFontSize, 16 * rootFontSize);
      }
      return clamp(viewportWidth * 0.28, 13 * rootFontSize, 23 * rootFontSize);
    }

    function resolveOrbCollisions(centerX, centerY, centerRadius, compact) {
      const iterations = compact ? 8 : 10;
      const pairGap = compact ? 8 : 11;
      const sidePadding = compact ? 8 : 12;
      const topPadding = compact ? 56 : 36;
      const mobileMaxY = centerY + centerRadius * 0.26;
      const bottomPadding = compact ? 148 : 110;
      const maxY = compact ? Math.min(height - bottomPadding, mobileMaxY) : height - bottomPadding;

      for (let iter = 0; iter < iterations; iter += 1) {
        for (let i = 0; i < orbStates.length; i += 1) {
          for (let j = i + 1; j < orbStates.length; j += 1) {
            const orbA = orbStates[i];
            const orbB = orbStates[j];
            let dx = orbB.finalX - orbA.finalX;
            let dy = orbB.finalY - orbA.finalY;
            let dist = Math.hypot(dx, dy);
            const minDist = orbA.radius + orbB.radius + pairGap;

            if (dist >= minDist) {
              continue;
            }

            if (dist < 0.001) {
              dx = (j - i) % 2 === 0 ? 1 : -1;
              dy = 0.45;
              dist = Math.hypot(dx, dy);
            }

            const push = (minDist - dist) * 0.5;
            const nx = dx / dist;
            const ny = dy / dist;

            orbA.finalX -= nx * push;
            orbA.finalY -= ny * push;
            orbB.finalX += nx * push;
            orbB.finalY += ny * push;
          }
        }

        orbStates.forEach((orb) => {
          let dx = orb.finalX - centerX;
          let dy = orb.finalY - centerY;
          let dist = Math.hypot(dx, dy);
          const minCenterDist = centerRadius + orb.radius + (compact ? 10 : 14);

          if (dist < minCenterDist) {
            if (dist < 0.001) {
              dx = orb.lane - 1;
              dy = -1;
              dist = Math.hypot(dx, dy);
            }
            const nx = dx / dist;
            const ny = dy / dist;
            const pushOut = minCenterDist - dist;
            orb.finalX += nx * pushOut;
            orb.finalY += ny * pushOut;
          }

          orb.finalX = clamp(orb.finalX, sidePadding + orb.radius, width - sidePadding - orb.radius);
          orb.finalY = clamp(orb.finalY, topPadding + orb.radius, maxY - orb.radius);
        });
      }

      // Keep the cluster centered and avoid drifting to a single side.
      let sumX = 0;
      let sumY = 0;
      orbStates.forEach((orb) => {
        sumX += orb.finalX;
        sumY += orb.finalY;
      });

      const avgX = sumX / orbStates.length;
      const avgY = sumY / orbStates.length;
      const targetAvgY = compact ? centerY - centerRadius * 0.5 : centerY - centerRadius * 0.12;
      const shiftX = (centerX - avgX) * 0.72;
      const shiftY = (targetAvgY - avgY) * 0.46;

      orbStates.forEach((orb) => {
        orb.finalX = clamp(orb.finalX + shiftX, sidePadding + orb.radius, width - sidePadding - orb.radius);
        orb.finalY = clamp(orb.finalY + shiftY, topPadding + orb.radius, maxY - orb.radius);
      });
    }

    function buildAmbientLayout(centerX, centerY, centerRadius, compact) {
      const minSide = Math.min(width, height);
      const nodeCount = compact ? 8 : width >= 1200 ? 16 : 12;

      ambientNodes = Array.from({ length: nodeCount }, (_, index) => {
        const rx = pseudoRandom(index, 1);
        const ry = pseudoRandom(index, 2);
        const rz = pseudoRandom(index, 3);
        const zone = index % 3;

        let x = width * (0.06 + rx * 0.88);
        let y = zone === 0 ? height * (0.14 + ry * 0.3) : zone === 1 ? height * (0.46 + ry * 0.28) : height * (0.7 + ry * 0.22);

        const toCenter = Math.hypot(x - centerX, y - centerY);
        if (toCenter < centerRadius * 1.55) {
          y += centerRadius * 0.9;
        }

        y = clamp(y, 22, height - 18);
        x = clamp(x, 18, width - 18);

        return {
          x,
          y,
          radius: clamp(minSide * (0.01 + rz * 0.014), compact ? 2.1 : 2.6, compact ? 6.8 : 9.4),
          alpha: 0.028 + rz * 0.048
        };
      });

      const beamCount = compact ? 2 : 3;
      ambientBeams = Array.from({ length: beamCount }, (_, index) => {
        const spread = beamCount === 2 ? [0.32, 0.68] : [0.22, 0.5, 0.78];
        const rand = pseudoRandom(index, 6);
        return {
          x: width * spread[index],
          width: clamp(minSide * (compact ? 0.18 : 0.16) * (0.92 + rand * 0.2), compact ? 58 : 82, compact ? 120 : 186),
          alpha: 0.032 + rand * 0.022
        };
      });
    }

    function paintAmbientBuffer() {
      if (!context || width <= 0 || height <= 0) {
        return;
      }

      if (!ambientBuffer) {
        ambientBuffer = document.createElement("canvas");
      }

      if (!ambientBufferContext) {
        ambientBufferContext = ambientBuffer.getContext("2d");
      }

      if (!ambientBufferContext) {
        return;
      }

      ambientBuffer.width = width;
      ambientBuffer.height = height;
      ambientBufferContext.clearRect(0, 0, width, height);

      ambientBeams.forEach((beam) => {
        const x = beam.x;
        const gradient = ambientBufferContext.createLinearGradient(x, height, x, height * 0.12);
        gradient.addColorStop(0, `rgba(112, 174, 236, ${beam.alpha})`);
        gradient.addColorStop(0.58, `rgba(112, 174, 236, ${(beam.alpha * 0.28).toFixed(3)})`);
        gradient.addColorStop(1, "rgba(112, 174, 236, 0)");
        ambientBufferContext.fillStyle = gradient;
        ambientBufferContext.fillRect(x - beam.width * 0.5, height * 0.12, beam.width, height * 0.9);
      });

      ambientNodes.forEach((node) => {
        const gradient = ambientBufferContext.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius);
        gradient.addColorStop(0, `rgba(165, 214, 255, ${node.alpha})`);
        gradient.addColorStop(1, "rgba(165, 214, 255, 0)");
        ambientBufferContext.fillStyle = gradient;
        ambientBufferContext.beginPath();
        ambientBufferContext.arc(node.x, node.y, node.radius, 0, TAU);
        ambientBufferContext.fill();
      });
    }

    function drawAmbient() {
      if (!context) {
        return;
      }

      if (!ambientBuffer || !ambientBufferContext) {
        return;
      }

      context.drawImage(ambientBuffer, 0, 0, width, height);
    }

    function splitSmallLabel(label) {
      const normalized = String(label || "").trim();
      const parts = normalized.split(/\s+/).filter(Boolean);

      if (parts.length >= 2) {
        if (parts.length === 2) {
          return parts;
        }
        const half = Math.ceil(parts.length / 2);
        return [parts.slice(0, half).join(" "), parts.slice(half).join(" ")];
      }

      const zwnjIndex = normalized.indexOf("\u200c");
      if (zwnjIndex > 2 && zwnjIndex < normalized.length - 2) {
        return [normalized.slice(0, zwnjIndex), normalized.slice(zwnjIndex + 1)];
      }

      return [normalized];
    }

    function normalizeLabelLines(lines, maxLines) {
      const cleaned = lines
        .map((line) => String(line || "").trim())
        .filter(Boolean);

      if (!cleaned.length) {
        return [];
      }

      if (cleaned.length <= maxLines) {
        return cleaned;
      }

      const grouped = [];
      let cursor = 0;
      for (let slot = 0; slot < maxLines; slot += 1) {
        const remainingLines = cleaned.length - cursor;
        const remainingSlots = maxLines - slot;
        const take = Math.ceil(remainingLines / remainingSlots);
        grouped.push(cleaned.slice(cursor, cursor + take).join(" "));
        cursor += take;
      }
      return grouped.filter(Boolean);
    }

    function buildLabelLineCandidates(label, allowThreeLines) {
      const normalized = String(label || "").trim().replace(/\s+/g, " ");
      if (!normalized) {
        return [[""]];
      }

      const words = normalized.split(" ").filter(Boolean);
      const zwnjExpanded = words.flatMap((word) => {
        const parts = word.split("\u200c").map((part) => part.trim()).filter(Boolean);
        return parts.length ? parts : [word];
      });

      const maxLines = allowThreeLines ? 3 : 2;
      const candidates = [];
      const seen = new Set();
      const pushCandidate = (lines) => {
        const normalizedLines = normalizeLabelLines(lines, maxLines);
        if (!normalizedLines.length) {
          return;
        }
        const key = normalizedLines.join("|");
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        candidates.push(normalizedLines);
      };

      pushCandidate([normalized]);

      if (words.length > 1) {
        pushCandidate(words);
        const half = Math.ceil(words.length / 2);
        pushCandidate([words.slice(0, half).join(" "), words.slice(half).join(" ")]);
      }

      if (zwnjExpanded.length > 1) {
        pushCandidate(zwnjExpanded);
        const half = Math.ceil(zwnjExpanded.length / 2);
        pushCandidate([zwnjExpanded.slice(0, half).join(" "), zwnjExpanded.slice(half).join(" ")]);
      }

      if (allowThreeLines && zwnjExpanded.length >= 3) {
        const third = Math.ceil(zwnjExpanded.length / 3);
        pushCandidate([
          zwnjExpanded.slice(0, third).join(" "),
          zwnjExpanded.slice(third, third * 2).join(" "),
          zwnjExpanded.slice(third * 2).join(" ")
        ]);
      }

      return candidates;
    }

    function resolveLabelLayout(orb) {
      const compactViewport = width <= 767.98;
      const isSmall = orb.tier === "small";
      const isMedium = orb.tier === "medium";
      const fontWeight = isSmall ? 620 : isMedium ? 680 : 700;
      const maxWidth = orb.radius * (isSmall ? (compactViewport ? 1.5 : 1.46) : compactViewport ? 1.62 : 1.58);
      const minSize = isSmall ? (compactViewport ? 8.2 : 9.4) : isMedium ? (compactViewport ? 8.8 : 9.8) : compactViewport ? 9.8 : 10.8;
      const maxSize = isSmall ? (compactViewport ? 14.2 : 19) : isMedium ? (compactViewport ? 16.4 : 22) : compactViewport ? 18.4 : 28;
      const baseSize = clamp(
        orb.radius * (isSmall ? (compactViewport ? 0.215 : 0.26) : isMedium ? (compactViewport ? 0.25 : 0.3) : compactViewport ? 0.28 : 0.34),
        minSize,
        maxSize
      );
      const allowThreeLines = isSmall || compactViewport;
      const lineCandidates = buildLabelLineCandidates(orb.label, allowThreeLines);
      if (isSmall) {
        lineCandidates.unshift(splitSmallLabel(orb.label));
      }

      const cacheKey = `${orb.label}|${orb.radius}|${fontWeight}|${compactViewport ? "m" : "d"}|${lineCandidates.map((lines) => lines.join("|")).join("::")}`;
      const cached = textSizeCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      let best = null;

      lineCandidates.forEach((labelLines) => {
        let size = baseSize;
        while (size >= minSize) {
          context.font = `${fontWeight} ${size}px ${FONT_FAMILY}`;
          const fits = labelLines.every((line) => context.measureText(line).width <= maxWidth);
          if (fits) {
            if (!best || size > best.fontSize || (Math.abs(size - best.fontSize) < 0.01 && labelLines.length < best.labelLines.length)) {
              best = { fontSize: size, labelLines };
            }
            break;
          }
          size -= 0.4;
        }
      });

      if (!best) {
        best = {
          fontSize: minSize,
          labelLines: normalizeLabelLines(lineCandidates[0] || [orb.label], allowThreeLines ? 3 : 2)
        };
      }

      const layout = {
        fontSize: best.fontSize,
        fontWeight,
        labelLines: best.labelLines,
        lineHeight: best.fontSize * (isSmall ? 1.16 : 1.13)
      };

      textSizeCache.set(cacheKey, layout);
      return layout;
    }

    function buildOrbSprite(orb) {
      const spriteDpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const padding = 3;
      const size = Math.ceil(orb.radius * 2 + padding * 2);
      const canvasEl = document.createElement("canvas");
      canvasEl.width = Math.max(1, Math.floor(size * spriteDpr));
      canvasEl.height = Math.max(1, Math.floor(size * spriteDpr));
      const ctx = canvasEl.getContext("2d");
      if (!ctx) {
        orb.sprite = null;
        orb.spriteSize = size;
        return;
      }

      ctx.setTransform(spriteDpr, 0, 0, spriteDpr, 0, 0);
      const cx = size * 0.5;
      const cy = size * 0.5;
      const radius = orb.radius;
      const rim = Math.max(0.55, radius * 0.015);
      const lightOffsetX = (orb.lane - 1) * radius * 0.11 + (orb.index % 2 === 0 ? -radius * 0.07 : radius * 0.05);
      const lightOffsetY = -radius * (0.28 + (orb.index % 3) * 0.016);

      ctx.shadowColor = "rgba(2, 8, 20, 0.14)";
      ctx.shadowBlur = Math.min(5.5, radius * 0.1);
      ctx.shadowOffsetY = Math.max(1, radius * 0.05);

      const gradient = ctx.createRadialGradient(
        cx + lightOffsetX,
        cy + lightOffsetY,
        radius * 0.12,
        cx,
        cy,
        radius
      );
      gradient.addColorStop(0, orb.palette.highlight);
      gradient.addColorStop(0.24, orb.palette.mid);
      gradient.addColorStop(0.66, orb.palette.base);
      gradient.addColorStop(1, orb.palette.base);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const highlightGradient = ctx.createRadialGradient(
        cx + lightOffsetX * 0.92,
        cy + lightOffsetY * 0.92,
        radius * 0.06,
        cx + lightOffsetX * 0.68,
        cy + lightOffsetY * 0.7,
        radius * 0.44
      );
      highlightGradient.addColorStop(0, "rgba(245, 252, 255, 0.075)");
      highlightGradient.addColorStop(1, "rgba(245, 252, 255, 0)");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fillStyle = highlightGradient;
      ctx.fill();

      const secondaryHighlight = ctx.createRadialGradient(
        cx + lightOffsetX * 0.22,
        cy + lightOffsetY * 0.42,
        radius * 0.02,
        cx + lightOffsetX * 0.42,
        cy + lightOffsetY * 0.3,
        radius * 0.3
      );
      secondaryHighlight.addColorStop(0, "rgba(236, 247, 255, 0.045)");
      secondaryHighlight.addColorStop(1, "rgba(236, 247, 255, 0)");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fillStyle = secondaryHighlight;
      ctx.fill();

      const lowerShade = ctx.createRadialGradient(
        cx + radius * 0.16,
        cy + radius * 0.42,
        radius * 0.12,
        cx,
        cy + radius * 0.38,
        radius * 0.96
      );
      lowerShade.addColorStop(0, "rgba(3, 11, 21, 0)");
      lowerShade.addColorStop(1, "rgba(3, 11, 21, 0.15)");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fillStyle = lowerShade;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - rim, 0, TAU);
      ctx.strokeStyle = "rgba(219, 235, 250, 0.082)";
      ctx.lineWidth = rim;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.76, Math.PI * 1.27, Math.PI * 1.63);
      ctx.strokeStyle = "rgba(250, 255, 255, 0.066)";
      ctx.lineWidth = Math.max(0.5, radius * 0.018);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.88, Math.PI * 0.2, Math.PI * 0.78);
      ctx.strokeStyle = "rgba(188, 213, 238, 0.05)";
      ctx.lineWidth = Math.max(0.45, radius * 0.015);
      ctx.stroke();

      ctx.font = `${orb.fontWeight || 700} ${orb.fontSize}px ${FONT_FAMILY}`;
      ctx.fillStyle = "rgba(236, 246, 255, 0.96)";
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (orb.labelLines && orb.labelLines.length > 1) {
        const totalHeight = (orb.labelLines.length - 1) * orb.lineHeight;
        const firstLineY = cy - totalHeight / 2 + orb.fontSize * 0.02;
        orb.labelLines.forEach((line, lineIndex) => {
          ctx.fillText(line, cx, firstLineY + lineIndex * orb.lineHeight);
        });
      } else {
        ctx.fillText(orb.label, cx, cy + orb.fontSize * 0.03);
      }

      orb.sprite = canvasEl;
      orb.spriteSize = size;
    }

    function buildOrbs() {
      const total = ORBS.length;
      orbStates = ORBS.map((orb, index) => {
        const spawnStep = 0.3 / (total + 1);
        return {
          ...orb,
          index,
          radius: 0,
          laneX: 0,
          laneY: 0,
          startY: 0,
          finalX: 0,
          finalY: 0,
          targetX: 0,
          targetY: 0,
          targetOpacity: 0,
          renderX: 0,
          renderY: 0,
          renderOpacity: 0,
          speedMultiplier: tierSpeed(orb.tier),
          dropDuration: 0.2,
          spawnStart: 0.15 + spawnStep * (index + 0.45),
          formationDelay: index * 0.006,
          fontSize: 14,
          fontWeight: 700,
          labelLines: [orb.label],
          lineHeight: 16,
          palette: tierPalette(orb.tier)
        };
      });
      drawOrder = [...orbStates].sort((a, b) => a.radius - b.radius);
    }

    function computeMetrics() {
      if (!section) {
        return;
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
      const rect = section.getBoundingClientRect();
      sectionTop = rect.top + getScrollY();
      sectionRange = Math.max((section.offsetHeight || rect.height || viewportHeight) - viewportHeight, 1);
    }

    function readSectionProgress() {
      const raw = clamp((lastScrollY - sectionTop) / sectionRange, 0, 1);
      const activeRange = 1 - HOLD_PROGRESS_TAIL;
      if (raw >= activeRange) {
        return 1;
      }
      return raw / activeRange;
    }

    function computeLayout() {
      if (!canvas || !context || !dropZone) {
        return;
      }

      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = Math.max(1, dropZone.clientWidth);
      height = Math.max(1, dropZone.clientHeight);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const mobile = width <= 767.98;
      const tablet = width <= 991.98;
      const spaciousDesktop = width >= 1200;
      const minSide = Math.min(width, height);
      const lanes = mobile ? [width * 0.18, width * 0.5, width * 0.82] : [width * 0.22, width * 0.5, width * 0.78];
      const laneTop = height * (mobile ? 0.14 : 0.16);
      const laneGap = Math.max(20, minSide * 0.022);
      const laneCursor = [laneTop, laneTop, laneTop];

      const centerX = width * 0.5;
      const centerY = mobile ? height * 0.48 : spaciousDesktop ? height * 0.53 : height * 0.51;
      const centerRadius = resolveCenterOrbDiameter(width) * 0.5;

      const baseLarge = tierRadius("large", minSide, mobile, spaciousDesktop);
      const baseMedium = tierRadius("medium", minSide, mobile, spaciousDesktop);
      const baseSmall = tierRadius("small", minSide, mobile, spaciousDesktop);

      const ringLarge = centerRadius + baseLarge + (mobile ? 52 : tablet ? 92 : spaciousDesktop ? 136 : 122);
      const ringMedium = centerRadius + baseMedium + (mobile ? 38 : tablet ? 70 : spaciousDesktop ? 104 : 92);
      const ringSmall = centerRadius + baseSmall + (mobile ? 28 : tablet ? 54 : spaciousDesktop ? 76 : 66);

      const tierAngles = mobile
        ? {
            large: [-160, -100, -40],
            medium: [-168, -132, -86, -42, -10],
            small: [-148, -112, -70, -30]
          }
        : tablet
          ? {
              large: [-154, -96, -36],
              medium: [-168, -126, -70, -16, 36],
              small: [-146, -98, -20, 78]
            }
          : {
              large: [-150, -92, -34],
              medium: [-170, -124, -62, -2, 42],
              small: [-140, -86, -8, 90]
            };
      const tierRingOffsets = {
        large: [0, 8, 0],
        medium: [12, -4, 8, -6, 10],
        small: [-4, 6, -6, 8]
      };
      const labelOffsets = mobile
        ? {
            "بهینه‌سازی تبدیل": { x: -4, y: -22 },
            "کدنویسی تمیز": { x: 0, y: -24 }
          }
        : tablet
          ? {
              "بهینه‌سازی تبدیل": { x: -6, y: -28 },
              "کدنویسی تمیز": { x: -2, y: -30 }
            }
          : {
              "بهینه‌سازی تبدیل": { x: -8, y: -34 },
              "کدنویسی تمیز": { x: -4, y: -36 }
            };
      const tierIndex = { large: 0, medium: 0, small: 0 };

      textSizeCache.clear();

      orbStates.forEach((orb) => {
        orb.radius = tierRadius(orb.tier, minSide, mobile, spaciousDesktop);
        orb.laneX = lanes[orb.lane];

        const laneY = laneCursor[orb.lane] + orb.radius;
        laneCursor[orb.lane] = laneY + orb.radius + laneGap;

        orb.laneY = laneY;
        orb.startY = -orb.radius * 2 - (orb.index % 3) * 28;
        orb.dropDuration = 0.18 / orb.speedMultiplier + 0.045;

        const tierSlot = tierIndex[orb.tier];
        const angle = toRadians(tierAngles[orb.tier][tierSlot]);
        tierIndex[orb.tier] += 1;

        const ringBase = orb.tier === "large" ? ringLarge : orb.tier === "medium" ? ringMedium : ringSmall;
        const ringOffset = tierRingOffsets[orb.tier][tierSlot] || 0;
        const ring = ringBase + ringOffset;

        orb.finalX = centerX + Math.cos(angle) * ring;
        orb.finalY = centerY + Math.sin(angle) * ring;
        if (labelOffsets[orb.label]) {
          orb.finalX += labelOffsets[orb.label].x;
          orb.finalY += labelOffsets[orb.label].y;
        }

        orb.targetX = orb.laneX;
        orb.targetY = orb.startY;
        orb.targetOpacity = 0;
        orb.renderX = orb.laneX;
        orb.renderY = orb.startY;
        orb.renderOpacity = 0;

        orb.palette = tierPalette(orb.tier);
        const textLayout = resolveLabelLayout(orb);
        orb.fontSize = textLayout.fontSize;
        orb.fontWeight = textLayout.fontWeight;
        orb.labelLines = textLayout.labelLines;
        orb.lineHeight = textLayout.lineHeight;
        buildOrbSprite(orb);
      });

      resolveOrbCollisions(centerX, centerY, centerRadius, mobile);
      buildAmbientLayout(centerX, centerY, centerRadius, mobile);
      paintAmbientBuffer();

      drawOrder = [...orbStates].sort((a, b) => a.radius - b.radius);
    }

    function setAnimatingScope(active) {
      if (isAnimatingScope === active) {
        return;
      }

      isAnimatingScope = active;
      [headline, resultOrb, cta, canvas].forEach((node) => {
        if (node instanceof Element) {
          node.classList.toggle("is-animating", active);
        }
      });
    }

    function updateOrbTargets(progress) {
      orbStates.forEach((orb) => {
        const dropRaw = mapProgress(progress, orb.spawnStart, orb.dropDuration);
        const dropEase = easeOutCubic(dropRaw);

        const dropX = orb.laneX;
        const dropY = lerp(orb.startY, orb.laneY, dropEase);

        const formationRaw = mapProgress(progress, 0.45 + orb.formationDelay, 0.35);
        const formationEase = easeInOutCubic(formationRaw);

        const settle = smoothstep(mapProgress(progress, 0.8, 0.2));

        let x = lerp(dropX, orb.finalX, formationEase);
        let y = lerp(dropY, orb.finalY, formationEase);

        const drift = 1 - settle;
        x += (orb.lane - 1) * drift * 2;
        y += drift * 1.2;

        const appear = smoothstep(mapProgress(progress, orb.spawnStart - 0.02, 0.08));
        const alpha = appear * (0.78 + 0.22 * formationEase);

        orb.targetX = x;
        orb.targetY = y;
        orb.targetOpacity = alpha;
      });
    }

    function animateOrbs() {
      let hasMotion = false;

      orbStates.forEach((orb) => {
        const nextX = lerp(orb.renderX, orb.targetX, ORB_SMOOTHING);
        const nextY = lerp(orb.renderY, orb.targetY, ORB_SMOOTHING);
        const nextOpacity = lerp(orb.renderOpacity, orb.targetOpacity, ORB_SMOOTHING);

        if (
          Math.abs(nextX - orb.renderX) > 0.02 ||
          Math.abs(nextY - orb.renderY) > 0.02 ||
          Math.abs(nextOpacity - orb.renderOpacity) > 0.002
        ) {
          hasMotion = true;
        }

        orb.renderX = nextX;
        orb.renderY = nextY;
        orb.renderOpacity = nextOpacity;
      });

      return hasMotion;
    }

    function drawOrb(orb) {
      if (!context || orb.renderOpacity <= 0.001) {
        return;
      }

      context.save();
      context.globalAlpha = clamp(orb.renderOpacity, 0, 1);
      if (orb.sprite && orb.spriteSize) {
        const half = orb.spriteSize * 0.5;
        context.drawImage(orb.sprite, orb.renderX - half, orb.renderY - half, orb.spriteSize, orb.spriteSize);
        context.restore();
        return;
      }

      // Fallback path if sprite generation fails.
      context.fillStyle = orb.palette.base;
      context.beginPath();
      context.arc(orb.renderX, orb.renderY, orb.radius, 0, TAU);
      context.fill();

      context.font = `${orb.fontWeight || 700} ${orb.fontSize}px ${FONT_FAMILY}`;
      context.fillStyle = "rgba(236, 246, 255, 0.94)";
      context.direction = "rtl";
      context.textAlign = "center";
      context.textBaseline = "middle";
      if (orb.labelLines && orb.labelLines.length > 1) {
        const totalHeight = (orb.labelLines.length - 1) * orb.lineHeight;
        const firstLineY = orb.renderY - totalHeight / 2 + orb.fontSize * 0.02;
        orb.labelLines.forEach((line, lineIndex) => {
          context.fillText(line, orb.renderX, firstLineY + lineIndex * orb.lineHeight);
        });
      } else {
        context.fillText(orb.label, orb.renderX, orb.renderY + orb.fontSize * 0.03);
      }

      context.restore();
    }

    function renderCanvas() {
      if (!context) {
        return;
      }

      context.clearRect(0, 0, width, height);
      drawAmbient();
      drawOrder.forEach(drawOrb);
    }

    function applyNarrative(progress) {
      if (!headline || !progressBar || !resultOrb || !cta) {
        return;
      }

      const inHead = smoothstep(mapProgress(progress, 0, 0.12));
      const outHead = smoothstep(mapProgress(progress, 0.16, 0.18));
      const headOpacity = clamp(inHead * (1 - outHead), 0, 1);
      const headY = lerp(22, -8, outHead);
      headline.style.opacity = headOpacity.toFixed(3);
      headline.style.transform = `translate3d(-50%, ${headY.toFixed(2)}px, 0)`;

      progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
      progressBar.style.opacity = (0.22 + progress * 0.72).toFixed(3);

      const orbReveal = smoothstep(mapProgress(progress, 0.45, 0.2));
      const pulseWindow = mapProgress(progress, 0.86, 0.12);
      const pulse = pulseWindow > 0 && pulseWindow < 1 ? Math.sin(Math.PI * pulseWindow) : 0;
      const tailGlow = smoothstep(mapProgress(progress, 0.82, 0.18));
      const orbScale = 1 + pulse * 0.015;
      const orbY = lerp(28, 0, orbReveal);

      resultOrb.style.opacity = orbReveal.toFixed(3);
      resultOrb.style.transform = `translate3d(-50%, calc(-50% + ${orbY.toFixed(2)}px), 0) scale(${orbScale.toFixed(4)})`;
      resultOrb.style.setProperty("--tp-glow", (tailGlow * 0.34 + pulse * 0.22).toFixed(3));
      resultOrb.style.setProperty("--tp-cap", (0.16 + tailGlow * 0.1 + pulse * 0.05).toFixed(3));

      const ctaReveal = smoothstep(mapProgress(progress, 0.9, 0.09));
      const ctaY = lerp(30, 0, ctaReveal);
      cta.style.opacity = ctaReveal.toFixed(3);
      cta.style.transform = `translate3d(-50%, ${ctaY.toFixed(2)}px, 0)`;
      cta.style.pointerEvents = ctaReveal > 0.84 ? "auto" : "none";
    }

    function applyReducedLayout(visible) {
      if (!section || !headline || !progressBar || !resultOrb || !cta || !canvas) {
        return;
      }

      section.classList.add("topics-reduced-motion");
      section.classList.toggle("topics-reduced-visible", visible);

      headline.style.opacity = visible ? "1" : "0";
      headline.style.transform = "translate3d(-50%, 0, 0)";

      progressBar.style.transform = visible ? "scaleX(1)" : "scaleX(0)";
      progressBar.style.opacity = visible ? "1" : "0";

      resultOrb.style.opacity = visible ? "1" : "0";
      resultOrb.style.transform = "translate3d(-50%, -50%, 0) scale(1)";
      resultOrb.style.setProperty("--tp-glow", "0");
      resultOrb.style.setProperty("--tp-cap", "0.16");

      cta.style.opacity = visible ? "1" : "0";
      cta.style.transform = "translate3d(-50%, 0, 0)";
      cta.style.pointerEvents = visible ? "auto" : "none";

      canvas.style.opacity = visible ? "1" : "0";

      orbStates.forEach((orb) => {
        orb.renderX = orb.finalX;
        orb.renderY = orb.finalY;
        orb.renderOpacity = visible ? 1 : 0;
        orb.targetX = orb.finalX;
        orb.targetY = orb.finalY;
        orb.targetOpacity = visible ? 1 : 0;
      });

      renderCanvas();
      setAnimatingScope(false);
    }

    function requestTick() {
      if (!isVisible || reducedMotion || tickRafId) {
        return;
      }
      tickRafId = window.requestAnimationFrame(tick);
    }

    function tick() {
      tickRafId = 0;

      if (!isVisible || reducedMotion) {
        setAnimatingScope(false);
        return;
      }

      const progressDelta = targetProgress - currentProgress;
      currentProgress += progressDelta * PROGRESS_SMOOTHING;
      if (Math.abs(progressDelta) <= PROGRESS_EPSILON) {
        currentProgress = targetProgress;
      }

      updateOrbTargets(currentProgress);
      const orbMotion = animateOrbs();
      renderCanvas();
      applyNarrative(currentProgress);

      const keepTicking = orbMotion || Math.abs(targetProgress - currentProgress) > PROGRESS_EPSILON;
      setAnimatingScope(keepTicking);
      if (keepTicking) {
        requestTick();
      }
    }

    function syncProgress() {
      if (reducedMotion || !isVisible) {
        return;
      }

      targetProgress = readSectionProgress();
      requestTick();
    }

    function scheduleProgress() {
      if (progressRafId || reducedMotion || !isVisible) {
        return;
      }

      progressRafId = window.requestAnimationFrame(() => {
        progressRafId = 0;
        syncProgress();
      });
    }

    function handleScroll() {
      lastScrollY = getScrollY();
      scheduleProgress();
    }

    function refreshLayout() {
      computeLayout();
      computeMetrics();
      lastScrollY = getScrollY();

      if (reducedMotion) {
        applyReducedLayout(isVisible);
        return;
      }

      targetProgress = readSectionProgress();
      currentProgress = targetProgress;
      updateOrbTargets(currentProgress);
      animateOrbs();
      renderCanvas();
      applyNarrative(currentProgress);
      requestTick();
    }

    function bindScroll() {
      window.addEventListener("scroll", handleScroll, { passive: true });
    }

    function bindResize() {
      const onResize = () => {
        window.clearTimeout(resizeTimeoutId);
        resizeTimeoutId = window.setTimeout(() => {
          refreshLayout();
        }, 110);
      };

      window.addEventListener("resize", onResize, { passive: true });
      window.addEventListener("orientationchange", onResize, { passive: true });
    }

    function onVisibility(visible) {
      isVisible = visible;

      if (!isVisible) {
        setAnimatingScope(false);

        if (tickRafId) {
          window.cancelAnimationFrame(tickRafId);
          tickRafId = 0;
        }

        if (progressRafId) {
          window.cancelAnimationFrame(progressRafId);
          progressRafId = 0;
        }

        if (reducedMotion) {
          applyReducedLayout(false);
        }

        return;
      }

      computeMetrics();
      lastScrollY = getScrollY();

      if (reducedMotion) {
        applyReducedLayout(true);
        return;
      }

      targetProgress = readSectionProgress();
      currentProgress = targetProgress;
      updateOrbTargets(currentProgress);
      animateOrbs();
      renderCanvas();
      applyNarrative(currentProgress);
      requestTick();
    }

    function bindVisibility() {
      if (!("IntersectionObserver" in window)) {
        onVisibility(true);
        return;
      }

      visibilityObserver = new window.IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const visible = Boolean(entry && (entry.isIntersecting || entry.intersectionRatio > 0));
          onVisibility(visible);
        },
        {
          root: null,
          threshold: [0, 0.01],
          rootMargin: VISIBILITY_MARGIN
        }
      );

      visibilityObserver.observe(section);
    }

    function bindReducedMotion() {
      const onChange = () => {
        reducedMotion = isReducedMotion();

        if (reducedMotion) {
          if (tickRafId) {
            window.cancelAnimationFrame(tickRafId);
            tickRafId = 0;
          }
          applyReducedLayout(isVisible);
          return;
        }

        if (section) {
          section.classList.remove("topics-reduced-motion", "topics-reduced-visible");
        }

        refreshLayout();
      };

      if (typeof reducedMedia.addEventListener === "function") {
        reducedMedia.addEventListener("change", onChange);
      } else if (typeof reducedMedia.addListener === "function") {
        reducedMedia.addListener(onChange);
      }
    }

    function bindFonts() {
      if (!document.fonts || !document.fonts.ready || typeof document.fonts.ready.then !== "function") {
        return;
      }

      document.fonts.ready
        .then(() => {
          computeLayout();
          if (reducedMotion) {
            applyReducedLayout(isVisible);
            return;
          }
          renderCanvas();
          applyNarrative(currentProgress);
        })
        .catch(() => {});
    }

    function init() {
      section = document.querySelector(".topics-scene");
      surface = section ? section.querySelector(".topics-surface") : null;
      dropZone = document.getElementById("topicsWorld");
      canvas = document.getElementById("topicsCanvas");
      context = canvas ? canvas.getContext("2d") : null;

      if (!section || !surface || !dropZone || !canvas || !context) {
        return;
      }

      ensureStyles();
      ensureStructure();

      headline = document.getElementById("topicsCinematicHead");
      progressBar = document.getElementById("topicsCinematicProgressBar");
      resultOrb = document.getElementById("topicsCinematicOrb");
      cta = document.getElementById("topicsCinematicCta");

      reducedMotion = isReducedMotion();

      buildOrbs();
      computeLayout();
      computeMetrics();

      lastScrollY = getScrollY();
      targetProgress = readSectionProgress();
      currentProgress = targetProgress;

      if (reducedMotion) {
        applyReducedLayout(true);
      } else {
        updateOrbTargets(currentProgress);
        animateOrbs();
        renderCanvas();
        applyNarrative(currentProgress);
      }

      bindScroll();
      bindResize();
      bindVisibility();
      bindReducedMotion();
      bindFonts();
    }

    return {
      init
    };
  })();

  window.TopicsPhysicsModule = TopicsPhysicsModule;
})(window, document);
