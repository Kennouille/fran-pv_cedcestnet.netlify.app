// Import de Supabase et initialisation du client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Palette de couleurs Outlook-like
const COLOR_PALETTE = [
    '#D83B01', '#E3008C', '#0078D7', '#00BCF2', '#00B294',
    '#5D2A9C', '#B4009E', '#E74856', '#F7630C', '#FFB900',
    '#7A7574', '#68768A', '#8E8CD8', '#8764B8', '#881798',
    '#107C10', '#498205', '#767676', '#FF8C00', '#E81123',
    '#2D7D9A', '#6B69D6', '#008272', '#515C6B', '#567C73'
];

const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZ2dneWJheWpvb3FremJodnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MTU3NDgsImV4cCI6MjA0MjE5MTc0OH0.lnOqnq1AwN41g4xJ5O9oNIPBQqXYJkSrRhJ3osXtcsk';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Début des fonctions et variables de traduction directement dans configuration.js ---

// Variable globale pour stocker la langue actuelle, récupérée du stockage local ou 'fr' par défaut.
// CHANGEMENT CLÉ ICI : Utilisation de 'lang' au lieu de 'selectedLang'
let currentLang = localStorage.getItem('lang') || 'fr';

// Variable globale pour stocker toutes les traductions chargées.
let loadedTranslations = {};

// Fonction pour charger les traductions depuis les fichiers JSON.
async function loadTranslations(lang) {
    try {
        const response = await fetch(`./lang/${lang}.json`); // Chemin vers vos fichiers JSON de traduction
        if (!response.ok) {
            throw new Error(`Échec du chargement des traductions pour ${lang}: ${response.statusText}`);
        }
        loadedTranslations[lang] = await response.json();
        console.log(`configuration.js: Traductions chargées pour ${lang}`);
    } catch (error) {
        console.error("configuration.js: Erreur lors du chargement des traductions:", error);
    }
}

// Fonction pour récupérer une traduction par sa clé.
function getTranslation(key) {
    // Vérifie si les traductions pour la langue actuelle sont chargées et si la clé existe.
    if (loadedTranslations[currentLang] && loadedTranslations[currentLang][key]) {
        return loadedTranslations[currentLang][key];
    }
    // Affiche un avertissement si la traduction est manquante et retourne la clé par défaut.
    console.warn(`configuration.js: Traduction manquante pour la clé: "${key}" en langue: "${currentLang}"`);
    return key;
}

// Fonction pour appliquer les traductions aux éléments HTML marqués avec 'data-translate'.
function applyTranslations() {
    // Traduit le titre de la page si l'attribut data-translate est présent.
    const pageTitleElement = document.querySelector('title');
    if (pageTitleElement && pageTitleElement.dataset.translate) {
        pageTitleElement.textContent = getTranslation(pageTitleElement.dataset.translate);
    }

    // Parcourt tous les éléments avec l'attribut 'data-translate' et applique la traduction.
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.dataset.translate;
        // Gère spécifiquement les checkboxes pour traduire le span suivant si nécessaire.
        if (element.tagName === 'INPUT' && element.type === 'checkbox' && element.nextElementSibling && element.nextElementSibling.dataset.translate === key) {
            element.nextElementSibling.textContent = getTranslation(key);
        } else {
            element.textContent = getTranslation(key);
        }
    });

    // Traduit les placeholders des inputs marqués avec 'data-translate-placeholder'.
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.dataset.translatePlaceholder;
        element.placeholder = getTranslation(key);
    });
}

// --- Fin des fonctions et variables de traduction directement dans configuration.js ---


let currentRole = localStorage.getItem('currentPersonName');

const METEO_CITY_SUPABASE_ID = 8;
const WEATHERAPI_KEY = 'd8f9db65a75b4889b37165901251407';

document.addEventListener('DOMContentLoaded', async () => {
    // Relisons currentLang juste avant de charger les traductions,
    // pour s'assurer d'avoir la valeur la plus fraîche possible de localStorage.
    // CHANGEMENT CLÉ ICI : Utilisation de 'lang' au lieu de 'selectedLang'
    currentLang = localStorage.getItem('lang') || 'fr';

    await loadTranslations(currentLang);
    applyTranslations();

    injectCitySuggestionsStyles();
    injectLayoutStyles();


    if (currentRole) showWelcomeMessage(currentRole);
    await loadUserAccess();

    const prefixInput = document.getElementById('countryPrefixInput');
    const saveButton = document.getElementById('savePrefixButton');

    async function loadCountryPrefix() {
        try {
            const { data, error } = await supabase
                .from('information1_fran')
                .select('content')
                .eq('id', 2)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(getTranslation('log_no_prefix_found'));
                    await createDefaultCountryPrefix();
                } else {
                    console.error(getTranslation('error_loading_prefix'), error);
                }
            } else if (data) {
                prefixInput.value = data.content;
            }
        } catch (err) {
            console.error(getTranslation('error_unexpected_loading_prefix'), err);
        }
    }

    async function createDefaultCountryPrefix() {
        const defaultPrefix = '+52';

        const { error } = await supabase
            .from('information1_fran')
            .insert([
                { id: 2, content: defaultPrefix, date_modified: new Date().toISOString() }
            ]);

        if (error) {
            console.error(getTranslation('error_creating_default_prefix'), error);
        } else {
            console.log(getTranslation('log_default_prefix_created'));
            prefixInput.value = defaultPrefix;
        }
    }

    saveButton.addEventListener('click', async () => {
        const newPrefix = prefixInput.value.trim();
        if (newPrefix) {
            const { error } = await supabase
                .from('information1_fran')
                .update({ content: newPrefix, date_modified: new Date().toISOString() })
                .eq('id', 2);

            if (error) {
                console.error(getTranslation('error_saving_prefix'), error);
            } else {
                showTemporaryMessage('prefix_saved_success');
            }
        } else {
            showTemporaryMessage('enter_prefix_message');
        }
    });

    await loadCountryPrefix();

    const meteoCityInput = document.getElementById('meteoCityInput');
    const saveMeteoCityButton = document.getElementById('saveMeteoCityButton');

    if (meteoCityInput && saveMeteoCityButton) {
        await loadMeteoCityFromSupabase();

        const citySuggestionsList = document.getElementById('citySuggestions');
        if (citySuggestionsList) {
            let searchTimeout;
            meteoCityInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                const query = meteoCityInput.value.trim();
                if (query.length >= 3) {
                    searchTimeout = setTimeout(async () => {
                        const suggestions = await searchCities(query);
                        displayCitySuggestions(suggestions, meteoCityInput, citySuggestionsList);
                    }, 500);
                } else {
                    citySuggestionsList.innerHTML = '';
                    citySuggestionsList.style.display = 'none';
                }
            });

            document.addEventListener('click', (event) => {
                if (!meteoCityInput.contains(event.target) && !citySuggestionsList.contains(event.target)) {
                    citySuggestionsList.style.display = 'none';
                }
            });
        }

        saveMeteoCityButton.addEventListener('click', async () => {
            const newCity = meteoCityInput.value.trim();
            if (newCity) {
                await saveMeteoCityToSupabase(newCity);
            } else {
                showTemporaryMessage("enter_valid_city_message");
            }
        });
    }

    document.getElementById('enregistrerCoordonneesButton').addEventListener('click', async () => {
        await saveBankInformation();
        showTemporaryMessage('bank_info_saved_success');
    });

    await loadBankInformation();
});

function showWelcomeMessage(role) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `${getTranslation('welcome_message')} ${role}`;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '80px';
    messageDiv.style.right = '10px';
    messageDiv.style.padding = '10px';
    messageDiv.style.backgroundColor = '#00AAA3';
    messageDiv.style.color = 'white';
    messageDiv.style.borderRadius = '5px';
    document.body.appendChild(messageDiv);
}

async function loadUserAccess() {
    const tableBody = document.querySelector('#userTable tbody');
    if (!tableBody) return;

    // Vérifier si l’utilisateur courant a le droit de config
    const hasConfigPermission = localStorage.getItem('currentPersonIsConfigUser') === 'true';
    const currentRole = localStorage.getItem('currentPersonName');

    if (!hasConfigPermission) {
        alert("Accès interdit : vous n’avez pas la permission de configuration.");
        window.location.href = "index.html";
        return;
    }

    try {
        const { data, error } = await supabase.from('access_code1_fran').select('*');
        if (error) {
            console.error("Erreur chargement utilisateurs:", error);
            return;
        }

        // Trier les utilisateurs : Admin d'abord, puis Chef, puis les autres par ordre d'ajout
        const sortedData = sortUsers(data);
        sortedData.forEach(user => renderUserRow(user, currentRole));
    } catch (err) {
        console.error("Erreur imprévue:", err);
    }
}

// Nouvelle fonction pour trier les utilisateurs
function sortUsers(users) {
    return users.sort((a, b) => {
        // Admin toujours en premier
        if (a.Nom === "Admin") return -1;
        if (b.Nom === "Admin") return 1;

        // Chef en deuxième
        if (a.Nom === "Chef") return -1;
        if (b.Nom === "Chef") return 1;

        // Les autres utilisateurs conservent leur ordre d'ajout (par id_code croissant)
        return a.id_code - b.id_code;
    });
}

function renderUserRow(user, currentRole) {
    const tableBody = document.querySelector('#userTable tbody');
    const row = document.createElement('tr');

    // Nom
    const nameCell = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = user.Nom || '';
    nameCell.appendChild(nameInput);
    row.appendChild(nameCell);

    // Code
    const codeCell = document.createElement('td');
    const codeInput = document.createElement('input');

    if (user.Nom === "Admin" && currentRole !== "Admin") {
        // Si je suis Chef/Jefe/Boss → masquer le code admin
        codeInput.type = 'password';
        codeInput.value = "********";
        codeInput.disabled = true;
    } else {
        codeInput.type = 'text';
        codeInput.value = user.Code || '';
    }
    codeCell.appendChild(codeInput);
    row.appendChild(codeCell);


    // Checkboxes accès (ajout Historique)
    ['Calendrier', 'Statistiques', 'Quotidien', 'Configuration', 'Historique'].forEach(page => {
        const cell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = user[page] || false;

        // Si je ne suis pas Admin → je ne peux pas modifier la ligne Admin
        if (user.Nom === "Admin" && currentRole !== "Admin") {
            checkbox.disabled = true;
        }
        cell.appendChild(checkbox);
        row.appendChild(cell);
    });

    // Colonne Couleur (après Historique)
    const colorCell = document.createElement('td');
    const colorSelector = document.createElement('div');
    colorSelector.className = 'color-selector';

    // Créer un conteneur pour la couleur actuelle et le bouton palette
    const currentColorDisplay = document.createElement('div');
    currentColorDisplay.className = 'current-color';
    currentColorDisplay.style.width = '24px';
    currentColorDisplay.style.height = '24px';
    currentColorDisplay.style.borderRadius = '50%';
    currentColorDisplay.style.backgroundColor = user.color || COLOR_PALETTE[0];
    currentColorDisplay.style.display = 'inline-block';
    currentColorDisplay.style.marginRight = '5px';
    currentColorDisplay.style.border = '2px solid #ccc';
    currentColorDisplay.style.cursor = 'pointer';
    currentColorDisplay.title = getTranslation('click_to_change_color');

    // Input caché pour stocker la valeur
    const colorInput = document.createElement('input');
    colorInput.type = 'hidden';
    colorInput.value = user.color || COLOR_PALETTE[0];
    colorInput.className = 'color-value';

    // Conteneur pour la palette (cachée par défaut)
    const paletteContainer = document.createElement('div');
    paletteContainer.className = 'color-palette';
    paletteContainer.style.display = 'none';
    paletteContainer.style.position = 'absolute';
    paletteContainer.style.backgroundColor = 'white';
    paletteContainer.style.border = '1px solid #ccc';
    paletteContainer.style.padding = '10px';
    paletteContainer.style.borderRadius = '5px';
    paletteContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    paletteContainer.style.zIndex = '1000';

    // Créer les cercles de couleur
    COLOR_PALETTE.forEach(color => {
        const colorCircle = document.createElement('div');
        colorCircle.style.width = '20px';
        colorCircle.style.height = '20px';
        colorCircle.style.borderRadius = '50%';
        colorCircle.style.backgroundColor = color;
        colorCircle.style.display = 'inline-block';
        colorCircle.style.margin = '3px';
        colorCircle.style.cursor = 'pointer';
        colorCircle.style.border = color === (user.color || COLOR_PALETTE[0]) ? '2px solid #000' : '1px solid #ddd';
        colorCircle.title = color;

        colorCircle.addEventListener('click', () => {
            currentColorDisplay.style.backgroundColor = color;
            colorInput.value = color;
            paletteContainer.style.display = 'none';

            // Mettre à jour la bordure sur le cercle sélectionné
            paletteContainer.querySelectorAll('div').forEach(circle => {
                circle.style.border = '1px solid #ddd';
            });
            colorCircle.style.border = '2px solid #000';
        });

        paletteContainer.appendChild(colorCircle);
    });

    // Gestion du clic sur l'affichage de la couleur actuelle
    currentColorDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        paletteContainer.style.display = paletteContainer.style.display === 'none' ? 'block' : 'none';
    });

    // Cacher la palette quand on clique ailleurs
    document.addEventListener('click', () => {
        paletteContainer.style.display = 'none';
    });

    // Si je ne suis pas Admin → je ne peux pas modifier la ligne Admin
    if (user.Nom === "Admin" && currentRole !== "Admin") {
        currentColorDisplay.style.pointerEvents = 'none';
        currentColorDisplay.style.opacity = '0.6';
    }

    colorSelector.appendChild(currentColorDisplay);
    colorSelector.appendChild(colorInput);
    colorSelector.appendChild(paletteContainer);
    colorCell.appendChild(colorSelector);
    row.appendChild(colorCell);

    // --- Colonnes Geodynamics ---
    const geoIdCell = document.createElement('td');
    const geoIdInput = document.createElement('input');
    geoIdInput.type = 'text';
    geoIdInput.value = user.geodynamics_id || '';
    geoIdInput.placeholder = 'ID GeoDynamics';
    geoIdInput.style.width = '150px';
    geoIdCell.appendChild(geoIdInput);
    row.appendChild(geoIdCell);

    const geoSyncCell = document.createElement('td');
    const geoSyncCheckbox = document.createElement('input');
    geoSyncCheckbox.type = 'checkbox';
    geoSyncCheckbox.checked = user.geodynamics_sync || false;
    geoSyncCell.appendChild(geoSyncCheckbox);
    row.appendChild(geoSyncCell);


    // Colonne Actions
    const actionCell = document.createElement('td');
    if (localStorage.getItem('currentPersonIsConfigUser') === 'true') {
        if (user.Nom === "Admin" && currentRole !== "Admin") {
            // Pas de boutons Update/Delete pour Admin
            actionCell.textContent = getTranslation("protected_account");
        } else {
            const updateButton = document.createElement('button');
            updateButton.textContent = getTranslation('update_button');
            updateButton.addEventListener('click', async () => {
                await updateUser(user.id_code, nameInput.value, codeInput.value, row);
            });
            actionCell.appendChild(updateButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = getTranslation('delete_button');
            deleteButton.addEventListener('click', async () => {
                await deleteUser(user.id_code, row);
            });
            actionCell.appendChild(deleteButton);
        }
    }
    row.appendChild(actionCell);

    tableBody.appendChild(row);
}

function reorderTable() {
    const tableBody = document.querySelector('#userTable tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    const sortedRows = rows.sort((a, b) => {
        const nameA = a.children[0].querySelector('input').value;
        const nameB = b.children[0].querySelector('input').value;

        // Admin toujours en premier
        if (nameA === "Admin") return -1;
        if (nameB === "Admin") return 1;

        // Chef en deuxième
        if (nameA === "Chef") return -1;
        if (nameB === "Chef") return 1;

        // Conserver l'ordre existant pour les autres
        return 0;
    });

    // Vider et réinsérer les lignes dans l'ordre
    tableBody.innerHTML = '';
    sortedRows.forEach(row => tableBody.appendChild(row));
}



async function updateUser(id_code, name, code, row) {
    const accessData = {
        Nom: name,
        Code: code,
        Calendrier: row.children[2].querySelector('input').checked,
        Statistiques: row.children[3].querySelector('input').checked,
        Quotidien: row.children[4].querySelector('input').checked,
        Configuration: row.children[5].querySelector('input').checked,
        Historique: row.children[6].querySelector('input').checked,
        color: row.querySelector('.color-value').value, // CHANGÉ : récupérer depuis l'input hidden
        geodynamics_id: row.children[8].querySelector('input').value.trim() || null,
        geodynamics_sync: row.children[9].querySelector('input').checked
    };

    const { error } = await supabase.from('access_code1_fran').update(accessData).eq('id_code', id_code);
    if (error) {
        console.error(getTranslation('error_updating_user'), error);
        showTemporaryMessage('error_updating_user_short');
    } else {
        showTemporaryMessage('user_updated_success');
        reorderTable();
    }
}

async function deleteUser(id_code, row) {
    const { error } = await supabase.from('access_code1_fran').delete().eq('id_code', id_code);
    if (error) {
        console.error(getTranslation('error_deleting_user'), error);
        showTemporaryMessage('error_deleting_user_short');
        return;
    }
    showTemporaryMessage('user_deleted_success');
    row.remove();
}

function showTemporaryMessage(messageKey) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = getTranslation(messageKey);
    messageDiv.style.position = 'fixed';
    messageDiv.style.bottom = '10px';
    messageDiv.style.right = '10px';
    messageDiv.style.padding = '10px';
    messageDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    messageDiv.style.color = 'white';
    messageDiv.style.borderRadius = '5px';
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

window.addUser = addUser;

async function addUser() {
    const nameField = document.getElementById("newUserName");
    const codeField = document.getElementById("newUserCode");
    const colorField = document.getElementById("newUserColor"); // NOUVEAU CHAMP
    const calendrierField = document.getElementById("newUserCalendrier");
    const statistiquesField = document.getElementById("newUserStatistiques");
    const quotidienField = document.getElementById("newUserQuotidien");
    const configurationField = document.getElementById("newUserConfiguration");
    const historiqueField = document.getElementById("newUserHistorique");

    if (!nameField || !codeField || nameField.value.trim() === '' || codeField.value.trim() === '') {
        console.error(getTranslation('name_code_required_console'));
        showTemporaryMessage('name_code_required');
        return;
    }

    const userInput = {
        Nom: nameField.value.trim(),
        Code: codeField.value.trim(),
        color: colorField.value, // NOUVELLE LIGNE
        Calendrier: calendrierField.checked,
        Statistiques: statistiquesField.checked,
        Quotidien: quotidienField.checked,
        Configuration: configurationField.checked,
        Historique: historiqueField.checked,
        geodynamics_id: null,
        geodynamics_sync: false
    };

    try {
        const { data, error } = await supabase.from("access_code1_fran").insert([userInput]).select();
        if (error) {
            console.error(getTranslation('error_adding_user'), error);
            showTemporaryMessage('error_adding_user_short');
        } else {
            showTemporaryMessage('user_added_success');

            // Ajouter le nouvel utilisateur à la fin du tableau
            const tableBody = document.querySelector('#userTable tbody');
            const currentRole = localStorage.getItem('currentPersonName');
            if (data && data.length > 0) {
                renderUserRow(data[0], currentRole);
            }

            // Réinitialiser les champs du formulaire après l'ajout
            nameField.value = '';
            codeField.value = '';
            colorField.value = '#3498db'; // NOUVELLE LIGNE - réinitialiser à la valeur par défaut
            calendrierField.checked = false;
            statistiquesField.checked = false;
            quotidienField.checked = false;
            configurationField.checked = false;
            historiqueField.checked = false;
        }
    } catch (error) {
        console.error(getTranslation('error_adding_user_generic'), error);
        showTemporaryMessage('error_adding_user_short');
    }
}


// --- Fonctions de gestion de la ville météo ---
async function searchCities(query) {
    try {
        const response = await fetch(`https://api.weatherapi.com/v1/search.json?key=${WEATHERAPI_KEY}&q=${query}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(getTranslation('error_searching_cities'), error);
        return [];
    }
}

function injectCitySuggestionsStyles() {
    const style = document.createElement('style');
    style.textContent = '#citySuggestions li:hover { background-color: #e0e0e0; cursor: pointer; }';
    document.head.appendChild(style);
}

function injectLayoutStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #sectionsContainer { display: flex; gap: 40px; }
        #gestionCoordonneesBancaires { border-right: 1px solid #ccc; padding-right: 40px; }

        /* Styles pour la palette de couleurs */
        .color-selector {
            position: relative;
            display: inline-block;
        }

        .color-palette {
            display: none;
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            width: 180px;
            margin-top: 5px;
        }

        .current-color {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: inline-block;
            cursor: pointer;
            border: 2px solid #ccc;
        }

        .color-palette div {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: inline-block;
            margin: 3px;
            cursor: pointer;
            border: 1px solid #ddd;
            transition: transform 0.2s;
        }

        .color-palette div:hover {
            transform: scale(1.1);
            border: 2px solid #000;
        }

        .color-value {
            display: none;
        }

        /* Styles pour le formulaire d'ajout */
        #newUserColorSelector {
            display: inline-block;
            position: relative;
            vertical-align: middle;
        }

        #newUserCurrentColor {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #0078D7;
            display: inline-block;
            vertical-align: middle;
            border: 2px solid #ccc;
            cursor: pointer;
        }

        #newUserPalette {
            display: none;
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            width: 180px;
            margin-top: 5px;
        }
    `;
    document.head.appendChild(style);
}

function displayCitySuggestions(suggestions, inputElement, suggestionsListElement) {
    suggestionsListElement.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        suggestions.forEach(city => {
            const li = document.createElement('li');
            li.textContent = `${city.name}, ${city.region ? city.region + ',' : ''} ${city.country}`;
            li.addEventListener('click', () => {
                inputElement.value = li.textContent;
                suggestionsListElement.innerHTML = '';
                suggestionsListElement.style.display = 'none';
            });
            suggestionsListElement.appendChild(li);
        });
        suggestionsListElement.style.display = 'block';
    } else {
        suggestionsListElement.style.display = 'none';
    }
}

async function loadMeteoCityFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('information1_fran')
            .select('content')
            .eq('id', METEO_CITY_SUPABASE_ID)
            .single();

        if (error && error.code === 'PGRST116') {
            // Aucun enregistrement trouvé, créer une valeur par défaut
            await saveMeteoCityToSupabase('Mexico'); // Définir une valeur par défaut
            meteoCityInput.value = 'Mexico';
            console.log(getTranslation('log_meteo_city_default_set'));
        } else if (error) {
            console.error(getTranslation('error_loading_meteo_city'), error);
        } else if (data) {
            meteoCityInput.value = data.content;
            console.log(getTranslation('log_meteo_city_loaded') + ' (config): ' + data.content);
        }
    } catch (error) {
        console.error(getTranslation('error_loading_meteo_city_generic'), error);
    }
}

async function saveMeteoCityToSupabase(city) {
    try {
        const { data, error } = await supabase
            .from('information1_fran')
            .upsert(
                { id: METEO_CITY_SUPABASE_ID, content: city, date_modified: new Date().toISOString() },
                { onConflict: 'id' }
            );

        if (error) {
            console.error(getTranslation('error_saving_meteo_city'), error);
            showTemporaryMessage('error_saving_meteo_city_short');
        } else {
            showTemporaryMessage('meteo_city_saved_success');
            console.log(getTranslation('log_meteo_city_saved') + ': ' + city);
        }
    } catch (error) {
        console.error(getTranslation('error_saving_meteo_city_generic'), error);
        showTemporaryMessage('error_saving_meteo_city_short');
    }
}


// --- Fonctions de gestion des coordonnées bancaires ---
async function loadBankInformation() {
    const ids = [3, 4, 5, 6, 7];
    const inputs = ["sucursalInput", "accountInput", "bankInput", "ibanInput", "recipientNameInput"];

    for (let i = 0; i < ids.length; i++) {
        try {
            const { data, error } = await supabase
                .from('information1_fran')
                .select('content')
                .eq('id', ids[i])
                .single();

            if (error) {
                console.error(getTranslation('error_loading_bank_info') + ` avec l'ID ${ids[i]} :`, error);
            } else if (data && data.content) {
                const inputElement = document.getElementById(inputs[i]);
                if (inputElement) {
                    inputElement.value = data.content;
                }
            }
        } catch (err) {
            console.error(getTranslation('error_loading_bank_info_generic') + ` pour l'ID ${ids[i]} :`, err);
        }
    }
    console.log(getTranslation('log_bank_info_loaded'));
}

async function saveBankInformation() {
    const bankData = {
        3: document.getElementById("sucursalInput").value,
        4: document.getElementById("accountInput").value,
        5: document.getElementById("bankInput").value,
        6: document.getElementById("ibanInput").value,
        7: document.getElementById("recipientNameInput").value
    };

    for (const id in bankData) {
        try {
            const { error } = await supabase
                .from('information1_fran')
                .upsert(
                    { id: parseInt(id), content: bankData[id], date_modified: new Date().toISOString() },
                    { onConflict: ['id'] }
                );

            if (error) {
                console.error(getTranslation('error_saving_bank_info') + ` avec l'ID ${id} :`, error);
                showTemporaryMessage('error_saving_bank_info_short');
            } else {
                console.log(getTranslation('log_bank_info_saved') + ` avec l'ID ${id}.`);
            }
        } catch (err) {
            console.error(getTranslation('error_saving_bank_info_generic') + ` pour l'ID ${id} :`, err);
            showTemporaryMessage('error_saving_bank_info_short');
        }
    }
    showTemporaryMessage('bank_info_saved_success');
}
