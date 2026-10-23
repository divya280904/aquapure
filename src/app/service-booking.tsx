
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

const serviceTypes = [
  "Installation",
  "Repair",
  "Maintenance",
];

export default function ServiceBookingScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [serviceType, setServiceType] = useState("Installation");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserId("");
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      setEmail(user.email || "");

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUserName(data.name || user.displayName || "");
          setPhone(data.phone || "");
          setAddress(data.address || "");
        } else {
          setUserName(user.displayName || "");
        }
      } catch (error) {
        console.error("Profile lookup failed:", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function submitRequest() {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to book a service.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign in",
          onPress: () => router.push("/auth"),
        },
      ]);
      return;
    }

    if (!userName.trim() || !phone.trim() || !address.trim()) {
      Alert.alert(
        "Missing details",
        "Please enter your name, phone number, and service address."
      );
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      Alert.alert(
        "Invalid phone number",
        "Enter a valid 10-digit Indian mobile number."
      );
      return;
    }

    if (
      preferredDate.trim() &&
      !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate.trim())
    ) {
      Alert.alert(
        "Invalid date",
        "Enter your preferred date in YYYY-MM-DD format."
      );
      return;
    }

    setSubmitting(true);

    try {
      await addDoc(collection(db, "serviceRequests"), {
        userId,
        customerName: userName.trim(),
        email,
        phone: phone.trim(),
        address: address.trim(),
        serviceType,
        preferredDate: preferredDate.trim() || null,
        description: description.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        "Request submitted",
        "Your service request has been submitted successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/"),
          },
        ]
      );

      setDescription("");
      setPreferredDate("");
    } catch (error) {
      console.error("Service request submission failed:", error);
      Alert.alert(
        "Submission failed",
        "Could not submit your request. Check your internet connection and Firestore rules."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.helper}>Loading your account...</Text>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Book a Service</Text>
        <Text style={styles.subtitle}>
          Sign in to request installation, repair, or maintenance.
        </Text>
        <Pressable
          style={styles.submitButton}
          onPress={() => router.push("/auth")}
        >
          <Text style={styles.submitText}>Sign in to continue</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/")}>
          <Text style={styles.backLink}>Back to shopping</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.replace("/")}>
          <Text style={styles.backLink}>‹ Back to shopping</Text>
        </Pressable>

        <Text style={styles.title}>Book a Service</Text>
        <Text style={styles.subtitle}>
          Tell us what your water purifier needs.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Service type *</Text>
          <View style={styles.options}>
            {serviceTypes.map((type) => (
              <Pressable
                key={type}
                onPress={() => setServiceType(type)}
                style={[
                  styles.option,
                  serviceType === type && styles.optionActive,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    serviceType === type && styles.optionTextActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Full name *</Text>
          <TextInput
            value={userName}
            onChangeText={setUserName}
            placeholder="Enter your name"
            placeholderTextColor="#81939B"
            style={styles.input}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Mobile number *</Text>
          <TextInput
            value={phone}
            onChangeText={(value) =>
              setPhone(value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="10-digit mobile number"
            placeholderTextColor="#81939B"
            style={styles.input}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Text style={styles.label}>Service address *</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="House, street, city, PIN code"
            placeholderTextColor="#81939B"
            style={[styles.input, styles.multiline]}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Preferred date (optional)</Text>
          <TextInput
            value={preferredDate}
            onChangeText={setPreferredDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#81939B"
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <Text style={styles.label}>Describe the issue (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Purifier model, issue, or other details"
            placeholderTextColor="#81939B"
            style={[styles.input, styles.multiline]}
            multiline
            numberOfLines={4}
            maxLength={500}
          />

          <Pressable
            style={[
              styles.submitButton,
              submitting && styles.disabledButton,
            ]}
            onPress={submitRequest}
            disabled={submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? "Submitting..." : "Submit Service Request"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4FAFC",
  },
  center: {
    flex: 1,
    backgroundColor: "#F4FAFC",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  backLink: {
    color: "#087E8B",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 20,
  },
  title: {
    color: "#173B45",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#58717A",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE9ED",
    padding: 18,
  },
  label: {
    color: "#173B45",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: "#C8DDE2",
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  optionActive: {
    backgroundColor: "#087E8B",
    borderColor: "#087E8B",
  },
  optionText: {
    color: "#36545D",
    fontSize: 13,
    fontWeight: "600",
  },
  optionTextActive: {
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#F8FBFC",
    borderWidth: 1,
    borderColor: "#D4E3E7",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#173B45",
    fontSize: 14,
  },
  multiline: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#087E8B",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 24,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
  helper: {
    marginTop: 12,
    color: "#58717A",
  },
});
