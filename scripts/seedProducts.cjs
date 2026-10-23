
const path = require("path");
const { initializeApp, cert, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccountPath = path.resolve(
    __dirname,
    "../aquapure-3d28b-firebase-adminsdk-fbsvc-e819c2ae7a.json"
);

const serviceAccount = require(serviceAccountPath);

const app = initializeApp({
    credential: cert(serviceAccount),
});

const db = getFirestore(app);

const categoryData = [
    {
        category: "Purifiers",
        basePrice: 6999,
        step: 650,
        image:
            "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80",
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
        basePrice: 299,
        step: 80,
        image:
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
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
        basePrice: 1499,
        step: 150,
        image:
            "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80",
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
        basePrice: 799,
        step: 150,
        image:
            "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=600&q=80",
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
        basePrice: 99,
        step: 150,
        image:
            "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80",
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

async function seedProducts() {
    const batch = db.batch();
    let count = 0;

    categoryData.forEach((group, groupIndex) => {
        group.names.forEach((name, index) => {
            const price = group.basePrice + index * group.step;
            const productId = `seed-${groupIndex}-${index}`;

            batch.set(
                db.collection("products").doc(productId),
                {
                    name,
                    category: group.category,
                    price,
                    dealerPrice: Math.round(price * 0.8),
                    imageUrl: group.image,
                },
                { merge: true }
            );

            count++;
        });
    });

    await batch.commit();
    console.log(`Successfully updated ${count} products with image URLs.`);
}

seedProducts()
    .catch((error) => {
        console.error("Product update failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await deleteApp(app);
    });
