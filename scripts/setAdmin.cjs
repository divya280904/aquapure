
const { initializeApp, cert, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccount = require(
  path.resolve(
    __dirname,
    "../aquapure-3d28b-firebase-adminsdk-fbsvc-e819c2ae7a.json"
  )
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const adminAuth = getAuth(app);
const db = getFirestore(app);

// Replace this with the admin email you created in Firebase.
const ADMIN_EMAIL = "admin@aquapure.com";

async function makeAdmin() {
  const user = await adminAuth.getUserByEmail(ADMIN_EMAIL);

  // Secure administrator privilege stored in Firebase Auth.
  await adminAuth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
  });

  // Create/update the profile using the trusted Admin SDK.
  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      role: "admin",
      name: user.displayName || "AquaPure Admin",
    },
    { merge: true }
  );

  console.log(`Admin access granted to ${user.email}`);
}

makeAdmin()
  .catch((error) => {
    console.error("Could not configure admin:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteApp(app);
  });
