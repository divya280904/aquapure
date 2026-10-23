import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, getIdTokenResult, signOut } from "firebase/auth";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

type DealerRequest = {
  id: string;
  name?: string;
  email?: string;
};

export default function AdminScreen() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [pendingDealers, setPendingDealers] = useState<DealerRequest[]>([]);
  const [busyId, setBusyId] = useState("");

  async function loadDashboard() {
    const user = auth.currentUser;

    if (!user) {
      setIsAdmin(false);
      router.replace("/auth");
      return;
    }

    // Refresh the token so recently granted admin claims are available.
    const token = await getIdTokenResult(user, true);

    if (token.claims.admin !== true) {
      setIsAdmin(false);
      return;
    }

    setIsAdmin(true);

    const [productsSnapshot, usersSnapshot] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "users")),
    ]);

    setProductCount(productsSnapshot.size);
    setUserCount(usersSnapshot.size);

    const requests = usersSnapshot.docs
      .filter((item) => {
        const data = item.data();
        return (
          data.requestedRole === "dealer" && data.dealerStatus === "pending"
        );
      })
      .map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: data.name,
          email: data.email,
        };
      });

    setPendingDealers(requests);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          router.replace("/auth");
          return;
        }

        await loadDashboard();
      } catch (error) {
        console.error("Admin dashboard error:", error);
        Alert.alert(
          "Unable to load dashboard",
          "Please check your connection and Firestore rules.",
        );
      } finally {
        setChecking(false);
      }
    });

    return unsubscribe;
  }, []);

  async function updateDealerStatus(
    dealerId: string,
    status: "approved" | "rejected",
  ) {
    try {
      setBusyId(dealerId);

      await updateDoc(doc(db, "users", dealerId), {
        dealerStatus: status,
        ...(status === "approved" ? { role: "dealer" } : {}),
      });

      Alert.alert(
        "Dealer request updated",
        `The application has been ${status}.`,
      );

      await loadDashboard();
    } catch (error) {
      console.error("Dealer approval error:", error);
      Alert.alert(
        "Update failed",
        "Could not update this request. Check your admin access and Firestore rules.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/auth");
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.muted}>Checking administrator access...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.title}>Admin access required</Text>
        <Text style={styles.muted}>
          Sign in with your authorized AquaPure admin account.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace("/auth")}
        >
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>AquaPure</Text>
          <Text style={styles.subtitle}>Administration dashboard</Text>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Overview</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📦</Text>
          <Text style={styles.statNumber}>{productCount}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>👥</Text>
          <Text style={styles.statNumber}>{userCount}</Text>
          <Text style={styles.statLabel}>Registered users</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📝</Text>
          <Text style={styles.statNumber}>{pendingDealers.length}</Text>
          <Text style={styles.statLabel}>Pending dealers</Text>
        </View>
      </View>

      <Pressable
        style={{
          backgroundColor: "#087E8B",
          padding: 15,
          borderRadius: 12,
          alignItems: "center",
        }}
        onPress={() => router.push("/admin-products")}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
          Manage Products
        </Text>
      </Pressable>

      <Pressable
        style={{
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "#087E8B",
          padding: 15,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 12,
        }}
        onPress={() => router.push("/admin-orders")}
      >
        <Text style={{ color: "#087E8B", fontWeight: "800" }}>
          Manage Orders
        </Text>
      </Pressable>

      <Pressable
  style={{
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#087E8B",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  }}
  onPress={() => router.push("/admin-services")}
>
  <Text style={{ color: "#087E8B", fontWeight: "800" }}>
    Service Desk
  </Text>
</Pressable>

      <Text style={styles.heading}>Dealer applications</Text>

      {pendingDealers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No pending applications</Text>
          <Text style={styles.muted}>
            New dealer requests will appear here.
          </Text>
        </View>
      ) : (
        pendingDealers.map((dealer) => (
          <View key={dealer.id} style={styles.dealerCard}>
            <Text style={styles.dealerName}>
              {dealer.name || "Unnamed applicant"}
            </Text>
            <Text style={styles.muted}>{dealer.email || "No email"}</Text>

            <View style={styles.actions}>
              <Pressable
                disabled={busyId === dealer.id}
                style={[
                  styles.approveButton,
                  busyId === dealer.id && styles.disabled,
                ]}
                onPress={() => updateDealerStatus(dealer.id, "approved")}
              >
                <Text style={styles.actionText}>
                  {busyId === dealer.id ? "Please wait..." : "Approve"}
                </Text>
              </Pressable>

              <Pressable
                disabled={busyId === dealer.id}
                style={[
                  styles.rejectButton,
                  busyId === dealer.id && styles.disabled,
                ]}
                onPress={() => updateDealerStatus(dealer.id, "rejected")}
              >
                <Text style={styles.actionText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable style={styles.refreshButton} onPress={loadDashboard}>
        <Text style={styles.refreshText}>Refresh dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F8FB" },
  content: { padding: 20, paddingTop: 55, paddingBottom: 40, gap: 18 },
  center: {
    flex: 1,
    backgroundColor: "#F4F8FB",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: "#087E8B", fontSize: 27, fontWeight: "800" },
  subtitle: { color: "#62748A", marginTop: 3 },
  heading: { fontSize: 20, fontWeight: "800", color: "#102A43", marginTop: 8 },
  statsRow: { flexDirection: "row", gap: 9 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1EAF0",
    gap: 7,
  },
  statEmoji: { fontSize: 22 },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#087E8B" },
  statLabel: { fontSize: 11, color: "#62748A" },
  emptyCard: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#102A43" },
  muted: { color: "#62748A", fontSize: 13, textAlign: "center" },
  dealerCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E1EAF0",
  },
  dealerName: { fontSize: 16, fontWeight: "700", color: "#102A43" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  approveButton: {
    flex: 1,
    backgroundColor: "#087E8B",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#B42318",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  actionText: { color: "#FFFFFF", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  primaryButton: {
    backgroundColor: "#087E8B",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#DCE5EF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  logoutText: { color: "#102A43", fontWeight: "700" },
  refreshButton: {
    borderWidth: 1,
    borderColor: "#087E8B",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  refreshText: { color: "#087E8B", fontWeight: "700" },
  lock: { fontSize: 42 },
  title: { color: "#102A43", fontSize: 22, fontWeight: "800" },
});
