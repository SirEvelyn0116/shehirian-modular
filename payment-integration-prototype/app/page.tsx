import Link from "next/link";

// Import the Clover service directly instead of calling the API route
import { cloverService } from "@/lib/clover";

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

async function getInventory(): Promise<Product[]> {
  try {
    // Try to get real inventory from Clover
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const apiToken = process.env.CLOVER_API_TOKEN;

    if (!merchantId || !apiToken || merchantId === "your_merchant_id_here" || apiToken === "your_clover_api_token_here") {
      console.log("Clover credentials not configured - using mock data");
      // Return mock data for demo purposes
      return [
        {
          id: "DEMO-1",
          name: "Sample Product",
          price: 50.0,
          quantity: 100,
        },
      ];
    }

    // Fetch from Clover API
    const CLOVER_BASE_URL = "https://sandbox.dev.clover.com/v3";
    const response = await fetch(
      `${CLOVER_BASE_URL}/merchants/${merchantId}/items`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch from Clover:", response.statusText);
      return [];
    }

    const data = await response.json();
    const items = data.elements || [];

    return items.map((item: { id: string; name: string; price: number; stockCount?: number }) => ({
      id: item.id,
      name: item.name,
      price: item.price ? item.price / 100 : 0,
      quantity: item.stockCount || 0,
    }));
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return [];
  }
}

export default async function Home() {
  const products = await getInventory();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Store Demo</h1>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Our Store
          </h2>
          <p className="text-lg text-gray-600">
            Choose your preferred fulfillment option at checkout
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto mb-12">
          {products.length > 0 ? (
            products.map((product) => (
              <Link
                key={product.id}
                href={`/product?id=${product.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="aspect-square bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  <div className="text-6xl">📦</div>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    {product.quantity > 0
                      ? `${product.quantity} in stock`
                      : "Out of stock"}
                  </p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-blue-600">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500">View Details →</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-600">
                No products available. Configure Clover API credentials to see inventory.
              </p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">

          {/* Info Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Fulfillment Options
            </h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">🚚</div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Ship from Store
                  </h4>
                  <p className="text-sm text-gray-600">
                    Shopify Shipping with discounted carrier rates
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-2xl">📦</div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Fulfilled by Amazon
                  </h4>
                  <p className="text-sm text-gray-600">
                    Prime delivery with Amazon fulfillment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
