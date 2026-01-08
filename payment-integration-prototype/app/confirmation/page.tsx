"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export const dynamic = 'force-dynamic';

interface OrderDetails {
  orderId: string;
  trackingNumber: string;
  estimatedDelivery: string;
  fulfillmentOption: string;
}

export default function ConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const fulfillment = searchParams.get("fulfillment") || "shopify";

  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch order details
    const fetchOrderDetails = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`);
        if (response.ok) {
          const data = await response.json();
          setOrderDetails(data);
        }
      } catch (error) {
        console.error("Failed to fetch order details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  const isAmazon = fulfillment === "amazon";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="text-2xl font-bold text-gray-900 hover:text-blue-600"
          >
            ← Back to Store
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Banner */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="text-5xl">✅</div>
            <div>
              <h1 className="text-3xl font-bold text-green-900 mb-1">
                Order Confirmed!
              </h1>
              <p className="text-green-700">
                Thank you for your purchase. Your order has been received and is
                being processed.
              </p>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Order Details
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-600 font-medium">Order ID</span>
              <span className="font-mono text-gray-900">
                {orderDetails?.orderId || orderId}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-600 font-medium">Tracking Number</span>
              <span className="font-mono text-blue-600">
                {orderDetails?.trackingNumber || "Generating..."}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b">
              <span className="text-gray-600 font-medium">
                Fulfillment Method
              </span>
              <span className="font-semibold text-gray-900">
                {isAmazon ? "📦 Fulfilled by Amazon" : "🚚 Ship from Store"}
              </span>
            </div>

            <div className="flex justify-between py-3">
              <span className="text-gray-600 font-medium">
                Estimated Delivery
              </span>
              <span className="font-semibold text-gray-900">
                {orderDetails?.estimatedDelivery || "Calculating..."}
              </span>
            </div>
          </div>
        </div>

        {/* Fulfillment-specific Info */}
        <div
          className={`rounded-lg shadow-md p-6 mb-8 ${
            isAmazon ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
          }`}
        >
          {isAmazon ? (
            <>
              <div className="flex items-center space-x-3 mb-4">
                <div className="text-3xl">📦</div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Amazon FBA Fulfillment
                </h3>
              </div>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Your order will be fulfilled by Amazon
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Prime delivery speed (1-2 business days)
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Free shipping included
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Amazon&apos;s return policy applies
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-3 mb-4">
                <div className="text-3xl">🚚</div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Shopify Shipping
                </h3>
              </div>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Shipped directly from our store
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Discounted carrier rates applied
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Tracking updates via email
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Standard return policy
                </p>
              </div>
            </>
          )}
        </div>

        {/* Clover Integration Notice */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="text-2xl">🔄</div>
            <h3 className="text-lg font-semibold text-gray-900">
              POS Integration
            </h3>
          </div>
          <p className="text-gray-700">
            This order has been synchronized with your Clover POS system for
            inventory management and reporting.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            href="/"
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold text-center hover:bg-blue-700 transition-colors"
          >
            Continue Shopping
          </Link>
          <button
            onClick={() => window.print()}
            className="flex-1 bg-gray-200 text-gray-900 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Print Receipt
          </button>
        </div>
      </main>
    </div>
  );
}
