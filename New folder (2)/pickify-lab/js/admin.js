/* ==========================================================================
   Pickify Lab — Admin Dashboard
   Purely client-side. Product and settings data live in localStorage and
   preview live in this browser only. Nothing here talks to a server —
   "publishing" means exporting products.js / settings.js and redeploying.
   ========================================================================== */

(function () {
  "use strict";

  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const PRODUCTS_KEY = window.PICKIFY_STORAGE_KEY || "pickify-admin-products";
  const SETTINGS_KEY = window.PICKIFY_SETTINGS_STORAGE_KEY || "pickify-admin-settings";
  const AUTH_CREDENTIALS_KEY = "pickify-admin-credentials";
  const AUTH_SESSION_KEY = "pickify-admin-session";

  const BADGE_OPTIONS = ["Best Seller", "Editor's Choice", "Trending", "Dermatologist Recommended", "Budget Pick", "New Review"];
  const PRICE_OPTIONS = ["$", "$$", "$$$"];

  let workingProducts = [];
  let workingSettings = {};
  let editingProductId = null;
  let tableSort = { key: "order", dir: "asc" };
  let tableQuery = "";

  /* ==========================================================================
     UTIL
     ========================================================================== */
  function slugify(str) {
    return (str || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function uniqueSlug(base, excludeId) {
    let slug = base || "product";
    let n = 2;
    while (workingProducts.some((p) => p.slug === slug && p.id !== excludeId)) {
      slug = `${base}-${n}`;
      n++;
    }
    return slug;
  }

  function nextId() {
    return workingProducts.length ? Math.max(...workingProducts.map((p) => p.id)) + 1 : 1;
  }

  function nextOrder() {
    return workingProducts.length ? Math.max(...workingProducts.map((p) => p.order ?? p.id)) + 1 : 1;
  }

  function linesToArray(text) {
    return (text || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function arrayToLines(arr) {
    return (arr || []).join("\n");
  }

  function iconForCategory(categoryName) {
    const cat = (window.PICKIFY_CATEGORIES || []).find((c) => c.name === categoryName);
    return cat ? cat.icon : "fa-flask";
  }

  /* ==========================================================================
     TOASTS
     ========================================================================== */
  function toast(message, type) {
    const wrap = qs("#toast-stack");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = `toast toast--${type || "success"}`;
    el.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}" aria-hidden="true"></i><span>${message}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    setTimeout(() => {
      el.classList.remove("is-visible");
      setTimeout(() => el.remove(), 250);
    }, 3400);
  }

  /* ==========================================================================
     CONFIRM MODAL
     ========================================================================== */
  function confirmAction({ title, message, confirmLabel, danger }) {
    return new Promise((resolve) => {
      const overlay = qs("#confirm-overlay");
      qs("#confirm-title").textContent = title || "Are you sure?";
      qs("#confirm-message").textContent = message || "";
      const confirmBtn = qs("#confirm-ok");
      confirmBtn.textContent = confirmLabel || "Confirm";
      confirmBtn.className = `btn btn--small ${danger ? "btn--danger" : "btn--primary"}`;
      overlay.classList.add("is-open");

      function cleanup(result) {
        overlay.classList.remove("is-open");
        confirmBtn.removeEventListener("click", onConfirm);
        qs("#confirm-cancel").removeEventListener("click", onCancel);
        resolve(result);
      }
      function onConfirm() { cleanup(true); }
      function onCancel() { cleanup(false); }

      confirmBtn.addEventListener("click", onConfirm);
      qs("#confirm-cancel").addEventListener("click", onCancel);
    });
  }

  /* ==========================================================================
     PERSISTENCE
     ========================================================================== */
  function loadProducts() {
    try {
      const raw = localStorage.getItem(PRODUCTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (err) { /* fall through to defaults */ }
    return JSON.parse(JSON.stringify(window.PICKIFY_PRODUCTS_DEFAULT || window.PICKIFY_PRODUCTS || []));
  }

  function saveProducts() {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(workingProducts));
    setDirtyBadge(true);
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...window.PICKIFY_SETTINGS_DEFAULT, ...JSON.parse(raw) };
    } catch (err) { /* fall through */ }
    return JSON.parse(JSON.stringify(window.PICKIFY_SETTINGS_DEFAULT || window.PICKIFY_SETTINGS || {}));
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(workingSettings));
    setDirtyBadge(true);
  }

  function setDirtyBadge(dirty) {
    const el = qs("#preview-status");
    if (!el) return;
    el.classList.toggle("is-dirty", dirty);
    el.textContent = dirty ? "Unsaved to live site — export to publish" : "No local changes";
  }

  /* ==========================================================================
     AUTH
     ========================================================================== */
  function getCredentials() {
    try {
      const raw = localStorage.getItem(AUTH_CREDENTIALS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function initAuth() {
    const creds = getCredentials();
    const loginScreen = qs("#login-screen");
    const setupScreen = qs("#setup-screen");
    const dashboard = qs("#admin-dashboard");
    const isAuthed = sessionStorage.getItem(AUTH_SESSION_KEY) === "true";

    function showOnly(el) {
      [loginScreen, setupScreen, dashboard].forEach((s) => s && s.classList.add("is-hidden"));
      el && el.classList.remove("is-hidden");
    }

    if (isAuthed) {
      showOnly(dashboard);
      bootDashboard();
      return;
    }

    if (!creds) {
      showOnly(setupScreen);
    } else {
      showOnly(loginScreen);
    }

    const setupForm = qs("#setup-form");
    if (setupForm) {
      setupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const username = qs("#setup-username").value.trim();
        const password = qs("#setup-password").value;
        const confirm = qs("#setup-password-confirm").value;
        if (!username || password.length < 4) {
          toast("Username required, password must be at least 4 characters.", "error");
          return;
        }
        if (password !== confirm) {
          toast("Passwords don't match.", "error");
          return;
        }
        localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify({ username, password }));
        sessionStorage.setItem(AUTH_SESSION_KEY, "true");
        toast(`Welcome, ${username}. Your admin is ready.`, "success");
        showOnly(dashboard);
        bootDashboard();
      });
    }

    const loginForm = qs("#login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const username = qs("#login-username").value.trim();
        const password = qs("#login-password").value;
        const stored = getCredentials();
        if (stored && stored.username === username && stored.password === password) {
          sessionStorage.setItem(AUTH_SESSION_KEY, "true");
          showOnly(dashboard);
          bootDashboard();
        } else {
          qs("#login-error").textContent = "Incorrect username or password.";
        }
      });
    }

    qsa("[data-logout]").forEach((btn) =>
      btn.addEventListener("click", () => {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        window.location.reload();
      })
    );
  }

  /* ==========================================================================
     NAVIGATION (Dashboard / Products / Categories / Settings)
     ========================================================================== */
  function initAdminNav() {
    qsa("[data-admin-nav]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = link.dataset.adminNav;
        qsa("[data-admin-nav]").forEach((l) => l.classList.remove("is-active"));
        link.classList.add("is-active");
        qsa("[data-admin-view]").forEach((view) => view.classList.toggle("is-hidden", view.dataset.adminView !== target));
        qs("#admin-view-title").textContent = link.textContent.trim();
        qs(".admin-sidebar").classList.remove("is-open");
      });
    });

    const menuToggle = qs("#admin-menu-toggle");
    if (menuToggle) {
      menuToggle.addEventListener("click", () => qs(".admin-sidebar").classList.toggle("is-open"));
    }
  }

  /* ==========================================================================
     DASHBOARD VIEW
     ========================================================================== */
  function renderDashboard() {
    qs("#stat-total").textContent = workingProducts.length;
    qs("#stat-featured").textContent = workingProducts.filter((p) => p.featured).length;
    qs("#stat-trending").textContent = workingProducts.filter((p) => p.trending).length;
    qs("#stat-bestseller").textContent = workingProducts.filter((p) => p.bestSeller).length;
    qs("#stat-recent").textContent = workingProducts.filter((p) => p.recentlyAdded).length;

    const byCategory = {};
    workingProducts.forEach((p) => { byCategory[p.category] = (byCategory[p.category] || 0) + 1; });
    const catList = qs("#dashboard-category-breakdown");
    if (catList) {
      catList.innerHTML = (window.PICKIFY_CATEGORIES || [])
        .map((c) => `<li><i class="fa-solid ${c.icon}" aria-hidden="true"></i><span>${c.name}</span><strong>${byCategory[c.name] || 0}</strong></li>`)
        .join("");
    }
  }

  /* ==========================================================================
     PRODUCTS VIEW — table
     ========================================================================== */
  function getFilteredSortedProducts() {
    let list = [...workingProducts];
    if (tableQuery.trim()) {
      const q = tableQuery.trim().toLowerCase();
      list = list.filter((p) => `${p.brand} ${p.name} ${p.category}`.toLowerCase().includes(q));
    }
    const { key, dir } = tableSort;
    list.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (typeof av === "string") { av = av.toLowerCase(); bv = (bv || "").toLowerCase(); }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }

  function flagIcons(p) {
    const flags = [
      { on: p.featured, label: "Featured", icon: "fa-star" },
      { on: p.trending, label: "Trending", icon: "fa-arrow-trend-up" },
      { on: p.bestSeller, label: "Best Seller", icon: "fa-trophy" },
      { on: p.recentlyAdded, label: "Recently Added", icon: "fa-sparkles" }
    ];
    return flags
      .map((f) => `<span class="flag-dot ${f.on ? "is-on" : ""}" title="${f.label}${f.on ? "" : " — off"}"><i class="fa-solid ${f.icon}" aria-hidden="true"></i></span>`)
      .join("");
  }

  function renderProductsTable() {
    const tbody = qs("#products-table-body");
    if (!tbody) return;
    const list = getFilteredSortedProducts();
    qs("#products-count-label").textContent = `${list.length} of ${workingProducts.length} product${workingProducts.length === 1 ? "" : "s"}`;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">No products match your search.</td></tr>`;
      return;
    }

    const orderedIds = [...workingProducts].sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id)).map((p) => p.id);

    tbody.innerHTML = list
      .map((p) => {
        const posIndex = orderedIds.indexOf(p.id);
        return `
        <tr data-id="${p.id}">
          <td class="col-reorder">
            <button type="button" class="icon-btn icon-btn--tiny" data-move="up" data-id="${p.id}" ${posIndex === 0 ? "disabled" : ""} aria-label="Move up"><i class="fa-solid fa-caret-up"></i></button>
            <button type="button" class="icon-btn icon-btn--tiny" data-move="down" data-id="${p.id}" ${posIndex === orderedIds.length - 1 ? "disabled" : ""} aria-label="Move down"><i class="fa-solid fa-caret-down"></i></button>
          </td>
          <td class="col-media">
            <div class="table-thumb product-media--${slugify(p.category)}">
              ${p.image ? `<img src="${p.image}" alt="" />` : `<i class="fa-solid ${p.icon || iconForCategory(p.category)}"></i>`}
            </div>
          </td>
          <td>
            <div class="table-name">${p.name}</div>
            <div class="table-sub">${p.brand}</div>
          </td>
          <td>${p.category}</td>
          <td>${(p.rating ?? 0).toFixed(1)} <span class="table-sub">(${(p.reviewCount || 0).toLocaleString()})</span></td>
          <td>${p.badge ? `<span class="badge badge--${slugify(p.badge)}">${p.badge}</span>` : `<span class="table-sub">—</span>`}</td>
          <td class="col-flags">${flagIcons(p)}</td>
          <td class="col-actions">
            <button type="button" class="icon-btn" data-edit="${p.id}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="icon-btn" data-duplicate="${p.id}" aria-label="Duplicate"><i class="fa-solid fa-copy"></i></button>
            <button type="button" class="icon-btn icon-btn--danger" data-delete="${p.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      })
      .join("");
  }

  function moveProduct(id, direction) {
    const ordered = [...workingProducts].sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
    const idx = ordered.findIndex((p) => p.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;

    const a = ordered[idx];
    const b = ordered[swapIdx];
    const tmp = a.order ?? a.id;
    a.order = b.order ?? b.id;
    b.order = tmp;

    saveProducts();
    renderProductsTable();
    toast("Order updated.", "success");
  }

  /* ==========================================================================
     PRODUCT FORM (Add / Edit)
     ========================================================================== */
  function openProductForm(product) {
    editingProductId = product ? product.id : null;
    qs("#product-form-title").textContent = product ? "Edit product" : "Add product";
    const form = qs("#product-form");
    form.reset();
    clearFormErrors(form);

    const categorySelect = qs("#field-category");
    categorySelect.innerHTML = (window.PICKIFY_CATEGORIES || [])
      .map((c) => `<option value="${c.name}">${c.name}</option>`)
      .join("");

    const badgeSelect = qs("#field-badge");
    badgeSelect.innerHTML = `<option value="">No badge</option>` + BADGE_OPTIONS.map((b) => `<option value="${b}">${b}</option>`).join("");

    qs("#field-price").innerHTML = PRICE_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join("");

    if (product) {
      qs("#field-name").value = product.name || "";
      qs("#field-brand").value = product.brand || "";
      categorySelect.value = product.category || "Cleanser";
      qs("#field-amazon-link").value = product.amazonLink || "";
      qs("#field-rating").value = product.rating ?? 4.5;
      qs("#field-review-count").value = product.reviewCount ?? 0;
      qs("#field-match-score").value = product.matchScore ?? 90;
      badgeSelect.value = product.badge || "";
      qs("#field-price").value = product.price || "$";
      qs("#field-short-review").value = product.shortReview || "";
      qs("#field-featured").checked = Boolean(product.featured);
      qs("#field-trending").checked = Boolean(product.trending);
      qs("#field-bestseller").checked = Boolean(product.bestSeller);
      qs("#field-recent").checked = Boolean(product.recentlyAdded);
      qs("#field-image-url").value = product.image || "";
      updateImagePreview(product.image || "");

      qs("#field-overview").value = product.overview || "";
      qs("#field-review").value = product.review || "";
      qs("#field-how-to-use").value = product.howToUse || "";
      qs("#field-who-for").value = product.whoFor || "";
      qs("#field-who-avoid").value = product.whoAvoid || "";
      qs("#field-pros").value = arrayToLines(product.pros);
      qs("#field-cons").value = arrayToLines(product.cons);
      qs("#field-ingredients").value = arrayToLines(product.ingredients);
      qs("#field-skin-type").value = arrayToLines(product.skinType);
      qs("#field-skin-concern").value = arrayToLines(product.skinConcern);
      qs("#field-keywords").value = arrayToLines(product.keywords);
    } else {
      categorySelect.value = "Cleanser";
      badgeSelect.value = "";
      qs("#field-price").value = "$";
      qs("#field-rating").value = 4.5;
      qs("#field-review-count").value = 0;
      qs("#field-match-score").value = 90;
      updateImagePreview("");
    }

    qs("#product-form-overlay").classList.add("is-open");
    qs("#field-name").focus();
  }

  function closeProductForm() {
    qs("#product-form-overlay").classList.remove("is-open");
    editingProductId = null;
  }

  function updateImagePreview(src) {
    const preview = qs("#image-preview");
    if (!preview) return;
    if (src) {
      preview.innerHTML = `<img src="${src}" alt="Preview" />`;
      preview.classList.add("has-image");
    } else {
      preview.innerHTML = `<i class="fa-solid fa-image" aria-hidden="true"></i><span>No image — icon placeholder will be used</span>`;
      preview.classList.remove("has-image");
    }
  }

  function clearFormErrors(form) {
    qsa(".form-error", form).forEach((el) => (el.textContent = ""));
    qsa(".form-field", form).forEach((el) => el.classList.remove("has-error"));
  }

  function setFieldError(fieldEl, message) {
    const wrap = fieldEl.closest(".form-field");
    if (!wrap) return;
    wrap.classList.add("has-error");
    const err = qs(".form-error", wrap);
    if (err) err.textContent = message;
  }

  function validateProductForm() {
    const form = qs("#product-form");
    clearFormErrors(form);
    let valid = true;

    const name = qs("#field-name");
    const brand = qs("#field-brand");
    const link = qs("#field-amazon-link");
    const rating = qs("#field-rating");
    const shortReview = qs("#field-short-review");

    if (!name.value.trim()) { setFieldError(name, "Product name is required."); valid = false; }
    if (!brand.value.trim()) { setFieldError(brand, "Brand is required."); valid = false; }
    if (!link.value.trim()) { setFieldError(link, "Amazon affiliate link is required."); valid = false; }
    const ratingNum = parseFloat(rating.value);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) { setFieldError(rating, "Rating must be between 0 and 5."); valid = false; }
    if (!shortReview.value.trim()) { setFieldError(shortReview, "A short description is required for the card."); valid = false; }

    return valid;
  }

  function buildProductFromForm() {
    const category = qs("#field-category").value;
    const name = qs("#field-name").value.trim();
    const brand = qs("#field-brand").value.trim();
    const base = editingProductId ? workingProducts.find((p) => p.id === editingProductId) : null;

    const product = {
      id: base ? base.id : nextId(),
      order: base ? (base.order ?? base.id) : nextOrder(),
      slug: base ? base.slug : uniqueSlug(slugify(`${brand}-${name}`)),
      name,
      brand,
      category,
      skinType: linesToArray(qs("#field-skin-type").value).length ? linesToArray(qs("#field-skin-type").value) : ["All Skin Types"],
      skinConcern: linesToArray(qs("#field-skin-concern").value),
      keywords: linesToArray(qs("#field-keywords").value),
      rating: parseFloat(qs("#field-rating").value) || 0,
      reviewCount: parseInt(qs("#field-review-count").value, 10) || 0,
      matchScore: parseInt(qs("#field-match-score").value, 10) || 90,
      badge: qs("#field-badge").value || null,
      featured: qs("#field-featured").checked,
      trending: qs("#field-trending").checked,
      bestSeller: qs("#field-bestseller").checked,
      recentlyAdded: qs("#field-recent").checked,
      price: qs("#field-price").value || "$",
      icon: iconForCategory(category),
      image: qs("#field-image-url").value.trim(),
      shortReview: qs("#field-short-review").value.trim(),
      overview: qs("#field-overview").value.trim(),
      pros: linesToArray(qs("#field-pros").value),
      cons: linesToArray(qs("#field-cons").value),
      review: qs("#field-review").value.trim(),
      ingredients: linesToArray(qs("#field-ingredients").value),
      howToUse: qs("#field-how-to-use").value.trim(),
      whoFor: qs("#field-who-for").value.trim(),
      whoAvoid: qs("#field-who-avoid").value.trim(),
      faqs: base ? base.faqs || [] : [],
      amazonLink: qs("#field-amazon-link").value.trim()
    };
    return product;
  }

  function initProductForm() {
    qs("#product-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateProductForm()) {
        toast("Please fix the highlighted fields.", "error");
        return;
      }
      const product = buildProductFromForm();
      if (editingProductId) {
        const idx = workingProducts.findIndex((p) => p.id === editingProductId);
        workingProducts[idx] = product;
        toast("Product updated. Preview refreshed in this browser.", "success");
      } else {
        workingProducts.push(product);
        toast("Product added. Preview refreshed in this browser.", "success");
      }
      saveProducts();
      renderProductsTable();
      renderDashboard();
      closeProductForm();
    });

    qsa("[data-close-product-form]").forEach((btn) => btn.addEventListener("click", closeProductForm));

    qs("#field-image-url").addEventListener("input", (e) => updateImagePreview(e.target.value.trim()));

    const uploadInput = qs("#field-image-upload");
    if (uploadInput) {
      uploadInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) {
          toast("Please choose an image under 1.5MB — large images bloat local storage and the exported file.", "error");
          uploadInput.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          qs("#field-image-url").value = reader.result;
          updateImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* ==========================================================================
     PRODUCTS VIEW — toolbar (search, sort, add, import, export)
     ========================================================================== */
  function initProductsToolbar() {
    qs("#add-product-btn").addEventListener("click", () => openProductForm(null));

    qs("#products-search").addEventListener("input", (e) => {
      tableQuery = e.target.value;
      renderProductsTable();
    });

    qs("#products-sort").addEventListener("change", (e) => {
      const [key, dir] = e.target.value.split(":");
      tableSort = { key, dir };
      renderProductsTable();
    });

    qs("#products-table-body").addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit]");
      const dupBtn = e.target.closest("[data-duplicate]");
      const delBtn = e.target.closest("[data-delete]");
      const moveBtn = e.target.closest("[data-move]");

      if (editBtn) {
        const product = workingProducts.find((p) => p.id === Number(editBtn.dataset.edit));
        if (product) openProductForm(product);
      }

      if (dupBtn) {
        const original = workingProducts.find((p) => p.id === Number(dupBtn.dataset.duplicate));
        if (!original) return;
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = nextId();
        copy.order = nextOrder();
        copy.name = `${original.name} (Copy)`;
        copy.slug = uniqueSlug(slugify(`${copy.brand}-${copy.name}`));
        workingProducts.push(copy);
        saveProducts();
        renderProductsTable();
        renderDashboard();
        toast("Product duplicated.", "success");
      }

      if (delBtn) {
        const product = workingProducts.find((p) => p.id === Number(delBtn.dataset.delete));
        if (!product) return;
        const ok = await confirmAction({
          title: "Delete this product?",
          message: `"${product.name}" will be removed from your local preview. This can't be undone here — but it's still safe in the last exported products.js until you export again.`,
          confirmLabel: "Delete",
          danger: true
        });
        if (!ok) return;
        workingProducts = workingProducts.filter((p) => p.id !== product.id);
        saveProducts();
        renderProductsTable();
        renderDashboard();
        toast("Product deleted.", "success");
      }

      if (moveBtn) {
        moveProduct(Number(moveBtn.dataset.id), moveBtn.dataset.move);
      }
    });
  }

  /* ==========================================================================
     IMPORT / EXPORT — Products
     ========================================================================== */
  function extractArrayLiteral(text, varName) {
    const marker = `const ${varName} = [`;
    const start = text.indexOf(marker);
    if (start === -1) return null;
    const openBracket = start + marker.length - 1;
    let depth = 0;
    for (let i = openBracket; i < text.length; i++) {
      if (text[i] === "[") depth++;
      if (text[i] === "]") {
        depth--;
        if (depth === 0) return text.slice(openBracket, i + 1);
      }
    }
    return null;
  }

  function initImportExport() {
    const importInput = qs("#import-products-input");
    importInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const loadingToast = toast("Importing products.js…", "success");
      try {
        const text = await file.text();
        const literal = extractArrayLiteral(text, "PICKIFY_PRODUCTS");
        if (!literal) throw new Error("Couldn't find a PICKIFY_PRODUCTS array in that file.");
        // eslint-disable-next-line no-new-func
        const parsed = new Function(`"use strict"; return (${literal});`)();
        if (!Array.isArray(parsed) || !parsed.length) throw new Error("That file didn't contain any products.");

        parsed.forEach((p, i) => {
          if (typeof p.order !== "number") p.order = p.id ?? i + 1;
          if (!("badge" in p)) p.badge = Array.isArray(p.badges) ? p.badges[0] || null : null;
          if (typeof p.featured !== "boolean") p.featured = false;
          if (typeof p.trending !== "boolean") p.trending = false;
          if (typeof p.bestSeller !== "boolean") p.bestSeller = false;
          if (typeof p.recentlyAdded !== "boolean") p.recentlyAdded = false;
          if (!("image" in p)) p.image = "";
        });

        workingProducts = parsed;
        saveProducts();
        renderProductsTable();
        renderDashboard();
        toast(`Imported ${parsed.length} products. This is now your working set — edit freely, then export when ready.`, "success");
      } catch (err) {
        toast(`Import failed: ${err.message}`, "error");
      } finally {
        importInput.value = "";
      }
    });

    qs("#export-products-btn").addEventListener("click", () => {
      const fileText = buildProductsFileText(workingProducts);
      downloadFile("products.js", fileText);
      toast("products.js downloaded. Replace it in your project and redeploy to publish these changes.", "success");
    });

    qs("#discard-products-btn").addEventListener("click", async () => {
      const ok = await confirmAction({
        title: "Discard local product changes?",
        message: "This resets your preview back to the products.js currently deployed on the site. Anything you've added or edited here (and not exported) will be lost.",
        confirmLabel: "Discard changes",
        danger: true
      });
      if (!ok) return;
      localStorage.removeItem(PRODUCTS_KEY);
      workingProducts = JSON.parse(JSON.stringify(window.PICKIFY_PRODUCTS_DEFAULT || []));
      setDirtyBadge(false);
      renderProductsTable();
      renderDashboard();
      toast("Local changes discarded.", "success");
    });
  }

  function buildProductsFileText(products) {
    const categories = window.PICKIFY_CATEGORIES || [];
    return `/* ==========================================================================
   Pickify Lab — Product Data
   Exported from the admin dashboard on ${new Date().toLocaleString()}.
   Replace the deployed js/products.js with this file and redeploy to
   publish these changes to every visitor.
   ========================================================================== */

const PICKIFY_PRODUCTS = ${JSON.stringify(products, null, 2)};

const PICKIFY_CATEGORIES = ${JSON.stringify(categories, null, 2)};

if (typeof window !== "undefined") {
  window.PICKIFY_PRODUCTS = PICKIFY_PRODUCTS;
  window.PICKIFY_CATEGORIES = PICKIFY_CATEGORIES;
  window.PICKIFY_PRODUCTS_DEFAULT = PICKIFY_PRODUCTS;
  window.PICKIFY_STORAGE_KEY = "pickify-admin-products";

  try {
    const overlay = window.localStorage.getItem(window.PICKIFY_STORAGE_KEY);
    if (overlay) {
      const parsed = JSON.parse(overlay);
      if (Array.isArray(parsed) && parsed.length) {
        window.PICKIFY_PRODUCTS = parsed;
      }
    }
  } catch (err) {
    console.warn("Pickify Lab: ignoring corrupt local admin overlay.", err);
  }
}
`;
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ==========================================================================
     CATEGORIES VIEW (read-only reference — categories are structural)
     ========================================================================== */
  function renderCategoriesView() {
    const wrap = qs("#categories-overview");
    if (!wrap) return;
    const byCategory = {};
    workingProducts.forEach((p) => { byCategory[p.category] = (byCategory[p.category] || 0) + 1; });
    wrap.innerHTML = (window.PICKIFY_CATEGORIES || [])
      .map(
        (c) => `
      <div class="category-overview-card">
        <div class="category-overview-card__icon"><i class="fa-solid ${c.icon}" aria-hidden="true"></i></div>
        <div>
          <h3>${c.name}</h3>
          <p>${c.description}</p>
          <span class="category-overview-card__count">${byCategory[c.name] || 0} product${(byCategory[c.name] || 0) === 1 ? "" : "s"}</span>
        </div>
      </div>`
      )
      .join("");
  }

  /* ==========================================================================
     SETTINGS VIEW
     ========================================================================== */
  function renderSettingsForm() {
    qs("#setting-email").value = workingSettings.businessEmail || "";
    qs("#setting-instagram").value = (workingSettings.social || {}).instagram || "";
    qs("#setting-tiktok").value = (workingSettings.social || {}).tiktok || "";
    qs("#setting-youtube").value = (workingSettings.social || {}).youtube || "";
    qs("#setting-facebook").value = (workingSettings.social || {}).facebook || "";
    qs("#setting-x").value = (workingSettings.social || {}).x || "";
    qs("#setting-disclosure").value = (workingSettings.disclosureText || "").replace(/^Affiliate disclosure:\s*/i, "");
  }

  function initSettingsView() {
    renderSettingsForm();

    qs("#settings-form").addEventListener("submit", (e) => {
      e.preventDefault();
      workingSettings = {
        businessEmail: qs("#setting-email").value.trim() || workingSettings.businessEmail,
        social: {
          instagram: qs("#setting-instagram").value.trim(),
          tiktok: qs("#setting-tiktok").value.trim(),
          youtube: qs("#setting-youtube").value.trim(),
          facebook: qs("#setting-facebook").value.trim(),
          x: qs("#setting-x").value.trim()
        },
        disclosureText: qs("#setting-disclosure").value.trim()
      };
      saveSettings();
      toast("Settings saved. Preview refreshed in this browser.", "success");
    });

    qs("#export-settings-btn").addEventListener("click", () => {
      const fileText = `/* ==========================================================================
   Pickify Lab — Settings
   Exported from the admin dashboard on ${new Date().toLocaleString()}.
   Replace the deployed js/settings.js with this file and redeploy to
   publish these changes to every visitor.
   ========================================================================== */

const PICKIFY_SETTINGS = ${JSON.stringify(workingSettings, null, 2)};

if (typeof window !== "undefined") {
  window.PICKIFY_SETTINGS = PICKIFY_SETTINGS;
  window.PICKIFY_SETTINGS_STORAGE_KEY = "pickify-admin-settings";
  window.PICKIFY_SETTINGS_DEFAULT = PICKIFY_SETTINGS;

  try {
    const overlay = window.localStorage.getItem(window.PICKIFY_SETTINGS_STORAGE_KEY);
    if (overlay) {
      const parsed = JSON.parse(overlay);
      if (parsed && typeof parsed === "object") {
        window.PICKIFY_SETTINGS = { ...PICKIFY_SETTINGS, ...parsed, social: { ...PICKIFY_SETTINGS.social, ...(parsed.social || {}) } };
      }
    }
  } catch (err) {
    console.warn("Pickify Lab: ignoring corrupt local settings overlay.", err);
  }
}
`;
      downloadFile("settings.js", fileText);
      toast("settings.js downloaded. Replace it in your project and redeploy to publish.", "success");
    });

    qs("#discard-settings-btn").addEventListener("click", async () => {
      const ok = await confirmAction({
        title: "Discard local settings changes?",
        message: "This resets settings back to what's currently deployed on the site.",
        confirmLabel: "Discard changes",
        danger: true
      });
      if (!ok) return;
      localStorage.removeItem(SETTINGS_KEY);
      workingSettings = JSON.parse(JSON.stringify(window.PICKIFY_SETTINGS_DEFAULT || {}));
      renderSettingsForm();
      setDirtyBadge(false);
      toast("Settings changes discarded.", "success");
    });
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  function bootDashboard() {
    workingProducts = loadProducts();
    workingSettings = loadSettings();

    const hasOverlay = localStorage.getItem(PRODUCTS_KEY) || localStorage.getItem(SETTINGS_KEY);
    setDirtyBadge(Boolean(hasOverlay));

    initAdminNav();
    renderDashboard();
    renderProductsTable();
    renderCategoriesView();
    initProductsToolbar();
    initProductForm();
    initImportExport();
    initSettingsView();
  }

  document.addEventListener("DOMContentLoaded", initAuth);
})();
