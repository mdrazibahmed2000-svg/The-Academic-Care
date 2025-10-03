import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, runTransaction, FieldValue, Timestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Firebase and App Configuration ---

const firebaseConfig = {
    // IMPORTANT: REPLACE THESE WITH YOUR ACTUAL FIREBASE CONFIGURATION IF __firebase_config IS NOT PROVIDED
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let app;
let db;
let auth;
let currentUserId;
let currentStudentData = null;
let allApprovedStudents = [];
// Use the mandatory global variable __app_id for the Firestore path
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Function to safely initialize Firebase and handle authentication
async function initializeAppAndAuth() {
    try {
        // Use the mandatory global variable __firebase_config
        const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
        app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('Debug');

        // Set persistence to session to prevent immediate logout on refresh
        await setPersistence(auth, browserSessionPersistence);

        // Check if an initial token is available for sign-in
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        if (initialAuthToken) {
            // Use the mandatory global variable __initial_auth_token
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            // Sign in anonymously if no custom token is provided
            await signInAnonymously(auth);
        }

        // Setup Auth State Listener
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUserId = user.uid;
                document.getElementById('authUserId').textContent = `Auth User ID: ${currentUserId}`;
                // Now that we have a user, check if they are logged into the app logic
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

// Helper to determine the Firestore collection path
function getStudentsCollectionRef() {
    // Public data storage path: /artifacts/{appId}/public/data/students
    return collection(db, `artifacts/${appId}/public/data/students`);
}
function getAdminsCollectionRef() {
    // Public data storage path: /artifacts/{appId}/public/data/admins
    return collection(db, `artifacts/${appId}/public/data/admins`);
}
function getFeesCollectionRef(studentId) {
    // Public data storage path for subcollection: /artifacts/{appId}/public/data/students/{studentId}/fees
    return collection(db, `artifacts/${appId}/public/data/students/${studentId}/fees`);
}

// --- View Switching Logic ---

function showLogin() {
    document.getElementById('initialView').classList.remove('hidden');
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginId').value = '';
}

function showRegister() {
    document.getElementById('initialView').classList.add('hidden');
    document.getElementById('registerView').classList.remove('hidden');
}

function showDashboard(isAdmin) {
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

window.toggleCollapsible = function(id) {
    const content = document.getElementById(id);
    content.classList.toggle('hidden');
}

// --- Auth and Login Logic ---

async function checkLoginStatus() {
    // This checks local storage for persistent login information (student ID or 'admin')
    const loginId = localStorage.getItem('appLoginId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (loginId) {
        if (isAdmin) {
            await initializeAdminPanel();
            showDashboard(true);
        } else {
            // Check if the student ID is still valid in Firestore
            const studentDoc = await getDoc(doc(getStudentsCollectionRef(), loginId));
            if (studentDoc.exists()) {
                currentStudentData = { id: studentDoc.id, ...studentDoc.data() };
                await initializeStudentPanel(currentStudentData);
                showDashboard(false);
            } else {
                // If ID is stored but doc is deleted, force logout
                logout();
            }
        }
    } else {
        showLogin();
    }
}

window.login = async function() {
    const id = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';

    if (!id) {
        errorElement.textContent = 'Please enter Student ID or \'admin\'.';
        return;
    }

    if (id.toLowerCase() === 'admin') {
        await handleAdminLogin(password);
    } else {
        await handleStudentLogin(id);
    }
}

async function handleAdminLogin(password) {
    const errorElement = document.getElementById('loginError');
    
    // Query the admins collection for the password
    const adminQuery = query(getAdminsCollectionRef(), where("password", "==", password));
    const adminSnapshot = await getDocs(adminQuery);

    if (adminSnapshot.empty) {
        errorElement.textContent = 'Invalid Admin Password.';
        return;
    }

    // Admin authenticated - Store identity locally
    localStorage.setItem('appLoginId', 'admin');
    localStorage.setItem('isAdmin', 'true');
    await initializeAdminPanel();
    showDashboard(true);
}

async function handleStudentLogin(studentId) {
    const errorElement = document.getElementById('loginError');
    const studentDoc = await getDoc(doc(getStudentsCollectionRef(), studentId));

    if (!studentDoc.exists()) {
        errorElement.textContent = 'Invalid Student ID. Please register.';
        return;
    }

    const data = studentDoc.data();
    if (data.status === 'pending') {
        errorElement.textContent = 'Registration pending admin approval.';
        return;
    }

    // Student authenticated - Store identity locally
    currentStudentData = { id: studentDoc.id, ...data };
    localStorage.setItem('appLoginId', studentId);
    localStorage.setItem('isAdmin', 'false');
    await initializeStudentPanel(currentStudentData);
    showDashboard(false);
}

window.logout = function() {
    localStorage.removeItem('appLoginId');
    localStorage.removeItem('isAdmin');
    currentStudentData = null;
    currentUserId = null;
    signOut(auth); // Clear Firebase session
    showLogin();
}

// --- Registration Logic ---

window.registerStudent = async function() {
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
        // Use a transaction to safely generate and set the next roll number and Student ID
        const newStudentId = await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, `artifacts/${appId}/public/data/counters`, 'studentRoll');
            const counterDoc = await transaction.get(counterRef);
            
            let nextRoll = 1;
            if (counterDoc.exists()) {
                nextRoll = counterDoc.data().roll + 1;
            }
            
            const rollString = nextRoll.toString().padStart(3, '0');
            
            // Format ID: S + Year (last 2 digits) + Class (2 digits) + Roll (3 digits)
            const year = new Date().getFullYear().toString().substring(2);
            const classId = studentClass.padStart(2, '0');
            const newId = `S${year}${classId}${rollString}`;
            
            // 1. Update the counter
            transaction.set(counterRef, { roll: nextRoll }, { merge: true });

            // 2. Create the new student document with pending status
            const studentRef = doc(getStudentsCollectionRef(), newId);
            transaction.set(studentRef, {
                name: name,
                guardianName: guardianName,
                guardianPhone: guardianPhone,
                class: studentClass,
                status: 'pending', // Requires Admin approval
                registeredAt: Timestamp.now()
            });
            
            return newId;
        });

        // Use custom message box instead of alert() in production app, but alert used here for simplicity
        alert(`Registration successful! Your Student ID is ${newStudentId}. Please wait for admin approval.`);
        showLogin();

    } catch (e) {
        console.error("Registration failed: ", e);
        errorElement.textContent = 'Registration failed. Please try again.';
    }
}

// --- Student Panel Logic ---

async function initializeStudentPanel(studentData) {
    document.getElementById('studentIdDisplay').textContent = studentData.id;
    document.getElementById('studentStatus').textContent = studentData.status;
    document.getElementById('studentClass').textContent = studentData.class;
    
    // Listen for real-time updates on fee status
    onSnapshot(getFeesCollectionRef(studentData.id), (snapshot) => {
        const fees = {};
        snapshot.docs.forEach(doc => {
            fees[doc.id] = doc.data();
        });
        renderFeeStatus(fees, document.getElementById('feeStatusList'));
    });
}

function renderFeeStatus(fees, ulElement) {
    ulElement.innerHTML = '';
    const today = new Date();
    const currentMonthIndex = today.getMonth(); // 0 (Jan) to 11 (Dec)
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
                const date = feeData.paymentDate ? feeData.paymentDate.toDate().toLocaleDateString() : 'N/A';
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

// --- Admin Panel Logic ---

async function initializeAdminPanel() {
    // 1. Setup real-time listeners for all necessary data
    // Fetch pending registrations
    onSnapshot(query(getStudentsCollectionRef(), where("status", "==", "pending")), (snapshot) => {
        renderPendingStudents(snapshot.docs);
    });

    // Fetch all approved students for the selector
    onSnapshot(query(getStudentsCollectionRef(), where("status", "==", "approved")), (snapshot) => {
        allApprovedStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStudentSelector(allApprovedStudents);
    });
}

function renderPendingStudents(pendingDocs) {
    const ul = document.getElementById('pendingStudentsList');
    ul.innerHTML = '';
    const pendingCountSpan = document.getElementById('pendingCount');
    
    pendingCountSpan.textContent = `(${pendingDocs.length})`;

    if (pendingDocs.length === 0) {
        ul.innerHTML = '<p class="text-gray-500">No pending students</p>';
        return;
    }

    pendingDocs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const li = document.createElement('li');
        li.classList.add('flex', 'justify-between', 'items-center', 'bg-white', 'p-3', 'mb-2');
        li.innerHTML = `
            <div>
                <strong>${data.name}</strong> (ID: ${docSnapshot.id})<br>
                <small>Class: ${data.class}, Phone: ${data.guardianPhone}</small>
            </div>
            <button class="bg-green-500 hover:bg-green-600 text-white p-2 rounded text-sm" onclick="approveStudent('${docSnapshot.id}')">Approve</button>
        `;
        ul.appendChild(li);
    });
}

window.approveStudent = async function(studentId) {
    try {
        await updateDoc(doc(getStudentsCollectionRef(), studentId), {
            status: 'approved',
            approvedBy: currentUserId,
            approvedAt: Timestamp.now()
        });
    } catch (e) {
        console.error("Error approving student:", e);
    }
}

function renderStudentSelector(students) {
    const selector = document.getElementById('studentSelector');
    const selectedId = selector.value;
    selector.innerHTML = '<option value="">Select Student...</option>';
    
    // Sort students alphabetically by name
    students.sort((a, b) => a.name.localeCompare(b.name)).forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (ID: ${student.id})`;
        if (student.id === selectedId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });
    // Reload fees if a student was previously selected
    if (selectedId) {
        loadMonthlyFees();
    }
}

window.loadMonthlyFees = async function() {
    const studentId = document.getElementById('studentSelector').value;
    const ulElement = document.getElementById('monthlyFees');
    ulElement.innerHTML = '';

    if (!studentId) return;

    // Find student data to pass guardian details to communication tool
    const studentData = allApprovedStudents.find(s => s.id === studentId);
    
    // Listen for real-time updates on fee status for the selected student
    onSnapshot(getFeesCollectionRef(studentId), (snapshot) => {
        const fees = {};
        snapshot.docs.forEach(doc => {
            fees[doc.id] = doc.data();
        });
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
                const date = feeData.paymentDate ? feeData.paymentDate.toDate().toLocaleDateString() : 'N/A';
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
                ${status !== 'paid' ? `<button class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-sm" onclick="handleDraftCommunication('${studentId}', '${monthName}', '${status}', '${studentData.guardianName}', '${studentData.guardianPhone}')">Draft Comm. ✨</button>` : ''}
            </div>
        `;
        ulElement.appendChild(li);
    }
}

window.openPaymentModal = function(studentId, monthKey, monthName) {
    // We use prompt here as a stand-in for a custom modal, since alert/confirm are preferred to be replaced.
    const method = prompt(`Enter payment method for ${monthName} (e.g., Cash, Bank, Mobile Pay):`);
    if (method) {
        markPaid(studentId, monthKey, method);
    }
}

window.markPaid = async function(studentId, monthKey, method) {
    const feeRef = doc(getFeesCollectionRef(studentId), monthKey);
    try {
        await setDoc(feeRef, {
            status: 'paid',
            paymentMethod: method,
            paymentDate: Timestamp.now(),
            recordedBy: currentUserId
        }, { merge: true });
    } catch (e) {
        console.error("Error recording payment: " + e.message);
        // Custom modal message box preferred over alert
        alert("Error recording payment: " + e.message);
    }
}

window.markBreak = async function(studentId, monthKey, monthName, currentStatus) {
    // Custom modal message box preferred over confirm
    if (currentStatus === 'break') {
         if (!confirm(`Are you sure you want to change ${monthName}'s status back to Unpaid?`)) return;
         // Deleting the document reverts the status to 'unpaid' (non-existent)
         await deleteDoc(doc(getFeesCollectionRef(studentId), monthKey));
    } else {
        if (!confirm(`Are you sure you want to mark ${monthName} as a break month? This will clear any existing payment data for this month.`)) return;
        const feeRef = doc(getFeesCollectionRef(studentId), monthKey);
        try {
            await setDoc(feeRef, {
                status: 'break',
                recordedBy: currentUserId,
                recordedAt: Timestamp.now()
            }, { merge: false });
        } catch (e) {
            console.error("Error marking break month: " + e.message);
            alert("Error marking break month: " + e.message);
        }
    }
}

// --- Gemini API Logic ---

// Base function for fetching Gemini response
async function fetchGeminiResponse(userQuery, systemPrompt, loaderId, responseId) {
    const apiKey = ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const loader = document.getElementById(loaderId);
    const responseDiv = document.getElementById(responseId);

    loader.classList.remove('hidden');
    responseDiv.textContent = 'Generating response...';

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        // Use Google Search grounding for real-time policy information
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
                return; // Success, exit loop
            } else if (response.status === 429 || response.status >= 500) {
                // Throttle or server error, attempt retry with exponential backoff
                if (retries < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, retries);
                    console.warn(`API call failed with status ${response.status}. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    retries++;
                    continue; // Skip finally and retry loop
                }
            } else {
                 // Non-retryable error
                throw new Error(`API call failed: ${response.statusText} (${response.status})`);
            }
        } catch (e) {
            console.error("Gemini API Error:", e);
            responseDiv.textContent = `Error: Failed to connect to AI assistant. (${e.message})`;
            break; // Exit loop on critical failure
        } finally {
            // Loader is hidden only when we successfully return OR break out of the loop
            if (retries === maxRetries || response?.ok) {
                loader.classList.add('hidden');
            }
        }
    }

    // If we exit the loop without success, ensure the final error message is set and loader is hidden
    if (retries === maxRetries) {
        responseDiv.textContent = 'Error: API request failed after multiple retries.';
        loader.classList.add('hidden');
    }
}


window.handleStudentQuery = async function() {
    const query = document.getElementById('geminiQuery').value.trim();
    if (!query || !currentStudentData) return;

    // Format current fee status list for context
    const feeListElement = document.getElementById('feeStatusList');
    const feeContext = Array.from(feeListElement.children).map(li => li.textContent.trim()).join('; ');
    
    const userPrompt = `Student Profile: Name: ${currentStudentData.name}, ID: ${currentStudentData.id}, Class: ${currentStudentData.class}. Current fee status (Jan-current month): ${feeContext}. The student asks: "${query}"`;
    
    const systemPrompt = "Act as a helpful, professional Academic Care Fee Policy Assistant. Base your response only on the provided context or general best practices for school fee queries. Be concise and empathetic.";
    
    await fetchGeminiResponse(userPrompt, systemPrompt, 'geminiLoader', 'geminiResponse');
}


window.handleDraftCommunication = async function(studentId, monthName, status, guardianName, guardianPhone) {
    document.getElementById('communicationModal').classList.remove('hidden');
    
    // Clear previous draft and show loader
    document.getElementById('draftedCommunication').value = '';
    
    const userPrompt = `Draft a professional and polite communication message (suitable for SMS or email body) for a guardian. Student ID: ${studentId}, Guardian Name: ${guardianName}. The issue is the fee for the month of ${monthName} is currently marked as: ${status}. The guardian's phone number is: ${guardianPhone}. Use a respectful tone.`;
    
    const systemPrompt = "You are a school administrator drafting a polite, formal reminder or notification to a guardian regarding a student's fee status. Keep the message concise (under 5 sentences) and clear. Do not include salutations or closings, just the message body.";
    
    await fetchGeminiResponse(userPrompt, systemPrompt, 'communicationLoader', 'draftedCommunication');
}


// --- Utility Functions ---

window.closeModal = function() {
    document.getElementById('communicationModal').classList.add('hidden');
    document.getElementById('draftedCommunication').value = '';
    document.getElementById('communicationLoader').classList.add('hidden');
}

window.copyToClipboard = function(elementId) {
    const copyText = document.getElementById(elementId);
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    document.execCommand('copy');
    // Custom modal message box preferred over alert
    alert("Message copied to clipboard!");
}

// Initialize the app on load
window.onload = initializeAppAndAuth;

