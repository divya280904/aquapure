import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { getIdTokenResult } from "firebase/auth";
import { auth, db } from "../../firebase";
import { waitForAuth } from "@/utils/waitForAuth";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../constants/api";

type ServiceRequest = {
  id: string;
  userId: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  serviceType: string;
  preferredDate?: string | null;
  description?: string;
  status: string;
  createdAt?: { toDate: () => Date } | null;
};

const statuses = [
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(timestamp?: { toDate: () => Date } | null) {
  if (!timestamp) return "Just now";
  try {
    return timestamp.toDate().toLocaleString();
  } catch {
    return "Date unavailable";
  }
}

export default function AdminServicesScreen() {
  const router = useRouter();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const loadRequests = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const user = await waitForAuth();

        if (!user) {
          router.replace("/auth");
          return;
        }

        const token = await getIdTokenResult(user, true);

        if (token.claims.admin !== true) {
          Alert.alert(
            "Access denied",
            "Only administrators can access the Service Desk.",
          );
          router.replace("/");
          return;
        }

        const requestsQuery = query(
          collection(db, "serviceRequests"),
          orderBy("createdAt", "desc"),
        );

        const snapshot = await getDocs(requestsQuery);

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ServiceRequest[];

        setRequests(data);
      } catch (error) {
        console.error("Loading service requests failed:", error);
        Alert.alert(
          "Unable to load requests",
          "Check your connection and Firestore permissions.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests]),
  );

  function openInMap(address: string, lat?: number, lng?: number) {
    let url = "";
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      url = Platform.select({
        ios: `maps:0,0?q=${lat},${lng}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(AquaPure+Service)`,
        default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      });
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }

    Linking.openURL(url).catch((err) => {
      console.warn("Could not open native map URL:", err);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    });
  }

  async function updateStatus(requestId: string, newStatus: string) {
    try {
      setUpdatingId(requestId);

      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in again.");

      const token = await getIdTokenResult(user, true);
      if (token.claims.admin !== true) {
        throw new Error("Administrator permission is required.");
      }

      // Route update through backend to trigger server-side authorization and Multi-Channel Notifications (Push, Email, SMS)
      try {
        const response = await fetch(`${API_BASE_URL}/admin/service-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token.token}`,
          },
          body: JSON.stringify({ requestId, status: newStatus }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Backend update failed");
        }
      } catch (backendError) {
        console.warn("Backend service status call failed, using client fallback:", backendError);
        await updateDoc(doc(db, "serviceRequests", requestId), {
          status: newStatus,
          updatedAt: new Date(),
        });
      }

      setRequests((previous) =>
        previous.map((request) =>
          request.id === requestId
            ? { ...request, status: newStatus }
            : request,
        ),
      );

      Alert.alert("Updated", `Status changed to ${formatStatus(newStatus)}.`);
    } catch (error) {
      console.error("Updating service status failed:", error);
      Alert.alert(
        "Update failed",
        error instanceof Error
          ? error.message
          : "Check your Firestore rules and try again.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  function confirmStatusChange(requestId: string, newStatus: string) {
    Alert.alert(
      "Update service status",
      `Change this request to "${formatStatus(newStatus)}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            void updateStatus(requestId, newStatus);
          },
        },
      ],
    );
  }

  const filteredRequests =
    selectedStatus === "all"
      ? requests
      : requests.filter((request) => request.status === selectedStatus);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.helper}>Loading service requests...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/admin")}>
          <Text style={styles.backLink}>‹ Admin Dashboard</Text>
        </Pressable>
        <Text style={styles.title}>Service Desk</Text>
        <Text style={styles.subtitle}>
          View and manage customer service requests.
        </Text>
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRequests(true)}
            tintColor="#087E8B"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total requests</Text>
              <Text style={styles.summaryValue}>{requests.length}</Text>
              <Text style={styles.summaryPending}>
                Pending: {requests.filter((r) => r.status === "pending").length}
              </Text>
            </View>

            <Text style={styles.filterHeading}>Filter requests</Text>
            <FlatList
              horizontal
              data={["all", ...statuses]}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedStatus(item)}
                  style={[
                    styles.filterButton,
                    selectedStatus === item && styles.filterActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      selectedStatus === item && styles.filterTextActive,
                    ]}
                  >
                    {item === "all" ? "All" : formatStatus(item)}
                  </Text>
                </Pressable>
              )}
            />

            <Text style={styles.resultCount}>
              {filteredRequests.length} request(s)
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.emptyText}>
              New customer service bookings will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.requestCard}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitleArea}>
                <Text style={styles.serviceType}>{item.serviceType}</Text>
                <Text style={styles.requestId}>ID: {item.id.slice(0, 10)}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {formatStatus(item.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.detail}>☎ {item.phone}</Text>
            {!!item.email && <Text style={styles.detail}>✉ {item.email}</Text>}
            
            <View style={styles.addressBox}>
              <Text style={styles.detail}>Address: {item.address}</Text>
              {item.latitude != null && item.longitude != null && (
                <Text style={styles.coordsBadge}>
                  📍 GPS: {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}
                </Text>
              )}
              <Pressable
                style={styles.openMapButton}
                onPress={() => openInMap(item.address, item.latitude, item.longitude)}
              >
                <Ionicons name="map-outline" size={14} color="#087E8B" />
                <Text style={styles.openMapText}>Open in Map</Text>
              </Pressable>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Preferred date</Text>
              <Text style={styles.infoValue}>
                {item.preferredDate || "Not specified"}
              </Text>

              <Text style={styles.infoLabel}>Submitted</Text>
              <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>

              {!!item.description && (
                <>
                  <Text style={styles.infoLabel}>Description</Text>
                  <Text style={styles.infoValue}>{item.description}</Text>
                </>
              )}
            </View>

            <Text style={styles.updateHeading}>Update status</Text>
            <View style={styles.statusOptions}>
              {statuses
                .filter((status) => status !== item.status)
                .map((status) => (
                  <Pressable
                    key={status}
                    disabled={updatingId === item.id}
                    onPress={() => confirmStatusChange(item.id, status)}
                    style={[
                      styles.statusOption,
                      updatingId === item.id && styles.disabled,
                    ]}
                  >
                    <Text style={styles.statusOptionText}>
                      {formatStatus(status)}
                    </Text>
                  </Pressable>
                ))}
            </View>

            {updatingId === item.id && (
              <ActivityIndicator color="#087E8B" style={styles.updating} />
            )}
          </View>
        )}
      />
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4FAFC",
  },
  helper: {
    marginTop: 12,
    color: "#58717A",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backLink: {
    color: "#087E8B",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 16,
  },
  title: {
    color: "#173B45",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#58717A",
    fontSize: 14,
    marginTop: 5,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: "#087E8B",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  },
  summaryLabel: {
    color: "#DDF5F6",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4,
  },
  summaryPending: {
    color: "#FFFFFF",
    fontSize: 13,
    marginTop: 5,
  },
  filterHeading: {
    color: "#173B45",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  filters: {
    gap: 8,
    paddingBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#C8DDE2",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
  },
  filterActive: {
    backgroundColor: "#087E8B",
    borderColor: "#087E8B",
  },
  filterText: {
    color: "#36545D",
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  resultCount: {
    color: "#58717A",
    fontSize: 12,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  emptyTitle: {
    color: "#173B45",
    fontSize: 17,
    fontWeight: "800",
  },
  emptyText: {
    color: "#58717A",
    textAlign: "center",
    marginTop: 8,
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE9ED",
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitleArea: {
    flex: 1,
  },
  serviceType: {
    color: "#087E8B",
    fontSize: 17,
    fontWeight: "800",
  },
  requestId: {
    color: "#81939B",
    fontSize: 10,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: "#E6F5F6",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: "#087E8B",
    fontSize: 11,
    fontWeight: "800",
  },
  customerName: {
    color: "#173B45",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 16,
  },
  detail: {
    color: "#36545D",
    fontSize: 13,
    marginTop: 7,
    lineHeight: 19,
  },
  infoBox: {
    backgroundColor: "#F4FAFC",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  infoLabel: {
    color: "#81939B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  infoValue: {
    color: "#173B45",
    fontSize: 13,
    marginTop: 3,
    lineHeight: 19,
  },
  updateHeading: {
    color: "#173B45",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 9,
  },
  statusOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#087E8B",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statusOptionText: {
    color: "#087E8B",
    fontSize: 12,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
  updating: {
    marginTop: 10,
  },
  addressBox: {
    backgroundColor: "#F8FBFC",
    borderWidth: 1,
    borderColor: "#E2EEF1",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  coordsBadge: {
    color: "#087E8B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    backgroundColor: "#E4F3F5",
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  openMapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F4F7",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#C6E4EA",
  },
  openMapText: {
    color: "#087E8B",
    fontSize: 12,
    fontWeight: "700",
  },
});
