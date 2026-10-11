(function () {
  "use strict";

  const cleanupKey = "ankiMarkdownBasicOutlineCleanup";
  try {
    if (typeof window[cleanupKey] === "function") {
      window[cleanupKey]();
    }
  } catch (error) {
    console.warn("Unable to clean up the previous Markdown outline", error);
  } finally {
    delete window[cleanupKey];
    document
      .querySelectorAll(".markdown-basic-outline")
      .forEach((outline) => outline.remove());
    document.body.classList.remove("markdown-basic-has-outline");
  }
})();
