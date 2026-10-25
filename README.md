# 💧 AquaPure – Water Purifier E-Commerce & Service App

AquaPure is a mobile application built using **React Native and Expo** that provides an integrated platform for customers, dealers, and administrators to manage water purifier purchases, wholesale orders, and service requests.

The application uses **Firebase Authentication and Cloud Firestore**, with a separately deployed **Node.js/Express backend** for payment processing and notifications.

## 🚀 Features

### 👤 Customer Portal

- User registration and login using Firebase Authentication
- Browse water purifiers, accessories, and related products
- Add products to cart
- Place orders using Cash on Delivery (COD) or Razorpay test payments
- Track order history and status
- Book water purifier services
- Manage user profile
- Receive push and email notifications

### 🏪 Dealer Portal

- Dealer registration and authentication
- Dealer-specific product pricing
- Wholesale and bulk ordering
- Order history and management
- Dealer approval workflow
- Access to dealer-specific features

### 🛠️ Admin Portal

- Manage products and inventory information
- View and manage customer orders
- Update order statuses
- Manage service booking requests
- Review and approve dealer accounts
- Monitor application operations

The admin panel is a separate web application.

## 🧰 Tech Stack

| Component            | Technology                      |
| -------------------- | ------------------------------- |
| Mobile Application   | React Native, Expo              |
| Programming Language | TypeScript / JavaScript         |
| Authentication       | Firebase Authentication         |
| Database             | Cloud Firestore                 |
| Backend              | Node.js, Express.js             |
| Payments             | Razorpay (Test Mode), COD       |
| Push Notifications   | Firebase Cloud Messaging (FCM)  |
| Email Notifications  | EmailJS                         |
| SMS Integration      | TextBee (Simulation Mode)       |
| Backend Hosting      | Render                          |
| Admin Panel Hosting  | Vercel                          |
| Android Builds       | Expo Application Services (EAS) |

## 🏗️ System Architecture

```text
                  AquaPure Platform
                         |
            ---------------------------
            |                         |
     React Native App          Admin Web Panel
       (Expo/Android)              (Vercel)
            |                         |
            -----------   -------------
                      |   |
                      v   v
                Firebase Services
                - Authentication
                - Cloud Firestore
                - Cloud Messaging
                      |
                      v
             Node.js / Express API
                   (Render)
                      |
            ---------------------
            |         |         |
         Razorpay   EmailJS   TextBee
         Test Mode   Email    Simulation
```

## 📂 Repository Structure

AquaPure uses separate repositories for the mobile application and backend.

### Mobile Application Repository

GitHub: [https://github.com/divya280904/aquapure](https://github.com/divya280904/aquapure)

Contains the React Native/Expo application, including customer and dealer interfaces, authentication, shopping cart, checkout, order history, and service booking.

### Backend Repository

GitHub: [https://github.com/divya280904/aquapure-payment-api](https://github.com/divya280904/aquapure-payment-api)

Contains the Node.js/Express backend responsible for server-side API operations, Razorpay payment verification, and notification processing.

**Live Backend URL:**

[https://aquapure-payment-api.onrender.com/](https://aquapure-payment-api.onrender.com/)

### Admin Panel

Live URL: [https://aquapure-lake.vercel.app/](https://aquapure-lake.vercel.app/)

The admin panel provides management functionality for products, orders, service requests, and dealer approvals.

## ⚙️ Mobile Application Setup

### Prerequisites

- Node.js (LTS)
- npm
- Expo CLI / Expo tooling
- Android emulator or Android device
- Firebase project configuration

### 1. Clone the Mobile Repository

```bash
git clone https://github.com/divya280904/aquapure.git
cd aquapure
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Configure the Firebase project and API endpoints using the environment variable names expected by the application.

Example:

```env
EXPO_PUBLIC_API_URL=https://aquapure-payment-api.onrender.com
```

### 4. Start the Application

```bash
npx expo start
```

For Android:

```bash
npx expo start --android
```

**Note:** Features requiring native push notification support should be tested using a compatible Android development or production build.

## 🔐 Demo Credentials

The following section is intended for assignment evaluation.

### Customer Login

```text
Email: john@example.com
Password: password123
```

### Dealer Login

```text
Email: abc@dealer.com
Password: password123
```

### Admin Login

```text
Admin Panel: https://aquapure-lake.vercel.app/
Email: admin@aquapure.com
Password: admin123
```

## 💳 Payment Integration

AquaPure supports two checkout options:

**Cash on Delivery (COD)**

Customers can place orders without completing an online payment.

**Razorpay Test Mode**

The application integrates Razorpay for payment testing.

- Backend API creates and verifies payment-related requests.
- Test mode is used for demonstration.
- No real-money payment should be required during evaluation.

## 🔔 Notification System

AquaPure integrates multiple notification channels.

### 1. Firebase Cloud Messaging (FCM)

Push notification functionality is integrated for supported app events, including order-status updates.

### 2. EmailJS

EmailJS is used to send formatted email notifications for supported workflows.

### 3. TextBee SMS – Simulation Mode

**Current Status: Simulation Mode Enabled**

The backend contains TextBee SMS integration logic, but actual SMS delivery is not enabled for the submitted demonstration.

In simulation mode:

- The backend simulates SMS notification events.
- Notification details are logged for testing and debugging.
- The application does not send actual SMS messages to recipients.
- SMS simulation does not block other supported notification channels.

This approach allows the SMS notification workflow to be demonstrated without requiring a live SMS gateway.

**Limitation:** Real SMS delivery has not been enabled or verified. SMS functionality should not be interpreted as a production-ready notification service.

## 🛠️ Service Booking

Customers can request water purifier-related services through the mobile application.

The service workflow includes:

- Service request submission
- Storage of booking information
- Admin-side service request management
- Service status updates

## 📦 Android APK

The Android application is built using Expo Application Services (EAS).

Example build command:

```bash
eas build --platform android --profile preview
```

The build profile must be configured to generate an installable APK.

**APK Download:**

[https://drive.google.com/file/d/11DmMRLW_vX7Ay_lG7w_OQsnjKKTsGSwr/view?usp=sharing](https://drive.google.com/file/d/11DmMRLW_vX7Ay_lG7w_OQsnjKKTsGSwr/view?usp=sharing)

## 🎥 Project Demonstration

The application demonstration covers:

1. Customer registration/login, product browsing, cart, and checkout
2. Dealer login, dealer-specific pricing, and wholesale ordering
3. Admin portal for managing products, orders, service requests, and dealers
4. Payment demonstration using COD or Razorpay test mode
5. Notification functionality and documented SMS simulation limitation

**Demo Video:**

[https://www.loom.com/share/de43e041b4fa413c99084608d6bcebbf](https://www.loom.com/share/de43e041b4fa413c99084608d6bcebbf)

## 🔒 Security Considerations

- Firebase Authentication handles user identity.
- Firestore security rules govern supported client-side database access.
- Backend-only credentials should remain on the server.
- Payment verification is handled through the backend.
- Firebase service-account private keys must never be published.
- Demo accounts should be restricted and should not expose real customer data.
- Test payment credentials must not be confused with production credentials.

## ⚠️ Current Limitations

- Razorpay is configured for test transactions.
- TextBee SMS operates in simulation mode; actual SMS delivery is unavailable.
- Native push notifications require a compatible installed application build and appropriate permissions.
- The backend is hosted on Render, so response times may vary depending on hosting conditions.
- Production deployment would require additional operational testing, monitoring, and security review.

## 🔮 Future Improvements

- Enable and validate real SMS delivery through TextBee
- Add delivery tracking and shipment updates
- Expand dealer analytics
- Improve inventory and stock management
- Add advanced product filtering and search
- Add notification retry and delivery monitoring
- Expand automated testing

## 👩‍💻 Developer

**Divya Gupta**

Full Stack Developer | React Native | Node.js | Firebase | AI Integration

GitHub: [https://github.com/divya280904](https://github.com/divya280904)

## 📄 Project Information

The project demonstrates mobile application development, role-based e-commerce workflows, Firebase integration, backend API development, payment integration, and administrative management.

---

**AquaPure — Simplifying Water Purifier Shopping and Services.**
