import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// RTDB Imports
import { getDatabase, ref, get, set, remove, update, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// --- Global Firebase and App Configuration ---

const firebaseConfig = {
    // 🛑 REPLACE THESE WITH YOUR ACTUAL CONFIGURATION DETAILS 🛑
    apiKey: "YOUR_API_KEY_HERE", 
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "YOUR_DATABASE_URL_HERE", // e.g., https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    appId: "YOUR_APP_ID"
};

let app;
let db; 
let auth;
let currentUserId;
let currentStudentData = null;
let allApprovedStudents = [];

// 🛑 SET THIS TO MATCH YOUR RTDB CONSOLE STRUCTURE 🛑
const RTDB_ROOT_PATH = ''; // Keep as '' if 'students' and 'admins' are at the root level


// Function to safely initialize Firebase and handle authentication
async function initializeAppAndAuth() {
    try {
        const config = firebaseConfig;
        app = initializeApp(config);
        db = getDatabase(app); 
        auth = getAuth(app);

        await setPersistence(auth, browserSessionPersistence);
        
        // This is the line that requires Anonymous Auth to be ENABLED
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
        // CRITICAL: If Firebase setup fails (e.g., bad config or disabled Anonymous Auth)
        console.error("Firebase initialization or authentication failed:", error);
        document.getElementById('loginError').textContent = `System Error: Firebase setup failed. Check console (F12) and ensure config & Anonymous Auth are correct.`;
        showLogin(); 
    }
}

// Helper functions for RTDB References
function getStudentsRef() {
    return ref(db, `${RTDB_ROOT_PATH}/students`);
}
function getAdminsRef() {
    return ref(db, `${RTDB_ROOT_PATH}/admins`);
}
function getFeesRef(studentId) {
    return ref(db, `${RTDB_ROOT_PATH}/students/${studentId}/fees`);
}
function getStudentRef(studentId) {
    return ref(db, `${RTDB_ROOT_PATH}/students/${studentId}`);
}

// --- View Switching Logic ---

window.showLogin = function () {
    // Reset all form inputs and errors
    document.getElementById('loginId').value = '';
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
    
    // Show Login/Initial View
    document.getElementById('initialView').classList.remove('hidden');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
}

window.showRegister = function () {
    // Clear registration fields
    document.getElementById('regName').value = '';
    document.getElementById('regClass').value = '';
    document.getElementById('regRoll').value = '';
    document.getElementById('regGuardianPhone').value = '';
    document.getElementById('registerError').textContent = '';

    // Show Registration View
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

// --- Auth and Login Logic (RTDB) ---

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
                logout(); // Log out if local ID is invalid
            }
        }
    } else {
        showLogin();
    }
}

// FIX: Improved error handling and explicit function calls
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
            const adminPassword = prompt("Enter Admin Password:");
            if (!adminPassword) {
                errorElement.textContent = 'Admin login cancelled.';
                return;
            }
            await handleAdminLogin(adminPassword);
        } else {
            await handleStudentLogin(id);
        }
    } catch(e) {
        // Generic catch for Firebase network/permission errors during login
        console.error("Login failed unexpectedly:", e);
        errorElement.textContent = `Login failed. Check internet connection or admin setup. Error: ${e.message}`;
    }
}

async function handleAdminLogin(password) {
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';
    
    // RTDB Query: Find admin record where 'password' matches the input.
    const adminQuery = query(getAdminsRef(), orderByChild('password'), equalTo(password));
    const adminSnapshot = await get(adminQuery);

    if (!adminSnapshot.exists()) {
        errorElement.textContent = 'Invalid Admin Password.';
        return;
    }
    
    let adminFound = false;
    adminSnapshot.forEach(() => {
        adminFound = true;
    });

    if (!adminFound) {
        errorElement.textContent = 'Invalid Admin Password.';
        return;
    }

    localStorage.setItem('appLoginId', 'admin');
    localStorage.setItem('isAdmin', 'true');
    await initializeAdminPanel();
    showDashboard(true);
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

// --- Registration Logic ---

window.registerStudent = async function () {
    const name = document.getElementById('regName').value.trim();
    const guardianPhone = document.getElementById('regGuardianPhone').value.trim();
    const studentClass = document.getElementById('regClass').value.trim();
    const studentRoll = document.getElementById('regRoll').value.trim(); 
    const errorElement = document.getElementById('registerError');
    errorElement.textContent = '';

    // FIX: Stronger client-side validation for empty fields
    if (!name || !guardianPhone || !studentClass || !studentRoll) {
        errorElement.textContent = 'Please fill in all required fields (Name, Class, Roll, Phone).';
        return;
    }
    
    // Validate phone format (simple check for 7-15 digits)
    if (!/^\d{7,15}$/.test(guardianPhone)) {
        errorElement.textContent = 'Please enter a valid phone number (7-15 digits).';
        return;
    }

    // --- Create Unique Student ID based on Year, Class, and Roll ---
    const rollString = studentRoll.padStart(3, '0');
    const year = new Date().getFullYear().toString().substring(2);
    const classId = studentClass.padStart(2, '0');
    const newId = `S${year}${classId}${rollString}`; 

    try {
        // Check if a student with this generated ID already exists
        const existingStudent = await get(getStudentRef(newId));
        if (existingStudent.exists()) {
            errorElement.textContent = `A student with ID ${newId} already exists. Check Roll/Class combination or contact Admin.`;
            return;
        }

        // RTDB Set: Write the new student record
        await set(getStudentRef(newId), {
            name: name,
            guardianPhone: guardianPhone,
            class: studentClass,
            roll: studentRoll,
            status: 'pending',
            registeredAt: Date.now()
        });

        alert(`Registration successful! Your Student ID is ${newId}. Please wait for admin approval.`);
        showLogin();

    } catch (e) {
        // FIX: Explicit error for registration failure
        console.error("Registration failed: ", e);
        errorElement.textContent = `Registration failed. Please try again. Possible Database/Permission issue. Error: ${e.message}`;
    }
}

// --- Student Panel Logic and Admin Panel Logic (RTDB) ---

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
        li.classList.add('fee-item');

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

        li.innerHTML = `
            <div class="fee-info">
                <strong>${monthName}:</strong> 
                <span class="${statusClass}">${status}</span>
                <span class="fee-details">${details}</span>
            </div>
            <div class="fee-actions">
                ${!isPaid ? `<button class="mark-paid-btn" onclick="openPaymentModal('${studentId}', '${monthKey}', '${monthName}')">Mark Paid</button>` : ''}
                <button class="break-btn" onclick="markBreak('${studentId}', '${monthKey}', '${monthName}', '${status}')">Mark Break</button>
                ${status !== 'paid' ? `<button class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-sm" onclick="handleDraftCommunication('${studentId}', '${monthName}', '${status}', '${studentData.name}', '${studentData.guardianPhone}')">Draft Comm. ✨</button>` : ''}
            </div>
        `;
        ulElement.appendChild(li);
    }
}

window.openPaymentModal = function (studentId, monthKey, monthName) {
    const method = prompt(`Enter payment method for ${monthName} (e.g., Cash, Bank, Mobile Pay):`);
    if (method) {
        markPaid(studentId, monthKey, method);
    }
}

window.markPaid = async function (studentId, monthKey, method) {
    const feeRef = ref(getFeesRef(studentId), monthKey);
    try {
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
        await remove(feeRef);
    } else {
        if (!confirm(`Are you sure you want to mark ${monthName} as a break month? This will clear any existing payment data for this month.`)) return;
        try {
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

// --- Gemini API Logic and Utility Functions ---

async function fetchGeminiResponse(userQuery, systemPrompt, loaderId, responseId) {
    // 🛑 IMPORTANT: REPLACE THE EMPTY STRING WITH YOUR ACTUAL GEMINI API KEY 🛑
    const apiKey = "YOUR_GEMINI_API_KEY_HERE"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const loader = document.getElementById(loaderId);
    const responseDiv = document.getElementById(responseId);

    if (apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        responseDiv.textContent = 'Error: Gemini API key is missing. Cannot generate response.';
        return;
    }

    loader.classList.remove('hidden');
    responseDiv.textContent = 'Generating response...';

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    let response;
    let retries = 0;
    const maxRetries = 3;
    const initialDelay = 1000;

    while (retries < maxRetries) {
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Error: Could not retrieve text.';
                responseDiv.textContent = text;
                return;
            } else if (response.status === 429 || response.status >= 500) {
                if (retries < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, retries);
                    console.warn(`API call failed with status ${response.status}. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    retries++;
                    continue;
                }
            } else {
                throw new Error(`API call failed: ${response.statusText} (${response.status})`);
            }
        } catch (e) {
            console.error("Gemini API Error:", e);
            responseDiv.textContent = `Error: Failed to connect to AI assistant. (${e.message})`;
            break;
        } finally {
            if (retries === maxRetries || response?.ok) {
                loader.classList.add('hidden');
            }
        }
    }

    if (retries === maxRetries) {
        responseDiv.textContent = 'Error: API request failed after multiple retries.';
        loader.classList.add('hidden');
    }
}


window.handleStudentQuery = async function () {
    const query = document.getElementById('geminiQuery').value.trim();
    if (!query || !currentStudentData) return;

    const feeListElement = document.getElementById('feeStatusList');
    const feeContext = Array.from(feeListElement.children).map(li => li.textContent.trim()).join('; ');

    const userPrompt = `Student Profile: Name: ${currentStudentData.name}, ID: ${currentStudentData.id}, Class: ${currentStudentData.class}. Current fee status (Jan-current month): ${feeContext}. The student asks: "${query}"`;

    const systemPrompt = "Act as a helpful, professional Academic Care Fee Policy Assistant. Base your response only on the provided context or general best practices for school fee queries. Be concise and empathetic.";

    await fetchGeminiResponse(userPrompt, systemPrompt, 'geminiLoader', 'geminiResponse');
}


window.handleDraftCommunication = async function (studentId, monthName, status, studentName, guardianPhone) {
    document.getElementById('communicationModal').classList.remove('hidden');

    document.getElementById('draftedCommunication').value = '';

    const userPrompt = `Draft a professional and polite communication message (suitable for SMS or email body) for a guardian. Student Name: ${studentName}, Student ID: ${studentId}. The issue is the fee for the month of ${monthName} is currently marked as: ${status}. The guardian's phone number is: ${guardianPhone}. Use a respectful tone.`;

    const systemPrompt = "You are a school administrator drafting a polite, formal reminder or notification to a guardian regarding a student's fee status. Keep the message concise (under 5 sentences) and clear. Do not include salutations or closings, just the message body.";

    await fetchGeminiResponse(userPrompt, systemPrompt, 'communicationLoader', 'draftedCommunication');
}


// --- Utility Functions ---

window.closeModal = function () {
    document.getElementById('communicationModal').classList.add('hidden');
    document.getElementById('draftedCommunication').value = '';
    document.getElementById('communicationLoader').classList.add('hidden');
}

window.copyToClipboard = function (elementId) {
    const copyText = document.getElementById(elementId);
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    document.execCommand('copy');
    alert("Message copied to clipboard!");
}

// Initialize the app on load
window.onload = initializeAppAndAuth;
