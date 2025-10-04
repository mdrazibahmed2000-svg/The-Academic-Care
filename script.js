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

const RTDB_ROOT_PATH = ''; 


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
                document.getElementById('authUserId').textContent = `Auth User ID: ${currentUserId} (${user.isAnonymous ? 'Anonymous' : 'Password'})`; 
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

window.showRegister = function () {
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
    document.getElementById('initialView').classList.add('hidden');
    document.getElementById('registerView').classList.remove('hidden');
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
            if (auth.currentUser && auth.currentUser.email) {
                await initializeAdminPanel();
                showDashboard(true);
            } else {
                 // Force Admin re-login if only anonymous auth remains
                logout(); 
            }
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

// FIX FOR APPROVED STUDENT LOGIN ISSUE
async function handleStudentLogin(studentId) {
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';

    // 1. Fetch the student data
    const studentSnapshot = await get(getStudentRef(studentId));

    if (!studentSnapshot.exists()) {
        // If snapshot.exists() is false, it means the ID is wrong, OR the security rule denied access.
        errorElement.textContent = `Student ID '${studentId}' not found. Please register or verify the ID.`;
        return;
    }

    const data = studentSnapshot.val();
    
    // 2. Check for pending status
    if (data.status === 'pending') {
        errorElement.textContent = 'Registration pending admin approval.';
        return;
    }
    
    // 3. CRITICAL FIX: Prioritize login for approved students by bypassing the strict 'data.id' check.
    if (data.status === 'approved') {
        
        // Ensure currentStudentData is populated using the correct studentId from the path.
        currentStudentData = { id: studentId, ...data };
        
        // PROCEED TO LOGIN
        localStorage.setItem('appLoginId', studentId);
        localStorage.setItem('isAdmin', 'false');
        await initializeStudentPanel(currentStudentData);
        showDashboard(false);
        return;

    } 
    
    // 4. Fallback check (for corrupted or non-standard statuses)
    if (data.id !== studentId) {
        errorElement.textContent = 'Security check failed. Invalid login data (mismatched ID field in database record).';
        return;
    }

    // Default successful login path (for other valid future statuses)
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
    
    signOut(auth).then(() => {
        signInAnonymously(auth); 
    });
    
    showLogin();
}

window.registerStudent = async function () {
    const name = document.getElementById('regName').value.trim();
    const guardianPhone = document.getElementById('regGuardianPhone').value.trim();
    const studentClass = document.getElementById('regClass').value.trim().padStart(2, '0');
    const studentRoll = document.getElementById('regRoll').value.trim(); 
    const errorElement = document.getElementById('registerError');
    errorElement.textContent = '';

    if (!name || !guardianPhone || !studentClass || !studentRoll) {
        errorElement.textContent = 'Please fill in all required fields.';
        return;
    }
    
    const rollString = studentRoll.padStart(3, '0');
    const year = new Date().getFullYear().toString().substring(2);
    const newId = `S${year}${studentClass}${rollString}`; 

    try {
        const existingStudent = await get(getStudentRef(newId));
        if (existingStudent.exists()) {
            errorElement.textContent = `A student with ID ${newId} already exists. Check Roll/Class combination or contact Admin.`;
            return;
        }

        // CRITICAL: Ensure the 'id' field is explicitly set here for future login success
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
    if (!auth.currentUser || localStorage.getItem('isAdmin') !== 'true') {
        console.error("Admin not authenticated.");
        return;
    }

    // Listener for pending students
    onValue(query(getStudentsRef(), orderByChild('status'), equalTo('pending')), (snapshot) => {
        const pendingDocs = [];
        snapshot.forEach(childSnapshot => {
            pendingDocs.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        renderPendingStudents(pendingDocs);
    });

    // Listener for approved students (populates the selector) 
    onValue(query(getStudentsRef(), orderByChild('status'), equalTo('approved')), (snapshot) => {
        allApprovedStudents = [];
        snapshot.forEach(childSnapshot => {
            allApprovedStudents.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        renderStudentSelector(allApprovedStudents);
    });
    
    // Listener for Break Requests
    onValue(ref(db, `${RTDB_ROOT_PATH}/breakRequests`), (snapshot) => {
        const requests = [];
        snapshot.forEach(childSnapshot => {
            requests.push({ studentId: childSnapshot.key, ...childSnapshot.val() });
        });
        renderBreakRequests(requests);
    });
}

window.approveStudent = async function (studentId) {
    try {
        await update(getStudentRef(studentId), {
            status: 'approved',
            approvedBy: auth.currentUser.uid, 
            approvedAt: Date.now()
        });
        alert(`Student ${studentId} approved.`);
    } catch (e) {
        console.error("Error approving student:", e);
        alert(`ERROR: Failed to approve student. Check Admin write permissions. Error: ${e.message}`);
    }
}

window.markPaid = async function (studentId, monthKey, method) {
    const feeRef = ref(getFeesRef(studentId), monthKey);
    
    try {
        await set(feeRef, {
            status: 'paid',
            paymentMethod: method,
            paymentDate: Date.now(),
            recordedBy: auth.currentUser.uid 
        });
        
        alert(`Successfully marked ${monthKey} for student ${studentId} as paid.`);
        
    } catch (e) {
        console.error("Error recording payment:", e);
        alert(`ERROR: Failed to record payment for ${monthKey}. Details: ${e.message}`);
    }
}

window.loadMonthlyFees = function () {
    const studentId = document.getElementById('studentSelector').value;
    const feeContainer = document.getElementById('monthlyFees'); 
    const commButtonContainer = document.getElementById('draftCommButton');
    
    if (!studentId) {
        feeContainer.innerHTML = '<p class="text-gray-500">Select a student to view fees.</p>';
        commButtonContainer.innerHTML = '';
        return;
    }

    feeContainer.innerHTML = '<p class="text-gray-500">Loading fee data...</p>';
    
    commButtonContainer.innerHTML = `
        <button onclick="draftCommunication('${studentId}')" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded text-sm">
            Draft Fee Communication (AI)
        </button>
    `;

    onValue(getFeesRef(studentId), (snapshot) => {
        const fees = snapshot.val() || {};
        renderAdminFeeManagement(fees, studentId, feeContainer);
    }, (error) => {
        console.error("Failed to load monthly fees for Admin:", error);
        feeContainer.innerHTML = `<p class="text-red-500">Permission Denied: Failed to load fees. Error: ${error.message}</p>`;
    });
};

window.approveBreak = async function(studentId) {
    if (!confirm(`Confirm approval of break request for ${studentId}?`)) return;

    try {
        await remove(getBreakRequestRef(studentId));
        alert(`Break request for ${studentId} approved and removed from the list.`);
    } catch (e) {
        console.error("Error approving break:", e);
        alert(`ERROR: Failed to approve break. Details: ${e.message}`);
    }
}

// ====================================================================
// --- Student Panel Functions ---
// ====================================================================

async function initializeStudentPanel(studentData) {
    document.getElementById('studentIdDisplay').textContent = studentData.id; 
    document.getElementById('studentStatus').textContent = studentData.status;
    document.getElementById('studentClass').textContent = studentData.class;
    
    document.getElementById('welcomeHeader').textContent = `Welcome, ${studentData.name}!`;

    const feeContainer = document.getElementById('feeStatusList');
    feeContainer.innerHTML = '<p>Loading fee data...</p>';

    onValue(getFeesRef(studentData.id), (snapshot) => {
        const fees = snapshot.val() || {};
        renderFeeStatus(fees, feeContainer);
    }, (error) => {
        console.error("Failed to load monthly fees for Student:", error);
        feeContainer.innerHTML = `<p class="text-red-500">Permission Denied: Failed to load fees. Check security rules. Error: ${error.message}</p>`;
    });
    
    document.getElementById('breakRequestArea').innerHTML = `
        <button onclick="requestBreak('${studentData.id}')" class="w-full break-btn font-bold py-2 px-4 rounded mt-2">
            Request Break for Next Month
        </button>
    `;
}

window.requestBreak = async function (studentId) {
    if (!confirm("Are you sure you want to send a break request? This will be reviewed by the admin.")) {
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
        alert(`ERROR: Failed to submit break request. Details: ${e.message}`);
    }
}

// ====================================================================
// --- Gemini AI Functions (Simulated based on Policy Context) ---
// ====================================================================

const ACADEMIC_CARE_POLICY = {
    fee: "BDT 2,000",
    deadline: "5th day of the current month",
    late_fee: "BDT 100 (after the 10th)",
    payment_methods: "Cash (to Admin), Bkash (017-xxxx-xxxx), or Nagad (018-xxxx-xxxx)",
    break_policy: "Submit a break request before the 25th day of the current month for the next month. Admin approval required.",
    year: "2024"
};

window.handleStudentQuery = async function() {
    const query = document.getElementById('geminiQuery').value.toLowerCase().trim();
    const responseElement = document.getElementById('geminiResponse');
    const loader = document.getElementById('geminiLoader');
    
    if (!query) {
        responseElement.textContent = "Please enter a question to ask the assistant.";
        return;
    }

    loader.classList.remove('hidden');
    responseElement.textContent = "Analyzing query...";

    await new Promise(resolve => setTimeout(resolve, 800));

    let response = "I'm sorry, I couldn't find a specific answer for that. Please try asking about **fees**, **payment methods**, **deadlines**, or the **break policy**.";

    if (query.includes('fee') || query.includes('amount') || query.includes('cost')) {
        response = `The standard monthly tuition fee is **${ACADEMIC_CARE_POLICY.fee}**. Fees are due by the **${ACADEMIC_CARE_POLICY.deadline}**.`;
    } else if (query.includes('payment') || query.includes('pay') || query.includes('method')) {
        response = `You can pay using **${ACADEMIC_CARE_POLICY.payment_methods}**. Please ensure you get a confirmation receipt from the Admin for Cash payments.`;
    } else if (query.includes('break') || query.includes('stop') || query.includes('leave')) {
        response = `Our **break policy** states you must submit a **Break Request** through the portal *before* the **25th day of the current month** to take a break in the *following* month. Admin approval is mandatory.`;
    } else if (query.includes('status') && currentStudentData) {
        const fees = currentStudentData.fees || {};
        const unpaidMonths = getMonthKeys().filter(month => fees[month]?.status !== 'paid')
                                       .map(m => m.charAt(0).toUpperCase() + m.slice(1));
        
        if (unpaidMonths.length > 0) {
            response = `Your current status is **${currentStudentData.status}**. You appear to have unpaid fees for: **${unpaidMonths.join(', ')}**. Please prioritize settling these.`;
        } else {
            response = `Your current status is **${currentStudentData.status}**. Great news! Your fee record seems up-to-date for the currently tracked months.`;
        }
    }
    
    responseElement.innerHTML = response;
    loader.classList.add('hidden');
}

window.draftCommunication = async function(studentId) {
    const student = allApprovedStudents.find(s => s.id === studentId);
    if (!student) return;

    openModal();
    const draftArea = document.getElementById('draftedCommunication');
    const loader = document.getElementById('communicationLoader');
    loader.classList.remove('hidden');
    draftArea.value = 'Analyzing student data and drafting message...';

    const feeSnapshot = await get(getFeesRef(studentId));
    const fees = feeSnapshot.val() || {};

    const unpaidMonths = getMonthKeys().filter(month => fees[month]?.status !== 'paid')
                                       .map(m => m.charAt(0).toUpperCase() + m.slice(1));

    const breakRequestSnapshot = await get(getBreakRequestRef(studentId));
    const breakRequest = breakRequestSnapshot.val();

    let message;

    if (unpaidMonths.length > 0) {
        message = `Dear Guardian of ${student.name} (ID: ${studentId}),\n\n`;
        message += `This is a friendly reminder from The Academic Care regarding outstanding tuition fees. We show the following months are currently UNPAID: ${unpaidMonths.join(', ')}.\n\n`;
        message += `Please settle the fee of ${ACADEMIC_CARE_POLICY.fee} per month immediately to avoid disruption. Payment methods: ${ACADEMIC_CARE_POLICY.payment_methods}.\n\n`;
        message += `Thank you for your cooperation.`;
    } else {
        message = `Dear Guardian of ${student.name} (ID: ${studentId}),\n\n`;
        message += `Thank you for your prompt payment! Our records show the student's fees are completely up-to-date.\n\n`;
        if (breakRequest) {
            message += `NOTE: We have a PENDING break request on file for ${breakRequest.requestedForMonth}. Please review and approve/reject it.\n\n`;
        }
        message += `We appreciate your commitment to ${student.name}'s education.`;
    }

    loader.classList.add('hidden');
    draftArea.value = message;
}

// ====================================================================
// --- Rendering/Utility Functions ---
// ====================================================================

function getMonthKeys() {
    return ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
}

function renderPendingStudents(pendingStudents) {
    const ul = document.getElementById('pendingStudentsList');
    ul.innerHTML = '';
    const pendingCountSpan = document.getElementById('pendingCount');

    pendingCountSpan.textContent = `(${pendingStudents.length})`;

    if (pendingStudents.length === 0) {
        ul.innerHTML = '<p class="text-gray-500 text-sm p-3">No pending students</p>';
        return;
    }

    pendingStudents.forEach(data => {
        const li = document.createElement('li');
        li.classList.add('flex', 'justify-between', 'items-center', 'bg-white', 'p-3', 'mb-2', 'rounded');
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

function renderBreakRequests(requests) {
    const container = document.getElementById('breakRequestsList');
    if (!container) return;

    container.innerHTML = ''; 
    document.getElementById('breakCount').textContent = `(${requests.length})`;

    if (requests.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm p-3">No pending break requests.</p>';
        return;
    }

    requests.forEach(req => {
        const div = document.createElement('div');
        div.classList.add('flex', 'justify-between', 'items-center', 'bg-white', 'p-2', 'mb-2', 'rounded', 'shadow-sm', 'text-sm');
        div.innerHTML = `
            <div>
                <strong>${req.studentName}</strong> (${req.studentId})<br>
                <small class="text-indigo-600">Request for: ${req.requestedForMonth.charAt(0).toUpperCase() + req.requestedForMonth.slice(1)}</small>
            </div>
            <button class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-xs" onclick="approveBreak('${req.studentId}')">
                Approve Break
            </button>
        `;
        container.appendChild(div);
    });
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

    if (selectedId && document.getElementById('dashboardView').classList.contains('hidden') === false) {
        loadMonthlyFees();
    }
}

function renderFeeStatus(fees, container) {
    container.innerHTML = ''; 
    const monthKeys = getMonthKeys();
    const today = new Date();
    const currentMonth = today.toLocaleString('en-us', { month: 'long' }).toLowerCase();

    monthKeys.forEach(month => {
        const status = fees[month] && fees[month].status === 'paid' ? 'paid' : 'unpaid';
        const isCurrentMonth = month === currentMonth;

        const li = document.createElement('li');
        li.classList.add('flex', 'justify-between', 'items-center', 'py-2', 'border-b', 'border-gray-200');
        
        if (isCurrentMonth) {
            li.classList.add('bg-indigo-100', 'font-semibold', 'rounded', 'px-3');
        }
        
        li.innerHTML = `
            <span class="text-gray-800">${month.charAt(0).toUpperCase() + month.slice(1)} ${isCurrentMonth ? '✨' : ''}</span>
            <span class="px-3 py-1 rounded-full text-xs status-${status}">${status.toUpperCase()}</span>
        `;
        container.appendChild(li);
    });
}

function renderAdminFeeManagement(fees, studentId, container) {
    container.innerHTML = '';
    const monthKeys = getMonthKeys();

    monthKeys.forEach(month => {
        const status = fees[month] && fees[month].status === 'paid' ? 'paid' : 'unpaid';
        const paymentInfo = status === 'paid' ? `(Paid on ${new Date(fees[month].paymentDate).toLocaleDateString()} via ${fees[month].paymentMethod})` : '';

        const li = document.createElement('li');
        li.classList.add('bg-white', 'p-3', 'mb-2', 'rounded', 'shadow-sm', 'border-l-4', status === 'paid' ? 'border-green-500' : 'border-red-500');
        li.innerHTML = `
            <div class="font-bold text-lg">${month.charAt(0).toUpperCase() + month.slice(1)}: <span class="status-${status}">${status.toUpperCase()}</span></div>
            <small class="text-gray-500">${paymentInfo}</small>
            <div class="mt-2 space-x-2">
                ${status === 'unpaid' ? `<button class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-sm" onclick="openPaymentModal('${studentId}', '${month}')">Mark Paid</button>` : ''}
            </div>
        `;
        container.appendChild(li);
    });
}

window.openPaymentModal = function(studentId, monthKey) {
    const method = prompt(`Mark ${monthKey} as paid for ${studentId}. Enter Payment Method (e.g., Cash, Bkash, Nagad):`);
    if (method) {
        markPaid(studentId, monthKey, method);
    }
};

window.toggleCollapsible = function(id) {
    const element = document.getElementById(id);
    if (element.style.maxHeight) {
        element.style.maxHeight = null;
    } else {
        element.style.maxHeight = element.scrollHeight + "px";
    }
}

window.openModal = function() {
    document.getElementById('communicationModal').classList.remove('hidden');
}

window.closeModal = function() {
    document.getElementById('communicationModal').classList.add('hidden');
}

window.copyToClipboard = function(elementId) {
    const element = document.getElementById(elementId);
    element.select();
    element.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(element.value);
    alert('Message copied to clipboard!');
}

window.onload = initializeAppAndAuth;
