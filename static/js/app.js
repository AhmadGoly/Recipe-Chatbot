const API = "";

let username = "";
let selectedFile = null;
let recipeLocked = false;
let chatEvents = [];

// Local cache for current active ingredients and latest suggested recipes
let activeIngredients = [];
let latestRecipes = [];

// ===== DOM Elements =====
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginInput = document.getElementById("login-input");
const appEl = document.getElementById("app");
const chatArea = document.getElementById("chat-area");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const imageInput = document.getElementById("image-input");
const imagePreview = document.getElementById("image-preview");
const previewImg = document.getElementById("preview-img");
const removeImage = document.getElementById("remove-image");
const recipeBanner = document.getElementById("recipe-banner");
const resetBtn = document.getElementById("reset-btn");
const sendBtn = document.getElementById("send-btn");

// Extended Elements
const userGreeting = document.getElementById("user-greeting");
const ingCountBadge = document.getElementById("ing-count");
const sidebarIngredientsList = document.getElementById("sidebar-ingredients-list");
const recipeListContainer = document.getElementById("recipe-list-container");
const manualIngForm = document.getElementById("manual-ing-form");
const manualIngInput = document.getElementById("manual-ing-input");

// Lightbox Elements
const lightbox = document.getElementById("image-lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.querySelector(".lightbox-close");

// Responsive tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const ingredientsPanel = document.getElementById("ingredients-panel");
const chatPanel = document.getElementById("chat-panel");
const recipesPanel = document.getElementById("recipes-panel");

// ===== Interactive Backdrop Canvas =====
const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");

let particles = [];
let mouse = { x: null, y: null, radius: 150 };

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Handle Mouse Moves over canvas background
window.addEventListener("mousemove", (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
});

window.addEventListener("mouseout", () => {
    mouse.x = null;
    mouse.y = null;
});

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 8 + 3;
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = (Math.random() * 30) + 15;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        // Soft white and light blue alpha-transparent colors
        const colors = [
            "rgba(179, 229, 252, 0.25)",
            "rgba(225, 245, 254, 0.3)",
            "rgba(255, 255, 255, 0.45)",
            "rgba(224, 242, 254, 0.2)"
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        // Continuous organic drifting
        this.baseX += this.speedX;
        this.baseY += this.speedY;

        // Wrap around limits
        if (this.baseX < 0) this.baseX = canvas.width;
        if (this.baseX > canvas.width) this.baseX = 0;
        if (this.baseY < 0) this.baseY = canvas.height;
        if (this.baseY > canvas.height) this.baseY = 0;

        this.x = this.baseX;
        this.y = this.baseY;

        // Interaction with mouse pointer
        if (mouse.x !== null && mouse.y !== null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.hypot(dx, dy);

            if (distance < mouse.radius) {
                let forceDirectionX = dx / distance;
                let forceDirectionY = dy / distance;
                let maxDistance = mouse.radius;
                let force = (maxDistance - distance) / maxDistance;
                let directionX = forceDirectionX * force * this.density;
                let directionY = forceDirectionY * force * this.density;

                // Repel away from mouse organically
                this.x -= directionX;
                this.y -= directionY;
            }
        }
    }
}

function initParticles() {
    particles = [];
    const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 25000));
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background organic waves
    const time = Date.now() * 0.0008;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let x = 0; x <= canvas.width; x += 10) {
        const y = canvas.height * 0.82 + Math.sin(x * 0.003 + time) * 15 + Math.cos(x * 0.0015 + time * 1.5) * 8;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fillStyle = "rgba(179, 229, 252, 0.06)";
    ctx.fill();

    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateParticles);
}

initParticles();
animateParticles();

// Trigger a small physical mouse flare ripple around coordinates
function triggerRipple(x, y) {
    if (!x || !y) return;
    const originalRadius = mouse.radius;
    mouse.radius = 280;
    mouse.x = x;
    mouse.y = y;
    setTimeout(() => {
        mouse.radius = originalRadius;
        mouse.x = null;
        mouse.y = null;
    }, 400);
}

// ===== Mobile Tabs Routing =====
tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const selectedTab = btn.getAttribute("data-tab");

        // Toggle visibility
        ingredientsPanel.classList.add("hidden-mobile");
        chatPanel.classList.add("hidden-mobile");
        recipesPanel.classList.add("hidden-mobile");

        ingredientsPanel.classList.remove("active-mobile");
        chatPanel.classList.remove("active-mobile");
        recipesPanel.classList.remove("active-mobile");

        if (selectedTab === "ingredients") {
            ingredientsPanel.classList.remove("hidden-mobile");
            ingredientsPanel.classList.add("active-mobile");
        } else if (selectedTab === "recipes") {
            recipesPanel.classList.remove("hidden-mobile");
            recipesPanel.classList.add("active-mobile");
        } else {
            chatPanel.classList.remove("hidden-mobile");
            chatPanel.classList.add("active-mobile");
        }
    });
});

// ===== Lightbox Operations =====
function setupImageZoom(imgElement) {
    imgElement.addEventListener("click", () => {
        lightboxImg.src = imgElement.src;
        lightbox.classList.remove("hidden");
    });
}

lightboxClose.addEventListener("click", () => {
    lightbox.classList.add("hidden");
});

lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target === lightboxClose) {
        lightbox.classList.add("hidden");
    }
});

// ===== History Cache =====
function historyKey() {
    return `chatbot_history_${username}`;
}

function saveHistory() {
    try {
        localStorage.setItem(historyKey(), JSON.stringify(chatEvents));
        localStorage.setItem(`ingredients_${username}`, JSON.stringify(activeIngredients));
        localStorage.setItem(`recipes_${username}`, JSON.stringify(latestRecipes));
    } catch {}
}

function loadHistory() {
    try {
        const raw = localStorage.getItem(historyKey());
        const rawIng = localStorage.getItem(`ingredients_${username}`);
        const rawRec = localStorage.getItem(`recipes_${username}`);

        if (rawIng) activeIngredients = JSON.parse(rawIng);
        if (rawRec) latestRecipes = JSON.parse(rawRec);

        if (!raw) return false;
        chatEvents = JSON.parse(raw);
        return chatEvents.length > 0;
    } catch {
        return false;
    }
}

function clearHistory() {
    chatEvents = [];
    activeIngredients = [];
    latestRecipes = [];
    localStorage.removeItem(historyKey());
    localStorage.removeItem(`ingredients_${username}`);
    localStorage.removeItem(`recipes_${username}`);
}

function replayHistory() {
    recipeLocked = false;
    for (const evt of chatEvents) {
        switch (evt.type) {
            case "message":
                addMessage(evt.role, evt.content, false);
                break;
            case "image":
                addUserImageMessageFromSrc(evt.dataUrl, false);
                break;
            case "ingredients":
                // Ingredients are already drawn from replay activeIngredients
                break;
            case "recipes":
                // Recipes are already drawn from replay latestRecipes
                break;
            case "banner":
                recipeLocked = true;
                showSelectedRecipeBanner(evt.recipe, false);
                break;
        }
    }

    drawIngredientsPanel();
    drawRecipesPanel();
    scrollToBottom();
}

// ===== Login =====
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = loginInput.value.trim();
    if (!name) return;
    username = name;
    showApp();

    // Spark animation ripple on sign-in
    triggerRipple(window.innerWidth / 2, window.innerHeight / 2);
});

function showApp() {
    loginScreen.classList.add("hidden");
    appEl.classList.remove("hidden");
    userGreeting.textContent = `${username} عزیز، خوش آمدید`;

    const hasHistory = loadHistory();
    if (hasHistory) {
        const welcome = chatArea.querySelector(".welcome-message");
        if (welcome) welcome.remove();
        replayHistory();
    } else {
        drawIngredientsPanel();
        drawRecipesPanel();
    }

    messageInput.focus();
}

// ===== Reset =====
resetBtn.addEventListener("click", async () => {
    if (!confirm("آیا مطمئن هستید؟ تمام مکالمه پاک خواهد شد.")) return;

    try {
        await fetch(`${API}/reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
        });
    } catch {}

    clearHistory();
    chatArea.innerHTML = `
        <div class="welcome-message animate-float-slow">
            <div class="welcome-chef-graphic">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="64" height="64">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.3 4.8a4.5 4.5 0 1 0-6.6 0M12 11.25V21m-4.5-9.75h9m-9 4.5h9" />
                </svg>
            </div>
            <p>سلام! من دستیار پخت غذای ایرانی شما هستم. عکس مواد غذایی موجود خود را بفرستید یا آن‌ها را بنویسید تا بهترین دستور غذاهای ایرانی را به همراه درصد تطابق به شما پیشنهاد کنم.</p>
        </div>`;
    recipeBanner.innerHTML = "";
    recipeBanner.classList.add("hidden");
    recipeLocked = false;
    clearImage();

    drawIngredientsPanel();
    drawRecipesPanel();
});

// ===== Chat Form submit =====
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await sendMessage();
});

messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// ===== Image Input listener =====
imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        imagePreview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
});

removeImage.addEventListener("click", () => {
    clearImage();
});

function clearImage() {
    selectedFile = null;
    imageInput.value = "";
    previewImg.src = "";
    imagePreview.classList.add("hidden");
}

// ===== Send Message routine =====
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !selectedFile) return;

    // Remove welcome message
    const welcome = chatArea.querySelector(".welcome-message");
    if (welcome) welcome.remove();

    // Show user message
    if (text) {
        addMessage("user", text, true);
    }
    if (selectedFile) {
        addUserImageMessage(selectedFile, true);
    }

    messageInput.value = "";

    // Build form data
    const formData = new FormData();
    formData.append("username", username);
    if (text) formData.append("message", text);
    if (selectedFile) formData.append("image", selectedFile);

    clearImage();

    // Show typing loader
    const typing = addTypingIndicator();
    scrollToBottom();
    setSending(true);

    try {
        const res = await fetch(`${API}/chat`, {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();
        typing.remove();

        // Bot text response
        if (data.response) {
            addMessage("bot", data.response, true);
        }

        // Ingredients
        if (data.ingredients) {
            activeIngredients = data.ingredients;
            drawIngredientsPanel();

            // Add a small inline pills section to chat bubble list
            if (data.ingredients.length > 0) {
                addIngredientsPills(data.ingredients, true);
            }
        }

        // Recipe suggestions
        if (data.recipes) {
            latestRecipes = data.recipes;
            drawRecipesPanel();
        }

        // Update selected recipe banner if locked
        if (recipeLocked && data.recipes && data.recipes.length > 0) {
            showSelectedRecipeBanner(data.recipes[0], true);
        }

        saveHistory();
    } catch (err) {
        typing.remove();
        addMessage("bot", "خطایی رخ داد. لطفاً دوباره تلاش کنید.", true);
    }

    setSending(false);
    scrollToBottom();
}

// ===== Manual Ingredient Add =====
manualIngForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = manualIngInput.value.trim();
    if (!name) return;

    // Check if ingredient exists, increment count, else push new
    const existing = activeIngredients.find(ing => ing.name === name);
    if (existing) {
        existing.count += 1;
    } else {
        activeIngredients.push({ name: name, count: 1 });
    }

    manualIngInput.value = "";
    drawIngredientsPanel();
    syncIngredientsWithBackend();

    // Animate and notify via ripple
    triggerRipple(window.innerWidth - 150, window.innerHeight / 2);
});

// Sync ingredients with backend asynchronously
async function syncIngredientsWithBackend() {
    saveHistory();
    try {
        const res = await fetch(`${API}/update_ingredients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: username,
                ingredients: activeIngredients
            }),
        });
        if (!res.ok) {
            console.error("Failed to sync ingredients with backend");
        }
    } catch (err) {
        console.error("Error syncing ingredients:", err);
    }
}

// Delete manual ingredient action
function deleteIngredient(index) {
    activeIngredients.splice(index, 1);
    drawIngredientsPanel();
    syncIngredientsWithBackend();
}

function changeIngredientCount(index, delta) {
    activeIngredients[index].count += delta;
    if (activeIngredients[index].count <= 0) {
        activeIngredients.splice(index, 1);
    }
    drawIngredientsPanel();
    syncIngredientsWithBackend();
}

// ===== Rendering UI Lists =====

function drawIngredientsPanel() {
    // Set badge count
    const totalCount = activeIngredients.reduce((acc, curr) => acc + curr.count, 0);
    ingCountBadge.textContent = `${totalCount} مورد`;

    sidebarIngredientsList.innerHTML = "";

    if (activeIngredients.length === 0) {
        sidebarIngredientsList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="48" height="48">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m16.5 0a1.5 1.5 0 00-1.5-1.5H5.25A1.5 1.5 0 003.75 7.5m16.5 0l-2.25-4.5a1.5 1.5 0 00-1.35-.9h-9a1.5 1.5 0 00-1.35.9L3.75 7.5" />
                </svg>
                <p>هنوز ماده اولیه‌ای ثبت نشده است.</p>
            </div>
        `;
        return;
    }

    activeIngredients.forEach((ing, index) => {
        const item = document.createElement("div");
        item.className = "sidebar-ing-item";
        item.style.animationDelay = `${index * 0.05}s`;

        item.innerHTML = `
            <div class="ing-details">
                <span class="ing-dot"></span>
                <span class="ing-name">${ing.name}</span>
            </div>
            <div class="ing-controls">
                <button class="qty-btn minus-btn" title="کاهش">-</button>
                <span class="ing-qty">${ing.count}</span>
                <button class="qty-btn plus-btn" title="افزایش">+</button>
                <button class="delete-ing-btn" title="حذف">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        `;

        // Event listeners for quantity modification
        item.querySelector(".minus-btn").addEventListener("click", () => {
            changeIngredientCount(index, -1);
        });

        item.querySelector(".plus-btn").addEventListener("click", () => {
            changeIngredientCount(index, 1);
        });

        // Delete trigger hook
        item.querySelector(".delete-ing-btn").addEventListener("click", () => {
            deleteIngredient(index);
        });

        sidebarIngredientsList.appendChild(item);
    });
}

function drawRecipesPanel() {
    recipeListContainer.innerHTML = "";

    if (recipeLocked) {
        recipeListContainer.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="48" height="48">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p>دستور پخت نهایی انتخاب شده است و جزئیات آن در هدر بالا قابل مشاهده است.</p>
            </div>
        `;
        return;
    }

    if (latestRecipes.length === 0) {
        recipeListContainer.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="48" height="48">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25" />
                </svg>
                <p>دستور پختی برای پیشنهاد وجود ندارد. ابتدا مواد غذایی خود را ارسال کنید.</p>
            </div>
        `;
        return;
    }

    latestRecipes.forEach((recipe, index) => {
        const card = document.createElement("div");
        card.className = "recipe-card-box";
        card.style.animationDelay = `${index * 0.1}s`;

        // Calculate match percentage dynamically
        const available = recipe.available_ingredients ? recipe.available_ingredients.length : 0;
        const missing = recipe.missing_ingredients ? recipe.missing_ingredients.length : 0;
        const total = available + missing;
        const matchPercent = total > 0 ? Math.round((available / total) * 100) : 100;

        // Circular progress parameters: circumference 2 * PI * r = 2 * 3.14 * 22 = 138.16
        const strokeOffset = 138 - (138 * matchPercent) / 100;

        // Visual rendering
        card.innerHTML = `
            <div class="recipe-card-top">
                <div class="recipe-card-title">${recipe.name}</div>

                <div class="match-meter-wrapper" title="میزان تطابق مواد: ${matchPercent}%">
                    <svg class="match-meter-svg">
                        <circle cx="26" cy="26" r="22" class="match-meter-bg"></circle>
                        <circle cx="26" cy="26" r="22" class="match-meter-fill" style="stroke-dashoffset: ${strokeOffset};"></circle>
                    </svg>
                    <span class="match-percentage-txt">${matchPercent}%</span>
                </div>
            </div>

            <p class="recipe-card-explanation">${recipe.explanation}</p>
        `;

        // Available sections inside card
        if (recipe.available_ingredients && recipe.available_ingredients.length > 0) {
            const sec = document.createElement("div");
            sec.className = "recipe-card-section";
            sec.innerHTML = `
                <h5>مواد موجود شما:</h5>
                <div class="pills">
                    ${recipe.available_ingredients.map(ing => `<span class="pill available">${ing}</span>`).join("")}
                </div>
            `;
            card.appendChild(sec);
        }

        // Missing sections inside card
        if (recipe.missing_ingredients && recipe.missing_ingredients.length > 0) {
            const sec = document.createElement("div");
            sec.className = "recipe-card-section";
            sec.innerHTML = `
                <h5>مواد مورد نیاز باقی‌مانده:</h5>
                <div class="pills">
                    ${recipe.missing_ingredients.map(ing => `<span class="pill missing">${ing}</span>`).join("")}
                </div>
            `;
            card.appendChild(sec);
        }

        // Select buttons
        const selectBtn = document.createElement("button");
        selectBtn.className = "recipe-select-btn";
        selectBtn.innerHTML = `
            <span>انتخاب این دستور</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;

        selectBtn.addEventListener("click", () => {
            selectRecipe(index);
        });

        card.appendChild(selectBtn);
        recipeListContainer.appendChild(card);
    });
}

// ===== Select Recipe Action =====
async function selectRecipe(index) {
    setSending(true);

    try {
        const res = await fetch(`${API}/select_recipe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, recipe_index: index }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Select failed");
        }

        const data = await res.json();
        recipeLocked = true;

        // Refresh recipes side view with success layout
        drawRecipesPanel();

        // Top banner display
        showSelectedRecipeBanner(data.recipe, true);

        addMessage("bot", `دستور **«${data.recipe.name}»** انتخاب شد.\n\nحالا می‌توانید مواد لازم را آماده کنید یا سوالاتتان را بپرسید.`, true);

        triggerRipple(window.innerWidth / 2, 100);
        saveHistory();
    } catch (err) {
        addMessage("bot", "خطا در انتخاب دستور. لطفاً دوباره تلاش کنید.", true);
    }

    setSending(false);
}

// ===== DOM Builders =====

function addMessage(role, text, cache = true) {
    const div = document.createElement("div");
    div.className = `message ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (role === "bot") {
        bubble.innerHTML = marked.parse(text);
    } else {
        bubble.textContent = text;
    }

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = formatTime();

    div.appendChild(bubble);
    div.appendChild(time);
    chatArea.appendChild(div);
    scrollToBottom();

    if (cache) {
        chatEvents.push({ type: "message", role, content: text });
        saveHistory();
    }
}

function addUserImageMessage(file, cache = true) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        addUserImageMessageFromSrc(dataUrl, cache);
    };
    reader.readAsDataURL(file);
}

function addUserImageMessageFromSrc(dataUrl, cache = true) {
    const div = document.createElement("div");
    div.className = "message user";

    const img = document.createElement("img");
    img.className = "message-image";
    img.src = dataUrl;
    img.alt = "تصویر ارسالی";

    // Add magnifying click zoom action
    setupImageZoom(img);

    div.appendChild(img);
    chatArea.appendChild(div);
    scrollToBottom();

    if (cache) {
        chatEvents.push({ type: "image", dataUrl });
        saveHistory();
    }
}

function addIngredientsPills(ingredients, cache = true) {
    const section = document.createElement("div");
    section.className = "ingredients-section";

    const h4 = document.createElement("h4");
    h4.textContent = "مواد تشخیص داده شده جدید:";
    section.appendChild(h4);

    const pills = document.createElement("div");
    pills.className = "pills";

    ingredients.forEach((ing) => {
        const pill = document.createElement("span");
        pill.className = "pill ingredient";
        pill.textContent = `${ing.name} (${ing.count})`;
        pills.appendChild(pill);
    });

    section.appendChild(pills);
    chatArea.appendChild(section);
    scrollToBottom();

    if (cache) {
        chatEvents.push({ type: "ingredients", items: ingredients });
        saveHistory();
    }
}

function addTypingIndicator() {
    const div = document.createElement("div");
    div.className = "message bot";
    div.id = "typing";

    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = "<span></span><span></span><span></span>";

    div.appendChild(indicator);
    chatArea.appendChild(div);
    return div;
}

function showSelectedRecipeBanner(recipe, cache = true) {
    recipeBanner.innerHTML = "";
    recipeBanner.classList.remove("hidden");

    const missing = recipe.missing_ingredients || [];

    let missingHtml = "";
    if (missing.length > 0) {
        missingHtml = `
            <div class="banner-missing">
                <span class="banner-missing-label">باید تهیه شود:</span>
                <span class="banner-missing-items">${missing.join("، ")}</span>
            </div>
        `;
    } else {
        missingHtml = `<div class="banner-missing banner-ready">همه مواد آماده است! نوش جان!</div>`;
    }

    recipeBanner.innerHTML = `
        <span class="banner-icon">&#127860;</span>
        <div class="banner-info">
            <span class="banner-name">${recipe.name}</span>
            ${missingHtml}
        </div>
    `;

    if (cache) {
        const found = chatEvents.find(e => e.type === "banner");
        if (found) {
            found.recipe = recipe;
        } else {
            chatEvents.push({ type: "banner", recipe });
        }
        saveHistory();
    }
}

// ===== General Utility Helpers =====
function scrollToBottom() {
    setTimeout(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    }, 100);
}

function setSending(busy) {
    sendBtn.disabled = busy;
    messageInput.disabled = busy;
}

function formatTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
}
