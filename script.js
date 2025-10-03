import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// RTDB Imports - Replaced Firestore
import { getDatabase, ref, get, set, remove, push, update, onValue, query, orderByChild, equalTo, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// --- Global Firebase and App Configuration ---

const firebaseConfig = {
    // 🛑 FILLED WITH YOUR DETAILS: the-academic-care 🛑
    apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8",
    authDomain: "the-academic-care.firebaseapp.com",
    databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app", // RTDB requires this URL!
    projectId: "the-academic-care",
    storageBucket: "the-academic-care.firebasestorage.app",
    messagingSenderId: "728354914429",
    appId: "1:728354914429:web:9fe92ca6476baf6af2f114"
};

let app;
let db; // Now holds the Realtime Database instance
let auth;
let currentUserId;
let currentStudentData = null;
let allApprovedStudents = [];
// RTDB typically uses simpler paths, so we'll treat 'students', 'admins', 'counters' as root children.
const appId = 'default-app-id'; // Keeping this but simplifying paths below.

// Function to safely initialize Firebase and handle authentication
async function initializeAppAndAuth() {
    try {
        const config = firebaseConfig; // Assuming global config is used
        app = initializeApp(config);
        db = getDatabase(app); // RTDB Initialization
        auth = getAuth(app);

        await setPersistence(auth, browserSessionPersistence);
        await signInAnonymously(auth); // Sign in anonymously for registration/read access

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
        document.getElementById('loginError').textContent = 'Firebase setup failed. Check console for details.';
        showLogin();
    }
}

// Helper functions for RTDB References (using simple root-level paths)
function getStudentsRef() {
    return ref(db, `students`);
}
function getAdminsRef() {
    return ref(db, `admins`);
}
function getFeesRef(studentId) {
    return ref(db, `students/${studentId}/fees`);
}
function getStudentRef(studentId) {
    return ref(db, `students/${studentId}`);
}
function getCounterRef() {
    return ref(db, `counters/studentRoll`);
}

// --- View Switching Logic (Remains the same) ---

window.showLogin = function () {
    document.getElementById('initialView').classList.remove('hidden');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('loginId').value = '';
    document.getElementById('loginError').textContent = '';
}

window.showRegister = function () {
    document.getElementById('initialView').classList.add('hidden');
    document.getElementById('registerView').classList.remove('hidden');
    document.getElementById('registerError').textContent = '';
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

// --- Auth and Login Logic (Updated for RTDB) ---

async function checkLoginStatus() {
    const loginId = localStorage.getItem('appLoginId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (loginId) {
        if (isAdmin) {
            await initializeAdminPanel();
            showDashboard(true);
        } else {
            // RTDB: Check for student existence
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
        errorElement.textContent = 'Please enter Student ID or \'admin\'.';
        return;
    }

    if (id.toLowerCase() === 'admin') {
        const adminPassword = prompt("Enter Admin Password:");
        if (!adminPassword) {
            errorElement.textContent = 'Admin login cancelled.';
            return;
        }
        await handleAdminLogin(adminPassword);
    } else {
        await handleStudentLogin(id);
    }
}

async function handleAdminLogin(password) {
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';
    
    // RTDB Query: Find admin record where 'password' matches the input.
    // NOTE: This requires the 'admins' node to be indexed on 'password' in RTDB rules for performance.
    const adminQuery = query(getAdminsRef(), orderByChild('password'), equalTo(password));
    const adminSnapshot = await get(adminQuery);

    if (!adminSnapshot.exists()) {
        errorElement.textContent = 'Invalid Admin Password.';
        console.error("Admin Login Failed: No admin record matched the password.");
        return;
    }
    
    // Since the query succeeded, an admin record exists.
    localStorage.setItem('appLoginId', 'admin');
    localStorage.setItem('isAdmin', 'true');
    await initializeAdminPanel();
    showDashboard(true);
    console.log("Admin Login Successful");
}

async function handleStudentLogin(studentId) {
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';

    // RTDB: Get student data using the studentId as the key.
    const studentSnapshot = await get(getStudentRef(studentId));

    if (!studentSnapshot.exists()) {
        errorElement.textContent = 'Invalid Student ID. Please register.';
        console.error("Student Login Failed: Student ID not found in database.");
        return;
    }

    const data = studentSnapshot.val();
    if (data.status === 'pending') {
        errorElement.textContent = 'Registration pending admin approval.';
        console.error("Student Login Failed: Status is pending.");
        return;
    }

    currentStudentData = { id: studentId, ...data };
    localStorage.setItem('appLoginId', studentId);
    localStorage.setItem('isAdmin', 'false');
    await initializeStudentPanel(currentStudentData);
    showDashboard(false);
    console.log("Student Login Successful:", studentId);
}

window.logout = function () {
    localStorage.removeItem('appLoginId');
    localStorage.removeItem('isAdmin');
    currentStudentData = null;
    currentUserId = null;
    signOut(auth);
    showLogin();
}

// --- Registration Logic (Updated for RTDB Transaction) ---

window.registerStudent = async function () {
    const name = document.getElementById('regName').value.trim();
    const guardianName = document.getElementById('regGuardianName').value.trim();
    const guardianPhone = document.getElementById('regGuardianPhone').value.trim();
    const studentClass = document.getElementById('regClass').value;
    const errorElement = document.getElementById('registerError');
    errorElement.textContent = '';

    if (!name || !guardianName || !guardianPhone || !studentClass) {
        errorElement.textContent = 'Please fill in all fields.';
        return;
    }

    try {
        // RTDB Transaction to safely increment the roll number
        const newStudentIdResult = await runTransaction(getCounterRef(), (currentData) => {
            let nextRoll = 1;
            if (currentData) {
                nextRoll = currentData.roll + 1;
            } else {
                currentData = { roll: 0 }; // Initialize if first time
            }
            // Return the updated data to be saved to the database
            return { roll: nextRoll };
        });

        if (newStudentIdResult.committed) {
            const nextRoll = newStudentIdResult.snapshot.val().roll;
            const rollString = nextRoll.toString().padStart(3, '0');
            const year = new Date().getFullYear().toString().substring(2);
            const classId = studentClass.padStart(2, '0');
            const newId = `S${year}${classId}${rollString}`;

            // RTDB Set: Write the new student record
            await set(getStudentRef(newId), {
                name: name,
                guardianName: guardianName,
                guardianPhone: guardianPhone,
                class: studentClass,
                status: 'pending',
                registeredAt: Date.now()
            });

            alert(`Registration successful! Your Student ID is ${newId}. Please wait for admin approval.`);
            showLogin();
        } else {
            throw new Error("Counter transaction failed to commit.");
        }

    } catch (e) {
        console.error("Registration failed: ", e);
        errorElement.textContent = 'Registration failed. Please try again.';
    }
}

// --- Student Panel Logic (Updated for RTDB) ---

async function initializeStudentPanel(studentData) {
    document.getElementById('studentIdDisplay').textContent = studentData.id;
    document.getElementById('studentStatus').textContent = studentData.status;
    document.getElementById('studentClass').textContent = studentData.class;

    // RTDB Listener: Use onValue for real-time updates
    onValue(getFeesRef(studentData.id), (snapshot) => {
        const fees = snapshot.val() || {};
        renderFeeStatus(fees, document.getElementById('feeStatusList'));
    });
}

// renderFeeStatus function is mostly data processing and remains the same
function renderFeeStatus(fees, ulElement) {
    ulElement.innerHTML = '';
    const today = new Date();
    const currentMonthIndex = today.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    for (let i = 0; i <= currentMonthIndex; i++) {
        const monthKey = monthNames[i].toLowerCase();
        const feeData = fees[monthKey];
        const li = document.createElement('li');
        li.classList.add('flex', 'justify-between', 'items-center');

        let status = 'unpaid';
        let statusClass = 'status-unpaid';
        let details = '';

        if (feeData) {
            status = feeData.status;
            statusClass = `status-${status}`;
            if (status === 'paid') {
                const date = feeData.paymentDate ? new Date(feeData.paymentDate).toLocaleDateString() : 'N/A';
                details = ` (Date: ${date}, Method: ${feeData.paymentMethod || 'Cash'})`;
            }
        }

        li.innerHTML = `
            <div>
                <strong>${monthNames[i]}:</strong> 
                <span class="${statusClass}">${status}</span>
                <span class="text-xs text-gray-500">${details}</span>
            </div>
        `;
        ulElement.appendChild(li);
    }
}

// --- Admin Panel Logic (Updated for RTDB) ---

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

function renderPendingStudents(pendingStudents) {
    const ul = document.getElementById('pendingStudentsList');
    ul.innerHTML = '';
    const pendingCountSpan = document.getElementById('pendingCount');

    pendingCountSpan.textContent = `(${pendingStudents.length})`;

    if (pendingStudents.length === 0) {
        ul.innerHTML = '<p class="text-gray-500">No pending students</p>';
        return;
    }

    pendingStudents.forEach(data => {
        const li = document.createElement('li');
        li.classList.add('flex', 'justify-between', 'items-center', 'bg-white', 'p-3', 'mb-2');
        li.innerHTML = `
            <div>
                <strong>${data.name}</strong> (ID: ${data.id})<br>
                <small>Class: ${data.class}, Phone: ${data.guardianPhone}</small>
            </div>
            <button class="bg-green-500 hover:bg-green-600 text-white p-2 rounded text-sm" onclick="approveStudent('${data.id}')">Approve</button>
        `;
        ul.appendChild(li);
    });
}

window.approveStudent = async function (studentId) {
    try {
        // RTDB Update: Update only the 'status' field
        await update(getStudentRef(studentId), {
            status: 'approved',
            approvedBy: currentUserId,
            approvedAt: Date.now()
        });
    } catch (e) {
        console.error("Error approving student:", e);
    }
}

// renderStudentSelector remains the same (handles local array)
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

window.loadMonthlyFees = async function () {
    const studentId = document.getElementById('studentSelector').value;
    const ulElement = document.getElementById('monthlyFees');
    ulElement.innerHTML = '';

    if (!studentId) return;

    const studentData = allApprovedStudents.find(s => s.id === studentId);

    // RTDB Listener for fees
    onValue(getFeesRef(studentId), (snapshot) => {
        const fees = snapshot.val() || {};
        renderAdminFeeManagement(studentId, fees, studentData);
    });
}

// renderAdminFeeManagement remains the same

window.openPaymentModal = function (studentId, monthKey, monthName) {
    const method = prompt(`Enter payment method for ${monthName} (e.g., Cash, Bank, Mobile Pay):`);
    if (method) {
        markPaid(studentId, monthKey, method);
    }
}

window.markPaid = async function (studentId, monthKey, method) {
    const feeRef = ref(getFeesRef(studentId), monthKey);
    try {
        // RTDB Set: Writes the new fee record
        await set(feeRef, {
            status: 'paid',
            paymentMethod: method,
            paymentDate: Date.now(),
            recordedBy: currentUserId
        });
    } catch (e) {
        console.error("Error recording payment: " + e.message);
        alert("Error recording payment: " + e.message);
    }
}

window.markBreak = async function (studentId, monthKey, monthName, currentStatus) {
    const feeRef = ref(getFeesRef(studentId), monthKey);
    if (currentStatus === 'break') {
        if (!confirm(`Are you sure you want to change ${monthName}'s status back to Unpaid?`)) return;
        await remove(feeRef); // RTDB Remove
    } else {
        if (!confirm(`Are you sure you want to mark ${monthName} as a break month? This will clear any existing payment data for this month.`)) return;
        try {
            // RTDB Set: Sets the status to 'break'
            await set(feeRef, {
                status: 'break',
                recordedBy: currentUserId,
                recordedAt: Date.now()
            });
        } catch (e) {
            console.error("Error marking break month: " + e.message);
            alert("Error marking break month: " + e.message);
        }
    }
}

// --- Gemini API Logic and Utility Functions (Not dependent on database type, so they remain the same) ---

// ... (fetchGeminiResponse, handleStudentQuery, handleDraftCommunication, closeModal, copyToClipboard functions go here) ...
// NOTE: Remember to insert your Gemini API Key in fetchGeminiResponse!

// Initialize the app on load
window.onload = initializeAppAndAuth;
