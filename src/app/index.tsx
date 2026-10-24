import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, getIdTokenResult } from "firebase/auth";
import { Alert } from "react-native";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useCart } from "../context/CartContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type Category =
  | "All"
  | "Purifiers"
  | "Filters"
  | "Dispensers"
  | "Pumps"
  | "Spare Parts";

type Product = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  price: number;
  dealerPrice: number;
  emoji: string;
  imageUrl?: string;
};

const categoryData: {
  category: Exclude<Category, "All">;
  emoji: string;
  names: string[];
  basePrice: number;
}[] = [
  {
    category: "Purifiers",
    emoji: "💧",
    basePrice: 6999,
    names: [
      "RO Water Purifier",
      "UV Water Purifier",
      "UF Water Purifier",
      "RO + UV Purifier",
      "RO + UV + UF Purifier",
      "Copper RO Purifier",
      "Alkaline Water Purifier",
      "Under Sink Purifier",
      "Wall Mount Purifier",
      "Commercial RO Purifier",
    ],
  },
  {
    category: "Filters",
    emoji: "🧪",
    basePrice: 299,
    names: [
      "Sediment Filter",
      "Carbon Filter",
      "RO Membrane 75 GPD",
      "RO Membrane 100 GPD",
      "UF Filter Cartridge",
      "UV Filter Cartridge",
      "Pre-Filter Cartridge",
      "Post Carbon Filter",
      "Mineral Filter",
      "Alkaline Filter",
    ],
  },
  {
    category: "Dispensers",
    emoji: "🚰",
    basePrice: 1499,
    names: [
      "Hot Water Dispenser",
      "Cold Water Dispenser",
      "Hot and Cold Dispenser",
      "Tabletop Water Dispenser",
      "Floor Standing Dispenser",
      "Bottom Load Dispenser",
      "Bottleless Water Dispenser",
      "Office Water Dispenser",
      "Compact Water Dispenser",
      "Stainless Steel Dispenser",
    ],
  },
  {
    category: "Pumps",
    emoji: "⚙️",
    basePrice: 799,
    names: [
      "RO Booster Pump 75 GPD",
      "RO Booster Pump 100 GPD",
      "High Pressure RO Pump",
      "Low Noise RO Pump",
      "24V RO Pump",
      "36V RO Pump",
      "Water Transfer Pump",
      "Self Priming Pump",
      "Commercial RO Pump",
      "Pump Repair Kit",
    ],
  },
  {
    category: "Spare Parts",
    emoji: "🔧",
    basePrice: 99,
    names: [
      "RO Pipe Set",
      "Filter Housing",
      "Water Flow Restrictor",
      "Auto Shut Off Valve",
      "Solenoid Valve",
      "Float Valve",
      "RO Faucet",
      "TDS Controller",
      "Power Adapter 24V",
      "Filter Wrench",
    ],
  },
];

const mockProducts: Product[] = categoryData.flatMap((group, groupIndex) =>
  group.names.map((name, index) => {
    const price =
      group.basePrice +
      index * (groupIndex === 0 ? 650 : groupIndex === 1 ? 80 : 150);

    return {
      id: `${groupIndex}-${index}`,
      name,
      category: group.category,
      price,
      dealerPrice: Math.round(price * 0.8),
      emoji: group.emoji,
    };
  }),
);

const categories: Category[] = [
  "All",
  "Purifiers",
  "Filters",
  "Dispensers",
  "Pumps",
  "Spare Parts",
];

export default function HomeScreen() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const { cart, addToCart, setQuantity, removeFromCart } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const [isApprovedDealer, setIsApprovedDealer] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(true);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountRole, setAccountRole] = useState("customer");

  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        console.log("Loading products from Firestore...");

        const snapshot = await getDocs(collection(db, "products"));

        console.log("Firestore documents found:", snapshot.size);

        const validCategories = [
          "Purifiers",
          "Filters",
          "Dispensers",
          "Pumps",
          "Spare Parts",
        ];

        const emojiByCategory: Record<string, string> = {
          Purifiers: "💧",
          Filters: "🧪",
          Dispensers: "🚰",
          Pumps: "⚙️",
          "Spare Parts": "🔧",
        };

        const loadedProducts: Product[] = snapshot.docs.map((document) => {
          const data = document.data();

          const category = (
            validCategories.includes(data.category)
              ? data.category
              : "Spare Parts"
          ) as Exclude<Category, "All">;

          const price = Number(data.price ?? 0);

          return {
            id: document.id,
            name: String(data.name ?? "Unnamed product"),
            category,
            price,
            dealerPrice: Number(data.dealerPrice ?? Math.round(price * 0.8)),
            emoji: emojiByCategory[category],
            imageUrl: String(data.imageUrl ?? ""),
          };
        });

        if (isMounted) {
          setProducts(loadedProducts);
          console.log("Products sent to screen:", loadedProducts.length);
        }
      } catch (error) {
        console.error("Firestore product loading failed:", error);

        if (isMounted) {
          setProducts([]);
        }
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsSignedIn(false);
        setCurrentUserName("");
        setIsAdmin(false);
        setAccountRole("customer");
        setIsApprovedDealer(false);
        setCheckingAccount(false);
        return;
      }

      setIsSignedIn(true);
      setCheckingAccount(true);

      try {
        const [userSnapshot, tokenResult] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getIdTokenResult(user),
        ]);

        const profile = userSnapshot.exists() ? userSnapshot.data() : {};

        const admin =
          tokenResult.claims.admin === true || profile.role === "admin";

        setIsAdmin(admin);
        setAccountRole(profile.role || "customer");
        setCurrentUserName(
          profile.name ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "My Account",
        );

        setIsApprovedDealer(
          profile.role === "dealer" && profile.dealerStatus === "approved",
        );
      } catch (error) {
        console.error("Error loading account:", error);
        setIsApprovedDealer(false);
      } finally {
        setCheckingAccount(false);
      }
    });

    return unsubscribe;
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory;

      const matchesSearch =
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

  const cartCount = Object.values(cart).reduce(
    (total, quantity) => total + quantity,
    0,
  );

  const cartTotal = products.reduce((total, product) => {
    const unitPrice = isApprovedDealer ? product.dealerPrice : product.price;

    return total + unitPrice * (cart[product.id] || 0);
  }, 0);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: "#F4FAFC" }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <StatusBar barStyle="dark-content" />

      {/* Scrollable product catalogue */}
      <FlatList
        style={{ flex: 1 }}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.productRow}
        ListHeaderComponent={
          <View>
            {/* Header */}

            {/* Header */}
            <View style={styles.topBar}>
              <View>
                <Text style={styles.brand}>
                  aqua<Text style={styles.brandAccent}>pure</Text>
                </Text>
                <Text style={styles.tagline}>Pure water. Better living.</Text>
              </View>

              <View style={styles.headerActions}>
                {/* Profile icon */}
                <Pressable
                  style={styles.headerIconButton}
                  onPress={() => router.push(isSignedIn ? "/profile" : "/auth")}
                  accessibilityRole="button"
                  accessibilityLabel={isSignedIn ? "My Profile" : "Sign in"}
                >
                  <Ionicons
                    name={
                      isSignedIn ? "person-circle" : "person-circle-outline"
                    }
                    size={29}
                    color="#087E8B"
                  />
                </Pressable>

                {/* Cart count */}
                <TouchableOpacity
                  style={styles.cartBadge}
                  onPress={() => router.push("/cart")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cartText}>🛒 {cartCount}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hero section */}
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>YOUR DAILY DOSE OF PURE</Text>

              <Text style={styles.heroTitle}>
                Better water,{`\n`}better living.
              </Text>

              <Text style={styles.heroSubtitle}>
                Find the right purifier for your home.
              </Text>

              <View style={styles.heroDrop}>
                <Text style={styles.heroEmoji}>💧</Text>
              </View>
            </View>

            {/* Search */}
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search purifiers, filters, parts..."
              placeholderTextColor="#81939B"
              style={styles.search}
              returnKeyType="search"
            />

            {/* Categories */}
            <Text style={styles.sectionTitle}>Shop by category</Text>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.categories}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedCategory(item)}
                  style={[
                    styles.categoryPill,
                    selectedCategory === item && styles.categoryPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === item && styles.categoryTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />

            {/* Product heading */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Popular products</Text>

              <Text style={styles.count}>{filteredProducts.length} items</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          /* Product card */
          <View style={styles.card}>
            <View style={styles.productImage}>
              <View style={styles.productPhotoContainer}>
                {item.imageUrl && !failedImages[item.id] ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.productPhoto}
                    resizeMode="contain"
                    onError={() => {
                      setFailedImages((prev) => ({ ...prev, [item.id]: true }));
                    }}
                  />
                ) : (
                  <Text style={styles.productEmoji}>{item.emoji || "💧"}</Text>
                )}
              </View>

              <Text style={styles.productCategory}>{item.category}</Text>
            </View>

            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>

            <Text style={styles.productPrice}>
              ₹
              {(isApprovedDealer
                ? item.dealerPrice
                : item.price
              ).toLocaleString("en-IN")}
            </Text>

            {isApprovedDealer && (
              <Text
                style={{
                  color: "#087E8B",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Dealer price
              </Text>
            )}

            {(cart[item.id] || 0) > 0 ? (
              <View style={styles.cartControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => {
                    const quantity = cart[item.id] || 0;

                    if (quantity <= 1) {
                      removeFromCart(item.id);
                    } else {
                      setQuantity(item.id, quantity - 1);
                    }
                  }}
                >
                  <Text style={styles.quantityButtonText}>−</Text>
                </TouchableOpacity>

                <Text style={styles.quantityText}>{cart[item.id]}</Text>

                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => addToCart(item.id)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => addToCart(item.id)}
              >
                <Text style={styles.addButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loadingProducts
              ? "Loading products..."
              : search.trim() || selectedCategory !== "All"
                ? "No products match your search or category."
                : "No products found. Check your Firestore products collection."}
          </Text>
        }
      />

      {/* Fixed cart section — outside the FlatList */}
      {/* Fixed compact cart section */}
      <View style={styles.footer}>
        <View style={styles.cartSummary}>
          <Text style={styles.footerLabel}>YOUR CART</Text>
          <Text style={styles.footerTotal}>
            {cartCount} items · ₹{cartTotal.toLocaleString("en-IN")}
          </Text>
        </View>

        <View style={styles.cartActions}>
          <Link href="/orders" asChild>
            <TouchableOpacity style={styles.ordersButton}>
              <Text style={styles.ordersButtonText}>My Orders</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/checkout" asChild>
            <TouchableOpacity style={styles.checkoutButton}>
              <Text style={styles.checkoutButtonText}>Checkout</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FAFC" },
  list: { paddingHorizontal: 18, paddingBottom: 32 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 20,
  },
  brand: { fontSize: 27, fontWeight: "900", color: "#123B50" },
  brandAccent: { color: "#0D9C9A" },
  tagline: { fontSize: 12, color: "#6B828C", marginTop: 2 },
  cartBadge: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0ECEF",
  },
  cartText: { fontWeight: "700", color: "#123B50" },
  hero: {
    backgroundColor: "#123B50",
    borderRadius: 24,
    padding: 22,
    minHeight: 190,
    overflow: "hidden",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#8DE3DB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "800",
    lineHeight: 35,
    marginTop: 10,
  },
  heroSubtitle: {
    color: "#D4E7ED",
    fontSize: 12,
    marginTop: 9,
    maxWidth: "75%",
  },
  heroDrop: {
    position: "absolute",
    right: -12,
    bottom: 14,
    width: 115,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#20586B",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 62 },
  search: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E1ECEF",
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 20,
    color: "#123B50",
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#173B4B",
    marginTop: 24,
    marginBottom: 12,
  },
  categories: { gap: 8, paddingBottom: 3 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0EAED",
  },
  categoryPillActive: {
    backgroundColor: "#0D9C9A",
    borderColor: "#0D9C9A",
  },
  categoryText: { color: "#58717B", fontSize: 12, fontWeight: "600" },
  categoryTextActive: { color: "#FFFFFF" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  count: { color: "#71858D", fontSize: 12, marginTop: 12 },
  productRow: { justifyContent: "space-between", gap: 12 },
  card: {
    flex: 1,
    maxWidth: "49%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 11,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#E7EFF1",
  },
  productImage: {
    height: 115,
    backgroundColor: "#EAF5F7",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  productEmoji: { fontSize: 42 },
  productCategory: {
    fontSize: 9,
    fontWeight: "700",
    color: "#62818A",
    marginTop: 6,
  },
  productName: {
    color: "#193B49",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    minHeight: 36,
  },
  productPrice: {
    color: "#0B7778",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: "#123B50",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  addButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  empty: { textAlign: "center", color: "#6B828C", padding: 30 },
  footer: {
    backgroundColor: "#E5F3F4",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#DCE9ED",
  },
  footerLabel: {
    color: "#58717A",
    fontSize: 11,
    fontWeight: "700",
  },
  footerTotal: {
    color: "#173B45",
    fontSize: 14,
    fontWeight: "700",
  },
  footerHint: { color: "#607A83", fontSize: 11, marginTop: 7 },
  checkoutButton: {
    flex: 1,
    backgroundColor: "#087E8B",
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  checkoutButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  cartActions: {
    flexDirection: "row",
    gap: 10,
  },

  ordersButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#087E8B",
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  ordersButtonText: {
    color: "#087E8B",
    fontSize: 14,
    fontWeight: "700",
  },
  cartSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  accountBar: {
    marginVertical: 10,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE9ED",
  },

  signInButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#E6F5F6",
    borderRadius: 9,
    alignItems: "center",
  },

  signInButtonText: {
    color: "#087E8B",
    fontSize: 14,
    fontWeight: "700",
  },

  signedInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  accountInfo: {
    flex: 1,
    minWidth: 0,
  },

  accountWelcome: {
    color: "#58717A",
    fontSize: 11,
  },

  accountName: {
    color: "#173B45",
    fontSize: 14,
    fontWeight: "700",
  },

  accountRole: {
    color: "#087E8B",
    fontSize: 11,
    marginTop: 2,
  },

  dashboardButton: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "#E6F5F6",
    borderRadius: 8,
  },

  dashboardButtonText: {
    color: "#087E8B",
    fontSize: 12,
    fontWeight: "700",
  },

  logoutButton: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    backgroundColor: "#FFF0EE",
    borderRadius: 8,
  },

  logoutButtonText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E6F5F6",
    justifyContent: "center",
    alignItems: "center",
  },

  cartControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    minHeight: 34,
  },
  quantityButton: {
    width: 30,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E0F2F1",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#087E8B",
  },
  quantityText: {
    minWidth: 20,
    textAlign: "center",
    fontWeight: "700",
    color: "#123B5D",
  },
  removeCartButton: {
    width: 30,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  removeCartText: {
    fontSize: 15,
  },

  productPhotoContainer: {
    height: 125,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
  },

  productPhoto: {
    width: "100%",
    height: "100%",
  },
});
