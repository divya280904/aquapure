import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

type ProfileData = {
  name?: string;
  email?: string;
  role?: string;
  dealerStatus?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfile({});
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid));

        if (snapshot.exists()) {
          setProfile(snapshot.data() as ProfileData);
        } else {
          setProfile({
            name: currentUser.displayName || "User",
            email: currentUser.email || "",
          });
        }
      } catch (error) {
        console.error("Profile loading error:", error);
        Alert.alert("Error", "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      Alert.alert(
        "Logout failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Your Account</Text>
        <Text style={styles.subtitle}>
          Sign in to view your profile and orders.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/auth")}
        >
          <Text style={styles.primaryButtonText}>Sign in / Create account</Text>
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.backButtonText}>Back to shopping</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const roleLabel =
    profile.role === "admin"
      ? "Administrator"
      : profile.role === "dealer"
        ? profile.dealerStatus === "approved"
          ? "Approved Dealer"
          : "Dealer · Pending approval"
        : "Customer";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.replace("/")}>
          <Text style={styles.backLink}>‹ Back to shopping</Text>
        </Pressable>

        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Manage your AquaPure account.</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile.name || user.email || "U").charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.name}>
            {profile.name || user.displayName || "AquaPure User"}
          </Text>

          <Text style={styles.email}>
            {profile.email || user.email || "No email available"}
          </Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your account</Text>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push("/orders")}
        >
          <View>
            <Text style={styles.menuTitle}>My Orders</Text>
            <Text style={styles.menuSubtitle}>
              View your order history and status
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {profile?.role === "dealer" && profile?.dealerStatus === "approved" && (
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push("/dealer-bulk-orders")}
          >
            <View>
              <Text style={styles.menuTitle}>Dealer Bulk Orders</Text>
              <Text style={styles.menuSubtitle}>
                Order products in bulk at wholesale prices
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push("/service-booking")}
        >
          <View>
            <Text style={styles.menuTitle}>Book a Service</Text>
            <Text style={styles.menuSubtitle}>
              Request installation, repair, or maintenance
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {profile.role === "admin" && (
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push("/admin")}
          >
            <View>
              <Text style={styles.menuTitle}>Admin Dashboard</Text>
              <Text style={styles.menuSubtitle}>
                Manage AquaPure operations
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.logoutButton}
          onPress={() =>
            Alert.alert("Log out", "Are you sure you want to log out?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log out",
                style: "destructive",
                onPress: () => {
                  void handleLogout();
                },
              },
            ])
          }
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
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
    marginBottom: 22,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE9ED",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#DDF3F4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarText: {
    color: "#087E8B",
    fontSize: 30,
    fontWeight: "800",
  },
  name: {
    color: "#173B45",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  email: {
    color: "#58717A",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  roleBadge: {
    backgroundColor: "#E6F5F6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 14,
  },
  roleText: {
    color: "#087E8B",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#173B45",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 28,
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#DCE9ED",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuTitle: {
    color: "#173B45",
    fontSize: 15,
    fontWeight: "700",
  },
  menuSubtitle: {
    color: "#58717A",
    fontSize: 12,
    marginTop: 5,
  },
  arrow: {
    color: "#087E8B",
    fontSize: 26,
  },
  primaryButton: {
    backgroundColor: "#087E8B",
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  backButton: {
    marginTop: 18,
    padding: 10,
  },
  backButtonText: {
    color: "#087E8B",
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: "#FFF0EE",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    color: "#B42318",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingText: {
    marginTop: 12,
    color: "#58717A",
  },
});
