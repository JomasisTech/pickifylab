/* ==========================================================================
   Pickify Lab — Search
   Instant, client-side product search. No page refresh, no network call.
   ========================================================================== */

const PickifySearch = (function () {
  /**
   * Score a product against a query. Higher is better; 0 means no match.
   * Brand and name matches rank above keyword matches so "Cera" surfaces
   * CeraVe before it surfaces something that merely mentions ceramides.
   */
  function scoreProduct(product, query) {
    const q = query.trim().toLowerCase();
    if (!q) return 0;

    const name = product.name.toLowerCase();
    const brand = product.brand.toLowerCase();
    const category = product.category.toLowerCase();
    const full = `${brand} ${name}`.toLowerCase();

    let score = 0;

    if (full.startsWith(q)) score += 100;
    if (brand.startsWith(q)) score += 90;
    if (name.startsWith(q)) score += 80;
    if (brand.includes(q)) score += 50;
    if (name.includes(q)) score += 45;
    if (category.includes(q)) score += 30;

    const keywordHit = product.keywords.some((k) => k.toLowerCase().includes(q));
    if (keywordHit) score += 25;

    const concernHit = (product.skinConcern || []).some((c) => c.toLowerCase().includes(q));
    if (concernHit) score += 15;

    return score;
  }

  function search(query, products = window.PICKIFY_PRODUCTS || []) {
    if (!query || !query.trim()) return [];
    return products
      .map((p) => ({ product: p, score: scoreProduct(p, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.product);
  }

  function filterByCategory(category, products = window.PICKIFY_PRODUCTS || []) {
    if (!category || category === "All") return products;
    return products.filter((p) => p.category === category);
  }

  return { search, filterByCategory, scoreProduct };
})();

if (typeof window !== "undefined") {
  window.PickifySearch = PickifySearch;
}
