import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useCart } from "../context/CartContext";
import { WebView } from "react-native-webview";
import { API_BASE_URL } from "../constants/api";

type CheckoutItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, clearCart, setQuantity, removeFromCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);

  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isDealer, setIsDealer] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");

  const [paymentHtml, setPaymentHtml] = useState("");
  const [paymentWebViewVisible, setPaymentWebViewVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setItems([]);
        setLoadingItems(false);
        return;
      }

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        const userData = userSnapshot.data();

        const approvedDealer =
          userData?.role === "dealer" && userData?.dealerStatus === "approved";

        setIsDealer(approvedDealer);

        if (userData?.name || user.displayName) {
          setName((prev) => prev || userData?.name || user.displayName || "");
        }
        if (userData?.phone) {
          setPhone((prev) => prev || userData?.phone || "");
        }
        if (userData?.address) {
          setAddress((prev) => prev || userData?.address || "");
        }

        const loadedItems: CheckoutItem[] = [];

        for (const [productId, rawQuantity] of Object.entries(cart)) {
          const quantity = Math.max(0, Math.floor(Number(rawQuantity)));

          if (quantity <= 0) continue;

          const productSnapshot = await getDoc(doc(db, "products", productId));

          if (!productSnapshot.exists()) continue;

          const product = productSnapshot.data();
          const price = Number(
            approvedDealer ? product.dealerPrice : product.price,
          );

          loadedItems.push({
            productId,
            name: String(product.name ?? "Product"),
            price,
            quantity,
            subtotal: price * quantity,
          });
        }

        setItems(loadedItems);
      } catch (error) {
        console.error("Loading checkout items failed:", error);
        Alert.alert("Error", "Could not load cart items. Please try again.");
      } finally {
        setLoadingItems(false);
      }
    });

    return unsubscribe;
  }, [cart]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  async function startRazorpayPayment() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert("Missing details", "Please fill in all delivery details.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      Alert.alert(
        "Invalid phone",
        "Enter a valid 10-digit Indian mobile number.",
      );
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Login required", "Please log in before paying.");
      router.push("/auth");
      return;
    }

    if (items.length === 0) {
      Alert.alert("Empty cart", "Add available products before checkout.");
      return;
    }

    setPlacing(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/create-order`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            items: items
              .map((item) => ({
                productId: item.productId,
                quantity: Math.max(0, Math.floor(Number(cart[item.productId]))),
              }))
              .filter((item) => item.quantity > 0),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create payment order.");
      }

      const checkoutOptions = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "AquaPure",
        description: "Water purifier products",
        order_id: data.orderId,
        callback_url: `${API_BASE_URL}/razorpay-callback`,
        redirect: true,
        prefill: {
          name: data.customerName,
          email: data.email,
          contact: data.phone,
        },
        theme: {
          color: "#087E8B",
        },
      };

      const optionsJson = JSON.stringify(checkoutOptions);

      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 24px;
              color: #173042;
            }
            button {
              background: #087E8B;
              color: white;
              border: 0;
              border-radius: 8px;
              padding: 14px 22px;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <h2>AquaPure Secure Checkout</h2>
          <p>Complete your payment using Razorpay Test Mode.</p>
          <button id="payButton">Continue to payment</button>
          <p id="message"></p>
          <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
          <script>
            const options = ${optionsJson};
            document.getElementById("payButton").onclick = function () {
              const checkout = new Razorpay(options);
              checkout.open();
            };
            document.getElementById("message").textContent =
              "Tap Continue to payment to open checkout.";
          </script>
        </body>
      </html>
    `;

      setPaymentHtml(html);
      setPaymentWebViewVisible(true);
    } catch (error) {
      Alert.alert(
        "Payment could not start",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  }

  async function placeOrder() {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert("Missing details", "Please fill in all delivery details.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      Alert.alert(
        "Invalid phone",
        "Enter a valid 10-digit Indian mobile number.",
      );
      return;
    }

    if (Object.keys(cart).length === 0 || items.length === 0) {
      Alert.alert(
        "Empty cart",
        "Please add available products before checkout.",
      );
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Login required", "Please log in before placing an order.");
      router.push("/auth");
      return;
    }

    setPlacing(true);

    try {
      const userSnapshot = await getDoc(doc(db, "users", user.uid));
      const userData = userSnapshot.data();

      const approvedDealer =
        userData?.role === "dealer" && userData?.dealerStatus === "approved";

      // Re-fetch product prices before saving the order.
      const orderItems: CheckoutItem[] = [];
      let orderTotal = 0;

      for (const item of items) {
        const productSnapshot = await getDoc(
          doc(db, "products", item.productId),
        );

        if (!productSnapshot.exists()) {
          throw new Error(`${item.name} is no longer available.`);
        }

        const product = productSnapshot.data();
        const price = Number(
          approvedDealer ? product.dealerPrice : product.price,
        );

        if (!Number.isFinite(price) || price < 0) {
          throw new Error(`Invalid price for ${item.name}.`);
        }

        const quantity = Math.max(0, Math.floor(Number(cart[item.productId])));

        if (quantity <= 0) continue;

        const subtotal = price * quantity;

        orderItems.push({
          productId: item.productId,
          name: String(product.name ?? item.name),
          price,
          quantity,
          subtotal,
        });

        orderTotal += subtotal;
      }

      if (orderItems.length === 0) {
        throw new Error("Your cart has no available products.");
      }

      const docRef = await addDoc(collection(db, "orders"), {
        userId: user.uid,
        customerName: name.trim(),
        email: user.email ?? "",
        phone: phone.trim(),
        address: address.trim(),
        items: orderItems,
        total: orderTotal,
        paymentMethod: "Cash on Delivery",
        paymentStatus: "pending",
        status: "placed",
        createdAt: serverTimestamp(),
      });

      // Dispatch multi-channel notifications (Push, Email, SMS) via backend
      user
        .getIdToken()
        .then((authToken) => {
          fetch(`${API_BASE_URL}/notify/order-confirmation`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId: docRef.id }),
          }).catch((err) =>
            console.log("Order confirmation notification dispatch error:", err)
          );
        })
        .catch((tErr) => console.log("Auth token error:", tErr));

      clearCart();

      Alert.alert("Order placed!", "Your order has been placed successfully.", [
        {
          text: "View orders",
          onPress: () => router.replace("/orders"),
        },
      ]);
    } catch (error) {
      console.error("Checkout error:", error);
      Alert.alert(
        "Could not place order",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  }

  function handlePaymentMessage(message: string) {
    try {
      const result = JSON.parse(message);

      if (result.type !== "RAZORPAY_RESULT") return;

      setPaymentWebViewVisible(false);

      if (result.success) {
        clearCart();

        Alert.alert(
          "Payment successful",
          "Your payment has been verified and your order recorded.",
          [
            {
              text: "View orders",
              onPress: () => router.replace("/orders"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Payment not verified",
          "Your order has not been confirmed. Check your payment status before retrying.",
        );
      }
    } catch {
      Alert.alert(
        "Payment status unavailable",
        "We couldn't read the payment result. Check My Orders before trying again.",
      );
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Checkout</Text>
      <Text style={styles.subtitle}>{itemCount} item(s) in your cart</Text>

      <View style={styles.summary}>
        <Text style={styles.sectionHeading}>Order Summary</Text>

        {loadingItems ? (
          <ActivityIndicator size="small" color="#087E8B" />
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>
            Your cart is empty. Return to the shop to add products.
          </Text>
        ) : (
          <>
            {items.map((item) => (
              <View key={item.productId} style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      ₹{item.price.toLocaleString("en-IN")} per unit
                    </Text>
                    <Text style={styles.subtotal}>
                      Subtotal: ₹{item.subtotal.toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => removeFromCart(item.productId)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.quantityControls}>
                  <Text style={styles.quantityLabel}>Quantity</Text>

                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepButton}
                      onPress={() => {
                        if (item.quantity <= 1) {
                          removeFromCart(item.productId);
                        } else {
                          setQuantity(item.productId, item.quantity - 1);
                        }
                      }}
                    >
                      <Text style={styles.stepText}>−</Text>
                    </TouchableOpacity>

                    <Text style={styles.quantityValue}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.stepButton}
                      onPress={() =>
                        setQuantity(item.productId, item.quantity + 1)
                      }
                    >
                      <Text style={styles.stepText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>
                ₹{total.toLocaleString("en-IN")}
              </Text>
            </View>

            {isDealer && (
              <Text style={styles.dealerNote}>
                Approved dealer wholesale pricing applied
              </Text>
            )}
          </>
        )}
      </View>

      <Text style={styles.sectionHeading}>Delivery Details</Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Mobile number</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <Text style={styles.label}>Delivery address</Text>
      <TextInput
        style={[styles.input, styles.address]}
        value={address}
        onChangeText={setAddress}
        multiline
      />

      <View style={styles.payment}>
        <Text style={styles.label}>Payment method</Text>

        <TouchableOpacity
          style={styles.paymentOption}
          onPress={() => setPaymentMethod("cod")}
        >
          <Text style={styles.paymentOptionText}>
            {paymentMethod === "cod" ? "🔘" : "◯"} Cash on Delivery
          </Text>
          <Text style={styles.note}>Pay when your order is delivered.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.paymentOption}
          onPress={() => setPaymentMethod("razorpay")}
        >
          <Text style={styles.paymentOptionText}>
            {paymentMethod === "razorpay" ? "🔘" : "◯"} Razorpay (Test Mode)
          </Text>
          <Text style={styles.note}>Test online payment checkout.</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          (placing || loadingItems || items.length === 0) && styles.disabled,
        ]}
        onPress={() => {
          if (paymentMethod === "razorpay") {
            startRazorpayPayment();
          } else {
            placeOrder();
          }
        }}
        disabled={placing || loadingItems || items.length === 0}
      >
        <Text style={styles.buttonText}>
          {placing
            ? "Please wait..."
            : paymentMethod === "razorpay"
              ? `Pay with Razorpay • ₹${total.toLocaleString("en-IN")}`
              : `Place Order • ₹${total.toLocaleString("en-IN")}`}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={paymentWebViewVisible}
        animationType="slide"
        onRequestClose={() => {
          setPaymentWebViewVisible(false);
        }}
      >
        <View style={{ flex: 1, paddingTop: 40 }}>
          <TouchableOpacity
            style={{ padding: 16, backgroundColor: "#087E8B" }}
            onPress={() => setPaymentWebViewVisible(false)}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
              Close payment
            </Text>
          </TouchableOpacity>

          <WebView
            source={{ html: paymentHtml }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            onMessage={(event) => handlePaymentMessage(event.nativeEvent.data)}
            onError={() => {
              Alert.alert(
                "Checkout error",
                "The payment page couldn't load. Check your internet connection.",
              );
            }}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 22,
    paddingBottom: 40,
    backgroundColor: "#F7FAFC",
    flexGrow: 1,
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#123B5D",
    marginBottom: 6,
  },
  subtitle: {
    color: "#64748B",
    marginBottom: 20,
  },
  summary: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE6ED",
    marginBottom: 24,
    gap: 14,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#123B5D",
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    color: "#243B53",
    fontSize: 15,
    fontWeight: "600",
  },
  itemMeta: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 4,
  },
  subtotal: {
    color: "#243B53",
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    color: "#123B5D",
    fontSize: 17,
    fontWeight: "700",
  },
  totalAmount: {
    color: "#087E8B",
    fontSize: 22,
    fontWeight: "800",
  },
  dealerNote: {
    color: "#087E8B",
    fontSize: 12,
  },
  emptyText: {
    color: "#64748B",
    lineHeight: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#243B53",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 13,
    marginBottom: 18,
    fontSize: 15,
  },
  address: {
    minHeight: 95,
    textAlignVertical: "top",
  },
  payment: {
    backgroundColor: "#E8F5EE",
    padding: 16,
    borderRadius: 10,
    marginBottom: 24,
  },
  paymentText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    color: "#475569",
    marginTop: 5,
  },
  button: {
    backgroundColor: "#087E8B",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  itemCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  quantityLabel: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#E0F2F1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    color: "#087E8B",
    fontSize: 22,
    fontWeight: "700",
  },
  quantityValue: {
    color: "#123B5D",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 18,
    textAlign: "center",
  },
  removeButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  removeText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
  },
  paymentOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D7E3E8",
    borderRadius: 10,
    marginTop: 8,
  },
  paymentOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#173042",
  },
});
