const API = {
  search: "https://www.themealdb.com/api/json/v1/1/search.php?s=",
  filterCategory: "https://www.themealdb.com/api/json/v1/1/filter.php?c=",
  filterArea: "https://www.themealdb.com/api/json/v1/1/filter.php?a=",
  lookup: "https://www.themealdb.com/api/json/v1/1/lookup.php?i=",
};

const keywordMap = {
  spicy: { tags: ["spicy"], categories: ["Chicken", "Beef", "Vegetarian", "Miscellaneous"], areas: ["Mexican", "Indian", "Thai"], words: ["spicy", "hot", "pepper", "cajun", "salsa"] },
  handheld: { tags: ["handheld"], categories: ["Pork", "Chicken", "Beef", "Starter"], words: ["taco", "wrap", "sandwich", "burger", "handheld", "burrito"] },
  comfort: { tags: ["comfort"], categories: ["Pasta", "Beef", "Chicken", "Dessert"], words: ["comfort", "cozy", "hearty", "warm", "casserole"] },
  light: { tags: ["light"], categories: ["Seafood", "Vegetarian", "Vegan", "Side"], words: ["light", "fresh", "bright", "salad", "skinny"] },
  sweet: { tags: ["sweet"], categories: ["Dessert"], words: ["sweet", "dessert", "sugar", "cake", "pie", "ice cream"] },
  cheesy: { tags: ["cheesy"], categories: ["Pasta", "Side", "Vegetarian"], words: ["cheese", "cheesy", "mac", "lasagna", "quesadilla", "pizza"] },
  savory: { tags: ["savory"], categories: ["Beef", "Pork", "Chicken", "Lamb"], words: ["savory", "umami", "rich", "meaty", "gravy"] },
  crispy: { tags: ["crispy"], categories: ["Starter", "Chicken", "Side"], words: ["crispy", "crunchy", "fried", "crunch"] },
  refreshing: { tags: ["refreshing"], categories: ["Seafood", "Salad", "Vegetarian"], words: ["refreshing", "cool", "citrus", "chilled", "mint"] },
  warm: { tags: ["warm"], categories: ["Beef", "Chicken", "Pork", "Lamb"], words: ["warm", "soupy", "stew", "roast", "broth"] },
};

const sampleChips = [
  "spicy",
  "handheld",
  "comfort food",
  "light",
  "sweet",
  "cheesy",
  "savory",
  "crispy",
];

const searchForm = document.getElementById("craving-form");
const cravingInput = document.getElementById("craving-input");
const searchButton = document.getElementById("search-button");
const surpriseButton = document.getElementById("surprise-button");
const clearButton = document.getElementById("clear-button");
const statusPanel = document.getElementById("status-panel");
const resultsPanel = document.getElementById("results-panel");
const cardsGrid = document.getElementById("cards-grid");
const explanationText = document.getElementById("explanation-text");
const fallbackPanel = document.getElementById("fallback-panel");
const historyPanel = document.getElementById("history-panel");
const recentChipsContainer = document.getElementById("recent-chips");
const modalBackdrop = document.getElementById("modal-backdrop");
const closeModalButton = document.getElementById("close-modal");
const modalTitle = document.getElementById("modal-title");
const modalImage = document.getElementById("modal-image");
const modalCategory = document.getElementById("modal-category");
const modalArea = document.getElementById("modal-area");
const modalInstructions = document.getElementById("modal-instructions");
const modalIngredients = document.getElementById("modal-ingredients");
const modalLinks = document.getElementById("modal-links");

let favorites = new Set();
let recentSearches = [];
let currentMeals = [];
let isLoading = false;

function safeFetch(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return response.json();
  });
}

function normalizeText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:()"']/g, "")
    .replace(/\s+/g, " ");
}

function extractTags(craving) {
  const normalized = normalizeText(craving);
  const tokens = normalized.split(" ");
  const matchedTags = new Set();

  Object.values(keywordMap).forEach((entry) => {
    entry.words.forEach((word) => {
      if (normalized.includes(word)) {
        entry.tags.forEach((tag) => matchedTags.add(tag));
      }
    });
  });

  tokens.forEach((token) => {
    if (keywordMap[token]) {
      keywordMap[token].tags.forEach((tag) => matchedTags.add(tag));
    }

    Object.entries(keywordMap).forEach(([key, entry]) => {
      if (key !== token && token.includes(key)) {
        entry.tags.forEach((tag) => matchedTags.add(tag));
      }
    });
  });

  return Array.from(matchedTags);
}

function buildSearchPlan(tags) {
  const categoryCounts = {};
  const areaCounts = {};
  const keywords = new Set();

  tags.forEach((tag) => {
    const entry = Object.values(keywordMap).find((item) => item.tags.includes(tag));
    if (!entry) return;

    entry.categories.forEach((category) => {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    entry.areas?.forEach((area) => {
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    });
    entry.words.forEach((word) => keywords.add(word));
  });

  const categoryList = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  const areaList = Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([area]) => area);

  return {
    tags,
    categories: categoryList,
    areas: areaList,
    keywords: Array.from(keywords),
  };
}

function createExplanation(craving, tags, plan, fallback = false) {
  if (fallback || !tags.length) {
    return `Your craving was unique, so we selected a tasty mix of crowd-pleasing meals to inspire you.`;
  }

  const tagPhrase = tags.length === 1 ? tags[0] : tags.slice(0, 2).join(" + ");
  const categoryPhrase = plan.categories.length ? ` ${plan.categories.slice(0, 2).join(" and ")}` : " diverse dishes";
  return `We translated “${craving}” into ${tagPhrase}${categoryPhrase}. These meals capture that mood.`;
}

function updateStatus(message, active = true) {
  statusPanel.innerHTML = `<p>${message}</p>`;
  statusPanel.classList.toggle("active", active);
}

function showFallback(message) {
  fallbackPanel.innerHTML = `<p>${message}</p>`;
  fallbackPanel.classList.remove("hidden");
}

function hideFallback() {
  fallbackPanel.classList.add("hidden");
}

function showResults() {
  resultsPanel.classList.remove("hidden");
}

function hideResults() {
  resultsPanel.classList.add("hidden");
}

function saveFavorites() {
  localStorage.setItem("bitematch_favorites", JSON.stringify(Array.from(favorites)));
}

function saveRecentSearches() {
  localStorage.setItem("bitematch_recent", JSON.stringify(recentSearches.slice(0, 5)));
}

function loadStorage() {
  const storedFavorites = JSON.parse(localStorage.getItem("bitematch_favorites") || "[]");
  favorites = new Set(storedFavorites);
  recentSearches = JSON.parse(localStorage.getItem("bitematch_recent") || "[]");
  renderRecentSearches();
}

function renderRecentSearches() {
  recentChipsContainer.innerHTML = "";
  if (!recentSearches.length) {
    historyPanel.classList.add("hidden");
    return;
  }

  historyPanel.classList.remove("hidden");
  recentSearches.forEach((search) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = search;
    chip.addEventListener("click", () => {
      cravingInput.value = search;
      performSearch(search);
    });
    recentChipsContainer.appendChild(chip);
  });
}

function updateRecentSearches(query) {
  const clean = query.trim();
  if (!clean) return;
  recentSearches = [clean, ...recentSearches.filter((item) => item !== clean)].slice(0, 5);
  saveRecentSearches();
  renderRecentSearches();
}

function toggleFavorite(mealId, cardHeart) {
  if (favorites.has(mealId)) {
    favorites.delete(mealId);
  } else {
    favorites.add(mealId);
  }
  saveFavorites();
  cardHeart.classList.toggle("active", favorites.has(mealId));
}

function renderMealCards(meals, plan) {
  cardsGrid.innerHTML = "";

  meals.slice(0, 8).forEach((meal) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${meal.strMealThumb}" alt="${meal.strMeal} photo" />
      <div class="card-body">
        <h3 class="card-title">${meal.strMeal}</h3>
        <div class="card-meta">
          <span>${meal.strCategory || "Mixed"}</span>
          <span>${meal.strArea || "Global"}</span>
        </div>
        <div class="card-badges">
          ${plan.tags.slice(0, 2).map((tag) => `<span class="badge">${tag}</span>`).join("")}
          ${plan.categories.slice(0, 1).map((category) => `<span class="badge">${category}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button type="button" class="button button-secondary detail-button" data-meal-id="${meal.idMeal}">View Details</button>
          <button type="button" class="favorite-button ${favorites.has(meal.idMeal) ? "active" : ""}" data-meal-id="${meal.idMeal}">
            ♥ ${favorites.has(meal.idMeal) ? "Saved" : "Favorite"}
          </button>
        </div>
      </div>
    `;

    const detailButton = card.querySelector(".detail-button");
    const favoriteButton = card.querySelector(".favorite-button");

    detailButton.addEventListener("click", () => openMealModal(meal.idMeal));
    favoriteButton.addEventListener("click", () => toggleFavorite(meal.idMeal, favoriteButton));

    cardsGrid.appendChild(card);
  });
}

function renderModalDetail(meal) {
  modalTitle.textContent = meal.strMeal;
  modalImage.src = meal.strMealThumb;
  modalImage.alt = meal.strMeal;
  modalCategory.textContent = meal.strCategory ? meal.strCategory.toUpperCase() : "Dish";
  modalArea.textContent = meal.strArea ? `Cuisine: ${meal.strArea}` : "Global inspiration";
  modalInstructions.textContent = meal.strInstructions ? meal.strInstructions : "No instructions available.";

  modalIngredients.innerHTML = "";
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const ingredient = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ingredient && ingredient.trim()) {
      ingredients.push(`${measure ? measure.trim() : ""} ${ingredient.trim()}`.trim());
    }
  }

  if (ingredients.length) {
    ingredients.forEach((item) => {
      const itemNode = document.createElement("span");
      itemNode.textContent = item;
      modalIngredients.appendChild(itemNode);
    });
  } else {
    modalIngredients.innerHTML = "<p>No ingredient details available.</p>";
  }

  modalLinks.innerHTML = "";
  if (meal.strYoutube) {
    const youtubeLink = document.createElement("a");
    youtubeLink.href = meal.strYoutube;
    youtubeLink.textContent = "Watch on YouTube";
    youtubeLink.target = "_blank";
    youtubeLink.rel = "noreferrer noopener";
    modalLinks.appendChild(youtubeLink);
  }

  if (meal.strSource) {
    const sourceLink = document.createElement("a");
    sourceLink.href = meal.strSource;
    sourceLink.textContent = "View full recipe";
    sourceLink.target = "_blank";
    sourceLink.rel = "noreferrer noopener";
    modalLinks.appendChild(sourceLink);
  }

  modalBackdrop.classList.remove("hidden");
  closeModalButton.focus();
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
}

function fetchMealDetails(id) {
  return safeFetch(`${API.lookup}${id}`).then((data) => data.meals?.[0] || null);
}

function openMealModal(mealId) {
  const existingMeal = currentMeals.find((item) => item.idMeal === mealId);
  if (existingMeal && existingMeal.strInstructions) {
    renderModalDetail(existingMeal);
    return;
  }

  updateStatus("Loading meal details...", true);
  fetchMealDetails(mealId)
    .then((meal) => {
      if (!meal) {
        throw new Error("Meal details are unavailable.");
      }
      renderModalDetail(meal);
    })
    .catch(() => {
      updateStatus("Could not load meal details. Please try another dish.", true);
    });
}

async function fetchMealsByCategory(category) {
  const data = await safeFetch(`${API.filterCategory}${encodeURIComponent(category)}`);
  return Array.isArray(data.meals) ? data.meals : [];
}

async function fetchMealsByArea(area) {
  const data = await safeFetch(`${API.filterArea}${encodeURIComponent(area)}`);
  return Array.isArray(data.meals) ? data.meals : [];
}

async function fetchMealsByName(query) {
  const data = await safeFetch(`${API.search}${encodeURIComponent(query)}`);
  return Array.isArray(data.meals) ? data.meals : [];
}

function uniqueMeals(meals) {
  const found = new Map();
  meals.forEach((meal) => {
    if (!found.has(meal.idMeal)) {
      found.set(meal.idMeal, meal);
    }
  });
  return Array.from(found.values());
}

function chooseFallbackMeals(mealList) {
  return mealList.slice(0, 6);
}

async function performSearch(craving) {
  if (isLoading) return;
  const cleanCraving = craving.trim();
  if (!cleanCraving) {
    updateStatus("Tell BiteMatch what you&apos;re craving and we&apos;ll find something delicious.", true);
    return;
  }

  isLoading = true;
  updateStatus("Finding dishes that match your vibe...", true);
  hideFallback();
  hideResults();
  cardsGrid.innerHTML = "";

  const tags = extractTags(cleanCraving);
  const plan = buildSearchPlan(tags);
  updateRecentSearches(cleanCraving);

  let mealCandidates = [];
  const searchRequests = [];

  plan.categories.forEach((category) => {
    searchRequests.push(fetchMealsByCategory(category).catch(() => []));
  });

  plan.areas.forEach((area) => {
    searchRequests.push(fetchMealsByArea(area).catch(() => []));
  });

  if (plan.keywords.length) {
    plan.keywords.slice(0, 2).forEach((keyword) => {
      searchRequests.push(fetchMealsByName(keyword).catch(() => []));
    });
  }

  if (searchRequests.length === 0) {
    searchRequests.push(fetchMealsByName("chicken"));
    searchRequests.push(fetchMealsByName("salad"));
  }

  try {
    const results = await Promise.all(searchRequests);
    mealCandidates = uniqueMeals(results.flat());

    if (!mealCandidates.length) {
      const fallbackResponses = await Promise.all([
        fetchMealsByCategory("Chicken").catch(() => []),
        fetchMealsByCategory("Vegetarian").catch(() => []),
        fetchMealsByName("pasta").catch(() => []),
      ]);
      mealCandidates = uniqueMeals(fallbackResponses.flat());
      explanationText.textContent = createExplanation(cleanCraving, tags, plan, true);
      showFallback("We couldn’t find an exact match, but here are a few tasty ideas to explore.");
    } else {
      explanationText.textContent = createExplanation(cleanCraving, tags, plan);
    }

    currentMeals = mealCandidates.slice(0, 8).map((meal) => ({ ...meal, strInstructions: meal.strInstructions || "" }));
    renderMealCards(currentMeals, plan);
    showResults();
  } catch (error) {
    showFallback("Something went wrong while fetching meals. Please check your connection and try again.");
    updateStatus("Unable to retrieve meal suggestions.", true);
    hideResults();
  } finally {
    isLoading = false;
  }
}

function attachSampleChipListeners() {
  const chipButtons = document.querySelectorAll(".chip");
  chipButtons.forEach((button) => {
    button.addEventListener("click", () => {
      cravingInput.value = button.textContent;
      performSearch(button.textContent);
    });
  });
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performSearch(cravingInput.value);
});

surpriseButton.addEventListener("click", () => {
  const surprise = sampleChips[Math.floor(Math.random() * sampleChips.length)];
  cravingInput.value = surprise;
  performSearch(surprise);
});

clearButton.addEventListener("click", () => {
  cravingInput.value = "";
  hideResults();
  hideFallback();
  updateStatus("Ready when you are. Type a craving or try a sample chip.", true);
});

closeModalButton.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalBackdrop.classList.contains("hidden")) {
    closeModal();
  }
});

function initializeApp() {
  loadStorage();
  attachSampleChipListeners();
  updateStatus("Ready when you are. Type a craving or try a sample chip.", true);
}

initializeApp();
