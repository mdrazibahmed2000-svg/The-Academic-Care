// ====================================================================
// CRITICAL: Modular Imports for Firebase SDK
// ====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ====================================================================
// --- Firebase Configuration ---
// ====================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8",
    authDomain: "the-academic-care.firebaseapp.com",
    databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "the-academic-care",
    storageBucket: "the-academic-care.firebasestorage.app",
    messagingSenderId: "728354914429",
    appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
    measurementId: "G-37MDWVYWFJ"
};

// ====================================================================
// --- Initialization ---
// ====================================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentLoggedInStudentId = null;
let currentAdminViewStudentId = null; 

// DOM Elements
const userID = document.getElementById("userID");
const adminLoginFields = document.getElementById("adminLoginFields");
const loginContainer = document.getElementById("loginContainer");
const registrationContainer = document.getElementById("registrationContainer");
const studentPanel = document.getElementById("studentPanel");
const adminPanel = document.getElementById("adminPanel");
const messageDiv = document.getElementById("message");
const registrationForm = document.getElementById("registrationForm");
const studentIDDisplay = document.getElementById("studentIDDisplay");

const profileSection = document.getElementById("profile");
const tuitionSection = document.getElementById("tuition");
const tuitionTableBody = document.getElementById("tuitionTable") ? document.getElementById("tuitionTable").querySelector("tbody") : null;
const breakSection = document.getElementById("break");

// NEW BREAK FIELDS
const breakStartMonthSelect = document.getElementById("breakStartMonth"); 
const breakDurationSelect = document.getElementById("breakDuration"); 
const breakMessage = document.getElementById("breakMessage");

const pendingStudentsList = document.getElementById("pendingStudents");
const studentInfoDiv = document.getElementById("studentInfo");
const studentTuitionTableBody = document.getElementById("studentTuitionTable");

const classLists = {
    "06": document.getElementById("class06Students"),
    "07": document.getElementById("class07Students"),
    "08": document.getElementById("class08Students"),
    "09": document.getElementById("class09Students"),
    "10": document.getElementById("class10Students")
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


// ====================================================================
// --- Event Listeners ---
// ====================================================================

function setupEventListeners() {
    // Admin Fields Visibility
    userID.addEventListener("input", () => {
        const isHidden = userID.value.trim().toLowerCase() !== "admin";
        adminLoginFields.classList.toggle("hidden", isHidden);
    });

    // Main Buttons
    document.getElementById("loginBtn").addEventListener("click", handleLogin);
    document.getElementById("applyBtn").addEventListener("click", () => showPanel(registrationContainer));
    document.getElementById("backToLogin").addEventListener("click", () => showPanel(loginContainer));
    document.getElementById("registrationForm").addEventListener("submit", handleRegistration);
    document.getElementById("studentLogoutBtn").addEventListener("click", handleLogout);
    document.getElementById("adminLogoutBtn").addEventListener("click", handleLogout);

    // Student Panel Buttons
    document.getElementById('profileBtn').addEventListener('click', () => toggleStudentPanelContent(profileSection));
    document.getElementById('tuitionBtn').addEventListener('click', () => toggleStudentPanelContent(tuitionSection));
    document.getElementById('breakBtn').addEventListener('click', () => toggleStudentPanelContent(breakSection));
    document.getElementById('requestBreakBtn').addEventListener("click", handleBreakRequest); // Use the new button ID

    // Admin Panel Tabs
    document.querySelectorAll(".tabBtn").forEach(btn => {
        btn.addEventListener("click", handleAdminTabChange);
    });

    // Approve Button Listener (Delegation)
    pendingStudentsList.addEventListener("click", handleApproveStudent);

    // Class List Student Item Listener (Delegation)
    Object.values(classLists).forEach(list => {
        list.addEventListener("click", handleViewStudentDetail);
    });
}

// ====================================================================
// --- Panel Management ---
// ====================================================================

function showPanel(targetPanel) {
    [loginContainer, registrationContainer, studentPanel, adminPanel].forEach(panel => {
        if (panel) panel.classList.add("hidden");
    });
    if (targetPanel) targetPanel.classList.remove("hidden");
    messageDiv.textContent = "";

    if (targetPanel === adminPanel) {
        loadAdminData(); 
        handleAdminTabChange({ target: document.querySelector('.tabBtn[data-tab="pending"]') });
    } else if (targetPanel === studentPanel) {
        if (currentLoggedInStudentId) {
            loadStudentData(currentLoggedInStudentId);
            toggleStudentPanelContent(profileSection); 
        }
    }
}

// UPDATED: Calls loadBreakRequestForm when the Break tab is opened
function toggleStudentPanelContent(contentSection) {
    [profileSection, tuitionSection, breakSection].forEach(section => {
        section.classList.add("hidden");
    });
    contentSection.classList.remove("hidden");

    if (contentSection === breakSection && currentLoggedInStudentId) {
        loadBreakRequestForm(currentLoggedInStudentId);
    }
}

function handleAdminTabChange(e) {
    const tabBtn = e.target.closest('.tabBtn');
    if (!tabBtn) return;
    const tabName = tabBtn.dataset.tab;

    document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tabContent").forEach(c => c.classList.add("hidden"));

    tabBtn.classList.add("active");
    const targetContent = document.getElementById(tabName);
    if (targetContent) targetContent.classList.remove("hidden");
}

// (handleLogin, handleLogout, handleRegistration, resetLoginForm are unchanged)
// ...

// ====================================================================
// --- Student Panel Logic ---
// ====================================================================

function loadStudentData(studentId) {
    const studentRef = ref(db, `students/${studentId}`);
    onValue(studentRef, (snapshot) => {
        const studentData = snapshot.val();
        if (!studentData) {
            handleLogout(); 
            return;
        }
        renderStudentProfile(studentData);
        renderStudentFeeTable(studentData.tuitionStatus);
    });
}

function renderStudentProfile(data) {
    if (!profileSection) return;
    profileSection.innerHTML = `
        <p><strong>ID:</strong> ${data.id}</p>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Class:</strong> ${data.class}</p>
        <p><strong>Roll:</strong> ${data.roll}</p>
        <p><strong>Guardian Phone:</strong> ${data.guardian}</p>
        <p><strong>Status:</strong> <span class="status-${data.approved ? 'paid' : 'unpaid'}">${data.approved ? 'APPROVED' : 'PENDING'}</span></p>
    `;
}

// Renders months in Calendar Order (Jan-Dec)
function renderStudentFeeTable(tuitionStatus) {
    if (!tuitionTableBody) return;
    tuitionTableBody.innerHTML = '';

    MONTHS.forEach(month => {
        const data = tuitionStatus[month] || { paid: false, date: null };
        const statusClass = data.paid ? "paid" : "unpaid";
        const statusText = data.paid ? `Paid (${data.date})` : "Unpaid";
        
        const row = tuitionTableBody.insertRow();
        row.innerHTML = `
            <td>${month}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
        `;
    });
}

// NEW FUNCTION: Dynamically loads the available months for break request form
async function loadBreakRequestForm(studentId) {
    breakMessage.textContent = 'Calculating available months...';
    
    if (!breakStartMonthSelect || !breakDurationSelect) return;

    const snapshot = await get(ref(db, `students/${studentId}/tuitionStatus`));
    const tuitionStatus = snapshot.val() || {};

    const currentMonthIndex = new Date().getMonth(); 
    const currentYear = new Date().getFullYear();

    let lastPaidOrUnpaidIndex = -1; 
    
    // Find the index of the last month that has a payment status
    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month];
        if (data && (data.paid === true || data.paid === false)) {
            lastPaidOrUnpaidIndex = index;
        }
    });

    // Determine the starting month for the break
    let startMonthIndex = Math.max(lastPaidOrUnpaidIndex, currentMonthIndex) + 1;
    
    breakStartMonthSelect.innerHTML = ''; // Clear previous options
    breakDurationSelect.innerHTML = ''; 

    if (startMonthIndex >= 12) {
        breakMessage.textContent = `All months in the current academic year (${currentYear}) are already accounted for.`;
        return;
    }

    const monthsRemainingInYear = 12 - startMonthIndex;
    const startMonth = MONTHS[startMonthIndex];
    
    // Populate the Start Month Select with the first available month
    // We limit it to the very next month for simplicity in calculating duration
    breakStartMonthSelect.add(new Option(`${startMonth} (${currentYear})`, startMonth));
    
    // Populate Duration Select
    for (let i = 1; i <= monthsRemainingInYear; i++) {
         breakDurationSelect.add(new Option(`${i} month${i > 1 ? 's' : ''}`, i));
    }

    breakMessage.textContent = `You can request a break starting from ${startMonth}. Max duration: ${monthsRemainingInYear} month(s).`;
}


// UPDATED: Now uses the selected month and duration from the dropdowns
async function handleBreakRequest() {
    const selectedStartMonth = breakStartMonthSelect.value;
    const requestedMonths = parseInt(breakDurationSelect.value, 10);
    
    if (!currentLoggedInStudentId || !selectedStartMonth || isNaN(requestedMonths) || requestedMonths <= 0) {
        breakMessage.textContent = "Please select a starting month and a valid duration.";
        return;
    }

    // 1. Calculate end month based on selection
    const startMonthIndex = MONTHS.indexOf(selectedStartMonth);
    const endMonthIndex = startMonthIndex + requestedMonths - 1;
    
    const endMonth = MONTHS[endMonthIndex];
    
    const confirmationMessage = 
        `Confirm break request for ${requestedMonths} month(s), starting ${selectedStartMonth} and ending ${endMonth}?`;

    if (!confirm(confirmationMessage)) {
        return;
    }

    // 2. Update the database with the break request details
    try {
        await update(ref(db, `students/${currentLoggedInStudentId}`), {
            breakRequest: {
                months: requestedMonths,
                startMonth: selectedStartMonth,
                endMonth: endMonth,
                requestedAt: Date.now(),
                status: 'pending' 
            }
        });
        breakMessage.textContent = `Break request for ${requestedMonths} months (starting ${selectedStartMonth}) submitted successfully. Wait for admin approval.`;
        // Clear selections after successful submission
        breakStartMonthSelect.innerHTML = ''; 
        breakDurationSelect.innerHTML = ''; 
    } catch (error) {
        breakMessage.textContent = `Request failed. Error: ${error.message}`;
    }
}


// (loadAdminData, handleApproveStudent, handleViewStudentDetail, loadStudentDetailData are unchanged)
// ...

// Renders months in Calendar Order (Jan-Dec) for Admin Panel
function renderAdminFeeTable(studentId, tuitionStatus) {
    if (!studentTuitionTableBody) return;
    studentTuitionTableBody.innerHTML = "";

    MONTHS.forEach(month => {
        const data = tuitionStatus[month] || { paid: false, date: null };
        const statusText = data.paid ? `Paid (${data.date})` : "Unpaid";
        
        const tr = studentTuitionTableBody.insertRow();
        const tdMonth = tr.insertCell();
        const tdStatus = tr.insertCell();
        const tdAction = tr.insertCell();

        tdMonth.textContent = month;
        tdStatus.innerHTML = `<span class="${data.paid ? 'paid' : 'unpaid'}">${statusText}</span>`;
        
        if (data.paid) {
            tdAction.innerHTML = `<button onclick="undoStatus('${studentId}', '${month}')">Undo Status</button>`;
        } else {
            tdAction.innerHTML = `
                <button onclick="markPaid('${studentId}', '${month}')">Mark Paid</button>
                <button onclick="markBreak('${studentId}', '${month}')">Mark Break</button>
            `;
        }
    });
}

// (Global Admin Action Functions - window.markPaid, window.markBreak, window.undoStatus - are unchanged)
// ...

// ====================================================================
// --- Script Start ---
// ====================================================================
window.onload = setupEventListeners;
