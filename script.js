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
        
        // CRITICAL: Sign in anonymously to ensure an auth.uid exists for read/write permissions
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
function getBreakRequestRef(studentId) { return ref(db, `${RTDB_ROOT_PATH}/breakRequests/${studentId}`); }


// ====================================================================
// --- Login and Registration Logic ---
// ====================================================================

window.showLogin = function () {
    document.getElementById('loginId').value = '';
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
    document.getElementById('initialView').classList.remove('hidden');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden'); 
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
        // This is where a PERMISSION_DENIED on the initial admin/student login often shows up
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
    
    // ... (Validation logic for phone/ID generation retained) ...
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
        errorElement.textContent = `Registration failed. Possible Database/Permission issue. Error: ${e.message}`;
    }
}

// ====================================================================
// --- Admin Panel Functions ---
// ====================================================================

async function initializeAdminPanel() {
    // RTDB Listener for pending students
    onValue(query(getStudentsRef(), orderByChild('status'), equalTo('pending')), (snapshot) => {
        const pendingDocs = [];
        snapshot.forEach(childSnapshot => {
            pendingDocs.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        renderPendingStudents(pendingDocs);
    });

    // RTDB Listener for approved students - this populates the selector list
    onValue(query(getStudentsRef(), orderByChild('status'), equalTo('approved')), (snapshot) => {
        allApprovedStudents = [];
        snapshot.forEach(childSnapshot => {
            allApprovedStudents.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        // CRITICAL: Ensure this is called even if the list is empty, 
        // as the list might fail to load due to rules
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
        alert(`ERROR: Failed to approve student. Check Admin write permissions in Firebase rules. Error: ${e.message}`);
    }
}

// 🛑 FIX: Robust markPaid function 🛑
window.markPaid = async function (studentId, monthKey, method) {
    const feeRef = ref(getFeesRef(studentId), monthKey);
    
    try {
        await set(feeRef, {
            status: 'paid',
            paymentMethod: method,
            paymentDate: Date.now(),
            recordedBy: auth.currentUser.uid 
        });
        
        console.log(`Successfully marked ${monthKey} for student ${studentId} as paid.`);
        
    } catch (e) {
        console.error("Error recording payment:", e);
        alert(`ERROR: Failed to record payment for ${monthKey}. Please check Firebase write permissions for the Admin. Details: ${e.message}`);
    }
}


// ====================================================================
// --- Student Panel Functions ---
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

// 🛑 FIX: Robust requestBreak function 🛑
window.requestBreak = async function (studentId) {
    if (!confirm("Are you sure you want to send a break request? The admin will review this.")) {
        return;
    }
    
    try {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthKey = nextMonth.toLocaleString('en-us', { month: 'long' }).toLowerCase();
        
        await set(getBreakRequestRef(studentId), {
            requestedForMonth: nextMonthKey,
            requestedAt: Date.now(),
            status: 'pending_review',
            studentName: currentStudentData.name,
            studentId: studentId 
        });

        alert(`Break request for ${nextMonthKey} submitted successfully! Please await admin approval.`);
        
    } catch (e) {
        console.error("Break request failed: ", e);
        alert(`ERROR: Failed to submit break request. Please check Firebase write permissions for the Student. Details: ${e.message}`);
    }
}

// ... (Rendering functions like renderFeeStatus, renderAdminFeeManagement, etc. are omitted for brevity but remain in the full working code) ...
function renderStudentSelector(students) {
    const selector = document.getElementById('studentSelector');
    const selectedId = selector.value; 
    selector.innerHTML = '<option value="">Select Student...</option>';

    students.sort((a, b) => a.name.localeCompare(b.name)).forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (ID: ${student.id})`;
        if (student.id === selectedId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    if (selectedId) {
        loadMonthlyFees();
    }
}

window.onload = initializeAppAndAuth;
