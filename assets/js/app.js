(function (window, document) {
  "use strict";

  const App = {
    modules: [
      window.SmoothScrollModule,
      window.NavigationModule,
      window.UIInteractionsModule,
      window.TopicsPhysicsModule,
      window.TipsStackModule,
      window.ScrollAnimationsModule
    ],

    init() {
      this.modules.forEach((module) => {
        if (module && typeof module.init === "function") {
          module.init();
        }
      });
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    App.init();
  });
})(window, document);
