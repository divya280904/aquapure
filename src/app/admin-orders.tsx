import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDocs, orderBy, query } from "firebase/firestore";
import { getIdTokenResult } from "firebase/auth";
import { auth, db } from "../../firebase";

type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type Order = {
  id: string;
  userId: string;
  customerName: string;
  email?: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt?: any;
};

const ORDER_STATUSES = [
  "placed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export default function AdminOrdersScreen() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Access denied", "Please sign in as an admin.");
        router.replace("/auth");
        return;
      }

      const token = await getIdTokenResult(user, true);

      if (token.claims.admin !== true) {
        Alert.alert("Access denied", "Admin permission is required.");
        router.replace("/");
        return;
      }

      const ordersQuery = query(
        collection(db, "orders"),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(ordersQuery);

      const fetchedOrders = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Order[];

      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Load orders error:", error);
      Alert.alert(
        "Unable to load orders",
        "Check your internet connection and Firestore rules.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const changeStatus = (order: Order) => {
    setSelectedOrder(order);
    setStatusModalVisible(true);
  };

  const saveStatus = async (orderId: string, status: string) => {
    try {
      setUpdatingId(orderId);

      const user = auth.currentUser;

      if (!user) {
        throw new Error("Admin session expired. Please sign in again.");
      }

      const token = await getIdTokenResult(user, true);

      if (token.claims.admin !== true) {
        throw new Error("Admin permission is required.");
      }

      const response = await fetch(
        "https://aquapure-payment-api.onrender.com/admin/order-status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token.token}`,
          },
          body: JSON.stringify({ orderId, status }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not update order status.");
      }

      setOrders((previous) =>
        previous.map((order) =>
          order.id === orderId ? { ...order, status } : order,
        ),
      );

      Alert.alert(
        "Success",
        result.notificationSent
          ? `Order status changed to ${status}. Notification accepted by Expo.`
          : `Order status changed to ${status}. ${result.message}`,
      );
    } catch (error) {
      console.error("Update order error:", error);
      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const visibleOrders =
    filter === "all"
      ? orders
      : orders.filter((order) => order.status === filter);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Date unavailable";

    const date =
      typeof timestamp.toDate === "function"
        ? timestamp.toDate()
        : new Date(timestamp);

    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : date.toLocaleString("en-IN");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.muted}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Manage Orders</Text>
        <Text style={styles.subtitle}>{orders.length} total orders</Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={["all", ...ORDER_STATUSES]}
        keyExtractor={(item) => item}
        style={styles.filterList}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setFilter(item)}
            style={[
              styles.filterButton,
              filter === item && styles.filterActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item && styles.filterTextActive,
              ]}
            >
              {item === "all"
                ? "All"
                : item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrders();
            }}
            colors={["#087E8B"]}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No orders found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.orderHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderId}>Order #{item.id.slice(-6)}</Text>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              </View>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status || "placed"}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>CUSTOMER DETAILS</Text>
            <Text style={styles.detail}>
              Name: {item.customerName || "Not provided"}
            </Text>
            <Text style={styles.detail}>
              Phone: {item.phone || "Not provided"}
            </Text>
            <Text style={styles.detail}>
              Email: {item.email || "Not provided"}
            </Text>
            <Text style={styles.detail}>
              Address: {item.address || "Not provided"}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>
              ITEMS ({item.items?.length || 0})
            </Text>

            {(item.items || []).map((product, index) => (
              <View
                key={`${product.productId}-${index}`}
                style={styles.itemRow}
              >
                <Text style={styles.itemName}>
                  {product.name} × {product.quantity}
                </Text>
                <Text style={styles.itemPrice}>
                  ₹
                  {(
                    product.subtotal ?? product.price * product.quantity
                  ).toLocaleString("en-IN")}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.sectionLabel}>PAYMENT</Text>
                <Text style={styles.detail}>
                  {item.paymentMethod || "Not specified"}
                </Text>
                <Text style={styles.detail}>
                  Status: {item.paymentStatus || "pending"}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.sectionLabel}>ORDER TOTAL</Text>
                <Text style={styles.total}>
                  ₹{(item.total || 0).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.updateButton,
                updatingId === item.id && styles.disabledButton,
              ]}
              disabled={updatingId === item.id}
              onPress={() => changeStatus(item)}
            >
              <Text style={styles.updateButtonText}>
                {updatingId === item.id ? "Updating..." : "Update Order Status"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 22,
              width: "100%",
              maxWidth: 400,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 6 }}>
              Update order status
            </Text>

            <Text style={{ color: "#64748B", marginBottom: 18 }}>
              Order #{selectedOrder?.id.slice(-6)}
            </Text>

            {ORDER_STATUSES.filter(
              (status) => status !== selectedOrder?.status,
            ).map((status) => (
              <TouchableOpacity
                key={status}
                disabled={
                  selectedOrder ? updatingId === selectedOrder.id : true
                }
                onPress={async () => {
                  if (!selectedOrder) return;

                  const orderId = selectedOrder.id;
                  setStatusModalVisible(false);
                  await saveStatus(orderId, status);
                }}
                style={{
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: "#F1F5F9",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: "#0F172A",
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setStatusModalVisible(false)}
              style={{ padding: 12, alignItems: "center" }}
            >
              <Text style={{ color: "#64748B", fontWeight: "600" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4FAFC",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4FAFC",
  },
  muted: {
    marginTop: 10,
    color: "#58717A",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  back: {
    color: "#087E8B",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 14,
  },
  title: {
    color: "#173B45",
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: "#58717A",
    fontSize: 14,
    marginTop: 4,
  },
  filterList: {
    flexGrow: 0,
    flexShrink: 0,
    height: 54,
  },

  filters: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    alignItems: "center",
  },

  filterButton: {
    borderWidth: 1,
    borderColor: "#C8DDE2",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 38,
  },

  filterActive: {
    backgroundColor: "#087E8B",
    borderColor: "#087E8B",
  },

  filterText: {
    color: "#36545D",
    fontSize: 13,
    fontWeight: "700",
    includeFontPadding: true,
  },

  filterTextActive: {
    color: "#FFFFFF",
  },
  list: {
    padding: 14,
    paddingBottom: 30,
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E0ECEF",
    marginBottom: 14,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  orderId: {
    fontSize: 17,
    fontWeight: "800",
    color: "#173B45",
  },
  date: {
    color: "#71868D",
    fontSize: 12,
    marginTop: 5,
  },
  statusBadge: {
    backgroundColor: "#E4F5F4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    color: "#087E8B",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: "#E6EFF1",
    marginVertical: 13,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#71868D",
    letterSpacing: 0.7,
    marginBottom: 7,
  },
  detail: {
    color: "#36545D",
    fontSize: 13,
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginVertical: 5,
  },
  itemName: {
    flex: 1,
    color: "#36545D",
    fontSize: 13,
  },
  itemPrice: {
    color: "#173B45",
    fontSize: 13,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  total: {
    fontSize: 21,
    color: "#087E8B",
    fontWeight: "800",
  },
  updateButton: {
    backgroundColor: "#087E8B",
    paddingVertical: 13,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  empty: {
    textAlign: "center",
    color: "#71868D",
    marginTop: 50,
    fontSize: 15,
  },
});
