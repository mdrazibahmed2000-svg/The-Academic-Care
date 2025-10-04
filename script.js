// ====================================================================
// CRITICAL: Modular Imports for Firebase SDK
// ====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ====================================================================
// --- Firebase Configuration ---
// ====================================================================
// NOTE: Using a placeholder config. Replace with your actual Firebase config.
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
const tuitionTableBody = document.getElementById("tuitionTable");
const breakSection = document.getElementById("break");

// STUDENT BREAK FIELDS
const breakStartMonthSelect = document.getElementById("breakStartMonth"); 
const breakDurationSelect = document.getElementById("breakDuration"); 
const breakMessage = document.getElementById("breakMessage");

// ADMIN FIELDS
const pendingStudentsList = document.getElementById("pendingStudents");
const studentInfoDiv = document.getElementById("studentInfoDiv"); 
const studentTuitionTableBody = document.getElementById("studentTuitionTable");
const breakRequestManagementDiv = document.getElementById("breakRequestManagement");


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
    document.getElementById('requestBreakBtn').addEventListener("click", handleBreakRequest); 

    // Admin Panel Tabs
    document.querySelectorAll("#adminPanel .tabs .tabBtn").forEach(btn => {
        btn.addEventListener("click", handleAdminTabChange);
    });

    // Approve Button Listener (Delegation)
    if(pendingStudentsList) pendingStudentsList.addEventListener("click", handleApproveStudent);

    // Class List Student Item Listener (Delegation)
    Object.values(classLists).forEach(list => {
        if(list) list.addEventListener("click", handleViewStudentDetail);
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
        // Ensure the active tab is set correctly for admin
        const pendingBtn = document.querySelector('#adminPanel .tabBtn[data-tab="pending"]');
        if (pendingBtn) handleAdminTabChange({ target: pendingBtn });
    } else if (targetPanel === studentPanel) {
        if (currentLoggedInStudentId) {
            loadStudentData(currentLoggedInStudentId);
            // Default to profile tab
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn) {
                 document.querySelectorAll("#studentPanel .tabBtn").forEach(b => b.classList.remove("active"));
                 profileBtn.classList.add("active");
                 toggleStudentPanelContent(profileSection); 
            }
        }
    }
}

// Calls loadBreakRequestForm when the Break tab is opened
function toggleStudentPanelContent(contentSection) {
    // Hide all tab contents
    [profileSection, tuitionSection, breakSection].forEach(section => {
        if(section) section.classList.add("hidden");
    });
    // Show the selected content
    if(contentSection) contentSection.classList.remove("hidden");

    // CRITICAL: Load form data when the break section is opened.
    if (contentSection === breakSection && currentLoggedInStudentId) {
        loadBreakRequestForm(currentLoggedInStudentId);
    }
}

function handleAdminTabChange(e) {
    const tabBtn = e.target.closest('.tabBtn');
    if (!tabBtn) return;
    const tabName = tabBtn.dataset.tab;

    document.querySelectorAll("#adminPanel .tabBtn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#adminPanel .tabContent").forEach(c => c.classList.add("hidden"));

    tabBtn.classList.add("active");
    const targetContent = document.getElementById(tabName);
    if (targetContent) targetContent.classList.remove("hidden");
    
    // If opening a class tab, make sure studentDetail is cleared/hidden
    if (['class6', 'class7', 'class8', 'class9', 'class10'].includes(tabName)) {
        if(document.getElementById("studentDetail")) document.getElementById("studentDetail").classList.add("hidden");
    }
}

// ====================================================================
// --- Login/Logout/Registration ---
// ====================================================================

async function handleLogin() {
    // 1. Clear previous messages and trim ID input
    messageDiv.textContent = '';
    const id = userID.value.trim();
    if (!id) { 
        messageDiv.textContent = 'Please enter ID or "admin"'; 
        return; 
    }

    if (id.toLowerCase() === 'admin') {
        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;
        if (!email || !password) { 
            messageDiv.textContent = "Enter admin email/password"; 
            resetLoginForm();
            return; 
        }
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showPanel(adminPanel);
        } catch (e) { 
            // Display Firebase Auth error
            messageDiv.textContent = `Admin login failed: ${e.message.replace('Firebase: Error (auth/', '').replace(')', '')}`; 
        }
        
    } else {
        // Student Login path
        try {
            const studentRef = ref(db, `students/${id}`);
            const snapshot = await get(studentRef);

            if (!snapshot.exists()) {
                messageDiv.textContent = `Student ID ${id} not found or not yet approved.`;
                resetLoginForm();
                return;
            }

            const data = snapshot.val();
            
            // Check for approval status
            if (data.approved !== true) { 
                messageDiv.textContent = 'Registration pending admin approval.';
                resetLoginForm();
                return;
            }
            
            // SUCCESS: Set student ID and show panel
            currentLoggedInStudentId = id;
            showPanel(studentPanel);

        } catch (e) {
            // Catch database errors (e.g., Permission Denied)
            let errorMessage = e.message;
            if (errorMessage.includes("permission_denied")) {
                 errorMessage = "Login failed. You might not be approved yet, or there is a permission issue.";
            }
            console.error("Student Login Error:", e);
            messageDiv.textContent = `Login failed. Error: ${errorMessage}`;
        }
    }
    resetLoginForm();
}


async function handleLogout() {
    currentLoggedInStudentId = null;
    currentAdminViewStudentId = null;

    if (auth.currentUser && auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        await signOut(auth);
        messageDiv.textContent = "Admin logged out successfully";
    } else {
        messageDiv.textContent = "Logged out successfully";
    }
    showPanel(loginContainer);
}

async function handleRegistration(e) {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    let studentClass = document.getElementById("class").value.trim();
    studentClass = studentClass.padStart(2, '0');
    const roll = document.getElementById("roll").value.trim().padStart(3, '0'); 
    const guardian = document.getElementById("guardian").value.trim();
    const year = new Date().getFullYear().toString().substring(2);
    const newId = `S${year}${studentClass}${roll}`; 
    
    studentIDDisplay.textContent = 'Processing...';

    if (!["06", "07", "08", "09", "10"].includes(studentClass)) {
        studentIDDisplay.textContent = "Class must be 6-10.";
        return;
    }

    try {
        const existingStudent = await get(ref(db, `students/${newId}`));
        if (existingStudent.exists()) {
            studentIDDisplay.textContent = `Error: Student ID ${newId} already exists. Check class/roll.`;
            return;
        }

        const tuitionStatus = {};
        MONTHS.forEach(month => {
            tuitionStatus[month] = { paid: false, date: null };
        });

        await set(ref(db, `students/${newId}`), {
            id: newId,
            name: name,
            class: studentClass,
            roll: roll,
            guardian: guardian,
            approved: false,
            tuitionStatus: tuitionStatus,
            breakRequest: null, 
            registeredAt: Date.now()
        });

        studentIDDisplay.innerHTML = `Registration submitted! Your Student ID: <strong>${newId}</strong>. Please wait for admin approval.`;
        registrationForm.reset();
        
    } catch (error) {
        studentIDDisplay.textContent = `Registration failed. Error: ${error.message}`;
    }
}

function resetLoginForm() { 
    if(userID) userID.value = ""; 
    const adminEmail = document.getElementById("adminEmail");
    const adminPassword = document.getElementById("adminPassword");
    if(adminEmail) adminEmail.value = ""; 
    if(adminPassword) adminPassword.value = ""; 
    if(adminLoginFields) adminLoginFields.classList.add("hidden");
    if(messageDiv) messageDiv.textContent = ""; 
}


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
    const studentProfileDiv = document.querySelector("#profile #studentInfo");
    if (!studentProfileDiv) return;
    studentProfileDiv.innerHTML = `
        <p><strong>ID:</strong> ${data.id}</p>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Class:</strong> ${data.class}</p>
        <p><strong>Roll:</strong> ${data.roll}</p>
        <p><strong>Guardian Phone:</strong> ${data.guardian}</p>
        <p><strong>Status:</strong> <span class="status-${data.approved ? 'paid' : 'unpaid'}">${data.approved ? 'APPROVED' : 'PENDING'}</span></p>
    `;
}

// CORRECTED: Future months are now shown as "---" (unrecorded)
function renderStudentFeeTable(tuitionStatus) {
    if (!tuitionTableBody) return;
    tuitionTableBody.innerHTML = '';

    const currentDate = new Date();
    // Month index (0=Jan, 9=Oct, 11=Dec)
    const currentMonthIndex = currentDate.getMonth(); 
    
    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month] || { paid: false, date: null };
        let statusText = "---";
        let statusClass = "unrecorded"; // Default for unrecorded/future months
        let dateText = '---'; 

        // Check if the month is currently due (current month or a past month)
        const isMonthDueOrPast = (index <= currentMonthIndex);
        
        // Determine Status and Class
        if (data.paid) {
            statusText = `Paid`; 
            statusClass = "paid";
            dateText = data.date; 

        } else if (data.isBreak) {
            statusText = `Break`;
            statusClass = "break";
            dateText = data.date || 'Requested'; 

        } else if (isMonthDueOrPast) {
            // Month is due (current or past) and is NOT Paid/Break, so it is UNPAID.
            statusText = "Unpaid";
            statusClass = "unpaid";
            dateText = '---'; 

        } else {
            // Month is in the future and unrecorded. Status remains '---'.
            statusText = "---";
            statusClass = "unrecorded";
            dateText = '---'; 
        }
        
        const row = tuitionTableBody.insertRow();
        row.innerHTML = `
            <td>${month}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${dateText}</td> 
        `;
    });
}

// ====================================================================
// --- BREAK REQUEST LOGIC (Student Side) ---
// ====================================================================

async function loadBreakRequestForm(studentId) {
    if(!breakMessage || !breakStartMonthSelect || !breakDurationSelect) return;
    breakMessage.textContent = 'Calculating available months...';
    
    // Clear previous options
    breakStartMonthSelect.innerHTML = ''; 
    breakDurationSelect.innerHTML = ''; 

    const snapshot = await get(ref(db, `students/${studentId}/tuitionStatus`));
    const tuitionStatus = snapshot.val() || {};

    const currentYear = new Date().getFullYear();

    let lastPaidMonthIndex = -1; 
    
    // 1. Find the index of the last month that was explicitly PAID.
    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month];
        // Check for paid OR break status to determine the next required month
        if (data && (data.paid === true || data.isBreak === true)) {
            lastPaidMonthIndex = index;
        }
    });

    // 2. Determine the earliest possible start month for the break.
    let earliestStartMonthIndex = lastPaidMonthIndex + 1;
    
    // If no payments or breaks found, start from January (index 0).
    if (lastPaidMonthIndex === -1) {
        earliestStartMonthIndex = 0;
    }
    
    // 3. Check if any months are available for the current academic year (Jan-Dec)
    if (earliestStartMonthIndex >= 12) {
        breakMessage.textContent = `All months in the current academic year (${currentYear}) are already accounted for (Paid/Break).`;
        return;
    }

    const monthsRemainingInYear = 12 - earliestStartMonthIndex;
    const startMonthName = MONTHS[earliestStartMonthIndex];
    
    // 4. Populate the Start Month Select 
    for (let i = earliestStartMonthIndex; i < 12; i++) {
        breakStartMonthSelect.add(new Option(`${MONTHS[i]} (${currentYear})`, MONTHS[i]));
    }
    
    // 5. Populate Duration Select
    for (let i = 1; i <= monthsRemainingInYear; i++) {
          breakDurationSelect.add(new Option(`${i} month${i > 1 ? 's' : ''}`, i));
    }

    breakMessage.textContent = `You can request a break starting from ${startMonthName}. Max duration: ${monthsRemainingInYear} month(s).`;
}


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
    
    if (endMonthIndex >= 12) {
        breakMessage.textContent = "Error: Duration exceeds the academic year.";
        return;
    }

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
        // Re-load the form to update messages and clear selections
        loadBreakRequestForm(currentLoggedInStudentId); 
    } catch (error) {
        console.error("Break Request Failed:", error);
        breakMessage.textContent = `Request failed. Error: ${error.message}`;
    }
}


// ====================================================================
// --- Admin Panel Logic (Real-time) ---
// ====================================================================

function loadAdminData() {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        return; 
    }
    
    const studentsRef = ref(db, "students");

    onValue(studentsRef, (snapshot) => {
        if(pendingStudentsList) pendingStudentsList.innerHTML = "";
        Object.values(classLists).forEach(list => {if(list) list.innerHTML = "";});

        if (!snapshot.exists()) return;

        const students = snapshot.val();

        Object.values(students).forEach(student => {
            let cls = student.class;
            
            // 1. Pending students
            if (student.approved === false && pendingStudentsList) {
                const li = document.createElement("li");
                li.innerHTML = `
                    ${student.name} (ID: ${student.id}) - Class ${cls.replace(/^0+/, '')} 
                    <button class="approveBtn" data-id="${student.id}">Approve</button>
                `;
                pendingStudentsList.appendChild(li);
            }

            // 2. Approved students in class tabs
            if (student.approved === true && classLists[cls]) {
                const li = document.createElement("li");
                li.textContent = `${student.name} (ID: ${student.id})`;
                li.classList.add("studentItem");
                li.dataset.id = student.id;
                classLists[cls].appendChild(li);
            }
        });
        
    }, (error) => {
        console.error("Error loading Admin data:", error);
        if(pendingStudentsList) pendingStudentsList.innerHTML = `<li>Error loading data. Check security rules and console.</li>`;
    });
}

async function handleApproveStudent(e) {
    if (!e.target.classList.contains("approveBtn")) return;
    
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        console.error("Permission Denied: Admin password authentication required."); 
        return;
    }
    
    const studentID = e.target.dataset.id;
    try {
        await update(ref(db, `students/${studentID}`), {
            approved: true,
            approvedBy: auth.currentUser.uid,
            approvedAt: Date.now()
        });
        console.log(`Student ${studentID} approved.`);
    } catch (error) {
        console.error(`Failed to approve student.`, error);
    }
}

function handleViewStudentDetail(e) {
    if (!e.target.classList.contains("studentItem")) return;
    const studentID = e.target.dataset.id;
    currentAdminViewStudentId = studentID;
    
    // Switch to the Student Detail tab
    document.querySelectorAll("#adminPanel .tabBtn").forEach(b => b.classList.remove("active"));
    const detailTabBtn = document.querySelector('.tabBtn[data-tab="studentDetail"]');
    if (detailTabBtn) detailTabBtn.classList.add("active");

    document.querySelectorAll("#adminPanel .tabContent").forEach(c => c.classList.add("hidden"));
    const studentDetail = document.getElementById("studentDetail");
    if(studentDetail) studentDetail.classList.remove("hidden");
    
    loadStudentDetailData(studentID);
}

// UPDATED: Renders Break Request Management or "None" status
function loadStudentDetailData(studentId) {
    const studentRef = ref(db, `students/${studentId}`);
    
    onValue(studentRef, (snapshot) => {
        const student = snapshot.val();
        if (!student) {
            if(studentInfoDiv) studentInfoDiv.innerHTML = "Student not found.";
            if(studentTuitionTableBody) studentTuitionTableBody.innerHTML = "";
            return;
        }
        
        // --- 1. Render Student Info ---
        if(studentInfoDiv) studentInfoDiv.innerHTML = `
            <p><strong>Name:</strong> ${student.name} (ID: ${student.id})</p>
            <p><strong>Class:</strong> ${student.class}, Roll: ${student.roll}</p>
            <p><strong>Guardian:</strong> ${student.guardian}</p>
            <h3 style="margin-top:20px;">Tuition Management</h3>
        `;
        
        // --- 2. Render Break Request Management ---
        const breakRequest = student.breakRequest;
        
        if (breakRequest && breakRequest.status === 'pending') {
            if(breakRequestManagementDiv) {
                // Show management UI for a pending request
                breakRequestManagementDiv.classList.remove("hidden");
                breakRequestManagementDiv.innerHTML = `
                    <h4>Pending Break Request:</h4>
                    <p><strong>Status:</strong> <span class="unpaid">${breakRequest.status.toUpperCase()}</span></p>
                    <p><strong>Details:</strong> ${breakRequest.months} month(s), starting ${breakRequest.startMonth} until ${breakRequest.endMonth}.</p>
                    <button onclick="window.approveBreak('${studentId}', '${breakRequest.startMonth}', ${breakRequest.months})" 
                            style="background-color: #ff9800; width: 49%; float: left; margin-right: 2%;">Approve Break</button>
                    <button onclick="window.rejectBreak('${studentId}')" 
                            style="background-color: #f44336; width: 49%;">Reject Request</button>
                    <div style="clear: both;"></div>
                `;
            }
        } else {
            // Display "None" status if no pending request exists
            if(breakRequestManagementDiv) {
                breakRequestManagementDiv.classList.remove("hidden"); // Keep visible to show the "None" status
                breakRequestManagementDiv.innerHTML = `<p><strong>Break Request Status:</strong> None</p>`;
                breakRequestManagementDiv.style.border = 'none'; // Remove the border when just showing 'None'
            }
        }

        // --- 3. Render Fee Table (always runs last) ---
        renderAdminFeeTable(studentId, student.tuitionStatus);
    });
}

// CRITICAL FIX: Admin Panel displays "---" (Unrecorded) for future months.
function renderAdminFeeTable(studentId, tuitionStatus) {
    if (!studentTuitionTableBody) return;
    studentTuitionTableBody.innerHTML = "";

    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); 

    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month] || { paid: false, date: null, isBreak: false };
        let statusText = "---";
        let statusClass = "unrecorded";

        // Check if the month is currently due (current month or a past month)
        const isMonthDueOrPast = (index <= currentMonthIndex);
        
        // Determine Status and Class
        if (data.paid) {
            statusText = `Paid`; 
            statusClass = "paid";
        } else if (data.isBreak) {
            statusText = `Break`;
            statusClass = "break";
        } else if (isMonthDueOrPast) {
            // Month is due (current or past) and is NOT Paid/Break, so it is UNPAID.
            statusText = "Unpaid";
            statusClass = "unpaid";
        } else {
            // Month is in the future. Status remains '---'. (Unrecorded)
            statusText = "---";
            statusClass = "unrecorded";
        }
        
        const tr = studentTuitionTableBody.insertRow();
        const tdMonth = tr.insertCell();
        const tdStatus = tr.insertCell();
        const tdAction = tr.insertCell();

        tdMonth.textContent = month;
        tdStatus.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
        
        // Action buttons are available only if status is NOT Paid or Break.
        if (data.paid || data.isBreak) {
            tdAction.innerHTML = `<button onclick="window.undoStatus('${studentId}', '${month}')">Undo Status</button>`;
        } else {
            tdAction.innerHTML = `
                <button onclick="window.markPaid('${studentId}', '${month}')">Mark Paid</button>
                <button onclick="window.markBreak('${studentId}', '${month}')">Mark Break</button>
            `;
        }
    });
}

// ====================================================================
// --- Global Admin Action Functions (Must be window-scoped) ---
// ====================================================================

// Utility function to get all months in a range
function getMonthsInRange(startMonth, count) {
    const startIndex = MONTHS.indexOf(startMonth);
    const months = [];
    for (let i = 0; i < count; i++) {
        months.push(MONTHS[startIndex + i]);
    }
    return months;
}

window.markPaid = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        console.error("Permission Denied: Admin password authentication required.");
        return;
    }
    const method = prompt(`Enter payment method for ${month}:`);
    if (method) {
        try {
            await update(ref(db, `students/${studentId}/tuitionStatus/${month}`), {
                paid: true,
                isBreak: false,
                date: new Date().toLocaleDateString(),
                method: method,
                recordedBy: auth.currentUser.uid
            });
        } catch (error) {
            console.error(`Error marking paid.`, error);
        }
    }
}

window.markBreak = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        console.error("Permission Denied: Admin password authentication required.");
        return;
    }
    if (confirm(`Confirm marking ${month} as a Break month for ${studentId}?`)) {
        try {
            await update(ref(db, `students/${studentId}/tuitionStatus/${month}`), {
                paid: false, 
                isBreak: true,
                date: new Date().toLocaleDateString(),
                recordedBy: auth.currentUser.uid
            });
        } catch (error) {
            console.error(`Error marking break.`, error);
        }
    }
}

window.undoStatus = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        console.error("Permission Denied: Admin password authentication required.");
        return;
    }
    if (confirm(`Are you sure you want to UNDO the status for ${month}? This will revert it to UNPAID (if month is past/current) or '---' (if month is future).`)) {
        try {
            await update(ref(db, `students/${studentId}/tuitionStatus/${month}`), {
                paid: false,
                date: null,
                method: null,
                isBreak: false,
                recordedBy: null
            });
        } catch (error) {
            console.error(`Error undoing status.`, error);
        }
    }
}


// NEW: Admin action to approve the student's break request
window.approveBreak = async function(studentId, startMonth, duration) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        console.error("Permission Denied: Admin password authentication required.");
        return;
    }

    if (!confirm(`Are you sure you want to APPROVE the break request for ${duration} months starting ${startMonth}? This will mark those months as 'Break' in the tuition status.`)) {
        return;
    }
    
    const monthsToUpdate = getMonthsInRange(startMonth, duration);
    const updates = {};
    const currentDate = new Date().toLocaleDateString();

    monthsToUpdate.forEach(month => {
        updates[`tuitionStatus/${month}`] = {
            paid: false, 
            isBreak: true,
            date: currentDate,
            recordedBy: auth.currentUser.uid
        };
    });
    
    // Mark the request itself as APPROVED
    updates['breakRequest'] = { status: 'APPROVED', approvedAt: Date.now() };

    try {
        await update(ref(db, `students/${studentId}`), updates);
        alert('Break request approved and tuition status updated successfully!');
    } catch (error) {
        console.error("Error approving break request:", error);
        alert(`Failed to approve break request. Error: ${error.message}`);
    }
}

// NEW: Admin action to reject the student's break request
window.rejectBreak = async function(studentId) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        console.error("Permission Denied: Admin password authentication required.");
        return;
    }
    
    if (!confirm(`Are you sure you want to REJECT the pending break request for this student?`)) {
        return;
    }
    
    try {
        // Update the status to 'REJECTED'
        await update(ref(db, `students/${studentId}/breakRequest`), { 
            status: 'REJECTED', 
            rejectedAt: Date.now() 
        });
        alert('Break request rejected.');
    } catch (error) {
        console.error("Error rejecting break request:", error);
        alert(`Failed to reject break request. Error: ${error.message}`);
    }
}

// ====================================================================
// --- Script Start ---
// ====================================================================

// This ensures setupEventListeners runs ONLY after the entire DOM is loaded.
window.onload = setupEventListeners;
