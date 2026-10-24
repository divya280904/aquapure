
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../firebase";
import { useCart } from "../context/CartContext";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  dealerPrice: number;
  emoji: string;
  imageUrl: string;
};

export default function CartScreen() {
  const router = useRouter();
  const { cart, setQuantity, removeFromCart } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDealer, setIsDealer] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadCartProducts() {
      try {
        const snapshot = await getDocs(collection(db, "products"));

        if (mounted) {
          setProducts(
            snapshot.docs.map((document) => {
              const data = document.data();
              const price = Number(data.price ?? 0);

              return {
                id: document.id,
                name: String(data.name ?? "Unnamed product"),
                category: String(data.category ?? "Spare Parts"),
                price,
                dealerPrice: Number(
                  data.dealerPrice ?? Math.round(price * 0.8)
                ),
                emoji: "💧",
                imageUrl: String(data.imageUrl ?? ""),
              };
            })
          );
        }
      } catch (error) {
        console.error("Failed to load cart products:", error);
        Alert.alert("Error", "Could not load your cart products.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCartProducts();

    return () => {
      mounted = false;
    };
  }, []);

  const cartItems = products.filter(
    (product) => Number(cart[product.id] ?? 0) > 0
  );

  const totalItems = cartItems.reduce(
    (total, product) => total + Number(cart[product.id] ?? 0),
    0
  );

  const subtotal = cartItems.reduce(
    (total, product) =>
      total +
      (isDealer ? product.dealerPrice : product.price) *
        Number(cart[product.id] ?? 0),
    0
  );

  const formatPrice = (price: number) =>
    `₹${price.toLocaleString("en-IN")}`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.muted}>Loading your cart...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Cart</Text>
      <Text style={styles.muted}>
        {totalItems} {totalItems === 1 ? "item" : "items"}
      </Text>

      {cartItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.muted}>
            Add products from the catalog to see them here.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.primaryButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const quantity = Number(cart[item.id] ?? 0);
              const price = isDealer ? item.dealerPrice : item.price;

              return (
                <View style={styles.card}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.productImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.placeholder}>
                      <Text style={styles.productEmoji}>{item.emoji}</Text>
                    </View>
                  )}

                  <View style={styles.details}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.category}>{item.category}</Text>
                    <Text style={styles.price}>{formatPrice(price)}</Text>

                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => setQuantity(item.id, quantity - 1)}
                      >
                        <Text style={styles.quantityButtonText}>−</Text>
                      </TouchableOpacity>

                      <Text style={styles.quantity}>{quantity}</Text>

                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => setQuantity(item.id, quantity + 1)}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => removeFromCart(item.id)}
                      >
                        <Text style={styles.remove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.lineTotal}>
                    {formatPrice(price * quantity)}
                  </Text>
                </View>
              );
            }}
          />

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.total}>{formatPrice(subtotal)}</Text>
            </View>

            <Text style={styles.muted}>
              Shipping and other charges, if applicable, are calculated at
              checkout.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push("/checkout")}
            >
              <Text style={styles.primaryButtonText}>
                Proceed to Checkout
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 26, fontWeight: "700", color: "#123047" },
  muted: { color: "#657786", marginTop: 6 },
  list: { paddingTop: 12, paddingBottom: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  productImage: { width: 78, height: 90 },
  placeholder: {
    width: 78,
    height: 90,
    backgroundColor: "#EAF5F6",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  productEmoji: { fontSize: 30 },
  details: { flex: 1 },
  productName: { fontSize: 15, fontWeight: "700", color: "#123047" },
  category: { fontSize: 12, color: "#657786", marginTop: 3 },
  price: { fontSize: 15, fontWeight: "700", color: "#087E8B", marginTop: 5 },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 9,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#EAF5F6",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonText: { fontSize: 20, color: "#087E8B" },
  quantity: { fontWeight: "700", minWidth: 12, textAlign: "center" },
  remove: { color: "#D14343", fontSize: 12, fontWeight: "600" },
  lineTotal: { fontSize: 13, fontWeight: "700", color: "#123047" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 12 },
  primaryButton: {
    backgroundColor: "#087E8B",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  footer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 17, fontWeight: "600" },
  total: { fontSize: 22, fontWeight: "700", color: "#087E8B" },
});
