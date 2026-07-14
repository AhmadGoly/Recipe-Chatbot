const API = "";

let username = localStorage.getItem("chatbot_username") || "";
let selectedFile = null;
let recipeLocked = false;
let chatEvents = [];

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

// ===== History Cache =====
function historyKey() {
    return `chatbot_history_${username}`;
}

function saveHistory() {
    try {
        localStorage.setItem(historyKey(), JSON.stringify(chatEvents));
    } catch {}
}

function loadHistory() {
    try {
        const raw = localStorage.getItem(historyKey());
        if (!raw) return false;
        chatEvents = JSON.parse(raw);
        return chatEvents.length > 0;
    } catch {
        return false;
    }
}

function clearHistory() {
    chatEvents = [];
    localStorage.removeItem(historyKey());
}

function replayHistory() {
    for (const evt of chatEvents) {
        switch (evt.type) {
            case "message":
                addMessage(evt.role, evt.content, false);
                break;
            case "image":
                addUserImageMessageFromSrc(evt.dataUrl, false);
                break;
            case "ingredients":
                addIngredientsPills(evt.items, false);
                break;
            case "recipes":
                showRecipes(evt.items, false);
                break;
            case "banner":
                showSelectedRecipeBanner(evt.recipe, false);
                break;
        }
    }
    scrollToBottom();
}

// ===== Init =====
if (username) {
    showApp();
}

// ===== Login =====
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = loginInput.value.trim();
    if (!name) return;
    username = name;
    localStorage.setItem("chatbot_username", username);
    showApp();
});

function showApp() {
    loginScreen.classList.add("hidden");
    appEl.classList.remove("hidden");

    const hasHistory = loadHistory();
    if (hasHistory) {
        const welcome = chatArea.querySelector(".welcome-message");
        if (welcome) welcome.remove();
        replayHistory();
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
        <div class="welcome-message">
            <p>سلام! عکس مواد غذایی خود را بفرستید یا بنویسید چه چیزی در دسترس دارید تا بهترین دستورهای غذایی را پیشنهاد دهم.</p>
        </div>`;
    recipeBanner.innerHTML = "";
    recipeBanner.classList.add("hidden");
    recipeLocked = false;
    clearImage();
});

// ===== Chat Form =====
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

// ===== Image Input =====
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

// ===== Send Message =====
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

    // Show typing indicator
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
        if (data.ingredients && data.ingredients.length > 0) {
            addIngredientsPills(data.ingredients, true);
        }

        // Recipe cards (only when no recipe is locked)
        if (!recipeLocked && data.recipes && data.recipes.length > 0) {
            showRecipes(data.recipes, true);
        }

        // Update banner when recipe is locked
        if (recipeLocked && data.recipes && data.recipes.length > 0) {
            showSelectedRecipeBanner(data.recipes[0], true);
        }
    } catch (err) {
        typing.remove();
        addMessage("bot", "خطایی رخ داد. لطفاً دوباره تلاش کنید.", true);
    }

    setSending(false);
    scrollToBottom();
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
    h4.textContent = "مواد تشخیص داده شده:";
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

let currentRecipeGrid = null;

function showRecipes(recipes, cache = true) {
    hideRecipes();

    const wrapper = document.createElement("div");
    wrapper.className = "recipes-wrapper";

    const title = document.createElement("h3");
    title.textContent = "دستورهای پیشنهادی";
    wrapper.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "recipes-grid";

    recipes.forEach((recipe, index) => {
        const card = document.createElement("div");
        card.className = "recipe-card";

        const name = document.createElement("div");
        name.className = "recipe-name";
        name.textContent = recipe.name;

        const explanation = document.createElement("div");
        explanation.className = "recipe-explanation";
        explanation.textContent = recipe.explanation;

        card.appendChild(name);
        card.appendChild(explanation);

        // Available ingredients
        if (recipe.available_ingredients && recipe.available_ingredients.length > 0) {
            const section = document.createElement("div");
            section.className = "recipe-section";

            const h5 = document.createElement("h5");
            h5.textContent = "مواد موجود:";
            section.appendChild(h5);

            const pills = document.createElement("div");
            pills.className = "pills";
            recipe.available_ingredients.forEach((ing) => {
                const pill = document.createElement("span");
                pill.className = "pill available";
                pill.textContent = ing;
                pills.appendChild(pill);
            });
            section.appendChild(pills);
            card.appendChild(section);
        }

        // Missing ingredients
        if (recipe.missing_ingredients && recipe.missing_ingredients.length > 0) {
            const section = document.createElement("div");
            section.className = "recipe-section";

            const h5 = document.createElement("h5");
            h5.textContent = "مواد مورد نیاز:";
            section.appendChild(h5);

            const pills = document.createElement("div");
            pills.className = "pills";
            recipe.missing_ingredients.forEach((ing) => {
                const pill = document.createElement("span");
                pill.className = "pill missing";
                pill.textContent = ing;
                pills.appendChild(pill);
            });
            section.appendChild(pills);
            card.appendChild(section);
        }

        // Select button
        const btn = document.createElement("button");
        btn.className = "select-btn";
        btn.textContent = "انتخاب";
        btn.addEventListener("click", () => selectRecipe(index));
        card.appendChild(btn);

        grid.appendChild(card);
    });

    wrapper.appendChild(grid);
    chatArea.appendChild(wrapper);
    currentRecipeGrid = wrapper;
    scrollToBottom();

    if (cache) {
        chatEvents.push({ type: "recipes", items: recipes });
        saveHistory();
    }
}

function hideRecipes() {
    if (currentRecipeGrid) {
        currentRecipeGrid.remove();
        currentRecipeGrid = null;
    }
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
        missingHtml = `<div class="banner-missing banner-ready">همه مواد آماده است!</div>`;
    }

    recipeBanner.innerHTML = `
        <span class="banner-icon">&#127860;</span>
        <div class="banner-info">
            <span class="banner-name">${recipe.name}</span>
            ${missingHtml}
        </div>
    `;

    if (cache) {
        chatEvents.push({ type: "banner", recipe });
        saveHistory();
    }
}

// ===== Select Recipe =====
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
        hideRecipes();
        showSelectedRecipeBanner(data.recipe, true);
        addMessage("bot", `دستور **«${data.recipe.name}»** انتخاب شد.\n\nحالا می‌توانید مواد لازم را آماده کنید یا سوالاتتان را بپرسید.`, true);
    } catch {
        addMessage("bot", "خطا در انتخاب دستور. لطفاً دوباره تلاش کنید.", true);
    }

    setSending(false);
}

// ===== Helpers =====
function scrollToBottom() {
    setTimeout(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    }, 50);
}

function setSending(busy) {
    sendBtn.disabled = busy;
    messageInput.disabled = busy;
}

function formatTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
}
