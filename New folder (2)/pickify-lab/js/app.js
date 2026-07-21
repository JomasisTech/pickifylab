/* ==========================================================================
   Pickify Lab — App
   Shared behaviour across every page: navigation, theme, card rendering,
   section population, and form handling.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const params = new URLSearchParams(window.location.search);

  /* ==========================================================================
     THEME (light / dark)
     ========================================================================== */
  function initTheme() {
    const stored = localStorage.getItem("pickify-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeToggleIcon(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("pickify-theme", next);
    updateThemeToggleIcon(next);
  }

  function updateThemeToggleIcon(theme) {
    qsa("[data-theme-toggle] i").forEach((icon) => {
      icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    });
  }

  /* ==========================================================================
     NAVIGATION
     ========================================================================== */
  function initNav() {
    const toggle = qs("[data-nav-toggle]");
    const menu = qs("[data-nav-menu]");
    const header = qs("[data-site-header]");

    if (toggle && menu) {
      toggle.addEventListener("click", () => {
        const isOpen = menu.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.classList.toggle("is-active", isOpen);
        document.body.classList.toggle("nav-open", isOpen);
      });

      qsa("a", menu).forEach((link) =>
        link.addEventListener("click", () => {
          menu.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.classList.remove("is-active");
          document.body.classList.remove("nav-open");
        })
      );
    }

    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // Active link state
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    qsa("[data-nav-menu] a[data-page]").forEach((link) => {
      if (link.dataset.page === currentPage) link.classList.add("is-active");
    });
  }

  /* ==========================================================================
     SCROLL TO TOP
     ========================================================================== */
  function initScrollTop() {
    const btn = qs("[data-scroll-top]");
    if (!btn) return;
    const onScroll = () => btn.classList.toggle("is-visible", window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ==========================================================================
     SMOOTH SCROLL for in-page anchors
     ========================================================================== */
  function initSmoothScroll() {
    qsa('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href");
        if (id.length < 2) return;
        const target = qs(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ==========================================================================
     CARD / RATING / BADGE RENDERING
     ========================================================================== */
  function starsMarkup(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let html = "";
    for (let i = 0; i < 5; i++) {
      if (i < full) html += '<i class="fa-solid fa-star" aria-hidden="true"></i>';
      else if (i === full && half) html += '<i class="fa-solid fa-star-half-stroke" aria-hidden="true"></i>';
      else html += '<i class="fa-regular fa-star" aria-hidden="true"></i>';
    }
    return html;
  }

  // Signature element: the "match ring" — a small radial indicator that
  // encodes how closely a product matches Pickify Lab's review criteria.
  function matchRingMarkup(matchScore) {
    const deg = Math.round((matchScore / 100) * 360);
    return `
      <div class="match-ring" style="--ring-deg:${deg}deg" aria-hidden="true">
        <span>${matchScore}%</span>
      </div>`;
  }

  function badgesMarkup(badge) {
    if (!badge) return "";
    return `<div class="card-badges"><span class="badge badge--${slugify(badge)}">${badge}</span></div>`;
  }

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function sortByOrder(products) {
    return [...products].sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
  }

  function placeholderMarkup(product) {
    if (product.image) {
      return `
        <div class="product-media product-media--${slugify(product.category)}">
          <img src="${product.image}" alt="${product.brand} ${product.name}" loading="lazy" />
        </div>`;
    }
    return `
      <div class="product-media product-media--${slugify(product.category)}" role="img" aria-label="${product.brand} ${product.name}">
        <i class="fa-solid ${product.icon}" aria-hidden="true"></i>
      </div>`;
  }

  function productCardMarkup(product) {
    const rating = typeof product.rating === "number" ? product.rating : 0;
    const reviewCount = typeof product.reviewCount === "number" ? product.reviewCount : 0;
    return `
      <article class="product-card" data-category="${product.category}">
        <a class="product-card__media-link" href="product.html?slug=${product.slug}" aria-label="View ${product.brand} ${product.name}">
          ${placeholderMarkup(product)}
        </a>
        ${badgesMarkup(product.badge)}
        <div class="product-card__body">
          <p class="product-card__brand">${product.brand}</p>
          <h3 class="product-card__name"><a href="product.html?slug=${product.slug}">${product.name}</a></h3>
          <div class="product-card__rating">
            <span class="stars" aria-hidden="true">${starsMarkup(rating)}</span>
            <span class="rating-value">${rating.toFixed(1)}</span>
            <span class="rating-count">(${reviewCount.toLocaleString()})</span>
          </div>
          <p class="product-card__review">${product.shortReview || ""}</p>
          <div class="product-card__actions">
            <a class="btn btn--ghost btn--small" href="product.html?slug=${product.slug}">Read review</a>
            <a class="btn btn--primary btn--small" href="${product.amazonLink || '#'}" target="_blank" rel="nofollow sponsored noopener">
              Buy on Amazon <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </article>`;
  }

  function mountGrid(container, products, emptyMessage) {
    if (!container) return;
    if (!products.length) {
      container.innerHTML = `<p class="empty-state">${emptyMessage || "No products matched. Try a different search."}</p>`;
      return;
    }
    container.innerHTML = products.map(productCardMarkup).join("");
  }

  /* ==========================================================================
     HOMEPAGE SECTIONS
     ========================================================================== */
  function initHomeSections() {
    const products = window.PICKIFY_PRODUCTS || [];
    if (!products.length || !qs("[data-home]")) return;

    const ordered = sortByOrder(products);
    const byFlag = (flag) => ordered.filter((p) => p[flag]);

    mountGrid(qs("#featured-grid"), byFlag("featured").slice(0, 4));
    mountGrid(qs("#trending-grid"), byFlag("trending").slice(0, 4));
    mountGrid(qs("#bestsellers-grid"), byFlag("bestSeller").slice(0, 8));
    mountGrid(qs("#recent-grid"), byFlag("recentlyAdded").slice(0, 4));
  }

  /* ==========================================================================
     CATEGORIES PAGE
     ========================================================================== */
  function initCategoriesPage() {
    const grid = qs("#categories-grid");
    const tabsWrap = qs("[data-category-tabs]");
    if (!grid || !tabsWrap) return;

    const products = window.PICKIFY_PRODUCTS || [];
    const categories = window.PICKIFY_CATEGORIES || [];
    const initialCat = params.get("cat") || "All";
    const initialSearch = params.get("search") || "";

    tabsWrap.innerHTML =
      `<button type="button" class="tab is-active" data-cat="All">All</button>` +
      categories.map((c) => `<button type="button" class="tab" data-cat="${c.name}"><i class="fa-solid ${c.icon}" aria-hidden="true"></i> ${c.name}</button>`).join("");

    const searchInput = qs("#categories-search");
    if (searchInput && initialSearch) searchInput.value = initialSearch;

    function applyFilters() {
      const activeCat = qs(".tab.is-active", tabsWrap)?.dataset.cat || "All";
      const query = searchInput ? searchInput.value : "";
      let list = window.PickifySearch.filterByCategory(activeCat, products);
      if (query.trim()) {
        const searched = window.PickifySearch.search(query, products);
        list = list.filter((p) => searched.includes(p));
      } else {
        list = sortByOrder(list);
      }
      qs("#results-count") && (qs("#results-count").textContent = `${list.length} product${list.length === 1 ? "" : "s"}`);
      mountGrid(grid, list);
    }

    qsa(".tab", tabsWrap).forEach((tab) => {
      if (tab.dataset.cat === initialCat) {
        qsa(".tab", tabsWrap).forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
      }
      tab.addEventListener("click", () => {
        qsa(".tab", tabsWrap).forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        applyFilters();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", applyFilters);
    }

    applyFilters();
  }

  /* ==========================================================================
     PRODUCT DETAILS PAGE
     ========================================================================== */
  function initProductPage() {
    const root = qs("[data-product-page]");
    if (!root) return;

    const products = window.PICKIFY_PRODUCTS || [];
    const slug = params.get("slug");
    const product = products.find((p) => p.slug === slug) || products[0];

    if (!product) {
      root.innerHTML = `<div class="empty-state">Product not found. <a href="index.html">Return home</a>.</div>`;
      return;
    }

    document.title = `${product.brand} ${product.name} Review | Pickify Lab`;
    const metaDesc = qs('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", `${product.shortReview} Read our full independent review of ${product.brand} ${product.name}.`);

    qs("#breadcrumb-category").textContent = product.category;
    qs("#breadcrumb-category").href = `categories.html?cat=${encodeURIComponent(product.category)}`;
    qs("#breadcrumb-name").textContent = product.name;

    qs("#product-media").innerHTML = placeholderMarkup(product);
    qs("#product-badges").innerHTML = badgesMarkup(product.badge);
    qs("#product-category-chip").textContent = product.category;
    qs("#product-brand").textContent = product.brand;
    qs("#product-name").textContent = product.name;
    qs("#product-stars").innerHTML = starsMarkup(product.rating);
    qs("#product-rating-value").textContent = product.rating.toFixed(1);
    qs("#product-review-count").textContent = `${product.reviewCount.toLocaleString()} verified opinions`;
    qs("#product-price").textContent = product.price || "$";
    qs("#product-match-ring").innerHTML = matchRingMarkup(product.matchScore || 90);
    qs("#product-overview").textContent = product.overview || product.shortReview || "";
    qs("#product-skin-type").textContent = (product.skinType || []).join(", ") || "All Skin Types";
    qs("#product-skin-concern").textContent = (product.skinConcern || []).join(", ") || "—";
    qs("#product-amazon-btn").href = product.amazonLink || "#";
    qs("#product-amazon-btn-2").href = product.amazonLink || "#";

    qs("#product-pros").innerHTML = (product.pros || []).map((p) => `<li><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${p}</li>`).join("") || `<li>No details added yet.</li>`;
    qs("#product-cons").innerHTML = (product.cons || []).map((c) => `<li><i class="fa-solid fa-circle-minus" aria-hidden="true"></i>${c}</li>`).join("") || `<li>No details added yet.</li>`;
    qs("#product-review-text").textContent = product.review || product.overview || product.shortReview || "";
    qs("#product-ingredients").innerHTML = (product.ingredients || []).map((i) => `<li>${i}</li>`).join("") || `<li>Not listed</li>`;
    qs("#product-how-to-use").textContent = product.howToUse || "Follow the directions on the product packaging.";
    qs("#product-who-for").textContent = product.whoFor || "See the overview above.";
    qs("#product-who-avoid").textContent = product.whoAvoid || "See the overview above.";

    const faqWrap = qs("#product-faqs");
    if (product.faqs && product.faqs.length) {
      faqWrap.innerHTML = product.faqs
        .map(
          (f, i) => `
        <details class="faq-item" ${i === 0 ? "open" : ""}>
          <summary>${f.q}</summary>
          <p>${f.a}</p>
        </details>`
        )
        .join("");
      qs("#faq-section").hidden = false;
    } else {
      qs("#faq-section").hidden = true;
    }

    const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
    mountGrid(qs("#related-grid"), related, "No related products yet.");

    // Structured data (JSON-LD) for SEO
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org/",
      "@type": "Product",
      name: `${product.brand} ${product.name}`,
      brand: { "@type": "Brand", name: product.brand },
      description: product.overview,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: product.reviewCount
      }
    });
    document.head.appendChild(ld);
  }

  /* ==========================================================================
     SEARCH — header overlay + hero search
     ========================================================================== */
  function initHeaderSearch() {
    const openBtn = qs("[data-search-open]");
    const overlay = qs("[data-search-overlay]");
    const closeBtn = qs("[data-search-close]");
    const input = qs("[data-search-input]");
    const resultsWrap = qs("[data-search-results]");

    if (!overlay || !input) return;

    function openOverlay() {
      overlay.classList.add("is-open");
      document.body.classList.add("search-open");
      setTimeout(() => input.focus(), 50);
    }
    function closeOverlay() {
      overlay.classList.remove("is-open");
      document.body.classList.remove("search-open");
    }

    openBtn && openBtn.addEventListener("click", openOverlay);
    closeBtn && closeBtn.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) closeOverlay();
    });

    input.addEventListener("input", () => {
      const query = input.value;
      if (!query.trim()) {
        resultsWrap.innerHTML = `<p class="search-hint">Start typing a product or brand — like "Cera" or "La Roche".</p>`;
        return;
      }
      const results = window.PickifySearch.search(query).slice(0, 6);
      if (!results.length) {
        resultsWrap.innerHTML = `<p class="search-hint">No matches yet. Try a brand name or ingredient.</p>`;
        return;
      }
      resultsWrap.innerHTML = results
        .map(
          (p) => `
        <a class="search-result" href="product.html?slug=${p.slug}">
          <span class="search-result__icon"><i class="fa-solid ${p.icon}" aria-hidden="true"></i></span>
          <span class="search-result__text">
            <strong>${p.brand} ${p.name}</strong>
            <small>${p.category} · ${starsMarkup(p.rating)} ${p.rating.toFixed(1)}</small>
          </span>
        </a>`
        )
        .join("");
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.location.href = `categories.html?search=${encodeURIComponent(input.value)}`;
      }
    });
  }

  function initHeroSearch() {
    const form = qs("[data-hero-search-form]");
    const input = qs("[data-hero-search-input]");
    const suggestions = qs("[data-hero-search-suggestions]");
    if (!form || !input) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      window.location.href = `categories.html?search=${encodeURIComponent(input.value)}`;
    });

    if (suggestions) {
      input.addEventListener("input", () => {
        const q = input.value;
        if (!q.trim()) {
          suggestions.innerHTML = "";
          suggestions.hidden = true;
          return;
        }
        const results = window.PickifySearch.search(q).slice(0, 5);
        suggestions.hidden = results.length === 0;
        suggestions.innerHTML = results
          .map((p) => `<a href="product.html?slug=${p.slug}">${p.brand} ${p.name}</a>`)
          .join("");
      });
    }
  }

  /* ==========================================================================
     FORMS
     ========================================================================== */
  function showFieldError(field, message) {
    const wrap = field.closest(".form-field");
    if (!wrap) return;
    wrap.classList.toggle("has-error", Boolean(message));
    const errorEl = qs(".form-error", wrap);
    if (errorEl) errorEl.textContent = message || "";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function initContactForm() {
    const form = qs("#contact-form");
    if (!form) return;
    const status = qs("#contact-form-status");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = qs("#contact-name");
      const email = qs("#contact-email");
      const message = qs("#contact-message");
      let valid = true;

      if (!name.value.trim()) {
        showFieldError(name, "Please enter your name.");
        valid = false;
      } else showFieldError(name, "");

      if (!isValidEmail(email.value)) {
        showFieldError(email, "Please enter a valid email address.");
        valid = false;
      } else showFieldError(email, "");

      if (!message.value.trim() || message.value.trim().length < 10) {
        showFieldError(message, "Message should be at least 10 characters.");
        valid = false;
      } else showFieldError(message, "");

      if (!valid) {
        status.textContent = "Please fix the highlighted fields.";
        status.className = "form-status form-status--error";
        return;
      }

      status.textContent = "Thanks — your message has been sent. We'll reply within 2 business days.";
      status.className = "form-status form-status--success";
      form.reset();
    });
  }

  function initNewsletterForms() {
    qsa("[data-newsletter-form]").forEach((form) => {
      const status = qs("[data-newsletter-status]", form);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = qs('input[type="email"]', form);
        if (!isValidEmail(email.value)) {
          status.textContent = "Please enter a valid email address.";
          status.className = "form-status form-status--error";
          return;
        }
        status.textContent = "You're subscribed. Welcome to Pickify Lab.";
        status.className = "form-status form-status--success";
        form.reset();
      });
    });
  }

  /* ==========================================================================
     LAZY LOAD (fade-in reveal for media placeholders)
     ========================================================================== */
  function initRevealOnScroll() {
    const targets = qsa("[data-reveal], .product-card, .category-card");
    if (!("IntersectionObserver" in window) || !targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    targets.forEach((t) => observer.observe(t));
  }

  /* ==========================================================================
     SETTINGS — social links, business email, disclosure text
     ========================================================================== */
  function initSettings() {
    const settings = window.PICKIFY_SETTINGS;
    if (!settings) return;

    qsa("[data-social]").forEach((link) => {
      const url = settings.social && settings.social[link.dataset.social];
      if (url) link.href = url;
    });

    qsa("[data-business-email]").forEach((link) => {
      if (!settings.businessEmail) return;
      link.href = `mailto:${settings.businessEmail}`;
      link.textContent = settings.businessEmail;
    });

    qsa("[data-disclosure-text]").forEach((el) => {
      if (!settings.disclosureText) return;
      el.innerHTML = `<strong>Affiliate disclosure:</strong> ${settings.disclosureText.replace(/^Affiliate disclosure:\s*/i, "")}`;
    });
  }

  /* ==========================================================================
     FOOTER YEAR
     ========================================================================== */
  function initFooterYear() {
    qsa("[data-current-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initScrollTop();
    initSmoothScroll();
    initFooterYear();
    initSettings();
    initContactForm();
    initNewsletterForms();
    initHeaderSearch();
    initHeroSearch();

    initHomeSections();
    initCategoriesPage();
    initProductPage();

    // Re-run reveal after dynamic content mounts
    setTimeout(initRevealOnScroll, 50);

    qsa("[data-theme-toggle]").forEach((btn) => btn.addEventListener("click", toggleTheme));
  });
})();
