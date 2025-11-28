import { supabase } from './supabaseClient.js';

// Variables globales
let employees = [];
let eventsByPersonChartInstance = null;
let topClientsChartInstance = null;
let eventsByDayOfWeekChartInstance = null;

// Fonction pour vérifier si l'utilisateur est configurateur
function isConfigUser() {
    const urlParams = new URLSearchParams(window.location.search);
    const isConfig = urlParams.get('isConfig');
    return isConfig === 'true';
}

// Fonction pour récupérer le nom de l'utilisateur connecté
function getCurrentUserName() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('user') || '';
}

// Structure pour l'export
let exportableStats = {
    period: { startDate: '', endDate: '' },
    summaryMetrics: {
        totalAmount: 0, averagePricePerEvent: 0, averageEventsPerDay: 0,
        totalAmountChange: '', averagePricePerEventChange: '', averageEventsPerDayChange: ''
    },
    eventsByPerson: {},
    topClients: [],
    eventsByDayOfWeek: { labels: [], data: [] },
    rawData: []
};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOMContentLoaded - Début initialisation');

    // Initialiser les droits utilisateur en premier
    initializeUserPermissions();

    // Puis initialiser les stats employés
    initializeEmployeeStats();

    if (document.getElementById('startDate') && document.getElementById('endDate')) {
        console.log('📝 Initialisation dates seulement');
        setCurrentMonth(); // Remplit les dates
        clearGeneralResults(); // Masque résultats
        console.log('✅ Initialisation terminée - AUCUN calcul automatique');
    }
    console.log('🎯 DOMContentLoaded - Fin initialisation');
});

// Initialisation des statistiques employés
async function initializeEmployeeStats() {
    await loadEmployees();
    initializeYearSelect();

    // Si l'utilisateur n'est pas configurateur, pré-remplir avec son nom
    if (!isConfigUser()) {
        const currentUser = getCurrentUserName();
        const employeeSelect = document.getElementById('employeeSelect');

        if (currentUser && employeeSelect) {
            employeeSelect.value = currentUser;
            // Optionnel : désactiver la sélection
            employeeSelect.disabled = true;

            // Déclencher automatiquement le calcul
            setTimeout(() => {
                calculateEmployeeStats();
            }, 500); // Petit délai pour s'assurer que tout est chargé
        }
    }
}

// Fonction pour gérer l'affichage selon les droits utilisateur
function initializeUserPermissions() {
    const isConfig = isConfigUser();
    const currentUser = getCurrentUserName();

    console.log('👤 Utilisateur:', currentUser, 'isConfig:', isConfig);

    // Masquer les statistiques générales si pas configurateur
    const generalStatsSection = document.getElementById('generalStatsSection');
    const generalStatsResults = document.getElementById('generalStatsResults');
    if (generalStatsSection) {
        generalStatsSection.style.display = isConfig ? 'block' : 'none';
    }
    if (generalStatsResults) {
        generalStatsResults.style.display = isConfig ? 'block' : 'none';
    }

    // Ajuster le titre si nécessaire
    if (!isConfig && currentUser) {
        const employeeStatsTitle = document.querySelector('#employeeStatsSection h2');
        if (employeeStatsTitle) {
            employeeStatsTitle.textContent = `👤 Mes Statistiques - ${currentUser}`;
        }

        // Masquer aussi les boutons d'export général si nécessaire
        const generalExportButtons = document.querySelectorAll('button[onclick*="exportGeneralStatsToPdf"], button[onclick*="exportDataToCsv"]');
        generalExportButtons.forEach(button => {
            button.style.display = 'none';
        });
    }
}

// Charger la liste des employés
async function loadEmployees() {
    const { data, error } = await supabase
        .from('access_code1_fran')
        .select('Nom')
        .order('Nom');

    if (error) {
        console.error("Erreur de récupération des employés :", error);
        return;
    }

    employees = data;
    const employeeSelect = document.getElementById('employeeSelect');
    employeeSelect.innerHTML = '<option value="">Sélectionner un employé</option>';

    // Si l'utilisateur n'est pas configurateur, n'afficher que son nom
    if (!isConfigUser()) {
        const currentUser = getCurrentUserName();
        if (currentUser) {
            const option = document.createElement('option');
            option.value = currentUser;
            option.textContent = currentUser;
            option.selected = true;
            employeeSelect.appendChild(option);
        }
        // Optionnel : désactiver la sélection
        employeeSelect.disabled = true;
    } else {
        // Si configurateur, afficher tous les employés
        data.forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.Nom;
            option.textContent = employee.Nom;
            employeeSelect.appendChild(option);
        });
    }
}

// Initialiser le sélecteur d'année
function initializeYearSelect() {
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // Les mois vont de 0 à 11

    for (let year = currentYear - 5; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }

    // Sélectionner automatiquement le mois en cours
    if (monthSelect) {
        monthSelect.value = currentMonth.toString();
    }
}

// Calculer les statistiques employés
async function calculateEmployeeStats() {
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    const employee = document.getElementById('employeeSelect').value;

    if (!year || !month || !employee) {
        alert("Veuillez sélectionner une année, un mois et un employé");
        return;
    }

    await fetchEmployeeStats(year, month, employee);
}

// Récupérer les statistiques employés
async function fetchEmployeeStats(year, month, employee) {
    console.log('👤 fetchEmployeeStats appelé pour:', employee, month, year);
    // Calculer les dates de début et fin du mois (corrigé)
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const { data, error } = await supabase
        .from('event_quot1_fran')
        .select('Date, nombre_heures, Ajouté_pour')
        .gte('Date', startDate)
        .lte('Date', endDate)
        .eq('Ajouté_pour', employee);

    if (error) {
        console.error("Erreur de récupération des données employé :", error);
        return;
    }

    displayEmployeeStats(data, year, month, employee);
}

// Afficher les statistiques employés
function displayEmployeeStats(data, year, month, employee) {
    // Calculer les heures par jour
    const hoursByDay = calculateHoursByDay(data, year, month);

    // Calculer les heures par semaine (locale) - version corrigée
    const hoursByWeek = calculateHoursByWeekLocal(data, year, month);

    // Calculer le total du mois
    const monthlyTotal = calculateMonthlyTotal(data);

    displayDailyHours(hoursByDay, employee, year, month);

}

// Calculer les heures par jour (version simplifiée)
function calculateHoursByDay(data, year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const hoursByDay = {};

    // Initialiser uniquement les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        hoursByDay[dateStr] = 0;
    }

    // Ajouter les heures réelles
    data.forEach(event => {
        if (event.nombre_heures) {
            // Extraire directement les parties de la date sans conversion
            const [eventYear, eventMonth, eventDay] = event.Date.split('-');

            // Vérifier que la date est bien dans le mois sélectionné
            if (eventYear == year && eventMonth == month.padStart(2, '0')) {
                const dateStr = event.Date; // Utiliser directement la date de la base
                if (hoursByDay[dateStr] !== undefined) {
                    hoursByDay[dateStr] += event.nombre_heures;
                }
            }
        }
    });

    return hoursByDay;
}

// Calculer les heures par semaine (version corrigée)
function calculateHoursByWeekLocal(data, year, month) {
    const weeks = {};
    const monthInt = parseInt(month);
    const yearInt = parseInt(year);

    // Obtenir toutes les semaines du mois (même celles sans données)
    const allWeeks = getAllWeeksInMonth(yearInt, monthInt);

    // Initialiser toutes les semaines à 0
    allWeeks.forEach(week => {
        weeks[week.key] = 0;
    });

    // Ajouter les heures réelles
    data.forEach(event => {
        if (event.nombre_heures) {
            const eventDate = new Date(event.Date);
            const weekKey = getWeekKeyForDate(eventDate);
            if (weeks[weekKey] !== undefined) {
                weeks[weekKey] += event.nombre_heures;
            }
        }
    });

    return weeks;
}


// Obtenir toutes les semaines du mois (version corrigée)
function getAllWeeksInMonth(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month - 1, 1); // 1er du mois
    const lastDay = new Date(year, month, 0); // Dernier du mois

    let currentDate = new Date(firstDay);

    // Commencer au 1er du mois, pas besoin de reculer
    // Si le 1er n'est pas un lundi, on commence quand même au 1er
    const weekStart = new Date(currentDate);

    // Trouver le lundi de la semaine qui contient le 1er du mois
    while (weekStart.getDay() !== 1) { // 1 = lundi
        weekStart.setDate(weekStart.getDate() - 1);
    }

    currentDate = new Date(weekStart);

    // Avancer semaine par semaine jusqu'à dépasser le mois
    while (currentDate <= lastDay || currentDate.getMonth() === month - 1) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekKey = getWeekKey(weekStart, weekEnd);

        weeks.push({
            key: weekKey,
            start: new Date(weekStart),
            end: new Date(weekEnd)
        });

        currentDate.setDate(currentDate.getDate() + 7);
    }

    return weeks;
}

// Générer une clé de semaine - VERSION CORRIGÉE
function getWeekKey(start, end, month) {
    const startStr = formatDateLocal(start);
    const endStr = formatDateLocal(end);
    // CORRECTION : Utiliser la semaine ISO pour janvier
    const weekNumber = (month === 1) ? getISOWeekNumber(start) : getWeekNumberLocal(start);
    return `S${weekNumber} (${startStr} - ${endStr})`;
}

// Obtenir la clé de semaine pour une date - VERSION CORRIGÉE
function getWeekKeyForDate(date) {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    // CORRECTION : Passer le mois pour utiliser la bonne méthode de calcul
    const month = date.getMonth() + 1;
    return getWeekKey(weekStart, weekEnd, month);
}

// Obtenir le début de la semaine (lundi) pour une date
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour lundi
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
}

// Formater la date en local (JJ/MM)
function formatDateLocal(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
}

// Calculer le total mensuel
function calculateMonthlyTotal(data) {
    return data.reduce((total, event) => {
        return total + (event.nombre_heures || 0);
    }, 0);
}

// Afficher les heures par jour avec les totaux
function displayDailyHours(hoursByDay, employee, year, month) {
    let html = `<h4>Calcul des heures pour ${employee} :</h4>`;

    // Grouper les jours par semaine
    const weeks = groupDaysByWeek(hoursByDay, year, month);

    html += `<div class="weeks-with-totals">`;
    html += `<div class="weeks-header">`;
    html += `<div class="days-section">Jours</div>`;
    html += `<div class="total-section">Total heures par semaine</div>`;
    html += `</div>`;

    let monthlyTotal = 0;

    // Afficher chaque semaine en ligne
    weeks.forEach(week => {
        // Calculer le total de la semaine
        const weekTotal = week.days.reduce((total, day) => total + (day.hours || 0), 0);
        monthlyTotal += weekTotal;

        html += `<div class="week-row-with-total">`;

        // Section jours
        html += `<div class="days-section">`;
        html += `<div class="week-label">${week.weekLabel}</div>`;
        html += `<div class="week-days">`;

        // Afficher les 7 jours de la semaine
        week.days.forEach(day => {
            if (day.inMonth) {
                html += `
                    <div class="week-day">
                        <div class="day-name">${day.dayName}</div>
                        <div class="day-number">${day.dayNumber}</div>
                        <div class="day-hours">${day.hours.toFixed(1)}h</div>
                    </div>
                `;
            } else {
                html += `<div class="week-day empty"></div>`;
            }
        });

        html += `</div></div>`;

        // Section total hebdomadaire
        html += `<div class="total-section">`;
        html += `<div class="weekly-total">${weekTotal.toFixed(1)}h</div>`;
        html += `</div>`;

        html += `</div>`;
    });

    html += `</div>`;

    // Total mensuel
    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthName = monthNames[parseInt(month) - 1];

    html += `<div class="monthly-total">`;
    html += `<strong>Total mensuel pour ${employee} : ${monthName} ${year}</strong> : ${monthlyTotal.toFixed(1)} heures`;
    html += `</div>`;

    document.getElementById('employeeDailyHours').innerHTML = html;
}

// Grouper les jours par semaine avec les jours vides en début de mois - VERSION CORRIGÉE
function groupDaysByWeek(hoursByDay, year, month) {
    const weeks = {};
    const monthInt = parseInt(month);
    const yearInt = parseInt(year);

    // Obtenir le premier jour du mois
    const firstDay = new Date(yearInt, monthInt - 1, 1);
    const lastDay = new Date(yearInt, monthInt, 0);

    let weekStart = new Date(firstDay);

    // Pour tous les mois, trouver le lundi de la semaine
    while (weekStart.getDay() !== 1) { // 1 = lundi
        weekStart.setDate(weekStart.getDate() - 1);
    }

    let currentDate = new Date(weekStart);

    // Parcourir toutes les semaines du mois
    while (currentDate <= lastDay || currentDate.getMonth() === monthInt - 1) {
        const weekNumber = getWeekNumberLocal(currentDate, weekStart);
        const weekKey = `Semaine ${weekNumber}`;

        if (!weeks[weekKey]) {
            weeks[weekKey] = {
                weekLabel: weekKey,
                days: []
            };
        }

        // CORRECTION : Créer un tableau temporaire pour stocker les jours dans l'ordre chronologique
        const tempDays = [];

        // Récupérer les 7 jours de la semaine dans l'ordre chronologique
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(currentDate);
            currentDay.setDate(currentDate.getDate() + i);

            if (currentDay.getMonth() === monthInt - 1 && currentDay.getFullYear() === yearInt) {
                const dateStr = `${yearInt}-${monthInt.toString().padStart(2, '0')}-${currentDay.getDate().toString().padStart(2, '0')}`;
                const dayName = currentDay.toLocaleDateString('fr-FR', { weekday: 'short' });
                const hours = hoursByDay[dateStr] || 0;

                tempDays.push({
                    dateStr: dateStr,
                    dayName: dayName,
                    dayNumber: currentDay.getDate(),
                    formattedDate: currentDay.toLocaleDateString('fr-FR'),
                    hours: hours,
                    inMonth: true,
                    dayOfWeek: currentDay.getDay() // 0=dimanche, 1=lundi, etc.
                });
            } else {
                tempDays.push({
                    dateStr: '',
                    dayName: '',
                    dayNumber: '',
                    formattedDate: '',
                    hours: 0,
                    inMonth: false,
                    dayOfWeek: (currentDate.getDay() + i) % 7
                });
            }
        }

        // CORRECTION : Réorganiser pour que lundi soit toujours en première position
        // Trouver l'index du lundi dans le tableau temporaire
        let mondayIndex = -1;
        for (let i = 0; i < tempDays.length; i++) {
            if (tempDays[i].inMonth && tempDays[i].dayOfWeek === 1) {
                mondayIndex = i;
                break;
            }
        }

        if (mondayIndex !== -1) {
            // Réorganiser le tableau pour commencer par lundi
            weeks[weekKey].days = [
                ...tempDays.slice(mondayIndex), // De lundi à dimanche
                ...tempDays.slice(0, mondayIndex)  // De dimanche précédent à lundi
            ];
        } else {
            // Si pas de lundi trouvé, garder l'ordre original
            weeks[weekKey].days = tempDays;
        }

        // Passer à la semaine suivante
        currentDate.setDate(currentDate.getDate() + 7);
    }

    // Convertir en tableau et trier par semaine
    return Object.values(weeks).sort((a, b) => {
        const weekA = parseInt(a.weekLabel.replace('Semaine ', ''));
        const weekB = parseInt(b.weekLabel.replace('Semaine ', ''));
        return weekA - weekB;
    });
}

// Obtenir le numéro de semaine local
function getWeekNumberLocal(date, monthStart) {
    // date : objet Date du jour concerné
    // monthStart : premier lundi couvrant le mois (weekStart dans ton code)

    const diffDays = Math.floor((date - monthStart) / (24 * 60 * 60 * 1000));

    return Math.floor(diffDays / 7) + 1;
}


// Afficher le total mensuel
function displayMonthlyHours(total, employee, month, year) {
    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthName = monthNames[parseInt(month) - 1];

    const html = `
        <h4>Total mensuel pour ${employee} :</h4>
        <p><strong>${monthName} ${year}</strong> : ${total.toFixed(1)} heures</p>
    `;

    document.getElementById('employeeMonthlyHours').innerHTML = html;
}


// Fonctions pour les statistiques générales avancées
function getPreviousPeriodDates(startDateStr, endDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const diffMs = endDate.getTime() - startDate.getTime();
    const periodLengthDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(startDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevEndDate.getDate() - periodLengthDays);
    return {
        prevStartDate: prevStartDate.toISOString().slice(0, 10),
        prevEndDate: prevEndDate.toISOString().slice(0, 10)
    };
}

function formatPercentageChange(current, prev) {
    if (prev === 0) return current > 0 ? '+Inf%' : 'N/A';
    const change = ((current - prev) / prev) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
}

async function fetchGeneralStats(startDate, endDate) {
    console.log('🚨 fetchGeneralStats appelé avec:', startDate, '->', endDate);
    console.trace('Stack trace'); // Montre d'où vient l'appel

    clearGeneralResults();
    document.getElementById('loadingIndicator').textContent = 'Chargement des données...';
    document.getElementById('loadingIndicator').style.display = 'block';

    const { data, error } = await supabase
        .from('event_quot1_fran')
        .select('Nom, Prix, Ajouté_pour, Date')
        .gte('Date', startDate)
        .lte('Date', endDate);

    console.log('✅ Réponse Supabase reçue');
    console.log('📊 Données reçues:', data?.length, 'lignes');
    console.log('❌ Erreur:', error);


    document.getElementById('loadingIndicator').style.display = 'none';

    if (error) {
        console.error("Erreur de récupération :", error);
        document.getElementById('totalAmount').innerText = 'Erreur de chargement';
        document.getElementById('averagePricePerEvent').innerText = 'Erreur de chargement';
        document.getElementById('averageEventsPerDay').innerText = 'Erreur de chargement';
        updateComparisonDisplays(0, 0, 0, 0, 0, 0);
        return;
    }

    console.log('🔄 Début traitement données...');
    exportableStats.period.startDate = startDate;
    exportableStats.period.endDate = endDate;
    exportableStats.rawData = data;

    if (data.length === 0) {
        document.getElementById('totalAmount').innerHTML = `Montant total : <span class="value">Aucune donnée</span>`;
        document.getElementById('averagePricePerEvent').innerHTML = `Prix moyen par événement : <span class="value">Aucune donnée</span>`;
        document.getElementById('averageEventsPerDay').innerHTML = `Moyenne événements/jour : <span class="value">Aucune donnée</span>`;
        exportableStats.summaryMetrics = {
            totalAmount: 0, averagePricePerEvent: 0, averageEventsPerDay: 0,
            totalAmountChange: 'N/A', averagePricePerEventChange: 'N/A', averageEventsPerDayChange: 'N/A'
        };
        exportableStats.eventsByPerson = {};
        exportableStats.topClients = [];
        exportableStats.eventsByDayOfWeek = { labels: [], data: [] };
        updateComparisonDisplays(0, 0, 0, 0, 0, 0);
        return;
    }
    console.log('📈 Calcul des métriques...');

    const totalAmount = data.reduce((sum, row) => sum + row.Prix, 0);
    const averagePricePerEvent = data.length > 0 ? totalAmount / data.length : 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const averageEventsPerDay = numberOfDays > 0 ? data.length / numberOfDays : 0;

    const eventsByPerson = data.reduce((acc, row) => {
        acc[row.Ajouté_pour] = (acc[row.Ajouté_pour] || 0) + 1;
        return acc;
    }, {});

    const spendingByClient = data.reduce((acc, row) => {
        acc[row.Nom] = (acc[row.Nom] || 0) + row.Prix;
        return acc;
    }, {});
    const topClients = Object.entries(spendingByClient)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const eventsByDayOfWeek = new Array(7).fill(0);

    data.forEach(row => {
        const [year, month, day] = row.Date.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        let dayIndex = date.getDay();
        if (dayIndex === 0) {
            dayIndex = 6;
        } else {
            dayIndex--;
        }
        eventsByDayOfWeek[dayIndex]++;
    });

    const orderedDayNames = dayNames;
    const orderedEventsByDayOfWeek = eventsByDayOfWeek;

    const { prevStartDate, prevEndDate } = getPreviousPeriodDates(startDate, endDate);
    const { data: prevData, error: prevError } = await supabase
        .from('event_quot1_fran')
        .select('Prix')
        .gte('Date', prevStartDate)
        .lte('Date', prevEndDate);

    let prevTotalAmount = 0;
    let prevAveragePricePerEvent = 0;
    let prevAverageEventsPerDay = 0;

    if (!prevError && prevData.length > 0) {
        prevTotalAmount = prevData.reduce((sum, row) => sum + row.Prix, 0);
        prevAveragePricePerEvent = prevData.length > 0 ? prevTotalAmount / prevData.length : 0;
        const prevStart = new Date(prevStartDate);
        const prevEnd = new Date(prevEndDate);
        const prevDiffTime = Math.abs(prevEnd - prevStart);
        const prevNumberOfDays = Math.ceil(prevDiffTime / (1000 * 60 * 60 * 24)) + 1;
        prevAverageEventsPerDay = prevNumberOfDays > 0 ? prevData.length / prevNumberOfDays : 0;
    }

    exportableStats.summaryMetrics = {
        totalAmount: totalAmount,
        averagePricePerEvent: averagePricePerEvent,
        averageEventsPerDay: averageEventsPerDay,
        totalAmountChange: formatPercentageChange(totalAmount, prevTotalAmount),
        averagePricePerEventChange: formatPercentageChange(averagePricePerEvent, prevAveragePricePerEvent),
        averageEventsPerDayChange: formatPercentageChange(averageEventsPerDay, prevAverageEventsPerDay)
    };
    exportableStats.eventsByPerson = eventsByPerson;
    exportableStats.topClients = topClients;
    exportableStats.eventsByDayOfWeek = {
        labels: orderedDayNames,
        data: orderedEventsByDayOfWeek
    };

    console.log('🎨 Affichage des résultats...');
    displayGeneralResults(totalAmount, averagePricePerEvent, averageEventsPerDay, eventsByPerson, topClients, orderedDayNames, orderedEventsByDayOfWeek);
    updateComparisonDisplays(
        totalAmount, prevTotalAmount,
        averagePricePerEvent, prevAveragePricePerEvent,
        averageEventsPerDay, prevAverageEventsPerDay
    );

    console.log('✅ fetchGeneralStats terminé');
}

// Mise à jour des comparaisons
function updateComparisonDisplays(
    currentTotal, prevTotal,
    currentAvgPrice, prevAvgPrice,
    currentAvgEvents, prevAvgEvents
) {
    const formatChangeForDisplay = (current, prev) => {
        if (prev === 0) return current > 0 ? `<span style="color: green;">+Inf%</span>` : `N/A`;
        const change = ((current - prev) / prev) * 100;
        const color = change >= 0 ? 'green' : 'red';
        const sign = change >= 0 ? '+' : '';
        return `<span style="color: ${color};">${sign}${change.toFixed(2)}%</span> vs période précédente`;
    };

    document.getElementById('totalAmountComparison').innerHTML = formatChangeForDisplay(currentTotal, prevTotal);
    document.getElementById('averagePricePerEventComparison').innerHTML = formatChangeForDisplay(currentAvgPrice, prevAvgPrice);
    document.getElementById('averageEventsPerDayComparison').innerHTML = formatChangeForDisplay(currentAvgEvents, prevAvgEvents);
}

// Affichage des résultats avec graphiques
function displayGeneralResults(totalAmount, averagePricePerEvent, averageEventsPerDay, eventsByPerson, topClients, orderedDayNames, orderedEventsByDayOfWeek) {
    document.getElementById('totalAmount').innerHTML = `Montant total : <span class="value">${totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>`;
    document.getElementById('averagePricePerEvent').innerHTML = `Prix moyen par événement : <span class="value">${averagePricePerEvent.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>`;
    document.getElementById('averageEventsPerDay').innerHTML = `Moyenne événements/jour : <span class="value">${averageEventsPerDay.toFixed(2)}</span>`;

    // Afficher les graphiques
    const chartsContainer = document.querySelector('.charts-container');
    if (chartsContainer) {
        chartsContainer.classList.add('visible');
        chartsContainer.style.display = 'grid';
    }

    // Graphique événements par employé
    const eventsByPersonCtx = document.getElementById('eventsByPersonChart').getContext('2d');
    if (eventsByPersonChartInstance) {
        eventsByPersonChartInstance.destroy();
        eventsByPersonChartInstance = null;
    }

    // S'assurer que le canvas a la bonne taille
    const eventsByPersonCanvas = document.getElementById('eventsByPersonChart');
    eventsByPersonCanvas.style.height = '300px';
    eventsByPersonCanvas.style.width = '100%';

    eventsByPersonChartInstance = new Chart(eventsByPersonCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(eventsByPerson),
            datasets: [{
                label: 'Nombre d\'événements',
                data: Object.values(eventsByPerson),
                backgroundColor: 'rgba(0, 170, 163, 0.7)',
                borderColor: 'rgba(0, 170, 163, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Graphique top clients
    const topClientsCtx = document.getElementById('topClientsChart').getContext('2d');
    if (topClientsChartInstance) {
        topClientsChartInstance.destroy();
        topClientsChartInstance = null;
    }

    const topClientsCanvas = document.getElementById('topClientsChart');
    topClientsCanvas.style.height = '300px';
    topClientsCanvas.style.width = '100%';

    topClientsChartInstance = new Chart(topClientsCtx, {
        type: 'bar',
        data: {
            labels: topClients.map(client => client[0]),
            datasets: [{
                label: 'Montant dépensé',
                data: topClients.map(client => client[1]),
                backgroundColor: [
                    'rgba(30, 115, 190, 0.7)', 'rgba(0, 170, 163, 0.7)', 'rgba(87, 87, 96, 0.7)',
                    'rgba(255, 99, 132, 0.7)', 'rgba(255, 159, 64, 0.7)', 'rgba(255, 205, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(201, 203, 207, 0.7)'
                ],
                borderColor: [
                    'rgba(30, 115, 190, 1)', 'rgba(0, 170, 163, 1)', 'rgba(87, 87, 96, 1)',
                    'rgba(255, 99, 132, 1)', 'rgba(255, 159, 64, 1)', 'rgba(255, 205, 86, 1)',
                    'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(201, 203, 207, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
                        }
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Graphique événements par jour de la semaine
    const eventsByDayOfWeekCtx = document.getElementById('eventsByDayOfWeekChart').getContext('2d');
    if (eventsByDayOfWeekChartInstance) {
        eventsByDayOfWeekChartInstance.destroy();
        eventsByDayOfWeekChartInstance = null;
    }

    const eventsByDayOfWeekCanvas = document.getElementById('eventsByDayOfWeekChart');
    eventsByDayOfWeekCanvas.style.height = '300px';
    eventsByDayOfWeekCanvas.style.width = '100%';

    eventsByDayOfWeekChartInstance = new Chart(eventsByDayOfWeekCtx, {
        type: 'bar',
        data: {
            labels: orderedDayNames,
            datasets: [{
                label: 'Nombre d\'événements',
                data: orderedEventsByDayOfWeek,
                backgroundColor: 'rgba(30, 115, 190, 0.7)',
                borderColor: 'rgba(30, 115, 190, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Nettoyage des résultats généraux
function clearGeneralResults() {
    document.getElementById('totalAmount').innerHTML = `Montant total : <span class="value">--</span>`;
    document.getElementById('averagePricePerEvent').innerHTML = `Prix moyen par événement : <span class="value">--</span>`;
    document.getElementById('averageEventsPerDay').innerHTML = `Moyenne événements/jour : <span class="value">--</span>`;
    document.getElementById('totalAmountComparison').innerText = '';
    document.getElementById('averagePricePerEventComparison').innerText = '';
    document.getElementById('averageEventsPerDayComparison').innerText = '';

    // Masquer les graphiques
    const chartsContainer = document.querySelector('.charts-container');
    if (chartsContainer) {
        chartsContainer.style.display = 'none';
    }

    if (eventsByPersonChartInstance) { eventsByPersonChartInstance.destroy(); eventsByPersonChartInstance = null; }
    if (topClientsChartInstance) { topClientsChartInstance.destroy(); topClientsChartInstance = null; }
    if (eventsByDayOfWeekChartInstance) { eventsByDayOfWeekChartInstance.destroy(); eventsByDayOfWeekChartInstance = null; }
}

// Export CSV
function exportDataToCsv() {
    if (exportableStats.rawData.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    let csvContent = '';
    const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '""';
        let stringValue = String(value);
        if (stringValue.includes('"')) {
            stringValue = stringValue.replace(/"/g, '""');
        }
        return `"${stringValue}"`;
    };

    const formatCurrencyForCsv = (value) => {
        return escapeCsvValue(value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).replace(/,/g, '.'));
    };

    const formatNumberForCsv = (value, fixed = 0) => escapeCsvValue(value.toFixed(fixed).replace(/,/g, '.'));

    csvContent += '"Rapport Statistiques"\n\n';
    csvContent += '"Période de calcul"\n';
    csvContent += '"Date de début",,"Date de fin"\n';
    csvContent += `${escapeCsvValue(exportableStats.period.startDate)},,${escapeCsvValue(exportableStats.period.endDate)}\n\n`;
    csvContent += '"Métriques de synthèse"\n';
    csvContent += '"Métrique",,,"Valeur actuelle","Évolution"\n';
    csvContent += `${escapeCsvValue('Montant total')},,,${formatCurrencyForCsv(exportableStats.summaryMetrics.totalAmount)},${escapeCsvValue(exportableStats.summaryMetrics.totalAmountChange)}\n`;
    csvContent += `${escapeCsvValue('Prix moyen par événement')},,,${formatCurrencyForCsv(exportableStats.summaryMetrics.averagePricePerEvent)},${escapeCsvValue(exportableStats.summaryMetrics.averagePricePerEventChange)}\n`;
    csvContent += `${escapeCsvValue('Moyenne événements/jour')},,,${formatNumberForCsv(exportableStats.summaryMetrics.averageEventsPerDay, 2)},${escapeCsvValue(exportableStats.summaryMetrics.averageEventsPerDayChange)}\n\n`;
    csvContent += '"Événements par employé"\n';
    csvContent += '"Employé","Nombre d\'événements"\n';
    for (const person in exportableStats.eventsByPerson) {
        csvContent += `${escapeCsvValue(person)},${escapeCsvValue(exportableStats.eventsByPerson[person])}\n`;
    }
    csvContent += '\n';
    csvContent += '"Top clients"\n';
    csvContent += '"Client",,,"Montant dépensé"\n';
    exportableStats.topClients.forEach(client => {
        csvContent += `${escapeCsvValue(client[0])},,,${formatCurrencyForCsv(client[1])}\n`;
    });
    csvContent += '\n';
    csvContent += '"Événements par jour de la semaine"\n';
    csvContent += '"Jour de la semaine","Nombre d\'événements"\n';
    exportableStats.eventsByDayOfWeek.labels.forEach((label, index) => {
        csvContent += `${escapeCsvValue(label)},${escapeCsvValue(exportableStats.eventsByDayOfWeek.data[index])}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `statistiques_${exportableStats.period.startDate}_${exportableStats.period.endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export PDF pour les Statistiques Générales
async function exportGeneralStatsToPdf() {
    const loadingIndicator = document.getElementById('loadingIndicator');

    if (exportableStats.rawData.length === 0) {
        alert('Aucune donnée à exporter pour les statistiques générales');
        return;
    }

    loadingIndicator.textContent = 'Génération du PDF en cours...';
    loadingIndicator.style.display = 'block';

    try {
        // Créer un conteneur temporaire pour le PDF
        const pdfContainer = document.createElement('div');
        pdfContainer.style.cssText = `
            position: fixed;
            left: -10000px;
            top: 0;
            width: 800px;
            background: white;
            padding: 20px;
            font-family: Arial, sans-serif;
        `;

        // Contenu du PDF
        pdfContainer.innerHTML = `
            <h1 style="text-align: center; color: #2c3e50; margin-bottom: 20px;">
                Rapport Statistiques Générales
            </h1>

            <div style="margin-bottom: 20px;">
                <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                    Période d'analyse
                </h2>
                <p><strong>Du :</strong> ${exportableStats.period.startDate}</p>
                <p><strong>Au :</strong> ${exportableStats.period.endDate}</p>
            </div>

            <div style="margin-bottom: 20px;">
                <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                    Métriques de synthèse
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Métrique</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Valeur</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Évolution</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Montant total</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">
                            ${exportableStats.summaryMetrics.totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                            ${exportableStats.summaryMetrics.totalAmountChange}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Prix moyen par événement</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">
                            ${exportableStats.summaryMetrics.averagePricePerEvent.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                            ${exportableStats.summaryMetrics.averagePricePerEventChange}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Moyenne événements/jour</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">
                            ${exportableStats.summaryMetrics.averageEventsPerDay.toFixed(2)}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                            ${exportableStats.summaryMetrics.averageEventsPerDayChange}
                        </td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom: 20px;">
                <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                    Événements par employé
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Employé</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Nombre d'événements</th>
                    </tr>
                    ${Object.entries(exportableStats.eventsByPerson).map(([employe, count]) => `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">${employe}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${count}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <div style="margin-bottom: 20px;">
                <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                    Top 10 clients
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Client</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Montant dépensé</th>
                    </tr>
                    ${exportableStats.topClients.map(([client, montant]) => `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">${client}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">
                                ${montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                            </td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <div style="margin-bottom: 20px;">
                <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                    Événements par jour de la semaine
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Jour</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Nombre d'événements</th>
                    </tr>
                    ${exportableStats.eventsByDayOfWeek.labels.map((jour, index) => `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">${jour}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">
                                ${exportableStats.eventsByDayOfWeek.data[index]}
                            </td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <div style="margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 12px;">
                Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
            </div>
        `;

        document.body.appendChild(pdfContainer);

        // Convertir en image avec html2canvas
        const canvas = await html2canvas(pdfContainer, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');

        // Créer le PDF
        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Pages supplémentaires si nécessaire
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // Télécharger
        const fileName = `statistiques_generales_${exportableStats.period.startDate}_${exportableStats.period.endDate}.pdf`;
        pdf.save(fileName);

        // Nettoyer
        document.body.removeChild(pdfContainer);

    } catch (error) {
        console.error("Erreur lors de la génération du PDF :", error);
        alert('Erreur lors de la génération du PDF');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Export PDF pour les Statistiques Employés
async function exportEmployeeStatsToPdf() {
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    const employee = document.getElementById('employeeSelect').value;

    if (!year || !month || !employee) {
        alert('Veuillez sélectionner une année, un mois et un employé');
        return;
    }

    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.textContent = 'Génération du PDF employé en cours...';
    loadingIndicator.style.display = 'block';

    try {
        // Récupérer les données employés
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = `${year}-${month.padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

        const { data, error } = await supabase
            .from('event_quot1_fran')
            .select('Date, nombre_heures, Ajouté_pour')
            .gte('Date', startDate)
            .lte('Date', endDate)
            .eq('Ajouté_pour', employee);

        if (error) throw error;

        const hoursByDay = calculateHoursByDay(data, year, month);
        const monthlyTotal = calculateMonthlyTotal(data);
        const weeks = groupDaysByWeek(hoursByDay, year, month);

        // Créer le contenu PDF
        const pdfContainer = document.createElement('div');
        pdfContainer.style.cssText = `
            position: fixed;
            left: -10000px;
            top: 0;
            width: 800px;
            background: white;
            padding: 20px;
            font-family: Arial, sans-serif;
        `;

        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const monthName = monthNames[parseInt(month) - 1];

        let weeksHTML = '';
        weeks.forEach(week => {
            const weekTotal = week.days.reduce((total, day) => total + (day.hours || 0), 0);

            let daysHTML = '';
            week.days.forEach(day => {
                if (day.inMonth) {
                    daysHTML += `
                        <div style="display: inline-block; width: 80px; margin: 2px; padding: 5px; border: 1px solid #ddd; text-align: center;">
                            <div style="font-size: 10px; font-weight: bold;">${day.dayName}</div>
                            <div style="font-size: 14px; font-weight: bold;">${day.dayNumber}</div>
                            <div style="font-size: 12px; color: #e74c3c; font-weight: bold;">${day.hours.toFixed(1)}h</div>
                        </div>
                    `;
                } else {
                    daysHTML += `
                        <div style="display: inline-block; width: 80px; margin: 2px; padding: 5px; border: 1px dashed #ddd; text-align: center; background-color: #f8f9fa;">
                            &nbsp;
                        </div>
                    `;
                }
            });

            weeksHTML += `
                <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0; color: #2c3e50;">${week.weekLabel}</h3>
                        <div style="font-size: 16px; font-weight: bold; color: #3498db; background: white; padding: 5px 10px; border: 2px solid #3498db; border-radius: 5px;">
                            Total: ${weekTotal.toFixed(1)}h
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                        ${daysHTML}
                    </div>
                </div>
            `;
        });

        pdfContainer.innerHTML = `
            <h1 style="text-align: center; color: #2c3e50; margin-bottom: 10px;">
                Rapport Heures - ${employee}
            </h1>
            <h2 style="text-align: center; color: #7f8c8d; margin-bottom: 20px;">
                ${monthName} ${year}
            </h2>

            <div style="margin-bottom: 20px;">
                <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                    Détail des heures par semaine
                </h2>
                ${weeksHTML}
            </div>

            <div style="margin-top: 20px; padding: 15px; background-color: #2c3e50; color: white; border-radius: 8px; text-align: center;">
                <h3 style="margin: 0; font-size: 18px;">
                    Total mensuel pour ${employee} : ${monthName} ${year}
                </h3>
                <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold;">
                    ${monthlyTotal.toFixed(1)} heures
                </p>
            </div>

            <div style="margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 12px;">
                Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
            </div>
        `;

        document.body.appendChild(pdfContainer);

        // Convertir en PDF
        const canvas = await html2canvas(pdfContainer, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const fileName = `heures_${employee}_${monthName}_${year}.pdf`;
        pdf.save(fileName);

        document.body.removeChild(pdfContainer);

    } catch (error) {
        console.error("Erreur lors de la génération du PDF employé :", error);
        alert('Erreur lors de la génération du PDF employé');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Fonction d'export générale avec choix
async function exportToPdf() {
    const choice = prompt(
        'Que souhaitez-vous exporter ?\n\n' +
        '1 - Statistiques Générales\n' +
        '2 - Statistiques Employés\n\n' +
        'Entrez 1 ou 2 :'
    );

    if (choice === '1') {
        await exportGeneralStatsToPdf();
    } else if (choice === '2') {
        await exportEmployeeStatsToPdf();
    } else {
        alert('Choix annulé ou invalide');
    }
}

// Période - Mois en cours (ne s'exécute PAS automatiquement)
function setCurrentMonth() {
    console.log('📊 setCurrentMonth appelé (remplissage dates seulement)');
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    document.getElementById('startDate').value = start.toISOString().slice(0, 10);
    document.getElementById('endDate').value = end.toISOString().slice(0, 10);
    // NE PAS appeler updateGeneralStats() automatiquement
    // L'utilisateur devra cliquer sur "Calcul manuel"
}

// Mettre à jour les statistiques générales
async function updateGeneralStats() {
    console.log('🔧 updateGeneralStats appelé');
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    console.log('📅 Dates:', startDate, endDate);

    if (startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
            return;
        }
        await fetchGeneralStats(startDate, endDate);
    }
}

// Calcul manuel pour les statistiques générales
function calculateGeneralManualPeriod() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
            alert("La date de début ne peut pas être après la date de fin");
            return;
        }
        fetchGeneralStats(startDate, endDate);
    } else {
        alert("Choisissez les dates de début et de fin de période pour faire le calcul.");
    }
}

// Exposer les fonctions globales
window.setCurrentMonth = setCurrentMonth;
window.calculateGeneralManualPeriod = calculateGeneralManualPeriod;
window.exportDataToCsv = exportDataToCsv;
window.exportEmployeeStatsToPdf = exportEmployeeStatsToPdf;
window.exportGeneralStatsToPdf = exportGeneralStatsToPdf;
window.exportToPdf = exportToPdf;
window.exportDataToCsv = exportDataToCsv;
window.calculateManualPeriod = calculateGeneralManualPeriod;

// Fonctions pour les boutons de période des statistiques générales
window.setLastWeek = function() {
    console.log('🔄 setLastWeek appelé MANUELLEMENT');
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    document.getElementById('startDate').value = start.toISOString().slice(0, 10);
    document.getElementById('endDate').value = end.toISOString().slice(0, 10);
    updateGeneralStats();
};

window.setLastMonth = function() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);

    const formattedStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const formattedEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

    document.getElementById('startDate').value = formattedStart;
    document.getElementById('endDate').value = formattedEnd;
    updateGeneralStats();
};

window.setLast30Days = function() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    document.getElementById('startDate').value = start.toISOString().slice(0, 10);
    document.getElementById('endDate').value = end.toISOString().slice(0, 10);
    updateGeneralStats();
};

// Fonction pour les statistiques employés
window.calculateEmployeeStats = calculateEmployeeStats;