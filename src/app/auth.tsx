
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  getIdTokenResult,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

export default function AuthScreen() {
  const router = useRouter();

  const [isRegister, setIsRegister] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<"customer" | "dealer">(
  "customer"
);

  
const handleAuth = async () => {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password || (isRegister && !name.trim())) {
    Alert.alert("Missing details", "Please fill in all required fields.");
    return;
  }

  if (password.length < 6) {
    Alert.alert("Invalid password", "Use at least 6 characters.");
    return;
  }

  setLoading(true);

  try {
    if (isRegister) {
      const result = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      await updateProfile(result.user, {
        displayName: name.trim(),
      });

      await setDoc(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        name: name.trim(),
        email: cleanEmail,
        role: "customer",
        requestedRole: accountType,
        dealerStatus:
          accountType === "dealer" ? "pending" : "not_applicable",
        createdAt: serverTimestamp(),
      });

      Alert.alert("Welcome to AquaPure!", "Your account was created.");

      // New registrations always enter the customer experience.
      router.replace("/");
    } else {
      const result = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // Refresh the Firebase token to get the latest admin claim.
      const tokenResult = await getIdTokenResult(result.user, true);

      if (tokenResult.claims.admin === true) {
        router.replace("/admin");
      } else {
        router.replace("/");
      }

      Alert.alert("Welcome back!", "You are signed in.");
    }
  } catch (error: any) {
    const messages: Record<string, string> = {
      "auth/email-already-in-use":
        "This email is already registered. Please sign in.",
      "auth/invalid-email":
        "Please enter a valid email address.",
      "auth/invalid-credential":
        "Email or password is incorrect. Please try again.",
      "auth/weak-password":
        "Please choose a stronger password.",
      "auth/network-request-failed":
        "Network error. Check your internet connection.",
      "permission-denied":
        "Firestore denied the request. Check your database rules.",
    };

    Alert.alert(
      "Authentication failed",
      messages[error.code] ||
        error.message ||
        "Something went wrong. Please try again."
    );
  } finally {
    setLoading(false);
  }
};


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>AquaPure</Text>
        <Text style={styles.heading}>
          {isRegister ? "Create your account" : "Welcome back"}
        </Text>
        <Text style={styles.subtitle}>
          {isRegister
            ? "Get started with clean water solutions."
            : "Sign in to continue to AquaPure."}
        </Text>

        {isRegister && (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#8190A5"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        {isRegister && (
  <View style={styles.roleSection}>
    <Text style={styles.roleLabel}>I want to register as</Text>

    <View style={styles.roleOptions}>
      {(["customer", "dealer"] as const).map((role) => (
        <Pressable
          key={role}
          onPress={() => setAccountType(role)}
          style={[
            styles.roleOption,
            accountType === role && styles.roleOptionActive,
          ]}
        >
          <Text
            style={[
              styles.roleOptionText,
              accountType === role && styles.roleOptionTextActive,
            ]}
          >
            {role === "customer" ? "Customer" : "Dealer"}
          </Text>
        </Pressable>
      ))}
    </View>

    {accountType === "dealer" && (
      <Text style={styles.roleHint}>
        Dealer access and wholesale pricing require approval.
      </Text>
    )}
  </View>
)}

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#8190A5"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Password (minimum 6 characters)"
          placeholderTextColor="#8190A5"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegister ? "Create account" : "Sign in"}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switchButton}
          onPress={() => setIsRegister(!isRegister)}
        >
          <Text style={styles.switchText}>
            {isRegister
              ? "Already have an account? Sign in"
              : "New to AquaPure? Create an account"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F7FC",
    justifyContent: "center",
    padding: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    gap: 15,
  },
  brand: {
    color: "#087E8B",
    fontSize: 18,
    fontWeight: "800",
  },
  heading: {
    color: "#102A43",
    fontSize: 25,
    fontWeight: "800",
  },
  subtitle: {
    color: "#62748A",
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#DCE5EF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: "#102A43",
  },
  button: {
    backgroundColor: "#087E8B",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 3,
  },
  disabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  switchButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  switchText: {
    color: "#087E8B",
    fontWeight: "600",
    textAlign: "center",
  },
  roleSection: {
  gap: 9,
},
roleLabel: {
  color: "#102A43",
  fontSize: 14,
  fontWeight: "700",
},
roleOptions: {
  flexDirection: "row",
  gap: 10,
},
roleOption: {
  flex: 1,
  paddingVertical: 13,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#DCE5EF",
  backgroundColor: "#F7FAFC",
  alignItems: "center",
},
roleOptionActive: {
  backgroundColor: "#E2F5F4",
  borderColor: "#087E8B",
},
roleOptionText: {
  color: "#62748A",
  fontWeight: "700",
},
roleOptionTextActive: {
  color: "#087E8B",
},
roleHint: {
  color: "#62748A",
  fontSize: 12,
},
});
