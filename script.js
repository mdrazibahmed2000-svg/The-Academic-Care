// ====================================================================
// CRITICAL: Modular Imports for Firebase SDK
// Using Firebase Realtime Database and Auth
// ====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ====================================================================
// --- Firebase Configuration ---
// !!! IMPORTANT: REPLACE THIS PLACEHOLDER CONFIG WITH YOUR ACTUAL FIREBASE DETAILS !!!
// ====================================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", 
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL", // Must be the Realtime Database URL
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
};

// ====================================================================
// --- Initialization & Global State ---
// ====================================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentLoggedInStudentId = null;
let currentAdminViewStudentId = null; 

// DOM Element References
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

// Student Break Fields
const breakStartMonthSelect = document.getElementById("breakStartMonth"); 
const breakDurationSelect = document.getElementById("breakDuration"); 
const breakMessage = document.getElementById("breakMessage");

// Admin Fields
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
// --- Event Listeners Setup ---
// ====================================================================

function setupEventListeners() {
    // Admin Fields Visibility Toggle
    userID.addEventListener("input", () => {
        const isHidden = userID.value.trim().toLowerCase() !== "admin";
        adminLoginFields.classList.toggle("hidden", isHidden);
    });

    // Main Buttons & Forms
    document.getElementById("loginBtn").addEventListener("click", handleLogin);
    document.getElementById("applyBtn").addEventListener("click", () => showPanel(registrationContainer));
    document.getElementById("backToLogin").addEventListener("click", () => showPanel(loginContainer));
    document.getElementById("registrationForm").addEventListener("submit", handleRegistration);
    document.getElementById("studentLogoutBtn").addEventListener("click", handleLogout);
    document.getElementById("adminLogoutBtn").addEventListener("click", handleLogout);

    // Student Panel Tab Buttons
    document.getElementById('profileBtn').addEventListener('click', (e) => {
         document.querySelectorAll("#studentPanel .tabBtn").forEach(b => b.classList.remove("active"));
         e.target.classList.add("active");
         toggleStudentPanelContent(profileSection);
    });
    document.getElementById('tuitionBtn').addEventListener('click', (e) => {
         document.querySelectorAll("#studentPanel .tabBtn").forEach(b => b.classList.remove("active"));
         e.target.classList.add("active");
         toggleStudentPanelContent(tuitionSection);
    });
    document.getElementById('breakBtn').addEventListener('click', (e) => {
         document.querySelectorAll("#studentPanel .tabBtn").forEach(b => b.classList.remove("active"));
         e.target.classList.add("active");
         toggleStudentPanelContent(breakSection);
    });
    document.getElementById('requestBreakBtn').addEventListener("click", handleBreakRequest); 

    // Admin Panel Tabs
    document.querySelectorAll("#adminPanel .tabs .tabBtn").forEach(btn => {
        btn.addEventListener("click", handleAdminTabChange);
    });

    // Delegation for dynamic content
    if(pendingStudentsList) pendingStudentsList.addEventListener("click", handleApproveStudent);
    Object.values(classLists).forEach(list => {
        if(list) list.addEventListener("click", handleViewStudentDetail);
    });
    
    // Initial panel display
    showPanel(loginContainer);
}

// ====================================================================
// --- Panel Management Functions ---
// ====================================================================

function showPanel(targetPanel) {
    [loginContainer, registrationContainer, studentPanel, adminPanel].forEach(panel => {
        if (panel) panel.classList.add("hidden");
    });
    if (targetPanel) targetPanel.classList.remove("hidden");
    messageDiv.textContent = "";

    if (targetPanel === adminPanel) {
        loadAdminData(); 
        const pendingBtn = document.querySelector('#adminPanel .tabBtn[data-tab="pending"]');
        if (pendingBtn) handleAdminTabChange({ target: pendingBtn });
    } else if (targetPanel === studentPanel) {
        if (currentLoggedInStudentId) {
            loadStudentData(currentLoggedInStudentId);
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn) {
                profileBtn.classList.add("active");
                toggleStudentPanelContent(profileSection); 
            }
        }
    }
}

function toggleStudentPanelContent(contentSection) {
    [profileSection, tuitionSection, breakSection].forEach(section => {
        if(section) section.classList.add("hidden");
    });
    if(contentSection) contentSection.classList.remove("hidden");

    if (contentSection === breakSection && currentLoggedInStudentId) {
        loadBreakRequestForm(currentLoggedInStudentId);
    }
}

function handleAdminTabChange(e) {
    const tabBtn = e.target.closest('.tabBtn');
    if (!tabBtn) return;
    const tabName = tabBtn.dataset.tab;

    // Remove active state from all tab buttons
    document.querySelectorAll("#adminPanel .tabBtn").forEach(b => b.classList.remove("active"));
    // Hide all tab content sections
    document.querySelectorAll("#adminPanel .tabContent").forEach(c => c.classList.add("hidden"));

    tabBtn.classList.add("active");
    const targetContent = document.getElementById(tabName);
    if (targetContent) targetContent.classList.remove("hidden");
    
    // Manage visibility of the studentDetail tab
    if (tabName !== 'studentDetail') {
        // If switching to any class list or pending, hide the detail view
        document.querySelector('.tabBtn[data-tab="studentDetail"]').classList.add("hidden");
    } else {
        // If the detail view is active, ensure its tab button is visible
        document.querySelector('.tabBtn[data-tab="studentDetail"]').classList.remove("hidden");
    }
}

// ====================================================================
// --- Authentication & Registration ---
// ====================================================================

async function handleLogin() {
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
            messageDiv.textContent = `Admin login failed: ${e.message.replace('Firebase: Error (auth/', '').replace(')', '')}`; 
        }
        
    } else {
        // Student Login path (Checks database for existence and approval)
        try {
            const studentRef = ref(db, `students/${id}`);
            const snapshot = await get(studentRef);

            if (!snapshot.exists()) {
                messageDiv.textContent = `Student ID ${id} not found or not yet approved.`;
                resetLoginForm();
                return;
            }

            const data = snapshot.val();
            
            if (data.approved !== true) { 
                messageDiv.textContent = 'Registration pending admin approval.';
                resetLoginForm();
                return;
            }
            
            // Success
            currentLoggedInStudentId = id;
            showPanel(studentPanel);

        } catch (e) {
            let errorMessage = e.message;
            if (errorMessage.includes("permission_denied")) {
                 errorMessage = "Login failed. You might not be approved yet, or there is a database permission issue.";
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
    studentClass = studentClass.padStart(2, '0'); // e.g., '6' becomes '06'
    const roll = document.getElementById("roll").value.trim().padStart(3, '0'); // e.g., '1' becomes '001'
    const guardian = document.getElementById("guardian").value.trim();
    const year = new Date().getFullYear().toString().substring(2);
    const newId = `S${year}${studentClass}${roll}`; // e.g., S2406001
    
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

        // Initialize tuition status for the current year
        const tuitionStatus = {};
        MONTHS.forEach(month => {
            tuitionStatus[month] = { paid: false, date: null, isBreak: false };
        });

        // Write new student data (initial approval status is false)
        await set(ref(db, `students/${newId}`), {
            id: newId,
            name: name,
            class: studentClass,
            roll: roll,
            guardian: guardian,
            approved: false, // Must be approved by admin
            tuitionStatus: tuitionStatus,
            breakRequest: null, 
            registeredAt: Date.now()
        });

        studentIDDisplay.innerHTML = `Registration submitted! Your Student ID: <strong>${newId}</strong>. Please wait for admin approval.`;
        registrationForm.reset();
        
    } catch (error) {
        console.error("Registration Failed:", error);
        let errorMessage = error.message;
        if (errorMessage.includes("permission_denied")) {
            errorMessage = "Permission denied. Check Firebase Database Security Rules (must allow unauthenticated write for new students).";
        }
        studentIDDisplay.textContent = `Registration failed. Error: ${errorMessage}`;
    }
}

function resetLoginForm() { 
    if(userID) userID.value = ""; 
    const adminEmail = document.getElementById("adminEmail");
    const adminPassword = document.getElementById("adminPassword");
    if(adminEmail) adminEmail.value = ""; 
    if(adminPassword) adminPassword.value = ""; 
    if(adminLoginFields) adminLoginFields.classList.add("hidden");
}


// ====================================================================
// --- Student Panel Logic ---
// ====================================================================

function loadStudentData(studentId) {
    const studentRef = ref(db, `students/${studentId}`);
    // Real-time listener for student profile and fee updates
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
        <p><strong>Class:</strong> ${data.class.replace(/^0+/, '')}</p>
        <p><strong>Roll:</strong> ${data.roll}</p>
        <p><strong>Guardian Phone:</strong> ${data.guardian}</p>
        <p><strong>Status:</strong> <span class="status-${data.approved ? 'paid' : 'unpaid'}">${data.approved ? 'APPROVED' : 'PENDING'}</span></p>
    `;
}

function renderStudentFeeTable(tuitionStatus) {
    if (!tuitionTableBody) return;
    tuitionTableBody.innerHTML = '';

    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); 
    
    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month] || { paid: false, date: null, isBreak: false };
        let statusText = "---";
        let statusClass = "unrecorded";
        let dateText = '---'; 

        const isMonthDueOrPast = (index <= currentMonthIndex);
        
        if (data.paid) {
            statusText = `Paid`; 
            statusClass = "status-paid";
            dateText = data.date; 

        } else if (data.isBreak) {
            statusText = `Break`;
            statusClass = "status-break";
            dateText = data.date || 'Requested'; 

        } else if (isMonthDueOrPast) {
            // Month is due (current or past) and is UNPAID.
            statusText = "Unpaid";
            statusClass = "status-unpaid";
            dateText = '---'; 

        } else {
            // Month is in the future.
            statusText = "---";
            statusClass = "status-unrecorded";
            dateText = '---'; 
        }
        
        const row = tuitionTableBody.insertRow();
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${month}</td>
            <td class="px-6 py-4 whitespace-nowrap"><span class="${statusClass}">${statusText}</span></td>
            <td class="px-6 py-4 whitespace-nowrap">${dateText}</td> 
        `;
    });
}

// ====================================================================
// --- Break Request Logic (Student Side) ---
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
    
    // Find the index of the last month that was explicitly PAID or marked BREAK.
    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month];
        if (data && (data.paid === true || data.isBreak === true)) {
            lastPaidMonthIndex = index;
        }
    });

    // Earliest possible break start is the month *after* the last paid/break month.
    let earliestStartMonthIndex = lastPaidMonthIndex + 1;
    
    if (earliestStartMonthIndex >= 12) {
        breakMessage.textContent = `All months in the current academic year (${currentYear}) are already accounted for (Paid/Break).`;
        return;
    }

    const monthsRemainingInYear = 12 - earliestStartMonthIndex;
    const startMonthName = MONTHS[earliestStartMonthIndex];
    
    // Populate the Start Month Select 
    for (let i = earliestStartMonthIndex; i < 12; i++) {
        breakStartMonthSelect.add(new Option(`${MONTHS[i]} (${currentYear})`, MONTHS[i]));
    }
    
    // Populate Duration Select
    for (let i = 1; i <= monthsRemainingInYear; i++) {
        breakDurationSelect.add(new Option(`${i} month${i > 1 ? 's' : ''}`, i));
    }

    // Check for existing pending request
    const studentSnapshot = await get(ref(db, `students/${studentId}`));
    const requestStatus = studentSnapshot.val()?.breakRequest?.status;

    if (requestStatus === 'pending') {
        breakMessage.textContent = `A break request is already pending admin approval.`;
        document.getElementById('requestBreakBtn').disabled = true;
    } else {
        breakMessage.textContent = `You can request a break starting from ${startMonthName}. Max duration: ${monthsRemainingInYear} month(s).`;
        document.getElementById('requestBreakBtn').disabled = false;
    }
}

async function handleBreakRequest() {
    const selectedStartMonth = breakStartMonthSelect.value;
    const requestedMonths = parseInt(breakDurationSelect.value, 10);
    
    if (!currentLoggedInStudentId || !selectedStartMonth || isNaN(requestedMonths) || requestedMonths <= 0) {
        breakMessage.textContent = "Please select a starting month and a valid duration.";
        return;
    }

    const startMonthIndex = MONTHS.indexOf(selectedStartMonth);
    const endMonthIndex = startMonthIndex + requestedMonths - 1;
    const endMonth = MONTHS[endMonthIndex];
    
    // Custom confirm box replacement (using window.confirm here for simplicity in single file context)
    if (!window.confirm(`Confirm break request for ${requestedMonths} month(s), starting ${selectedStartMonth} and ending ${endMonth}?`)) {
        return;
    }

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
    // Only proceed if an admin is authenticated (via email/password)
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        return; 
    }
    
    const studentsRef = ref(db, "students");

    onValue(studentsRef, (snapshot) => {
        if(pendingStudentsList) pendingStudentsList.innerHTML = "";
        Object.values(classLists).forEach(list => {if(list) list.innerHTML = "";});

        if (!snapshot.exists()) return;

        const students = snapshot.val();
        const studentArray = Object.values(students);

        studentArray.forEach(student => {
            let cls = student.class;
            
            // 1. Pending students
            if (student.approved === false && pendingStudentsList) {
                const li = document.createElement("li");
                li.className = "flex justify-between items-center p-2 bg-yellow-50 rounded-lg";
                li.innerHTML = `
                    <span>${student.name} (ID: ${student.id}) - Class ${cls.replace(/^0+/, '')}</span>
                    <button class="approveBtn bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition" data-id="${student.id}">Approve</button>
                `;
                pendingStudentsList.appendChild(li);
            }

            // 2. Approved students in class tabs
            if (student.approved === true && classLists[cls]) {
                const li = document.createElement("li");
                li.textContent = `${student.name} (ID: ${student.id})`;
                li.classList.add("studentItem", "block", "p-2", "rounded-lg", "hover:bg-gray-100");
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
        // Use custom modal/prompt if needed, but alert is used here for simplicity as a placeholder
        alert(`Failed to approve student. Error: ${error.message}`); 
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
            <p><strong>Class:</strong> ${student.class.replace(/^0+/, '')}, Roll: ${student.roll}</p>
            <p><strong>Guardian:</strong> ${student.guardian}</p>
            <h3 class="text-lg font-medium mt-4">Tuition Management</h3>
        `;
        
        // --- 2. Render Break Request Management ---
        const breakRequest = student.breakRequest;
        
        if (breakRequest && breakRequest.status === 'pending') {
            if(breakRequestManagementDiv) {
                breakRequestManagementDiv.classList.remove("hidden");
                breakRequestManagementDiv.className = "mb-4 p-3 border border-orange-500 rounded-lg bg-orange-50"; 
                breakRequestManagementDiv.innerHTML = `
                    <h4 class="font-semibold text-orange-700">Pending Break Request:</h4>
                    <p class="text-sm"><strong>Status:</strong> <span class="text-orange-600">${breakRequest.status.toUpperCase()}</span></p>
                    <p class="text-sm"><strong>Details:</strong> ${breakRequest.months} month(s), starting ${breakRequest.startMonth} until ${breakRequest.endMonth}.</p>
                    <div class="flex space-x-2 mt-3">
                        <button onclick="window.approveBreak('${studentId}', '${breakRequest.startMonth}', ${breakRequest.months})" 
                                class="flex-1 bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition">Approve Break</button>
                        <button onclick="window.rejectBreak('${studentId}')" 
                                class="flex-1 bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition">Reject Request</button>
                    </div>
                `;
            }
        } else {
            if(breakRequestManagementDiv) {
                breakRequestManagementDiv.classList.remove("hidden"); 
                breakRequestManagementDiv.className = "mb-4 p-3 border rounded-lg bg-gray-50";
                const status = breakRequest ? breakRequest.status.toUpperCase() : 'None';
                breakRequestManagementDiv.innerHTML = `<p><strong>Break Request Status:</strong> ${status}</p>`;
            }
        }

        // --- 3. Render Fee Table (always runs last) ---
        renderAdminFeeTable(studentId, student.tuitionStatus);
    });
}


function renderAdminFeeTable(studentId, tuitionStatus) {
    if (!studentTuitionTableBody) return;
    studentTuitionTableBody.innerHTML = "";

    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); 

    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month] || { paid: false, date: null, isBreak: false };
        let statusText = "---";
        let statusClass = "status-unrecorded";

        const isMonthDueOrPast = (index <= currentMonthIndex);
        
        if (data.paid) {
            statusText = `Paid (${data.date})`; 
            statusClass = "status-paid";
        } else if (data.isBreak) {
            statusText = `Break (${data.date || 'Approved'})`;
            statusClass = "status-break";
        } else if (isMonthDueOrPast) {
            statusText = "Unpaid";
            statusClass = "status-unpaid";
        }
        
        const tr = studentTuitionTableBody.insertRow();
        tr.className = "hover:bg-gray-50";
        const tdMonth = tr.insertCell();
        const tdStatus = tr.insertCell();
        const tdAction = tr.insertCell();

        tdMonth.className = "px-6 py-4 whitespace-nowrap";
        tdStatus.className = "px-6 py-4 whitespace-nowrap";
        tdAction.className = "px-6 py-4 whitespace-nowrap text-sm font-medium";

        tdMonth.textContent = month;
        tdStatus.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
        
        // Inline event handlers call functions exposed on the window object
        if (data.paid || data.isBreak) {
            tdAction.innerHTML = `<button onclick="window.undoStatus('${studentId}', '${month}')" class="text-red-500 hover:text-red-700">Undo Status</button>`;
        } else {
            tdAction.innerHTML = `
                <button onclick="window.markPaid('${studentId}', '${month}')" class="text-green-500 hover:text-green-700 mr-2">Paid</button>
                <button onclick="window.markBreak('${studentId}', '${month}')" class="text-orange-500 hover:text-orange-700">Break</button>
            `;
        }
    });
}

// ====================================================================
// --- Global Admin Action Functions (MUST be window-scoped) ---
// ====================================================================

function getMonthsInRange(startMonth, count) {
    const startIndex = MONTHS.indexOf(startMonth);
    const months = [];
    for (let i = 0; i < count; i++) {
        // Use modulo 12 to handle year rollover if needed, though here we assume current academic year is sufficient.
        months.push(MONTHS[(startIndex + i) % 12]);
    }
    return months;
}

window.markPaid = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    const method = prompt(`Enter payment method for ${month} (e.g., Cash, Bank Transfer):`);
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
            alert(`Error marking paid. ${error.message}`);
        }
    }
}

window.markBreak = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    if (window.confirm(`Confirm marking ${month} as a Break month for ${studentId}?`)) {
        try {
            await update(ref(db, `students/${studentId}/tuitionStatus/${month}`), {
                paid: false, 
                isBreak: true,
                date: new Date().toLocaleDateString(),
                recordedBy: auth.currentUser.uid
            });
        } catch (error) {
            console.error(`Error marking break.`, error);
            alert(`Error marking break. ${error.message}`);
        }
    }
}

window.undoStatus = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    if (window.confirm(`Are you sure you want to UNDO the status for ${month}? This will mark it as Unrecorded/Unpaid.`)) {
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
            alert(`Error undoing status. ${error.message}`);
        }
    }
}


window.approveBreak = async function(studentId, startMonth, duration) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }

    if (!window.confirm(`Are you sure you want to APPROVE the break request for ${duration} months starting ${startMonth}?`)) {
        return;
    }
    
    // Get all months in the requested range
    const monthsToUpdate = getMonthsInRange(startMonth, duration);
    const updates = {};
    const currentDate = new Date().toLocaleDateString();

    // Set tuition status for all months in the range to isBreak: true
    monthsToUpdate.forEach(month => {
        updates[`tuitionStatus/${month}`] = {
            paid: false, 
            isBreak: true,
            date: currentDate,
            recordedBy: auth.currentUser.uid
        };
    });
    
    // Update the break request status on the student profile
    updates['breakRequest'] = { status: 'APPROVED', approvedAt: Date.now() };

    try {
        await update(ref(db, `students/${studentId}`), updates);
        alert('Break request approved and tuition status updated successfully!');
    } catch (error) {
        console.error("Error approving break request:", error);
        alert(`Failed to approve break request. Error: ${error.message}`);
    }
}

window.rejectBreak = async function(studentId) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    
    if (!window.confirm(`Are you sure you want to REJECT the pending break request for this student?`)) {
        return;
    }
    
    try {
        // Only update the request status, leaving tuition months as they were
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

// Start the setup when the entire window content is loaded
window.onload = setupEventListeners;
