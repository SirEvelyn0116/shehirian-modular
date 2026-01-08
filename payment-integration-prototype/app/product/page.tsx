"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function ProductPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch("/api/get-clover-inventory");
        const data = await res.json();

        if (data.success && data.items.length > 0) {
          // If productId is provided, find that specific product
          // Otherwise, use the first product
          const foundProduct = productId
            ? data.items.find((item: Product) => item.id === productId)
            : data.items[0];

          setProduct(foundProduct || data.items[0]);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600">
              ← Back to Store
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-xl text-gray-600">Product not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600">
            ← Back to Store
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg aspect-square flex items-center justify-center">
            <div className="text-9xl">📦</div>
          </div>

          {/* Product Details */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {product.name}
            </h1>
            <div className="text-3xl font-bold text-blue-600 mb-6">
              ${product.price.toFixed(2)}
            </div>

            <div className="mb-6">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  product.quantity > 0
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {product.quantity > 0
                  ? `${product.quantity} in stock`
                  : "Out of stock"}
              </span>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Description
              </h2>
              <p className="text-gray-600 leading-relaxed">
                High-quality product with multiple fulfillment options. This
                demonstration item showcases our checkout flow featuring both
                Shopify Shipping (FBM) and Amazon FBA integration with Clover
                POS synchronization.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Features
              </h2>
              <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li>Premium quality materials</li>
                <li>Multiple fulfillment options</li>
                <li>Real-time inventory sync</li>
                <li>Fast shipping available</li>
              </ul>
            </div>

            {/* Quantity Selector */}
            <div className="mb-8">
              <label className="text-lg font-semibold text-gray-900 mb-2 block">
                Quantity
              </label>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-md bg-gray-200 hover:bg-gray-300 font-semibold"
                  disabled={product.quantity === 0}
                >
                  −
                </button>
                <span className="text-xl font-semibold w-12 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity(Math.min(product.quantity, quantity + 1))
                  }
                  className="w-10 h-10 rounded-md bg-gray-200 hover:bg-gray-300 font-semibold"
                  disabled={product.quantity === 0 || quantity >= product.quantity}
                >
                  +
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Maximum available: {product.quantity}
              </p>
            </div>

            {/* Add to Cart / Checkout */}
            {product.quantity > 0 ? (
              <Link
                href={`/checkout?quantity=${quantity}&productId=${product.id}&price=${product.price}`}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors text-center"
              >
                Proceed to Checkout - ${(product.price * quantity).toFixed(2)}
              </Link>
            ) : (
              <button
                disabled
                className="w-full bg-gray-400 text-white py-4 px-6 rounded-lg font-semibold text-lg cursor-not-allowed text-center"
              >
                Out of Stock
              </button>
            )}

            {/* Fulfillment Info */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">
                🚚 Flexible Fulfillment
              </h3>
              <p className="text-sm text-gray-600">
                Choose between Ship from Store or Amazon FBA at checkout
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
