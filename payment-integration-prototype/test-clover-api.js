/**
 * Test script to verify Clover API integration
 * Run with: node --env-file=.env.local test-clover-api.js
 */

const CLOVER_BASE_URL = "https://sandbox.dev.clover.com/v3";
const merchantId = process.env.CLOVER_MERCHANT_ID;
const apiToken = process.env.CLOVER_API_TOKEN;

async function testCloverConnection() {
  console.log("🔍 Testing Clover API Connection...\n");

  if (!merchantId || !apiToken) {
    console.error("❌ Missing environment variables:");
    console.error("   CLOVER_MERCHANT_ID:", merchantId ? "✓ Set" : "✗ Missing");
    console.error("   CLOVER_API_TOKEN:", apiToken ? "✓ Set" : "✗ Missing");
    console.error("\n📝 Create a .env.local file with your Clover credentials");
    return;
  }

  console.log("✓ Environment variables configured");
  console.log(`  Merchant ID: ${merchantId}`);
  console.log(`  API Token: ${apiToken.substring(0, 10)}...\n`);

  try {
    console.log("📦 Fetching inventory from Clover...");
    const response = await fetch(
      `${CLOVER_BASE_URL}/merchants/${merchantId}/items`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("\n❌ API Error:");
      console.error(errorText);
      return;
    }

    const data = await response.json();
    console.log("\n✓ Successfully connected to Clover API!");
    console.log(`\n📊 Inventory Results:`);
    console.log(`   Total items: ${data.elements?.length || 0}`);

    if (data.elements && data.elements.length > 0) {
      console.log("\n   Sample items:");
      data.elements.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.name}`);
        console.log(`      ID: ${item.id}`);
        console.log(`      Price: $${item.price ? (item.price / 100).toFixed(2) : "0.00"}`);
        console.log(`      Stock: ${item.stockCount || "N/A"}`);
      });
    } else {
      console.log("   No items found in inventory");
      console.log("   💡 Add items in your Clover Sandbox Dashboard");
    }
  } catch (error) {
    console.error("\n❌ Connection Error:");
    console.error(error.message);
  }
}

testCloverConnection();
