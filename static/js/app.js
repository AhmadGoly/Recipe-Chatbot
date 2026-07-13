const API = "";

let username = localStorage.getItem("chatbot_username") || "";
let selectedFile = null;
let recipeLocked = false;

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
const recipesContainer = document.getElementById("recipes-container");
const recipeBanner = document.getElementById("recipe-banner");
const resetBtn = document.getElementById("reset-btn");
const sendBtn = document.getElementById("send-btn");

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

    chatArea.innerHTML = `
        <div class="welcome-message">
            <p>سلام! عکس مواد غذایی خود را بفرستید یا بنویسید چه چیزی در دسترس دارید تا بهترین دستورهای غذایی را پیشنهاد دهم.</p>
        </div>`;
    recipesContainer.innerHTML = "";
    recipesContainer.classList.add("hidden");
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
        addMessage("user", text);
    }
    if (selectedFile) {
        addUserImageMessage(selectedFile);
    }

    messageInput.value = "";
    hideRecipes();

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
            addMessage("bot", data.response);
        }

        // Ingredients
        if (data.ingredients && data.ingredients.length > 0) {
            addIngredientsPills(data.ingredients);
        }

        // Recipe cards (only when no recipe is locked)
        if (!recipeLocked && data.recipes && data.recipes.length > 0) {
            showRecipes(data.recipes);
        }
    } catch (err) {
        typing.remove();
        addMessage("bot", "خطایی رخ داد. لطفاً دوباره تلاش کنید.");
    }

    setSending(false);
    scrollToBottom();
}

// ===== DOM Builders =====
function addMessage(role, text) {
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
}

function addUserImageMessage(file) {
    const div = document.createElement("div");
    div.className = "message user";

    const img = document.createElement("img");
    img.className = "message-image";
    img.src = URL.createObjectURL(file);
    img.alt = "تصویر ارسالی";

    div.appendChild(img);
    chatArea.appendChild(div);
    scrollToBottom();
}

function addIngredientsPills(ingredients) {
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

function showRecipes(recipes) {
    recipesContainer.innerHTML = "";
    recipesContainer.classList.remove("hidden");

    const title = document.createElement("h3");
    title.textContent = "دستورهای پیشنهادی";
    recipesContainer.appendChild(title);

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

    recipesContainer.appendChild(grid);
    scrollToBottom();
}

function hideRecipes() {
    recipesContainer.innerHTML = "";
    recipesContainer.classList.add("hidden");
}

function showSelectedRecipeBanner(recipe) {
    recipeBanner.innerHTML = "";
    recipeBanner.classList.remove("hidden");

    const available = (recipe.available_ingredients || []).length;
    const missing = (recipe.missing_ingredients || []).length;

    recipeBanner.innerHTML = `
        <span class="banner-icon">&#127860;</span>
        <div class="banner-info">
            <span class="banner-name">${recipe.name}</span>
            <span class="banner-details">${available} مواد موجود${missing > 0 ? ` · ${missing} مواد مورد نیاز` : " · همه مواد آماده است"}</span>
        </div>
    `;
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
        showSelectedRecipeBanner(data.recipe);
    } catch {
        addMessage("bot", "خطا در انتخاب دستور. لطفاً دوباره تلاش کنید.");
    }

    setSending(false);
}

// ===== Helpers =====
function scrollToBottom() {
    requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    });
}

function setSending(busy) {
    sendBtn.disabled = busy;
    messageInput.disabled = busy;
}

function formatTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
}
