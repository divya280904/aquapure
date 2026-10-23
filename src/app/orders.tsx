
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";

type Order = {
  id: string;
  customerName: string;
  total: number;
  status: string;
  paymentMethod: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
  createdAt?: { toDate: () => Date };
};

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const user = auth.currentUser;

    if (!user) {
      setOrders([]);
      setLoading(false);
      router.replace("/auth");
      return;
    }

    setLoading(true);

    try {
      const ordersQuery = query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
      );

      const snapshot = await getDocs(ordersQuery);

      const result = snapshot.docs.map((orderDoc) => ({
        id: orderDoc.id,
        ...orderDoc.data(),
      })) as Order[];

      result.sort((a, b) => {
        const dateA = a.createdAt?.toDate().getTime() ?? 0;
        const dateB = b.createdAt?.toDate().getTime() ?? 0;
        return dateB - dateA;
      });

      setOrders(result);
    } catch (error) {
      console.error("Load orders error:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.muted}>Loading your orders...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[
        styles.container,
        orders.length === 0 && styles.emptyContainer,
      ]}
      data={orders}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <Text style={styles.heading}>My Orders</Text>
      }
      ListEmptyComponent={
        <Text style={styles.muted}>
          You haven't placed any orders yet.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.orderId}>
            Order #{item.id.slice(-8)}
          </Text>
          <Text style={styles.total}>
            Total: ₹{Number(item.total).toLocaleString("en-IN")}
          </Text>
          <Text style={styles.detail}>
            Status: {item.status}
          </Text>
          <Text style={styles.detail}>
            Payment: {item.paymentMethod}
          </Text>
          {item.createdAt && (
            <Text style={styles.date}>
              {item.createdAt.toDate().toLocaleString("en-IN")}
            </Text>
          )}
          <View style={styles.divider} />
          {item.items?.map((product, index) => (
            <Text key={`${item.id}-${index}`} style={styles.product}>
              {product.name} × {product.quantity} — ₹
              {Number(product.subtotal).toLocaleString("en-IN")}
            </Text>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: "#F7FAFC",
  },
  container: {
    padding: 18,
    paddingBottom: 36,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F7FAFC",
  },
  heading: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#123B5D",
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  orderId: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#123B5D",
    marginBottom: 8,
  },
  total: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#087E8B",
    marginBottom: 8,
  },
  detail: {
    color: "#475569",
    marginBottom: 4,
  },
  date: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 12,
  },
  product: {
    color: "#334155",
    marginBottom: 6,
  },
  muted: {
    color: "#64748B",
    marginTop: 8,
  },
});
