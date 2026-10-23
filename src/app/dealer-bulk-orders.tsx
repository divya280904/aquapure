
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useCart } from "../context/CartContext";

type Product = {
  id: string;
  name: string;
  category?: string;
  price: number;
  dealerPrice: number;
  emoji?: string;
};

export default function DealerBulkOrdersScreen() {
  const router = useRouter();
  const { cart, setQuantity } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        Alert.alert("Sign in required", "Please sign in with your dealer account.", [
          { text: "OK", onPress: () => router.replace("/auth") },
        ]);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const profile = userSnap.data();

        if (
          profile?.role !== "dealer" ||
          profile?.dealerStatus !== "approved"
        ) {
          setLoading(false);
          Alert.alert(
            "Dealer access only",
            "Bulk ordering is available to approved dealers only.",
            [{ text: "OK", onPress: () => router.replace("/") }]
          );
          return;
        }

        setAuthorized(true);

        const productsSnap = await getDocs(collection(db, "products"));
        const loadedProducts = productsSnap.docs.map((productDoc) => {
          const data = productDoc.data();

          return {
            id: productDoc.id,
            name: data.name ?? "Unnamed product",
            category: data.category ?? "",
            price: Number(data.price ?? 0),
            dealerPrice: Number(data.dealerPrice ?? data.price ?? 0),
            emoji: data.emoji ?? "💧",
          };
        });

        setProducts(loadedProducts);
      } catch (error) {
        console.error("Bulk order loading failed:", error);
        Alert.alert("Error", "Could not load products. Please try again.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const selectedProducts = useMemo(
    () =>
      products
        .map((product) => ({
          ...product,
          quantity: Math.max(
            0,
            Math.floor(Number(quantities[product.id] || 0))
          ),
        }))
        .filter((product) => product.quantity > 0),
    [products, quantities]
  );

  const total = selectedProducts.reduce(
    (sum, product) => sum + product.dealerPrice * product.quantity,
    0
  );

  const addBulkOrderToCart = () => {
    if (selectedProducts.length === 0) {
      Alert.alert("Select products", "Enter a quantity for at least one product.");
      return;
    }

    selectedProducts.forEach((product) => {
      setQuantity(
        product.id,
        (cart[product.id] || 0) + product.quantity
      );
    });

    Alert.alert(
      "Bulk order added",
      `${selectedProducts.length} product type(s) added to your cart.`,
      [{ text: "Continue to checkout", onPress: () => router.push("/checkout") }]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.muted}>Loading dealer products...</Text>
      </View>
    );
  }

  if (!authorized) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Dealer Bulk Orders</Text>
        <Text style={styles.subtitle}>
          Enter quantities to order multiple products at wholesale prices.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {products.map((product) => (
          <View key={product.id} style={styles.card}>
            <View style={styles.productInfo}>
              <Text style={styles.emoji}>{product.emoji}</Text>
              <View style={styles.productText}>
                <Text style={styles.productName}>{product.name}</Text>
                {!!product.category && (
                  <Text style={styles.category}>{product.category}</Text>
                )}
                <Text style={styles.price}>
                  ₹{product.dealerPrice.toLocaleString("en-IN")} per unit
                </Text>
                {product.price > product.dealerPrice && (
                  <Text style={styles.retail}>
                    Retail: ₹{product.price.toLocaleString("en-IN")}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <TextInput
                style={styles.quantityInput}
                value={quantities[product.id] ?? ""}
                onChangeText={(value) => {
                  if (/^\d*$/.test(value)) {
                    setQuantities((prev) => ({
                      ...prev,
                      [product.id]: value,
                    }));
                  }
                }}
                placeholder="0"
                keyboardType="number-pad"
                maxLength={5}
              />
              <Text style={styles.lineTotal}>
                ₹{(
                  product.dealerPrice *
                  Math.max(0, Math.floor(Number(quantities[product.id] || 0)))
                ).toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>
            {selectedProducts.reduce((sum, p) => sum + p.quantity, 0)} total units
          </Text>
          <Text style={styles.total}>₹{total.toLocaleString("en-IN")}</Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={addBulkOrderToCart}
        >
          <Text style={styles.buttonText}>Add Bulk Order</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F8FA" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: {
    padding: 18,
    paddingTop: 24,
    backgroundColor: "#FFFFFF",
  },
  back: { color: "#087E8B", fontSize: 16, marginBottom: 12 },
  heading: { fontSize: 23, fontWeight: "700", color: "#123047" },
  subtitle: { color: "#607582", marginTop: 6, lineHeight: 20 },
  muted: { color: "#607582" },
  list: { padding: 14, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3EBEF",
  },
  productInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 30 },
  productText: { flex: 1 },
  productName: { fontSize: 16, fontWeight: "700", color: "#173447" },
  category: { color: "#7A8B95", fontSize: 12, marginTop: 3 },
  price: { color: "#087E8B", fontWeight: "700", marginTop: 5 },
  retail: {
    color: "#89969D",
    textDecorationLine: "line-through",
    fontSize: 12,
    marginTop: 2,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F4",
    gap: 10,
  },
  quantityLabel: { color: "#526875", flex: 1 },
  quantityInput: {
    width: 76,
    height: 42,
    borderWidth: 1,
    borderColor: "#CCD9DF",
    borderRadius: 9,
    textAlign: "center",
    fontSize: 16,
    color: "#173447",
    backgroundColor: "#FFFFFF",
  },
  lineTotal: {
    width: 90,
    textAlign: "right",
    fontWeight: "700",
    color: "#173447",
  },
  footer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3EBEF",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerLabel: { color: "#607582", fontSize: 12 },
  total: { fontSize: 22, fontWeight: "800", color: "#123047", marginTop: 3 },
  button: {
    backgroundColor: "#087E8B",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 11,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
});
