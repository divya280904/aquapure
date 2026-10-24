
import { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

const CATEGORIES = [
  "Purifiers",
  "Filters",
  "Dispensers",
  "Pumps",
  "Spare Parts",
] as const;

type Category = (typeof CATEGORIES)[number];

type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;
  dealerPrice: number;
  imageUrl?: string;
};

export default function AdminProductsScreen() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Purifiers");
  const [price, setPrice] = useState("");
  const [dealerPrice, setDealerPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  async function checkAdmin() {
    const user = auth.currentUser;

    if (!user) {
      setAuthorized(false);
      router.replace("/auth");
      return false;
    }

    const token = await getIdTokenResult(user, true);
    const allowed = token.claims.admin === true;

    setAuthorized(allowed);
    return allowed;
  }

  async function loadProducts() {
    setLoading(true);

    try {
      const snapshot = await getDocs(collection(db, "products"));

      const result: Product[] = snapshot.docs.map((item) => {
        const data = item.data();

        const validCategory = CATEGORIES.includes(data.category)
          ? data.category
          : "Spare Parts";

        return {
          id: item.id,
          name: String(data.name ?? ""),
          category: validCategory as Category,
          price: Number(data.price ?? 0),
          dealerPrice: Number(data.dealerPrice ?? 0),
          imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
        };
      });

      result.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(result);
    } catch (error) {
      console.error("Product loading failed:", error);
      Alert.alert("Error", "Could not load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          router.replace("/auth");
          return;
        }

        const token = await getIdTokenResult(user, true);

        if (!active) return;

        if (token.claims.admin !== true) {
          setAuthorized(false);
          return;
        }

        setAuthorized(true);
        await loadProducts();
      } catch (error) {
        console.error("Admin verification failed:", error);
        if (active) {
          setAuthorized(false);
          Alert.alert("Access error", "Could not verify admin access.");
        }
      } finally {
        if (active) setChecking(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory("Purifiers");
    setPrice("");
    setDealerPrice("");
    setImageUrl("");
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setCategory(product.category);
    setPrice(String(product.price));
    setDealerPrice(String(product.dealerPrice));
    setImageUrl(product.imageUrl || "");
  }

  async function saveProduct() {
    if (!authorized || saving) return;

    const cleanName = name.trim();
    const retailPrice = Number(price);
    const wholesalePrice = Number(dealerPrice);

    if (!cleanName || !price.trim() || !dealerPrice.trim()) {
      Alert.alert("Missing details", "Fill in all product fields.");
      return;
    }

    if (
      !Number.isFinite(retailPrice) ||
      !Number.isFinite(wholesalePrice) ||
      retailPrice <= 0 ||
      wholesalePrice <= 0
    ) {
      Alert.alert("Invalid prices", "Enter valid prices greater than zero.");
      return;
    }

    if (wholesalePrice > retailPrice) {
      Alert.alert(
        "Check dealer price",
        "The dealer price should not exceed the retail price."
      );
      return;
    }

    setSaving(true);

    try {
      const productData = {
        name: cleanName,
        category,
        price: retailPrice,
        dealerPrice: wholesalePrice,
        imageUrl: imageUrl.trim() || null,
      };

      if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
        Alert.alert("Updated", "Product details have been saved.");
      } else {
        await addDoc(collection(db, "products"), productData);
        Alert.alert("Added", "New product added to the catalog.");
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      console.error("Product save failed:", error);
      Alert.alert(
        "Save failed",
        "Check your connection, admin access, and Firestore rules."
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(product: Product) {
    if (!authorized) return;

    Alert.alert(
      "Delete product?",
      `Remove "${product.name}" from the catalog? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "products", product.id));
              setProducts((current) =>
                current.filter((item) => item.id !== product.id)
              );

              if (editingId === product.id) resetForm();

              Alert.alert("Deleted", "Product removed from the catalog.");
            } catch (error) {
              console.error("Product deletion failed:", error);
              Alert.alert("Delete failed", "Could not delete this product.");
            }
          },
        },
      ]
    );
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text style={styles.muted}>Verifying admin access...</Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Admin access required</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace("/auth")}
        >
          <Text style={styles.primaryText}>Go to login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.replace("/admin")}>
        <Text style={styles.back}>← Back to dashboard</Text>
      </Pressable>

      <Text style={styles.title}>Product management</Text>
      <Text style={styles.muted}>
        Add products or update your existing catalog.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>
          {editingId ? "Edit product" : "Add a new product"}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Product name"
          placeholderTextColor="#81939B"
          style={styles.input}
        />

        <Text style={styles.label}>Category</Text>

        <View style={styles.categories}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.categoryButton,
                category === item && styles.categoryActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="Retail price (₹)"
          keyboardType="decimal-pad"
          placeholderTextColor="#81939B"
          style={styles.input}
        />

        <TextInput
          value={dealerPrice}
          onChangeText={setDealerPrice}
          placeholder="Dealer price (₹)"
          keyboardType="decimal-pad"
          placeholderTextColor="#81939B"
          style={styles.input}
        />

        <TextInput
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="Product image URL (https://...)"
          autoCapitalize="none"
          keyboardType="url"
          placeholderTextColor="#81939B"
          style={styles.input}
        />

        <Pressable
          disabled={saving}
          style={[styles.primaryButton, saving && styles.disabled]}
          onPress={saveProduct}
        >
          <Text style={styles.primaryText}>
            {saving
              ? "Saving..."
              : editingId
                ? "Save changes"
                : "Add product"}
          </Text>
        </Pressable>

        {editingId && (
          <Pressable style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelText}>Cancel editing</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>
          Catalog ({products.length})
        </Text>

        <Pressable onPress={loadProducts}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#087E8B" size="large" />
      ) : (
        products.map((product) => (
          <View key={product.id} style={styles.productCard}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.muted}>{product.category}</Text>

            <Text style={styles.price}>
              Retail: ₹{product.price.toLocaleString("en-IN")}
            </Text>

            <Text style={styles.dealerPrice}>
              Dealer: ₹{product.dealerPrice.toLocaleString("en-IN")}
            </Text>

            <View style={styles.actions}>
              <Pressable
                style={styles.editButton}
                onPress={() => startEditing(product)}
              >
                <Text style={styles.editText}>Edit</Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => confirmDelete(product)}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F8FB" },
  content: { padding: 20, paddingTop: 55, paddingBottom: 40, gap: 14 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F8FB",
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#102A43" },
  heading: { fontSize: 22, fontWeight: "800", color: "#102A43" },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#102A43" },
  muted: { fontSize: 13, color: "#62748A" },
  back: { color: "#087E8B", fontWeight: "700", fontSize: 15 },
  form: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E1EAF0",
  },
  label: { fontWeight: "700", color: "#102A43" },
  input: {
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#DCE5EF",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 10,
    color: "#102A43",
  },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryButton: {
    borderWidth: 1,
    borderColor: "#DCE5EF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryActive: { backgroundColor: "#E2F5F4", borderColor: "#087E8B" },
  categoryText: { color: "#62748A", fontSize: 12, fontWeight: "600" },
  categoryTextActive: { color: "#087E8B" },
  primaryButton: {
    backgroundColor: "#087E8B",
    padding: 14,
    borderRadius: 11,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  cancelButton: { alignItems: "center", padding: 10 },
  cancelText: { color: "#62748A", fontWeight: "700" },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  refresh: { color: "#087E8B", fontWeight: "700" },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E1EAF0",
  },
  productName: { fontSize: 16, fontWeight: "800", color: "#102A43" },
  price: { color: "#102A43", fontWeight: "700" },
  dealerPrice: { color: "#087E8B", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  editButton: {
    flex: 1,
    backgroundColor: "#E2F5F4",
    padding: 11,
    borderRadius: 9,
    alignItems: "center",
  },
  editText: { color: "#087E8B", fontWeight: "800" },
  deleteButton: {
    flex: 1,
    backgroundColor: "#FDE8E7",
    padding: 11,
    borderRadius: 9,
    alignItems: "center",
  },
  deleteText: { color: "#B42318", fontWeight: "800" },
});
