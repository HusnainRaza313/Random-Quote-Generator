/* ============================================================
   Quotely — Random Quote Generator
   script.js
   Vanilla JavaScript — no frameworks.
   Modules: Storage, Quotes, UI, Favorites, Search, Stats,
            Theme, Ripple, Toast, Events, Init.
   ============================================================ */

(function () {
    "use strict";

    /* ========================================================
       1. DOM references
       ======================================================== */
    const el = {
        html: document.documentElement,
        app: document.getElementById("app"),
        loader: document.getElementById("loader"),
        bg: document.getElementById("bgGradient"),

        card: document.getElementById("quoteCard"),
        text: document.getElementById("quoteText"),
        author: document.getElementById("quoteAuthor"),
        category: document.getElementById("quoteCategory"),

        newBtn: document.getElementById("newQuoteBtn"),
        copyBtn: document.getElementById("copyBtn"),
        shareBtn: document.getElementById("shareBtn"),
        favBtn: document.getElementById("favBtn"),

        themeToggle: document.getElementById("themeToggle"),

        statTotal: document.getElementById("statTotal"),
        statFav: document.getElementById("statFav"),
        statViewed: document.getElementById("statViewed"),

        searchInput: document.getElementById("searchInput"),
        searchClear: document.getElementById("searchClear"),
        searchCount: document.getElementById("searchCount"),
        searchResults: document.getElementById("searchResults"),

        favList: document.getElementById("favList"),
        favEmpty: document.getElementById("favEmpty"),
        clearFavBtn: document.getElementById("clearFavBtn"),

        toast: document.getElementById("toast"),
    };

    /* ========================================================
       2. Storage (Local Storage helpers)
       ======================================================== */
    const KEYS = {
        theme: "quotely.theme",
        favorites: "quotely.favorites",
        viewed: "quotely.viewed",
    };

    const Storage = {
        get(key, fallback) {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : JSON.parse(v);
            } catch {
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch {
                /* storage may be unavailable */
            }
        },
    };

    /* ========================================================
       3. Quotes data
       ======================================================== */
    const QUOTES = Array.isArray(window.QUOTELY_QUOTES) ? window.QUOTELY_QUOTES : [];

    /* Unique id for a quote (used to identify favorites) */
    function quoteId(q, index) {
        return q.text + "|" + q.author;
    }
    /* Build a map of id -> quote once for quick lookup */
    const QUOTE_INDEX = new Map();
    QUOTES.forEach((q, i) => QUOTE_INDEX.set(quoteId(q, i), q));

    /* ========================================================
       4. State
       ======================================================== */
    /* "viewed" is stored as an array of unique quote ids the user has
       seen, so the stat can never exceed the total quote count.
       (Older versions stored a plain incrementing number — if we find
       that, just discard it and start fresh.) */
    const storedViewed = Storage.get(KEYS.viewed, []);
    const validIds = new Set(QUOTES.map((q) => quoteId(q)));
    const cleanedViewed = (Array.isArray(storedViewed) ? storedViewed : []).filter((id) =>
        validIds.has(id)
    );
    const state = {
        currentIndex: -1,
        viewedIds: new Set(cleanedViewed),
        favorites: Storage.get(KEYS.favorites, []), // array of quote objects
    };
    /* Persist the cleaned list right away in case stale ids were dropped */
    Storage.set(KEYS.viewed, Array.from(state.viewedIds));

    /* ========================================================
       5. Toast notifications
       ======================================================== */
    let toastTimer = null;
    function showToast(message, icon) {
        const iconHtml = icon ? `<i class="fa-solid ${icon}"></i>` : "";
        el.toast.innerHTML = iconHtml + "<span>" + message + "</span>";
        el.toast.hidden = false;
        requestAnimationFrame(() => el.toast.classList.add("is-visible"));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.toast.classList.remove("is-visible");
            setTimeout(() => (el.toast.hidden = true), 300);
        }, 1900);
    }

    /* ========================================================
       6. Theme (Dark / Light)
       ======================================================== */
    const Theme = {
        init() {
            const saved = Storage.get(KEYS.theme, null);
            const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
            const theme = saved || (prefersLight ? "light" : "dark");
            this.apply(theme);
        },
        apply(theme) {
            el.html.setAttribute("data-theme", theme);
            const icon = theme === "dark" ? "fa-moon" : "fa-sun";
            el.themeToggle.innerHTML = `<i class="fa-solid ${icon}"></i>`;
            Storage.set(KEYS.theme, theme);
        },
        toggle() {
            const current = el.html.getAttribute("data-theme");
            this.apply(current === "dark" ? "light" : "dark");
        },
    };

    /* ========================================================
       7. Animated background — random gradient per quote
       ======================================================== */
    const GRADIENTS = [
        ["#4f7bff", "#a78bfa"],
        ["#ff7ab6", "#6ee7ff"],
        ["#5eead4", "#4f7bff"],
        ["#ffd479", "#ff7ab6"],
        ["#6ee7ff", "#a78bfa"],
        ["#ff7ab6", "#ffd479"],
        ["#4f7bff", "#5eead4"],
        ["#a78bfa", "#ff7ab6"],
    ];

    function randomizeBackground() {
        const g = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
        el.bg.style.background =
            "linear-gradient(135deg, " + g[0] + "22, var(--bg) 60%), var(--bg)";
        /* tint blobs */
        const blobs = el.bg.querySelectorAll(".blob");
        if (blobs[2]) blobs[2].style.background = `radial-gradient(circle at 50% 50%, ${g[0]}, transparent 65%)`;
        if (blobs[3]) blobs[3].style.background = `radial-gradient(circle at 50% 50%, ${g[1]}, transparent 65%)`;
    }

    /* ========================================================
       8. Ripple effect on buttons
       ======================================================== */
    function attachRipple(btn) {
        btn.addEventListener("click", function (e) {
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            const span = document.createElement("span");
            span.className = "rip";
            span.style.width = span.style.height = size + "px";
            span.style.left = x + "px";
            span.style.top = y + "px";
            btn.appendChild(span);
            setTimeout(() => span.remove(), 600);
        });
    }
    document.querySelectorAll(".ripple").forEach(attachRipple);

    /* ========================================================
       9. Core quote rendering
       ======================================================== */
    function pickRandomIndex() {
        if (QUOTES.length <= 1) return 0;
        let i;
        do {
            i = Math.floor(Math.random() * QUOTES.length);
        } while (i === state.currentIndex);
        return i;
    }

    function renderQuote(index, animate) {
        const q = QUOTES[index];
        if (!q) return;
        state.currentIndex = index;
        state.viewedIds.add(quoteId(q));
        Storage.set(KEYS.viewed, Array.from(state.viewedIds));
        Stats.update();

        const apply = () => {
            el.text.textContent = q.text;
            el.author.textContent = "\u2014 " + q.author;
            el.category.textContent = q.category || "";
            Favorites.updateButton();
            el.card.classList.remove("is-leaving");
            el.card.classList.add("is-entering");
            requestAnimationFrame(() =>
                requestAnimationFrame(() => el.card.classList.remove("is-entering"))
            );
        };

        if (!animate) {
            apply();
            return;
        }
        el.card.classList.add("is-leaving");
        setTimeout(apply, 220);
        randomizeBackground();
    }

    function showNewQuote() {
        renderQuote(pickRandomIndex(), true);
    }

    /* Jump directly to a specific quote (used by search results) */
    function goToQuote(index) {
        renderQuote(index, true);
        el.card.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    /* ========================================================
       10. Copy quote
       ======================================================== */
    async function copyQuote() {
        const q = QUOTES[state.currentIndex];
        if (!q) return;
        const payload = `"${q.text}" \u2014 ${q.author}`;
        try {
            await navigator.clipboard.writeText(payload);
            showToast("Quote copied!", "fa-check");
        } catch {
            showToast("Couldn't copy \u2014 try again", "fa-triangle-exclamation");
        }
    }

    /* ========================================================
       11. Share on X (Twitter)
       ======================================================== */
    function shareQuote() {
        const q = QUOTES[state.currentIndex];
        if (!q) return;
        const text = `"${q.text}" \u2014 ${q.author}`;
        const url =
            "https://twitter.com/intent/tweet?text=" +
            encodeURIComponent(text);
        window.open(url, "_blank", "noopener,noreferrer,width=600,height=480");
    }

    /* ========================================================
       12. Favorites (Local Storage)
       ======================================================== */
    const Favorites = {
        isFav(q) {
            return state.favorites.some((f) => quoteId(f) === quoteId(q));
        },
        toggle() {
            const q = QUOTES[state.currentIndex];
            if (!q) return;
            const id = quoteId(q);
            if (this.isFav(q)) {
                state.favorites = state.favorites.filter((f) => quoteId(f) !== id);
                showToast("Removed from favorites", "fa-heart-crack");
            } else {
                state.favorites.unshift({ text: q.text, author: q.author, category: q.category });
                showToast("Added to favorites", "fa-heart");
            }
            Storage.set(KEYS.favorites, state.favorites);
            this.updateButton();
            this.render();
            Stats.update();
        },
        remove(id) {
            state.favorites = state.favorites.filter((f) => quoteId(f) !== id);
            Storage.set(KEYS.favorites, state.favorites);
            this.render();
            Stats.update();
            if (state.currentIndex >= 0) this.updateButton();
        },
        clear() {
            if (!state.favorites.length) return;
            state.favorites = [];
            Storage.set(KEYS.favorites, state.favorites);
            this.render();
            Stats.update();
            if (state.currentIndex >= 0) this.updateButton();
            showToast("Favorites cleared", "fa-trash");
        },
        updateButton() {
            const q = QUOTES[state.currentIndex];
            if (!q) return;
            const isFav = this.isFav(q);
            el.favBtn.classList.toggle("is-fav", isFav);
            el.favBtn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
            const icon = isFav ? "fa-solid fa-heart" : "fa-regular fa-heart";
            el.favBtn.innerHTML = `<i class="${icon}"></i><span>Favorite</span>`;
        },
        render() {
            const list = state.favorites;
            el.clearFavBtn.hidden = list.length === 0;

            if (list.length === 0) {
                el.favList.innerHTML = "";
                el.favEmpty.hidden = false;
                return;
            }
            el.favEmpty.hidden = true;

            el.favList.innerHTML = list
                .map((q) => {
                    const id = quoteId(q);
                    const text = escapeHtml(q.text);
                    const author = escapeHtml(q.author);
                    return `
            <article class="fav-card" data-id="${id}">
              <button class="fav-card__remove" type="button" aria-label="Remove favorite" data-id="${id}">
                <i class="fa-solid fa-xmark"></i>
              </button>
              <p class="fav-card__text">"${text}"</p>
              <p class="fav-card__author">\u2014 ${author}</p>
            </article>`;
                })
                .join("");

            /* wire remove buttons */
            el.favList.querySelectorAll(".fav-card__remove").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute("data-id");
                    const card = el.favList.querySelector(`.fav-card[data-id="${cssEscape(id)}"]`);
                    if (card) {
                        card.classList.add("is-removing");
                        setTimeout(() => this.remove(id), 280);
                    } else {
                        this.remove(id);
                    }
                });
            });
        },
    };

    /* ========================================================
       13. Search (keyword / author)
       ======================================================== */
    const Search = {
        query: "",
        maxResults: 8,

        onInput(value) {
            this.query = value.trim().toLowerCase();
            el.searchClear.hidden = this.query === "";
            this.render();
        },
        clear() {
            el.searchInput.value = "";
            this.query = "";
            el.searchClear.hidden = true;
            this.render();
            el.searchInput.focus();
        },
        /* Returns matches as { quote, index } so we can jump to them */
        matches() {
            if (!this.query) return [];
            const results = [];
            QUOTES.forEach((q, index) => {
                const hit =
                    q.text.toLowerCase().includes(this.query) ||
                    q.author.toLowerCase().includes(this.query) ||
                    (q.category || "").toLowerCase().includes(this.query);
                if (hit) results.push({ quote: q, index });
            });
            return results;
        },
        highlight(str) {
            if (!this.query) return escapeHtml(str);
            const escaped = escapeHtml(str);
            const escapedQuery = escapeHtml(this.query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp("(" + escapedQuery + ")", "ig");
            return escaped.replace(re, "<mark>$1</mark>");
        },
        render() {
            const results = this.matches();

            if (!this.query) {
                el.searchCount.hidden = true;
                el.searchCount.textContent = "";
                el.searchResults.innerHTML = "";
                return;
            }

            el.searchCount.hidden = false;
            const n = results.length;
            el.searchCount.textContent =
                n === 0
                    ? "No quotes found. Try another keyword."
                    : n + " quote" + (n === 1 ? "" : "s") + ' match "' + this.query + '"';

            if (n === 0) {
                el.searchResults.innerHTML = "";
                return;
            }

            const shown = results.slice(0, this.maxResults);
            el.searchResults.innerHTML = shown
                .map(({ quote, index }) => {
                    const text = this.highlight(quote.text);
                    const author = this.highlight(quote.author);
                    const category = quote.category ? escapeHtml(quote.category) : "";
                    return `
            <button type="button" class="search-result" data-index="${index}">
              <p class="search-result__text">"${text}"</p>
              <div class="search-result__meta">
                <span class="search-result__author">\u2014 ${author}</span>
                ${category ? `<span class="search-result__category">${category}</span>` : ""}
              </div>
            </button>`;
                })
                .join("");

            el.searchResults.querySelectorAll(".search-result").forEach((card) => {
                card.addEventListener("click", () => {
                    const index = parseInt(card.getAttribute("data-index"), 10);
                    goToQuote(index);
                    this.clear();
                });
            });
        },
    };

    /* ========================================================
       14. Statistics
       ======================================================== */
    const Stats = {
        update() {
            el.statTotal.textContent = QUOTES.length;
            el.statFav.textContent = state.favorites.length;
            el.statViewed.textContent = state.viewedIds.size;
        },
    };

    /* ========================================================
       15. Small utilities
       ======================================================== */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    function cssEscape(str) {
        if (window.CSS && CSS.escape) return CSS.escape(str);
        return String(str).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
    }

    /* ========================================================
       16. Event wiring
       ======================================================== */
    el.newBtn.addEventListener("click", showNewQuote);
    el.copyBtn.addEventListener("click", copyQuote);
    el.shareBtn.addEventListener("click", shareQuote);
    el.favBtn.addEventListener("click", () => Favorites.toggle());
    el.themeToggle.addEventListener("click", () => Theme.toggle());
    el.clearFavBtn.addEventListener("click", () => Favorites.clear());

    el.searchInput.addEventListener("input", (e) => Search.onInput(e.target.value));
    el.searchClear.addEventListener("click", () => Search.clear());

    /* Keyboard shortcut: Space = new quote (ignore when typing) */
    document.addEventListener("keydown", (e) => {
        const tag = (e.target && e.target.tagName) || "";
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SEARCH";
        if (e.code === "Space" && !typing) {
            e.preventDefault();
            showNewQuote();
        } else if (e.key === "Escape" && Search.query) {
            Search.clear();
        }
    });

    /* ========================================================
       17. Init
       ======================================================== */
    function init() {
        Theme.init();
        Stats.update();
        Favorites.render();
        randomizeBackground();
        renderQuote(pickRandomIndex(), false);

        /* hide loader, reveal app */
        setTimeout(() => {
            el.loader.classList.add("is-hidden");
            el.app.hidden = false;
        }, 650);
    }

    /* Wait for DOM ready */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();