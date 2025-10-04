// ====================================================================
// 1. FIREBASE INITIALIZATION AND IMPORTS (MODULAR SDK)
// ====================================================================
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, ServerValue } from "firebase/database";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// Your web app's Firebase configuration (from your screenshot)
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

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);


// Global references for view management
const landingView = document.getElementById('landingView');
const registrationView = document.getElementById('registrationView');
const loginView = document.getElementById('loginView');
const registerResultMessage = document.getElementById('registerResultMessage');
const internalNav = document.getElementById('internalNav');
const navDivider = document.getElementById('navDivider');


// ====================================================================
// 2. VIEW SWITCHING LOGIC (Single-Page App behavior)
// ====================================================================

function showView(viewElement) {
    // Hide all main containers and result messages
    if (landingView) landingView.classList.add('hidden');
    if (registrationView) registrationView.classList.add('hidden');
    if (loginView) loginView.classList.add('hidden');
    if (registerResultMessage) registerResultMessage.classList.add('hidden');
    
    // Show the requested view
    if (viewElement) viewElement.classList.remove('hidden');

    // Toggle the internal navigation links visibility
    if (internalNav) {
        if (viewElement === landingView) {
            internalNav.classList.add('hidden');
            navDivider.classList.add('hidden');
        } else {
            internalNav.classList.remove('hidden');
            navDivider.classList.remove('hidden');
        }
    }
}

function setupViewSwitching() {
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const goToLoginAfterReg = document.getElementById('goToLoginAfterReg');
    
    // Landing Page buttons handlers
    const startLoginBtn = document.getElementById('startLoginBtn');
    const startRegisterBtn = document.getElementById('startRegisterBtn');

    if (startLoginBtn) startLoginBtn.addEventListener('click', () => showView(loginView));
    if (startRegisterBtn) startRegisterBtn.addEventListener('click', () => showView(registrationView));
    
    // Internal navigation links handlers
    if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showView(registrationView);
    });

    if (showLoginLink) showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showView(loginView);
    });
    
    // Link after successful registration
    if (goToLoginAfterReg) goToLoginAfterReg.addEventListener('click', (e) => {
        e.preventDefault();
        showView(loginView);
    });
    
    // Default view is handled by onAuthStateChanged below, but we start on landing if not logged in.
    if (!auth.currentUser) {
         showView(landingView);
    }
}


// ====================================================================
// 3. REGISTRATION HANDLER
// ====================================================================

function handleRegistration() {
    const form = document.getElementById('registrationForm');
    if (!form) return; 

    const registerBtn = document.getElementById('registerBtn');

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        if (!form.checkValidity()) { form.reportValidity(); return; }

        registerBtn.disabled = true;
        registerBtn.textContent = 'Processing...';

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const studentClass = document.getElementById('class').value;
        const roll = document.getElementById('roll').value;
        
        // Generate Unique Student ID (S+YYYY+CC+RR)
        const academicYear = new Date().getFullYear();
        const formattedClass = String(studentClass).padStart(2, '0');
        const formattedRoll = String(roll).padStart(2, '0');
        const studentID = `S${academicYear}${formattedClass}${formattedRoll}`;

        try {
            // 1. Create User in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const userUID = userCredential.user.uid;

            // 2. Save Registration Data to Realtime Database
            const registrationData = {
                id: studentID,
                name: name,
                class: studentClass,
                roll: formattedRoll,
                guardianNo: document.getElementById('guardianNo').value,
                email: email,
                uid: userUID,
                status: 'Pending', 
                registeredAt: ServerValue.TIMESTAMP 
            };
            
            await set(ref(database, 'registrations/' + studentID), registrationData);

            // 3. Display Success Message
            document.getElementById('studentID').innerHTML = `Your **Student ID** is: <strong>${studentID}</strong>`;
            
            form.classList.add('hidden');
            registerResultMessage.classList.remove('hidden');

        } catch (error) {
            console.error("Registration failed:", error);
            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please log in or use a different email.";
            }
            alert(`Registration Failed: ${errorMessage}`);
            
        } finally {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Register & Create Account';
        }
    });
}


// ====================================================================
// 4. LOGIN & STATUS CHECK HANDLER
// ====================================================================

function handleLogin() {
    const loginForm = document.getElementById('loginForm');
    const statusArea = document.getElementById('statusArea');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!loginForm) return; 

    // Handle Login Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing In...';

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert(`Login Failed: ${error.message}`);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log In';
        }
    });

    // Handle Logout
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
        }
    });

    // Handle Auth State Change (Determines the view)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User signed in: Show status view
            loginForm.classList.add('hidden');
            if (statusArea) statusArea.classList.remove('hidden');
            showView(loginView); 
            await displayStatus(user.uid);
        } else {
            // User signed out: Default to landing view or show login form if that's the current view
            if (loginView && !loginView.classList.contains('hidden')) {
                if (loginForm) loginForm.classList.remove('hidden');
                if (statusArea) statusArea.classList.add('hidden');
            } else {
                showView(landingView);
            }
        }
    });
}

// Function to fetch and display the student's status
async function displayStatus(uid) {
    const statusElement = document.getElementById('registrationStatus');
    const studentNameDisplay = document.getElementById('studentNameDisplay');
    const studentIDDisplay = document.getElementById('studentIDDisplay');
    const adminMessage = document.getElementById('adminMessage');

    statusElement.textContent = "Loading...";
    adminMessage.textContent = "";

    try {
        const registrationsRef = ref(database, 'registrations');
        // NOTE: The security rules ensure only the authenticated user's record is visible here.
        const snapshot = await get(registrationsRef); 

        if (snapshot.exists()) {
            let registrationFound = false;
            
            snapshot.forEach((childSnapshot) => {
                const regData = childSnapshot.val();
                if (regData.uid === uid) {
                    registrationFound = true;
                    
                    const status = regData.status || 'Pending';
                    
                    studentNameDisplay.textContent = regData.name;
                    studentIDDisplay.textContent = regData.id;
                    statusElement.textContent = status.toUpperCase();
                    
                    statusElement.classList.remove('pending', 'approved');
                    if (status.toLowerCase() === 'pending') {
                        statusElement.classList.add('pending');
                        adminMessage.textContent = "Your registration is currently under review by the administrator. Please check back later.";
                    } else if (status.toLowerCase() === 'approved') {
                        statusElement.classList.add('approved');
                        adminMessage.textContent = "Congratulations! Your registration has been approved. You can now access all coaching resources.";
                    } else {
                        statusElement.classList.add('pending'); 
                        adminMessage.textContent = regData.adminNote || "Your registration status is not standard. Please contact 'The Academic Care' directly.";
                    }
                }
            });

            if (!registrationFound) {
                statusElement.textContent = "No Registration Found";
                adminMessage.textContent = "Your login is successful, but please ensure you have completed the registration form.";
                studentIDDisplay.textContent = "N/A";
            }

        } else {
            statusElement.textContent = "Error: Database is empty.";
        }
    } catch (error) {
        console.error("Error fetching status:", error);
        statusElement.textContent = "Error loading status.";
    }
}


// ====================================================================
// 5. INITIALIZATION
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Set up the single-page application navigation and initial view
    setupViewSwitching();
    
    // 2. Initialize the main Firebase handlers
    handleRegistration();
    handleLogin();
});
