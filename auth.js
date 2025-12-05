// Import de la bibliothèque Supabase
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialiser Supabase directement
const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZ2dneWJheWpvb3FremJodnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MTU3NDgsImV4cCI6MjA0MjE5MTc0OH0.lnOqnq1AwN41g4xJ5O9oNIPBQqXYJkSrRhJ3osXtcsk';
const supabase = createClient(supabaseUrl, supabaseKey);

let currentPerson = null;
let attempts = 0;
const maxAttempts = 3;
const blockDuration = 10 * 60 * 1000; // 10 minutes
let isBlocked = false;
let targetPage = '';

function showCodePrompt(page) {
    clearMessage();
    document.getElementById('code').value = ''; // Efface le champ de saisie
    document.getElementById('popup').style.display = 'block';
    document.getElementById('code').focus();
    targetPage = page;
}

async function checkCode() {
    if (isBlocked) {
        showMessage("Accès bloqué. Essaye plus tard.");
        return;
    }

    const codeInput = document.getElementById('code');
    const code = codeInput.value.trim();
    codeInput.value = ""; // Efface le champ de saisie après chaque tentative

    const person = await getPersonFromCode(code);
    if (person) {
        if (!hasPageAccess(person, targetPage)) {
            showMessage("Accès restreint. Vous n'avez pas accès à cette page.");
            return;
        }

        attempts = 0;
        currentPerson = person;

        console.log("🧩 Données complètes de la personne :", person);




        // Enregistrer le nom et l'identifiant unique de la personne connectée
        localStorage.setItem('currentPersonName', person.Nom);
        // 🆔 Enregistrer l'identifiant unique Supabase
        localStorage.setItem('currentPersonIdCode', person.id_code);
        console.log("✅ ID code enregistré :", person.id_code);

        localStorage.setItem(
          'currentPersonIsConfigUser',
          (person.Configuration === true || person.Configuration === 1 || person.Configuration === 'TRUE') ? 'true' : 'false'
        );


        // ✅ Marquer comme connecté
        localStorage.setItem("isAuthenticated", "true");

        // ✅ Enregistrer tous les droits
        localStorage.setItem("personRights", JSON.stringify({
          Calendrier: !!person.Calendrier,
          Statistiques: !!person.Statistiques,
          Quotidien: !!person.Quotidien,
          Configuration: !!person.Configuration,
          Historique: !!person.Historique
        }));

        console.log(`Utilisateur enregistré : ${person.Nom}`);

        handleCorrectCode();
        window.location.href = targetPage;

    } else {
        handleIncorrectCode();
    }
}

async function getPersonFromCode(code) {
    try {
        const { data, error } = await supabase
          .from('access_code1_fran')
          .select('id_code, Nom, Code, Calendrier, Statistiques, Quotidien, Configuration, Historique')
          .eq('Code', code)
          .single();

        console.log("🧩 Données complètes de la personne :", data);
        if (error) {
            console.error("Erreur lors de la récupération des codes depuis Supabase :", error);
            return null;
        }
        return data;
    } catch (err) {
        console.error("Erreur dans getPersonFromCode :", err);
        return null;
    }
}

function hasPageAccess(person, page) {
    if (person.Nom === "Admin" || person.Nom === "Chef") {
        return true;
    }

    switch (page) {
        case 'calendrier.html':
            return person.Calendrier;
        case 'statistiques.html':
            return person.Statistiques;
        case 'journalier.html':
            return person.Quotidien;
        case 'configuration.html':
            return person.Configuration;
        case 'historique.html':
            return person.Historique; // ✅ Nouveau champ attendu dans Supabase
        default:
            return false;
    }
}

function showMessage(message) {
    document.getElementById('message').innerText = message;
}

function clearMessage() {
    document.getElementById('message').innerText = '';
}

function handleCorrectCode() {
    document.getElementById('code').value = '';
    closePopup();
}

function handleIncorrectCode() {
    attempts++;
    if (attempts >= maxAttempts) {
        isBlocked = true;
        setTimeout(() => {
            isBlocked = false;
            attempts = 0;
        }, blockDuration);
        showMessage("Vous êtes bloqué pour 10 min.");
    } else {
        showMessage(`Code faux. Possibilités restantes : ${maxAttempts - attempts}`);
    }
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
    clearMessage();
}

// Ajouter une fonction pour récupérer le nom de la personne depuis le localStorage
function getCurrentPersonName() {
    return localStorage.getItem('currentPersonName');
}

window.showCodePrompt = showCodePrompt;
window.checkCode = checkCode;
window.closePopup = closePopup;

// Accès global à la fonction de récupération du nom pour les autres parties du code
window.getCurrentPersonName = getCurrentPersonName;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('code').addEventListener('keyup', (event) => {
        if (event.key === "Enter") {
            checkCode();
        }
    });
});
