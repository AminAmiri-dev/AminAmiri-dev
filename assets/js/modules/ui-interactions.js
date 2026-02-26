(function (window, document) {
  "use strict";

  const UIInteractionsModule = (() => {
    const PRESSABLE_SELECTOR =
      ".pill-btn, .learning-tab, .stress-pill, .footer-contact__cta, .footer-contact__email, .footer-social a";
    const LEARNING_TAB_CONTENT = [
      {
        cards: [
          {
            price: "سایت خدماتی",
            title: "طراحی سایت معرفی خدمات با فرم ارتباط سریع",
            description: "در این پروژه ساختار ساده و شفاف طراحی شد تا کاربر سریع خدمات را ببیند و پیام بفرستد.",
            meta: [
              { value: "8", label: "صفحه" },
              { value: "14", label: "بخش کلیدی" }
            ]
          },
          {
            price: "۹۹٪",
            title: "راه‌اندازی فروشگاه آنلاین با مسیر خرید ساده",
            description: "تمرکز این پروژه روی سادگی خرید، نمایش درست محصولات و مدیریت راحت سفارش‌ها بود.",
            meta: [
              { value: "12", label: "بخش اصلی" },
              { value: "1200+", label: "سفارش ثبت‌شده" }
            ]
          }
        ]
      },
      {
        cards: [
          {
            price: "فروشگاهی",
            title: "بازطراحی صفحه محصول برای تصمیم‌گیری سریع‌تر کاربر",
            description: "چیدمان محتوا و اطلاعات خرید بازنویسی شد تا کاربر راحت‌تر انتخاب کند و نرخ خروج کمتر شود.",
            meta: [
              { value: "10", label: "صفحه" },
              { value: "22", label: "کامپوننت" }
            ]
          },
          {
            price: "۹۶٪",
            title: "بهینه‌سازی قیف خرید و کاهش رهاسازی سبد",
            description: "فرایند خرید کوتاه‌تر شد، پیام‌های خطا شفاف شد و مسیر پرداخت با تمرکز روی تبدیل بهبود پیدا کرد.",
            meta: [
              { value: "3.1x", label: "افزایش تبدیل" },
              { value: "38%", label: "کاهش رهاسازی" }
            ]
          }
        ]
      },
      {
        cards: [
          {
            price: "سفارشی",
            title: "طراحی داشبورد اختصاصی برای مدیریت درخواست‌ها",
            description: "یک پنل اختصاصی بر اساس جریان واقعی کار تیم ساخته شد تا پیگیری، اولویت‌بندی و گزارش‌گیری سریع‌تر انجام شود.",
            meta: [
              { value: "16", label: "ماژول" },
              { value: "4", label: "نقش کاربری" }
            ]
          },
          {
            price: "MVP",
            title: "پیاده‌سازی نسخه اول محصول با معماری قابل رشد",
            description: "نسخه اولیه با تمرکز روی سرعت توسعه، پایداری فنی و قابلیت توسعه مرحله‌ای آماده و وارد فاز استفاده شد.",
            meta: [
              { value: "6", label: "هفته اجرا" },
              { value: "99.9%", label: "پایداری" }
            ]
          }
        ]
      }
    ];

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function bindPressFeedback() {
      const nodes = document.querySelectorAll(PRESSABLE_SELECTOR);
      if (!nodes.length) {
        return;
      }

      nodes.forEach((node) => {
        const onPress = () => node.classList.add("is-pressed");
        const onRelease = () => node.classList.remove("is-pressed");

        node.addEventListener("pointerdown", onPress, { passive: true });
        node.addEventListener("pointerup", onRelease, { passive: true });
        node.addEventListener("pointercancel", onRelease, { passive: true });
        node.addEventListener("pointerleave", onRelease, { passive: true });
      });
    }

    function animateCards(cards) {
      if (!window.gsap || !cards.length) {
        return;
      }

      window.gsap.fromTo(
        cards,
        { y: 10, autoAlpha: 0.86 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.42,
          ease: "power2.out",
          stagger: 0.06,
          overwrite: true
        }
      );
    }

    function createLearningMetaItem(item) {
      const chip = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = String(item.value || "").trim();
      chip.appendChild(strong);
      chip.append(document.createTextNode(` ${String(item.label || "").trim()}`));
      return chip;
    }

    function renderLearningCard(card, data) {
      if (!card || !data) {
        return;
      }

      const priceNode = card.querySelector(".course-card__price");
      const titleNode = card.querySelector("h3");
      const descriptionNode = card.querySelector("p");
      const metaNode = card.querySelector(".course-card__meta");
      const arrowNode = metaNode ? metaNode.querySelector(".course-card__arrow") : null;

      if (priceNode) {
        priceNode.textContent = data.price;
      }

      if (titleNode) {
        titleNode.textContent = data.title;
      }

      if (descriptionNode) {
        descriptionNode.textContent = data.description;
      }

      if (metaNode) {
        metaNode.querySelectorAll("span:not(.course-card__arrow)").forEach((node) => node.remove());
        const fragment = document.createDocumentFragment();
        (data.meta || []).forEach((metaItem) => {
          fragment.appendChild(createLearningMetaItem(metaItem));
        });
        metaNode.insertBefore(fragment, arrowNode || null);
      }
    }

    function bindLearningTabs() {
      const tabs = Array.from(document.querySelectorAll(".learning-tab"));
      const cards = Array.from(document.querySelectorAll(".learning-grid .course-card"));

      if (!tabs.length || !cards.length) {
        return;
      }

      const emphasisMap = [0, 1, -1];

      function activate(index) {
        const safeIndex = clamp(index, 0, Math.min(tabs.length, LEARNING_TAB_CONTENT.length) - 1);
        const selectedContent = LEARNING_TAB_CONTENT[safeIndex];

        tabs.forEach((tab, tabIndex) => {
          const isActive = tabIndex === safeIndex;
          tab.classList.toggle("is-active", isActive);
          tab.setAttribute("aria-selected", String(isActive));
          tab.setAttribute("tabindex", isActive ? "0" : "-1");
        });

        if (selectedContent && selectedContent.cards) {
          cards.forEach((card, cardIndex) => {
            renderLearningCard(card, selectedContent.cards[cardIndex]);
          });
        }

        const emphasisIndex = emphasisMap[safeIndex] ?? -1;
        cards.forEach((card, cardIndex) => {
          card.classList.toggle("is-emphasis", emphasisIndex === cardIndex || emphasisIndex === -1);
        });

        animateCards(cards);
      }

      tabs.forEach((tab, index) => {
        tab.setAttribute("role", "tab");
        tab.addEventListener("click", () => activate(index));
      });

      const activeTabIndex = tabs.findIndex((tab) => tab.classList.contains("is-active"));
      activate(activeTabIndex >= 0 ? activeTabIndex : 0);
    }

    function bindPseudoLinks() {
      document.querySelectorAll("a[href='#']").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          link.classList.add("is-pressed");
          window.setTimeout(() => link.classList.remove("is-pressed"), 180);
        });
      });
    }

    function init() {
      bindPressFeedback();
      bindLearningTabs();
      bindPseudoLinks();
    }

    return { init };
  })();

  window.UIInteractionsModule = UIInteractionsModule;
})(window, document);
