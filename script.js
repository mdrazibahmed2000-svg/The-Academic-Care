// ====================================================================
// CRITICAL: Modular Imports for Firebase SDK
// ====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// RTDB Imports
import { getDatabase, ref, get, set, remove, update, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// ====================================================================
// --- Global Firebase and App Configuration (USING YOUR PROVIDED VALUES) ---
// ====================================================================

const firebaseConfig = {
    // 🛑 YOUR PROVIDED API KEYS & CONFIG 🛑
    apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8", 
    authDomain: "the-academic-care.firebaseapp.com",
    databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app", 
    projectId: "the-academic-care",
    storageBucket: "the-academic-care.firebasestorage.app",
    appId: "1:728354914429:web:9fe92ca6476baf6af2f114"
};

let app;
let db; 
let auth;
let currentUserId;
let currentStudentData = null;
let allApprovedStudents = [];

const RTDB_ROOT_PATH = ''; // Confirmed root path is empty


// Function to safely initialize Firebase and handle authentication
async function initializeAppAndAuth() {
    try {
        const config = firebaseConfig;
        app = initializeApp(config);
        db = getDatabase(app); 
        auth = getAuth(app);

        await setPersistence(auth, browserSessionPersistence);
        
        // CRITICAL: Sign in anonymously to ensure an auth.uid exists for reading/registration
        // This is essential for satisfying your security rules.
        await signInAnonymously(auth); 

        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUserId = user.uid;
                document.getElementById('authUserId').textContent = `Auth User ID: ${currentUserId}`; 
                checkLoginStatus();
            } else {
                currentUserId = null;
                showLogin();
            }
        });
    } catch (error) {
        console.error("Firebase initialization or authentication failed:", error);
        document.getElementById('loginError').textContent = `System Error: Firebase setup failed. Check console (F12) for details.`;
        showLogin(); 
    }
}

// Helper functions for RTDB References
function getStudentsRef() { return ref(db, `${RTDB_ROOT_PATH}/students`); }
function getStudentRef(studentId) { return ref(db, `${RTDB_ROOT_PATH}/students/${studentId}`); }
function getFeesRef(studentId) { return ref(db, `${RTDB_ROOT_PATH}/students/${studentId}/fees`); }
// CRITICAL: New reference for break requests
function getBreakRequestRef(studentId) { return ref(db, `${RTDB_ROOT_PATH}/breakRequests/${studentId}`); }


// ====================================================================
// --- View Switching Logic (Retained) ---
// ====================================================================

window.showLogin = function () {
    document.getElementById('loginId').value = '';
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
    document.getElementById('initialView').classList.remove('hidden');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden'); 
}

window.showRegister = function () {
    document.getElementById('regName').value = '';
    document.getElementById('regGuardianPhone').value = '';
    document.getElementById('regClass').value = '';
    document.getElementById('regRoll').value = '';
    document.getElementById('registerError').textContent = '';
    document.getElementById('initialView').classList.add('hidden');
    document.getElementById('registerView').classList.remove('hidden');
}

window.showDashboard = function (isAdmin) {
    document.getElementById('initialView').classList.add('hidden');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');

    if (isAdmin) {
        document.getElementById('studentPanel').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('welcomeHeader').textContent = 'Welcome, Admin!';
    } else {
        document.getElementById('studentPanel').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('welcomeHeader').textContent = `Welcome, ${currentStudentData ? currentStudentData.name : 'Student'}!`;
    }
}

window.toggleCollapsible = function (id) {
    const content = document.getElementById(id);
    content.classList.toggle('hidden');
}


// ====================================================================
// --- Auth and Login Logic (Retained) ---
// ====================================================================

async function checkLoginStatus() {
    const loginId = localStorage.getItem('appLoginId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (loginId) {
        if (isAdmin) {
            await initializeAdminPanel();
            showDashboard(true);
        } else {
            const studentSnapshot = await get(getStudentRef(loginId));
            
            if (studentSnapshot.exists()) {
                currentStudentData = { id: loginId, ...studentSnapshot.val() };
                await initializeStudentPanel(currentStudentData);
                showDashboard(false);
            } else {
                logout(); 
            }
        }
    } else {
        showLogin();
    }
}

window.login = async function () {
    const id = document.getElementById('loginId').value.trim();
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';

    if (!id) {
        errorElement.textContent = 'Please enter Student ID or \'admin\' to proceed.';
        return;
    }

    try {
        if (id.toLowerCase() === 'admin') {
            const adminEmail = prompt("Enter Admin Email:");
            if (!adminEmail) return;

            const adminPassword = prompt("Enter Admin Password:");
            if (!adminPassword) return;

            await handleAdminLoginWithEmail(adminEmail, adminPassword);
        } else {
            await handleStudentLogin(id);
        }
    } catch(e) {
        console.error("Login failed unexpectedly:", e);
        errorElement.textContent = `Login failed. Check internet connection or Admin setup. Error: ${e.message}`;
    }
}

async function handleAdminLoginWithEmail(email, password) {
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';
    
    try {
        await signInWithEmailAndPassword(auth, email, password);

        localStorage.setItem('appLoginId', 'admin');
        localStorage.setItem('isAdmin', 'true');
        
        await initializeAdminPanel();
        showDashboard(true);

    } catch (error) {
        console.error("Admin Email Login failed:", error);
        errorElement.textContent = `Admin Login failed. Check credentials. Error: ${error.message.replace('Firebase: Error (auth/', '').replace(')', '')}`;
    }
}

async function handleStudentLogin(studentId) {
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';

    const studentSnapshot = await get(getStudentRef(studentId));

    if (!studentSnapshot.exists()) {
        errorElement.textContent = `Student ID '${studentId}' not found. Please register.`;
        return;
    }

    const data = studentSnapshot.val();
    if (data.status === 'pending') {
        errorElement.textContent = 'Registration pending admin approval.';
        return;
    }

    currentStudentData = { id: studentId, ...data };
    localStorage.setItem('appLoginId', studentId);
    localStorage.setItem('isAdmin', 'false');
    await initializeStudentPanel(currentStudentData);
    showDashboard(false);
}

window.logout = function () {
    localStorage.removeItem('appLoginId');
    localStorage.removeItem('isAdmin');
    currentStudentData = null;
    currentUserId = null;
    signOut(auth); 
    showLogin();
}

window.registerStudent = async function () {
    const name = document.getElementById('regName').value.trim();
    const guardianPhone = document.getElementById('regGuardianPhone').value.trim();
    const studentClass = document.getElementById('regClass').value.trim();
    const studentRoll = document.getElementById('regRoll').value.trim(); 
    const errorElement = document.getElementById('registerError');
    errorElement.textContent = '';

    if (!name || !guardianPhone || !studentClass || !studentRoll) {
        errorElement.textContent = 'Please fill in all required fields.';
        return;
    }
    
    if (!/^\d{7,15}$/.test(guardianPhone)) {
        errorElement.textContent = 'Please enter a valid phone number (7-15 digits).';
        return;
    }

    const rollString = studentRoll.padStart(3, '0');
    const year = new Date().getFullYear().toString().substring(2);
    const classId = studentClass.padStart(2, '0');
    const newId = `S${year}${classId}${rollString}`; 

    try {
        const existingStudent = await get(getStudentRef(newId));
        if (existingStudent.exists()) {
            errorElement.textContent = `A student with ID ${newId} already exists. Check Roll/Class combination or contact Admin.`;
            return;
        }

        await set(getStudentRef(newId), {
            name: name,
            guardianPhone: guardianPhone,
            class: studentClass,
            roll: studentRoll,
            status: 'pending',
            id: newId, 
            registeredAt: Date.now()
        });

        alert(`Registration successful! Your Student ID is ${newId}. Please wait for admin approval.`);
        showLogin();

    } catch (e) {
        console.error("Registration failed: ", e);
        errorElement.textContent = `Registration failed. Please try again. Possible Database/Permission issue. Error: ${e.message}`;
    }
}


// ====================================================================
// --- Panel Logic (Retained) ---
// ====================================================================

async function initializeStudentPanel(studentData) {
    document.getElementById('studentIdDisplay').textContent = studentData.id; 
    document.getElementById('studentStatus').textContent = studentData.status;
    document.getElementById('studentClass').textContent = studentData.class;

    onValue(getFeesRef(studentData.id), (snapshot) => {
        const fees = snapshot.val() || {};
        renderFeeStatus(fees, document.getElementById('feeStatusList'));
    });
}

// 🛑 STUDENT FUNCTION: Break Request Button Logic 🛑
window.requestBreak = async function (studentId) {
    if (!confirm("Are you sure you want to send a break request? The admin will review this.")) {
        return;
    }
    
    try {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthKey = nextMonth.toLocaleString('en-us', { month: 'long' }).toLowerCase();
        
        // Store the request in a separate node for admin review
        await set(getBreakRequestRef(studentId), {
            requestedForMonth: nextMonthKey,
            requestedAt: Date.now(),
            status: 'pending_review',
            studentName: currentStudentData.name,
            studentId: studentId // CRITICAL: Include student ID for rule validation
        });

        alert(`Break request for ${nextMonthKey} submitted successfully! Please await admin approval.`);
        
    } catch (e) {
        // CRITICAL: Detailed error alert for debugging
        console.error("Break request failed: ", e);
        alert(`ERROR: Failed to submit break request. Please check Firebase write permissions for the Student. Details: ${e.message}`);
    }
}


async function initializeAdminPanel() {
    // RTDB Listener for pending students
    onValue(query(getStudentsRef(), orderByChild('status'), equalTo('pending')), (snapshot) => {
        const pendingDocs = [];
        snapshot.forEach(childSnapshot => {
            pendingDocs.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        renderPendingStudents(pendingDocs);
    });

    // RTDB Listener for approved students
    onValue(query(getStudentsRef(), orderByChild('status'), equalTo('approved')), (snapshot) => {
        allApprovedStudents = [];
        snapshot.forEach(childSnapshot => {
            allApprovedStudents.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        renderStudentSelector(allApprovedStudents);
    });
}

window.approveStudent = async function (studentId) {
    try {
        await update(getStudentRef(studentId), {
            status: 'approved',
            approvedBy: auth.currentUser.uid, 
            approvedAt: Date.now()
        });
    } catch (e) {
        console.error("Error approving student:", e);
        alert("Error approving student. Check Admin write permissions in Firebase rules. Error: " + e.message);
    }
}

// 🛑 ADMIN FUNCTION: Mark Paid Logic 🛑
window.markPaid = async function (studentId, monthKey, method) {
    const feeRef = ref(getFeesRef(studentId), monthKey);
    
    try {
        // Attempt the database write
        await set(feeRef, {
            status: 'paid',
            paymentMethod: method,
            paymentDate: Date.now(),
            recordedBy: auth.currentUser.uid // Use Admin's UID
        });
        
        console.log(`Successfully marked ${monthKey} for student ${studentId} as paid.`);
        
    } catch (e) {
        // CRITICAL: Detailed error alerting for debugging
        console.error("Error recording payment:", e);
        alert(`ERROR: Failed to record payment for ${monthKey}. Please check Firebase write permissions for the Admin. Details: ${e.message}`);
    }
}

window.markBreak = async function (studentId, monthKey, monthName, currentStatus) {
    const feeRef = ref(getFeesRef(studentId), monthKey);
    if (currentStatus === 'break') {
        if (!confirm(`Are you sure you want to change ${monthName}'s status back to Unpaid?`)) return;
        
        try {
            await remove(feeRef); 
        } catch (e) {
            console.error("Error unmarking break month:", e);
            alert(`ERROR: Failed to unmark break for ${monthName}. Details: ${e.message}`);
        }

    } else {
        if (!confirm(`Are you sure you want to mark ${monthName} as a break month? This will clear any existing payment data for this month.`)) return;
        try {
            await set(feeRef, {
                status: 'break',
                recordedBy: auth.currentUser.uid, 
                recordedAt: Date.now()
            });
        } catch (e) {
            console.error("Error marking break month: " + e.message);
            alert(`ERROR: Failed to mark break month for ${monthName}. Details: ${e.message}`);
        }
    }
}

// ... (Other rendering and Gemini functions retained for completeness) ...
function renderFeeStatus(fees, ulElement) {
    // ... (Code for student fee rendering)
    ulElement.innerHTML = '';
    const today = new Date();
    const currentMonthIndex = today.getMonth();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    for (let i = 0; i <= currentMonthIndex; i++) {
        const monthKey = fullMonthNames[i].toLowerCase(); 
        const monthDisplay = monthNames[i]; 
        const feeData = fees[monthKey];
        const li = document.createElement('li');
        li.classList.add('flex', 'justify-between', 'items-center', 'py-2');

        let status = 'unpaid';
        let statusClass = 'bg-red-500 hover:bg-red-600';
        let details = '';

        if (feeData) {
            status = feeData.status;
            
            if (status === 'paid') {
                statusClass = 'bg-green-500 hover:bg-green-600';
                const date = feeData.paymentDate ? new Date(feeData.paymentDate).toLocaleDateString() : 'N/A';
                details = ` (Paid: ${date})`;
            } else if (status === 'break') {
                statusClass = 'bg-yellow-500 hover:bg-yellow-600';
                details = ' (Break requested/approved)';
            }
        }
        
        const statusBadge = `<span class="px-2 py-1 rounded text-white text-xs ${statusClass} font-bold">${status.toUpperCase()}</span>`;

        li.innerHTML = `
            <div class="flex items-center space-x-3">
                <strong>${monthDisplay}</strong> 
                ${statusBadge}
                <span class="text-xs text-gray-500">${details}</span>
            </div>
        `;
        ulElement.appendChild(li);
    }
    
    ulElement.innerHTML += `
        <li class="mt-4 pt-4 border-t border-gray-200">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded w-full" onclick="requestBreak('${currentStudentData.id}')">
                Request Break for Next Month
            </button>
        </li>
    `;
}

function renderAdminFeeManagement(studentId, fees, studentData) {
    const ulElement = document.getElementById('monthlyFees');
    ulElement.innerHTML = '';
    const today = new Date();
    const currentMonthIndex = today.getMonth(); 
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    for (let i = 0; i <= currentMonthIndex; i++) {
        const monthName = monthNames[i];
        const monthKey = monthName.toLowerCase();
        const feeData = fees[monthKey];
        const li = document.createElement('li');
        li.classList.add('fee-item', 'flex', 'justify-between', 'items-center', 'p-2', 'border-b');

        let status = 'unpaid';
        let statusClass = 'status-unpaid';
        let details = '';

        if (feeData) {
            status = feeData.status;
            statusClass = `status-${status}`;
            if (status === 'paid') {
                const date = feeData.paymentDate ? new Date(feeData.paymentDate).toLocaleDateString() : 'N/A';
                details = `(Date: ${date}, Method: ${feeData.paymentMethod || 'Cash'})`;
            }
        }

        const isPaid = status === 'paid';
        const isBreak = status === 'break';

        li.innerHTML = `
            <div class="fee-info">
                <strong>${monthName}:</strong> 
                <span class="${statusClass} font-bold">${status}</span>
                <span class="fee-details text-xs text-gray-500">${details}</span>
            </div>
            <div class="fee-actions space-x-2">
                ${!isPaid ? 
                    `<button class="bg-green-500 hover:bg-green-600 text-white p-2 rounded text-sm" onclick="openPaymentModal('${studentId}', '${monthKey}', '${monthName}')">Mark Paid</button>` 
                    : ''
                }
                
                ${!isPaid ? 
                    `<button class="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded text-sm" onclick="markBreak('${studentId}', '${monthKey}', '${monthName}', '${status}')">
                        ${isBreak ? 'Unmark Break' : 'Mark Break'}
                    </button>` 
                    : ''
                }
            </div>
        `;
        ulElement.appendChild(li);
    }
}
// ... (rest of the helper functions) ...
window.onload = initializeAppAndAuth;
