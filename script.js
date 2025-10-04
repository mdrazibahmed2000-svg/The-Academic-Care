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
let currentAdminViewStudentId = null; // For tracking the student in Admin Detail view

// DOM Elements (IDs are based on your provided HTML structure)
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
const breakMonthsInput = document.getElementById("breakMonths");
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
    document.getElementById('requestBreakBtn').addEventListener('click', handleBreakRequest);

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
        // Automatically load and display the Pending Students list on Admin panel entry
        loadAdminData(); 
        handleAdminTabChange({ target: document.querySelector('.tabBtn[data-tab="pending"]') });
    } else if (targetPanel === studentPanel) {
        // Load initial student data on panel entry
        if (currentLoggedInStudentId) {
            loadStudentData(currentLoggedInStudentId);
        }
    }
}

function toggleStudentPanelContent(contentSection) {
    [profileSection, tuitionSection, breakSection].forEach(section => {
        section.classList.add("hidden");
    });
    contentSection.classList.remove("hidden");
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
    
    // Only load data if it's a class tab
    if (tabName.startsWith('class')) {
        // Data is already loaded by loadAdminData, just show the list
    }
}

// ====================================================================
// --- Login/Logout/Registration ---
// ====================================================================

async function handleLogin() {
    const id = userID.value.trim();
    if (!id) { messageDiv.textContent = 'Please enter ID or "admin"'; return; }

    if (id.toLowerCase() === 'admin') {
        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;
        if (!email || !password) { messageDiv.textContent = "Enter admin email/password"; return; }
        
        try {
            // Attempt Admin login (Password authentication)
            await signInWithEmailAndPassword(auth, email, password);
            showPanel(adminPanel);
        } catch (e) { 
            messageDiv.textContent = `Admin login failed: ${e.message.replace('Firebase: Error (auth/', '').replace(')', '')}`; 
        }
        
    } else {
        // Student Login
        try {
            const studentRef = ref(db, `students/${id}`);
            const snapshot = await get(studentRef);

            if (!snapshot.exists()) {
                messageDiv.textContent = `Student ID ${id} not found.`;
                return;
            }

            const data = snapshot.val();
            if (data.approved !== true) {
                messageDiv.textContent = 'Registration pending admin approval.';
                return;
            }

            // Student is approved. Set the user ID for the session.
            currentLoggedInStudentId = id;
            // NOTE: In a production app, you would need to implement a secure student-specific authentication flow here, 
            // e.g., using a separate student password/PIN stored securely, or Firebase Custom Tokens. 
            // For this project structure, we rely on the simple check and the security rules.
            
            showPanel(studentPanel);

        } catch (e) {
            messageDiv.textContent = `Login failed. Error: ${e.message}`;
        }
    }
    resetLoginForm();
}

async function handleLogout() {
    currentLoggedInStudentId = null;
    currentAdminViewStudentId = null;

    // Check if an authenticated user exists (Admin)
    if (auth.currentUser && auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        await signOut(auth);
        messageDiv.textContent = "Admin logged out successfully";
    } else {
        // Student/Anonymous logout
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

        // Initialize tuition status for 12 months (crucial for future break/fee logic)
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
            approved: false, // Key field for admin approval
            tuitionStatus: tuitionStatus,
            breakRequested: 0,
            registeredAt: Date.now()
        });

        studentIDDisplay.textContent = `Registration submitted! Your Student ID is: ${newId}. Please wait for admin approval.`;
        registrationForm.reset();
        
    } catch (error) {
        studentIDDisplay.textContent = `Registration failed. Error: ${error.message}`;
    }
}

function resetLoginForm() { 
    userID.value = ""; 
    document.getElementById("adminEmail").value = ""; 
    document.getElementById("adminPassword").value = ""; 
    adminLoginFields.classList.add("hidden");
    messageDiv.textContent = ""; 
}


// ====================================================================
// --- Student Panel Logic ---
// ====================================================================

function loadStudentData(studentId) {
    const studentRef = ref(db, `students/${studentId}`);
    // Use onValue for real-time profile/fee updates
    onValue(studentRef, (snapshot) => {
        const studentData = snapshot.val();
        if (!studentData) {
            handleLogout(); // Student record deleted
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

async function handleBreakRequest() {
    const requestedMonths = parseInt(breakMonthsInput.value, 10);
    
    if (!currentLoggedInStudentId || isNaN(requestedMonths) || requestedMonths <= 0) {
        breakMessage.textContent = "Please enter a valid number of months.";
        return;
    }

    // 1. Fetch current tuition status
    const snapshot = await get(ref(db, `students/${currentLoggedInStudentId}/tuitionStatus`));
    const tuitionStatus = snapshot.val() || {};

    const currentMonthIndex = new Date().getMonth(); // 0 (Jan) to 11 (Dec)
    const currentYear = new Date().getFullYear();

    let lastPaidOrUnpaidIndex = -1; 
    
    // 2. Find the index of the last month that has a payment status (paid/unpaid)
    // NOTE: This logic assumes 'unpaid' means the month is actively being tracked.
    MONTHS.forEach((month, index) => {
        const data = tuitionStatus[month];
        if (data && (data.paid === true || data.paid === false)) {
            lastPaidOrUnpaidIndex = index;
        }
    });

    // 3. Determine the starting month for the break
    // The break must start AFTER the latest of (Last Recorded Month) or (Current Month).
    let startMonthIndex = Math.max(lastPaidOrUnpaidIndex, currentMonthIndex) + 1;
    
    if (startMonthIndex >= 12) {
        breakMessage.textContent = "All months in the current academic year are already accounted for. Cannot request a break now.";
        return;
    }

    const startMonth = MONTHS[startMonthIndex];
    const monthsRemainingInYear = 12 - startMonthIndex;
    
    if (requestedMonths > monthsRemainingInYear) {
        breakMessage.textContent = `A break request of ${requestedMonths} months is too long. Max request is ${monthsRemainingInYear} months (up to December).`;
        return;
    }
    
    const endMonthIndex = startMonthIndex + requestedMonths - 1;
    const endMonth = MONTHS[endMonthIndex];

    const confirmationMessage = 
        `Confirm break request for ${requestedMonths} month(s), starting ${startMonth} and ending ${endMonth} (${currentYear})?`;

    if (!confirm(confirmationMessage)) {
        return;
    }

    // 4. Update the database with the break request details
    try {
        await update(ref(db, `students/${currentLoggedInStudentId}`), {
            breakRequest: {
                months: requestedMonths,
                startMonth: startMonth,
                endMonth: endMonth,
                requestedAt: Date.now(),
                status: 'pending' // Admin must approve this separately
            }
        });
        breakMessage.textContent = `Break request for ${requestedMonths} months (starting ${startMonth}) submitted successfully. Wait for admin approval.`;
        breakMonthsInput.value = '';
    } catch (error) {
        breakMessage.textContent = `Request failed. Error: ${error.message}`;
    }
}


// ====================================================================
// --- Admin Panel Logic ---
// ====================================================================

function loadAdminData() {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        // Data should not load if not Admin, but security rules are the primary block
        return; 
    }
    
    const studentsRef = ref(db, "students");

    // Use onValue for real-time updates across all Admin lists
    onValue(studentsRef, (snapshot) => {
        // Clear all lists
        pendingStudentsList.innerHTML = "";
        Object.values(classLists).forEach(list => list.innerHTML = "");

        if (!snapshot.exists()) return;

        const students = snapshot.val();

        Object.values(students).forEach(student => {
            let cls = student.class;
            
            // 1. Pending students (approved: false)
            if (student.approved === false) {
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
        pendingStudentsList.innerHTML = `<li>Error loading data. Check security rules and console.</li>`;
    });
}

async function handleApproveStudent(e) {
    if (!e.target.classList.contains("approveBtn")) return;
    
    // Check for Admin status again before write (defense in depth)
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    
    const studentID = e.target.dataset.id;
    try {
        await update(ref(db, `students/${studentID}`), {
            approved: true,
            approvedBy: auth.currentUser.uid,
            approvedAt: Date.now()
        });
        alert(`Student ${studentID} approved and moved to class list.`);
        // loadAdminData listener handles the UI refresh automatically
    } catch (error) {
        alert(`Failed to approve student. Check Security Rules: ${error.message}`);
    }
}

function handleViewStudentDetail(e) {
    if (!e.target.classList.contains("studentItem")) return;
    const studentID = e.target.dataset.id;
    currentAdminViewStudentId = studentID;
    
    // Switch to Student Detail tab
    document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("active"));
    const detailTabBtn = document.querySelector('.tabBtn[data-tab="studentDetail"]');
    if (detailTabBtn) detailTabBtn.classList.add("active");

    document.querySelectorAll(".tabContent").forEach(c => c.classList.add("hidden"));
    document.getElementById("studentDetail").classList.remove("hidden");
    
    // Load data for detail view
    loadStudentDetailData(studentID);
}

function loadStudentDetailData(studentId) {
    const studentRef = ref(db, `students/${studentId}`);
    
    // Use onValue for real-time updates on this specific student's record
    onValue(studentRef, (snapshot) => {
        const student = snapshot.val();
        if (!student) {
            studentInfoDiv.innerHTML = "Student not found.";
            studentTuitionTableBody.innerHTML = "";
            return;
        }
        
        // Render Info
        studentInfoDiv.innerHTML = `
            <p><strong>Name:</strong> ${student.name} (ID: ${student.id})</p>
            <p><strong>Class:</strong> ${student.class}, Roll: ${student.roll}</p>
            <p><strong>Guardian:</strong> ${student.guardian}</p>
            <p><strong>Break Requested:</strong> ${student.breakRequested} month(s)</p>
        `;

        // Render Fee Table
        renderAdminFeeTable(studentId, student.tuitionStatus);
    });
}


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
        
        // Action Buttons
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

// Global functions for Admin actions (must be window-scoped)
window.markPaid = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    const method = prompt(`Enter payment method for ${month}:`);
    if (method) {
        try {
            await update(ref(db, `students/${studentId}/tuitionStatus/${month}`), {
                paid: true,
                date: new Date().toLocaleDateString(),
                method: method,
                recordedBy: auth.currentUser.uid
            });
            // UI will update automatically
        } catch (error) {
            alert(`Error marking paid. Check Security Rules: ${error.message}`);
        }
    }
}

window.markBreak = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    if (confirm(`Confirm marking ${month} as a Break month for ${studentId}?`)) {
        try {
            await update(ref(db, `students/${studentId}/tuitionStatus/${month}`), {
                paid: false, // Mark as unpaid/break status
                isBreak: true,
                date: new Date().toLocaleDateString(),
                recordedBy: auth.currentUser.uid
            });
            // UI will update automatically
        } catch (error) {
            alert(`Error marking break. Check Security Rules: ${error.message}`);
        }
    }
}

window.undoStatus = async function(studentId, month) {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Admin password authentication required.");
        return;
    }
    if (confirm(`Are you sure you want to UNDO the status for ${month}? This will revert it to UNPAID.`)) {
        try {
            // Revert status to initial UNPAID state
            await update(ref(db, `students/${studentId}/tuitionStatus/${month}`), {
                paid: false,
                date: null,
                method: null,
                isBreak: false,
                recordedBy: null
            });
            // UI will update automatically
        } catch (error) {
            alert(`Error undoing status. Check Security Rules: ${error.message}`);
        }
    }
}

// ====================================================================
// --- Script Start ---
// ====================================================================
window.onload = setupEventListeners;
