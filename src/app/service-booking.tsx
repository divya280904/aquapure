import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import MapAddressPicker, { LocationCoordinates } from "@/components/MapAddressPicker";
import { API_BASE_URL } from "@/constants/api";
import { Ionicons } from "@expo/vector-icons";

const serviceTypes = [
  "Installation",
  "Repair",
  "Maintenance",
  "Filter Replacement",
];

type UserServiceRequest = {
  id: string;
  serviceType: string;
  customerName: string;
  phone: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  preferredDate?: string | null;
  description?: string;
  status: string;
  createdAt?: { toDate: () => Date } | null;
};

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ServiceBookingScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tab state: "book" or "history"
  const [activeTab, setActiveTab] = useState<"book" | "history">("book");
  const [myRequests, setMyRequests] = useState<UserServiceRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [serviceType, setServiceType] = useState("Installation");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState<LocationCoordinates | null>(null);
  const [preferredDate, setPreferredDate] = useState("");
  const [description, setDescription] = useState("");

  const loadUserRequests = useCallback(async (uid: string) => {
    if (!uid) return;
    setLoadingRequests(true);
    try {
      const q = query(
        collection(db, "serviceRequests"),
        where("userId", "==", uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as UserServiceRequest[];

      list.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dbTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dbTime - da;
      });

      setMyRequests(list);
    } catch (err) {
      console.error("Could not fetch user service requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

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

        void loadUserRequests(user.uid);
      } catch (error) {
        console.error("Profile lookup failed:", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [loadUserRequests]);

  function handleLocationSelected(coords: LocationCoordinates, suggestedAddress?: string) {
    setCoordinates(coords);
    if (suggestedAddress && (!address.trim() || address === "")) {
      setAddress(suggestedAddress);
    }
  }

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
      const docRef = await addDoc(collection(db, "serviceRequests"), {
        userId,
        customerName: userName.trim(),
        email,
        phone: phone.trim(),
        address: address.trim(),
        latitude: coordinates ? coordinates.latitude : null,
        longitude: coordinates ? coordinates.longitude : null,
        serviceType,
        preferredDate: preferredDate.trim() || null,
        description: description.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Dispatch multi-channel notification (Email, SMS, Push) via backend
      auth.currentUser
        ?.getIdToken()
        .then((token) => {
          fetch(`${API_BASE_URL}/notify/service-booking`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ requestId: docRef.id }),
          }).catch((err) =>
            console.log("Service booking notification error:", err)
          );
        })
        .catch((e) => console.log("Token fetch error:", e));

      Alert.alert(
        "Service Request Submitted!",
        "Your request has been recorded. Our technician will contact you to confirm the appointment.",
        [
          {
            text: "View My Requests",
            onPress: () => {
              void loadUserRequests(userId);
              setActiveTab("history");
            },
          },
          {
            text: "Done",
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
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/")}>
          <Text style={styles.backLink}>‹ Back to shopping</Text>
        </Pressable>
        <Text style={styles.title}>AquaPure Service Desk</Text>
        <Text style={styles.subtitle}>
          Expert installation, repair, and genuine water purifier maintenance.
        </Text>

        {/* Tab Switcher */}
        <View style={styles.tabsRow}>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "book" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("book")}
          >
            <Ionicons
              name="construct-outline"
              size={15}
              color={activeTab === "book" ? "#FFFFFF" : "#087E8B"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "book" && styles.tabTextActive,
              ]}
            >
              Book New Service
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "history" && styles.tabButtonActive,
            ]}
            onPress={() => {
              setActiveTab("history");
              void loadUserRequests(userId);
            }}
          >
            <Ionicons
              name="time-outline"
              size={15}
              color={activeTab === "history" ? "#FFFFFF" : "#087E8B"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "history" && styles.tabTextActive,
              ]}
            >
              My Requests ({myRequests.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Tab 1: Book New Service */}
      {activeTab === "book" ? (
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
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

            {/* Interactive OpenStreetMap Address Picker with GPS */}
            <MapAddressPicker
              selectedCoordinates={coordinates}
              onLocationSelected={handleLocationSelected}
            />

            <Text style={styles.label}>Service address *</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="House, street, landmark, city, PIN code"
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
              placeholder="Purifier model, issue description, or special instructions"
              placeholderTextColor="#81939B"
              style={[styles.input, styles.multiline]}
              multiline
              numberOfLines={3}
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
                {submitting ? "Submitting Request..." : "Confirm & Book Service"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        /* Tab 2: Service History */
        <View style={{ flex: 1 }}>
          {loadingRequests ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#087E8B" />
              <Text style={styles.helper}>Loading your service requests...</Text>
            </View>
          ) : myRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#81939B" />
              <Text style={styles.emptyTitle}>No service requests yet</Text>
              <Text style={styles.emptyText}>
                Book your first water purifier service above to have an engineer visit your address.
              </Text>
              <Pressable
                style={[styles.submitButton, { marginTop: 16 }]}
                onPress={() => setActiveTab("book")}
              >
                <Text style={styles.submitText}>Book a Service Now</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={myRequests}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.historyList}
              renderItem={({ item }) => (
                <View style={styles.historyCard}>
                  <View style={styles.historyCardTop}>
                    <View>
                      <Text style={styles.historyType}>{item.serviceType}</Text>
                      <Text style={styles.historyId}>
                        ID: #{item.id.slice(-8)}
                      </Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {formatStatus(item.status)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.historyDetail}>
                    📍 {item.address}
                  </Text>
                  {item.latitude != null && item.longitude != null && (
                    <Text style={styles.historyCoords}>
                      GPS: {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                    </Text>
                  )}
                  {!!item.preferredDate && (
                    <Text style={styles.historyDetail}>
                      🗓 Preferred Date: {item.preferredDate}
                    </Text>
                  )}
                  {!!item.description && (
                    <Text style={styles.historyDesc}>
                      Note: {item.description}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      )}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  container: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  backLink: {
    color: "#087E8B",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  title: {
    color: "#173B45",
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: "#58717A",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#087E8B",
    backgroundColor: "#FFFFFF",
  },
  tabButtonActive: {
    backgroundColor: "#087E8B",
  },
  tabText: {
    color: "#087E8B",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#FFFFFF",
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
    marginTop: 14,
    marginBottom: 6,
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
    paddingVertical: 8,
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
    paddingVertical: 11,
    color: "#173B45",
    fontSize: 14,
  },
  multiline: {
    minHeight: 74,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#087E8B",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 22,
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
    marginTop: 10,
    color: "#58717A",
    fontSize: 13,
  },
  historyList: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DCE9ED",
  },
  historyCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  historyType: {
    fontSize: 16,
    fontWeight: "800",
    color: "#173B45",
  },
  historyId: {
    fontSize: 11,
    color: "#81939B",
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: "#E4F3F5",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPillText: {
    color: "#087E8B",
    fontSize: 11,
    fontWeight: "700",
  },
  historyDetail: {
    color: "#36545D",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  historyCoords: {
    color: "#087E8B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  historyDesc: {
    color: "#6B828C",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 6,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#173B45",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#6B828C",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
});
