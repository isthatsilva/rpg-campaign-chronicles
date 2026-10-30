/**
 * RPG Character Creator - Client Logic
 * Since we are building a static HTML website without a backend provided,
 * we will use localStorage to persist users and their characters.
 */

// State management
let currentUser = null;
let characters = []; // Array of objects: { id, userId, name, race, class, powers, bio }

// DOM Elements
const views = {
    login: document.getElementById('view-login'),
    dashboard: document.getElementById('view-dashboard'),
    form: document.getElementById('view-form')
};

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const createCharBtn = document.getElementById('create-char-btn');
const cancelBtn = document.getElementById('cancel-btn');
const charForm = document.getElementById('char-form');

const usernameInput = document.getElementById('username-input');
const displayUsername = document.getElementById('display-username');
const characterList = document.getElementById('character-list');
const emptyState = document.getElementById('empty-state');

const formTitle = document.getElementById('form-title');
const charIdInput = document.getElementById('char-id');
const charNameInput = document.getElementById('char-name');
const charRaceInput = document.getElementById('char-race');
const charClassInput = document.getElementById('char-class');
const charPowersInput = document.getElementById('char-powers');
const charBioInput = document.getElementById('char-bio');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    checkSession();
});

function loadData() {
    const storedChars = localStorage.getItem('rpg_characters');
    if (storedChars) {
        characters = JSON.parse(storedChars);
    }
}

function saveData() {
    localStorage.setItem('rpg_characters', JSON.stringify(characters));
}

function checkSession() {
    const sessionUser = localStorage.getItem('rpg_current_user');
    if (sessionUser) {
        currentUser = sessionUser;
        showDashboard();
    } else {
        showView('login');
    }
}

function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

// --- Auth Logic ---

loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Please enter a username to enter the realm!');
        return;
    }
    currentUser = username;
    localStorage.setItem('rpg_current_user', currentUser);
    showDashboard();
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('rpg_current_user');
    currentUser = null;
    showView('login');
    usernameInput.value = '';
});

function showDashboard() {
    displayUsername.textContent = currentUser;
    renderCharacters();
    showView('dashboard');
}

// --- Character Logic ---

function renderCharacters() {
    const userChars = characters.filter(c => c.userId === currentUser);
    characterList.innerHTML = '';

    if (userChars.length === 0) {
        emptyState.classList.remove('hidden');
        createCharBtn.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        createCharBtn.classList.remove('hidden');

        userChars.forEach(char => {
            const card = document.createElement('div');
            card.className = 'char-card';
            card.innerHTML = `
                <h4>${char.name}</h4>
                <p><strong>Race:</strong> ${char.race}</p>
                <p><strong>Class:</strong> ${char.class}</p>
                <div class="char-actions">
                    <button class="btn-edit" onclick="editCharacter('${char.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteCharacter('${char.id}')">Delete</button>
                </div>
            `;
            characterList.appendChild(card);
        });
    }
}

createCharBtn.addEventListener('click', () => {
    openForm();
});

function openForm(charId = null) {
    charForm.reset();
    charIdInput.value = '';

    if (charId) {
        const char = characters.find(c => c.id === charId);
        if (char) {
            formTitle.textContent = 'Edit Character';
            charIdInput.value = char.id;
            charNameInput.value = char.name;
            charRaceInput.value = char.race;
            charClassInput.value = char.class;
            charPowersInput.value = char.powers;
            charBioInput.value = char.bio;
        }
    } else {
        formTitle.textContent = 'Create Character';
    }

    showView('form');
}

cancelBtn.addEventListener('click', () => {
    showDashboard();
});

charForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const charId = charIdInput.value;
    const charData = {
        id: charId || Date.now().toString(),
        userId: currentUser,
        name: charNameInput.value,
        race: charRaceInput.value,
        class: charClassInput.value,
        powers: charPowersInput.value,
        bio: charBioInput.value
    };

    if (charId) {
        // Update
        const index = characters.findIndex(c => c.id === charId);
        characters[index] = charData;
    } else {
        // Create
        characters.push(charData);
    }

    saveData();
    showDashboard();
});

window.editCharacter = function(id) {
    openForm(id);
};

window.deleteCharacter = function(id) {
    if (confirm('Are you sure you want to delete this character? They will be banished to the void!')) {
        characters = characters.filter(c => c.id !== id);
        saveData();
        renderCharacters();
    }
};
